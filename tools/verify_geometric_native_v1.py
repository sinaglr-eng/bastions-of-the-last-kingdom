"""Read every editable .blend and verify its packed reference and export geometry.

Run with Blender --background --python tools/verify_geometric_native_v1.py.
The default check never changes files. An explicit --repair-packed-reference
repairs only a missing packed source, then reopens the saved file for verification.
"""
import hashlib,json,sys
from pathlib import Path
import bpy

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'blender/scripts'))
from geometric_game_common import metrics,geometry_digest

def main():
    repair='--repair-packed-reference' in sys.argv
    category=sys.argv[sys.argv.index('--category')+1] if '--category' in sys.argv else None
    sources={entry['id']:entry for entry in json.loads((ROOT/'public/assets/geometric/source-manifest.json').read_text(encoding='utf-8'))}
    entries=[]
    for group in (category,) if category else ('defenders','champions','enemies'):
        manifest=json.loads((ROOT/'public/assets/geometric'/('geometric-'+group+'.json')).read_text(encoding='utf-8'))
        entries.extend(manifest.get('assets',manifest.get('entries',[])))
    assert len(entries)==({'defenders':48,'champions':38,'enemies':50}[category] if category else 136)
    results=[];repaired=0
    for entry in entries:
        native=ROOT/entry.get('native',entry.get('nativeFile',''))
        bpy.ops.wm.open_mainfile(filepath=str(native))
        root=bpy.data.objects.get(entry['id'])
        assert root and root.get('geometricRig'),(entry['id'],'editable articulated root')
        assert root.get('sourceSha256',root.get('referenceSha256'))==entry['sourceSha256'],(entry['id'],'native source provenance')
        packed=[image for image in bpy.data.images if image.packed_file and hashlib.sha256(bytes(image.packed_file.data)).hexdigest()==entry['sourceSha256']]
        if not packed and repair:
            original=geometry_digest([obj for obj in root.children_recursive if obj.type=='MESH'])
            source=ROOT/'public/geometric-turnarounds-v1'/sources[entry['id']]['file']
            assert hashlib.sha256(source.read_bytes()).hexdigest()==entry['sourceSha256']
            image=bpy.data.images.load(str(source));image.name=root.get('referenceImage','REFERENCE six views '+entry['id'])
            image.use_fake_user=True;image.pack()
            bpy.ops.wm.save_as_mainfile(filepath=str(native))
            bpy.ops.wm.open_mainfile(filepath=str(native));root=bpy.data.objects.get(entry['id'])
            assert geometry_digest([obj for obj in root.children_recursive if obj.type=='MESH'])==original,(entry['id'],'reference repair must preserve geometry')
            packed=[image for image in bpy.data.images if image.packed_file and hashlib.sha256(bytes(image.packed_file.data)).hexdigest()==entry['sourceSha256']]
            repaired+=1
        assert packed,(entry['id'],'actual latest six-view reference bytes are packed')
        objects=[obj for obj in root.children_recursive if obj.type=='MESH']
        qa=entry.get('qa',entry.get('metrics'));actual=metrics(objects)
        assert actual['triangles']==qa['triangles'],(entry['id'],'native/export triangles')
        assert actual['meshes']==qa['meshes'],(entry['id'],'native/export physical parts')
        assert actual['nonManifoldEdges']==0 and actual['degenerateTriangles']==0,(entry['id'],'native closed geometry')
        error=max(abs(actual[key][axis]-qa[key][axis]) for key in ('boundsMin','boundsMax') for axis in range(3))
        assert error<1e-5,(entry['id'],'native/export bounds',error)
        assert geometry_digest(objects)==qa['geometrySha256'],(entry['id'],'native/export immutable geometry')
        results.append({'id':entry['id'],'nativeFile':str(native.relative_to(ROOT)).replace('\\','/'),'nativeSha256':hashlib.sha256(native.read_bytes()).hexdigest(),'sourceSha256':entry['sourceSha256'],'packedReference':packed[0].name,'nativeExportBoundsError':error,'passed':True})
        print('VERIFIED '+entry['id'],flush=True)
    report={'models':len(results),'passed':sum(row['passed'] for row in results),'repairedPackedReferences':repaired,'allNativeReferencesPacked':True,'allNativeExportGeometryMatched':True,'results':results}
    path=ROOT/'output/design/geometric-game-v1'/('native-'+category+'-audit.json' if category else 'native-model-audit.json')
    path.write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps({key:value for key,value in report.items() if key!='results'}),flush=True)

if __name__=='__main__':main()
