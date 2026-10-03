"""Defender-only v3 anatomical alignment and requested lightning design.

This module does not modify the shared builders or any champion/enemy files.
"""
import json
import math
import hashlib
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0,str(Path(__file__).resolve().parent))
from geometric_defender_fit_v2 import bounds, parents, fitted_neck, contact, curved_hair_lock

ROOT=Path(__file__).resolve().parents[2]


def head_axis_measurement(objects,head,torso):
    """Differentiate a full skull solid from an intentionally shallow aperture."""
    bpy.context.view_layer.update()
    faces=[o for o in objects if o.name in ('Observed face','Face')]
    bodices=[o for o in objects if o.name.startswith(('Continuous tunic bodice','Tunic bodice','Armor chest','Chestplate'))]
    if not bodices:
        bodices=[o for o in objects if o.type=='MESH' and o.parent==torso]
    body=bodices[0] if bodices else None
    face=faces[0] if faces else None
    body_axis=(sum(bounds(body),Vector())/2).y if body else torso.matrix_world.translation.y
    out={'nativeAxes':'+Y front, +X own right, Z up','torsoAxisY':body_axis,
         'headPivotY':head.matrix_world.translation.y,'torsoPart':body.name if body else None}
    covers=[o for o in objects if o.parent==head and o.name.startswith(('Thick pointed hood','Helmet'))]
    if face:
        low,high=bounds(face);centre=(low+high)/2;depth=high.y-low.y
        aperture=depth<.15 and bool(covers)
        out.update({'facePart':face.name,'skinBBoxCentre':list(centre),'skinDepthM':depth,
                    'shallowVisibleAperture':aperture,'fullSkullCentreY':None if aperture else centre.y,
                    'fullSkullToTorsoOffsetM':None if aperture else centre.y-body_axis})
    else:
        out.update({'facePart':None,'shallowVisibleAperture':False,'fullSkullCentreY':None,
                    'fullSkullToTorsoOffsetM':None})
    out['coverBounds']=[{'part':o.name,'min':list(bounds(o)[0]),'max':list(bounds(o)[1])} for o in covers]
    out['interpretation']='A shallow exposed face is not a complete skull; hood/helmet stays on its established head pivot.' if out['shallowVisibleAperture'] or face is None else 'Measure the actual full skin-head solid against the actual bodice centre.'
    return out


def center_full_head_on_torso(b):
    """Move the actual skull/cap assembly onto the body axis; rebuild short neck."""
    before=head_axis_measurement(b.objects,b.head,b.torso)
    face=next(o for o in b.objects if o.name=='Observed face')
    assert not before['shallowVisibleAperture']
    offset=before['torsoAxisY']-before['fullSkullCentreY']
    for ob in list(b.objects):
        if ob.name in ('Fitted neckline core','Continuous tailored neckline'):
            b.objects.remove(ob);bpy.data.objects.remove(ob,do_unlink=True)
    bpy.context.view_layer.update()
    for ob in list(b.coll.objects):
        if ob.type=='MESH' and any(p==b.head for p in parents(ob)):
            inverse=ob.matrix_world.inverted()
            for vertex in ob.data.vertices:
                point=ob.matrix_world@vertex.co;point.y+=offset;vertex.co=inverse@point
            ob.data.update()
    b.headFront+=offset
    fitted_neck(b,face,b.shoulderz+.025,b.torso,b.head,centered=True)
    after=head_axis_measurement(b.objects,b.head,b.torso)
    assert abs(after['fullSkullToTorsoOffsetM'])<.00001,after
    b.root['anatomicalHeadAxisY']=after['fullSkullCentreY']
    b.root['headAxisFitRevision']='actual-centred-skull-v3'
    b.axisFit={'before':before,'after':after,'appliedHeadTranslationY':offset,
               'method':'Translate actual full skull and all cap/hair/crown descendants; rebuild a short neck directly under the jaw. No long connector conceals the original offset.'}
    b.cfg['headAxisFit']=b.axisFit
    return b.axisFit


def crown_band(b,z,rx,ry,mat):
    """A true closed hollow band fitted around the low hair cap."""
    n=16;t=.034;h=.048;vertices=[]
    for zz,xx,yy in ((z,rx,ry),(z+h,rx,ry),(z,rx-t,ry-t),(z+h,rx-t,ry-t)):
        vertices.extend(b.ring(0,.16,zz,xx,yy,n))
    faces=[]
    for j in range(n):
        k=(j+1)%n
        faces.extend(((j,k,n+k,n+j),(2*n+j,3*n+j,3*n+k,2*n+k),
                      (j,2*n+j,2*n+k,k),(n+j,n+k,3*n+k,3*n+j)))
    return b.mesh('Fitted hollow lightning crown band',vertices,faces,mat,b.head)


def lightning_panel(b,name,x,y,z,height,width,mat,parent,mirror=False,angle=0.):
    """One continuous recognisable flat six-corner zigzag lightning silhouette."""
    # Upper and lower tips are separated by two real concave corners. This
    # outline is one stroke, rather than touching diamonds/triangle tokens.
    profile=[(0.,0.),(.62,.61),(.12,.61),(.19,1.),(-.43,.39),(.07,.39)]
    sign=-1 if mirror else 1
    a=math.radians(angle);cs,sn=math.cos(a),math.sin(a)
    vertices=[(x+sign*u*width*cs+v*height*sn,y,
               z-sign*u*width*sn+v*height*cs) for u,v in profile]
    return b.panel(name,vertices,.025 if height<.25 else .046,mat,parent,relief=0)


def storm_natural_hair_and_focus(b,rank):
    """User v3 override: natural low hair, tiered lightning crown and real bolt."""
    w,h=b.facew,b.faceh;upper=b.facez+h/2;cy=.16
    hair=b.loft('Natural fitted silver hair cap',[
        b.ring(0,cy,upper-.018,w*.53,w*.365,12),
        b.ring(-w*.025,cy-.005,upper+.052,w*.51,w*.36,12),
        b.ring(-w*.045,cy-.012,upper+.110,w*.37,w*.28,12),
        b.ring(-w*.05,cy-.015,upper+.135,w*.15,w*.12,12)],
        ['hair','hairLight','hairDark'],b.head)
    # Low separate locks follow the actual skull instead of forming arches.
    for j in range(4):
        x=(j-1.5)*w*.235;tip=upper-h*(.085 if j%2 else .055)
        outline=[(x-w*.125,b.headFront+.010,upper+.072),
                 (x+w*.122,b.headFront+.010,upper+.045),
                 (x+w*.080,b.headFront+.016,tip),
                 (x-w*.096,b.headFront+.016,tip+h*.025)]
        b.panel('Natural short forehead fringe '+str(j),outline,.045,
                ['hair','hairLight','hairDark'],b.head,relief=.006)
    for j in (-1,0,1):
        x=j*w*.275
        path=[(x,cy-w*.28,upper+.065),(x-w*.025,cy-w*.08,upper+.135),
              (x-w*.045,cy+w*.17,upper+.090),
              (x-w*.025,b.headFront+.015,upper-h*.072)]
        curved_hair_lock(b,'Natural low swept hair flow '+str(j),path,
                         [(w*.14,w*.040),(w*.15,w*.038),
                          (w*.16,w*.037),(w*.15,w*.030)],
                         ['hair','hairLight','hairDark'],b.head)
    # Broad overlapping rear/side sectors cover the scalp continuously. Thin
    # isolated vertical strips would leave an implausible bald back of head.
    angles=[58,91,125,160,195,230,269,302]
    for j,(first,last) in enumerate(zip(angles,angles[1:])):
        points=[]
        rear=j in (2,3,4)
        for angle,z in ((first,upper+.060),(last,upper+.060),
                        (last,b.facez-h*.095 if rear else b.facez+h*.13),
                        ((first+last)/2,b.facez-h*(.175+.020*(j%2)) if rear else b.facez+h*(.055+.020*(j%2))),
                        (first,b.facez-h*.075 if rear else b.facez+h*.15)):
            a=math.radians(angle)
            taper=1. if z>=upper else .965
            points.append((math.sin(a)*w*.535*taper,cy+math.cos(a)*w*.370*taper,z))
        b.panel('Natural broad temple nape hair '+str(j),points,.055,
                ['hair','hairLight','hairDark'],b.head,relief=.008)
    # Round tapered rear locks add an actual hair contour over the supporting
    # rear shell; the visible back must not read as hanging metal plates.
    for j in (-1,0,1):
        x=j*w*.305
        end_depth={-1:.130,0:.215,1:.105}[j]
        path=[(x,cy-w*.18,upper+.105),(x,cy-w*.39,upper+.018),
              (x*.97,cy-w*.42,b.facez+h*.075),
              (x*.88,cy-w*.385,b.facez-h*end_depth)]
        curved_hair_lock(b,'Natural tapered rear hair lock '+str(j),path,
                         [(w*.17,w*.036),(w*.18,w*.040),
                          (w*.175,w*.038),(w*.085,w*.018)],
                         ['hair','hairLight','hairDark'],b.head)
    for side in (-1,1):
        x=side*w*.47
        path=[(x,b.headFront-w*.075,upper+.018),
              (x*1.01,cy+w*.03,b.facez+h*.27),
              (x*.98,cy-w*.13,b.facez+h*(.135 if side<0 else .105))]
        curved_hair_lock(b,'Natural rounded temple hair '+str(side),path,
                         [(w*.095,w*.027),(w*.10,w*.034),(w*.073,w*.025)],
                         ['hair','hairLight','hairDark'],b.head)
    # Rank is visible in the material, tooth count, height and branch count.
    material=['copper','steelDark','steelDark','gold','gold','gold'][rank-1]
    tooth_material=['copper','goldLight','gold','gold','gold','gold'][rank-1]
    tooth_count=[1,3,3,5,5,7][rank-1]
    tooth_height=[.110,.160,.180,.190,.225,.270][rank-1]
    band_z=upper+(.035 if rank in (2,3) else .025);rx=w*.565;ry=w*.397
    band=crown_band(b,band_z,rx,ry,material)
    for j in range(tooth_count):
        angle=0 if tooth_count==1 else (j-(tooth_count-1)/2)*math.pi/(tooth_count+1)
        x=rx*.95*math.sin(angle);y=cy+ry*math.cos(angle)+.013
        height=tooth_height*(1-.22*abs(math.sin(angle)))
        lightning_panel(b,'Crown lightning tooth '+str(j),x-.025,y,band_z+.027,
                        height,.086 if rank==2 else .098 if rank==3 else .079 if rank==1 else .093,tooth_material,b.head,mirror=j%2==1)
    if rank>=3:
        b.jewel('Crown frontal focus',(0,cy+ry+.025,band_z+.031),
                .025 if rank<6 else .038,.028,.017,'ice' if rank<5 else 'goldLight',b.head)
    if rank>=4:
        for side in (-1,1):
            lightning_panel(b,'Crown side lightning '+str(side),side*rx*.88,
                            cy-.055,band_z+.020,tooth_height*.72,.065,material,b.head,
                            mirror=side<0)
    wp=b.joints['R'][3];x,y,z=b.joints['R'][6];front=y+.11
    held=lightning_panel(b,'Continuous flattened held lightning',x-.020,front,z+.012,
                        .53 if rank<5 else .63,.20 if rank<5 else .135,
                        ['gold','goldLight','goldDark'],wp)
    # Branches overlap the actual main stroke by a measured positive area.
    branch_count=0;branches=[]
    if rank>=5:
        for side in (-1,1):
            branch=lightning_panel(b,'Held lightning connected branch '+str(side),
                            x-.025,front+.005,z+.295,.32,.083,
                            ['gold','goldLight','goldDark'],wp,mirror=side<0,angle=side*34)
            branches.append(branch)
            branch_count+=1
    b.pivot('attack_muzzle',(x+.090,front+.030,z+.43),wp)
    crown={'tier':rank,'material':material,'toothMaterial':tooth_material,'frontLightningTeeth':tooth_count,
           'toothHeightM':tooth_height,'sideLightningTeeth':2 if rank>=4 else 0,
           'focusGem':rank>=3,'hairForm':'Low fitted natural scalp cap and short fringe/nape locks; no vertical hair arches',
           'heldBolt':'One closed flattened six-corner zigzag stroke',
           'heldBranchCount':branch_count,'userDesignOverride':True}
    b.root['lightningCrownDesign']=json.dumps(crown)
    b.root['stormHairDesign']='natural-fitted-hair-v3-user-override'
    b.cfg['stormV3DesignOverride']=crown
    b.stormDesign=crown
    face=next(o for o in b.objects if o.name=='Observed face')
    hand=next(o for o in b.objects if o.name=='Hand R')
    b.stormContactChecks=[{'joint':'hair_skull',**contact(hair,face)},
                         {'joint':'crown_hair',**contact(band,hair)},
                         {'joint':'bolt_hand',**contact(held,hand)}]
    b.stormContactChecks.extend({'joint':'continuous_lightning_branch',**contact(held,branch)} for branch in branches)
    assert all(v['passed'] for v in b.stormContactChecks),(b.id,b.stormContactChecks)


def engineer_source_nape_hair(b,rank):
    """Restore the orange rear hair visible in the III–V source views."""
    if rank not in (3,4,5):return
    face=next(o for o in b.objects if o.name=='Observed face')
    low,high=bounds(face);w=high.x-low.x;h=high.z-low.z
    locks=[]
    for j in range(-2,3):
        x=j*w*.18
        path=[(x,low.y+.005,high.z-.017),
              (x,low.y-.024,high.z-h*.22),
              (x*.97,low.y-.025,high.z-h*.52),
              (x*.94,low.y-.008,high.z-h*(.69+.035*(j%2)))]
        locks.append(curved_hair_lock(b,'Engineer source fitted orange nape lock '+str(j),path,
                         [(w*.115,.028),(w*.120,.031),(w*.115,.029),(w*.074,.018)],
                         ['beard','copper'],b.head))
    assert all(contact(lock,face)['passed'] for lock in locks),(b.id,'Orange rear hair must fit the actual skull')
    b.root['engineerNapeHairRevision']='source-orange-fitted-rear-locks-v3'


def audit_existing_native_roster(output_name='defender-head-axis-before.json'):
    mf=ROOT/'public/assets/geometric/geometric-defenders.json'
    data=json.loads(mf.read_text(encoding='utf8'));entries=[]
    for row in data['assets']:
        native=ROOT/row['nativeFile']
        bpy.ops.wm.open_mainfile(filepath=str(native))
        head=bpy.data.objects.get('head_pivot');torso=bpy.data.objects.get('torso_pivot')
        coll=next(c for c in bpy.data.collections if c.name.startswith('MODEL '))
        objects=[o for o in coll.all_objects if o.type=='MESH']
        check=head_axis_measurement(objects,head,torso)
        check.update({'id':row['id'],'family':row['family'],'tier':row['tier'],
                      'glbSha256':hashlib.sha256((ROOT/'public/assets/geometric'/row['file']).read_bytes()).hexdigest()})
        entries.append(check)
        print('HEAD_AXIS_AUDIT '+json.dumps(check),flush=True)
    out=ROOT/'output/design/geometric-game-v3';out.mkdir(parents=True,exist_ok=True)
    (out/output_name).write_text(json.dumps({'entries':entries},indent=2),encoding='utf8',newline='\n')


if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--audit-output',default='defender-head-axis-before.json')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    audit_existing_native_roster(args.audit_output)
