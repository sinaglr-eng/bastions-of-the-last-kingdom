"""Original Ashen Host miniatures, authored and rendered with Blender.
blender -b --python blender/scripts/author_enemies.py [--only host_01] [--no-render]
Editable sources, articulated GLBs and transparent portraits; no downloaded meshes.
"""
import bpy, sys, math, json
from pathlib import Path
from mathutils import Vector, Matrix
sys.path.insert(0,str(Path(__file__).resolve().parent))
import author_archer as A
from author_archer import cube,ellipsoid,cylinder,rod,custom,torus,mat
ROOT=A.ROOT; OUT=ROOT/'public/assets/enemies'; SOURCES=ROOT/'blender/scenes/enemies'
OUT.mkdir(parents=True,exist_ok=True);SOURCES.mkdir(parents=True,exist_ok=True)
DATA=json.loads((ROOT/'data/enemies.json').read_text(encoding='utf-8'))

def clear():
    for o in list(bpy.context.scene.objects):bpy.data.objects.remove(o,do_unlink=True)

def meshes():return [o for o in bpy.context.scene.objects if o.type=='MESH']

def joint(name,origin,parts):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=origin
    bpy.context.view_layer.update()
    for part in parts:
        matrix=part.matrix_world.copy();part.parent=o;part.matrix_world=matrix
    return o

def palette(e):
    clan=e.get('clan',0)
    return {k:mat(k,c,.65 if k in ['Iron','Copper'] else 0,.5 if k=='Soul' else 0) for k,c in dict(
        Skin=['7d965e','909068','719188','978271','8994a1'][clan],Shadow='3b5141',Eye='f6d288',Dark='202b2b',
        Cloth=['ad563b','88608e','458c98','ab8c3b','765594'][clan],Leather='593e31',Iron='6d7e80',Copper='c19b64',
        Bone='e1d3ae',Wood='73533b',Soul=['aac967','bd7eaf','67d0d4','f2b467','b9a7ed'][clan]).items()}

def orc(p,gear='axe',wave=1,boss=False):
    # A compact, muscular silhouette with cheeks, brow planes, ears and proper tusks.
    for side in [-1,1]:
        start=set(meshes());x=side*.14
        cube('Iron-toed boot',(x,.04,.105),(.21,.34,.18),p['Leather'],.03)
        cube('Boot toe plate',(x,.17,.15),(.20,.09,.07),p['Iron'],.016)
        rod('Shin',(x,0,.21),(x,-.01,.52),.095,p['Shadow'],8,end=.075)
        rod('Thigh',(x,-.01,.50),(side*.10,0,.79),.11,p['Skin'],8,end=.12)
        cube('Knee plate',(x,.09,.48),(.16,.06,.13),p['Iron'],.025)
        joint('leg_'+('L' if side<0 else 'R'),(side*.1,0,.79),set(meshes())-start)
    cylinder('Layered leather kilt',(0,0,.78),.25,.28,p['Leather'],10,top=.19)
    for j in range(6):
        a=j*math.tau/6;panel=cube('Clan skirt panel',(.20*math.cos(a),.20*math.sin(a),.76),(.18,.055,.24),p['Cloth'],.015);panel.rotation_euler[2]=a-math.pi/2
    ellipsoid('Barrel torso',(0,-.015,1.12),(.29,.19,.35),p['Skin'],12,7)
    for x in [-.115,.115]:ellipsoid('Sculpted chest',(x,.145,1.22),(.15,.07,.12),p['Skin'],10,5)
    rod('Diagonal chest strap',(-.23,.17,1.36),(.18,.19,.91),.043,p['Leather'],6)
    cylinder('Belt',(0,0,.93),.22,.083,p['Leather'],10)
    cube('Clan belt buckle',(0,.218,.93),(.11,.04,.1),p['Copper'],.01)
    for side in [-1,1]:
        shoulder=(side*.28,0,1.32);elbow=(side*.39,.02,1.07);hand=(side*.43,.17,.92)
        ellipsoid('Deltoid',shoulder,(.16,.15,.17),p['Skin'],10,6)
        rod('Upper arm',shoulder,elbow,.12,p['Skin'],9,end=.10)
        rod('Forearm bracer',elbow,hand,.105,p['Leather'],8,end=.077)
        ellipsoid('Clenched knuckles',hand,(.09,.085,.09),p['Skin'],10,5)
        for dz in [-.045,0,.045]:cube('Finger ridge',(side*.43,.23,.92+dz),(.095,.038,.025),p['Skin'],.01)
    cylinder('Neck',(0,0,1.44),.13,.15,p['Skin'],10)
    ellipsoid('Orc cranium',(0,.015,1.65),(.21,.16,.24),p['Skin'],12,7)
    ellipsoid('Heavy lower jaw',(0,.125,1.55),(.19,.105,.115),p['Shadow'],10,5)
    cube('Broad nose',(0,.177,1.67),(.095,.085,.10),p['Skin'],.023)
    for side in [-1,1]:
        x=side*.081
        cube('Deep eye socket',(x,.149,1.735),(.09,.04,.063),p['Dark'],.016)
        cube('Amber eye',(x,.177,1.737),(.041,.014,.024),p['Eye'],.006)
        brow=cube('Angry brow',(x,.176,1.782),(.12,.045,.041),p['Skin'],.016);brow.rotation_euler[1]=side*.20
        custom('Pointed ear',[(side*.17,0,1.71),(side*.37,-.045,1.83),(side*.22,.018,1.58),(side*.23,.04,1.72)],[(0,1,3),(1,2,3),(2,0,3),(0,2,1)],p['Skin'])
        rod('Ivory tusk',(side*.115,.21,1.55),(side*.145,.23,1.71),.043,p['Bone'],7,end=.005)
        ring=torus('Ear ring',(side*.24,.025,1.65),.04,.009,p['Copper']);ring.rotation_euler[0]=math.pi/2
    for j in range(5):
        y=-.13+j*.052;cylinder('Braided crest',(0,y,1.87+math.sin(j*.7)*.035),.055,.18,p['Cloth'],6,top=.016)
    # Paired shoulder plates read clearly from the strategy camera.
    ellipsoid('Forged shoulder plate',(-.28,-.01,1.38),(.19,.17,.075),p['Iron'],10,5)
    for x in [-.4,-.28,-.16]:rod('Shoulder tooth',(x,-.01,1.4),(x-.025,-.015,1.56),.036,p['Bone'],6,end=.004)
    if gear in ['axe','berserker','boss']:
        rod('Axe haft',(.43,.16,.43),(.43,.16,1.43),.032,p['Wood'],8)
        for z in [.56,.72,.88]:cylinder('Wrapped grip',(.43,.16,z),.041,.05,p['Leather'],8)
        custom('Crescent cleaver',[(.42,.12,1.42),(.72,.12,1.52),(.81,.12,1.30),(.69,.12,1.09),(.43,.12,1.18),(.42,.20,1.42),(.72,.20,1.52),(.81,.20,1.30),(.69,.20,1.09),(.43,.20,1.18)],[(0,1,2,3,4),(9,8,7,6,5),(0,5,6,1),(1,6,7,2),(2,7,8,3),(3,8,9,4),(4,9,5,0)],p['Iron'])
        rod('Cleaver bright edge',(.77,.11,1.44),(.73,.11,1.20),.013,p['Copper'],5)
    if gear in ['shield','boss']:
        cube('Tower shield',(-.45,.27,1.00),(.37,.11,.66),p['Iron'],.05)
        cube('Shield painted face',(-.45,.335,1.01),(.26,.025,.52),p['Cloth'],.025)
        ellipsoid('Shield iron boss',(-.45,.368,1.02),(.075,.032,.075),p['Copper'],10,5)
        for z in [.75,1.27]:cube('Shield rim',(-.45,.36,z),(.30,.028,.032),p['Bone'],.008)
    if gear in ['assassin','goblin']:
        for side in [-1,1]:rod('Curved dagger',(side*.43,.19,.92),(side*.52,.29,1.40),.065,p['Iron'],5,end=.003)
        cube('Shadow face mask',(0,.217,1.60),(.27,.06,.12),p['Cloth'],.02)
        for j in range(3):rod('Trophy dagger',(0.05+j*.06,-.19,.91),(.13+j*.07,-.22,1.43),.02,p['Iron'],5,end=.003)
    if gear in ['shaman','warlock','troll']:
        rod('Crooked ritual staff',(.43,.17,.08),(.43,.17,1.95),.041,p['Wood'],8)
        rod('Staff fork',(.43,.17,1.72),(.61,.17,1.98),.028,p['Wood'],6,end=.01)
        ellipsoid('Skull staff head',(.43,.17,1.94),(.13,.10,.14),p['Bone'],10,5)
        for x in [.386,.474]:ellipsoid('Skull eye',(x,.26,1.98),(.03,.022,.03),p['Soul'],8,4)
        for j in range(7):
            a=j*math.pi/6;ellipsoid('Ritual necklace',(.21*math.cos(a),.175,1.35-.15*math.sin(a)),(.024,.023,.047),p['Bone'],8,4)
        if gear=='warlock':
            book=cube('Chained spellbook',(-.46,.25,1.10),(.31,.13,.26),p['Cloth'],.02);book.rotation_euler[1]=-.2
            cube('Grimoire clasp',(-.46,.32,1.1),(.04,.02,.27),p['Copper'],.006)
        if gear=='troll':
            for x,y,z in [(-.16,-.15,1.45),(.18,-.19,1.38),(0,-.21,1.60)]:
                rod('Mushroom stem',(x,y,z),(x,y,z+.15),.02,p['Bone'],6);ellipsoid('Toadstool',(x,y,z+.15),(.13,.1,.045),p['Cloth'],10,4)
    if gear=='sapper':
        cylinder('Powder barrel',(0,-.24,1.14),.21,.53,p['Wood'],12)
        for z in [.9,1.18,1.36]:torus('Barrel iron hoop',(0,-.24,z),.216,.026,p['Iron'])
        ellipsoid('Bomb in hand',(.45,.18,.94),(.14,.14,.14),p['Iron'],12,6)
        rod('Lit fuse',(.46,.17,1.06),(.49,.17,1.22),.019,p['Copper'],5)
        for x in [-.085,.085]:
            glass=torus('Copper goggles',(x,.19,1.735),.06,.014,p['Copper']);glass.rotation_euler[0]=math.pi/2
            ellipsoid('Goggle lens',(x,.198,1.735),(.046,.015,.046),p['Soul'],10,5)
    if wave>=20:
        for side in [-1,1]:rod('Veteran trophy horn',(side*.18,-.08,1.8),(side*.30,-.12,2.03),.055,p['Bone'],7,end=.007)
    if boss:
        for j in range(5):
            a=j*math.tau/5;rod('Warlord crown spike',(.19*math.cos(a),.14*math.sin(a),1.86),(.23*math.cos(a),.18*math.sin(a),2.13),.033,p['Copper'],6,end=.004)
        cube('War banner pole',(-.23,-.28,1.42),(.042,.042,1.40),p['Wood'],.01)
        custom('Clan war banner',[(-.23,-.28,2.1),(.2,-.28,2.1),(.2,-.29,1.56),(-.03,-.30,1.7),(-.23,-.28,1.58)],[(0,1,2,3,4)],p['Cloth'])
        darksteel=mat('Warlord blackened steel','354348',.7)
        cube('Warlord articulated cuirass',(0,.17,1.19),(.48,.075,.32),darksteel,.045)
        for j in range(3):cube('Overlapping warlord belly plate',(0,.20,1.13-j*.084),(.40-j*.028,.055,.105),darksteel,.02)
        for side in [-1,1]:
            ellipsoid('Warlord mantle plate',(side*.28,-.08,1.44),(.21,.19,.085),darksteel,12,6)
            rod('Swept warlord horn',(side*.14,-.06,1.84),(side*.37,-.16,2.16),.068,p['Bone'],9,end=.006)
        # Each clan ruler carries a recognisable relic, rather than a larger grunt.
        if wave==10:
            for side in [-1,1]:
                ellipsoid('Gatebreaker skull trophy',(side*.24,-.16,1.45),(.085,.07,.1),p['Bone'],12,7)
                for dx in [-.026,.026]:ellipsoid('Trophy eye socket',(side*.24+dx,-.095,1.48),(.018,.015,.02),p['Dark'],8,5)
            cube('Gatebreaker axe counterweight',(.43,.16,1.35),(.14,.20,.15),p['Copper'],.02)
        elif wave==20:
            for side in [-1,1]:
                rod('Hex crown antler',(side*.18,-.08,1.87),(side*.31,-.10,2.24),.043,p['Bone'],8,end=.008)
                rod('Hex crown fork',(side*.25,-.09,2.07),(side*.47,-.09,2.14),.026,p['Bone'],8,end=.005)
            talisman=torus('Rift relic',(.43,.18,1.78),.19,.029,p['Copper']);talisman.rotation_euler[0]=math.pi/2
            ellipsoid('Rift captive soul',(.43,.18,1.78),(.082,.065,.12),p['Soul'],16,8)
        elif wave==30:
            for side in [-1,1]:rod('Tide sovereign fins',(side*.20,-.12,1.62),(side*.39,-.21,1.88),.071,p['Copper'],8,end=.004)
            for j in range(3):ellipsoid('Tide scale gorget',((j-1)*.14,.19,1.37),(.09,.044,.061),p['Soul'],12,6)
        elif wave==40:
            ember=mat('Molten ruler veins','ffa65e',.1,1.8)
            for side in [-1,1]:
                for j in range(3):rod('Molten shoulder crack',(side*(.18+j*.052),.075,1.48),(side*(.20+j*.058),.072,1.41),.009,ember,6)
            for j in range(5):rod('Sun tyrant crown',(j*.07-.14,.03,1.90),(j*.105-.21,.03,2.23-abs(j-2)*.035),.03,p['Copper'],8,end=.003)
        elif wave==50:
            for side in [-1,1]:
                for j in range(3):rod('Sovereign skeletal mantle',(side*.23,-.13,1.39),(side*(.40+j*.12),-.2,1.70-j*.09),.046,p['Bone'],9,end=.005)
            ellipsoid('Sovereign soul crown',(0,-.02,2.19),(.095,.07,.115),p['Soul'],16,9)
            for j in range(4):rod('Sovereign crown spire',((j-1.5)*.085,-.02,1.87),((j-1.5)*.12,-.04,2.31),.032,darksteel,8,end=.004)

def mount(p,kind,wave,boss=False):
    # Bat/wyvern cavalry and wolf packs share a saddled beast, never a building.
    before=set(bpy.context.scene.objects);orc(p,'boss' if boss else 'shaman' if wave%3==0 else 'goblin',wave,boss)
    bpy.context.view_layer.update()
    for o in set(bpy.context.scene.objects)-before:
        if not o.parent:o.matrix_world=Matrix.Translation((0,-.04,.65))@Matrix.Diagonal((.60,.60,.60,1))@o.matrix_world
    fur=p['Shadow'] if kind in ['wolf','bat'] else p['Skin']
    ellipsoid('Beast chest',(0,0,.63),(.25,.46,.29),fur,12,7)
    ellipsoid('Beast head',(0,.42,.88),(.20,.24,.22),fur,12,6)
    ellipsoid('Long muzzle',(0,.60,.82),(.13,.21,.12),fur,10,5)
    ellipsoid('Wet nose',(0,.76,.84),(.10,.043,.075),p['Dark'],10,5)
    for side in [-1,1]:
        ellipsoid('Beast amber eye',(side*.145,.55,.96),(.03,.025,.026),p['Eye'],8,4)
        rod('Beast ear',(side*.14,.40,1.0),(side*.22,.35,1.22),.07,fur,6,end=.003)
        rod('Harness reins',(side*.14,.61,.78),(side*.25,.10,1.25),.014,p['Leather'],6)
        for y in [-.26,.26]:
            start=set(meshes());rod('Beast leg',(side*.17,y,.60),(side*.22,y+.07,.14),.085,fur,8,end=.044);ellipsoid('Beast paw',(side*.22,y+.11,.1),(.09,.14,.08),fur,10,5)
            joint('leg_mount_'+str(side)+'_'+str(y),(side*.17,y,.60),set(meshes())-start)
    rod('Beast tail',(0,-.36,.69),(.08,-.86,.81),.08,fur,7,end=.008)
    cube('Copper saddle',(0,-.02,.90),(.4,.35,.10),p['Leather'],.035)
    if kind!='wolf':
        for side in [-1,1]:
            start=set(meshes());vertices=[(side*.13,-.02,.88),(side*.62,.15,1.22),(side*.96,.16,1.10),(side*.79,-.13,.91),(side*.9,-.40,.67),(side*.51,-.31,.70),(side*.16,-.34,.63)]
            custom('Scalloped flight membrane',vertices,[(0,1,5),(1,2,3,5),(3,4,5),(0,5,6)],p['Cloth'])
            for k in [1,3,5]:rod('Wing finger',vertices[0],vertices[k],.025,fur,6,end=.01)
            rod('Wing leading edge',vertices[1],vertices[2],.026,fur,6,end=.009)
            wing_joint=joint('wing_'+str(side),(side*.13,-.02,.88),set(meshes())-start)
            if boss:wing_joint.scale=(1.7,1.3,1.15)
        if boss:
            for side in [-1,1]:
                rod('Armored drake horn',(side*.13,.37,1.03),(side*.22,.26,1.35),.073,p['Copper'],9,end=.006)
                for y in [.56,.66]:rod('Drake jaw fang',(side*.095,y,.79),(side*.13,y,.68),.025,p['Bone'],8,end=.003)
                ellipsoid('Boss drake brow',(side*.14,.51,1.005),(.087,.10,.045),p['Copper'],12,6)
                for y in [-.27,.26]:
                    for j in range(3):rod('Royal drake claw',(side*.22+(j-1)*.045,y+.17,.10),(side*.22+(j-1)*.057,y+.28,.035),.021,p['Bone'],8,end=.002)
            ellipsoid('Royal drake lower jaw',(0,.59,.74),(.15,.22,.055),p['Shadow'],16,8)
            custom('Armored drake snout',[(-.14,.47,.9),(.14,.47,.9),(.12,.76,.87),(-.12,.76,.87),(-.10,.71,1.0),(.10,.71,1.0)],[(0,1,5,4),(4,5,2,3),(0,4,3),(1,2,5),(0,3,2,1)],p['Skin'])
            tail=[(0,-.35,.7),(.12,-.64,.63),(.32,-.91,.68),(.40,-1.10,.85),(.35,-1.22,1.04)]
            for j,(a,b) in enumerate(zip(tail,tail[1:])):rod('Royal drake sweeping tail',a,b,.10-j*.02,p['Skin'],10,end=.08-j*.02)
            for y in [-.4,-.21,0,.2]:rod('Royal drake spine',(0,y,.94),(0,y-.06,1.16),.051,p['Copper'],8,end=.004)
        if kind=='dragon':
            for y in [-.55,-.34,-.12]:cylinder('Dragon back ridge',(0,y,.9),.06,.27,p['Copper'],5,top=0)

def balloon(p,wave):
    orc(p,'sapper',wave)
    bpy.context.view_layer.update()
    # A goblin in a copper gondola under a patched silk battle kite.
    for o in list(bpy.context.scene.objects):
        if not o.parent:o.matrix_world=Matrix.Translation((0,0,.03))@Matrix.Diagonal((.50,.50,.50,1))@o.matrix_world
    cube('Armored gondola',(0,0,.32),(.66,.56,.38),p['Wood'],.05)
    for x in [-.28,.28]:
        for y in [-.22,.22]:rod('Suspension cable',(x,y,.42),(x*1.3,y*1.3,1.30),.012,p['Copper'],5)
    ellipsoid('Patched silk envelope',(0,0,1.51),(.56,.43,.58),p['Cloth'],12,8)
    for x in [-.27,0,.27]:rod('Envelope binding',(x,-.36,1.25),(x,-.36,1.77),.019,p['Copper'],6)
    cube('Sewn silk patch',(.30,-.36,1.49),(.16,.04,.22),p['Leather'],.01)
    for y in [-.22,.22]:rod('Bomb rack',(-.32,y,.17),(.32,y,.17),.025,p['Iron'],6)
    for x in [-.19,0,.19]:ellipsoid('Hanging iron bomb',(x,0,.06),(.085,.085,.10),p['Iron'],10,5)

def build(e,wave):
    p=palette(e);kind=e.get('model','grunt')
    if kind in ['wolf','bat','wyvern','dragon']:mount(p,kind,wave,e.get('boss',False))
    elif kind=='balloon':balloon(p,wave)
    else:orc(p,{'grunt':'axe','ogre':'boss','berserker':'berserker'}.get(kind,kind),wave,e.get('boss',False))
    if e.get('boss'):
        for side in [-1,1]:rod('Boss victory tusk',(side*.24,-.15,1.42),(side*.39,-.23,1.95),.066,p['Bone'],7,end=.008)
    if e.get('refraction'):
        group=bpy.data.objects.new('refraction_shards',None);bpy.context.collection.objects.link(group)
        for j in range(3):
            a=j*math.tau/3;o=ellipsoid('Mirror shard',(.35*math.cos(a),.30*math.sin(a),1.5),(.065,.045,.14),p['Soul'],5,4);o.parent=group
    if e.get('physicalImmune') or e.get('magicImmune'):
        for side in [-1,1]:ellipsoid('Enchanted armor seal',(side*.23,.13,1.24),(.065,.035,.085),p['Soul'],6,4)
    A.cohesive.hostile()
    A.cohesive.budget_meshes()
    bpy.context.view_layer.update()
    points=[o.matrix_world@Vector(v) for o in meshes() for v in o.bound_box]
    lo=min(p.z for p in points);height=max(p.z for p in points)-lo
    target=3.15+(wave/50)*.25 if e.get('boss') else 1.82 if kind=='goblin' else 1.98
    transform=Matrix.Diagonal((target/height,)*3+(1,))@Matrix.Translation((0,0,-lo))
    for o in list(bpy.context.scene.objects):
        if not o.parent:o.matrix_world=transform@o.matrix_world

def export(file):
    # Batch by material AND articulation parent so legs/wings retain useful pivots.
    groups={}
    for o in meshes():groups.setdefault((o.parent,o.data.materials[0],o if o.parent and o.parent.name=='refraction_shards' else None),[]).append(o)
    for (parent,material,_),parts in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in parts:o.select_set(True)
        bpy.context.view_layer.objects.active=parts[0]
        if len(parts)>1:bpy.ops.object.join()
        parts[0].name='mesh_'+material.name
    bpy.ops.object.select_all(action='SELECT')
    count=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes())
    if count>10000:raise ValueError(f'{file} has {count} triangles')
    bpy.ops.export_scene.gltf(filepath=str(OUT/file),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False)
    return count

def generate():
    only=sys.argv[sys.argv.index('--only')+1] if '--only' in sys.argv else None
    entries=json.loads((OUT/'manifest.json').read_text()) if (OUT/'manifest.json').exists() else []
    roster=[(id,e) for id,e in DATA.items() if id.startswith('host_') and (not only or id==only)]
    if not only:roster.append(('host_05-balloon',{**DATA['host_05'],'model':'balloon'}))
    for id,e in roster:
        clear();wave=int(id.split('_')[1].split('-')[0]);build(e,wave)
        # Preserve the individually named authoring pieces in the editable source.
        cam=A.configure_scene();points=[o.matrix_world@Vector(v) for o in meshes() for v in o.bound_box];centre=Vector((0,0,(max(p.z for p in points)+min(p.z for p in points))/2))
        cam.location=centre+Vector((-3.5,6,2.8));cam.rotation_euler=(centre-cam.location).to_track_quat('-Z','Y').to_euler()
        bpy.context.view_layer.update()
        projected=[cam.matrix_world.inverted()@p for p in points]
        width=max(p.x for p in projected)-min(p.x for p in projected);height=max(p.y for p in projected)-min(p.y for p in projected)
        cam.data.ortho_scale=max(2.5,height*1.14,width*1.14/(280/320))
        scene=bpy.context.scene;scene.render.resolution_x=280;scene.render.resolution_y=320;scene.render.resolution_percentage=100;scene.cycles.samples=16
        scene['Warband']=e['name'];scene['Authoring']='Original Ashen Host; approved archer material language'
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCES/(id+'.blend')))
        if '--no-render' not in sys.argv:scene.render.filepath=str(OUT/(id+'.png'));bpy.ops.render.render(write_still=True)
        for o in list(scene.objects):
            if o.type in ['LIGHT','CAMERA']:bpy.data.objects.remove(o,do_unlink=True)
        triangles=export(id+'.glb');entries=[x for x in entries if x['id']!=id];entries.append(dict(id=id,file=id+'.glb',portrait=id+'.png',style='ashen-host-v2',triangles=triangles,authoring='Blender',name=e['name']))
        (OUT/'manifest.json').write_text(json.dumps(entries,indent=2)+'\n',encoding='utf-8');print(f'HOST {id}: {triangles} triangles',flush=True)

if __name__=='__main__':generate()
