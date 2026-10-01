"""Native Blender data primitives for large editable scenery scenes.

Avoid thousands of context operators and per-piece dependency graph updates;
the final exporter evaluates the same mesh objects once before material batching.
"""
import bpy,bmesh,math
from mathutils import Vector

def install(S):
    spheres={}
    def mesh(name,vertices,faces,material,smooth=False):
        data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.update();data.materials.append(S.P[material])
        if smooth:
            for face in data.polygons:face.use_smooth=True
        obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);return obj
    def box(name,pos,size,mat='stone',bevel=0):
        x,y,z=(v/2 for v in size)
        vertices=[(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)]
        obj=mesh(name,vertices,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat)
        if bevel:
            bm=bmesh.new();bm.from_mesh(obj.data)
            bmesh.ops.bevel(bm,geom=list(bm.edges),offset=min(bevel,min(size)*.24),segments=2,affect='EDGES')
            bm.to_mesh(obj.data);bm.free();obj.data.update()
        obj.location=pos;return obj
    def cyl(name,pos,radius,height,mat='stone',sides=12,top=None):
        top=radius if top is None else top;n=sides
        vertices=[(math.cos(i*math.tau/n)*radius,math.sin(i*math.tau/n)*radius,-height/2)for i in range(n)]
        if top:
            vertices +=[(math.cos(i*math.tau/n)*top,math.sin(i*math.tau/n)*top,height/2)for i in range(n)]
            faces=[(i,(i+1)%n,(i+1)%n+n,i+n)for i in range(n)]+[tuple(reversed(range(n))),tuple(range(n,2*n))]
        else:
            vertices.append((0,0,height/2));faces=[(i,(i+1)%n,n)for i in range(n)]+[tuple(reversed(range(n)))]
        obj=mesh(name,vertices,faces,mat);obj.location=pos;return obj
    def beam(name,start,end,radius=.05,mat='wood',sides=6):
        a,b=Vector(start),Vector(end);obj=cyl(name,(a+b)*.5,radius,(b-a).length,mat,sides)
        obj.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return obj
    def orb(name,pos,size,mat='bone'):
        key=S.P[mat].name
        if key not in spheres:
            n=8;rings=4;v=[(0,0,1)]
            for row in range(1,rings):
                phi=math.pi*row/rings
                v +=[(math.sin(phi)*math.cos(i*math.tau/n),math.sin(phi)*math.sin(i*math.tau/n),math.cos(phi))for i in range(n)]
            bottom=len(v);v.append((0,0,-1));f=[(0,1+i,1+(i+1)%n)for i in range(n)]
            for row in range(rings-2):
                a=1+row*n;b=a+n
                f +=[(a+i,b+i,b+(i+1)%n,a+(i+1)%n)for i in range(n)]
            last=1+(rings-2)*n;f +=[(last+i,bottom,last+(i+1)%n)for i in range(n)]
            original=mesh(name,v,f,mat,True);spheres[key]=original.data
            obj=original
        else:obj=bpy.data.objects.new(name,spheres[key]);bpy.context.collection.objects.link(obj)
        obj.location=pos;obj.scale=size;return obj
    S.box=box;S.cyl=cyl;S.beam=beam;S.orb=orb
