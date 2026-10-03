import bpy,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];reports=[]
for cat in ['defenders','champions','enemies']:
 mf=json.loads((ROOT/'public/assets/geometric'/('geometric-'+cat+'.json')).read_text(encoding='utf8'))
 for row in mf.get('assets',mf.get('entries',[])):
  path=ROOT/row.get('nativeFile',row.get('native'));bpy.ops.wm.open_mainfile(filepath=str(path));bpy.context.view_layer.update();cloaks=[]
  for ob in bpy.data.objects:
   if ob.type=='MESH'and any(t in ob.name.lower()for t in ['cape','cloak','mantle','drape','pelt','hide','coat','rear cloth','rear fabric','back cloth','shaggy rear mane']):
    pp=[ob.matrix_world@v.co for v in ob.data.vertices];cloaks.append({'name':ob.name,'semantic':ob.get('semanticPart',ob.name),'parent':ob.parent.name if ob.parent else None,'height':max(p.z for p in pp)-min(p.z for p in pp),'boundsMin':[min(p[i] for p in pp)for i in range(3)],'boundsMax':[max(p[i] for p in pp)for i in range(3)],'vertices':len(pp)})
  if cloaks:reports.append({'id':row['id'],'category':cat,'native':str(path),'cloaks':cloaks})
 dest=ROOT/'output/design/geometric-game-v5/cloak-inventory.json';dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(json.dumps(reports,indent=2),encoding='utf8')
print('CLOAK_INVENTORY_COMPLETE '+str(len(reports)))
