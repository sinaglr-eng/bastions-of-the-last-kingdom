"""Owned append-only source author for eighteen V6 mounted/skeletal enemies."""
import bpy,argparse,hashlib,json,sys,math,shutil
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(Path(__file__).parent))
from author_geometric_proportions_v5 import adapter,render
from geometric_enemy_mount_sources_v6 import apply_mount_source_v6,mounted_source_ornaments,OWNED,joint
from geometric_champion_creature_fit_v4 import semantic,remove,descendants,points
from geometric_roster_builder import ell,annulus
from geometric_game_common import metrics,geometry_digest,export_and_check
from geometric_enemy_mount_scope_v6 import write_mounted_scope_v6
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()

def apply_current_source_garment_scope_v6(b):
 """Keep historical cloth records while selecting the real rebuilt rider cloth."""
 if b.id!='host_50':return
 parts=['V6 source overlapping ragged mantle tier','V6 source contacting ragged skirt layer']
 actual=[ob for ob in b.objects if semantic(ob)in parts]
 assert all(any(semantic(ob)==part for ob in actual)for part in parts),(b.id,'missing actual source rider cloth')
 assert sum(len(ob.data.vertices)for ob in actual)>=100,(b.id,'actual rider cloth surface missing')
 historical=json.loads(b.root['foldedCloakV5'])
 assert historical['garments'],(b.id,'historical garment scope missing')
 for garment in historical['garments']:
  garment['parts']=parts
 b.root['foldedCloakV5']=json.dumps(historical)

def human_leg_joint(b,side,prefix=''):
 candidates=[o for o in b.objects if semantic(o)=='Upper leg '+side and o.parent.name.startswith('drummer_')==bool(prefix)]
 assert len(candidates)==1,(b.id,'actual rider thigh',side,[o.name for o in candidates])
 return candidates[0].parent
def is_drummer(ob):
 while ob:
  if ob.name.startswith('drummer_'):return True
  ob=ob.parent
 return False
def seated_rider(b,mount,wave,prefix=''):
 if wave==40:return {'applied':False,'noHumanoidRider':True}
 seat=Vector(mount['seatM']);suspended=mount.get('suspendedRider',False);tor=bpy.data.objects[prefix+'torso_pivot'];oldHip=[human_leg_joint(b,s,prefix).matrix_world.translation.copy()for s in('L','R')]
 if wave==45:seat.x=-.38 if prefix else .38
 actualHip=sum(oldHip,Vector())/2;hip=seat+Vector((0,0,.056));delta=hip-actualHip
 # Move entire upper body, head, both arms, hair/gear and all held equipment
 # together. Leg roots and two-link knees are rebuilt from actual hip contact.
 upper=[tor]+list(tor.children_recursive);matrices={o:o.matrix_world.copy()for o in upper}
 lean=Matrix.Rotation(math.radians(-16 if wave in(19,37,47,50,15,30,39)else-9),4,'X') if not suspended else Matrix.Identity(4)
 transform=Matrix.Translation(hip)@lean@Matrix.Translation(-actualHip)
 if wave==28:
  # The source pilot crouches inside the open chassis, with only shoulders,
  # head and held crossbow above its rim. Its actual whole upper assembly
  # compresses together about the seated hip before structural reconstruction.
  transform=Matrix.Translation(hip)@Matrix.Diagonal((.86,.90,.68,1))@Matrix.Translation(-hip)@transform
 for ob in upper:ob.matrix_world=transform@matrices[ob]
 bpy.context.view_layer.update()
 bodyparts=[o for o in b.objects if semantic(o).startswith(('Tailored continuous bodice','Leather ragged skirt','Upper leg ','Lower leg ','Knee contacting articulated joint ','Ankle contacting boot joint '))and is_drummer(o)==bool(prefix)]
 legmap={s:human_leg_joint(b,s,prefix)for s in('L','R')};remove(b,bodyparts)
 # Forward inclined continuous torso seats onto a real pelvis. All new
 # anatomy starts inside the physical seat rather than bridging with a belt.
 shoulderz=sum(bpy.data.objects[prefix+'upper_arm_'+s].matrix_world.translation.z for s in('L','R'))/2
 cy=hip.y+(.016 if suspended else .14)
 width=.133 if wave==45 else .173
 thorax=b.loft('V6 rider source seated thorax',[b.ring(hip.x,hip.y,hip.z-.03,width,.14,12),b.ring(hip.x,cy,hip.z+.17,width*1.016,.136,12),b.ring(hip.x,cy+.018,shoulderz-.07,width*1.19,.134,12),b.ring(hip.x,cy+.035,shoulderz+.055,width*.566,.080,12)],'cloth',tor)
 pelvis=ell(b,'V6 rider source contacting seated pelvis',hip,(.211,.18,.093),'leather',tor,12,5)
 for side in('L','R'):
  pa=bpy.data.objects[prefix+'upper_arm_'+side];fore=bpy.data.objects[prefix+'forearm_'+side]
  oldarms=[o for o in b.objects if semantic(o)=='Upper arm '+side and is_drummer(o)==bool(prefix)]
  inherited=list(oldarms[0].data.materials)if oldarms else[];remove(b,oldarms)
  sg=-1 if side=='L'else 1;sh=pa.matrix_world.translation.copy();el=fore.matrix_world.translation.copy()
  start=Vector((hip.x+sg*width*.48,cy+.018,sh.z-.038))
  ob=b.limb('Upper arm '+side,[start,sh,sh.lerp(el,.44),el],[(.099,.101),(.093,.092),(.087,.084),(.076,.074)],'cloth',pa,12)
  if inherited:
   ob.data.materials.clear()
   for mat in inherited:ob.data.materials.append(mat)
   for polygon in ob.data.polygons:polygon.material_index=0
 if suspended:
  saddle=b.limb('V6 hanging goblin source waist suspension harness',[(hip.x-.18,hip.y,hip.z+.08),(hip.x,hip.y+.105,hip.z+.08),(hip.x+.18,hip.y,hip.z+.08)],[.032]*3,'leather',tor,10)
  for sgn in(-1,1):
   b.limb('V6 hanging goblin actual continuous overhead leather strap',[(sgn*.155,hip.y+.11,hip.z+.14),(sgn*.174,hip.y+.09,shoulderz+.11),(sgn*.17,.18,mount['seatM'][2]+1.25)],[.029]*3,'leather',tor,10)
 else:saddle=b.limb('V6 rider real fitted source saddle seat',[seat+Vector((0,.12,-.009)),seat+Vector((0,-.14,-.009))],[(.255,.084),(.254,.081)],'leather',bpy.data.objects['mount_torso_pivot'],12)
 for side in('L','R'):
  sgn=-1 if side=='L'else 1;up=legmap[side];sh=next(o for o in up.children if o.type=='EMPTY'and o.name.startswith(prefix+'shin_'));foot=next(o for o in sh.children if o.type=='EMPTY'and o.name.startswith(prefix+'foot_'))
  h=hip+Vector((sgn*.145,0,-.006));k=hip+Vector((sgn*(.148 if suspended else .31),.14,-.17));a=hip+Vector((sgn*(.152 if suspended else .325),.03,-.34))
  joint(b,up.name,h,up.parent);joint(b,sh.name,k,up);joint(b,foot.name,a,sh)
  b.limb('V6 rider actual connected seated thigh '+side,[h,h.lerp(k,.48),k],[(.108,.103),(.105,.101),(.082,.081)],'cloth',up,10)
  b.limb('V6 rider actual naturally hanging shin '+side,[k,k.lerp(a,.52)+Vector((0,-.017,0)),a],[(.084,.083),(.078,.077),(.070,.069)],'cloth',sh,10)
  # Move full approved foot/boot surfaces with the same actual ankle delta.
  boot=[o for o in b.objects if descendants(o,foot)]
  for ob in boot:
   vv=points(ob);bb=metrics([ob]);c=Vector([(bb['boundsMin'][j]+bb['boundsMax'][j])/2 for j in range(3)]);shift=a+Vector((0,.04,-.055))-c;inv=ob.matrix_world.inverted()
   for v,p in zip(ob.data.vertices,vv):v.co=inv@(p+shift)
   ob.data.update()
  annulus(b,'V6 rider source real fitted stirrup '+side,(a.x,a.y+.07,a.z-.041),.058,.012,'steel_dark',bpy.data.objects['mount_torso_pivot'],True,12,4)
 b.root['v6RiderHipAnchorM']=list(hip)
 return {'applied':True,'torso':thorax.name,'pelvis':pelvis.name,'saddle':saddle.name,'headSeatM':[hip.x,cy+.035,shoulderz+.044],'bearingParts':[semantic(thorax)],'wholeUpperBodyTranslationM':list(delta),'actualRiderLegJoints':{s:legmap[s].name for s in legmap},'sourcePose':'Crouched hips physically seated; whole torso/head/arms move together; two anatomical thighs and naturally hanging shins.'}

def preserve_boss_height(b,entry):
 wave=int(b.id.split('_')[1]);baseline=entry['qa']['boundsSize'][2]
 if wave not in(30,40,50):return {'boss':False,'baselineHeightM':baseline}
 q=metrics(b.objects);actual=q['boundsSize'][2];factor=max(1,(baseline+.0001)/actual)
 if factor>1:
  bpy.context.view_layer.update();allobs=[b.root]+list(b.root.children_recursive);matrices={o:o.matrix_world.copy()for o in allobs};vv={o:points(o)for o in b.objects};origin=Vector((0,0,q['boundsMin'][2]))
  for ob in allobs:
   m=matrices[ob];m.translation=origin+(m.translation-origin)*factor;ob.matrix_world=m
  bpy.context.view_layer.update()
  for ob,pts in vv.items():
   inv=ob.matrix_world.inverted()
   for v,p in zip(ob.data.vertices,pts):v.co=inv@(origin+(p-origin)*factor)
   ob.data.update()
 final=metrics(b.objects)['boundsSize'][2];assert final>=baseline-1e-6
 return {'boss':True,'baselineHeightM':baseline,'finalAuthoredHeightM':final,'sourceProportionPreservingUniformFactor':factor,'battlefieldMultiplierRetained':1.5}

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--only',nargs='*',default=[f'host_{w:02d}'for w in OWNED]);ap.add_argument('--size',type=int,default=400);ap.add_argument('--mount-only-preview',action='store_true');ap.add_argument('--expected-geometry-sha256');args=ap.parse_args(sys.argv[sys.argv.index('--')+1:]if'--'in sys.argv else[])
 if args.expected_geometry_sha256:assert len(args.only)==1,'A fixed geometry digest requires one explicit subject'
 baseline=ROOT/'output/design/geometric-game-v6/baseline-v5-manifests/geometric-enemies.json';baselineSha=sha(baseline);mf=json.loads(baseline.read_text());output=ROOT/'output/design/geometric-game-v6';output.mkdir(parents=True,exist_ok=True)
 stagepath=output/'stage-mounted-enemies.json';stage=json.loads(stagepath.read_text())if stagepath.exists()else{'revision':'geometric-game-v6','writer':'v5_champion_shapes','baselineManifestSha256':baselineSha,'entries':[]};byid={e['id']:e for e in stage['entries']}
 for entry in mf['entries']:
  if entry['id']not in args.only:continue
  assert int(entry['id'].split('_')[1])in OWNED
  nativeInput=ROOT/entry['native'];inputSha=sha(nativeInput);source=ROOT/'public/geometric-turnarounds-v1'/entry['source'];sourceSha=sha(source);assert sourceSha==entry['sourceSha256']
  bpy.ops.wm.open_mainfile(filepath=str(nativeInput));b=adapter(entry['id']);b.coverage=entry['qa'].get('coverage',[])
  mount=apply_mount_source_v6(b,entry);rider=seated_rider(b,mount,int(b.id.split('_')[1]));human={'pendingSourceHelper':True}
  if b.id=='host_45':rider['secondDrummer']=seated_rider(b,mount,45,'drummer_')
  if mount.get('noHumanoidRider'):
   human={'noHumanoidRider':True,'captiveSmallSourceAnatomyOwnedByDedicatedCreatureBuilder':True}
  elif not args.mount_only_preview:
   from geometric_enemy_humanoid_equipment_v6 import apply_humanoid_equipment_v6
   human=apply_humanoid_equipment_v6(b,entry,mounted=True,anatomy=rider)
  ornaments=mounted_source_ornaments(b,{**entry,'_mount':mount},rider)
  if not args.mount_only_preview or b.id in('host_40','host_50'):write_mounted_scope_v6(b,entry,mount,rider)
  height=preserve_boss_height(b,entry);apply_current_source_garment_scope_v6(b);q=metrics(b.objects);assert q['nonManifoldEdges']==0 and q['degenerateTriangles']==0,(b.id,q['degenerateParts'],q['nonManifoldEdges'])
  if args.expected_geometry_sha256:assert geometry_digest(b.objects)==args.expected_geometry_sha256,(b.id,'geometry changed during scope-only regeneration',geometry_digest(b.objects),args.expected_geometry_sha256)
  b.root['assetRevision']='geometric-game-v6';b.root['anatomyRevision']='geometric-source-specific-enemy-v6';b.root['sourceSpecificEnemyV6']=True
  dest=ROOT/f'public/assets/geometric/enemies-v6/{b.id}.glb';q=export_and_check(b,dest);assert q['nonManifoldEdges']==0
  views=render(b,output/'enemies/renders'/b.id,args.size);portrait=ROOT/f'public/assets/geometric/portraits-v6/{b.id}.png';portrait.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(output/'enemies/renders'/b.id/'three-quarter-front.png',portrait)
  native=ROOT/f'blender/scenes/geometric-game-v6/enemies/{b.id}.blend';native.parent.mkdir(parents=True,exist_ok=True);assert native.resolve()!=nativeInput.resolve();bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(native))
  assert sha(nativeInput)==inputSha and sha(source)==sourceSha and sha(baseline)==baselineSha
  rec={**entry,'native':native.relative_to(ROOT).as_posix(),'file':dest.relative_to(ROOT/'public/assets/geometric').as_posix(),'portrait':portrait.relative_to(ROOT/'public/assets/geometric').as_posix(),'qa':q,'views':views,'anatomyRevision':'geometric-source-specific-enemy-v6','sourceRepairV6':{'mount':mount,'rider':rider,'humanoidEquipment':human,'ornaments':ornaments,'bossHeight':height,'baselineNativeSha256':inputSha,'finalNativeSha256':sha(native),'originalSourcePreserved':True,'intermediateMountOnlyPreview':args.mount_only_preview}}
  rec['landmarksNative']={semantic(o):list(sum(points(o),Vector())/len(o.data.vertices))for o in b.objects if semantic(o)in('Eye L','Eye R')and not is_drummer(o)}
  rec['sourceRepairRevision']='geometric-game-v6'
  byid[b.id]=rec;stage['entries']=list(byid.values());stagepath.write_text(json.dumps(stage,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print('V6_MOUNT_STAGE '+b.id+' '+q['fileSha256'],flush=True)
 assert sha(baseline)==baselineSha
if __name__=='__main__':main()
