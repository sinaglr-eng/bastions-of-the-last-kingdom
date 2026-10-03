"""In-memory diagnostics only; never saves baseline scenes or exports."""
import sys,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(Path(__file__).parent))
import bpy
from author_enemy_humanoid_sources_v6 import adapter
from geometric_enemy_creature_anatomy_v6 import apply_creature_anatomy_v6
from geometric_enemy_humanoid_equipment_v6 import apply_humanoid_equipment_v6,semantic
from geometric_game_common import metrics
mf=json.loads((ROOT/'output/design/geometric-game-v6/baseline-v5-manifests/geometric-enemies.json').read_text())
ids=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['host_49']
for row in mf['entries']:
 if row['id'] not in ids:continue
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/row['native']));b=adapter(row['id']);a=apply_creature_anatomy_v6(b,row);apply_humanoid_equipment_v6(b,row,anatomy=a)
 print('V6PROBE '+row['id']+' '+json.dumps({'boundsSize':metrics(b.objects)['boundsSize'],'degenerateParts':metrics(b.objects)['degenerateParts'],'nonManifold':[{'semantic':semantic(o),'edges':metrics([o])['nonManifoldEdges']}for o in b.objects if metrics([o])['nonManifoldEdges']],'belowGround':[{'semantic':semantic(o),'parent':o.parent.name,'bounds':metrics([o])['boundsMin']}for o in b.objects if metrics([o])['boundsMin'][2]<-.0005]},default=str),flush=True)
