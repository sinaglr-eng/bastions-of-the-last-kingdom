"""Shared physical faceted construction and export checks for geometric game v1.

All coordinates are meters, +Y front, +X anatomical right, Z up.
Rigid named joints preserve world transforms; geometry is unchanged by camera.
"""
import bpy,bmesh,math,json,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

def linear(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4

class Builder:
 def __init__(self,asset_id,palette):
  self.id=asset_id;self.palette=palette;self.objects=[];self.coverage=[]
  self.coll=bpy.data.collections.new('MODEL '+asset_id);bpy.context.scene.collection.children.link(self.coll)
  self.root=self.pivot(asset_id,(0,0,0),False);self.root['assetRevision']='geometric-game-v1';self.root['geometricRig']=True
  self.M={}
  for key,color in palette.items():
   color=color.lstrip('#');rgba=tuple(linear(int(color[i:i+2],16)/255) for i in (0,2,4))+(1,)
   m=bpy.data.materials.new(key);m.use_nodes=True;m.diffuse_color=rgba;m['source_srgb']='#'+color
   sh=m.node_tree.nodes.get('Principled BSDF');sh.inputs['Base Color'].default_value=rgba;sh.inputs['Roughness'].default_value=.68;sh.inputs['Metallic'].default_value=.25 if any(k in key.lower() for k in ('steel','gold','metal')) else 0
   self.M[key]=m
 def pivot(self,name,pos,parent=None):
  ob=bpy.data.objects.new(name,None);self.coll.objects.link(ob);ob.location=pos;ob.empty_display_size=.04
  if parent is not False:self.attach(ob,parent or getattr(self,'root',None))
  return ob
 def attach(self,ob,parent):
  if not parent:return ob
  bpy.context.view_layer.update();mat=ob.matrix_world.copy();ob.parent=parent;ob.matrix_world=mat;return ob
 def mesh(self,name,verts,faces,mat,parent=None):
  d=bpy.data.meshes.new(name+' mesh');d.from_pydata(verts,[],faces);d.update()
  bm=bmesh.new();bm.from_mesh(d);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(d);bm.free()
  ob=bpy.data.objects.new(name,d);self.coll.objects.link(ob);self.objects.append(ob)
  mats=mat if isinstance(mat,list) else [mat]
  for key in mats:d.materials.append(self.M[key])
  for i,p in enumerate(d.polygons):p.material_index=(0 if i%5 else 1)%len(mats);p.use_smooth=False
  ob['semanticPart']=name;return self.attach(ob,parent or self.root)
 def loft(self,name,rings,mat,parent=None):
  n=len(rings[0]);assert all(len(r)==n for r in rings)
  vs=[p for r in rings for p in r];fs=[tuple(reversed(range(n))),tuple((len(rings)-1)*n+i for i in range(n))]
  fs += [(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(rings)-1) for i in range(n)]
  return self.mesh(name,vs,fs,mat,parent)
 def ring(self,cx,cy,z,rx,ry,n=8):return [(cx+rx*math.sin(i*math.tau/n),cy+ry*math.cos(i*math.tau/n),z) for i in range(n)]
 def chamfer(self,x,y,z,w,d,q):return [(x-w/2+q,y+d/2,z),(x+w/2-q,y+d/2,z),(x+w/2,y+d/2-q,z),(x+w/2,y-d/2+q,z),(x+w/2-q,y-d/2,z),(x-w/2+q,y-d/2,z),(x-w/2,y-d/2+q,z),(x-w/2,y+d/2-q,z)]
 def box(self,name,center,size,mat,bevel=.02,parent=None):
  x,y,z=center;w,d,h=size;q=min(bevel,w*.19,d*.19,h*.19)
  return self.loft(name,[self.chamfer(x,y,z-h/2,w-2*q,d-2*q,q*.5),self.chamfer(x,y,z-h/2+q,w,d,q),self.chamfer(x,y,z+h/2-q,w,d,q),self.chamfer(x,y,z+h/2,w-2*q,d-2*q,q*.5)],mat,parent)
 def limb(self,name,points,radii,mat,parent=None,n=8):
  points=[Vector(p) for p in points];rings=[]
  for j,(p,r) in enumerate(zip(points,radii)):
   d=(points[min(j+1,len(points)-1)]-points[max(0,j-1)]).normalized();seed=Vector((0,1,0)) if abs(d.y)<.95 else Vector((1,0,0));u=d.cross(seed).normalized();v=d.cross(u)
   rx,ry=r if isinstance(r,(list,tuple)) else (r,r)
   rings.append([tuple(p+u*math.cos(i*math.tau/n)*rx+v*math.sin(i*math.tau/n)*ry) for i in range(n)])
  return self.loft(name,rings,mat,parent)
 def rod(self,name,a,b,r,mat,parent=None,n=8):return self.limb(name,[a,b],[r,r],mat,parent,n)
 def panel(self,name,outline,thickness,mat,parent=None,relief=0):
  n=len(outline);normal=(Vector(outline[1])-Vector(outline[0])).cross(Vector(outline[2])-Vector(outline[0])).normalized()
  if normal.y<0:normal=-normal
  assert normal.length>.5,(name,'collinear panel')
  vs=list(outline)+[tuple(Vector(p)-normal*thickness) for p in outline]
  if relief:
   c=Vector(tuple(sum(p[k] for p in outline)/n for k in range(3)));vs.append(tuple(c+normal*relief));fs=[(i,(i+1)%n,n*2) for i in range(n)]
  else:fs=[tuple(range(n))]
  fs+=[tuple(reversed(range(n,2*n)))]+[(i,n+i,n+(i+1)%n,(i+1)%n) for i in range(n)]
  return self.mesh(name,vs,fs,mat,parent)
 def jewel(self,name,center,rx,rz,depth,mat,parent=None):
  x,y,z=center;vs=[(x,y,z+rz),(x+rx,y,z),(x,y,z-rz),(x-rx,y,z),(x,y+depth,z),(x,y-depth,z)]
  return self.mesh(name,vs,[(i,(i+1)%4,4) for i in range(4)]+[(i,5,(i+1)%4) for i in range(4)],mat,parent)
 def hood(self,name,center,width,height,depth,mat,parent=None,aperture=None,side_cutback=0):
  """Closed thick hood with a genuine front aperture and wrapped back.

  Faces must be explicitly constructed inside aperture limits. No hidden full
  scalp is generated; protected side/top skull sections cannot leak through.
  """
  x,y,z=center;w=width/2;h=height/2;front=y+depth/2;rear=y-depth/2
  sec=[(0,h),(.70*w,.72*h),(w,.30*h),(w,-.58*h),(.73*w,-h),(-.73*w,-h),(-w,-.58*h),(-w,.30*h),(-.70*w,.72*h)]
  outer=[(x+xx,front,z+zz) for xx,zz in sec];back=[(x+xx*.93,rear,z+zz*.91) for xx,zz in sec]
  inner=aperture or [(x+xx*.73,front+.006,z+zz*.68-.035) for xx,zz in sec];assert len(inner)==len(sec)
  # Source profiles expose the front cheek through a cut-back side opening.
  # The protected rear face remains deeper than this rim in head-local space.
  if side_cutback:
   for i in (2,3,6,7):
    outer[i]=(outer[i][0],outer[i][1]-side_cutback,outer[i][2]);inner[i]=(inner[i][0],inner[i][1]-side_cutback,inner[i][2])
  cavity=[(xx,rear+.024,zz) for xx,yy,zz in inner]
  n=len(sec);vs=outer+back+inner+cavity+[(x,rear-.01,z)];fs=[]
  for i in range(n):
   j=(i+1)%n;fs.extend([(i,j,n+j,n+i),(i,2*n+i,2*n+j,j),(2*n+i,3*n+i,3*n+j,2*n+j),(n+i,n+j,4*n)])
  fs.append(tuple(reversed(range(3*n,4*n))))
  ob=self.mesh(name,vs,fs,mat,parent);self.coverage.append({'shell':name,'type':'hood','front':front,'rear':rear,'apertureWidth':max(p[0] for p in inner)-min(p[0] for p in inner),'apertureHeight':max(p[2] for p in inner)-min(p[2] for p in inner),'sideCutbackM':side_cutback,'center':center,'rule':'Only observed face in aperture; full hidden scalp omitted'})
  return ob

def geometry_digest(objects):
 return hashlib.sha256(json.dumps([(o.name,[list(v.co) for v in o.data.vertices],[list(p.vertices) for p in o.data.polygons]) for o in sorted(objects,key=lambda o:o.name)],separators=(',',':')).encode()).hexdigest()

def head_coverage(skin, covers, closed=False):
 """Cast protected side/top/rear rays from skin vertices, in shared head space.

 Front face and chin are intentionally visible. All tested directions are
 outward from the deeper head surfaces, never through its front aperture.
 Head and coverings must share the same rigid parent, including pose tests.
 """
 if closed:
  return {'passed':not skin,'testedRays':0,'leaks':[],'method':'Closed helmet has no hidden skin/scalp mesh'}
 bpy.context.view_layer.update();verts=[];faces=[]
 for ob in covers:
  off=len(verts);verts += [ob.matrix_world@v.co for v in ob.data.vertices];faces += [tuple(off+i for i in p.vertices) for p in ob.data.polygons]
 tree=BVHTree.FromPolygons(verts,faces,all_triangles=False);leaks=[];tested=0
 for ob in skin:
  pts=[ob.matrix_world@v.co for v in ob.data.vertices];cy=sum(p.y for p in pts)/len(pts);cx=sum(p.x for p in pts)/len(pts);cz=sum(p.z for p in pts)/len(pts)
  for p in pts:
   # Protect the hidden back half of head. Front/chin are aperture geometry.
   if p.y>cy+.002:continue
   dirs=[Vector((0,-1,0))]
   if p.z>=cz:dirs.append(Vector((0,0,1)))
   if abs(p.x-cx)>.01:dirs.append(Vector((1 if p.x>cx else -1,0,0)))
   for direction in dirs:
    tested+=1;hit=tree.ray_cast(p+direction*.00001,direction,2)
    if hit[0] is None:leaks.append({'part':ob.name,'vertex':list(p),'direction':list(direction)})
 parents={o.parent for o in skin+covers};same=len(parents)==1
 return {'passed':not leaks and same,'testedRays':tested,'leaks':leaks,'sharedHeadPivot':same,'method':'BVH outward rays from hidden half, side/top/rear; front aperture exempt'}

def metrics(objects):
 bpy.context.view_layer.update();points=[];tris=0;bad=[];open_edges=0;volumes={}
 for ob in objects:
  if ob.type!='MESH':continue
  m=ob.data;m.calc_loop_triangles();tris+=len(m.loop_triangles);points.extend(ob.matrix_world@v.co for v in m.vertices)
  bm=bmesh.new();bm.from_mesh(m);open_edges+=sum(len(e.link_faces)!=2 for e in bm.edges);bm.free()
  for tri in m.loop_triangles:
   a,b,c=[m.vertices[i].co for i in tri.vertices]
   if (b-a).cross(c-a).length<1e-10:bad.append(ob.name)
  volumes[ob.name]=sum(m.vertices[t.vertices[0]].co.dot(m.vertices[t.vertices[1]].co.cross(m.vertices[t.vertices[2]].co))/6 for t in m.loop_triangles)
 assert points and all(math.isfinite(c) for p in points for c in p)
 lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)]
 return {'triangles':tris,'boundsMin':lo,'boundsMax':hi,'boundsSize':[hi[i]-lo[i] for i in range(3)],'degenerateTriangles':len(bad),'degenerateParts':sorted(set(bad)),'nonManifoldEdges':open_edges,'meshSignedVolumesM3':volumes,'meshes':sum(o.type=='MESH' for o in objects)}

def export_and_check(b,path):
 path=Path(path);path.parent.mkdir(parents=True,exist_ok=True);native=metrics(b.objects);assert native['degenerateTriangles']==0,(b.id,native)
 bpy.ops.object.select_all(action='DESELECT')
 for o in b.coll.all_objects:o.select_set(True)
 bpy.context.view_layer.objects.active=b.root
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False,export_animations=False,export_apply=True)
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(path));imported=[o for o in bpy.data.objects if o not in before];actual=metrics(imported)
 error=max(abs(native[k][i]-actual[k][i]) for k in ('boundsMin','boundsMax') for i in range(3));assert error<1e-5,(b.id,error)
 assert native['triangles']==actual['triangles'] and actual['degenerateTriangles']==0
 names={o.name.split('.')[0] for o in imported};assert b.root.name in names
 for o in imported:bpy.data.objects.remove(o,do_unlink=True)
 return {**native,'roundtripBoundsError':error,'roundtripTriangles':actual['triangles'],'fileSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'geometrySha256':geometry_digest(b.objects),'namedPivots':[o.name for o in b.coll.objects if o.type=='EMPTY'],'coverage':b.coverage}

def studio(objects,resolution=(300,360)):
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True;scene.render.threads_mode='FIXED';scene.render.threads=4
 scene.render.resolution_x,scene.render.resolution_y=resolution;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.film_transparent=True
 scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
 world=bpy.data.worlds.new('Ivory studio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65;scene.world=world
 box=metrics(objects);center=Vector([(box['boundsMin'][i]+box['boundsMax'][i])/2 for i in range(3)]);scale=max(box['boundsSize'][2]*1.22,box['boundsSize'][0]*resolution[1]/resolution[0]*1.20)
 data=bpy.data.cameras.new('Review camera');data.type='ORTHO';data.ortho_scale=scale;cam=bpy.data.objects.new('Review camera',data);scene.collection.objects.link(cam);scene.camera=cam
 for name,pos,energy,size in [('Key',(-3,4,5),380,4),('Fill',(3,2,4),180,3),('Rim',(1,-4,5),230,3)]:
  d=bpy.data.lights.new(name,'AREA');d.energy=energy;d.size=size;ob=bpy.data.objects.new(name,d);scene.collection.objects.link(ob);ob.location=pos;ob.rotation_euler=(center-ob.location).to_track_quat('-Z','Y').to_euler()
 return cam,center

def render_views(b,dest,resolution=(300,360)):
 dest=Path(dest);dest.mkdir(parents=True,exist_ok=True);cam,target=studio(b.objects,resolution);digest=geometry_digest(b.objects);rows=[]
 for name,az in [('front',0),('back',180),('left',-90),('right',90),('three-quarter-front',35),('three-quarter-back',145)]:
  a=math.radians(az);e=math.radians(12);cam.location=target+Vector((8*math.sin(a)*math.cos(e),8*math.cos(a)*math.cos(e),8*math.sin(e)));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();bpy.context.scene.render.filepath=str(dest/(name+'.png'));assert digest==geometry_digest(b.objects);bpy.ops.render.render(write_still=True);rows.append({'view':name,'geometrySha256':digest,'path':str(dest/(name+'.png'))})
 return rows
