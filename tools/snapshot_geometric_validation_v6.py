"""Read-only SHA binding of exact V6 release inputs before validation starts."""
from pathlib import Path
import argparse,datetime,hashlib,json,subprocess

def sha(path):
 digest=hashlib.sha256()
 with path.open('rb')as source:
  for chunk in iter(lambda:source.read(2*1024*1024),b''):digest.update(chunk)
 return digest.hexdigest()

def rows(manifest):return manifest.get('entries',manifest.get('assets',[]))

def collect_validation_inputs(root):
 root=Path(root).resolve()
 names=set(subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0'))
 for base in ['game','data','tests','ui','tools','backend','.github','docs','blender/scripts']:
  for path in (root/base).rglob('*'):
   if path.is_file()and '__pycache__'not in path.parts and path.suffix not in ['.pyc','.pyo']:names.add(path.relative_to(root).as_posix())
 names={name for name in names if name and(root/name).is_file()and not name.startswith(('output/','blender/scenes/','blender/renders/','public/'))}
 names.update(['public/release.json','public/assets/scenery/manifest.json']+[f'public/assets/geometric/geometric-{category}.json'for category in ['defenders','champions','enemies']])
 models=set();subjects=[]
 for category,count in [('defenders',48),('champions',38),('enemies',50)]:
  manifest=json.loads((root/f'public/assets/geometric/geometric-{category}.json').read_text(encoding='utf-8-sig'))
  entries=rows(manifest);assert len(entries)==count and len({row['id']for row in entries})==count
  if category=='enemies':assert manifest['revision']=='geometric-game-v6'
  for row in entries:
   original=row.get('source',row.get('sourceFile'));native=row.get('native',row.get('nativeFile'))
   paths=['public/assets/geometric/'+row['file'],'public/assets/geometric/'+row['portrait'],native,
    'output/design/geometric-turnarounds-v1/'+original,'public/geometric-turnarounds-v1/'+original]
   assert all((root/path).is_file()for path in paths),(row['id'],paths)
   models.update(paths);subjects.append(row['id'])
 assert len(subjects)==len(set(subjects))==136 and len(models)==680
 evidence=set()
 prefix='output/design/geometric-game-v6/'
 for name in ['geometric-defenders.json','geometric-champions.json','geometric-enemies.json','native-dependencies.json','portrait-dependencies.json']:
  evidence.add(prefix+'baseline-v5-manifests/'+name)
 boss_manifest=prefix+'baseline-v5-glbs/manifest.json'
 evidence.add(boss_manifest)
 bosses=json.loads((root/boss_manifest).read_text(encoding='utf-8-sig'))['entries']
 assert len(bosses)==5 and {row['id']for row in bosses}=={f'host_{number:02d}'for number in [10,20,30,40,50]}
 for row in bosses:
  assert sha(root/row['file'])==row['sha256']
  evidence.add(row['file'])
 for name in ['enemy-initial-six-view-review.json','independent-helmet-source-intervals.json','source-six-review-defenders.json','source-six-review-champions.json','source-six-review-enemies.json','source-six-review-humanoid-enemies-v6.json','source-six-review-mounted-enemies.json','enemy-final-source-resolution-audit.json','champion-physical-shape-audit.json','mounted-final-manual-review-notes.json','mounted-final-inspection-snapshot.json','independent-root-source-spotcheck-v6.json','independent-final-seventeen-enemy-source-spotcheck-v6.json']:
  evidence.add(prefix+name)
 record=lambda selected:[{'file':name,'sha256':sha(root/name)}for name in sorted(selected)]
 return {'sourceFiles':record(names),'modelFiles':record(models),'evidenceInputs':record(evidence),'subjects':sorted(subjects)}

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--output',required=True);args=parser.parse_args()
 root=Path(__file__).resolve().parents[1];inputs=collect_validation_inputs(root)
 report={'version':'0.3.5','createdBeforeTestRunAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'Actual code, canonical manifests, all136 model/native/portrait/original source inputs and frozen review dependencies hashed before pnpm test/build. Validation binder requires identical paths and bytes afterward.','inputs':inputs}
 target=root/args.output;target.parent.mkdir(parents=True,exist_ok=True)
 target.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8',newline='\n')
 print(json.dumps({'preTestSnapshot':args.output,'sourceFiles':len(inputs['sourceFiles']),'modelFiles':len(inputs['modelFiles']),'subjects':len(inputs['subjects']),'evidenceInputs':len(inputs['evidenceInputs'])}))

if __name__=='__main__':main()
