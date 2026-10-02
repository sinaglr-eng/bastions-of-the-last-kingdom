"""Native v8 creature champions. Designed surfaces, not an assembly of spheres.

The low level loft/tube/skin helpers are also available to the separate boss
author. +Y faces forward. A true deform skeleton and sampled Idle/Attack actions
are exported; attack_muzzle is attached to the actual moving jaw/weapon bone.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from author_archer import custom, mat, cube
import cohesive

FAMILIES={'embercrown','worldfire','starfall','thunderheart','phoenix','rangermentor','griffinbomber'}
RIG=None
PARTS=[]
TAU=math.tau

def material(name,color,rough=.5,metal=0,glow=0):
    m=mat('V8 '+name,color,metal,glow);shader=m.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value=rough
    # Actual packed UV roughness, unlike a render-only procedural shader.
    image=bpy.data.images.new('V8 '+name+' crafted roughness',128,128,alpha=False)
    image.colorspace_settings.name='Non-Color'
    values=[]
    for y in range(128):
        for x in range(128):
            r=max(.05,min(.98,rough+.045*math.sin(x*1.71+y*2.01)+.025*math.sin(x*.16)*math.cos(y*.19)))
            values.extend((r,r,r,1))
    image.pixels.foreach_set(values);image.pack()
    tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
    m.node_tree.links.new(tex.outputs['Color'],shader.inputs['Roughness'])
    return m

def palette(family):
    hide,light,accent={
        'embercrown':('ae3b22','e39e55','f4b44f'),
        'worldfire':('672631','be7954','ff9553'),
        'thunderheart':('315e72','adc5b7','91e8fa'),
        'phoenix':('462b63','b19583','a2df7d'),
        'starfall':('254364','b6d4e2','8be5fb'),
        'rangermentor':('604326','a18a58','9aca69'),
        'griffinbomber':('986840','ede5c7','e6bb69')
    }[family]
    return dict(hide=material(family+' sculpted hide',hide,.65),light=material(family+' underside',light,.68),
        dark=material(family+' recessed seams','17282b',.72),ivory=material(family+' teeth claws','e7ddbd',.48),
        gold=material(family+' engraved bronze','c4a25f',.3,.73),steel=material(family+' tempered silver','aabac0',.32,.78),
        leather=material(family+' saddle leather','493225',.76),cloth=material(family+' layered textile','423d63' if family=='phoenix' else '2e5960',.67),
        skin=material(family+' warm skin','d9af89',.57),glow=material(family+' luminous focus',accent,.23,.1,1.0),
        stone=material(family+' carved basalt','818b79',.82),membrane=material(family+' wing membrane','9b5042' if family in ('embercrown','worldfire') else '577b85',.67))

def reset():
    global PARTS,RIG
    PARTS=[];RIG=None
    for action in list(bpy.data.actions):bpy.data.actions.remove(action)

def rig(specs,name):
    global RIG
    data=bpy.data.armatures.new(name+' anatomical skeleton');RIG=bpy.data.objects.new(name+'_Rig',data)
    bpy.context.collection.objects.link(RIG);bpy.context.view_layer.objects.active=RIG;RIG.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for n,start,end,parent in specs:
        b=data.edit_bones.new(n);b.head=start;b.tail=end
        if parent:b.parent=data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT');RIG.select_set(False)
    RIG['articulationRevision']=3;RIG['modelRevision']='v8';RIG['attackReleaseFraction']=.36
    return RIG

def skin(o,weights='root'):
    o.vertex_groups.clear()
    rows=[weights(o.matrix_world@v.co) if callable(weights) else {weights:1} for v in o.data.vertices]
    for name in set(k for row in rows for k in row):
        group=o.vertex_groups.new(name=name)
        for i,row in enumerate(rows):
            if row.get(name,0)>0:group.add([i],row[name],'REPLACE')
    for m in list(o.modifiers):
        if m.type=='ARMATURE':o.modifiers.remove(m)
    modifier=o.modifiers.new('Actual deform bones','ARMATURE');modifier.object=RIG;o.parent=RIG
    if not o.data.uv_layers:
        uv=o.data.uv_layers.new(name='Crafted UV')
        for face in o.data.polygons:
            for j in face.loop_indices:
                v=o.data.vertices[o.data.loops[j].vertex_index].co
                uv.data[j].uv=(v.x*.43+v.y*.37,v.z*.51)
    if o not in PARTS:PARTS.append(o)
    return o

def mesh(name,v,f,m,bone='root',smooth=True):
    o=custom(name,v,f,m)
    for p in o.data.polygons:p.use_smooth=smooth
    return skin(o,bone)

def hermite(rows,t):
    n=len(rows)-1;i=min(n-1,int(t*n));u=t*n-i
    a,b=rows[i],rows[i+1];before,after=rows[max(0,i-1)],rows[min(n,i+2)]
    return tuple((2*u**3-3*u*u+1)*a[k]+(u**3-2*u*u+u)*(b[k]-before[k])*.5+(-2*u**3+3*u*u)*b[k]+(u**3-u*u)*(after[k]-a[k])*.5 for k in range(len(a)))

def sweep(name,points,widths,depths,m,bone='root',sides=24,steps=6,detail=0):
    v=[];last=None;n=(len(points)-1)*steps
    for j in range(n+1):
        t=j/n;p=Vector(hermite(points,t));w=hermite([(r,) for r in widths],t)[0];d=hermite([(r,) for r in depths],t)[0]
        direction=Vector(hermite(points,min(1,t+.002)))-Vector(hermite(points,max(0,t-.002)));direction.normalize()
        normal=last-direction*last.dot(direction) if last is not None else direction.cross(Vector((0,1,0)))
        if normal.length<.001:normal=direction.cross(Vector((1,0,0)))
        normal.normalize();binormal=direction.cross(normal).normalized();last=normal.copy()
        for i in range(sides):
            a=TAU*i/sides;r=1+detail*math.sin(i*2.07+j*.57)
            v.append(tuple(p+r*(normal*math.cos(a)*w+binormal*math.sin(a)*d)))
    f=[(j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i) for j in range(n) for i in range(sides)]
    f.extend([tuple(reversed(range(sides))),tuple(n*sides+i for i in range(sides))])
    return mesh(name,v,f,m,bone)

def tube(name,points,radii,m,bone='root',sides=10,steps=4):return sweep(name,points,radii,radii,m,bone,sides,steps)

def shell(name,centre,radii,m,bone='root',n=24,rows=16,warp=None):
    v=[]
    for j in range(rows+1):
        latitude=math.pi*j/rows
        for i in range(n):
            a=TAU*i/n;p=Vector((radii[0]*math.sin(latitude)*math.cos(a),radii[1]*math.sin(latitude)*math.sin(a),radii[2]*math.cos(latitude)))+Vector(centre)
            if warp:p=Vector(warp(p,a,latitude))
            v.append(tuple(p))
    f=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(rows) for i in range(n)]
    return mesh(name,v,f,m,bone)

def sculpt_union(parts,name,m,budget=13000,voxel=.013,weights='root'):
    PARTS[:]=[o for o in PARTS if o not in parts]
    for o in parts:
        for mod in list(o.modifiers):
            if mod.type=='ARMATURE':o.modifiers.remove(mod)
        o.parent=None
    result=cohesive.fuse(parts,name,voxel,budget,m)
    return skin(result,weights)

def marker(name,point,bone):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o)
    o.parent=RIG;o.parent_type='BONE';o.parent_bone=bone;bpy.context.view_layer.update();o.matrix_world=Matrix.Translation(Vector(point))
    o['socketBone']=bone;o['effectReleaseFraction']=.36;return o

def ring(name,centre,radius,thickness,m,bone='root',axis='Z',n=32):
    c=Vector(centre);path=[]
    for i in range(n+2):
        a=TAU*(i%n)/n
        delta=(math.cos(a)*radius,math.sin(a)*radius,0) if axis=='Z' else ((0,math.cos(a)*radius,math.sin(a)*radius) if axis=='X' else (math.cos(a)*radius,0,math.sin(a)*radius))
        path.append(tuple(c+Vector(delta)))
    return tube(name,path,[thickness]*len(path),m,bone,6,1)

def plate(name,profile,m,bone='root',thickness=.016):
    o=mesh(name,profile,[tuple(range(len(profile)))],m,bone)
    modifier=o.modifiers.new('Credible shell thickness','SOLIDIFY');modifier.thickness=thickness
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=modifier.name)
    modifier=o.modifiers.new('Crafted plate edges','BEVEL');modifier.width=thickness*.45;modifier.segments=2
    bpy.ops.object.modifier_apply(modifier=modifier.name);return o

def footing(p,r=.48):
    for name,z,rx,rz,m in [('Basalt beveled pedestal',.06,r,.06,p['dark']),('Carved stone pedestal top',.13,r*.95,.032,p['stone'])]:
        sweep(name,[(0,0,z-rz),(0,0,z-rz*.7),(0,0,z+rz*.7),(0,0,z+rz)],[rx*.94,rx,rx,rx*.91],[rx*.94,rx,rx,rx*.91],m,sides=12,steps=1)
    ring('Fine engraved pedestal bronze inlay',(0,0,.168),r*.80,.006,p['gold'],n=40)

def animate(poses,idle=None):
    scene=bpy.context.scene;scene.render.fps=50;RIG.animation_data_create()
    def create(name,keys,frames):
        action=bpy.data.actions.new(name);RIG.animation_data.action=action
        for frame,pose in keys:
            for b in RIG.pose.bones:
                value=pose.get(b.name,(0,0,0))
                b.rotation_mode='XYZ';b.rotation_euler=value.get('rotation',(0,0,0)) if isinstance(value,dict) else value
                b.location=value.get('location',(0,0,0)) if isinstance(value,dict) else (0,0,0)
                b.scale=value.get('scale',(1,1,1)) if isinstance(value,dict) else (1,1,1)
                b.keyframe_insert('rotation_euler',frame=frame,group=b.name)
                b.keyframe_insert('location',frame=frame,group=b.name);b.keyframe_insert('scale',frame=frame,group=b.name)
        action['effectReleaseFraction']=.36 if name=='Attack' else 0
        curves=[]
        for layer in action.layers:
            for strip in layer.strips:
                for channelbag in strip.channelbags:curves.extend(channelbag.fcurves)
        for curve in curves:
            for key in curve.keyframe_points:
                # A launched payload disappears at release, never shrinks in flight.
                if curve.data_path.endswith('.scale'):key.interpolation='CONSTANT'
        track=RIG.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,0,action);strip.action_frame_start=0;strip.action_frame_end=frames;track.mute=True
        return action
    idle=create('Idle',idle or [(0,{}),(30,{}),(60,{}),(90,{}),(120,{})],120)
    create('Attack',[(0,{}),*poses,(50,{})],50)
    RIG.animation_data.action=idle;scene.frame_set(0)

def distance_weights(specs,names):
    segments={n:(Vector(a),Vector(b)) for n,a,b,parent in specs if n in names}
    def weights(p):
        nearest=[]
        for n,(a,b) in segments.items():
            d=b-a;t=max(0,min(1,(p-a).dot(d)/max(.0001,d.length_squared)))
            nearest.append(((p-a-t*d).length,n))
        nearest.sort();first,second=nearest[:2]
        if second[0]>first[0]*1.8+.06:return {first[1]:1}
        a=1/(first[0]+.03)**4;b=1/(second[0]+.03)**4
        return {first[1]:a/(a+b),second[1]:b/(a+b)}
    return weights

def dragon_specs(mounted=False):
    specs=[('root',(0,0,.17),(0,0,.65),None),('spine',(0,-.38,.63),(0,.23,.82),'root'),
        ('neck',(0,.22,.84),(0,.46,1.14),'spine'),('head',(0,.46,1.14),(0,.90,1.35),'neck'),
        ('jaw',(0,.50,1.20),(0,1.04,1.20),'head'),('tail',(0,-.45,.63),(0,-.89,.68),'spine'),('tail_tip',(0,-.89,.68),(.21,-1.13,.77),'tail')]
    for s,side in [(-1,'L'),(1,'R')]:
        for y,leg in [(-.32,'hind'),(.20,'front')]:
            specs += [(leg+'_upper_'+side,(s*.21,y,.65),(s*.27,y-.07,.40),'spine'),(leg+'_lower_'+side,(s*.27,y-.07,.40),(s*.29,y+.07,.24),leg+'_upper_'+side),(leg+'_paw_'+side,(s*.29,y+.07,.24),(s*.29,y+.26,.23),leg+'_lower_'+side)]
        specs += [('wing_upper_'+side,(s*.21,-.05,.88),(s*.60,-.07,1.26),'spine'),('wing_wrist_'+side,(s*.60,-.07,1.26),(s*.82,-.10,1.46),'wing_upper_'+side)]
        for i,(x,y,z) in enumerate([(1.23,-.15,1.27),(1.13,-.26,.88),(.72,-.39,.72)]):
            specs.append(('wing_finger_'+side+'_'+str(i),(s*.82,-.10,1.46),(s*x,y,z),'wing_wrist_'+side))
    if mounted:specs+=rider_specs((0,-.24,.92))
    return specs

def dragon_wings(p,span=1):
    """Skin and membrane share deforming wrist/finger groups, including scallops."""
    for s,side in [(-1,'L'),(1,'R')]:
        upper='wing_upper_'+side;wristbone='wing_wrist_'+side
        root=Vector((s*.21,-.05,.88));elbow=Vector((s*.60,-.07,1.26));wrist=Vector((s*.82,-.10,1.46))
        tube('Dragon wing connected muscular humerus '+side,[root,(s*.41,-.055,1.15),elbow],[.072,.051,.041],p['hide'],upper,16,5)
        tube('Dragon wing radioulnar tendon '+side,[elbow,(s*.70,-.085,1.38),wrist],[.042,.030,.027],p['hide'],wristbone,14,5)
        tips=[Vector((s*1.23,-.15,1.27)),Vector((s*1.13,-.26,.88)),Vector((s*.72,-.39,.72))]
        tipbones=['wing_finger_'+side+'_'+str(i) for i in range(3)]
        for i,tip in enumerate(tips):
            tube('Long articulated wing metacarpal '+side+str(i),[wrist,wrist.lerp(tip,.48)+Vector((0,.016,.025)),tip],[.021,.012,.005],p['ivory'],tipbones[i],10,5)
        tube('Opposed dragon wing thumb claw '+side,[wrist,wrist+Vector((s*.047,.035,.105)),wrist+Vector((s*.04,.10,.075))],[.019,.014,.001],p['ivory'],wristbone,10,6)
        borders=[root,elbow,wrist,*tips,Vector((s*.23,-.23,.75))]
        # Radial patches from wrist to anatomically scalloped trailing edge.
        for i in range(3):
            a=tips[i];b=tips[i+1] if i<2 else borders[-1];verts=[];weights=[];rows=12;cols=12
            for r in range(rows+1):
                u=r/rows
                for c in range(cols+1):
                    t=c/cols;edge=a.lerp(b,t)+Vector((0,.028*math.sin(math.pi*t),.065*math.sin(math.pi*t)))
                    point=wrist.lerp(edge,u)+Vector((0,.028*math.sin(math.pi*u)*math.sin(math.pi*t),0));verts.append(tuple(point))
                    n1=tipbones[i];n2=tipbones[i+1] if i<2 else upper
                    weights.append({wristbone:1-u,n1:u*(1-t),n2:u*t})
            faces=[(r*(cols+1)+c,r*(cols+1)+c+1,(r+1)*(cols+1)+c+1,(r+1)*(cols+1)+c) for r in range(rows) for c in range(cols)]
            o=custom('Anatomical tensioned dragon wing membrane '+side+str(i),verts,faces,p['membrane'])
            for f in o.data.polygons:f.use_smooth=True
            for n in {k for row in weights for k in row}:
                group=o.vertex_groups.new(name=n)
                for j,row in enumerate(weights):
                    if row.get(n,0)>0:group.add([j],row[n],'REPLACE')
            modifier=o.modifiers.new('Membrane skin','ARMATURE');modifier.object=RIG;o.parent=RIG;PARTS.append(o)
            modifier=o.modifiers.new('Living membrane thickness','SOLIDIFY');modifier.thickness=.005
            bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=modifier.name)
            for j in range(1,4):
                t=j/4;edge=a.lerp(b,t)+Vector((0,.028*math.sin(math.pi*t),.065*math.sin(math.pi*t)))
                tube('Wing subtle web vein '+side+str(i)+str(j),[wrist,wrist.lerp(edge,.5)+Vector((0,.022,0)),edge],[.003,.0023,.0011],p['light'],tipbones[i],5,3)

def dragon_anatomy(p,specs,mounted=False,family='worldfire'):
    weight=distance_weights(specs,{'spine','neck','head','tail','tail_tip'}|{n for n,a,b,parent in specs if n.startswith(('front_','hind_'))})
    body=[sweep('Dragon newly shaped connected flank',[(0,-.59,.55),(0,-.38,.65),(0,-.10,.69),(0,.15,.75),(0,.31,.83)],[.03,.27,.31,.28,.17],[.035,.21,.25,.29,.12],p['hide'],sides=32,steps=8,detail=.018),
        sweep('Dragon curved muscular neck',[(0,.17,.78),(0,.31,.96),(0,.39,1.15),(0,.54,1.25)],[.19,.15,.115,.10],[.18,.16,.13,.10],p['hide'],sides=28,steps=8),
        sweep('Dragon purposeful long predatory skull',[(0,.38,1.26),(0,.52,1.34),(0,.73,1.31),(0,.94,1.28),(0,1.05,1.245)],[.045,.14,.125,.083,.057],[.05,.11,.091,.063,.035],p['hide'],sides=28,steps=7),
        tube('Dragon integrated coiled muscular tail',[(0,-.44,.65),(0,-.76,.60),(.10,-.96,.68),(.27,-1.03,.84),(.37,-.94,.99)],[.13,.10,.067,.036,.006],p['hide'],sides=18,steps=7)]
    for s,side in [(-1,'L'),(1,'R')]:
        for y,leg in [(-.32,'hind'),(.20,'front')]:
            body.append(sweep('Dragon muscular '+leg+' limb '+side,[(s*.19,y,.64),(s*.27,y-.075,.46),(s*.28,y-.04,.31),(s*.29,y+.10,.24)],[.13,.09,.055,.054],[.13,.08,.06,.064],p['hide'],sides=18,steps=6))
            body.append(sweep('Dragon broad metatarsal paw '+side+leg,[(s*.29,y,.25),(s*.29,y+.11,.25),(s*.29,y+.22,.23)],[.045,.091,.067],[.04,.053,.02],p['hide'],sides=18,steps=5))
    skinbody=sculpt_union(body,'V8 continuous retopologized dragon skin',p['hide'],8500 if mounted else 15000,.014,weight)
    surface=BVHTree.FromPolygons([skinbody.matrix_world@v.co for v in skinbody.data.vertices],[list(poly.vertices) for poly in skinbody.data.polygons])
    def frontpoint(x,z):
        position,normal,index,distance=surface.ray_cast(Vector((x,3,z)),Vector((0,-1,0)))
        return (x,position.y+.005,z) if position is not None else (x,.35,z)
    jaw=sweep('Dragon single shaped hinged lower jaw',[(0,.48,1.18),(0,.70,1.17),(0,.93,1.18),(0,1.045,1.20)],[.045,.10,.067,.04],[.031,.038,.030,.012],p['hide'],'jaw',24,6)
    mouth=plate('Dragon recessed oral cavity',[(-.10,.62,1.211),(.10,.62,1.211),(.051,1.025,1.208),(-.051,1.025,1.208)],p['dark'],'jaw',.007)
    sweep('Dragon integrated low frontal bony ridge',[(0,.40,1.39),(0,.60,1.40),(0,.84,1.339),(0,1.01,1.281)],[.012,.025,.016,.002],[.010,.017,.012,.002],p['light'],'head',16,6)
    for s,side in [(-1,'L'),(1,'R')]:
        plate('Angular recessed predatory eye socket '+side,[(s*.138,.575,1.370),(s*.155,.638,1.385),(s*.128,.702,1.358),(s*.126,.631,1.334)],p['dark'],'head',.008)
        shell('Narrow luminous reptile slit eye '+side,(s*.145,.639,1.358),(.012,.027,.007),p['glow'],'head',20,10)
        tube('Dragon strongly defined scowling supraorbital brow '+side,[(s*.147,.572,1.389),(s*.155,.632,1.392),(s*.129,.70,1.374)],[.020,.024,.012],p['light'],'head',12,6)
        tube('Dragon anatomically rooted cheek ridge '+side,[(s*.119,.51,1.32),(s*.155,.63,1.294),(s*.122,.78,1.267)],[.027,.023,.008],p['hide'],'head',12,6)
        tube('Dragon horn smoothly rooted in skull '+side,[(s*.105,.445,1.40),(s*.15,.34,1.48),(s*.185,.24,1.62),(s*.18,.17,1.69)],[.049,.036,.018,.002],p['ivory'],'head',14,7)
        tube('Swept secondary cheek horn '+side,[(s*.145,.50,1.27),(s*.23,.42,1.26),(s*.265,.34,1.30)],[.032,.019,.001],p['ivory'],'head',10,5)
        shell('Dragon deep shaped nostril '+side,(s*.055,1.013,1.274),(.014,.025,.008),p['dark'],'head',18,10)
        tube('Dragon nostril protective ridge '+side,[(s*.055,.993,1.284),(s*.065,1.014,1.286),(s*.045,1.04,1.274)],[.008,.007,.003],p['light'],'head',9,5)
        for j in range(8):
            y=.64+j*.047;x=s*(.108-j*.007)
            tube('Dragon upper serrated tooth '+side+str(j),[(x,y,1.24),(x*.94,y+.01,1.217),(x*.97,y+.016,1.202)],[.010,.008,.001],p['ivory'],'head',8,3)
            if j%2==0:tube('Dragon lower hooked tooth '+side+str(j),[(x,y,1.191),(x*.96,y+.01,1.22)],[.008,.001],p['ivory'],'jaw',8,4)
        for j,(y,x) in enumerate([(.79,.113),(.948,.084)]):
            tube('Prominent dragon recurved external canine '+side+str(j),[(s*x,y,1.250),(s*(x+.01),y+.008,1.217),(s*(x+.009),y+.029,1.167),(s*(x+.013),y+.050,1.143)],[.020,.017,.011,.001],p['ivory'],'head',12,7)
        for y,leg in [(-.32,'hind'),(.20,'front')]:
            for j in range(3):
                x=s*.29+(j-1)*.057
                tube('Dragon separate anatomical toe '+side+leg+str(j),[(x,y+.11,.25),(x,y+.22,.225),(x,y+.29,.214)],[.021,.018,.01],p['hide'],leg+'_paw_'+side,10,4)
                tube('Dragon curved foot talon '+side+leg+str(j),[(x,y+.26,.221),(x,y+.32,.227),(x,y+.345,.20)],[.017,.012,.001],p['ivory'],leg+'_paw_'+side,9,5)
    for j in range(11):
        y=.31-j*.10;z=.99 if j<3 else (.92 if j<6 else .78)
        if mounted and -.53<y<-.08:continue  # A saddle sits on a clear back, never through dorsal spines.
        tube('Dragon swept dorsal spine '+str(j),[(0,y,z),(0,y-.04,z+.14),(0,y-.085,z+.16)],[.039,.020,.001],p['light'],'neck' if j<3 else ('spine' if j<7 else 'tail'),9,4)
    # Project the full outline and centre, never just a scale's centre.  An
    # unprojected diamond becomes a fin on the curved shoulder and can enter
    # the saddle.  Shared anatomical weights also keep each outline on the
    # same deforming skin throughout the neck/shoulder poses.
    fitted_scales=0;excluded_scales=0
    for s,side in [(-1,'L'),(1,'R')]:
        for j in range(7):
            y=-.36+j*.09;z=.76+.05*math.cos(j*.36)
            for k in range(3):
                zz=z+k*.055
                corners=[Vector((0,y-.032,zz)),Vector((0,y,zz+.030)),Vector((0,y+.038,zz)),Vector((0,y,zz-.035))]
                outline=[]
                for i,a in enumerate(corners):outline.extend([a,a.lerp(corners[(i+1)%4],.5)])
                coords=outline+[Vector((0,y,zz))];verts=[];normals=[]
                for co in coords:
                    pos,normal,index,distance=surface.ray_cast(Vector((s*3,co.y,co.z)),Vector((-s,0,0)))
                    if pos is None or normal.x*s<.06:break
                    verts.append(tuple(pos+normal*.0035));normals.append(normal)
                if len(verts)!=9:
                    excluded_scales+=1;continue
                # Include every corner, midpoint and centre in the clearance
                # test, conservatively larger than the seat and cantle.
                if mounted and any(abs(v[0])<.305 and -.515<v[1]<.075 and v[2]>.755 for v in verts):
                    excluded_scales+=1;continue
                faces=[]
                for i in range(8):
                    face=(8,i,(i+1)%8)
                    a,b,c=[Vector(verts[v]) for v in face]
                    if (b-a).cross(c-a).dot(normals[i])<0:face=tuple(reversed(face))
                    faces.append(face)
                o=mesh('Dragon fully skin-fitted low relief shoulder scale '+side+str(j)+str(k),verts,faces,p['light'],weight)
                modifier=o.modifiers.new('Fitted scale edge thickness','SOLIDIFY');modifier.thickness=.003
                bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=modifier.name)
                fitted_scales+=1
    RIG['shoulderScaleFit']='Full outline, edge midpoints and centre projected to skin BVH with normal offset; mounted saddle exclusion'
    RIG['fittedShoulderScales']=fitted_scales;RIG['excludedShoulderScales']=excluded_scales
    for j in range(8):
        z=.55+j*.078;w=.20-j*.013;verts=[]
        for r in range(4):
            t=r/3
            for col in range(9):
                u=(col-4)/4;x=w*u*(1-.02*t)
                zz=z-.035+.068*t+.011*(1-abs(u))*t
                verts.append(frontpoint(x,zz))
        faces=[(r*9+c,r*9+c+1,(r+1)*9+c+1,(r+1)*9+c) for r in range(3) for c in range(8)]
        o=mesh('Dragon skin-conforming interlocking belly and neck scute '+str(j),verts,faces,p['light'],weight)
        modifier=o.modifiers.new('Scute natural thickness','SOLIDIFY');modifier.thickness=.006
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=modifier.name)
    if family=='worldfire':
        for s,side in [(-1,'L'),(1,'R')]:
            tube('Fire mother dragon secondary royal horn '+side,[(s*.07,.37,1.43),(s*.092,.235,1.64),(s*.105,.16,1.80)],[.032,.020,.001],p['gold'],'head',12,6)
            for j in range(3):
                x=s*.135;z=.845+j*.061
                plate('Fire mother flush skin-conforming bronze crest '+side+str(j),[frontpoint(x-.022,z),frontpoint(x,z+.028),frontpoint(x+.022,z),frontpoint(x,z-.028)],p['gold'],weight,.004)
    marker('attack_muzzle',(0,1.07,1.225),'head');marker('dragon_breath_origin',(0,1.07,1.225),'head')
    return jaw

def rider_specs(seat):
    x,y,z=seat
    specs=[('rider_pelvis',(x,y,z),(x,y,z+.12),'spine'),('rider_torso',(x,y,z+.11),(x,y,z+.39),'rider_pelvis'),('rider_head',(x,y,z+.4),(x,y,z+.69),'rider_torso')]
    for s,side in [(-1,'L'),(1,'R')]:
        specs += [('rider_thigh_'+side,(s*.075,y,z+.01),(s*.25,y+.05,z-.13),'rider_pelvis'),('rider_calf_'+side,(s*.25,y+.05,z-.13),(s*.27,y+.10,z-.39),'rider_thigh_'+side),
            ('rider_upper_'+side,(s*.14,y,z+.35),(s*.20,y+.055,z+.24),'rider_torso'),('rider_forearm_'+side,(s*.20,y+.055,z+.24),(s*.19,y+.24,z+.16),'rider_upper_'+side),('rider_hand_'+side,(s*.19,y+.24,z+.16),(s*.19,y+.29,z+.17),'rider_forearm_'+side)]
    specs.append(('rider_weapon',(.19,y+.27,z+.16),(.19,y+.27,z+.84),'rider_hand_R'))
    return specs

def formed_hand(name,centre,material,bone,grip_axis='Z',handle_radius=.016):
    """Four fingers curl through MCP/PIP/DIP; opposed thumb on index side."""
    c=Vector(centre)
    palm=sweep(name+' shaped wrist into metacarpals',[c+Vector((0,-.035,0)),c,c+Vector((0,.009,.006))],[.023,.030,.026],[.019,.016,.012],material,bone,18,5)
    for i in range(4):
        dz=(i-1.5)*.015;x=c.x;cy=c.y
        r=handle_radius+.0062
        pts=[(x-.025,cy+.007,c.z+dz),(x-r,cy+.030,c.z+dz+.005),(x-r*.30,cy+.030+r*.955,c.z+dz+.006),(x+r*.80,cy+.030+r*.60,c.z+dz+.003),(x+r,cy+.030-r*.10,c.z+dz)]
        tube(name+' curved finger '+str(i),pts,[.0068,.0067,.0058,.0049,.0038],material,bone,10,5)
        # Small defined nail, lies on the distal dorsal surface.
    r=handle_radius+.0060
    tube(name+' opposed curved thumb',[c+Vector((.025,-.007,.029)),c+Vector((.029,.016,.026)),c+Vector((r,.030,.021)),c+Vector((r*.45,.030+r*.90,.018))],[.008,.0075,.006,.0046],material,bone,10,5)
    return palm

def rider(p,seat=(0,-.24,.92),mage=False,dwarf=False):
    x,y,z=seat
    shell('Rider anatomically cupped saddle seat',(x,y,z-.035),(.26,.22,.065),p['leather'],'spine',28,14)
    for yy in [y-.19,y+.17]:tube('Saddle raised cantle and pommel',[(x-.23,yy,z-.01),(x,yy,z+.055),(x+.23,yy,z-.01)],[.028,.027,.028],p['leather'],'spine',12,6)
    for s,side in [(-1,'L'),(1,'R')]:
        tube('Saddle stitched hanging stirrup leather '+side,[(s*.23,y,z-.03),(s*.29,y+.02,z-.24),(s*.27,y+.13,z-.42)],[.011,.01,.012],p['leather'],'spine',8,5)
        # Actual tread below the sole, loop follows saddle leather.
        tube('Rider brass stirrup tread '+side,[(s*.25,y+.045,z-.412),(s*.29,y+.045,z-.412)],[.008,.008],p['gold'],'spine',8,3)
        ring('Rider shaped stirrup loop '+side,(s*.27,y+.07,z-.36),.055,.005,p['gold'],'spine','X',24)
        sweep('Rider wrapped thigh '+side,[(s*.07,y,z+.01),(s*.17,y+.015,z-.035),(s*.25,y+.05,z-.13)],[.077,.07,.055],[.071,.065,.054],p['cloth'],'rider_thigh_'+side,20,5)
        sweep('Rider articulated boot shaft '+side,[(s*.25,y+.05,z-.12),(s*.27,y+.08,z-.28),(s*.27,y+.10,z-.39)],[.057,.048,.05],[.054,.052,.055],p['leather'],'rider_calf_'+side,18,5)
        shell('Rider boot instep and fitted sole '+side,(s*.27,y+.135,z-.371),(.05,.095,.034),p['leather'],'rider_calf_'+side,20,10)
        marker('boot_sole_'+side,(s*.27,y+.075,z-.405),'rider_calf_'+side)
        marker('stirrup_tread_'+side,(s*.27,y+.075,z-.404),'spine')
        shoulder=(s*.14,y,z+.35);elbow=(s*.20,y+.055,z+.24);hand=(s*.19,y+.24,z+.16)
        sweep('Rider fitted jointed sleeve '+side,[shoulder,elbow,hand],[.056,.04,.027],[.056,.039,.025],p['cloth'],lambda v:{'rider_upper_'+side:1} if (v-Vector(shoulder)).length<(v-Vector(hand)).length else {'rider_forearm_'+side:1},18,6)
        formed_hand('Rider '+side,hand,p['leather'],'rider_hand_'+side,handle_radius=.013 if side=='R' and not dwarf else .004)
        end=Vector((s*.084,.51,1.31) if dwarf else (s*.11,.64,1.24))
        def reinweights(v,side=side,end=end):
            t=max(0,min(1,(v.y-(y+.274))/(end.y-(y+.274))))
            return {'rider_hand_'+side:max(0,1-t*2),'spine':1-abs(t*2-1),'head':max(0,t*2-1)}
        tube('Connected skin-weighted riding rein '+side,[(s*.19,y+.274,z+.17),(s*.15,.21,1.12),end],[.004,.004,.004],p['leather'],reinweights,6,8)
        ring('Mount bridle fitted metal bit ring '+side,end,.019,.004,p['gold'],'head','X',20)
    sweep('Rider tailored continuous torso',[(0,y,z+.035),(0,y,z+.14),(0,y,z+.31),(0,y,z+.40)],[.12,.105,.16,.075],[.095,.08,.11,.045],p['cloth'],'rider_torso',32,6)
    marker('rider_seat_contact',(0,y,z+.030),'rider_pelvis')
    marker('saddle_contact',(0,y,z+.030),'spine')
    face=shell('Rider adult continuous face and jaw',(0,y+.01,z+.55),(.095,.084,.128),p['skin'],'rider_head',32,24,
        lambda v,a,t:v+Vector((0,.015*math.exp(-((v.x/.020)**2+((v.z-z-.55)/.04)**2)),0)))
    tube('Rider connecting neck',[(0,y,z+.35),(0,y,z+.44)],[.05,.046],p['skin'],'rider_head',18,6)
    for s in [-1,1]:
        shell('Rider properly inset eye',(s*.034,y+.086,z+.574),(.016,.006,.008),p['ivory'],'rider_head',16,8)
        shell('Rider eye pupil',(s*.034,y+.091,z+.574),(.005,.003,.0055),p['dark'],'rider_head',12,8)
    tube('Rider slight natural mouth',[(-.03,y+.082,z+.505),(0,y+.087,z+.50),(.03,y+.082,z+.505)],[.002,.0025,.002],p['dark'],'rider_head',6,6)
    if mage:
        # Fitted layered hood, crownlike binding rather than an isolated cone.
        shell('Mage rider fitted cowl',(0,y-.017,z+.606),(.107,.092,.081),p['cloth'],'rider_head',24,16)
        tube('Mage rider raised hood silhouette',[(0,y-.02,z+.66),(.015,y-.04,z+.77),(.028,y-.055,z+.81)],[.09,.045,.007],p['cloth'],'rider_head',20,5)
        tube('Mage rider actually held gilded staff',[(.19,y+.27,z-.14),(.19,y+.27,z+.16),(.19,y+.27,z+.79)],[.014,.013,.014],p['gold'],'rider_weapon',12,6)
        shell('Mage rider luminous staff focus',(.19,y+.27,z+.82),(.035,.033,.052),p['glow'],'rider_weapon',20,12)
        # Main champion attack still originates dragon mouth; rider gestures channel it.
        marker('staff_tip',(.19,y+.27,z+.82),'rider_weapon')
    elif dwarf:
        shell('Bomber fitted stitched pilot cap',(0,y-.016,z+.638),(.10,.086,.062),p['leather'],'rider_head',24,14)
        for s in [-1,1]:
            ring('Bomber brass fitted goggles',(s*.033,y+.093,z+.584),.022,.004,p['gold'],'rider_head','Y',20)
        for i in range(7):tube('Dwarf individually braided beard '+str(i),[((i-3)*.018,y+.077,z+.524),((i-3)*.014,y+.101,z+.46),((i-3)*.011,y+.101,z+.432)],[.014,.010,.003],p['light'],'rider_head',9,5)
    else:
        shell('Dragonrider closed fitted steel sallet',(0,y-.004,z+.617),(.108,.098,.09),p['steel'],'rider_head',28,16)
        plate('Dragonrider visor protects face',[(-.084,y+.086,z+.61),(.084,y+.086,z+.61),(.079,y+.10,z+.51),(-.079,y+.10,z+.51)],p['steel'],'rider_head',.009)
        tube('Dragonrider narrow visor eye slit',[(-.064,y+.107,z+.588),(0,y+.109,z+.591),(.064,y+.107,z+.588)],[.004,.004,.004],p['dark'],'rider_head',6,5)
        tube('Dragonrider raised weapon lance',[(.19,y+.27,z-.16),(.19,y+.27,z+.16),(.19,y+.27,z+.86)],[.013,.013,.009],p['leather'],'rider_weapon',12,6)
        tube('Dragonrider shaped lightning lance blade',[(.19,y+.27,z+.81),(.19,y+.27,z+.90),(.19,y+.27,z+1.01)],[.012,.035,.001],p['steel'],'rider_weapon',12,5)
        marker('sword_tip',(.19,y+.27,z+1.01),'rider_weapon')
    for s,side in [(-1,'L'),(1,'R')]:
        shell('Rider shoulder fitted layered pauldron '+side,(s*.142,y,z+.351),(.061,.06,.03),p['gold'] if mage else p['steel'],'rider_upper_'+side,20,12)
    return z

def dragon(family):
    p=palette(family);mounted=family in ('thunderheart','phoenix');specs=dragon_specs(mounted)
    rig(specs,family);footing(p,.5);dragon_anatomy(p,specs,mounted,family);dragon_wings(p)
    if mounted:rider(p,mage=family=='phoenix')
    attack=[(9,{'neck':(.10,0,0),'head':(-.06,0,0),'jaw':(-.045,0,0),'wing_upper_L':(.01,0,-.08),'wing_upper_R':(-.01,0,.08)}),
        (18,{'neck':(-.12,0,0),'head':(-.12,0,0),'jaw':(-.25,0,0),'wing_upper_L':(.015,0,.12),'wing_upper_R':(-.015,0,-.12),'wing_wrist_L':(0,0,.05),'wing_wrist_R':(0,0,-.05)}),
        (26,{'neck':(-.08,0,0),'head':(-.08,0,0),'jaw':(-.17,0,0),'wing_upper_L':(0,0,.06),'wing_upper_R':(0,0,-.06)}),(38,{'neck':(.015,0,0),'jaw':(-.04,0,0)})]
    if mounted:
        for frame,pose in attack:
            amount={9:.08,18:-.11,26:-.06,38:.01}[frame];pose.update({'rider_torso':(amount*.18,0,0),'rider_upper_R':(amount,0,0),'rider_forearm_R':(amount*.3,0,0)})
    animate(attack,[(0,{}),(30,{'neck':(.01,0,0),'wing_upper_L':(0,0,.016),'wing_upper_R':(0,0,-.016),'tail_tip':(.025,0,0)}),(60,{}),(90,{'neck':(-.01,0,0),'wing_upper_L':(0,0,-.016),'wing_upper_R':(0,0,.016),'tail_tip':(-.025,0,0)}),(120,{})])
    return p

def feather(name,start,end,width,m,bone):
    start,end=Vector(start),Vector(end);direction=(end-start).normalized();cross=direction.cross(Vector((0,1,0))).normalized()
    verts=[];rows=8
    for i in range(rows+1):
        t=i/rows;centre=start.lerp(end,t)+Vector((0,-.023*math.sin(math.pi*t),0));w=width*math.sin(math.pi*t)**.82*(1-.43*t)
        for j in range(5):
            u=(j-2)/2;verts.append(tuple(centre+cross*w*u+Vector((0,.009*(1-u*u)*math.sin(math.pi*t),0))))
    faces=[(i*5+j,i*5+j+1,(i+1)*5+j+1,(i+1)*5+j) for i in range(rows) for j in range(4)]
    o=mesh(name,verts,faces,m,bone);modifier=o.modifiers.new('Feather vane thickness','SOLIDIFY');modifier.thickness=.002
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=modifier.name)
    tube(name+' defined quill',[start,start.lerp(end,.5),end],[.004,.003,.001],m,bone,6,2)

def feather_wings(p):
    for s,side in [(-1,'L'),(1,'R')]:
        tube('Bird muscular feathered wing base '+side,[(s*.19,-.035,.95),(s*.44,-.055,1.13),(s*.63,-.08,1.22)],[.082,.055,.032],p['hide'],'wing_upper_'+side,16,6)
        tube('Bird articulated wing wrist '+side,[(s*.63,-.08,1.22),(s*.92,-.08,1.34),(s*1.23,-.08,1.31)],[.032,.025,.012],p['hide'],'wing_wrist_'+side,14,6)
        for j in range(11):
            t=j/10;start=Vector((s*(.63+.55*t),-.08,1.23+.09*math.sin(math.pi*t)))
            end=start+Vector((s*(.16+.17*t),-.075,-(.38+.27*t)))
            feather('Long pointed asymmetric primary flight feather '+side+str(j),start,end,.053,p['light'] if j%3 else p['hide'],'wing_wrist_'+side)
        for j in range(7):
            t=j/6;start=(s*(.25+.40*t),-.035,1.00+.23*t)
            feather('Overlapping directional secondary feather '+side+str(j),start,(s*(.36+.40*t),.005,.74+.20*t),.045,p['hide'],'wing_upper_'+side)
        for j in range(9):
            t=j/8;start=(s*(.27+.83*t),.016,1.06+.28*t)
            feather('Small elongated directional wing covert '+side+str(j),start,(s*(.37+.83*t),.025,.83+.28*t),.030,p['light'],'wing_upper_'+side if j<4 else 'wing_wrist_'+side)

def bird_specs(mounted=False):
    specs=[('root',(0,0,.17),(0,0,.55),None),('spine',(0,-.25,.65),(0,.13,.88),'root'),('neck',(0,.13,.89),(0,.26,1.17),'spine'),('head',(0,.26,1.17),(0,.37,1.43),'neck'),('jaw',(0,.34,1.36),(0,.61,1.29),'head'),('tail',(0,-.25,.64),(0,-.65,.59),'spine')]
    for s,side in [(-1,'L'),(1,'R')]:
        specs += [('wing_upper_'+side,(s*.19,-.035,.95),(s*.63,-.08,1.22),'spine'),('wing_wrist_'+side,(s*.63,-.08,1.22),(s*1.23,-.08,1.31),'wing_upper_'+side),('leg_'+side,(s*.16,.07,.65),(s*.20,.10,.30),'spine'),('paw_'+side,(s*.20,.10,.30),(s*.20,.27,.23),'leg_'+side)]
    if mounted:specs+=rider_specs((0,-.21,.94))
    return specs

def bird(family):
    griffin=family=='griffinbomber';p=palette(family);specs=bird_specs(griffin);rig(specs,family);footing(p,.5)
    parts=[sweep('Bird continuous breast and neck',[(0,-.26,.55),(0,-.12,.72),(0,.10,.93),(0,.24,1.16),(0,.31,1.33)],[.03,.25,.24,.13,.11],[.02,.24,.27,.12,.10],p['hide'],sides=32,steps=7),
        sweep('Eagle purposeful skull',[(0,.21,1.30),(0,.33,1.41),(0,.43,1.39),(0,.52,1.34)],[.06,.135,.108,.028],[.05,.115,.085,.035],p['hide'],sides=26,steps=6)]
    if griffin:
        parts.append(sweep('Griffin muscular lion haunch',[(0,-.62,.58),(0,-.38,.63),(0,-.10,.67)],[.015,.27,.22],[.02,.22,.23],p['hide'],sides=28,steps=7))
        for s,side in [(-1,'L'),(1,'R')]:
            parts.append(sweep('Griffin continuous feline hindleg '+side,[(s*.22,-.36,.60),(s*.29,-.39,.43),(s*.25,-.33,.25)],[.12,.078,.055],[.12,.09,.06],p['hide'],sides=18,steps=6))
            shell('Griffin lion padded hindpaw '+side,(s*.25,-.28,.23),(.072,.11,.051),p['hide'],'root',20,12)
        tube('Griffin flowing lion tail',[(0,-.48,.68),(.22,-.72,.68),(.39,-.81,.88),(.42,-.73,1.04)],[.055,.038,.024,.007],p['hide'],'tail',12,6)
        for j in range(5):feather('Griffin tufted tail plume '+str(j),(.42,-.73,1.04),(.42+(j-2)*.035,-.75,1.18),.025,p['light'],'tail')
    sculpt_union(parts,'V8 sculpted coherent eagle '+('lion' if griffin else 'thunderbird'),p['hide'],8500 if griffin else 11000,.014,distance_weights(specs,{'spine','neck','head','tail'}))
    for s,side in [(-1,'L'),(1,'R')]:
        tube('Bird naturally flexed scaled leg '+side,[(s*.16,.06,.65),(s*.20,.10,.42),(s*.20,.13,.27)],[.039,.028,.023],p['gold'],'leg_'+side,14,6)
        for j in range(3):
            tube('Bird independently curled toe '+side+str(j),[(s*.20,.13,.27),(s*.20+(j-1)*.061,.235,.23),(s*.20+(j-1)*.075,.29,.215)],[.020,.013,.003],p['dark'],'paw_'+side,9,6)
        shell('Bird fitted dark orbital rim '+side,(s*.104,.432,1.425),(.039,.025,.025),p['dark'],'head',20,12)
        shell('Bird luminous alert eye '+side,(s*.109,.447,1.429),(.018,.01,.015),p['glow'],'head',18,10)
        for j in range(5):feather('Eagle layered neck mantle '+side+str(j),(s*.09,.20-j*.055,1.20-j*.032),(s*.20,.15-j*.055,.97-j*.020),.058,p['light'],'neck')
        for j in range(3):feather('Bird swept head crest '+side+str(j),(s*.031,.28,1.50),(s*(.07+j*.03),.13,1.64+j*.05),.026,p['light'],'head')
    tube('Eagle anatomically hooked upper beak',[(0,.48,1.38),(0,.58,1.34),(0,.615,1.25)],[.06,.036,.005],p['gold'],'head',20,7)
    tube('Eagle opening lower mandible',[(0,.44,1.28),(0,.55,1.27),(0,.58,1.28)],[.045,.025,.003],p['gold'],'jaw',16,6)
    feather_wings(p)
    if griffin:
        rider(p,seat=(0,-.21,.94),dwarf=True)
        for s in [-1,1]:
            o=cube('Bomber fitted leather charge pannier',(s*.31,-.25,.73),(.17,.34,.20),p['leather'],.025);skin(o,'spine')
            for j in range(2):
                centre=(s*.33,-.33+j*.17,.88);shell('Bomber forged grenade',centre,(.059,.059,.068),p['dark'],'spine',20,12)
                tube('Bomb curved lit fuse',[Vector(centre)+Vector((0,0,.064)),Vector(centre)+Vector((.02,0,.11))],[.005,.003],p['gold'],'spine',7,6)
        marker('attack_muzzle',(.19,.07,1.10),'rider_hand_R')
    else:
        for j in range(7):feather('Thunderbird long tail fan '+str(j),((j-3)*.019,-.21,.79),((j-3)*.075,-.64,.36),.043,p['light'] if j%2 else p['hide'],'tail')
        marker('attack_muzzle',(0,.615,1.30),'head')
    attack=[]
    for frame,up,jaw in [(9,-.15,.01),(18,.26,.17),(26,.15,.11),(38,-.025,.01)]:
        pose={'wing_upper_L':(0,0,up),'wing_upper_R':(0,0,-up),'wing_wrist_L':(0,0,up*.4),'wing_wrist_R':(0,0,-up*.4),'neck':(-up*.20,0,0),'jaw':(-jaw,0,0)}
        if griffin:pose.update({'rider_upper_R':(-up*.22,0,0),'rider_forearm_R':(-up*.55,0,0)})
        attack.append((frame,pose))
    animate(attack,[(0,{}),(30,{'wing_upper_L':(0,0,.025),'wing_upper_R':(0,0,-.025),'head':(.012,0,0)}),(60,{}),(90,{'wing_upper_L':(0,0,-.025),'wing_upper_R':(0,0,.025),'head':(-.012,0,0)}),(120,{})])
    return p

def bear():
    family='rangermentor';p=palette(family)
    specs=[('root',(0,0,.17),(0,0,.6),None),('spine',(0,-.35,.68),(0,.23,.88),'root'),('neck',(0,.24,.85),(0,.44,1.14),'spine'),('head',(0,.44,1.14),(0,.64,1.32),'neck'),('jaw',(0,.51,1.21),(0,.85,1.21),'head')]
    for s,side in [(-1,'L'),(1,'R')]:
        for y,leg in [(-.35,'hind'),(.25,'front')]:
            specs += [(leg+'_upper_'+side,(s*.26,y,.68),(s*.31,y+.02,.44),'spine'),(leg+'_lower_'+side,(s*.31,y+.02,.44),(s*.32,y+.09,.24),leg+'_upper_'+side),(leg+'_paw_'+side,(s*.32,y+.09,.24),(s*.32,y+.30,.23),leg+'_lower_'+side)]
    rig(specs,family);footing(p,.5)
    parts=[sweep('Royal bear anatomical shoulder hump',[(0,-.65,.62),(0,-.34,.76),(0,.04,.81),(0,.28,.99),(0,.41,1.10)],[.015,.34,.36,.25,.20],[.02,.28,.32,.30,.20],p['hide'],sides=32,steps=8),
        sweep('Bear realistic broad head muzzle',[(0,.31,1.24),(0,.49,1.37),(0,.65,1.31),(0,.85,1.25)],[.10,.21,.17,.095],[.095,.17,.11,.045],p['hide'],sides=28,steps=8)]
    for s,side in [(-1,'L'),(1,'R')]:
        for y,leg in [(-.35,'hind'),(.25,'front')]:
            parts.append(sweep('Bear continuous weightbearing leg '+side+leg,[(s*.25,y,.72),(s*.31,y+.01,.44),(s*.32,y+.09,.24)],[.16,.12,.088],[.15,.12,.09],p['hide'],sides=20,steps=7))
            parts.append(shell('Bear broad natural paw '+side+leg,(s*.32,y+.17,.23),(.11,.16,.061),p['hide'],n=20,rows=12))
        parts.append(shell('Bear rooted rounded ear '+side,(s*.17,.415,1.50),(.060,.046,.070),p['hide'],'head',24,14))
    sculpt_union(parts,'V8 anatomically sculpted royal bear',p['hide'],18000,.013,distance_weights(specs,{n for n,a,b,parent in specs if n not in ('root','jaw')}))
    shell('Bear leather-like shaped nose',(0,.855,1.295),(.095,.05,.041),p['dark'],'head',24,14)
    sweep('Bear opening lower muzzle',[(0,.50,1.19),(0,.67,1.16),(0,.84,1.19)],[.095,.13,.07],[.04,.046,.017],p['hide'],'jaw',24,6)
    for s,side in [(-1,'L'),(1,'R')]:
        shell('Bear properly inset amber eye '+side,(s*.152,.627,1.398),(.026,.017,.018),p['glow'],'head',20,12)
        for y,leg in [(-.35,'hind'),(.25,'front')]:
            for j in range(5):
                x=s*.32+(j-2)*.041;tube('Bear five separate natural claws '+side+leg+str(j),[(x,y+.27,.239),(x,y+.335,.234),(x,y+.36,.205)],[.012,.01,.001],p['ivory'],leg+'_paw_'+side,9,6)
        for j in range(4):feather('Royal druid leaf shoulder mantle '+side+str(j),(s*.20,.10-j*.072,1.085),(s*.39,.08-j*.07,.91),.049,p['light'],'spine')
    ring('Bearking fitted engraved crown',(0,.48,1.485),.187,.017,p['gold'],'head',n=40)
    for j in range(7):
        a=TAU*j/7;c=(.17*math.cos(a),.48+.145*math.sin(a),1.49)
        tube('Bearking crown chased leaf '+str(j),[c,Vector(c)+Vector((0,0,.085)),Vector(c)+Vector((0,0,.14))],[.013,.024,.001],p['gold'],'head',10,5)
    marker('attack_muzzle',(0,.84,1.22),'head')
    animate([(9,{'neck':(.06,0,0),'head':(.03,0,0),'jaw':(-.04,0,0),'front_upper_R':(-.11,0,0)}),(18,{'neck':(-.14,0,0),'head':(-.09,0,0),'jaw':(-.19,0,0),'front_upper_R':(.16,0,0),'front_lower_R':(-.15,0,0)}),(26,{'neck':(-.06,0,0),'jaw':(-.11,0,0),'front_upper_R':(.07,0,0)}),(38,{'neck':(.01,0,0)})],[(0,{}),(30,{'neck':(.012,0,0),'head':(.008,0,0)}),(60,{}),(90,{'neck':(-.012,0,0),'head':(-.008,0,0)}),(120,{})])
    return p

def build(family):
    reset()
    if family in ('embercrown','worldfire','thunderheart','phoenix'):return dragon(family)
    if family in ('starfall','griffinbomber'):return bird(family)
    if family=='rangermentor':return bear()
    raise ValueError(family)
