"""Narrow the actual Dust Dancer leg surfaces and native joints together.

The V6 source and original six-view reference remain immutable. New authoring
is saved separately; only host_09's production export and portrait are replaced.
"""
import bpy,sys,json,hashlib,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).parent))
from author_enemy_humanoid_sources_v6 import adapter
from geometric_game_common import metrics,export_and_check,render_views
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
baseline=ROOT/'blender/scenes/geometric-game-v6/enemies/host_09.blend'
manifest=ROOT/'public/assets/geometric/geometric-enemies.json'
out=ROOT/'output/design/battlefield-effects-v9';out.mkdir(parents=True,exist_ok=True)
mf=json.loads(manifest.read_text(encoding='utf8'));row=next(r for r in mf['entries']if r['id']=='host_09')
source=ROOT/'public/geometric-turnarounds-v1/enemies/host_09.png'
baseline_hash=sha(baseline);source_hash=sha(source)
bpy.ops.wm.open_mainfile(filepath=str(baseline));b=adapter('host_09');before=metrics(b.objects)
changes=[]
def depth(ob):
    n=0
    while ob.parent:n+=1;ob=ob.parent
    return n
for side,sign in [('L',-1),('R',1)]:
    hip=bpy.data.objects['upper_leg_'+side]
    knee=bpy.data.objects['shin_'+side];foot=bpy.data.objects['foot_'+side]
    hip_z=hip.matrix_world.translation.z;knee_z=knee.matrix_world.translation.z;foot_z=foot.matrix_world.translation.z
    old_foot=foot.matrix_world.translation.copy()
    # Keep hip bearings in the pelvis. Translate each closed cross-section
    # uniformly, including matching knee interfaces, rather than scaling feet.
    def offset(p):
        z=p.z
        amount=0 if z>=hip_z else .0555*(hip_z-z)/(hip_z-knee_z) if z>=knee_z else .0555+(.1496-.0555)*(knee_z-z)/(knee_z-foot_z) if z>=foot_z else .1496
        return Vector((-sign*amount,0,0))
    nodes=[hip,*hip.children_recursive]
    matrices={ob:ob.matrix_world.copy() for ob in nodes}
    vertices={ob:[ob.matrix_world@v.co+offset(ob.matrix_world@v.co)for v in ob.data.vertices]for ob in nodes if ob.type=='MESH'}
    for ob in sorted(nodes,key=depth):
        matrix=matrices[ob].copy();matrix.translation+=offset(matrix.translation);ob.matrix_world=matrix
        bpy.context.view_layer.update()
    for ob,points in vertices.items():
        inv=ob.matrix_world.inverted()
        for vertex,point in zip(ob.data.vertices,points):vertex.co=inv@point
        ob.data.update()
    bpy.context.view_layer.update()
    changes.append({'side':side,'hipBeforeM':list(matrices[hip].translation),'hipAfterM':list(hip.matrix_world.translation),'ankleBeforeM':list(old_foot),'ankleAfterM':list(foot.matrix_world.translation),'wholeLegSurfacesAndAllJointsRefitted':True})
b.root['dustDancerStanceV7']=json.dumps({'revision':'geometric-game-v7','baselineNativeSha256':baseline_hash,'changes':changes})
b.root['assetRevision']='geometric-game-v7'
after=metrics(b.objects);assert not after['nonManifoldEdges']and not after['degenerateTriangles']
assert abs(after['boundsMin'][2]-before['boundsMin'][2])<1e-6
assert abs(after['boundsSize'][2]-before['boundsSize'][2])<1e-6
q=export_and_check(b,ROOT/'public/assets/geometric/enemies/host_09.glb')
views=render_views(b,out/'host_09-six-views',(320,368))
portrait=ROOT/'public/assets/geometric/portraits/host_09.png'
portrait.write_bytes((out/'host_09-six-views/three-quarter-front.png').read_bytes())
native=ROOT/'blender/scenes/geometric-game-v7/enemies/host_09.blend';native.parent.mkdir(parents=True,exist_ok=True)
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(native))
row['qa'].update(q);row['native']=native.relative_to(ROOT).as_posix();row['sourceRepairRevision']='geometric-game-v7';row['stanceRevision']='geometric-game-v7'
row['views']=[{**v,'path':Path(v['path']).relative_to(ROOT).as_posix(),'sha256':sha(Path(v['path']))}for v in views]
manifest.write_text(json.dumps(mf,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
assert sha(baseline)==baseline_hash and sha(source)==source_hash
proof={'id':'host_09','baselineNativeSha256':baseline_hash,'originalSourceSha256':source_hash,'oldSourceAndOriginalPixelsPreserved':True,'baselineBounds':before,'finalBounds':after,'changes':changes,'newNative':str(native),'newNativeSha256':sha(native),'exportSha256':q['fileSha256'],'roundtripBoundsError':q['roundtripBoundsError'],'views':row['views']}
(out/'dust-dancer-source-proof.json').write_text(json.dumps(proof,indent=2)+'\n',encoding='utf8')
print('DUST_DANCER_V7_COMPLETE',flush=True)
