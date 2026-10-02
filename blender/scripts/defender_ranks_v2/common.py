"""Shared editable faceted defender anatomy and rigid runtime joints."""
import math
import bpy
import bmesh
from mathutils import Vector
import articulation
from archer_design_study import ranger

class Builder:
    def __init__(self, collection, materials, family, rank):
        self.collection,self.m,self.family,self.rank=collection,materials,family,rank
        self.objects=[];self.hand={};self.weapon={};self.upper={};self.dwarf=False
        self.root=self.pivot(f'basic_defender_{family}_t{rank}',(0,0,0))
        self.torso=self.pivot('torso_pivot',(0,0,1.09),self.root)
        self.head=self.pivot('head_pivot',(0,0,1.65),self.torso)
    def relocate(self,obj):
        for c in tuple(obj.users_collection):c.objects.unlink(obj)
        self.collection.objects.link(obj)
        return obj
    def pivot(self,name,location,parent=None):
        return self.relocate(articulation.pivot(name,location,parent))
    def attach(self,objects,parent):
        if isinstance(objects,bpy.types.Object):objects=[objects]
        articulation.attach(objects,parent)
        return objects
    def mesh(self,name,verts,faces,matKey):
        data=bpy.data.meshes.new(name+'_mesh');data.from_pydata(verts,[],faces);data.update()
        bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
        obj=bpy.data.objects.new(name,data);self.collection.objects.link(obj)
        if matKey:obj.data.materials.append(self.m[matKey])
        obj['part']=name;self.objects.append(obj)
        return obj
    def rings(self,name,rows,matKey):
        sec=[(-.66,1),(.66,1),(1,.5),(1,-.54),(.66,-1),(-.66,-1),(-1,-.54),(-1,.5)]
        verts=[(x+rx*sx,y+ry*sy,z) for x,y,z,rx,ry in rows for sx,sy in sec]
        faces=[tuple(reversed(range(8)))]+[(j*8+i,j*8+(i+1)%8,(j+1)*8+(i+1)%8,(j+1)*8+i) for j in range(len(rows)-1) for i in range(8)]
        faces.append(tuple((len(rows)-1)*8+i for i in range(8)))
        return self.mesh(name,verts,faces,matKey)
    def limb(self,name,nodes,matKey,sides=8):
        centers=[Vector(p[:3]) for p in nodes];verts=[]
        for j,node in enumerate(nodes):
            tangent=(centers[min(j+1,len(nodes)-1)]-centers[max(0,j-1)]).normalized()
            axis=Vector((0,1,0)) if abs(tangent.y)<.95 else Vector((1,0,0))
            u=tangent.cross(axis).normalized();v=tangent.cross(u).normalized()
            for i in range(sides):
                a=2*math.pi*(i+.5)/sides
                verts.append(tuple(centers[j]+u*math.cos(a)*node[3]+v*math.sin(a)*node[4]))
        faces=[tuple(reversed(range(sides)))]+[(j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i) for j in range(len(nodes)-1) for i in range(sides)]
        faces.append(tuple((len(nodes)-1)*sides+i for i in range(sides)))
        return self.mesh(name,verts,faces,matKey)
    def rod(self,name,a,b,r,matKey,sides=8):
        return self.limb(name,[(*a,r,r),(*b,r,r)],matKey,sides)
    def panel(self,name,outline,depth,matKey,faceted=False):
        n=len(outline);verts=list(outline)+[(x,y-depth,z) for x,y,z in outline]
        if faceted:
            c=tuple(sum(p[k] for p in outline)/n for k in range(3));verts += [c,(c[0],c[1]-depth,c[2])]
            faces=[(i,(i+1)%n,2*n) for i in range(n)]+[(n+(i+1)%n,n+i,2*n+1) for i in range(n)]
        else:faces=[tuple(range(n)),tuple(reversed(range(n,2*n)))]
        faces += [(i,n+i,n+(i+1)%n,(i+1)%n) for i in range(n)]
        return self.mesh(name,verts,faces,matKey)
    def box(self,name,center,size,matKey,bevel=.01):
        bpy.ops.mesh.primitive_cube_add(size=1,location=center)
        obj=self.relocate(bpy.context.object);obj.name=name;obj.scale=size
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        obj.data.materials.append(self.m[matKey]);obj['part']=name;self.objects.append(obj)
        if bevel:
            mod=obj.modifiers.new('Single clean bevel','BEVEL');mod.width=bevel;mod.segments=1
        return obj
    def body(self,hood=True,mantle=True,cape='short',robe=False,dwarf=False,keep_equipment=False):
        self.dwarf=dwarf
        parts=ranger.build(self.collection,self.m)
        for obj in parts:
            part=obj.get('part','')
            excluded=any(k in part for k in ('Sleeve','Bracer','Glove'))
            excluded |= not keep_equipment and any(k in part for k in ('Bow','Quiver','Arrow_'))
            excluded |= not hood and ('Hood' in part or part=='Pointed_Open_Hood_Shell')
            excluded |= not mantle and part=='Continuous_Shoulder_Mantle'
            excluded |= not cape and part=='Broad_Pointed_Back_Cape'
            excluded |= robe and part=='Continuous_Split_Tunic_Skirt'
            if excluded:bpy.data.objects.remove(obj,do_unlink=True);continue
            obj.name=part;self.objects.append(obj)
            if part=='Broad_Pointed_Back_Cape' and cape=='long':
                for v in obj.data.vertices:
                    if v.co.z<1.4:v.co.z=1.4-(1.4-v.co.z)*1.57
            if any(k in part for k in ('Face','Eye','Hood','Neck')):parent=self.head
            elif any(k in part for k in ('Boot','Trouser')):parent=self.root
            else:parent=self.torso
            self.attach(obj,parent)
        if robe:
            # A coherent robe shell encloses the trouser/calf silhouettes instead
            # of stretching the narrow Ranger tails through the underlying legs.
            obj=self.rings('continuous_long_robe',[(0,-.008,1.137,.161,.117),(0,-.008,.87,.230,.153),(0,-.008,.41,.305,.201)],'blue')
            self.attach(obj,self.torso)
            self.attach(self.panel('robe_front_split_seam',[(-.008,.195,.42),(.008,.195,.42),(.004,.148,.88),(-.004,.148,.88)],.003,'navy'),self.torso)
        return parts
    def arm(self,side,elbow,hand,metal=False):
        sign=-1 if side=='left' else 1;shoulder=(sign*.219,-.012,1.378)
        upper,lower,wrist,weapon=articulation.limb(shoulder,elbow,hand)
        for joint in (upper,lower,wrist,weapon):self.relocate(joint)
        self.attach(upper,self.torso);self.upper[side]=upper;self.hand[side]=wrist;self.weapon[side]=weapon
        a=Vector(shoulder);e=Vector(elbow);h=Vector(hand)
        self.attach(self.limb(side+'_upper_sleeve',[(*a,.082,.086),(*e,.067,.070)],'trousers'),upper)
        split=e.lerp(h,.32)
        self.attach(self.limb(side+'_lower_sleeve',[(*e,.068,.070),(*split,.064,.063)],'trousers'),lower)
        self.attach(self.limb(side+'_bracer',[(*split,.074,.071),(*h,.055,.058)],'steel' if metal else 'boots'),lower)
        tip=h+(h-e).normalized()*.075
        self.attach(self.limb(side+'_glove_mitten',[(*h,.060,.060),(*tip,.056,.057)],'steel' if metal else 'boots'),wrist)
        return upper,lower,wrist,weapon
    def focus(self,location,parent=None):
        parent=parent or self.weapon.get('right') or self.torso
        self.pivot('staff_tip',location,parent);self.pivot('attack_muzzle',location,parent)
    def finish(self,equipment):
        for obj in list(self.collection.objects):
            if obj is not self.root and obj.parent is None:self.attach(obj,self.root)
        if self.dwarf:self.root.scale=(1.23,1.12,.86);self.root.location.z=.0168
        self.root['assetRevision']='hooded-ranks-v2';self.root['family']=self.family;self.root['tier']=self.rank
        self.root['rankColor']=['#3989ed','#3eac63','#9555d8','#eee9db','#e7b43f','#ffd969'][self.rank-1]
        self.root['equipment']=equipment
        return self.root
