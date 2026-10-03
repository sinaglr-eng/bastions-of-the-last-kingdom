"""Read-only physical triangle regressions for the 0.3.4 champion overrides.

This checks actual native shell topology, ray intersections and limb seams,
including negative controls. It does not accept semantic metadata as proof.
"""
import bpy,bmesh,json,hashlib,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'blender/scripts'))
from geometric_champion_shapes_v5 import tree
from geometric_champion_creature_fit_v4 import descendants,semantic,points
from geometric_game_common import metrics,geometry_digest

def components(ob):
 bm=bmesh.new();bm.from_mesh(ob.data);pending=set(bm.verts);n=0
 while pending:
  n+=1;todo=[pending.pop()]
  while todo:
   v=todo.pop()
   for e in v.link_edges:
    other=e.other_vert(v)
    if other in pending:pending.remove(other);todo.append(other)
 bm.free();return n

def main():
 entries=json.loads((ROOT/'public/assets/geometric/geometric-champions.json').read_text())['entries']
 rows=[]
 for entry in entries:
  aid=entry['id']
  if aid not in ('frostblade','highking','crownofages','thunderheart','phoenix','mothernature','archbishop','archangel','ladyclaire'):continue
  old_shield=None
  if aid=='crownofages':
   bpy.ops.wm.open_mainfile(filepath=str(ROOT/'blender/scenes/geometric-game-v1/champions/crownofages.blend'))
   old=next(o for o in bpy.data.objects if semantic(o)=='Shield real back and rim')
   old_shield=metrics([old])['boundsSize']
  native=ROOT/entry['native'];initial=hashlib.sha256(native.read_bytes()).hexdigest()
  bpy.ops.wm.open_mainfile(filepath=str(native));root=bpy.data.objects[aid]
  objects=[o for o in root.children_recursive if o.type=='MESH'];before=geometry_digest(objects);checks={}
  actual=metrics(objects);assert actual['nonManifoldEdges']==0 and actual['degenerateTriangles']==0
  assert actual['triangles']==entry['qa']['triangles']
  if aid in ('frostblade','highking'):
   shells=[o for o in objects if o.get('singleContinuousHelmetV5')]
   assert len(shells)==1 and components(shells[0])==1,(aid,'one physically connected helmet')
   shell=shells[0];front=tree([shell]);slits=[o for o in objects if semantic(o).startswith('Helmet V5 shadow inside actual')]
   fit=json.loads(root['humanoidHeadFitDetailsV4'])
   assert any(semantic(shell)in item.get('bearingParts',[])for item in fit),(aid,'retained actual head seat contract binds replacement helmet')
   assert len(slits)==2
   openings=[]
   for slit in slits:
    p=sum(points(slit),Vector())/len(slit.data.vertices)
    # Along each eye centre the first helmet surface is the interior/rear
    # wall, unlike an opaque faceplate covering a fake dark square.
    hit=front.ray_cast(Vector((p.x,.65,p.z)),Vector((0,-1,0)),2)
    assert hit[0] is not None and hit[0].y<p.y-.02,(aid,'true cut-through visor aperture',p,hit[0])
    openings.append({'centreM':list(p),'firstShellY':hit[0].y})
   body=[o for o in objects if semantic(o).startswith('Tailored continuous bodice')]
   assert tree(body).overlap(front),(aid,'actual chin intersects actual torso surface')
   checks={'physicallyConnectedHelmetComponents':1,'actualVisorOpenings':openings,'actualChinChestIntersection':True,'headSeatContractBindsActualShell':True}
  if aid in('thunderheart','phoenix'):
   body=next(o for o in objects if semantic(o)=='Tailored continuous bodice')
   pelvis=next(o for o in objects if semantic(o).startswith('Rider visible seated pelvis'))
   assert tree([body]).overlap(tree([pelvis])),(aid,'actual torso/pelvis contact')
   seams={}
   for sn in('R','L'):
    thigh=next(o for o in objects if semantic(o)=='Upper leg '+sn)
    assert tree([body,pelvis]).overlap(tree([thigh])),(aid,'physical thigh connects to pelvis',sn)
    hip=bpy.data.objects['upper_leg_'+sn].matrix_world.translation
    spine=bpy.data.objects['torso_pivot'].matrix_world.translation
    assert abs(hip.y-spine.y)<.025,(aid,'hip and spine forward placement')
    seams[sn]={'actualThighPelvisOverlap':True,'hipSpineForwardDifferenceM':abs(hip.y-spine.y)}
   checks={'actualTorsoPelvisOverlap':True,'legSeams':seams}
  if aid=='archbishop':
   hat=[o for o in objects if semantic(o).startswith('Archbishop high ')or o.get('fullyClosedMitreTop')]
   roof=next(o for o in hat if o.get('fullyClosedMitreTop'))
   rays=[]
   # Two millimetres off the central ridge avoids Blender BVH's documented
   # exact triangle-edge ambiguity while still probing the central opening.
   for x in(-.12,.002,.12):
    hit=tree(hat).ray_cast(Vector((x,-.030,2.5)),Vector((0,0,-1)),2)
    negative=tree([o for o in hat if o!=roof]).ray_cast(Vector((x,-.030,2.5)),Vector((0,0,-1)),2)
    assert hit[0] is not None and hit[0].z>1.4,(aid,'closed top actual opacity ray')
    assert negative[0] is None,(aid,'negative control must detect missing top')
    rays.append({'xM':x,'roofHitZ':hit[0].z,'missingRoofNegativeDetected':True})
   checks={'opaqueFullCrown':rays}
  if aid=='mothernature':
   body=next(o for o in objects if o.get('integratedNatureFaceBody'))
   assert body.parent==bpy.data.objects['torso_pivot']and components(body)==1
   eyes=[o for o in objects if semantic(o).startswith('Nature V5 flush recessed')]
   assert len(eyes)==2
   for eye in eyes:
    assert eye.parent==body.parent
    bounds=metrics([eye]);assert bounds['boundsSize'][1]<.015
   checks={'integratedLivingBodyConnectedComponents':1,'eyeThicknessUnder15mm':True,'eyesOwnedByActualBody':True}
  if aid=='ladyclaire':
   weapon=bpy.data.objects['weapon_R'];staff=[o for o in objects if o.name.startswith('Staff ')]
   assert len(staff)==4 and all(descendants(o,weapon)for o in staff)
   ring=bpy.data.objects['Staff open faceted ring'];socket=bpy.data.objects['Staff ring socket']
   assert tree([ring]).overlap(tree([socket])),(aid,'physical staff ring/socket contact')
   tip=bpy.data.objects['staff_tip'];assert descendants(tip,weapon)
   b=metrics([ring]);assert all(b['boundsMin'][i]-.01<=tip.matrix_world.translation[i]<=b['boundsMax'][i]+.01 for i in range(3))
   checks={'completePhysicalStaffOwnedByWeapon':True,'realRingSocketOverlap':True,'actualTipInRingBounds':True}
  if aid=='archangel':
   assert root['attackStyle']=='sword'
   blade=next(o for o in objects if semantic(o)=='Archangel divine sword blade')
   weapon=bpy.data.objects['weapon_R'];assert descendants(blade,weapon)
   assert not any('spear' in semantic(o).lower()or'orb' in semantic(o).lower()for o in objects)
   tip=bpy.data.objects['sword_tip'];b=metrics([blade]);assert descendants(tip,weapon)
   assert all(b['boundsMin'][i]-.01<=tip.matrix_world.translation[i]<=b['boundsMax'][i]+.01 for i in range(3))
   vv=points(blade);zz=max(p.z for p in vv);apex=[p for p in vv if abs(p.z-zz)<1e-6]
   centroid=sum(apex,Vector())/len(apex)
   for name in ('sword_tip','attack_muzzle'):
    marker=bpy.data.objects[name];assert descendants(marker,weapon)
    assert (marker.matrix_world.translation-centroid).length<1e-6,(aid,'endpoint must bind exact actual blade apex centroid',name)
   checks={'physicalSwordBladeAttachedToActualHand':True,'oldSpearAndOrbAbsent':True,'swordTipInsideRealBladeBounds':True,'bothEndpointsBindActualBladeApexCentroid':list(centroid)}
  if aid=='crownofages':
   shield=next(o for o in objects if semantic(o)=='Shield real back and rim')
   size=metrics([shield])['boundsSize'];ratios=[size[i]/old_shield[i]for i in(0,2)]
   assert all(abs(r-1.26)<.00002 for r in ratios),(aid,'actual shield enlargement',ratios)
   assert descendants(shield,bpy.data.objects['weapon_L'])
   palm=next(o for o in objects if semantic(o)=='Grasping hand L')
   assert tree([palm]).overlap(tree([shield])),(aid,'larger actual shield still contacts the held palm')
   checks={'actualShieldXZSizeRatiosToV4':ratios,'actualShieldPalmIntersection':True,'shieldMountedToRealLeftHand':True}
  assert geometry_digest(objects)==before and hashlib.sha256(native.read_bytes()).hexdigest()==initial
  rows.append({'id':aid,'nativeSha256':initial,'glbSha256':entry['qa']['fileSha256'],'geometrySha256':before,'checks':checks,'passed':True})
 out=ROOT/'output/design/geometric-game-v5';out.mkdir(parents=True,exist_ok=True)
 (out/'champion-physical-shape-audit.json').write_text(json.dumps({'models':len(rows),'readOnly':True,'results':rows},indent=2)+'\n')
 print(json.dumps({'models':len(rows),'passed':len(rows)}),flush=True)

if __name__=='__main__':main()
