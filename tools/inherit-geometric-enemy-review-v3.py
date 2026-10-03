"""Carry unchanged enemy evidence forward, with current native/render hashes.

This does not claim a new visual inspection of unchanged enemies.
"""
from pathlib import Path
import hashlib,json
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/design/geometric-game-v3'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda p:json.loads(p.read_text(encoding='utf8'))
base=read(ROOT/'output/design/geometric-game-v2/source-six-review-enemies.json')
mf=read(ROOT/'public/assets/geometric/geometric-enemies.json')
assets={r['id']:r for r in mf['entries']}
assert len(assets)==50
result=[]
for row in base['entries']:
    entry=assets[row['id']]
    assert sha(ROOT/'public/assets/geometric'/entry['file'])==row['actualGlbSha256']
    assert sha(ROOT/entry['native'])==row.get('actualNativeSha256',row.get('nativeSha256'))
    assert entry['sourceSha256']==row['sourceSha256']
    for view in row['actualSixViewsInspected']:assert sha(ROOT/view['path'])==view['sha256']
    sheet=row.get('contactSheet',row.get('pairedSixViewSheet'))
    assert sha(ROOT/sheet)==row.get('contactSheetSha256',row.get('pairedSixViewSheetSha256'))
    result.append({**row,'inspectionInheritedFromEdition':'0.3.1','regeneratedAndSixViewsReinspected':False,'unchangedInV3':True})
report={**base,'revision':'geometric-game-v3','subjectsActuallyReinspected':0,'sourceModelPairsActuallyInspected':0,'unchangedSubjectsByteVerified':50,'method':'Current GLB, native, source, all six render and previously inspected sheet hashes verified exactly unchanged. Original 0.3.1 six-view inspection evidence is inherited; no new visual inspection is claimed.','entries':result}
OUT.mkdir(parents=True,exist_ok=True)
(OUT/'source-six-review-enemies.json').write_text(json.dumps(report,indent=2),encoding='utf8',newline='\n')
print(json.dumps({'unchangedEnemies':50,'originalVisualEvidencePreserved':True}))
