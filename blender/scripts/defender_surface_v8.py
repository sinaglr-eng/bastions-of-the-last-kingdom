"""Shared V8 Blender surface authoring, armatures and game-safe action export.

Bodies and equipment are purpose-shaped continuous contour surfaces. Tiny
analytic spheres are reserved for corneas, rivets, beads and luminous gems.
The helper contains no gameplay data and never writes the asset manifest.
"""
import math, bpy
from mathutils import Vector, Matrix
from author_archer import custom, mat
TAU=math.tau

def cubic(values,t):
    n=len(values)-1;i=min(n-1,int(t*n));f=t*n-i
    a,b=values[i],values[i+1];before,after=values[max(0,i-1)],values[min(n,i+2)]
    return tuple((2*f**3-3*f*f+1)*a[k]+(f**3-2*f*f+f)*(b[k]-before[k])*.5+(-2*f**3+3*f*f)*b[k]+(f**3-f*f)*(after[k]-a[k])*.5 for k in range(len(a)))

def smoothstep(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)

def material(name,color,rough=.6,metal=0,glow=0,textile=False):
    m=mat(name,color,metal,glow);s=m.node_tree.nodes['Principled BSDF'];s.inputs['Roughness'].default_value=rough
    if 'skin' in name.lower():s.inputs['Subsurface Weight'].default_value=.055
    if textile:s.inputs['Sheen Weight'].default_value=.18
    if metal or textile:
        image=bpy.data.images.get('V8 authored '+('metal patina' if metal else 'woven textile')+' roughness')
        if not image:
            n=64;image=bpy.data.images.new('V8 authored '+('metal patina' if metal else 'woven textile')+' roughness',n,n,alpha=False);image.colorspace_settings.name='Non-Color'
            pixels=[]
            for y in range(n):
                for x in range(n):
                    v=rough+(.035*math.sin(x*2.71+y*.31)*math.sin(y*1.37) if metal else .035*math.sin(x*math.pi/2)*math.sin(y*math.pi/2))
                    pixels.extend((v,v,v,1))
            image.pixels.foreach_set(pixels);image.pack()
        tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;m.node_tree.links.new(tex.outputs['Color'],s.inputs['Roughness'])
    return m

class Surface:
    def __init__(self,family,rig=None):self.family=family;self.rig=rig;self.parts=[]
    def mesh(self,name,vertices,faces,material,weights='root',solid=0,smooth=True):
        obj=custom(self.family+' V8 '+name,vertices,faces,material)
        for p in obj.data.polygons:p.use_smooth=smooth
        uv=obj.data.uv_layers.new(name='Authored UV')
        for p in obj.data.polygons:
            for loop in p.loop_indices:
                v=obj.data.vertices[obj.data.loops[loop].vertex_index].co;uv.data[loop].uv=(v.x*.9+v.y*.4,v.z)
        if solid:
            mod=obj.modifiers.new('Physical material thickness','SOLIDIFY');mod.thickness=solid
            bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
        weights=[{weights:1} for _ in obj.data.vertices] if isinstance(weights,str) else weights
        for bone in {b for row in weights for b in row}:
            group=obj.vertex_groups.new(name=bone)
            for i,row in enumerate(weights):
                if row.get(bone,0)>0:group.add([i],row[bone],'REPLACE')
        if self.rig:
            mod=obj.modifiers.new('Native anatomical deform armature','ARMATURE');mod.object=self.rig;obj.parent=self.rig
        obj['modelRevision']='v8';obj['surfaceMethod']='Purpose-shaped connected contour topology';self.parts.append(obj);return obj
    def loft(self,name,profile,material,bone='root',sides=32,rows=18,warp=None,solid=0):
        v=[];w=[]
        for r in range(rows+1):
            t=r/rows;z,width,front,back,cy=cubic(profile,t)
            for c in range(sides):
                a=TAU*c/sides;point=Vector((width*math.cos(a),cy+math.sin(a)*(front if math.sin(a)>0 else back),z))
                if warp:point=Vector(warp(point,a,t))
                v.append(tuple(point));w.append(bone(point,t) if callable(bone) else {bone:1})
        f=[(r*sides+c,r*sides+(c+1)%sides,(r+1)*sides+(c+1)%sides,(r+1)*sides+c) for r in range(rows) for c in range(sides)]
        f.extend([tuple(reversed(range(sides))),tuple(rows*sides+c for c in range(sides))])
        return self.mesh(name,v,f,material,w,solid)
    def tube(self,name,points,radii,material,bone='root',sides=12,rows=24,flat=1,cap=True,solid=0):
        path=[Vector(cubic(points,j/rows)) for j in range(rows+1)];v=[];w=[];prev=None
        for j,p in enumerate(path):
            direction=(path[min(rows,j+1)]-path[max(0,j-1)]).normalized()
            axis=direction.cross(Vector((0,1,0)))
            if axis.length<.01:axis=direction.cross(Vector((1,0,0)))
            axis.normalize()
            if prev is not None and axis.dot(prev)<0:axis=-axis
            prev=axis;second=direction.cross(axis).normalized();radius=cubic([(x,) for x in radii],j/rows)[0]
            for c in range(sides):
                a=TAU*c/sides;point=p+radius*(axis*math.cos(a)+second*math.sin(a)*flat);v.append(tuple(point));w.append(bone(point,j/rows) if callable(bone) else {bone:1})
        f=[(r*sides+c,r*sides+(c+1)%sides,(r+1)*sides+(c+1)%sides,(r+1)*sides+c) for r in range(rows) for c in range(sides)]
        if cap:f.extend([tuple(reversed(range(sides))),tuple(rows*sides+c for c in range(sides))])
        return self.mesh(name,v,f,material,bone if solid and isinstance(bone,str) else w,solid)
    def gem(self,name,centre,scale,material,bone='root',sides=16,rows=8):
        v=[(centre[0]+scale[0]*math.sin(math.pi*j/rows)*math.cos(TAU*i/sides),centre[1]+scale[1]*math.sin(math.pi*j/rows)*math.sin(TAU*i/sides),centre[2]+scale[2]*math.cos(math.pi*j/rows)) for j in range(rows+1) for i in range(sides)]
        f=[(j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i) for j in range(rows) for i in range(sides)]
        return self.mesh(name,v,f,material,bone)
    def loop(self,name,points,radius,material,bone='root',sides=6):return self.tube(name,[*points,points[0]],[radius]*(len(points)+1),material,bone,sides,len(points)*2)
    def socket(self,name,position,bone):
        obj=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(obj);obj.parent=self.rig;obj.parent_type='BONE';obj.parent_bone=bone
        bpy.context.view_layer.update();obj.matrix_world=Matrix.Translation(position);obj['socketBone']=bone;obj['effectReleaseFraction']=.36;return obj
    def union(self,parts,name,material,budget,weights,voxel=.0025):
        """Watertight arm-to-wrist-to-palm union with preserved separated digits."""
        for obj in parts:self.parts.remove(obj);obj.modifiers.clear()
        bpy.ops.object.select_all(action='DESELECT')
        for obj in parts:obj.select_set(True)
        bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();obj=parts[0];obj.name=self.family+' V8 '+name
        mod=obj.modifiers.new('Sculpt continuous anatomical transitions','REMESH');mod.mode='VOXEL';mod.voxel_size=voxel;mod.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=obj.modifiers.new('Soft anatomical landmarks','SMOOTH');mod.factor=.52;mod.iterations=4;bpy.ops.object.modifier_apply(modifier=mod.name)
        tri=sum(len(p.vertices)-2 for p in obj.data.polygons)
        if tri>budget:
            mod=obj.modifiers.new('Anatomical surface retopology','DECIMATE');mod.ratio=budget/tri;bpy.ops.object.modifier_apply(modifier=mod.name)
        obj.vertex_groups.clear();groups={}
        for vertex in obj.data.vertices:
            for bone,weight in weights(vertex.co).items():
                if weight<=0:continue
                if bone not in groups:groups[bone]=obj.vertex_groups.new(name=bone)
                groups[bone].add([vertex.index],weight,'REPLACE')
        for p in obj.data.polygons:p.use_smooth=True
        mod=obj.modifiers.new('Native anatomical deform armature','ARMATURE');mod.object=self.rig;obj.parent=self.rig;self.parts.append(obj);return obj

def make_rig(name,specs):
    for action in list(bpy.data.actions):bpy.data.actions.remove(action)
    data=bpy.data.armatures.new(name+' V8 deform bones');rig=bpy.data.objects.new(name+'_Rig',data);bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    for bone,start,end,parent in specs:
        b=data.edit_bones.new(bone);b.head=start;b.tail=end
        if parent:b.parent=data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
    rig['articulationRevision']=3;rig['modelRevision']='v8';rig['attackReleaseFraction']=.36;rig['designRevision']=11
    return rig

def actions(rig,kind='staff',wings=False):
    """True articulated preparation / release / follow-through / recovery."""
    scene=bpy.context.scene;scene.render.fps=30;rig.animation_data_create()
    def key(name,keys,end):
        action=bpy.data.actions.new(name);rig.animation_data.action=action
        for frame,poses in keys:
            for b in rig.pose.bones:
                b.rotation_mode='XYZ';b.rotation_euler=poses.get(b.name,(0,0,0));b.scale=(1,1,1)
                if kind=='bow' and b.name=='nocked_arrow' and 10.8<=frame<22:b.scale=(.001,.001,.001)
                b.keyframe_insert('rotation_euler',frame=frame,group=b.name);b.keyframe_insert('scale',frame=frame,group=b.name)
        action['effectReleaseFraction']=.36 if name=='Attack' else 0;action['durationSeconds']=end/30
        track=rig.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,0,action);strip.action_frame_start=0;strip.action_frame_end=end;track.mute=True
        return action
    idle=[]
    for frame,m in [(0,0),(18,1),(36,0),(54,-1),(72,0)]:
        pose={'torso':(.004*m,0,.004*m),'head':(.007*m,.006*m,-.004*m),'upper_arm_L':(.006*m,0,.009*m),'cape':(.013*m,.006*m,0)}
        if wings:pose.update(wing_L=(.025*m,0,-.02*m),wing_R=(.025*m,0,.02*m))
        idle.append((frame,pose))
    idleact=key('Idle',idle,72)
    poses={
        'sword':[{'torso':(0,0,-.095),'upper_arm_R':(-.16,.08,-.18),'forearm_R':(.12,0,-.09),'upper_arm_L':(.015,0,.04)}, {'torso':(.03,0,.10),'upper_arm_R':(.34,-.12,.20),'forearm_R':(-.14,0,.11),'upper_arm_L':(-.02,0,-.04)}],
        'hammer':[{'torso':(-.03,0,-.055),'upper_arm_R':(-.24,.06,-.10),'forearm_R':(.15,0,-.08)}, {'torso':(.07,0,.06),'upper_arm_R':(.38,-.08,.11),'forearm_R':(-.10,0,.03)}],
        'bow':[{'torso':(0,0,-.055),'upper_arm_R':(-.10,0,-.08),'forearm_R':(.12,0,0),'upper_arm_L':(-.045,0,.06),'forearm_L':(.02,0,0)}, {'torso':(.016,0,.025),'upper_arm_R':(.03,0,.025),'forearm_R':(-.07,0,0),'upper_arm_L':(.018,0,-.03),'forearm_L':(-.01,0,0)}],
        'crossbow':[{'torso':(-.02,0,-.055),'upper_arm_R':(-.045,0,-.04),'upper_arm_L':(-.035,0,.04)}, {'torso':(.035,0,.025),'upper_arm_R':(.065,0,.02),'upper_arm_L':(.06,0,-.02)}],
        'staff':[{'torso':(0,0,-.075),'upper_arm_R':(-.06,.02,-.08),'forearm_R':(.10,0,-.045),'upper_arm_L':(.09,0,.08),'forearm_L':(-.07,0,0)}, {'torso':(.025,0,.055),'upper_arm_R':(.10,-.01,.075),'forearm_R':(.065,0,.035),'upper_arm_L':(-.12,0,-.075),'forearm_L':(.07,0,0)}],
        'bomb':[{'torso':(-.03,0,-.07),'upper_arm_R':(-.20,.015,-.12),'forearm_R':(.08,0,-.03)}, {'torso':(.04,0,.08),'upper_arm_R':(.25,-.025,.10),'forearm_R':(-.04,0,.035)}],
        'prayer':[{'torso':(-.015,0,0),'upper_arm_R':(-.035,0,-.025),'upper_arm_L':(-.035,0,.025),'head':(.035,0,0)}, {'torso':(.02,0,0),'upper_arm_R':(.10,0,.10),'upper_arm_L':(.10,0,-.10),'head':(-.025,0,0)}],
    }
    prep,release=poses[kind]
    if wings:prep.update(wing_L=(-.065,0,-.035),wing_R=(-.065,0,.035));release.update(wing_L=(.08,0,.055),wing_R=(.08,0,-.055))
    def mul(row,k):return {bone:tuple(x*k for x in value) for bone,value in row.items()}
    attack=key('Attack',[(0,{}),(6,prep),(10.8,release),(15,mul(release,.65)),(22,mul(release,.17)),(30,{})],30)
    rig.animation_data.action=idleact;scene.frame_set(0)
    return idleact,attack
