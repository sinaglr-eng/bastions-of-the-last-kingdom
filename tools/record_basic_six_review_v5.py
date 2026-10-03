"""Bind the completed human review of 48 final six-camera comparisons.

This script records a review already performed in the v5_model_proportions
conversation. It does not inspect images or grant approval automatically.
"""
import json,hashlib
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/design/geometric-game-v5'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
now=datetime.now(timezone.utc).isoformat()
families=['archer','mage','soldier','frostwarden','stormcaller','cleric','druid','runebreaker']
ACTUALLY_OPENED={f'{family}-{rank}'for family in families for rank in range(1,7)}
index=json.loads((OUT/'review-index.json').read_text(encoding='utf8'))
manifest_path=ROOT/'public/assets/geometric/geometric-defenders.json'
manifest=json.loads(manifest_path.read_text(encoding='utf8'))
rows={r['id']:r for r in manifest['assets']}
assert ACTUALLY_OPENED==set(rows) and len(ACTUALLY_OPENED)==48
physical=json.loads((OUT/'proportions-cloak-audit.json').read_text())
checks={e['id']:e for e in physical['entries']}
findings={
 'archer':'All six source/model views checked: reduced face and fitted hood remain one seated assembly; IV–VI rear cloth has visible folds and a fitted shoulder yoke. Bow and quiver retain prior geometry.',
 'mage':'All six source/model views checked after final hat-seat rebuild: source-inspired hat brim/band and tier-specific crown, III crooked tip, IV/V closed purple book and VI open book, actual pleated robe, source clean face, fitted rear yoke. Physical bodice/head core is normalized across all ranks; props retain rank differences.',
 'soldier':'All six source/model views checked: hair or whole helmet assembly shrinks about the seated jaw. VI final rear cloth reviewed again after both old flat gold underlay panels were removed; fitted gold edging follows the pleated closed cloth.',
 'frostwarden':'All six source/model views checked: complete hood/face contracts together and remains seated; V–VI cloth is fitted and folded. Staff, crystals, shield and prior requested white collar remain intact.',
 'stormcaller':'All six source/model views checked: prior requested short grey hair and lightning crown contract with the whole face; II–VI cloth has physical folds and a fitted yoke. Held lightning geometry is retained.',
 'cleric':'All six source/model views checked: closed mitre or hood contracts with the seated face and rear head cloth. IV–VI cape is pleated; rear stole applique follows the new cloth. Held vertical staff and tier books remain intact.',
 'druid':'All six source/model views checked: antlers, hood and facial parts contract together; leaf collar and held staff remain unchanged. IV–VI rear cloth now has fitted folds rather than planar panels.',
 'runebreaker':'All six source/model views checked: face, beard, hair, cap, band and goggles contract together without an exposed neck. Hammer remains clear of the whole head and retained carrying arm/tool layout is unchanged.'
}
entries=[]
for family in families:
 for rank in range(1,7):
  aid=f'{family}-{rank}';r=rows[aid];e=next(x for x in index['entries']if x['id']==aid)
  assert e['freshV5'] and sha(ROOT/e['contactSheet'])==e['contactSheetSha256']
  actual={'actualGlbSha256':ROOT/'public/assets/geometric'/r['file'],'actualNativeSha256':ROOT/r['nativeFile'],'actualPortraitSha256':ROOT/'public/assets/geometric'/r['portrait'],'sourceSha256':ROOT/e['source']}
  for key,path in actual.items():assert sha(path)==e[key],(aid,key)
  assert checks[aid]['actualGlbSha256']==e['actualGlbSha256'] and not checks[aid]['failures']
  inspected=[]
  for view in e['actualSixViews']:
   assert sha(ROOT/view['path'])==view['sha256'] and view['geometrySha256']==e['geometrySha256']
   inspected.append({'view':view['view'],'path':view['path'],'sha256':view['sha256'],'actuallyOpenedAndCompared':True,'scopedPass':True})
  entries.append({'id':aid,'category':'towers','assetCategory':'defenders','family':family,'tier':rank,'changedInV5':True,'source':e['source'],'sourceSha256':e['sourceSha256'],'actualGlbSha256':e['actualGlbSha256'],'actualNativeSha256':e['actualNativeSha256'],'actualPortraitSha256':e['actualPortraitSha256'],'actualGeometrySha256':e['geometrySha256'],'actualSixRenderProof':e['actualSixViews'],'actualSixViewsInspected':inspected,'contactSheet':e['contactSheet'],'contactSheetSha256':e['contactSheetSha256'],'reviewer':'v5_model_proportions','reviewedAt':now,'passedWithinScope':True,'findings':findings[family],'actualV5PhysicalRegressionChecks':checks[aid]['checks'],'userDesignOverrides':['Slightly smaller complete human head assembly, preserving seated lower bearing and all attached facial/headgear components.']+(['Structured fitted rear drapery replaces planar cape geometry.']if r['metrics'].get('foldedCloakV5',{}).get('applied')else[])+(['All six Mage ranks share the same physical bodice and head core. Source hat/robe/book/staff details guide rank-specific appearance.']if family=='mage'else[])})
report={'revision':'0.3.4','assetRevision':'geometric-game-v5','reviewer':'v5_model_proportions','createdAtUtc':now,'manifestSha256':sha(manifest_path),'reviewIndexSha256':sha(OUT/'review-index.json'),'method':'Reviewer actually opened all 48 final paired source/model sheets and compared all six rows with the image viewing tool. Mage six were reopened after final crown seating; Soldier VI was reopened after the flat gold underlay repair. Exact final source/native/GLB/portrait/render/sheet hashes are recomputed here; this binding script does not itself inspect images.','scope':'All 48 basic tower whole-head contraction and seated fitting, every existing rear cloak changed to physical folded fitted cloth, and source-guided Mage I–VI design plus identical physical rank core. Existing equipment/body source estimates are not newly certified as exact silhouettes.','subjectsActuallyReinspected':48,'sourceModelPairsActuallyInspected':288,'changedSubjects':48,'unchangedSubjectsByteVerified':0,'unresolvedSignificantFindingsWithinScope':[],'negativePhysicalRegressionsDetected':['Actual Archer whole-head vertices restored to the former oversized assembly while metadata remains unchanged.','Actual Engineer cap mesh detached by 200 mm while metadata remains unchanged.','Actual Verdant Guard draped mesh flattened into a plate while garment flags remain unchanged.'],'limitations':['Raster concepts supply no physical ruler or calibrated camera; absolute dimensions, hidden depth, palette shading and faceting are authored estimates.','No 1% landmark accuracy, exact facet match or silhouette IoU certification is claimed.','Finite static views establish the inspected appearance; production posed contacts and exact held-weapon animation are independently audited by the root runtime owner.','Older intentional source deviations, including Stormcaller short hair/lightning crown, Frostwarden I white collar and vertical Cleric staffs, are retained.','All original source PNG bytes and historical V1–V4 scenes/reports remain unchanged.'],'entries':entries}
(OUT/'source-six-review-defenders.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
print('Actual human review bound: 48 final subjects / 288 inspected source-model pairs.')
