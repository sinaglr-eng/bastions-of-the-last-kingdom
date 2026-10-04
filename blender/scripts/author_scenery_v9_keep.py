"""Add editable ashlar relief to the actual V7 castle; retain its settlement.

Existing geometry and transforms are preserved. Only plain curtain-wall faces
receive a darker mortar material and small fitted stone faces. V7 stays frozen.
"""
import bpy, math, sys, json, hashlib, re
from pathlib import Path
from mathutils import Vector, Matrix
sys.path.insert(0, str(Path(__file__).resolve().parent))
import author_scenery_v6 as V6
S, V4, V5 = V6.S, V6.V4, V6.V5
PROOF = S.ROOT / 'output/design/battlefield-refinements-v10'
PROOF.mkdir(parents=True, exist_ok=True)
SOURCE = S.SCENES / 'royal-castle-v7.blend'

def fingerprint(obj):
    return hashlib.sha256(json.dumps({
        'vertices': [list(v.co) for v in obj.data.vertices],
        'faces': [list(p.vertices) for p in obj.data.polygons],
        'matrix': [list(row) for row in obj.matrix_world]
    }, separators=(',', ':')).encode()).hexdigest()

def royal_town_v9():
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    V5.remove(o for o in bpy.context.scene.objects if o.get('sceneryRole') == 'manifest')
    originals = {o.name: fingerprint(o) for o in bpy.context.scene.objects if o.type == 'MESH' and not o.get('reviewOnly')}
    S.P = {
        'v9Mortar': S.A.mat('V9 recessed limestone mortar', '879184'),
        'v9AshlarA': S.A.mat('V9 weathered limestone face', 'aab3a0'),
        'v9AshlarB': S.A.mat('V9 pale dressed limestone face', 'bbc3af'),
        'v9AshlarC': S.A.mat('V9 warm dressed limestone face', 'b1baa7')
    }
    walls = [o for o in bpy.context.scene.objects if o.type == 'MESH' and re.search(r'parapet wall(?:\.\d+)?$', o.name)]
    count = 0
    records = []
    for wall_index, wall in enumerate(walls):
        xs, ys, zs = zip(*(tuple(p) for p in wall.bound_box))
        xmin, xmax, ymin, ymax, zmin, zmax = min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)
        length, height = xmax-xmin, zmax-zmin
        rows = max(3, round(height/.30))
        pitch = height/rows
        wall.data.materials.clear(); wall.data.materials.append(S.P['v9Mortar'])
        stones = 0
        for row in range(rows):
            # Alternating bond and narrow real mortar gaps, fitted to both ends.
            width=.62; offset=width/2 if row%2 else 0
            cursor=xmin-offset
            column=0
            while cursor < xmax-1e-6:
                left, right = max(xmin, cursor)+.010, min(xmax, cursor+width)-.010
                if right-left > .055:
                    for side, face in [(-1,ymin),(1,ymax)]:
                        pos=((left+right)/2, face+side*.010, zmin+(row+.5)*pitch)
                        part=S.box(wall.name+' ashlar '+str(row)+' '+str(column)+' '+str(side), pos, (right-left,.028,pitch-.018), ['v9AshlarA','v9AshlarB','v9AshlarC'][(row+column+wall_index)%3])
                        # Build the transform explicitly: a just-created mesh's
                        # dependency-graph matrix may still precede its location.
                        part.matrix_world=wall.matrix_world @ Matrix.Translation(Vector(pos))
                        part['masonryCourse']=row; part['cosmeticOnly']=True
                        stones+=1; count+=1
                cursor+=width; column+=1
        marker=V4.marker('Dressed '+wall.name,'ashlarCurtainWall',tuple(wall.location),cosmeticOnly=True,gameplayEffect='none',courses=rows,stones=stones,mortarGap=.018,reliefDepth=.024)
        records.append({'wall':wall.name,'courses':rows,'stones':stones,'length':length,'height':height})
    assert len(walls)>=7 and count>400, 'All complete royal curtain walls need masonry'
    bpy.context.view_layer.update()
    assert all(fingerprint(bpy.data.objects[name]) == digest for name,digest in originals.items()), 'Inherited geometry and transforms must remain exact'
    proof={'inherits':str(SOURCE),'inheritedSourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'inheritedMeshCount':len(originals),'allInheritedGeometryAndTransformsPreserved':True,'walls':records,'addedStoneFaces':count,'gameplayEffect':'none'}
    (PROOF/'castle-masonry-source-proof.json').write_text(json.dumps(proof,indent=2)+'\n',encoding='utf-8')
    bpy.context.scene['V9 inherited source']='royal-castle-v7.blend'
    bpy.context.scene['V9 masonry']='Alternating limestone bond with recessed mortar on both curtain faces'

if __name__ == '__main__':
    entry=V6.export_v6('royal-castle-v9',royal_town_v9,(11,13,4),94,(-42,-61,49))
    entry.update(style='scenery-v9',inherits='royal-castle-v7.blend',gameplayEffect='none')
    path=S.OUT/'manifest.json'; previous=json.loads(path.read_text())
    path.write_text(json.dumps([item for item in previous if item['file']!=entry['file']]+[entry],indent=2)+'\n',encoding='utf-8')
    from shutil import copyfile
    copyfile(S.REVIEW/'royal-castle-v9-review.png',PROOF/'castle-masonry-overview.png')
    scene=bpy.context.scene; camera=scene.camera
    camera.location=(-15,-20,7); target=Vector((-11,-3,1.2))
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler(); camera.data.ortho_scale=13
    scene.render.resolution_x=1400; scene.render.resolution_y=900;scene.render.filepath=str(PROOF/'castle-masonry-detail.png')
    bpy.ops.render.render(write_still=True)
