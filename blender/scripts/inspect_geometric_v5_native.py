import bpy, json, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
ids=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [f'mage-{r}' for r in range(1,7)]
rows=[]
for aid in ids:
 p=next((ROOT/'blender/scenes/geometric-game-v1'/cat/f'{aid}.blend' for cat in ('defenders','champions','enemies') if (ROOT/'blender/scenes/geometric-game-v1'/cat/f'{aid}.blend').exists()),None)
 assert p,aid
 bpy.ops.wm.open_mainfile(filepath=str(p))
 bpy.context.view_layer.update()
 out=[]
 for o in bpy.data.objects:
  if o.type!='MESH':continue
  pp=[o.matrix_world@v.co for v in o.data.vertices]
  lo=[min(q[i]for q in pp)for i in range(3)];hi=[max(q[i]for q in pp)for i in range(3)]
  out.append({'name':o.name,'parent':o.parent.name if o.parent else None,'lo':lo,'hi':hi,'vertices':len(pp),'materials':[m.name for m in o.data.materials]})
 rows.append({'id':aid,'meshes':out})
dest=ROOT/'output/design/geometric-game-v5/native-inventory.json';dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(json.dumps(rows,indent=2),encoding='utf8')
print('NATIVE_INVENTORY '+str(dest))
