"""New measured anatomy, physical low-poly surfaces and unchanged runtime joints.

The old generator is intentionally not imported: only the articulation contract
is reused. All mesh coordinates use +Y front, +X anatomical right, Z up.
"""
import math
import bpy
import bmesh
from mathutils import Vector
import articulation

class Builder:
    def __init__(self, collection, materials, family, rank):
        self.collection,self.m,self.family,self.rank=collection,materials,family,rank
        self.objects=[];self.hand={};self.weapon={};self.upper={};self.dwarf=False
        self.root=self.pivot(f'basic_defender_{family}_t{rank}',(0,0,0))
        self.torso=self.pivot('torso_pivot',(0,0,.88),self.root)
        self.head=self.pivot('head_pivot',(0,0,1.49),self.torso)
    def relocate(self,obj):
        for c in tuple(obj.users_collection):c.objects.unlink(obj)
        self.collection.objects.link(obj);return obj
    def pivot(self,name,location,parent=None):
        return self.relocate(articulation.pivot(name,location,parent))
    def attach(self,objects,parent):
        if isinstance(objects,bpy.types.Object):objects=[objects]
        articulation.attach(objects,parent);return objects
    def mesh(self,name,verts,faces,matKey):
        data=bpy.data.meshes.new(name+'_mesh');data.from_pydata(verts,[],faces);data.update()
        bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
        obj=bpy.data.objects.new(name,data);self.collection.objects.link(obj)
        if matKey:obj.data.materials.append(self.m[matKey])
        obj['part']=name;self.objects.append(obj);return obj
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
    def box(self,name,center,size,matKey,bevel=.008):
        bpy.ops.mesh.primitive_cube_add(size=1,location=center)
        obj=self.relocate(bpy.context.object);obj.name=name;obj.scale=size
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        obj.data.materials.append(self.m[matKey]);obj['part']=name;self.objects.append(obj)
        if bevel:
            mod=obj.modifiers.new('Single measured edge bevel','BEVEL');mod.width=bevel;mod.segments=1
        return obj
    def hood(self):
        outer=[(0,.075,1.80),(.195,.145,1.715),(.283,.015,1.47),(.220,.080,1.335),(0,.160,1.302),(-.220,.080,1.335),(-.283,.015,1.47),(-.195,.145,1.715)]
        inner=[(0,.205,1.665),(.129,.219,1.615),(.170,.120,1.472),(.122,.180,1.356),(0,.210,1.323),(-.122,.180,1.356),(-.170,.120,1.472),(-.129,.219,1.615)]
        outer=[(x*.89,y,z) for x,y,z in outer]
        back=[(0,-.174,1.720),(.157,-.205,1.655),(.232,-.237,1.476),(.164,-.206,1.358),(0,-.197,1.328),(-.164,-.206,1.358),(-.232,-.237,1.476),(-.157,-.205,1.655)]
        cavity=[(x*.84,-.174,z+.016) for x,y,z in inner]
        verts=outer+back+inner+cavity+[(0,-.280,1.521)];faces=[]
        for i in range(8):
            j=(i+1)%8
            faces.extend([(i,j,8+j,8+i),(i,16+i,16+j,j),(16+i,24+i,24+j,16+j)])
        faces.extend([(8+i,8+(i+1)%8,32) for i in range(8)])
        faces.append(tuple(reversed(range(24,32))))
        self.attach(self.mesh('Pointed_Open_Hood_Shell',verts,faces,'blue'),self.head)
    def cape_shell(self,name,hem=.48,spread=.36,rear=-.45,tips='one',material='blue'):
        # Physical open-front U section. Both profiles see actual cloth area,
        # rather than only the edge of a flat plate behind the back.
        sec=[(-1,.15),(-1,-.33),(-.7,-.83),(0,-1),(.7,-.83),(1,-.33),(1,.15)]
        weights={'one':[.06,.045,.02,0,.02,.045,.06],
                 'two':[.10,.04,0,.17,0,.04,.10],
                 'three':[.12,0,.12,0,.12,0,.12]}[tips]
        vertices=[]
        for row,(z,w,d) in enumerate([(1.255,.244,.171),(.88,.28,.31),(hem,spread,abs(rear))]):
            vertices += [(x*w,y*d,z+(weights[i] if row==2 else 0)) for i,(x,y) in enumerate(sec)]
        faces=[(r*7+i,r*7+i+1,(r+1)*7+i+1,(r+1)*7+i) for r in range(2) for i in range(6)]
        obj=self.mesh(name,vertices,faces,material)
        solid=obj.modifiers.new('Actual wrapped cloth thickness','SOLIDIFY');solid.thickness=.018
        self.attach(obj,self.torso);return obj
    def body(self,hood=True,mantle=True,cape='short',robe=False,dwarf=False,keep_equipment=False):
        self.dwarf=dwarf
        self.attach(self.rings('Angular_Face',[(0,.146,1.332,.032,.055),(0,.151,1.39,.099,.105),(0,.151,1.525,.126,.132),(0,.110,1.635,.108,.115),(0,.071,1.682,.049,.065)],'skin'),self.head)
        for s in (-1,1):
            eye=self.panel('Dark_Eye_'+str(s),[(s*(.056+.014*math.cos(i*math.tau/6)),.300,1.523+.020*math.sin(i*math.tau/6)) for i in range(6)],.030,'eyes')
            self.attach(eye,self.head)
        if hood:
            # A real cut-back cheek aperture reveals the profile. Keep the
            # face inside the hood instead of pushing it beyond its rim.
            for obj in self.objects:
                if obj.get('part')=='Angular_Face' or str(obj.get('part','')).startswith('Dark_Eye_'):
                    for vertex in obj.data.vertices:vertex.co.y-=.040
        self.attach(self.rings('Small_Neck',[(0,.003,1.24,.057,.060),(0,.009,1.405,.057,.061)],'skin'),self.head)
        self.attach(self.rings('Continuous_Tunic_Bodice',[(0,0,.845,.164,.115),(0,-.003,1.14,.198,.125),(0,-.018,1.257,.192,.105),(0,0,1.305,.093,.075)],'blue'),self.torso)
        for s in (-1,1):
            self.attach(self.limb('Trouser_'+str(s),[(s*.104,-.004,.79,.068,.078),(s*.189,-.010,.39,.078,.083)],'trousers'),self.root)
            self.attach(self.rings('Boot_'+str(s),[(s*.190,.047,0,.080,.145),(s*.190,.057,.065,.086,.154),(s*.190,.010,.143,.063,.081),(s*.190,-.008,.348,.067,.080)],'boots'),self.root)
            self.attach(self.rings('Boot_Cuff_'+str(s),[(s*.190,-.008,.336,.080,.095),(s*.190,-.008,.371,.080,.095)],'boots'),self.root)
        if robe:
            self.attach(self.rings('Continuous_Long_Robe',[(0,0,.873,.167,.120),(0,-.005,.46,.267,.157),(0,-.012,.21,.320,.174)],'blue'),self.torso)
        else:
            # Back and side panels of a true split garment; front has two tails.
            sec=[(-.66,1),(.66,1),(1,.5),(1,-.54),(.66,-1),(-.66,-1),(-1,-.54),(-1,.5)]
            verts=[(sx*r,sy*d,z) for r,d,z in [(.17,.12,.872),(.267,.145,.504)] for sx,sy in sec]
            faces=[(i,(i+1)%8,8+(i+1)%8,8+i) for i in range(1,8)]
            obj=self.mesh('Continuous_Split_Tunic_Skirt',verts,faces,'blue')
            solid=obj.modifiers.new('Actual cloth thickness','SOLIDIFY');solid.thickness=.018
            self.attach(obj,self.torso)
            for s in (-1,1):
                outline=[(0,.121,.872),(s*.113,.122,.872),(s*.178,.146,.504),(s*.025,.150,.503)]
                self.attach(self.panel('Split_Tunic_Front_'+str(s),outline,.020,'blue'),self.torso)
        self.attach(self.rings('Waist_Belt',[(0,0,.847,.174,.128),(0,0,.902,.174,.128)],'belt'),self.torso)
        self.attach(self.box('Waist_Buckle',(0,.136,.875),(.068,.026,.049),'buckle',.004),self.torso)
        if hood:self.hood()
        if mantle:
            self.attach(self.rings('Continuous_Shoulder_Mantle',[(0,0,1.31,.109,.095),(0,-.003,1.25,.238,.150),(0,.001,1.185,.283,.175)],'blue'),self.torso)
        if cape:
            hem=.24 if cape=='long' else .48
            spread=.43 if cape=='long' else .36
            rear=-.54 if cape=='long' else -.45
            self.cape_shell('Broad_Pointed_Back_Cape',hem,spread,rear)
        return self.objects
    def arm(self,side,elbow,hand,metal=False):
        sign=-1 if side=='left' else 1;shoulder=(sign*.245,0,1.25)
        upper,lower,wrist,weapon=articulation.limb(shoulder,elbow,hand)
        for joint in (upper,lower,wrist,weapon):self.relocate(joint)
        self.attach(upper,self.torso);self.upper[side]=upper;self.hand[side]=wrist;self.weapon[side]=weapon
        a=Vector(shoulder);e=Vector(elbow);h=Vector(hand)
        self.attach(self.limb(side+'_upper_sleeve',[(*a,.068,.073),(*e,.062,.067)],'trousers'),upper)
        split=e.lerp(h,.28)
        self.attach(self.limb(side+'_lower_sleeve',[(*e,.062,.063),(*split,.061,.061)],'trousers'),lower)
        self.attach(self.limb(side+'_bracer',[(*split,.073,.070),(*h,.059,.059)],'steel' if metal else 'boots'),lower)
        tip=h+(h-e).normalized()*.072
        self.attach(self.limb(side+'_glove_mitten',[(*h,.064,.063),(*tip,.061,.061)],'boots'),wrist)
        return upper,lower,wrist,weapon
    def focus(self,location,parent=None):
        parent=parent or self.weapon.get('right') or self.torso
        self.pivot('staff_tip',location,parent);self.pivot('attack_muzzle',location,parent)
    def finish(self,equipment):
        for obj in list(self.collection.objects):
            if obj is not self.root and obj.parent is None:self.attach(obj,self.root)
        if self.dwarf:self.root.scale=(1.17,1.05,.87)
        self.root['assetRevision']='hooded-turnarounds-v3';self.root['family']=self.family;self.root['tier']=self.rank
        self.root['rankColor']=['#3989ed','#3eac63','#9555d8','#eee9db','#e7b43f','#ffd969'][self.rank-1]
        self.root['equipment']=equipment
        return self.root
