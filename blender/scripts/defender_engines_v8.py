"""Seven detailed native-rig siege/construct champions; no gameplay changes.

Mechanisms are designed around real bearings, stocks, axles, tension cords and
recoil slides. Stone/ice bodies are connected remeshed sculpted surfaces with
five curved, shaped digits on each hand. Uses the v8 anatomy toolkit.
"""
import bpy, math
from mathutils import Vector
import defender_creatures_v8 as C
from author_archer import cube

FAMILIES={'kingsreach','stonewarden','royalarsenal','fireballista','winterhold','emeraldgolem','mechanicalgolem'}

def palette(family):
    body,trim,wood,light={
        'kingsreach':('715135','c1a86c','6d482d','ddc895'),
        'fireballista':('593129','d8a250','5e3927','ffab42'),
        'stonewarden':('8b623e','baa170','61452d','cdbda1'),
        'royalarsenal':('28465a','b7c8cd','405463','8bdfee'),
        'winterhold':('a4dce3','e0f1e8','59767c','abf1f6'),
        'emeraldgolem':('718079','b0b39a','526354','73c691'),
        'mechanicalgolem':('a3693e','d8bb70','614933','f0bf64')}[family]
    return dict(body=C.material(family+' sculpted surface',body,.40 if family=='winterhold' else .61,.30 if family=='mechanicalgolem' else 0),
        gold=C.material(family+' chased bronze',trim,.30,.75),wood=C.material(family+' seasoned structural timber',wood,.79),
        steel=C.material(family+' forged steel','9dabb0',.34,.82),dark=C.material(family+' deep mechanical seam','1f2c2f',.69),
        leather=C.material(family+' leather bindings','513a29',.77),rope=C.material(family+' twisted cord','b2a37c',.85),
        light=C.material(family+' power focus',light,.22,.16,1.0),stone=C.material(family+' pedestal','86947e',.84),
        ivory=C.material(family+' aged edges','d7cfb6',.67))

def box(name,centre,size,m,bone='root',bevel=.008):return C.skin(cube(name,centre,size,m,bevel),bone)

def wheel(p,x,y,r=.215):
    C.ring('Segmented iron-bound oak wheel',(x,y,.165+r),r,.020,p['steel'],axis='X',n=40)
    C.ring('Wheel inset felloe',(x,y,.165+r),r-.031,.027,p['wood'],axis='X',n=32)
    C.tube('Wheel axle collar',[(x-.035,y,.165+r),(x+.035,y,.165+r)],[.040,.04],p['steel'],sides=20)
    for i in range(10):
        a=math.tau*i/10;C.tube('Wheel fitted radial spoke',[(x,y,.165+r),(x,y+math.cos(a)*(r-.04),.165+r+math.sin(a)*(r-.04))],[.014,.019],p['wood'],sides=8)
        C.shell('Wheel flush rim bolt',(x+.026,y+math.cos(a)*(r-.019),.165+r+math.sin(a)*(r-.019)),(.009,.009,.009),p['gold'],n=10,rows=6)

def chassis(p,length=1.06):
    C.footing(p,.59)
    for x in [-.21,.21]:
        box('Continuous seasoned oak chassis rail',(x,0,.54),(.10,length,.13),p['wood'],bevel=.016)
        for y in [-length*.36,length*.36]:
            box('Iron rail strap and flush nail',(x,y,.61),(.11,.060,.020),p['steel'],bevel=.005)
            C.shell('Chassis strap bolt',(x,y,.626),(.012,.012,.008),p['gold'],n=10,rows=6)
    for y in [-length*.36,length*.36]:
        C.tube('Through chassis wheel axle',[(-.41,y,.38),(.41,y,.38)],[.029,.029],p['steel'],sides=18)
        for x in [-.35,.35]:wheel(p,x,y)
        box('Chassis tenoned crossmember',(0,y,.535),(.57,.09,.10),p['wood'],bevel=.012)
    for y in [-.2,0,.2]:box('Individual laid platform plank',(0,y,.604),(.51,.185,.043),p['wood'],bevel=.006)

def gear(p,centre,r=.10,bone='root',teeth=12):
    C.ring('Machined gear annulus',centre,r*.72,.024,p['gold'],bone,'X',32)
    for j in range(teeth):
        a=math.tau*j/teeth;y=centre[1]+math.cos(a)*r*.90;z=centre[2]+math.sin(a)*r*.90
        o=box('Individually machined meshing gear tooth',(centre[0],y,z),(.039,.035,.035),p['gold'],bone,.003);o.rotation_euler[0]=a
    C.tube('Gear bearing hub',[(centre[0]-.035,centre[1],centre[2]),(centre[0]+.035,centre[1],centre[2])],[r*.34,r*.34],p['steel'],bone,16,3)

def engine_specs(kind):
    specs=[('root',(0,0,.17),(0,0,.70),None),('turret',(0,0,.72),(0,0,.98),'root')]
    if kind in ('kingsreach','fireballista'):
        specs += [('bow_L',(-.22,.10,1.03),(-.58,.24,1.04),'turret'),('bow_R',(.22,.10,1.03),(.58,.24,1.04),'turret'),('draw_slide',(0,-.35,1.03),(0,-.17,1.03),'turret'),('quarrel',(0,-.17,1.083),(0,.56,1.083),'draw_slide'),('winch',(.28,-.32,.91),(.37,-.32,.91),'turret')]
    elif kind=='stonewarden':specs += [('throw_arm',(0,.03,1.02),(0,-.43,1.49),'turret'),('sling',(0,-.43,1.49),(0,-.59,1.42),'throw_arm'),('charge',(0,-.58,1.48),(0,-.58,1.61),'sling'),('winch',(.34,-.32,.71),(.42,-.32,.71),'root')]
    else:
        for i,x in enumerate([-.20,0,.20]):specs.append(('barrel_'+str(i),(x,-.16,1.01+(i==1)*.21),(x,.64,1.05+(i==1)*.21),'turret'))
        specs.append(('reactor',(0,-.24,1.37),(0,-.24,1.59),'turret'))
    return specs

def ballista(family,p):
    fire=family=='fireballista';chassis(p)
    C.sweep('Swivel carved bronze turret bearing',[(0,0,.65),(0,0,.73),(0,0,.77)],[.17,.19,.17],[.17,.19,.17],p['steel'],sides=28,steps=2)
    box('Ballista long tapered bolt stock',(0,-.04,1.01),(.13,1.02,.095),p['wood'],'turret',.017)
    box('Ballista fitted stock rail inlay',(0,-.05,1.064),(.047,.94,.01),p['steel'],'turret',.003)
    C.tube('Supporting ballista elevation trunnion',[(-.27,0,.88),(.27,0,.88)],[.047,.047],p['steel'],'turret',20,4)
    for s,side in [(-1,'L'),(1,'R')]:
        for j in range(3):
            C.sweep('Laminated curved bow arm '+side+str(j),[(s*.055,.06,1.02+j*.018),(s*.23,.12,1.035+j*.018),(s*.43,.20,1.07+j*.015),(s*.58,.23,1.03+j*.015)],[.02,.028,.022,.011],[.027,.025,.019,.010],p['wood'] if j!=1 else p['gold'],'bow_'+side,12,7)
        C.ring('Bow torsion bundle binding '+side,(s*.205,.095,1.01),.056,.012,p['rope'],'turret','X',24)
        C.tube('Actual taut double bowstring '+side,[(s*.58,.23,1.046),(s*.30,-.115,1.046),(0,-.36,1.046)],[.005,.005,.005],p['rope'],lambda v:{'bow_'+side:max(0,min(1,abs(v.x)/.58)),'draw_slide':1-max(0,min(1,abs(v.x)/.58))},7,8)
        C.tube('Stock and bow supporting brace '+side,[(s*.23,.07,.75),(s*.22,.11,.99)],[.035,.031],p['steel'],'turret',12,4)
        C.tube('Winch winding drum axle '+side,[(s*.21,-.33,.89),(s*.32,-.33,.89)],[.035,.035],p['steel'],'turret',14,3)
    gear(p,(.315,-.33,.89),.082,'winch',10)
    box('Fitted sliding trigger sear',(0,-.36,1.035),(.079,.047,.07),p['steel'],'draw_slide',.009)
    C.tube('Loaded quarrel shaped shaft',[(0,-.35,1.083),(0,.43,1.083)],[.008,.008],p['wood'],'quarrel',10,4)
    C.sweep('Ballista forged leaf-shaped bolt head',[(0,.40,1.083),(0,.46,1.083),(0,.56,1.083)],[.009,.034,.001],[.009,.014,.001],p['steel'],'quarrel',12,4)
    for s in [-1,1]:C.plate('Ballista bolted steel fletching',[(0,-.35,1.083),(s*.048,-.31,1.083),(s*.048,-.21,1.083),(0,-.24,1.083)],p['ivory'],'quarrel',.003)
    if fire:
        for s in [-1,1]:
            C.tube('Continuous embossed copper fire feed',[(s*.23,-.25,1.07),(s*.29,.0,1.14),(s*.19,.18,1.12)],[.012,.012,.009],p['gold'],'turret',9,7)
            C.sweep('Ballista guarded ember reservoir',[(s*.24,-.26,1.05),(s*.24,-.26,1.17),(s*.24,-.26,1.25)],[.06,.06,.042],[.06,.06,.042],p['steel'],'turret',16,3)
            C.shell('Ballista living hot coal',(s*.24,-.26,1.255),(.037,.037,.045),p['light'],'turret',20,12)
    marker=C.marker('attack_muzzle',(0,.56,1.083),'turret')
    C.animate([(9,{'bow_L':(0,0,-.10),'bow_R':(0,0,.10),'draw_slide':{'location':(0,-.065,0)},'winch':(.22,0,0)}),(18,{'bow_L':(0,0,.12),'bow_R':(0,0,-.12),'draw_slide':{'location':(0,.025,0)},'quarrel':{'scale':(.0001,.0001,.0001)},'turret':(.017,0,0)}),(23,{'bow_L':(0,0,-.035),'bow_R':(0,0,.035),'quarrel':{'scale':(.0001,.0001,.0001)},'turret':(-.012,0,0)}),(38,{'winch':(-.16,0,0),'quarrel':{'scale':(.85,.85,.85)}})],[(0,{}),(30,{'turret':(.002,0,0)}),(60,{}),(90,{'turret':(-.002,0,0)}),(120,{})])

def catapult(p):
    chassis(p,1.13)
    for s in [-1,1]:
        box('Catapult tenoned oak upright',(s*.25,.03,.84),(.10,.14,.44),p['wood'],bevel=.014)
        for y in [-.36,.34]:C.tube('Catapult fitted diagonal brace',[(s*.24,y,.61),(s*.25,.03,1.01)],[.035,.040],p['wood'],sides=10,steps=3)
        C.ring('Catapult forged axle bearing',(s*.26,.03,1.02),.078,.020,p['steel'],axis='X',n=30)
        C.ring('Catapult rope torsion bundle',(s*.16,.03,1.02),.10,.024,p['rope'],axis='X',n=24)
        box('Catapult bearing mounting strap',(s*.26,.11,.99),(.109,.025,.19),p['steel'],bevel=.005)
    C.tube('Catapult main throwing axle',[(-.34,.03,1.02),(.34,.03,1.02)],[.05,.05],p['steel'],sides=24,steps=3)
    C.tube('Throwing beam reinforced continuous oak',[(0,.32,.79),(0,.03,1.02),(0,-.25,1.30),(0,-.43,1.49)],[.048,.065,.052,.036],p['wood'],'throw_arm',16,6)
    C.tube('Throwing beam impact crossbar',[(-.29,.25,1.19),(.29,.25,1.19)],[.037,.037],p['steel'],sides=14,steps=3)
    C.shell('Catapult fitted counterweight',(0,.29,.81),(.095,.09,.12),p['steel'],'throw_arm',24,14)
    for s in [-1,1]:
        C.tube('Sling sewn suspension cord '+str(s),[(0,-.43,1.49),(s*.13,-.54,1.42),(s*.15,-.63,1.39)],[.007,.007,.007],p['rope'],'sling',8,6)
    C.shell('Catapult sculpted leather sling cradle',(0,-.58,1.39),(.17,.16,.054),p['leather'],'sling',28,16)
    rock=C.shell('Catapult naturally fractured slung boulder',(0,-.58,1.48),(.126,.118,.13),p['stone'],'charge',24,14,lambda v,a,t:v+v.normalized()*(.009*math.sin(a*7+t*5)))
    C.tube('Rear winding spool axle',[(-.38,-.33,.71),(.38,-.33,.71)],[.024,.024],p['steel'],sides=14,steps=3)
    C.ring('Catapult handwheel',( .38,-.33,.71),.088,.012,p['gold'],'winch','X',24)
    C.tube('Winding rope follows throwing beam',[(0,-.33,.77),(0,-.43,1.22),(0,-.43,1.48)],[.007,.007,.007],p['rope'],'throw_arm',8,6)
    C.marker('attack_muzzle',(0,-.58,1.48),'sling')
    C.animate([(9,{'throw_arm':(-.15,0,0),'sling':(.09,0,0),'winch':(.18,0,0)}),(18,{'throw_arm':(.83,0,0),'sling':(-.35,0,0),'charge':{'scale':(.0001,.0001,.0001)}}),(25,{'throw_arm':(.91,0,0),'sling':(.14,0,0),'charge':{'scale':(.0001,.0001,.0001)}}),(38,{'throw_arm':(.22,0,0),'sling':(-.07,0,0),'winch':(-.23,0,0),'charge':{'scale':(.8,.8,.8)}})])

def cannon(p):
    chassis(p,1.11)
    C.sweep('Arsenal genuine rotation bearing race',[(0,0,.66),(0,0,.74),(0,0,.80)],[.25,.28,.26],[.25,.28,.26],p['steel'],sides=28,steps=2)
    box('Triple cannon armored floating cradle',(0,0,.84),(.66,.62,.16),p['body'],'turret',.035)
    for i,x in enumerate([-.20,0,.20]):
        z=1.01+(i==1)*.21;bone='barrel_'+str(i)
        C.sweep('Cannon individually bored shaped barrel '+str(i),[(x,-.27,z),(x,-.13,z),(x,.31,z+.025),(x,.62,z+.039)],[.058,.079,.055,.057],[.058,.079,.055,.057],p['steel'],bone,24,5)
        C.ring('Open dark cannon muzzle '+str(i),(x,.623,z+.039),.035,.016,p['dark'],bone,'Y',24)
        for y in [-.11,.25,.56]:C.ring('Cannon reinforce and gilded fillet '+str(i),(x,y,z+(.04 if y>.2 else 0)),.073 if y<0 else .06,.009,p['gold'],bone,'Y',24)
        box('Cannon functional recoil slide '+str(i),(x,-.06,z-.075),(.13,.49,.043),p['steel'],'turret',.008)
        for s in [-1,1]:C.tube('Cannon alchemical conductor '+str(i)+str(s),[(x+s*.058,-.18,z+.027),(x+s*.052,.30,z+.06),(x+s*.045,.55,z+.063)],[.004,.004,.003],p['light'],bone,6,5)
    for s in [-1,1]:
        C.sweep('Arsenal fitted pressure reservoir '+str(s),[(s*.23,-.26,1.03),(s*.23,-.26,1.26),(s*.23,-.26,1.37)],[.053,.065,.05],[.053,.065,.05],p['steel'],'turret',20,4)
        C.tube('Arsenal continuous pressure pipe '+str(s),[(s*.23,-.26,1.37),(s*.16,-.26,1.43),(0,-.24,1.46)],[.012,.012,.012],p['gold'],'turret',9,6)
    C.shell('Arsenal restrained storm reactor',(0,-.24,1.51),(.067,.065,.11),p['light'],'reactor',24,16)
    for s in [-1,1]:C.tube('Storm core enclosing guard '+str(s),[(s*.06,-.24,1.42),(s*.105,-.24,1.56),(s*.057,-.24,1.65)],[.009,.009,.004],p['gold'],'turret',8,6)
    C.marker('attack_muzzle',(0,.623,1.259),'barrel_1')
    C.animate([(9,{'reactor':(0,.035,0),'turret':(.018,0,0)}),(18,{'barrel_0':{'location':(0,-.055,0)},'barrel_1':{'location':(0,-.072,0)},'barrel_2':{'location':(0,-.055,0)},'turret':(-.018,0,0)}),(23,{'barrel_0':{'location':(0,-.032,0)},'barrel_1':{'location':(0,-.039,0)},'barrel_2':{'location':(0,-.032,0)},'turret':(.008,0,0)}),(38,{'turret':(.004,0,0)})],[(0,{}),(30,{'reactor':(0,.014,0)}),(60,{}),(90,{'reactor':(0,-.014,0)}),(120,{})])

def construct_specs():
    specs=[('root',(0,0,.17),(0,0,.8),None),('pelvis',(0,0,.83),(0,0,1.0),'root'),('spine',(0,0,.99),(0,0,1.48),'pelvis'),('neck',(0,0,1.48),(0,0,1.64),'spine'),('head',(0,0,1.64),(0,0,1.90),'neck')]
    for s,side in [(-1,'L'),(1,'R')]:
        specs += [('thigh_'+side,(s*.15,0,.97),(s*.20,0,.59),'pelvis'),('calf_'+side,(s*.20,0,.59),(s*.20,.04,.27),'thigh_'+side),('foot_'+side,(s*.20,.04,.27),(s*.20,.20,.22),'calf_'+side),('upper_'+side,(s*.31,0,1.42),(s*.45,.01,1.14),'spine'),('forearm_'+side,(s*.45,.01,1.14),(s*.43,.14,.91),'upper_'+side),('hand_'+side,(s*.43,.14,.91),(s*.43,.19,.81),'forearm_'+side)]
    return specs

def sculpted_construct(family,p,specs):
    ice=family=='winterhold';m=p['body'];parts=[]
    parts.append(C.sweep('Construct tapered powerful torso',[(0,0,.84),(0,0,1.00),(0,0,1.28),(0,0,1.49)],[.26,.29,.36,.21],[.18,.18,.22,.13],m,sides=32,steps=8,detail=.025 if not ice else .014))
    parts.append(C.tube('Construct integrated thick neck',[(0,0,1.47),(0,0,1.68)],[.12,.09],m,sides=24,steps=7))
    def headwarp(v,a,t):
        front=max(0,math.sin(a))**4
        v.y+=front*(.036*math.exp(-((v.x/.034)**2+((v.z-1.78)/.060)**2))-.009*math.exp(-((abs(v.x)-.067)/.032)**2-((v.z-1.84)/.032)**2))
        return v
    parts.append(C.shell('Construct integrated stern face jaw',(0,.008,1.79),(.158,.125,.18),m,'head',36,28,headwarp))
    for s,side in [(-1,'L'),(1,'R')]:
        parts.append(C.sweep('Construct anatomically connected thigh and calf '+side,[(s*.15,0,.95),(s*.21,0,.72),(s*.20,0,.55),(s*.20,.04,.28)],[.145,.13,.095,.082],[.13,.11,.10,.081],m,sides=22,steps=7))
        parts.append(C.shell('Construct purposeful weightbearing foot '+side,(s*.20,.12,.24),(.116,.20,.076),m,'foot_'+side,24,14))
        parts.append(C.sweep('Construct sculpted shoulder elbow forearm '+side,[(s*.27,0,1.43),(s*.38,0,1.33),(s*.45,.01,1.14),(s*.43,.14,.91)],[.16,.13,.10,.085],[.15,.12,.10,.079],m,sides=24,steps=7))
    C.sculpt_union(parts,'V8 continuous '+('glacial anatomy' if ice else 'weathered rock anatomy'),m,20000,.013,C.distance_weights(specs,{n for n,a,b,parent in specs if n!='root'}))
    for s,side in [(-1,'L'),(1,'R')]:
        # Larger humanoid constructs have proper five distinct anatomical digits.
        centre=Vector((s*.43,.14,.91))
        C.sweep('Construct hand continuous wrist palm '+side,[centre,centre+Vector((0,.027,-.040)),centre+Vector((0,.022,-.085))],[.082,.086,.068],[.056,.064,.047],m,'hand_'+side,24,5)
        for i in range(4):
            x=s*.43+(i-1.5)*.043;z=.855-(.008 if i in (0,3) else 0)
            C.tube('Construct four jointed fingers '+side+str(i),[(x,.153,z),(x,.195,z-.022),(x,.21,z-.068),(x,.18,z-.089)],[.019,.019,.016,.010],m,'hand_'+side,12,6)
        C.tube('Construct opposed indexside thumb '+side,[(s*.36,.126,.878),(s*.328,.172,.85),(s*.345,.218,.842),(s*.38,.226,.84)],[.025,.022,.019,.011],m,'hand_'+side,12,6)
        C.shell('Construct inset luminous eye '+side,(s*.066,.13,1.84),(.039,.010,.013),p['light'],'head',20,12)
        for j in range(4):
            if ice:
                C.tube('Rooted ice shoulder crystal '+side+str(j),[(s*(.30+j*.018),-.035,1.48),(s*(.33+j*.020),-.05,1.61+j*.026),(s*(.345+j*.02),-.07,1.71+j*.025)],[.027,.019,.001],p['ivory'],'upper_'+side,8,4)
        for j in range(5):
            y=-.11+j*.05
            C.plate('Construct fitted relief shoulder scale '+side+str(j),[(s*.30,y,1.49),(s*.42,y,1.48),(s*.46,y,1.40),(s*.35,y,1.41)],p['gold'],'upper_'+side,.009)
    C.tube('Construct deep sculpted mouth',[(-.055,.125,1.705),(0,.148,1.699),(.055,.125,1.705)],[.003,.005,.003],p['dark'],'head',8,5)
    C.shell('Construct inset chest power seal',(0,.227,1.27),(.075,.021,.098),p['light'],'spine',20,12)
    for points in [[(-.13,.220,1.42),(-.08,.229,1.35),(-.105,.234,1.27)],[(.13,.21,1.42),(.08,.232,1.32),(.12,.219,1.23)]]:
        C.tube('Construct naturally branching illuminated fissure',points,[.004,.004,.002],p['light'],'spine',6,5)
    if ice:
        for j in range(5):
            x=(j-2)*.049;C.tube('Natural icy crown spire',[(x,0,1.915),(x,0,1.975),(x+.01,0,2.05-abs(j-2)*.035)],[.027,.019,.001],p['ivory'],'head',8,5)

def mechanical(p,specs):
    for s,side in [(-1,'L'),(1,'R')]:
        box('Automaton articulated anatomical instep '+side,(s*.20,.11,.255),(.25,.34,.15),p['steel'],'foot_'+side,.03)
        for j in range(3):box('Automaton overlapping articulated toe plate '+side+str(j),(s*.20,.15+j*.05,.29),(.24,.066,.044),p['body'],'foot_'+side,.009)
        C.sweep('Automaton shin sculpted fitted shell '+side,[(s*.20,0,.29),(s*.20,0,.45),(s*.20,0,.58)],[.079,.09,.082],[.071,.09,.08],p['body'],'calf_'+side,24,5)
        C.sweep('Automaton thigh fitted casing '+side,[(s*.20,0,.59),(s*.18,0,.79),(s*.15,0,.95)],[.095,.113,.13],[.087,.095,.115],p['steel'],'thigh_'+side,24,5)
        gear(p,(s*.31,0,.59),.068,'calf_'+side,10)
        for z in [.38,.72]:C.tube('Automaton inset leg piston '+side+str(z),[(s*.27,-.07,z),(s*.265,-.07,z+.13)],[.014,.011],p['gold'],'calf_'+side if z<.5 else 'thigh_'+side,10,4)
        C.shell('Automaton enclosed shoulder rotary bearing '+side,(s*.31,0,1.42),(.10,.10,.10),p['dark'],'upper_'+side,20,14)
        C.sweep('Automaton sculpted upperarm outer casing '+side,[(s*.31,0,1.42),(s*.39,0,1.30),(s*.45,.01,1.14)],[.10,.082,.066],[.10,.08,.060],p['body'],'upper_'+side,24,5)
        C.sweep('Automaton continuous gauntlet forearm '+side,[(s*.45,.01,1.14),(s*.44,.085,.98),(s*.43,.14,.91)],[.068,.086,.058],[.07,.086,.052],p['body'],'forearm_'+side,24,5)
        gear(p,(s*.51,.01,1.14),.069,'forearm_'+side,10)
        centre=Vector((s*.43,.14,.91))
        C.sweep('Automaton fitted wrist into shaped metacarpal palm '+side,[centre,centre+Vector((0,.025,-.037)),centre+Vector((0,.025,-.079))],[.057,.072,.061],[.044,.047,.040],p['steel'],'hand_'+side,24,6)
        for j in range(4):
            x=s*.43+(j-1.5)*.037;z=.843-(.008 if j in (0,3) else 0)
            C.tube('Automaton four truly curved articulated digits '+side+str(j),[(x,.152,z),(x,.195,z-.018),(x,.212,z-.055),(x,.190,z-.078)],[.016,.017,.014,.008],p['steel'],'hand_'+side,12,6)
            C.plate('Automaton finger knuckle armored cap '+side+str(j),[(x-.012,.187,z-.002),(x+.012,.187,z-.002),(x+.012,.205,z-.029),(x-.012,.205,z-.029)],p['gold'],'hand_'+side,.003)
        C.tube('Automaton correctly opposed thumb '+side,[(s*.37,.125,.879),(s*.342,.169,.858),(s*.354,.211,.847),(s*.380,.221,.839)],[.021,.019,.016,.009],p['steel'],'hand_'+side,12,6)
        C.tube('Automaton properly connected upper piston '+side,[(s*.38,-.08,1.34),(s*.46,-.04,1.16)],[.012,.009],p['gold'],'upper_'+side,10,4)
        C.sweep('Alchemy backpack shaped reservoir '+side,[(s*.19,-.24,1.10),(s*.19,-.24,1.25),(s*.19,-.24,1.46)],[.06,.074,.06],[.06,.074,.06],p['steel'],'spine',18,5)
        C.tube('Connected boiler feed pipe '+side,[(s*.19,-.24,1.46),(s*.23,-.16,1.51),(s*.16,-.13,1.49)],[.014,.014,.012],p['gold'],'spine',10,6)
    C.sweep('Automaton seamlessly shaped hip shell',[(0,0,.87),(0,0,.95),(0,0,1.01)],[.24,.265,.23],[.15,.17,.16],p['body'],'pelvis',32,5)
    C.sweep('Automaton intentionally shaped breast boiler',[(0,-.01,1.01),(0,-.01,1.16),(0,-.01,1.40),(0,-.01,1.53)],[.23,.27,.31,.20],[.16,.19,.22,.135],p['body'],'spine',32,7)
    C.tube('Automaton protected flexible neck',[(0,0,1.50),(0,0,1.65)],[.068,.061],p['steel'],'neck',20,5)
    C.shell('Automaton purposeful closed helmet shell',(0,0,1.78),(.149,.13,.16),p['steel'],'head',32,24)
    C.plate('Automaton fitted visor panel',[(-.123,.11,1.855),(.123,.11,1.855),(.115,.13,1.752),(-.115,.13,1.752)],p['body'],'head',.012)
    C.tube('Automaton recessed optical opening',[(-.092,.139,1.823),(0,.145,1.827),(.092,.139,1.823)],[.014,.015,.014],p['dark'],'head',10,4)
    for x in [-.048,.048]:C.shell('Automaton inset bright optical lens',(x,.153,1.827),(.024,.012,.017),p['light'],'head',20,12)
    for x in [-.055,-.027,0,.027,.055]:box('Automaton ventilation slot',(x,.134,1.718),(.010,.010,.029),p['dark'],'head',.003)
    C.ring('Automaton concentric reactor iris',(0,.219,1.284),.092,.012,p['gold'],'spine','Y',32)
    C.shell('Automaton seated reactor heart',(0,.229,1.284),(.061,.017,.061),p['light'],'spine',24,14)
    for j in range(6):
        a=math.tau*j/6;C.shell('Reactor flush securing rivet',(math.cos(a)*.105,.227,1.284+math.sin(a)*.105),(.007,.006,.007),p['gold'],'spine',10,6)
    C.tube('Automaton swept integral exhaust',[(.12,-.19,1.47),(.12,-.21,1.63),(.13,-.20,1.81)],[.030,.036,.036],p['steel'],'spine',16,5)
    C.ring('Automaton flared exhaust lip',(.13,-.20,1.81),.037,.006,p['gold'],'spine',n=24)

def construct(family,p):
    specs=construct_specs();C.rig(specs,family);C.footing(p,.58)
    if family=='mechanicalgolem':mechanical(p,specs)
    else:sculpted_construct(family,p,specs)
    C.marker('attack_muzzle',(.43,.19,.87),'hand_R')
    C.animate([(9,{'spine':(.013,0,-.07),'upper_R':(-.12,0,.07),'forearm_R':(.18,0,0),'head':(.016,0,.035)}),(18,{'spine':(-.032,0,.06),'upper_R':(.29,0,-.09),'forearm_R':(-.13,0,0),'hand_R':(-.04,0,0),'upper_L':(-.04,0,-.04),'head':(-.035,0,-.04)}),(26,{'spine':(-.013,0,.035),'upper_R':(.16,0,-.05),'forearm_R':(-.03,0,0)}),(38,{'upper_R':(.04,0,0)})],[(0,{}),(30,{'spine':(.005,0,0),'head':(.007,0,.006)}),(60,{}),(90,{'spine':(-.005,0,0),'head':(-.007,0,-.006)}),(120,{})])

def build(family):
    C.reset();p=palette(family)
    if family in ('winterhold','emeraldgolem','mechanicalgolem'):construct(family,p)
    else:
        C.rig(engine_specs(family),family)
        if family in ('kingsreach','fireballista'):ballista(family,p)
        elif family=='stonewarden':catapult(p)
        elif family=='royalarsenal':cannon(p)
    return p
