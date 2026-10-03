"""Bind the owner's already-completed manual six-view review to exact files.

This recorder never inspects or approves images itself. It requires explicit
manual notes for every owned subject and rejects changed source/render/export
bytes. Native geometry and source evidence remain untouched.
"""
import argparse, datetime, hashlib, json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OWNED={f'host_{n:02d}'for n in (5,15,19,25,27,28,29,30,34,35,37,39,40,42,45,47,48,50)}
VIEWS=['front','back','left','right','three-quarter-front','three-quarter-back']
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def verify(p,digest):assert sha(p)==digest,('review evidence changed after actual comparison',str(p))

def main():
 ap=argparse.ArgumentParser()
 ap.add_argument('--snapshot',default='tmp/v6-mounted-final-inspection-snapshot.json')
 ap.add_argument('--notes',default='output/design/geometric-game-v6/mounted-final-manual-review-notes.json')
 ap.add_argument('--out',default='output/design/geometric-game-v6/source-six-review-mounted-enemies.json')
 args=ap.parse_args();snapshotPath=ROOT/args.snapshot;notesPath=ROOT/args.notes;dest=ROOT/args.out
 stagePath=ROOT/'output/design/geometric-game-v6/stage-mounted-enemies.json'
 initialPath=ROOT/'output/design/geometric-game-v6/enemy-initial-six-view-review.json'
 for p in (snapshotPath,notesPath,stagePath,initialPath):assert p.resolve()!=dest.resolve()
 inputs={p:sha(p)for p in (snapshotPath,notesPath,stagePath,initialPath)}
 snapshot=read(snapshotPath);stage=read(stagePath);initial=read(initialPath);manual=read(notesPath)
 verify(stagePath,snapshot['stageSha256'])
 stageRows={e['id']:e for e in stage['entries']};snapshotRows={e['id']:e for e in snapshot['entries']};manualRows={e['id']:e for e in manual['entries']};initialRows={e['id']:e for e in initial['entries']}
 assert set(stageRows)==set(snapshotRows)==set(manualRows)==OWNED
 assert manual['reviewer']=='v5_champion_shapes'and manual['viewNames']==VIEWS
 entries=[]
 for ident in sorted(OWNED):
  row=snapshotRows[ident];authored=stageRows[ident];note=manualRows[ident];initialRow=initialRows[ident]
  assert note['personallyOpenedFinalSixRows']is True and note['passedWithinScope']is True and not note['unresolvedSignificantFindings']
  assert len(note['resolution'])>140
  source=ROOT/initialRow['source'];native=ROOT/authored['native'];glb=ROOT/'public/assets/geometric'/authored['file'];sheet=ROOT/row['contactSheet']
  for p,digest in ((source,row['sourceSha256']),(native,row['actualNativeSha256']),(glb,row['actualGlbSha256']),(sheet,row['contactSheetSha256'])):verify(p,digest)
  assert row['sourceSha256']==initialRow['sourceSha256']==authored['sourceSha256']
  assert len(row['actualSixViews'])==6 and [v['view']for v in row['actualSixViews']]==VIEWS
  views=[]
  for v in row['actualSixViews']:
   verify(ROOT/v['path'],v['sha256']);assert v['freshV6Render']is True
   views.append({'view':v['view'],'path':v['path'],'sha256':v['sha256'],'actuallyOpenedAndCompared':True,'scopedPass':True,'viewingMethod':'Actual source/render row personally reopened in the final six-view sheet.'})
  entries.append({'id':ident,'source':initialRow['source'],'sourceSha256':row['sourceSha256'],'actualGlb':glb.relative_to(ROOT).as_posix(),'actualGlbSha256':row['actualGlbSha256'],'actualNative':authored['native'],'actualNativeSha256':row['actualNativeSha256'],'inspectionEvidenceSheet':{'path':row['contactSheet'],'sha256':row['contactSheetSha256']},'pairedSixViewSheet':row['contactSheet'],'pairedSixViewSheetSha256':row['contactSheetSha256'],'actualSixViewsInspected':views,'passedWithinScope':True,'initialVisualSourceFindings':initialRow['visualSourceFindings'],'initialFindingsSha256':hashlib.sha256(initialRow['visualSourceFindings'].encode('utf-8')).hexdigest(),'resolution':note['resolution'],'unresolvedSignificantFindings':[]})
 report={'revision':'geometric-game-v6','reviewer':'v5_champion_shapes','createdAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'subjectsActuallyOpened':18,'sourceModelPairsActuallyInspected':108,'stageManifest':stagePath.relative_to(ROOT).as_posix(),'stageManifestSha256':inputs[stagePath],'initialReview':initialPath.relative_to(ROOT).as_posix(),'initialReviewSha256':inputs[initialPath],'manualReviewNotes':notesPath.relative_to(ROOT).as_posix(),'manualReviewNotesSha256':inputs[notesPath],'method':manual['method'],'scope':'Source-specific visible anatomy, mounted posture, palette, fitted clothing/equipment and identity features. Independent actual geometry/production-pose evidence is recorded separately.','limitations':['Original PNG cameras and scale are uncalibrated. Absolute dimensions, hidden surfaces, exact raster shading and camera projection are authored estimates.','Each original/model view was personally compared through its displayed final paired-sheet row; individual PNG paths and SHA are bound to the pixels used in that row. This recorder performs no visual inspection.'],'sourceFilesModified':False,'nativeFilesModifiedByReviewRecorder':False,'unresolvedSignificantFindingsWithinScope':[],'entries':entries}
 dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 for p,digest in inputs.items():verify(p,digest)
 print(json.dumps({'report':dest.relative_to(ROOT).as_posix(),'sha256':sha(dest),'subjects':18,'sourceModelPairsPersonallyInspected':108,'allEvidenceBytesMatch':True}))
if __name__=='__main__':main()
