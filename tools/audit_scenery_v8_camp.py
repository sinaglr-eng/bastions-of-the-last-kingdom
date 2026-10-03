"""Read-only audit of native V8 tent geometry and its actual GLB export."""
import bpy,json,hashlib,math,itertools
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
CONFIG=json.loads((ROOT/'data/scenery-v8-camp.json').read_text())
LANES=[(a,b) for lane in CONFIG['lanes'] for a,b in zip(lane,lane[1:])]
OUT=ROOT/'output/design/geometric-game-v5';OUT.mkdir(parents=True,exist_ok=True)
PREFIXES=[f'Outlying clan tent {i} ' for i in range(8)]+[f'Clan hide pavilion {i} ' for i in range(14)]
ADDED=('Inner camp tree ','Covered split-log stack ','Clan weapons store ','Quartermaster supply cart ')
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def points(o):return [o.matrix_world@v.co for v in o.data.vertices]
def signature(o):
    return hashlib.sha256(json.dumps([[[round(v,6) for v in p] for p in points(o)],[list(face.vertices) for face in o.data.polygons]],separators=(',',':')).encode()).hexdigest()
def point_distance(p,a,b):
    dx,dy=b[0]-a[0],b[1]-a[1];t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)))
    return math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t)
def clearance(box):
    lo,hi,bottom,top=box;best=math.inf
    for a,b in LANES:
        t0,t1=0,1
        for origin,end,mn,mx in [(a[0],b[0],lo,hi),(a[1],b[1],bottom,top)]:
            if abs(end-origin)<1e-12:
                if not mn<=origin<=mx:t0,t1=1,0;break
            else:
                low,high=sorted(((mn-origin)/(end-origin),(mx-origin)/(end-origin)));t0=max(t0,low);t1=min(t1,high)
        if t0<=t1:return -CONFIG['laneWidth']/2
        best=min(best,*[point_distance(p,a,b) for p in [(lo,bottom),(lo,top),(hi,bottom),(hi,top)]],*[math.hypot(max(lo-p[0],0,p[0]-hi),max(bottom-p[1],0,p[1]-top)) for p in [a,b]])
    return best-CONFIG['laneWidth']/2

bpy.ops.wm.open_mainfile(filepath=str(ROOT/'blender/scenes/fortified-warcamp-v6.blend'))
protected={o.name:signature(o) for o in bpy.context.scene.objects if o.type=='MESH' and not o.name.startswith(tuple(PREFIXES))}
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'blender/scenes/fortified-warcamp-v8.blend'))
for name,sha in protected.items():assert signature(bpy.context.scene.objects[name])==sha,'Inherited geometry changed: '+name
native_points=[];records=[]
for prefix in PREFIXES:
    parts=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith(prefix)];assert parts,prefix
    vertices=[p for o in parts for p in points(o)];native_points.extend(vertices)
    box=[min(p.x for p in vertices),max(p.x for p in vertices),min(p.y for p in vertices),max(p.y for p in vertices)]
    gap=clearance(box);assert gap>=.22-1e-7,(prefix,gap)
    records.append(dict(name=prefix.strip(),vertices=len(vertices),bounds=box,clearance=gap))
for o in bpy.context.scene.objects:
    if o.type=='MESH' and o.name.startswith(ADDED):native_points.extend(points(o))
scene=bpy.context.scene;scene.cycles.samples=16;scene.render.resolution_x=1440;scene.render.resolution_y=1080
for name,position,target,scale in [('warcamp-walkways-v8',(33,-49,52),(-14,-7,1),47),('warcamp-stores-v8',(19,-35,29),(-15,-9,1),33)]:
    scene.camera.location=position;scene.camera.rotation_euler=(Vector(target)-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.camera.data.ortho_scale=scale
    scene.render.filepath=str(ROOT/'blender/renders'/(name+'.png'));bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/assets/scenery/fortified-warcamp-v8.glb'))
bins={};size=.0001
for o in bpy.context.scene.objects:
    if o.type=='MESH':
        for p in points(o):bins.setdefault(tuple(math.floor(v/size) for v in p),[]).append(p)
for p in native_points:
    key=tuple(math.floor(v/size) for v in p)
    assert any((q-p).length<size for delta in itertools.product([-1,0,1],repeat=3) for q in bins.get(tuple(a+b for a,b in zip(key,delta)),[])),'Native source vertex missing from runtime export'
report=dict(status='pass',nativeReadOnly=True,protectedOriginalMeshes=len(protected),tentAssemblies=records,sourceVerticesMatchedToActualExport=len(native_points),nativeSHA=digest(ROOT/'blender/scenes/fortified-warcamp-v8.blend'),glbSHA=digest(ROOT/'public/assets/scenery/fortified-warcamp-v8.glb'),views=['blender/renders/warcamp-walkways-v8.png','blender/renders/warcamp-stores-v8.png'])
(OUT/'camp-native-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print('CAMP NATIVE PASS',len(protected),'protected meshes,',len(records),'full tent assemblies,',len(native_points),'source vertices matched to export')
