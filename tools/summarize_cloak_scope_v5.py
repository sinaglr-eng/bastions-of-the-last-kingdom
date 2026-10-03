"""Bind the complete V5 native garment-name inventory to scoped dispositions.

This report is an inventory, not a substitute for actual six-view reviews.
"""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/design/geometric-game-v5'
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
inventory=json.loads((OUT/'cloak-inventory.json').read_text(encoding='utf8'))
manifests={};subjects={};counts={}
for category in ('defenders','champions','enemies'):
 path=ROOT/'public/assets/geometric'/f'geometric-{category}.json'
 mf=json.loads(path.read_text(encoding='utf8'));rows=mf.get('assets',mf.get('entries',[]))
 manifests[category]={'path':path.relative_to(ROOT).as_posix(),'sha256':sha(path),'nativeSubjectsScanned':len(rows)}
 subjects.update({(category,r['id']):r for r in rows})
def classify(aid,name,vertices):
 if name.startswith(('V5 folded fitted cloak','Real rear cape')) and vertices==350:
  return 'folded-closed-cloth','Actual seven-station, 25-column folded cloth volume; independently checked in proportions-cloak-audit.json.'
 if name.startswith('V5 source '):
  return 'source-shaped-mage-fabric','Fitted cowl, shaped mantle or folded front sections; actual final basic six-view review records apply.'
 if name.startswith('Shoulder folded cape'):
  return 'retained-folded-shoulder-cloth','Existing shaped shoulder fold retained above rebuilt continuous rear garment.'
 if name.startswith(('Horse source fitted three draped caparison sections','Bear source contacting green mantle across back','Actual layered marsh cloak reed leaf')):
  return 'retained-layered-source-cloth','Existing shaped draped sections or overlapping natural layers; retain source anatomy and layering.'
 if aid=='ladyclaire':
  return 'retained-structured-gown','Existing shaped gown panels, lateral drapes and attached shoulder collar; actual final champion review applies.'
 if name.startswith(('Construct continuous rear crystal bearing shoulder mantle','Sky king broad dark shoulder mantle')):
  return 'rigid-armor','Continuous crystal/obsidian armor rather than fabric; source and actual six-view classification retained.'
 if name=='Large shared troll-hide war drum':
  return 'drum','Troll-hide names the drum skin, not a rear garment.'
 if any(part in name.lower() for part in ('brooch','cape edge','cape shoulder attachment','stole','mantle silver')):
  return 'cloth-attachment-or-decoration','Attachment, fitted edge or stole follows the associated garment; not an independent rear cloth panel.'
 raise AssertionError(('Unclassified cloak inventory candidate',aid,name,vertices))
reviewed=[]
for subject in inventory:
 row=subjects[(subject['category'],subject['id'])]
 native=ROOT/row.get('nativeFile',row.get('native'))
 for item in subject['cloaks']:
  disposition,basis=classify(subject['id'],item['name'],item['vertices'])
  counts[disposition]=counts.get(disposition,0)+1
  reviewed.append({'id':subject['id'],'category':subject['category'],'native':native.relative_to(ROOT).as_posix(),'nativeSha256':sha(native),**item,'disposition':disposition,'basis':basis})
report={'scope':'All 48 basic, 38 champion and 50 enemy native scenes; name inventory plus explicit rear-mane selector, with actual six-view reviews separately bound.','nativeSubjectsScanned':sum(m['nativeSubjectsScanned']for m in manifests.values()),'candidateSubjects':len(inventory),'candidateParts':len(reviewed),'unclassifiedCandidates':0,'inventorySha256':sha(OUT/'cloak-inventory.json'),'manifests':manifests,'dispositionCounts':counts,'missedFlatPanelsFixed':['host_08: Frost troll large dark shaggy rear mane replaced by fitted folded rear pelt.','host_33: Real rear cape replaced by fitted folded purple cloak.','soldier-6: Two old Cape gold edged panel planes removed; new gold edging follows actual drape.'],'limitations':'Semantic inventory is not proof of comprehensive V6 enemy source fidelity; enemy armor/anatomy/source redesign is outside this V5 cloth scope. Fresh visual comparison is recorded only in the separate source-six-review reports.','candidates':reviewed}
(OUT/'cloak-scope-review.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
index=json.loads((OUT/'review-index.json').read_text(encoding='utf8'))
rows=index['entries'] if isinstance(index,dict) else index
selected=[r for r in rows if r['id']in ('soldier-6','host_08','host_33')]
(OUT/'final-cloak-fix-bindings.json').write_text(json.dumps({'geometryFrozen':True,'entries':selected},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps({'nativeSubjectsScanned':report['nativeSubjectsScanned'],'candidateSubjects':len(inventory),'candidateParts':len(reviewed),'dispositionCounts':counts,'finalBindings':selected},ensure_ascii=False))
