"""Basic defender v4: seated heads and physically separated carried tools.

The requested compact figure style changes the resting anatomy. Entire rigid
head assemblies move as one, preserving cap/hair fits and head articulation.
The internal overlap socket is clothing; no visible neck column is authored.
"""
import json
import math
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from geometric_defender_fit_v2 import bounds, parents, fitted_neck, contact, remove


def seated_head_without_exposed_neck(b):
    bpy.context.view_layer.update()
    body=next(o for o in b.objects if o.name in ('Continuous tunic bodice','Tunic bodice'))
    body_top=bounds(body)[1].z
    face=next((o for o in b.objects if o.name in ('Observed face','Face')),None)
    remove(b,'Fitted neckline core','Continuous tailored neckline',
           'Articulated steel gorget','Steel collar lining')
    if face:
        seat=face
    else:
        shells=[o for o in b.objects if o.name.startswith('Helmet') and 'ridge' not in o.name.lower() and 'shadow' not in o.name.lower()]
        seat=min(shells,key=lambda o:bounds(o)[0].z)
    old_low=bounds(seat)[0].z
    translation=body_top-.014-old_low
    # Moving the actual named pivot moves all existing descendants together;
    # hats, eyes, fringe, beard, visor and hood keep exactly their mutual fit.
    m=b.head.matrix_world.copy();m.translation.z+=translation;b.head.matrix_world=m
    bpy.context.view_layer.update()
    if face:
        # Torso decoration must still sit below the jaw after the whole head
        # moves down. Keep the full exposed face aperture clear; collars are
        # clothing edges, never a new beard or a band across the chin.
        jaw=bounds(face)[0].z
        adjustments=[]
        collars=[o for o in b.objects if o.name.startswith(('Collar facet ','Rear collar facet ','Large chest leaf '))]
        if collars:
            delta=min(0.,jaw-.006-max(bounds(o)[1].z for o in collars))
            for ob in collars:
                inv=ob.matrix_world.inverted()
                for v in ob.data.vertices:
                    point=ob.matrix_world@v.co;point.z+=delta;v.co=inv@point
                ob.data.update()
            adjustments.append({'parts':[o.name for o in collars],'translationZM':delta,'purpose':'Chest collar leaves/facets below the actual seated jaw.'})
        for ob in b.objects:
            if ob.name.startswith(('Exterior ivory fur block ','Mantle silver brooch','Cape gold brooch','Gold cape brooch')):
                inv=ob.matrix_world.inverted()
                for v in ob.data.vertices:
                    point=ob.matrix_world@v.co;point.z+=translation;v.co=inv@point
                ob.data.update()
                adjustments.append({'part':ob.name,'translationZM':translation,'purpose':'Retain hood/jaw clearance while decoration stays on torso pivot.'})
            if not ob.name.startswith(('Ivory stole ','Long source front stole ')):continue
            inverse=ob.matrix_world.inverted()
            for vertex in ob.data.vertices:
                point=ob.matrix_world@vertex.co
                if point.z>jaw-.008:point.z=jaw-.008;vertex.co=inverse@point
            ob.data.update()
            adjustments.append({'part':ob.name,'topSurfaceLimitZM':jaw-.008,'purpose':'Stole upper edge meets clothing below chin; face stays uncovered.'})
        b.root['jawGarmentFitV4']=json.dumps(adjustments)
        b.cfg['jawGarmentFitV4']=adjustments
    if face:
        fitted_neck(b,face,body_top,b.torso,b.head,centered=not getattr(b,'coverSkin',[]))
    else:
        lo,hi=bounds(seat);cy=(lo.y+hi.y)/2
        # A closed helmet is a hollow shell around the chest. Give its lower
        # skirt a broad, fitted shoulder plate instead of a thin neck column.
        chest_lo,chest_hi=bounds(body);width=(chest_hi.x-chest_lo.x)*1.35
        mantle=b.loft('Direct fitted upper chest shoulder plate',[
            b.chamfer(0,.025,body_top-.095,width*.83,.42,.035),
            b.chamfer(0,.025,body_top+.010,width,.57,.040)],
            ['steel','steelLight'],b.torso)
        b.loft('Articulated steel gorget',[
            b.ring(0,cy,body_top-.075,.185,.165,10),
            b.ring(0,cy,body_top-.005,.270,.240,10),
            b.ring(0,cy,body_top+.048,.370,.335,10)],['steel','steelLight'],b.head)
        b.loft('Steel collar lining',[
            b.ring(0,cy,body_top-.075,.210,.185,10),
            b.ring(0,cy,body_top+.012,.210,.185,10)],'steel',b.torso)
    if hasattr(b,'facez'):b.facez+=translation
    for entry in b.coverage:
        if entry.get('type')=='hood':
            entry['center']=[entry['center'][0],entry['center'][1],entry['center'][2]+translation]
    actual_low=bounds(seat)[0].z
    result={'joint':'direct_head_torso_seat','parts':[seat.name,body.name],
            'beforeHeadLowerSurfaceM':old_low,'torsoClothingUpperSurfaceM':body_top,
            'appliedWholeHeadTranslationZM':translation,
            'afterHeadLowerSurfaceM':actual_low,
            'restOverlapM':body_top-actual_low,
            'actualSurfaceContact':contact(seat,body),
            'passed':abs(actual_low-(body_top-.014))<.00001 and contact(seat,body)['passed']}
    # Hoods have a deliberately shallow frontal face outside the narrow torso
    # footprint. The actual hood garment, rather than its open face aperture,
    # is the required body contact in that design.
    covers=getattr(b,'coverShell',[]) or [o for o in b.objects if o.name.startswith('Helmet') and 'shadow' not in o.name.lower() and 'ridge' not in o.name.lower()]
    if not result['passed'] and covers:
        tests=[contact(o,body) for o in covers]
        best=max(tests,key=lambda v:(v['passed'],v['surfaceIntersectionPairs']))
        result['actualSurfaceContact']=best
        result['parts']=best['parts']
        result['passed']=abs(actual_low-(body_top-.014))<.00001 and best['passed']
    if not result['passed'] and face is None:
        best=contact(seat,mantle)
        result['actualSurfaceContact']=best;result['parts']=best['parts']
        result['passed']=abs(actual_low-(body_top-.014))<.00001 and best['passed']
    if not result['passed'] and face is not None:
        # The historical Soldier IV/V use a shallow frontal face and a hollow
        # helmet skirt outside the narrow bodice. Its upper chest must meet
        # that real jaw aperture, rather than leave a column reaching forward.
        blo,bhi=bounds(body);flo,fhi=bounds(face)
        front=max(bhi.y,fhi.y+.018);rear=min(blo.y,flo.y-.030)
        cy=(front+rear)/2;depth=front-rear;width=max(bhi.x-blo.x,(fhi.x-flo.x)*1.10)
        yoke=b.loft('Direct fitted upper chest shoulder yoke',[
            b.chamfer(0,0,body_top-.085,(bhi.x-blo.x)*.95,.34,.030),
            b.chamfer(0,cy,body_top+.002,width,depth,.035)],
            ['steel','steelLight'] if b.root.get('family')=='soldier' else ['cloth','clothLight'],b.torso)
        best=contact(face,yoke);support=contact(yoke,body)
        result['actualSurfaceContact']=best;result['parts']=best['parts']
        result['actualYokeTorsoContact']=support
        result['passed']=abs(actual_low-(body_top-.014))<.00001 and best['passed'] and support['passed']
    assert result['passed'],(b.id,result)
    b.root['headTorsoSeatRevision']='direct-compact-seat-v4'
    b.root['headTorsoSeatQa']=json.dumps(result)
    b.root['headRestDesignOverride']='User asks all heads/hoods/helmets seated directly on clothing, with no exposed neck.'
    b.cfg['headTorsoSeatV4']=result
    b.seatChecks=[result]
    return result


def tool_rest_checks(b,family,rank):
    """Independently measure actual carried geometry in native world axes."""
    result=[]
    if family=='runebreaker':
        face=next(o for o in b.objects if o.name=='Observed face')
        hammer=[o for o in b.objects if o.name.startswith(('Mallet head','Hammer steel head','Double hammer','Hammer claw'))]
        face_hi=bounds(face)[1].x
        clearance=min(bounds(o)[0].x for o in hammer)-face_hi
        intersections=sum(contact(face,o)['surfaceIntersectionPairs'] for o in hammer)
        grasp=contact(next(o for o in b.objects if o.name=='Hand R'),next(o for o in b.objects if o.name=='Hammer haft'))
        result.append({'joint':'hammer_separated_from_skull','parts':[face.name]+[o.name for o in hammer],
                       'minimumLateralClearanceM':clearance,'actualSurfaceIntersectionPairs':intersections,
                       'passed':clearance>=.060 and intersections==0})
        result.append({'joint':'hammer_haft_grasp',**grasp})
    if family=='cleric':
        shaft=next(o for o in b.objects if o.name=='Staff shaft')
        lo,hi=bounds(shaft);points=[shaft.matrix_world@v.co for v in shaft.data.vertices]
        n=len(points)//2;bottom=sum(points[:n],Vector())/n;top=sum(points[n:],Vector())/n
        drift=math.hypot(top.x-bottom.x,top.y-bottom.y)
        grasp=contact(next(o for o in b.objects if o.name=='Hand R'),shaft)
        result.append({'joint':'cleric_vertical_staff_rest','parts':[shaft.name],
                       'actualBottomRingCentre':list(bottom),'actualTopRingCentre':list(top),
                       'horizontalAxisDriftM':drift,'verticalLengthM':top.z-bottom.z,
                       'passed':drift<.000001 and top.z>bottom.z})
        result.append({'joint':'cleric_staff_grasp',**grasp})
        roofs=[o for o in b.objects if o.name.startswith('Mitre closed upper roof')]
        if rank>=2:
            foundation=next(o for o in b.objects if o.name=='Fitted mitre foundation')
            low,high=bounds(foundation);centre=(low+high)/2
            trees=[BVHTree.FromPolygons([o.matrix_world@v.co for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons]) for o in roofs]
            samples=[]
            for dx,dy in ((0,0),(-.20,0),(.20,0),(0,-.20),(0,.20)):
                point=centre+Vector((dx*(high.x-low.x),dy*(high.y-low.y),2.))
                hits=[t.ray_cast(point,Vector((0,0,-1)),3.)[0] for t in trees]
                samples.append({'sample':list(point),'hitsClosedRoof':any(h is not None for h in hits)})
            result.append({'joint':'cleric_closed_mitre_roof','parts':[o.name for o in roofs],
                           'actualOverheadRays':samples,'passed':len(roofs)==2 and all(s['hitsClosedRoof'] for s in samples)})
    assert all(v['passed'] for v in result),(b.id,result)
    b.root['carriedToolRestQaV4']=json.dumps(result)
    b.toolRestChecks=result
    b.cfg['carriedToolRestQaV4']=result
    return result
