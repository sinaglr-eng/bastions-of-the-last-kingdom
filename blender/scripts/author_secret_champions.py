"""Original secret royal champions, authored with Blender 5.2.

blender -b --python blender/scripts/author_secret_champions.py
Only the two secret entries are added to the current models manifest.
Lady Claire retains the exact preserved Kushek face and green eye geometry.
"""
import bpy, sys, math, json
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
import author_archer as A
import author_army as army
import author_kushek as K
import articulation
from author_archer import cube, ellipsoid, cylinder, rod, custom, torus, mat

ROOT=A.ROOT;OUT=ROOT/'public/assets/models';PORTRAITS=ROOT/'public/assets/army'
SOURCES=ROOT/'blender/scenes';REVIEWS=ROOT/'blender/renders/secret-champions-v1'
for folder in (OUT,PORTRAITS,SOURCES,REVIEWS):folder.mkdir(parents=True,exist_ok=True)


def meshes():return [o for o in bpy.context.scene.objects if o.type=='MESH']


def pivot(name,position=(0,0,0),parts=()):
    obj=articulation.pivot(name,position);articulation.attach(parts,obj);return obj


def arc(name,points,radius,material,vertices=8):
    return [rod(name,a,b,radius,material,vertices) for a,b in zip(points,points[1:])]


def fuse(parts,name,material,budget=900,voxel=.014):
    return A.cohesive.fuse(parts,name,voxel,budget,material)


def royal_palette():
    return dict(cream=mat('Royal cream silk','eee3c7'),blue=mat('Royal blue velvet','325c9b'),
                gold=mat('Royal engraved gold','d8af58',.72),silver=mat('Bright silver plate','c8d1d3',.78),
                steel=mat('Honed silver blade','dae6e7',.78),leather=mat('Fine chestnut leather','654632'),
                dark=mat('Royal dark seam','273446'),skin=mat('Warm human skin','e9b699'),
                white=mat('Horse ivory white coat','f1eee6'),mane=mat('Horse pearly white mane','fff9e8'),
                hoof=mat('Horse pale grey hoof','777e83'),hair=mat('Claire golden blonde hair','d8b865'),
                hairlight=mat('Claire blonde strand light','f1d48c'),eyewhite=mat('Warm eye whites','f9f3e4'),
                iris=mat('Clear green eyes','388956'),pupil=mat('Dark eye pupils','142722'),
                lips=mat('Claire rosy smile','a36560'),mouth=mat('Claire smiling mouth','674345'),
                magic=mat('Claire blue staff focus','86c8f3',.08,1.4),stone=mat('Royal pale limestone','adb4a0'),
                stoneedge=mat('Royal stone pedestal edge','66766b'))


def pedestal(p,radius=.44):
    cylinder('Octagonal royal footing',(0,0,.055),radius,.11,p['stoneedge'],8)
    cylinder('Beveled royal stone top',(0,0,.125),radius*.945,.07,p['stone'],8,top=radius*.89)
    torus('Golden secret champion inlay',(0,0,.166),radius*.805,.015,p['gold'])


def lady_claire():
    K.build(1,army)
    keep_prefixes=('Kushek sculpted human face','Kushek eye white','Kushek green iris','Kushek dark eye pupil',
                   'Kushek eye catchlight','Kushek blonde expressive eyebrow')
    for obj in list(bpy.context.scene.objects):
        if obj.type!='MESH' or not obj.name.startswith(keep_prefixes):bpy.data.objects.remove(obj,do_unlink=True)
    # This is the identical approved human face, rather than a newly generated
    # approximation. The face and eyes retain their original Kushek material.
    retained=meshes();head=pivot('head_pivot',(0,.018,1.686),retained)
    head['identitySource']='Preserved Kushek human face, green irises and eye highlights'
    p=royal_palette();pedestal(p)
    torso=pivot('torso_pivot',(0,0,.99))
    articulation.parent_keep_world(head,torso)
    before=set(meshes())
    bodice=[ellipsoid('Claire fitted elegant cream bodice',(0,.002,1.18),(.211,.151,.244),p['cream'],18,9),
            ellipsoid('Claire softly tapered dress waist',(0,0,1.018),(.176,.135,.118),p['cream'],16,8)]
    fuse(bodice,'Claire continuous fitted silk bodice',p['cream'],1100)
    # Hand-authored full-length pleats provide a dress silhouette, leaving no
    # trouser legs, bib, ponytail tie, work boots or carpenter tools.
    verts=[];segments=24
    for z,radius in [(1.015,.178),(.83,.23),(.56,.31),(.235,.40)]:
        for j in range(segments):
            angle=j*math.tau/segments;pleat=1.045 if j%2 else .975
            verts.append((math.cos(angle)*radius*pleat,math.sin(angle)*radius*.82*pleat,z+(.008 if j%2 and z<.3 else 0)))
    faces=[(row*segments+j,row*segments+(j+1)%segments,(row+1)*segments+(j+1)%segments,(row+1)*segments+j) for row in range(3) for j in range(segments)]
    skirt=custom('Claire long softly pleated cream dress',verts,faces,p['cream'])
    for poly in skirt.data.polygons:poly.use_smooth=True
    cylinder('Claire golden fitted waist belt',(0,0,1.025),.181,.041,p['gold'],20)
    # Royal-blue front silk falls in an uninterrupted tapered panel.
    panelverts=[(-.08,.158,1.38),(.08,.158,1.38),(.10,.193,1.05),(.10,.205,.84),(.145,.275,.55),(.19,.350,.241),(-.19,.350,.241),(-.145,.275,.55),(-.10,.205,.84),(-.10,.193,1.05)]
    custom('Claire royal blue dress front',panelverts,[(0,1,2,9),(9,2,3,8),(8,3,4,7),(7,4,5,6)],p['blue'])
    for side in (-1,1):
        arc('Claire dress gold embroidered border',[(side*.083,.169,1.38),(side*.104,.204,1.05),(side*.104,.216,.84),(side*.149,.286,.55),(side*.193,.361,.24)],.007,p['gold'],6)
    torus('Claire gold dress hem',(0,0,.244),.405,.009,p['gold']).scale.y=.82
    for side in (-1,1):
        ellipsoid('Claire small ivory slipper',(side*.13,.092,.206),(.086,.135,.030),p['cream'],12,6)
        ellipsoid('Claire golden collar clasp',(side*.094,.135,1.39),(.017,.012,.023),p['gold'],8,5)
    arc('Claire delicate necklace',[(-.13,.145,1.405),(-.07,.178,1.364),(0,.180,1.352),(.07,.178,1.364),(.13,.145,1.405)],.008,p['gold'],6)
    ellipsoid('Claire sapphire pendant',(0,.198,1.352),(.021,.012,.031),p['magic'],8,5)
    articulation.attach(set(meshes())-before,torso)
    # Open forehead with long loose side and rear locks; no fringe or bangs.
    before=set(meshes())
    hairparts=[ellipsoid('Claire open forehead blonde crown',(0,-.046,1.835),(.163,.111,.070),p['hair'],18,9),
               ellipsoid('Claire loose hair behind head',(0,-.112,1.66),(.152,.072,.232),p['hair'],16,8),
               ellipsoid('Claire loose hair below shoulders',(0,-.151,1.445),(.184,.071,.18),p['hair'],16,8)]
    for side in (-1,1):
        hairparts.extend([rod('Claire loose blonde side lock',(side*.143,-.018,1.787),(side*.173,-.05,1.49),.047,p['hair'],12,end=.036),
                          rod('Claire below shoulder hair curl',(side*.173,-.05,1.49),(side*.20,-.096,1.314),.040,p['hair'],12,end=.017)])
    fuse(hairparts,'Claire long loose blonde hair without bangs',p['hair'],1600,.010)
    for side in (-1,1):
        for j in range(3):
            arc('Claire individual flowing hair strand',[(side*(.123+j*.014),-.044,1.80),(side*(.16+j*.017),-.034,1.58),(side*(.17+j*.018),-.069,1.36)],.005,p['hairlight'],6)
    # A raised-corner smile has a visible, natural ivory tooth highlight.
    custom('Claire visible happy smile',[(-.038,.158,1.612),(0,.164,1.603),(.038,.158,1.612),(.025,.161,1.583),(0,.167,1.578),(-.025,.161,1.583)],[(0,1,5),(1,4,5),(1,2,3,4)],p['mouth'])
    custom('Claire smiling ivory teeth',[(-.031,.164,1.607),(0,.170,1.600),(.031,.164,1.607),(.025,.167,1.598),(0,.173,1.592),(-.025,.167,1.598)],[(0,1,5),(1,4,5),(1,2,3,4)],p['eyewhite'])
    arc('Claire smiling lower lip',[(-.025,.164,1.585),(0,.171,1.581),(.025,.164,1.585)],.004,p['lips'],6)
    articulation.attach(set(meshes())-before,head)
    arms=[((.213,0,1.35),(.326,.085,1.19),(.371,.198,1.13)),((-.213,0,1.35),(-.32,.095,1.20),(-.345,.257,1.25))]
    for shoulder,elbow,hand in arms:
        upper,lower,wrist,weapon=articulation.limb(shoulder,elbow,hand);articulation.parent_keep_world(upper,torso)
        before=set(meshes())
        ellipsoid('Claire rounded blue silk shoulder',shoulder,(.114,.117,.107),p['blue'],14,7)
        rod('Claire elegant blue upper sleeve',shoulder,elbow,.078,p['blue'],12,end=.070)
        articulation.attach(set(meshes())-before,upper);before=set(meshes())
        rod('Claire blue silk lower sleeve',elbow,hand,.071,p['blue'],12,end=.055)
        cuffstart=Vector(elbow).lerp(Vector(hand),.89);cuffend=Vector(elbow).lerp(Vector(hand),.99)
        rod('Claire embroidered gold sleeve cuff',cuffstart,cuffend,.057,p['gold'],12)
        articulation.attach(set(meshes())-before,lower);before=set(meshes())
        ellipsoid('Claire feminine human hand',hand,(.057,.052,.067),p['skin'],14,7)
        for offset in (-.027,-.009,.009,.027):rod('Claire natural slender fingers',(hand[0]-.030,hand[1]+.036,hand[2]+offset),(hand[0]+.025,hand[1]+.039,hand[2]+offset),.008,p['skin'],6)
        articulation.attach(set(meshes())-before,wrist)
        if shoulder[0]>0:
            before=set(meshes());x,y=hand[:2]
            rod('Claire long royal magic staff',(x,y,.20),(x,y,1.995),.024,p['blue'],12)
            for z in (.39,.89,1.15,1.82):cylinder('Claire staff golden binding',(x,y,z),.032,.044,p['gold'],12)
            for side in (-1,1):arc('Claire staff gold focus cradle',[(x+side*.015,y,1.92),(x+side*.085,y,2.02),(x+side*.073,y,2.14),(x+side*.014,y,2.19)],.013,p['gold'],7)
            ellipsoid('Claire magic staff sapphire focus',(x,y,2.08),(.055,.052,.087),p['magic'],12,8)
            articulation.attach(set(meshes())-before,weapon);articulation.pivot('staff_tip',(x,y,2.08),weapon)
            articulation.pivot('attack_muzzle',(x,y,2.08),weapon)
    # The three editable pivots remain separate in export, ready for runtime
    # orbital animation without spinning the body, hair, staff or shared mesh.
    for j,(pos,color) in enumerate([((.47,-.025,1.56),'82c9fa'),((-.46,.08,1.49),'b697f0'),((.0,-.315,1.80),'f4d986')]):
        before=set(meshes());material=mat('Claire magic orb '+str(j),color,.08,1.45)
        ellipsoid('Claire separate magic orb '+str(j),pos,(.067,.067,.067),material,14,9)
        ring=torus('Claire orbital gold ring '+str(j),pos,.087,.007,p['gold']);ring.rotation_euler=(.85,.22,j*.7)
        orb=pivot('secret_orb_'+str(j),pos,set(meshes())-before);orb['secretOrbIndex']=j;orb['orbitRadius']=.46
    return p


def horse(p):
    before=set(meshes())
    body=[ellipsoid('Bernhard white horse barrel',(0,-.04,.83),(.225,.375,.244),p['white'],18,10),
          ellipsoid('Bernhard horse rounded rump',(0,-.29,.85),(.235,.225,.235),p['white'],16,8),
          ellipsoid('Bernhard horse proud chest',(0,.22,.87),(.208,.22,.26),p['white'],16,8),
          rod('Bernhard horse tapered neck',(0,.23,.87),(0,.39,1.34),.143,p['white'],14,end=.101),
          ellipsoid('Bernhard horse noble head',(0,.46,1.392),(.116,.15,.175),p['white'],16,9),
          ellipsoid('Bernhard horse long face',(0,.589,1.269),(.104,.170,.156),p['white'],16,8),
          ellipsoid('Bernhard horse soft muzzle',(0,.710,1.172),(.115,.090,.100),p['white'],14,7)]
    fuse(body,'Bernhard continuous white horse anatomy',p['white'],2600,.015)
    for side in (-1,1):
        rod('Bernhard horse forward ear',(side*.075,.41,1.515),(side*.099,.403,1.677),.044,p['white'],10,end=.015)
        rod('Bernhard horse pink inner ear',(side*.074,.437,1.55),(side*.090,.430,1.643),.014,p['skin'],7,end=.006)
        ellipsoid('Bernhard horse alert dark eye',(side*.106,.528,1.414),(.014,.031,.024),p['pupil'],12,7)
        ellipsoid('Bernhard horse eye glint',(side*.117,.535,1.421),(.004,.007,.005),p['eyewhite'],8,5)
        ellipsoid('Bernhard horse natural nostril',(side*.069,.780,1.181),(.021,.011,.030),p['hoof'],10,6)
    arc('Bernhard horse mouth',[(-.092,.755,1.113),(0,.788,1.106),(.092,.755,1.113)],.006,p['hoof'],6)
    for side in (-1,1):
        for y in (-.26,.22):
            before=set(meshes());hip=(side*.146,y,.85);knee=(side*.15,y+.045,.56);fetlock=(side*.15,y+.070,.30)
            leg=[rod('Bernhard horse muscular upper leg',hip,knee,.074,p['white'],12,end=.052),
                 ellipsoid('Bernhard horse rounded knee',knee,(.058,.056,.064),p['white'],12,7),
                 rod('Bernhard horse slender lower leg',knee,fetlock,.043,p['white'],12,end=.035),
                 ellipsoid('Bernhard horse fetlock',(side*.15,y+.070,.302),(.047,.052,.055),p['white'],10,6)]
            fuse(leg,'Bernhard horse smooth articulated leg',p['white'],620,.010)
            hoof=cube('Bernhard horse proper hoof',(side*.15,y+.089,.225),(.106,.128,.092),p['hoof'],.019)
            joint=pivot('leg_horse_'+('L' if side<0 else 'R')+('_rear' if y<0 else '_front'),hip,set(meshes())-before)
            joint['gaitPhase']=0 if side*y>0 else math.pi
    # Pearly white mane follows the back of the neck and stays visibly distinct
    # from the horse's ivory coat, with several flowing locks.
    for j in range(6):
        z=1.48-j*.083;y=.295-j*.017
        arc('Bernhard horse flowing white mane',[(0,y,z),(-.037,y-.065,z-.065),(-.055,y-.10,z-.17)],.031,p['mane'],9)
    tail=[(0,-.422,.91),(.02,-.549,.88),(.047,-.644,.66),(.038,-.645,.39)]
    for j in range(4):arc('Bernhard horse long white tail',[(x+(j-1.5)*.014,y,z+(j%2)*.022) for x,y,z in tail],.018,p['mane'],9)
    # Saddle cloth and reins use real modeled straps, as on the royal defenders.
    blanket=custom('Bernhard royal blue saddle blanket',[(-.225,-.265,.929),(.225,-.265,.929),(.256,-.265,.684),(.256,.15,.711),(.215,.15,.97),(-.215,.15,.97),(-.256,.15,.711),(-.256,-.265,.684)],[(0,1,4,5),(1,2,3,4),(0,5,6,7)],p['blue'])
    for side in (-1,1):
        arc('Bernhard golden saddle cloth edging',[(side*.245,-.26,.70),(side*.25,.15,.725),(side*.218,.15,.982)],.009,p['gold'],6)
        arc('Bernhard horse bridle cheek',[(side*.10,.475,1.461),(side*.12,.582,1.306),(side*.115,.725,1.209)],.012,p['leather'],7)
        rod('Bernhard horse leather reins',(side*.115,.712,1.198),(side*.11,.183,1.389),.009,p['leather'],6)
        ellipsoid('Bernhard golden bridle buckle',(side*.122,.68,1.237),(.013,.021,.024),p['gold'],8,5)
    arc('Bernhard horse nose band',[(-.108,.709,1.217),(0,.769,1.245),(.108,.709,1.217)],.012,p['leather'],8)
    cube('Bernhard fitted leather saddle',(0,-.06,1.052),(.35,.345,.085),p['leather'],.035)
    for y,z in [(-.235,1.101),(.15,1.109)]:rod('Bernhard raised saddle bow',(-.166,y,z),(.166,y,z),.027,p['gold'],10)


def lord_bernhard():
    p=royal_palette();pedestal(p,.47);horse(p)
    torso=pivot('torso_pivot',(0,-.055,1.29));before=set(meshes())
    # A seated human torso above a compact horse, with shaped individual plate
    # lames. Human proportions and facial anatomy deliberately avoid troll/orc
    # muscles, pointed ears, tusks or a bulky dwarf skull.
    cylinder('Bernhard human padded torso',(0,-.055,1.49),.16,.40,p['blue'],14,top=.195)
    cuirass=ellipsoid('Bernhard radiant silver cuirass',(0,.06,1.505),(.179,.10,.225),p['silver'],16,8)
    for j in range(3):cube('Bernhard articulated silver belly lame',(0,.057,1.395-j*.064),(.31-j*.031,.10,.087),p['silver'],.022)
    for side in (-1,1):
        arc('Bernhard cuirass engraved gold border',[(side*.14,.081,1.672),(side*.165,.139,1.52),(side*.136,.129,1.388)],.009,p['gold'],7)
    ellipsoid('Bernhard golden royal chest medallion',(0,.16,1.565),(.044,.019,.055),p['gold'],10,7)
    cube('Bernhard chest sapphire',(0,.18,1.565),(.026,.009,.032),p['blue'],.006)
    cape=custom('Bernhard royal knight blue cape',[(-.17,-.13,1.67),(.17,-.13,1.67),(.23,-.23,1.28),(.27,-.38,1.025),(.0,-.43,.985),(-.27,-.38,1.025),(-.23,-.23,1.28)],[(0,1,2,6),(6,2,3,5),(5,3,4)],p['blue'])
    for side in (-1,1):arc('Bernhard cape gold stitching',[(side*.17,-.14,1.67),(side*.23,-.24,1.28),(side*.27,-.39,1.025)],.007,p['gold'],6)
    for side in (-1,1):
        hip=(side*.11,-.08,1.288);knee=(side*.277,.046,1.105);ankle=(side*.277,.12,.855)
        rod('Bernhard seated silver thigh',hip,knee,.073,p['silver'],12,end=.067)
        ellipsoid('Bernhard rounded knee plate',knee,(.09,.067,.093),p['silver'],12,7)
        rod('Bernhard slender silver greave',knee,ankle,.061,p['silver'],12,end=.048)
        ellipsoid('Bernhard silver pointed riding boot',(side*.277,.17,.823),(.061,.124,.049),p['silver'],12,7)
        arc('Bernhard gold shin trim',[(side*.277,.187,1.112),(side*.277,.187,.881)],.007,p['gold'],6)
        ring=torus('Bernhard gold riding stirrup',(side*.277,.145,.808),.058,.009,p['gold']);ring.rotation_euler[1]=math.pi/2
    articulation.attach(set(meshes())-before,torso)
    before=set(meshes())
    headparts=[rod('Bernhard human neck',(0,-.046,1.67),(0,-.046,1.79),.050,p['skin'],12),
               ellipsoid('Bernhard mature human head',(0,-.031,1.897),(.119,.104,.158),p['skin'],18,10),
               ellipsoid('Bernhard human lower jaw',(0,.012,1.830),(.098,.084,.070),p['skin'],14,8),
               ellipsoid('Bernhard human nose',(0,.094,1.895),(.025,.027,.032),p['skin'],12,7)]
    fuse(headparts,'Bernhard continuous mature human face',p['skin'],1200,.008)
    for side in (-1,1):
        x=side*.045
        ellipsoid('Bernhard eye white',(x,.068,1.933),(.029,.009,.018),p['eyewhite'],12,7)
        ellipsoid('Bernhard clear human eye',(x,.078,1.933),(.010,.005,.014),p['iris'],10,6)
        rod('Bernhard focused human eyebrow',(x-side*.022,.079,1.958),(x+side*.022,.072,1.957),.006,p['leather'],6)
    arc('Bernhard gentle human smile',[(-.025,.094,1.837),(0,.100,1.832),(.025,.094,1.837)],.005,p['lips'],6)
    ellipsoid('Bernhard open face silver helmet',(0,-.083,1.988),(.132,.108,.103),p['silver'],16,8)
    for side in (-1,1):
        cube('Bernhard open helmet silver cheek',(side*.111,.010,1.897),(.031,.081,.177),p['silver'],.017)
        arc('Bernhard golden helmet face edging',[(side*.107,.055,1.977),(side*.119,.052,1.863)],.007,p['gold'],6)
    arc('Bernhard golden helmet brow',[(-.110,.041,1.981),(0,.064,2.012),(.110,.041,1.981)],.010,p['gold'],7)
    rod('Bernhard royal gold helmet crest',(0,-.10,2.033),(0,-.17,2.20),.035,p['gold'],8,end=.007)
    head=pivot('head_pivot',(0,-.03,1.897),set(meshes())-before);articulation.parent_keep_world(head,torso)
    for shoulder,elbow,hand in [((.179,-.05,1.651),(.323,-.011,1.880),(.292,.083,2.103)),((-.179,-.05,1.651),(-.281,.06,1.467),(-.14,.189,1.379))]:
        upper,lower,wrist,weapon=articulation.limb(shoulder,elbow,hand);articulation.parent_keep_world(upper,torso)
        before=set(meshes())
        ellipsoid('Bernhard sculpted silver shoulder pauldron',shoulder,(.113,.115,.091),p['silver'],14,7)
        rod('Bernhard silver upper arm',shoulder,elbow,.068,p['silver'],12,end=.059)
        rod('Bernhard gold arm edging',Vector(shoulder).lerp(Vector(elbow),.16),Vector(shoulder).lerp(Vector(elbow),.26),.070,p['gold'],12)
        articulation.attach(set(meshes())-before,upper);before=set(meshes())
        ellipsoid('Bernhard silver elbow couter',elbow,(.068,.068,.075),p['silver'],12,7)
        rod('Bernhard plate forearm',elbow,hand,.061,p['silver'],12,end=.045)
        articulation.attach(set(meshes())-before,lower);before=set(meshes())
        ellipsoid('Bernhard articulated silver gauntlet',hand,(.055,.048,.064),p['silver'],14,7)
        for j in range(3):cube('Bernhard silver gauntlet fingers',(hand[0]+(j-1)*.023,hand[1]+.042,hand[2]),(.018,.020,.057),p['silver'],.005)
        articulation.attach(set(meshes())-before,wrist)
        if shoulder[0]>0:
            before=set(meshes());x,y,z=hand
            rod('Bernhard raised sword leather grip',(x,y,z-.06),(x,y,z+.16),.022,p['blue'],10)
            for zz in (z-.038,z+.010,z+.058,z+.106):cylinder('Bernhard sword gold grip wire',(x,y,zz),.024,.010,p['gold'],10)
            rod('Bernhard raised sword gold crossguard',(x-.12,y,z+.16),(x+.12,y,z+.16),.020,p['gold'],10)
            ellipsoid('Bernhard golden sword pommel',(x,y,z-.080),(.034,.030,.044),p['gold'],10,7)
            bladeverts=[(x-.048,y-.011,z+.20),(x+.048,y-.011,z+.20),(x+.033,y-.011,z+.78),(x,y-.011,z+.95),(x-.033,y-.011,z+.78),
                        (x-.048,y+.021,z+.20),(x+.048,y+.021,z+.20),(x+.033,y+.021,z+.78),(x,y+.021,z+.95),(x-.033,y+.021,z+.78)]
            custom('Bernhard long raised radiant sword blade',bladeverts,[(0,1,2,3,4),(9,8,7,6,5)]+[(j,(j+1)%5,(j+1)%5+5,j+5) for j in range(5)],p['steel'])
            rod('Bernhard sword golden central fuller',(x,y+.022,z+.23),(x,y+.022,z+.76),.006,p['gold'],5)
            articulation.attach(set(meshes())-before,weapon);articulation.pivot('attack_muzzle',(x,y,z+.80),weapon)
    return p


def bounds():
    bpy.context.view_layer.update();points=[o.matrix_world@vertex.co for o in meshes() for vertex in o.data.vertices]
    low=[min(point[i] for point in points) for i in range(3)];high=[max(point[i] for point in points) for i in range(3)]
    return dict(min=[round(x,5) for x in low],max=[round(x,5) for x in high],size=[round(high[i]-low[i],5) for i in range(3)])


def camera_frame(camera,dimensions,resolution=(360,420),view=(-3.3,6,2.9)):
    centre=Vector(tuple((dimensions['min'][i]+dimensions['max'][i])/2 for i in range(3)))
    camera.location=centre+Vector(view);camera.rotation_euler=(centre-camera.location).to_track_quat('-Z','Y').to_euler();bpy.context.view_layer.update()
    projected=[camera.matrix_world.inverted()@(o.matrix_world@Vector(v)) for o in meshes() for v in o.bound_box]
    width=max(point.x for point in projected)-min(point.x for point in projected);height=max(point.y for point in projected)-min(point.y for point in projected)
    aspect=resolution[0]/resolution[1];camera.data.ortho_scale=max(width,height*aspect)*1.15 if aspect>=1 else max(height,width/aspect)*1.15
    scene=bpy.context.scene;scene.render.resolution_x=resolution[0];scene.render.resolution_y=resolution[1];scene.render.resolution_percentage=100;scene.cycles.samples=32


def generate(render=True,family=None):
    requested=set(family.split(',')) if family else {'ladyclaire','lordbernhard'}
    if not requested or not requested.issubset({'ladyclaire','lordbernhard'}):
        raise ValueError('Unknown requested secret champion family')
    entries=json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
    for family,name,builder in [('ladyclaire','Lady Claire',lady_claire),('lordbernhard','Lord Bernhard',lord_bernhard)]:
        if family not in requested:continue
        army.clear();builder();A.cohesive.soften_surfaces(meshes());A.cohesive.budget_meshes(13500)
        dimensions=bounds();scene=bpy.context.scene;scene['Champion']=name;scene['Family']=family;scene['DesignRevision']=8;scene['SecretChampion']=True
        scene['AssetRevision']='champions-v7.8';scene['Identity']='Preserved Kushek face, loose blonde hair, green eyes, smile and three magic orbs' if family=='ladyclaire' else 'Radiant human knight on white horse, raised sword, bright silver plate and gold trim'
        root=pivot('secret_champion_'+family,(0,0,0),[o for o in scene.objects if not o.parent]);root['secret']=True;root['assetRevision']='champions-v7.8';root['designName']=name
        file='advanced_'+family+'.glb';triangles=army.export_current(file)
        camera=A.configure_scene();camera_frame(camera,dimensions)
        scene['NativeBounds']=json.dumps(dimensions);bpy.ops.wm.save_as_mainfile(filepath=str(SOURCES/(family+'_design_v1.blend')))
        if render:
            portrait=PORTRAITS/(family+'-t1.png');scene.render.filepath=str(portrait);bpy.ops.render.render(write_still=True);army.clean_portrait_metadata(portrait)
            camera_frame(camera,dimensions,(1100,1300));scene.cycles.samples=48
            review=REVIEWS/(family+'-front.png');scene.render.filepath=str(review);bpy.ops.render.render(write_still=True);army.clean_portrait_metadata(review)
            camera_frame(camera,dimensions,(1100,1300),(3.3,-6,2.8))
            review=REVIEWS/(family+'-back.png');scene.render.filepath=str(review);bpy.ops.render.render(write_still=True);army.clean_portrait_metadata(review)
        entries=[entry for entry in entries if not(entry.get('kind')=='tower' and entry.get('family')==family)]
        entries.append(dict(id=family+'-t1',file=file,kind='tower',family=family,tier=1,style='champions-v7.8',assetRevision='champions-v7.8',authoring='Blender',secret=True,triangles=triangles,designRevision=8,name=name,source='blender/scenes/'+family+'_design_v1.blend',bounds=dimensions,**articulation.metadata()))
        (OUT/'manifest.json').write_text(json.dumps(entries,indent=2)+'\n',encoding='utf-8')
        print('SECRET_CHAMPION '+family+' '+str(triangles)+' triangles '+str(dimensions['size']),flush=True)
    print('SECRET_CHAMPIONS requested native sources and GLBs complete'+(' with portraits' if render else ' without rendering'),flush=True)


def review_gallery(render=True):
    """Keep a paired, editable native source review alongside the portraits."""
    army.clear()
    for family,offset in [('ladyclaire',-.72),('lordbernhard',.77)]:
        with bpy.data.libraries.load(str(SOURCES/(family+'_design_v1.blend')),link=False) as (source,target):
            target.objects=source.objects
        objects=[obj for obj in target.objects if obj is not None and obj.type in ('MESH','EMPTY')]
        for obj in objects:bpy.context.scene.collection.objects.link(obj)
        for obj in objects:
            if not obj.parent:obj.location.x+=offset
    dimensions=bounds();camera=A.configure_scene();camera_frame(camera,dimensions,(1600,1450),(-2.0,8.0,3.1))
    scene=bpy.context.scene;scene.cycles.samples=56;scene['NativeReview']='Lady Claire and Lord Bernhard; secret champions v0.2.8; original Blender 5.2 native sources'
    scene['ModelSources']='ladyclaire_design_v1.blend / lordbernhard_design_v1.blend'
    scene.render.filepath=str(REVIEWS/'secret-champions-pair.png')
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCES/'secret_champions_review_v1.blend'))
    if render:
        bpy.ops.render.render(write_still=True);army.clean_portrait_metadata(REVIEWS/'secret-champions-pair.png')
    print('SECRET_CHAMPIONS editable paired review complete',flush=True)


if __name__=='__main__':
    render='--no-render' not in sys.argv
    family=sys.argv[sys.argv.index('--family')+1] if '--family' in sys.argv else None
    if '--gallery-only' in sys.argv:review_gallery(render=render)
    else:
        generate(render=render,family=family)
        if not family and render:review_gallery()
