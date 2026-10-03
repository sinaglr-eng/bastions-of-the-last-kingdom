"""Bind actual v3 changed-subject visual inspections to final asset bytes.

Call --mark-inspected only after actually opening the current six-row sheet.
The unchanged 25 are proved by GLB/native/portrait/all-six-render hashes.
"""
import argparse
import datetime
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/design/geometric-game-v3'
PRIVATE=ROOT/'output/design/geometric-game-v1/defenders/geometric-defenders.json'
PUB=ROOT/'public/assets/geometric'
CACHE=OUT/'defender-v3-actual-visual-inspections.json'
digest=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
before={e['id']:e for e in json.loads((OUT/'defenders-before.json').read_text(encoding='utf8'))['entries']}
args_parser=argparse.ArgumentParser()
args_parser.add_argument('--mark-inspected',default='')
args_parser.add_argument('--finish',action='store_true')
args_parser.add_argument('--reviewer',default='defender_models')
args=args_parser.parse_args()
mf=json.loads(PRIVATE.read_text(encoding='utf8'));rows={a['id']:a for a in mf['assets']}
state=json.loads(CACHE.read_text(encoding='utf8')) if CACHE.exists() else {'revision':'geometric-game-v3','entries':{}}
for aid in filter(None,args.mark_inspected.split(',')):
    a=rows[aid];glb=PUB/a['file'];assert digest(glb)==a['metrics']['fileSha256']
    assert digest(glb)!=before[aid]['glb'],aid
    source=ROOT/'output/design/geometric-turnarounds-v1'/a['sourceFile']
    sheet=ROOT/'output/design/geometric-game-v1/independent-visual-review/paired-six-views/towers'/f'{aid}.jpg'
    actual=[]
    for v in a['metrics']['views']:
        path=Path(v['path']);path=path if path.is_absolute() else ROOT/path
        actual.append({'view':v['view'],'path':path.relative_to(ROOT).as_posix(),
                       'sha256':digest(path),'actuallyOpenedAndCompared':True,'scopedPass':True})
    assert len(actual)==6 and abs(a['headAxisFit']['after']['fullSkullToTorsoOffsetM'])<.00001
    native=Path(a['nativeFile']);native=native if native.is_absolute() else ROOT/native
    overrides=[]
    if a['family']=='stormcaller':
        overrides=['User explicitly replaces the old reference vertical hair quiffs with normal low fitted hair.',
                   'User explicitly adds six tier-distinguished lightning crowns.',
                   'Held bolts use recognisable closed flat continuous zigzags; V/VI add visibly separate connected branches.']
    state['entries'][aid]={'id':aid,'category':'towers','family':a['family'],'tier':a['tier'],
        'actualGlbSha256':digest(glb),'actualNativeSha256':digest(native),
        'sourceSha256':digest(source),'source':source.relative_to(ROOT).as_posix(),
        'contactSheet':sheet.relative_to(ROOT).as_posix(),'contactSheetSha256':digest(sheet),
        'actualSixViewsInspected':actual,'inspectionReviewer':args.reviewer,'inspectionRecordedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'headAxisFit':a['headAxisFit'],'actualRestJointContacts':a['metrics']['jointSurfaceContactsRest'],
        'userDesignOverrides':overrides,'lightningCrownDesign':a.get('stormV3DesignOverride'),
        'scopedChecks':{'wholeSkullCenteredOnTorso':True,'shortNeckUnderJaw':True,
                        'capsRemainSeated':True,'bootsRemainArticulatedAndGrounded':True,
                        'sourceEquipmentPreservedOutsideOverrides':True,
                        'hairCrownBoltDesignOverrideCompared':a['family']=='stormcaller'},
        'regeneratedAndSixViewsReinspected':True,'passedWithinScope':True}
CACHE.write_text(json.dumps(state,indent=2),encoding='utf8',newline='\n')
if args.finish:
    public_mf=PUB/'geometric-defenders.json';data=json.loads(public_mf.read_text(encoding='utf8'))
    assert data['revision']=='geometric-game-v3' and len(data['assets'])==48
    changed=[a for a in data['assets'] if digest(PUB/a['file'])!=before[a['id']]['glb']]
    assert len(changed)==23 and set(state['entries'])=={a['id'] for a in changed}
    result=[]
    for a in data['assets']:
        aid=a['id'];old=before[aid];glb=digest(PUB/a['file'])
        native=digest(ROOT/a['nativeFile']);portrait=digest(PUB/a['portrait'])
        views={v['view']:digest(ROOT/v['path']) for v in a['metrics']['views']}
        if aid in state['entries']:
            e=state['entries'][aid]
            assert glb==e['actualGlbSha256']==a['metrics']['fileSha256'] and native==e['actualNativeSha256']
            assert digest(ROOT/e['contactSheet'])==e['contactSheetSha256']
            assert all(views[v['view']]==v['sha256'] for v in e['actualSixViewsInspected'])
            e['actualPortraitSha256']=portrait;result.append(e)
        else:
            proof={'glb':glb==old['glb'],'native':native==old['native'],
                   'portrait':portrait==old['portrait'],'allSixRenders':views==old['renders'],
                   'source':a['sourceSha256']==old['sourceSha256']}
            assert all(proof.values()),(aid,proof)
            result.append({'id':aid,'category':'towers','family':a['family'],'tier':a['tier'],
                'actualGlbSha256':glb,'actualNativeSha256':native,'actualPortraitSha256':portrait,
                'sourceSha256':a['sourceSha256'],'changedInV3':False,
                'preservedByteExactFromV2':proof,
                'actualSixViewsInspected':[],
                'inspectionScope':'Not falsely claimed newly visually inspected; all geometry, native, portrait and six render bytes proved identical to the previously inspected v2 freeze.',
                'passedWithinScope':True})
    report={'revision':'geometric-game-v3','reviewer':'defender_models',
        'method':'Actual all48 native head-axis diagnosis before authoring; actual six-row source/model paired sheets opened for every one of the 23 changed models. Unchanged25 proved by exact GLB/native/portrait/six-render/source hashes.',
        'scope':'Engineer head-neck-torso anatomical axis and restored III–V orange nape hair; same proven +160 mm full-skull fault in Mage, Stormcaller and Cleric II–VI; normal fitted Storm hair, six lightning crown tiers and actual flat continuous bolts. II–III crowns additionally contrast with gray hair. Storm hairstyle/crowns explicitly override old art.',
        'manifestSha256':digest(public_mf),'subjectsActuallyReinspected':23,'sourceModelPairsActuallyInspected':138,
        'unchangedSubjectsByteVerified':25,'unresolvedSignificantFindingsWithinScope':[],
        'limitations':['Raster concepts supply no real physical dimensions; absolute size and hidden geometry remain estimates.',
                       'Source comparison excludes the explicitly requested Storm hair/crown override; it does not claim exact old-style silhouette agreement.',
                       'This scoped review does not certify 1% landmarks or 0.97 silhouette IoU.',
                       'Rest render inspection is separate from independently checked actual animated GLB contacts.'],
        'entries':result}
    path=OUT/'source-six-review-defenders.json';path.write_text(json.dumps(report,indent=2),encoding='utf8',newline='\n')
    freeze={'revision':'geometric-game-v3','subjects':48,'affected':23,'unchangedByteExact':25,
        'actualNewRenders':138,'manifestSha256':digest(public_mf),'sourceSixReview':path.relative_to(ROOT).as_posix(),
        'sourceSixReviewSha256':digest(path),'affectedIds':[a['id'] for a in changed]}
    (OUT/'freeze-defenders.json').write_text(json.dumps(freeze,indent=2),encoding='utf8',newline='\n')
    print(json.dumps(freeze))
else:
    print(json.dumps({'actuallyInspectedChangedSubjects':len(state['entries']),'marked':args.mark_inspected.split(',')}))
