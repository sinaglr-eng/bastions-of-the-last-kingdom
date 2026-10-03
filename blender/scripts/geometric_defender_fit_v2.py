"""Defender-only fitted joint volumes; never changes shared game builders."""
import math
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def world_points(ob):
    return [ob.matrix_world @ v.co for v in ob.data.vertices]


def bounds(ob):
    pts = world_points(ob)
    return Vector(min(p[i] for p in pts) for i in range(3)), Vector(max(p[i] for p in pts) for i in range(3))


def inside_closed(point,tree):
    # Signed nearest-face distance is unsafe on an actual concave armour shell.
    votes=0
    for raw in ((1,.371,.217),(.193,1,.417),(.231,.119,1)):
        direction=Vector(raw).normalized();origin=point+direction*.000001;crossings=0
        for _ in range(32):
            hit,_,_,_=tree.ray_cast(origin,direction,4.)
            if hit is None:break
            crossings+=1;origin=hit+direction*.000003
        votes+=crossings%2
    return votes>=2


def contact(a, c):
    """Actual closed-solid surface overlap / containment, not object counts."""
    bpy.context.view_layer.update()
    ap, cp = world_points(a), world_points(c)
    at = BVHTree.FromPolygons(ap, [tuple(p.vertices) for p in a.data.polygons])
    ct = BVHTree.FromPolygons(cp, [tuple(p.vertices) for p in c.data.polygons])
    overlaps = len(at.overlap(ct))
    distances = []
    contained = 0
    for points, tree in ((ap, ct), (cp, at)):
        for p in points:
            q, normal, _, distance = tree.find_nearest(p)
            if q is None:
                continue
            distances.append(distance)
            contained += distance>.0001 and inside_closed(p,tree)
    minimum = min(distances, default=float('inf'))
    return {'parts': [a.name, c.name], 'surfaceIntersectionPairs': overlaps,
            'containedSamples': contained, 'nearestVertexToSurfaceM': minimum,
            'passed': overlaps > 0 or contained > 0 or minimum < .0005}


def cap_seat(face, caps, head):
    """Five real upper head rays in head-local space, beyond a touching brim."""
    bpy.context.view_layer.update()
    inverse=head.matrix_world.inverted()
    def tree(ob):
        points=[inverse@p for p in world_points(ob)]
        return points,BVHTree.FromPolygons(points,[tuple(p.vertices) for p in ob.data.polygons])
    fp,ft=tree(face);covers=[tree(c)[1] for c in caps]
    lo=Vector(min(p[i] for p in fp) for i in range(3));hi=Vector(max(p[i] for p in fp) for i in range(3))
    size=hi-lo;centre=(lo+hi)/2;samples=[]
    for dx,dy in ((0,0),(-.22,0),(.22,0),(0,-.22),(0,.22)):
        origin=Vector((centre.x+dx*size.x,centre.y+dy*size.y,hi.z+size.z))
        upper,_,_,_=ft.ray_cast(origin,Vector((0,0,-1)),size.z*3)
        if upper is None:continue
        gaps=[]
        for ct in covers:
            nearest,normal,_,distance=ct.find_nearest(upper)
            if nearest is not None and inside_closed(upper,ct):
                gaps.append(0.);continue
            hit,_,_,_=ct.ray_cast(upper+Vector((0,0,.0000001)),Vector((0,0,1)),1.)
            if hit is not None:gaps.append(max(0.,hit.z-upper.z))
        gap=min(gaps,default=None)
        samples.append({'upperHeadLocal':list(upper),'clearanceM':gap})
    maximum=max((s['clearanceM'] if s['clearanceM'] is not None else float('inf') for s in samples),default=float('inf'))
    return {'joint':'head_cap_seat','parts':[face.name]+[c.name for c in caps],
            'method':'Five head-local upper skin surface rays with independent closed-cap containment',
            'samples':samples,'maxClearanceM':maximum if math.isfinite(maximum) else None,
            'passed':len(samples)==5 and maximum<=.001}


def remove(b, *names):
    for ob in list(b.objects):
        if ob.name in names:
            b.objects.remove(ob)
            bpy.data.objects.remove(ob, do_unlink=True)


def fitted_boot(b, side, ankle, knee, foot, shin, width, top, material='leather', light='leatherLight'):
    """Calf-aligned shaft and articulated foot share an overlapping ankle."""
    x, y, z = ankle
    knee = Vector(knee)
    ankle = Vector(ankle)
    t = max(0., min(1., (top-z) / max(.001, knee.z-z)))
    cuff = ankle.lerp(knee, t)
    lower = b.loft('Boot '+side, [
        b.chamfer(x, y+.055, 0., width*.95, .31, .026),
        b.chamfer(x, y+.065, .045, width, .34, .035),
        b.chamfer(x, y+.035, z+.017, width*.87, .285, .024),
        b.chamfer(x, y, z+.047, width*.76, .210, .022)],
        [material, light], foot)
    upper = b.loft('Boot shaft '+side, [
        b.chamfer(x, y, z-.018, width*.77, .213, .020),
        b.chamfer(x, y, z+.045, width*.78, .218, .020),
        b.chamfer(cuff.x, cuff.y, top-.026, width*.86, .226, .022),
        b.chamfer(cuff.x, cuff.y, top, width*.84, .220, .021)],
        [material, light], shin)
    b.box('Boot cuff seam '+side, (cuff.x, cuff.y, top-.023),
          (width*.88, .230, .035), material, .009, shin)
    return lower, upper


def fitted_neck(b, face, torso_top, torso, head, material='cloth'):
    """A short tailored neck enters jaw and torso, including head tilt range."""
    low, high = bounds(face)
    width = high.x-low.x
    face_y = (low.y+high.y)/2
    # The head can be forward of the torso. Bridge that actual surface offset.
    bottom = torso_top-.050
    top = low.z+.045
    cy = min(.105, max(.025, face_y*.62))
    radius = width*.24
    # A hood aperture has a shallow face solid. Its neckline must enter that
    # actual jaw, rather than project through the opening as a separate block.
    jaw_depth = min(.135, (high.y-low.y)*.43)
    mid_depth = min(.150, max(jaw_depth, (high.y-low.y)*.65))
    neck = b.loft('Fitted neckline core', [
        b.ring(0, .020, bottom, radius*1.05, .130, 10),
        b.ring(0, cy, low.z-.025, radius, mid_depth, 10),
        b.ring(0, face_y, top, radius*.92, jaw_depth, 10)], material, head)
    collar = b.loft('Continuous tailored neckline', [
        b.ring(0, .015, torso_top-.025, radius*1.18, .165, 10),
        b.ring(0, cy, min(top-.015, torso_top+.045), radius*1.17, .168, 10)],
        [material, 'clothLight'] if material=='cloth' else material, torso)
    return neck, collar


def sculpt_facets(b):
    """Closed angular relief on cloth, metal and curved hair, source silhouette kept."""
    for ob in list(b.objects):
        if not ob.name.startswith(('Continuous tunic bodice', 'Flared ', 'Cape sector',
                                    'Tunic bodice', 'Tunic flared hem')):
            continue
        verts = [v.co.copy() for v in ob.data.vertices]
        faces, materials = [], []
        for polygon in ob.data.polygons:
            ids = list(polygon.vertices)
            if len(ids)!=4 or abs(polygon.normal.z)>.92:
                faces.append(tuple(ids));materials.append(polygon.material_index)
                continue
            center = sum((verts[i] for i in ids), Vector()) / len(ids)
            relief = .006 if 'bodice' in ob.name else .009
            center += polygon.normal * relief
            idx = len(verts);verts.append(center)
            for i in range(len(ids)):
                faces.append((ids[i], ids[(i+1)%len(ids)], idx))
                materials.append((polygon.material_index+i%2) % max(1, len(ob.data.materials)))
        mesh = bpy.data.meshes.new(ob.name+' fitted facets')
        mesh.from_pydata(verts, [], faces);mesh.update()
        for mat in ob.data.materials:
            mesh.materials.append(mat)
        for polygon, material in zip(mesh.polygons, materials):
            polygon.material_index = material
        ob.data = mesh


def bow_forward_plane(b, pivot, grip):
    """Rotate every actual bow component and semantic endpoint in one transform."""
    origin = Vector(grip)
    bpy.context.view_layer.update()
    descendants = [o for o in b.coll.objects if o!=pivot and any(p==pivot for p in parents(o))]
    for ob in descendants:
        if ob.type=='MESH':
            inverse = ob.matrix_world.inverted()
            for v in ob.data.vertices:
                p = ob.matrix_world @ v.co-origin
                v.co = inverse @ (origin+Vector((p.y, -p.x, p.z)))
            ob.data.update()
        elif ob.type=='EMPTY':
            p = ob.matrix_world.translation-origin
            world = ob.matrix_world.copy()
            world.translation = origin+Vector((p.y, -p.x, p.z))
            ob.matrix_world = world
    pivot['bowPlane'] = 'forward-vertical'
    b.root['bowPlane'] = 'forward-vertical'
    b.root['bowForwardNativeAxis'] = '+Y'


def parents(ob):
    current = ob.parent
    while current:
        yield current
        current = current.parent


def curved_hair_lock(b,name,points,radii,mat,parent):
    """A closed swept solid with a stable width axis at every curve segment."""
    points=[Vector(p) for p in points];path=[];widths=[]
    for i in range(len(points)-1):
        p0,p1,p2,p3=points[max(0,i-1)],points[i],points[i+1],points[min(len(points)-1,i+2)]
        for j in range(3):
            t=j/3;t2=t*t;t3=t2*t
            path.append((2*p1+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t2+(-p0+3*p1-3*p2+p3)*t3)*.5)
            widths.append(tuple(radii[i][k]*(1-t)+radii[i+1][k]*t for k in range(2)))
    path.append(points[-1]);widths.append(radii[-1]);rings=[]
    for i,(p,(rx,ry)) in enumerate(zip(path,widths)):
        tangent=(path[min(len(path)-1,i+1)]-path[max(0,i-1)]).normalized()
        normal=Vector((0,-tangent.z,tangent.y)).normalized()
        rings.append([tuple(p+Vector((rx*math.cos(j*math.tau/8),0,0))+normal*(ry*math.sin(j*math.tau/8))) for j in range(8)])
    return b.loft(name,rings,mat,parent)


def storm_hair_and_focus(b, rank):
    """Source-shaped swept silver strands with a fitted forehead and real bolt."""
    w, h, upper = b.facew, b.faceh, b.facez+b.faceh/2
    cy = .16
    # A filled scalp underneath the swept strands prevents an empty hair arch.
    b.loft('Fitted silver crown core',[
        b.ring(0,cy,upper-.014,w*.53,w*.39,12),
        b.ring(0,cy-.022,upper+.055,w*.52,w*.38,12),
        b.ring(.018,cy-.018,upper+.13,w*.42,w*.33,12),
        b.ring(.025,cy-.006,upper+.19,w*.24,w*.22,12)],
        ['hair','hairLight','hairDark'],b.head)
    # The swept strands form full quiffs, not hollow arches above a low skull.
    # This curved closed underlayer follows their underside and is hidden by
    # their relief faces; exact profile cameras must never see air underneath.
    profile=[(b.headFront+.015,upper-.018),
             (b.headFront+.012,upper+.060),
             (cy-w*.015,1.80-w*.075),
             (cy-w*.29,1.765-w*.08),
             (cy-w*.47,upper+.050),
             (cy-w*.39,upper-.020)]
    vertices=[(sign*w*.365,y,z) for sign in (-1,1) for y,z in profile]
    count=len(profile);faces=[tuple(reversed(range(count))),tuple(range(count,count*2))]
    faces.extend((j,(j+1)%count,count+(j+1)%count,count+j) for j in range(count))
    b.mesh('Closed curved silver quiff underlayer',vertices,faces,['hair','hairLight'],b.head)
    # Closed rear/temple sectors hug the head; no cylindrical helmet block.
    angles = [55, 90, 130, 165, 195, 230, 270, 305]
    rings = []
    for z, rx, ry in [(b.facez-h*.43,w*.33,w*.27),
                       (upper+.02,w*.55,w*.39),
                       (upper+.13,w*.43,w*.33)]:
        rings.append([(math.sin(math.radians(a))*rx,cy+math.cos(math.radians(a))*ry,z) for a in angles])
    for j in range(len(angles)-1):
        for k in range(2):
            b.panel('Fitted silver scalp sector '+str(j)+' '+str(k),
                    [rings[k][j],rings[k][j+1],rings[k+1][j+1],rings[k+1][j]],
                    .065,['hair','hairLight','hairDark'],b.head,relief=.010)
    rise = max(.20,1.80-upper)
    for j in (-1,0,1):
        x=j*w*.27
        height=1.80-(.065 if j==-1 else .10 if j==1 else 0)
        frontz=upper+(.070 if rank>=2 else .005)+j*.032
        path=[(x*.72,cy-w*.35,b.facez-h*.34),
              (x+w*.015,cy-w*.49,upper+.045),
              (x+w*.018,cy-w*.30,height-.032),
              (x-w*.030,cy-w*.015,height),
              (x-w*.07,b.headFront+.016,frontz)]
        curved_hair_lock(b,'Curved silver crown lock '+str(j),path,
               [(w*.115,w*.075),(w*.185,w*.125),(w*.19,w*.115),
                (w*.18,w*.11),(w*.185,w*.073)],
               ['hair','hairLight','hairDark'],b.head)
    for side in (-1,1):
        for j in range(3):
            z=upper+.030-j*h*.18
            outline=[(side*w*.47,b.headFront-.025,z+.030),
                     (side*w*.57,cy-w*.08,z+.13),
                     (side*w*.58,cy-w*(.56+j*.08),z+.115),
                     (side*w*.52,cy-w*(.60+j*.09),z-.070),
                     (side*w*.46,b.headFront-.045,z-.115)]
            b.panel('Swept temple silver lock '+str(side)+' '+str(j),outline,
                    .098,['hair','hairLight','hairDark'],b.head,relief=.023)
    if rank>=2:
        lower=upper-.025
        circlet_mat='gold' if rank>=4 else ('circletGreen' if rank==3 else 'cloth')
        circlet_front=cy+w*.37;circlet_rear=cy-w*.65
        circlet_cy=(circlet_front+circlet_rear)/2;circlet_ry=(circlet_front-circlet_rear)/2
        b.loft('Fitted forehead circlet',[
            b.ring(0,circlet_cy,lower,w*.56,circlet_ry,12),
            b.ring(0,circlet_cy,lower+.078,w*.56,circlet_ry,12)],
            circlet_mat,b.head)
        front=b.headFront+.028
        for j in range(5):
            x=(j-2)*w*.195
            b.box('Forehead circlet segment '+str(j),(x,front,lower+.039),
                  (w*.197,.041,.078),'gold' if j==2 else circlet_mat,.008,b.head)
        if rank<5:
            for z in (lower+.003,lower+.075):
                b.box('Circlet gold contour edge '+str(z),(0,front+.006,z),
                      (w*.99,.021,.011),'gold',.004,b.head)
    wp=b.joints['R'][3];x,y,z=b.joints['R'][6];front=y+.092
    if rank<5:
        uv=[(0,.035),(.13,.18),(.068,.248),(.18,.325),
            (.155,.36),(.23,.63),(.047,.415),(.095,.302),
            (-.014,.240),(.048,.155)]
        b.panel('Solid faceted lightning blade',[(x+u,front,z+v) for u,v in uv],
                .065,['gold','goldLight','goldDark'],wp,relief=.027)
        b.pivot('attack_muzzle',(x+.155,front+.030,z+.48),wp)
    else:
        base=(x+.035,front,z+.05)
        b.rod('Central lightning stem',base,(x+.075,front,z+.40),.024,'gold',wp,6)
        b.jewel('Central lightning diamond',(x+.075,front,z+.55),.071,.195,.045,
                ['gold','goldLight','goldDark'],wp)
        for side in (-1,1):
            uv=[(0,.050),(side*.16,.23),(side*.098,.31),
                (side*.235,.53),(side*.135,.435),(side*.15,.365),
                (side*.066,.285),(side*.106,.225)]
            b.panel('Solid side lightning blade '+str(side),
                    [(x+.04+u,front,z+v) for u,v in uv],.062,
                    ['gold','goldLight','goldDark'],wp,relief=.025)
        b.pivot('attack_muzzle',(x+.075,front+.04,z+.55),wp)
    b.cfg['stormConstruction']='Closed fitted temple/scalp sectors plus nine curved swept strands; fitted forehead segments; real broad lightning polygons'


def joint_ball(b, name, center, radius, material, parent):
    rings=[]
    for fraction in (-.96,-.65,0,.65,.96):
        rr=radius*math.sqrt(1-fraction*fraction)
        rings.append(b.ring(center[0],center[1],center[2]+radius*fraction,rr,rr,8))
    return b.loft(name,rings,material,parent)


def fitted_arm_joints(b):
    for side in ('R','L'):
        up,lo,wrist,_,sh,el,ha=b.joints[side]
        radius=b.bodyw*.195
        joint_ball(b,'Integrated elbow lining '+side,el,radius*.94,'cloth',lo)
        joint_ball(b,'Integrated wrist lining '+side,ha,radius*.83,'skin',wrist)


def soldier_fit(b, rank):
    """Retain source equipment but fit anatomy to the actual authored joints."""
    from geometric_game_common import Builder,linear
    # Reuse the imported historical materials and collection, never its files.
    original=b
    b=Builder.__new__(Builder)
    for key in ('id','root','coll','objects','coverage'):
        setattr(b,key,getattr(original,key))
    b.M={}
    aliases={'cloth':'Cloth','clothLight':'Cloth light','skin':'Skin',
             'leather':'Leather','leatherLight':'Leather light','steel':'Steel',
             'steelLight':'Steel light','steelDark':'Steel dark','recess':'Recess'}
    for key,name in aliases.items():
        material=next((m for m in bpy.data.materials if m.name.split('.')[0]==name),None)
        if not material:
            fallback={'cloth':['355D92','3C6938','843F6B','EDE0C6','D49638','F9E3BA'][rank-1],
                      'clothLight':'F9E5BD','skin':'F4CAA0','leather':'715039',
                      'leatherLight':'866246','steel':'8A8990','steelLight':'A3A2A9',
                      'steelDark':'64656A','recess':'332A20'}[key]
            rgba=tuple(linear(int(fallback[i:i+2],16)/255) for i in (0,2,4))+(1,)
            material=bpy.data.materials.new(name);material.use_nodes=True;material.diffuse_color=rgba
            shader=material.node_tree.nodes.get('Principled BSDF')
            shader.inputs['Base Color'].default_value=rgba
            shader.inputs['Roughness'].default_value=.64
            shader.inputs['Metallic'].default_value=.25 if key.startswith('steel') else 0
        b.M[key]=material
    b.torso=next(o for o in b.coll.objects if o.name=='torso_pivot')
    b.head=next(o for o in b.coll.objects if o.name=='head_pivot')
    b.cfg={'revision':'Defender surface fitting v2','historicalTopologyPreserved':False}
    body=next(o for o in b.objects if o.name=='Tunic bodice')
    bodylo,bodyhi=bounds(body);top=bodyhi.z;b.bodyw=bodyhi.x-bodylo.x
    b.joints={}
    for side,sign in (('R',1),('L',-1)):
        upper=next(o for o in b.objects if o.name=='Sleeve_'+side+' upper')
        points=world_points(upper);n=len(points)//2
        sh=sum(points[:n],Vector())/n;el=sum(points[n:],Vector())/n
        up=next(o for o in b.coll.objects if o.name=='upper_arm_'+side)
        lo=next(o for o in b.coll.objects if o.name=='forearm_'+side)
        wrist=next(o for o in b.coll.objects if o.name=='hand_'+side)
        wp=next(o for o in b.coll.objects if o.name=='weapon_'+side)
        # Reposition a pivot without moving the rest-pose sculpture it carries.
        for node,pos in ((up,sh),(lo,el)):
            children={o:o.matrix_world.copy() for o in node.children}
            mat=node.matrix_world.copy();mat.translation=pos;node.matrix_world=mat
            bpy.context.view_layer.update()
            for child,matrix in children.items():child.matrix_world=matrix
        ha=wrist.matrix_world.translation.copy()
        b.joints[side]=(up,lo,wrist,wp,sh,el,ha)
        leg=next(o for o in b.coll.objects if o.name=='upper_leg_'+side)
        shin=next(o for o in b.coll.objects if o.name=='shin_'+side)
        foot=next(o for o in b.coll.objects if o.name=='foot_'+side)
        old=next(o for o in b.objects if o.name=='Boot_'+side)
        oldlo,oldhi=bounds(old);x=(oldlo.x+oldhi.x)/2
        ankle=Vector((x,0,.11));knee=Vector((x*.96,0,.27))
        for node,pos in ((shin,knee),(foot,ankle)):
            children={o:o.matrix_world.copy() for o in node.children}
            mat=node.matrix_world.copy();mat.translation=pos;node.matrix_world=mat
            bpy.context.view_layer.update()
            for child,matrix in children.items():child.matrix_world=matrix
        hip=leg.matrix_world.translation.copy()
        remove(b,'Boot_'+side,'Trouser_'+side)
        b.limb('Trouser upper '+side,[hip,knee],[.136,.126],
               'leather' if rank==6 else 'cloth',leg)
        b.limb('Trouser shin '+side,[knee,ankle],[.126,.113],
               'leather' if rank==6 else 'cloth',shin)
        fitted_boot(b,side,ankle,knee,foot,shin,oldhi.x-oldlo.x,
                    max(.19,oldhi.z),'steel' if rank==6 else 'leather',
                    'steelLight' if rank==6 else 'leatherLight')
    remove(b,'Neck')
    face=next((o for o in b.objects if o.name=='Face'),None)
    if face:
        fitted_neck(b,face,top,b.torso,b.head)
    else:
        helmets=[o for o in b.objects if o.name.startswith('Helmet')]
        low=min(bounds(o)[0].z for o in helmets)
        b.loft('Articulated steel gorget',[
            b.ring(0,.025,top-.035,.175,.150,10),
            b.ring(0,.035,low-.008,.19,.165,10),
            b.ring(0,.035,low+.055,.37,.335,10)],
            ['steel','steelLight'],b.head)
        b.loft('Steel collar lining',[
            b.ring(0,.025,top-.055,.19,.170,10),
            b.ring(0,.035,top+.05,.195,.175,10)],'steel',b.torso)
    fitted_arm_joints(b)
    # Wrap the rear skirt into a helmet curve rather than a flat metal cube.
    for ob in b.objects:
        if not ob.name.startswith('Helmet'):
            continue
        lo,hi=bounds(ob);half=max(abs(lo.x),abs(hi.x))
        if hi.y-lo.y<.08 or 'ridge' in ob.name.lower():
            continue
        inverse=ob.matrix_world.inverted()
        for v in ob.data.vertices:
            p=ob.matrix_world@v.co
            if p.y<.035:
                p.y+=.042*min(1,(abs(p.x)/max(.01,half))**1.7)
                v.co=inverse@p
        ob.data.update()
    if rank==1:
        shaft=next(o for o in b.objects if o.name=='Spear wooden shaft')
        low,_=bounds(shaft)
        if low.z<0:
            inverse=shaft.matrix_world.inverted()
            for vertex in shaft.data.vertices:
                p=shaft.matrix_world@vertex.co
                if p.z<.15:p.z+=(-low.z)*(.15-p.z)/(.15-low.z)
                vertex.co=inverse@p
            shaft.data.update()
    b.root['jointFitRevision']='surface-fit-v2'
    return b


def rest_contact_checks(b):
    by={o.name:o for o in b.objects}
    result=[]
    for side in ('R','L'):
        boot=by.get('Boot '+side);shaft=by.get('Boot shaft '+side)
        shin=by.get('Trouser shin '+side)
        if boot and shaft:result.append({'joint':'ankle_'+side,**contact(boot,shaft)})
        if shaft and shin:result.append({'joint':'calf_'+side,**contact(shaft,shin)})
    face=by.get('Observed face') or by.get('Face')
    core=by.get('Fitted neckline core');collar=by.get('Continuous tailored neckline')
    torso=by.get('Continuous tunic bodice') or by.get('Tunic bodice')
    if face and core:result.append({'joint':'jaw_neck',**contact(face,core)})
    if core and collar:result.append({'joint':'neck_collar',**contact(core,collar)})
    if collar and torso:result.append({'joint':'collar_torso',**contact(collar,torso)})
    if face:
        for name in ('Pointed tilted hat brim','Faceted work cap','Fitted work cap band',
                     'Fitted mitre foundation'):
            if name in by:result.append({'joint':'head_cap',**contact(face,by[name])})
        caps=[by[name] for name in ('Pointed tilted hat brim','Tall faceted hat','Faceted work cap',
                                    'Fitted work cap band','Fitted mitre foundation') if name in by]
        if caps:result.append(cap_seat(face,caps,b.head))
    gorget=by.get('Articulated steel gorget');lining=by.get('Steel collar lining')
    if gorget and lining:result.append({'joint':'gorget_collar',**contact(gorget,lining)})
    if lining and torso:result.append({'joint':'collar_torso',**contact(lining,torso)})
    if gorget:
        shells=[o for o in b.objects if o.name.startswith('Helmet') and 'ventilation' not in o.name]
        if shells:
            tests=[contact(gorget,o) for o in shells]
            best=max(tests,key=lambda t:(t['passed'],t['surfaceIntersectionPairs'],t['containedSamples'],-t['nearestVertexToSurfaceM']))
            result.append({'joint':'helmet_gorget',**best})
    return result
