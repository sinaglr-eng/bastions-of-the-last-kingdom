"""Regenerate ONLY Claire's V8 hand correction without rewriting the manifest."""
import bpy,sys,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'blender/scripts'))
import author_secret_champions as H
import secret_claire_v3 as C
H.army.clear();C.build(H);scene=bpy.context.scene;scene.frame_set(0)
rig=bpy.data.objects['Lady_Claire_Rig'];root=bpy.data.objects.new('secret_champion_ladyclaire',None);bpy.context.collection.objects.link(root);rig.parent=root
root['secret']=True;root['assetRevision']='designed-defenders-v8';root['designRevision']=11;root['articulationRevision']=3;root['designName']='Lady Claire';root['attackReleaseFraction']=.36;root['modelRevision']='v8-hand-correction'
scene['Champion']='Lady Claire';scene['Family']='ladyclaire';scene['DesignRevision']=11;scene['AssetRevision']='designed-defenders-v8';scene['Identity']='Existing approved V3 face, gown, hair and crown preserved; fresh continuous wrist/palm surfaces and natural flexed five-digit casting and staff grips'
dim=H.bounds();triangles=H.export_rigged('advanced_ladyclaire.glb');camera=H.A.configure_scene();H.camera_frame(camera,dim,(360,420),(-2.7,7,2.1));scene.cycles.samples=24
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender/scenes/ladyclaire_design_v3.blend'))
scene.render.filepath=str(ROOT/'public/assets/army/ladyclaire-t1.png');bpy.ops.render.render(write_still=True);H.army.clean_portrait_metadata(Path(scene.render.filepath))
record=dict(id='ladyclaire-t1',file='advanced_ladyclaire.glb',kind='tower',family='ladyclaire',tier=1,style='designed-defenders-v8',assetRevision='designed-defenders-v8',authoring='Blender',secret=True,triangles=triangles,designRevision=11,modelRevision='v8-hand-correction',name='Lady Claire',source='blender/scenes/ladyclaire_design_v3.blend',bounds=dim,**H.rig_metadata())
record['articulationRevision']=3
(ROOT/'artifacts/defender-humans-v8-claire-metadata.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
print('CLAIRE_V8_HAND_METRICS '+json.dumps(record),flush=True)
