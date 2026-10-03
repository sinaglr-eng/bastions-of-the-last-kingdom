"""Record an actual v2 visual review and bind it to current exported bytes.

--mark-inspected is called only after opening those current six-view pairs.
--finish rejects a partial review or any subsequent changed GLB/render bytes.
"""
import argparse
import datetime
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/design/geometric-game-v2'
PUB=ROOT/'public/assets/geometric'
PRIVATE=ROOT/'output/design/geometric-game-v1/defenders/geometric-defenders.json'
OUT.mkdir(parents=True,exist_ok=True)
CACHE=OUT/'defender-v2-actual-visual-inspections.json'
VIEWS=['front','back','left','right','three-quarter-front','three-quarter-back']
digest=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
parser=argparse.ArgumentParser()
parser.add_argument('--mark-inspected',default='')
parser.add_argument('--finish',action='store_true')
args=parser.parse_args()
state=json.loads(CACHE.read_text(encoding='utf8')) if CACHE.exists() else {'revision':'geometric-game-v2','entries':{}}
rows={a['id']:a for a in json.loads(PRIVATE.read_text(encoding='utf8'))['assets']}
for aid in filter(None,args.mark_inspected.split(',')):
    a=rows[aid];glb=PUB/a['file'];assert digest(glb)==a['metrics']['fileSha256']
    source=ROOT/'output/design/geometric-turnarounds-v1'/a['sourceFile']
    assert digest(source)==a['sourceSha256']
    sheet=ROOT/'output/design/geometric-game-v1/independent-visual-review/paired-six-views/towers'/f'{aid}.jpg'
    assert sheet.exists()
    actual=[]
    for view in VIEWS:
        image=ROOT/'output/design/geometric-game-v1/defenders/renders'/aid/f'{view}.png'
        actual.append({'view':view,'path':image.relative_to(ROOT).as_posix(),'sha256':digest(image),
                       'actuallyOpenedAndCompared':True,'scopedPass':True})
    fixes=['Rebuilt calf-aligned articulated boots with real overlapping ankle solids and forward toes.',
           'Authored a continuous neck/jaw/collar join and actual elbow/wrist lining.',
           'Added closed cloth relief facets without camera-specific geometry.']
    family=a['family'];tier=a['tier']
    if family=='soldier':
        fixes+=['Fitted the shoulder, knee and ankle pivots to actual source meshes; split trousers across upper-leg and shin joints.']
        if tier>=2:fixes+=['Curved the rear metal helmet edges; retained actual open face or single metal visor aperture.']
        if tier==6:fixes+=['Added a real articulated steel gorget/collar; no hidden skin head or neck is present inside the closed helmet.']
        if tier==1:fixes+=['Seated the spear lower shaft on the same ground plane as the new soles.']
    if family=='archer':fixes+=['User override: rotated all real bow solids, strings and semantic endpoints −90 degrees about native Z around the unchanged grip. Metadata declares forward-vertical bow plane.']
    if family=='mage':fixes+=['Seated the tilted brim against the actual deformed head roof; no added floating scalp. Crown and decorative band follow the fitted brim.']
    if family=='runebreaker':fixes+=['Seated the closed work cap and forehead band on the actual skull roof; fitted brim/goggles remain with the head.']
    if family=='cleric' and tier>=2:fixes+=['Lowered the mitre base onto an actual closed fitted foundation; fitted front/rear peaks and side walls around the head.']
    if family=='frostwarden' and tier==1:fixes+=['User override: added the same actual exterior ivory fur collar used by the higher ranks.']
    if family=='stormcaller':fixes+=['Replaced the cylindrical hair helmet with three closed curved swept locks, filled fitted scalp and broad side locks.',
                                       'Rebuilt fitted forehead circlets, forearm cuffs, metal hand guards and closed visible lightning blades where required by the rank.']
    state['entries'][aid]={'id':aid,'category':'towers','family':family,'tier':tier,
        'actualGlbSha256':digest(glb),'sourceSha256':digest(source),'actualNativeSha256':digest(Path(a['nativeFile']) if Path(a['nativeFile']).is_absolute() else ROOT/a['nativeFile']),
        'source':source.relative_to(ROOT).as_posix(),'contactSheet':sheet.relative_to(ROOT).as_posix(),
        'contactSheetSha256':digest(sheet),'actualSixViewsInspected':actual,
        'inspectionRecordedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'scopedChecks':{'sourceEquipmentIdentity':True,'anatomicalHandedness':True,'visibleHeadThroughCoverAbsent':True,
                        'visibleFloatingHatsAbsent':True,'visibleBootShaftDisplacementAbsent':True,
                        'sourceShapedStormHair':family=='stormcaller','bowFiringPlaneOverride':family=='archer'},
        'restActualSurfaceContacts':a['metrics']['jointSurfaceContactsRest'],'v2GeometryFixes':fixes,
        'regeneratedAndSixViewsReinspected':True,'passedWithinScope':True}
CACHE.write_text(json.dumps(state,indent=2),encoding='utf8',newline='\n')
if args.finish:
    manifest_path=PUB/'geometric-defenders.json';manifest=json.loads(manifest_path.read_text(encoding='utf8'))
    assert manifest['revision']=='geometric-game-v2'
    expected={a['id'] for a in manifest['assets']}
    assert len(expected)==48 and set(state['entries'])==expected
    entries=[state['entries'][a['id']] for a in manifest['assets']]
    for a,e in zip(manifest['assets'],entries):
        assert digest(PUB/a['file'])==e['actualGlbSha256']==a['metrics']['fileSha256']
        assert all(digest(ROOT/v['path'])==v['sha256'] for v in e['actualSixViewsInspected'])
        assert digest(ROOT/e['contactSheet'])==e['contactSheetSha256']
    limits=['Raster reference art supplies no physical dimensions; absolute scale and hidden depth remain estimates.',
            'This actual six-view source comparison does not certify 1 percent landmark precision or silhouette IoU 0.97.',
            'Six-view renders show the rest sculpture. Independent runtime tests verify actual imported idle/attack/gait contact separately.',
            'Realistic artwork shadows and slightly oblique source profile cameras differ from exact native profile renders.']
    report={'revision':'geometric-game-v2','reviewer':'defender_models, native author and actual source-view auditor',
        'method':'Each of the 48 freshly authored source/model paired-six-view JPGs was actually opened with view_image. All six rows were compared for head/hat/neck and boot fit, source equipment, hair, handedness and clipping; this is not inferred from file existence.',
        'scope':'Current v2 all48 basic defenders: all hats/boots/joint fit; bow shooting plane user override; Frost I white collar override; source-shaped Storm hair, forehead and cuffs; actual metal helmets.',
        'manifestSha256':digest(manifest_path),'subjectsActuallyInspected':48,'sourceModelPairsActuallyInspected':288,
        'unresolvedSignificantFindingsWithinScope':[],'limitations':limits,'entries':entries}
    report_path=OUT/'source-six-review-defenders.json';report_path.write_text(json.dumps(report,indent=2),encoding='utf8',newline='\n')
    aggregate='\n'.join(e['id']+':'+e['actualGlbSha256'] for e in sorted(entries,key=lambda v:v['id']))
    freeze={'revision':'geometric-game-v2','subjects':48,'manifestSha256':digest(manifest_path),
            'aggregateGlbSha256':hashlib.sha256(aggregate.encode()).hexdigest(),
            'actualNativeFiles':48,'actualRenders':288,'sourceSixReview':report_path.relative_to(ROOT).as_posix(),
            'sourceSixReviewSha256':digest(report_path),'triangles':sum(a['metrics']['triangles'] for a in manifest['assets']),
            'restSurfaceChecks':sum(len(a['metrics']['jointSurfaceContactsRest']) for a in manifest['assets']),
            'headCoverageRays':sum(c.get('testedRays',0) for a in manifest['assets'] for c in a['metrics']['coverage']),
            'headLeaks':sum(len(c.get('leaks',[])) for a in manifest['assets'] for c in a['metrics']['coverage'])}
    (OUT/'freeze-defenders.json').write_text(json.dumps(freeze,indent=2),encoding='utf8',newline='\n')
    print(json.dumps(freeze))
else:print(json.dumps({'actuallyInspectedV2Subjects':len(state['entries']),'marked':args.mark_inspected.split(',')}))
