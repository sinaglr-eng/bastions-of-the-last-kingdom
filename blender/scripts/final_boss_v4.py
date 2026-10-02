"""Morvath: original dark sovereign on an anatomical two-legged black wyvern.

Only the wave-50 visuals are authored here. No combat or enemy balance data is
generated. Continuous sculpted surfaces, weighted skin, editable Flight action.
Blender 5.2: --background --python this_file -- [--no-render] [--review]
"""
import bpy, sys, math, json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
sys.path.insert(0,str(Path(__file__).resolve().parent))
import defender_creatures_v8 as C
from author_archer import cube

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/assets/enemies'
SOURCES=ROOT/'blender/scenes/final-boss-v4'
REVIEW=ROOT/'blender/renders/final-boss-v4'
TAU=math.tau

def specs():
    bones=[('root',(0,-.2,1.3),(0,-.2,1.8),None),
      ('spine',(0,-.7,1.55),(0,.25,1.87),'root'),
      ('neck',(0,.22,1.85),(0,.69,2.35),'spine'),
      ('head',(0,.69,2.35),(0,1.45,2.63),'neck'),
      ('jaw',(0,.95,2.46),(0,1.73,2.36),'head'),
      ('tail',(0,-.8,1.62),(0,-1.85,1.5),'spine'),
      ('tail_tip',(0,-1.85,1.5),(.24,-3.0,1.12),'tail'),
      ('rider_hips',(0,-.29,2.11),(0,-.29,2.42),'spine'),
      ('rider_torso',(0,-.29,2.4),(0,-.28,2.96),'rider_hips'),
      ('rider_head',(0,-.28,2.94),(0,-.28,3.28),'rider_torso'),
      ('rider_robe',(0,-.35,2.35),(0,-.69,1.75),'rider_hips'),
      ('rider_upper_R',(.25,-.23,2.90),(.55,-.11,3.07),'rider_torso'),
      ('rider_forearm_R',(.55,-.11,3.07),(.62,.24,3.18),'rider_upper_R'),
      ('rider_hand_R',(.62,.24,3.18),(.62,.30,3.32),'rider_forearm_R'),
      ('rider_weapon',(.62,.24,3.18),(.62,.24,4.25),'rider_hand_R'),
      ('rider_upper_L',(-.25,-.23,2.90),(-.42,.04,2.66),'rider_torso'),
      ('rider_forearm_L',(-.42,.04,2.66),(-.31,.37,2.60),'rider_upper_L'),
      ('rider_hand_L',(-.31,.37,2.60),(-.27,.47,2.62),'rider_forearm_L')]
    for s,side in [(-1,'L'),(1,'R')]:
        bones += [('hind_upper_'+side,(s*.42,-.52,1.65),(s*.61,-.68,1.06),'spine'),
          ('hind_lower_'+side,(s*.61,-.68,1.06),(s*.43,-.43,.51),'hind_upper_'+side),
          ('hind_paw_'+side,(s*.43,-.43,.51),(s*.46,-.02,.43),'hind_lower_'+side),
          ('wing_upper_'+side,(s*.40,.01,1.98),(s*1.27,-.12,2.81),'spine'),
          ('wing_wrist_'+side,(s*1.27,-.12,2.81),(s*2.00,-.28,3.12),'wing_upper_'+side)]
        for i,(x,y,z) in enumerate([(4.75,-1.14,2.73),(3.55,-2.02,1.73),(1.78,-2.08,1.30)]):
            bones.append(('wing_digit_'+side+str(i),(s*2.0,-.28,3.12),(s*x,y,z),'wing_wrist_'+side))
        bones += [('rider_thigh_'+side,(s*.15,-.29,2.12),(s*.50,.12,1.86),'rider_hips'),
          ('rider_calf_'+side,(s*.50,.12,1.86),(s*.48,-.06,1.53),'rider_thigh_'+side)]
    return bones

def palette(variant):
    accent={'host_50':'a93766','host_50-tyrant':'bfa66a','host_50-devourer':'b7c4c9'}[variant]
    return dict(hide=C.material('Morvath black pebbled reptile hide','172024',.73),
      scales=C.material('Morvath obsidian scale ridges','344045',.57,.14),
      membrane=C.material('Morvath charcoal leathery wing membrane','282a30',.78),
      shadow=C.material('Morvath recessed mouth hood','0b1114',.91),
      ivory=C.material('Morvath aged ivory fangs','a9a99a',.51),
      horn=C.material('Morvath polished horn claws','454951',.37,.18),
      robe=C.material('Morvath woven black regal robe','1c1826',.78),
      trim=C.material('Morvath antique palladium gold edging','aa8b5d',.31,.81),
      steel=C.material('Morvath blackened articulated armor','5e6870',.32,.85),
      leather=C.material('Morvath fitted leather harness','3a2c28',.74),
      glow=C.material('Morvath cursed ruby violet focus',accent,.26,.18,1.15),
      teeth=C.material('Morvath mouth fleshy palate','472c39',.70))

def wyvern(p,bones):
    parts=[C.sweep('Wyvern continuous muscular thorax',[(0,-1.16,1.43),(0,-.77,1.58),(0,-.13,1.69),(0,.25,1.88),(0,.45,2.10)],[.07,.56,.54,.35,.22],[.11,.47,.48,.38,.24],p['hide'],sides=40,steps=9),
      C.sweep('Wyvern sinewy rising neck',[(0,.23,1.86),(0,.43,2.09),(0,.62,2.38),(0,.78,2.55)],[.30,.24,.19,.19],[.26,.25,.26,.19],p['hide'],sides=36,steps=9),
      C.sweep('Wyvern elongated wedge skull and snout',[(0,.61,2.51),(0,.81,2.70),(0,1.15,2.65),(0,1.49,2.51),(0,1.79,2.47)],[.12,.25,.21,.17,.085],[.10,.19,.16,.11,.048],p['hide'],sides=40,steps=9),
      C.sweep('Wyvern flowing tapering muscular tail',[(0,-.9,1.56),(0,-1.60,1.48),(.11,-2.21,1.35),(.28,-2.82,1.07),(.17,-3.27,.94)],[.32,.20,.11,.049,.001],[.25,.16,.10,.035,.001],p['hide'],sides=28,steps=9)]
    for s,side in [(-1,'L'),(1,'R')]:
        parts += [C.sweep('Wyvern joined folded hindleg '+side,[(s*.35,-.47,1.64),(s*.53,-.65,1.37),(s*.61,-.68,1.06),(s*.49,-.55,.71),(s*.43,-.43,.51)],[.22,.23,.15,.086,.073],[.22,.19,.13,.08,.065],p['hide'],sides=24,steps=8),
          C.sweep('Wyvern natural broad hindfoot '+side,[(s*.43,-.45,.50),(s*.46,-.30,.43),(s*.46,-.04,.43)],[.065,.12,.085],[.055,.07,.034],p['hide'],sides=22,steps=6),
          C.sweep('Wyvern wing shoulder tendon '+side,[(s*.36,.01,1.97),(s*.80,-.04,2.41),(s*1.27,-.12,2.81),(s*1.68,-.22,3.07),(s*2.0,-.28,3.12)],[.18,.14,.084,.052,.046],[.15,.12,.07,.051,.035],p['hide'],sides=24,steps=7)]
    names={n for n,a,b,parent in bones if not n.startswith('rider_') and n not in ('root','jaw')}
    anatomy_weights=C.distance_weights(bones,names)
    body=C.sculpt_union(parts,'Wyvern sculpted connected anatomy skin',p['hide'],24000,.022,anatomy_weights)
    bpy.context.view_layer.update();surface=BVHTree.FromObject(body,bpy.context.evaluated_depsgraph_get())
    def fitted(point):
        location,normal,index,distance=surface.find_nearest(Vector(point))
        return tuple(location+normal*.006) if location is not None else point
    C.sweep('Wyvern lower jaw with muscular hinge',[(0,.87,2.36),(0,1.17,2.28),(0,1.48,2.28),(0,1.73,2.37)],[.13,.17,.15,.058],[.095,.060,.040,.012],p['hide'],'jaw',32,8)
    C.sweep('Wyvern upper mouth recessed palate',[(0,.95,2.46),(0,1.26,2.43),(0,1.58,2.42),(0,1.74,2.44)],[.10,.18,.14,.045],[.025,.014,.009,.004],p['teeth'],'head',26,5)
    C.sweep('Wyvern lower fleshy tongue',[(0,1.04,2.345),(0,1.27,2.34),(0,1.52,2.35)],[.04,.08,.001],[.016,.013,.001],p['teeth'],'jaw',22,5)
    for s,side in [(-1,'L'),(1,'R')]:
        for i in range(9):
            y=.99+i*.072;x=s*(.17-.055*(i/8));z=2.465-.038*(i/8);length=.061 if i%3 else .116
            C.tube('Wyvern individual upper recurved fang '+side+str(i),[(x,y,z),(x*.96,y+.018,z-length*.62),(x*.91,y+.04,z-length)],[.022,.012,.001],p['ivory'],'head',10,4)
            C.tube('Wyvern lower interlocking fang '+side+str(i),[(x*.93,y+.026,2.322),(x*.9,y+.04,2.369),(x*.85,y+.055,2.397)],[.016,.01,.001],p['ivory'],'jaw',9,4)
        C.shell('Wyvern inset deep eye socket '+side,(s*.20,.955,2.696),(.068,.071,.044),p['shadow'],'head',28,16)
        C.shell('Wyvern luminous slit iris '+side,(s*.267,.978,2.698),(.009,.030,.017),p['glow'],'head',24,12)
        C.tube('Wyvern anatomical overhanging brow '+side,[(s*.18,.84,2.76),(s*.256,.95,2.743),(s*.222,1.10,2.692)],[.038,.038,.009],p['scales'],'head',14,5)
        C.tube('Wyvern crown-like swept cranial horn '+side,[(s*.16,.72,2.73),(s*.29,.49,2.96),(s*.36,.19,3.045),(s*.39,-.01,2.95)],[.088,.062,.034,.001],p['horn'],'head',18,7)
        C.shell('Wyvern recessed nostril '+side,(s*.065,1.719,2.501),(.025,.016,.012),p['shadow'],'head',18,8)
        for i in range(3):
            x=s*.46+(i-1)*.067
            C.tube('Wyvern articulated curved hindtoe '+side+str(i),[(x,-.20,.44),(x,-.025,.418),(x,.11,.425)],[.037,.028,.018],p['hide'],'hind_paw_'+side,12,6)
            C.tube('Wyvern fearsome separate talon '+side+str(i),[(x,.09,.434),(x,.195,.448),(x,.24,.381)],[.026,.017,.001],p['horn'],'hind_paw_'+side,10,6)
    # Plated ventral scutes follow the same skeletal segments as the neck.
    for i in range(11):
        t=i/10;y=-.84+t*1.36;z=1.20+.90*t;w=.39-.22*t
        C.sweep('Wyvern overlapping throat chest scute '+str(i),[(-w,y,z),(-w*.65,y+.023,z-.019),(0,y+.035,z-.032),(w*.65,y+.023,z-.019),(w,y,z)],[.017]*5,[.018]*5,p['scales'],'spine' if i<7 else 'neck',12,4)
    for i in range(14):
        t=i/13;y=-3.0+t*3.52;z=1.06+.74*t;length=.16+.13*math.sin(t*math.pi)
        C.tube('Wyvern dorsal jagged crest spine '+str(i),[(0,y,z),(0,y-.045,z+length*.65),(0,y-.13,z+length)],[.048,.039,.001],p['horn'],'tail_tip' if i<4 else 'tail' if i<8 else 'spine',12,5)
    # Embedded scale polygons are low-cost shaped surfaces, not floating beads.
    for s,side in [(-1,'L'),(1,'R')]:
        for row in range(4):
            for i in range(9):
                y=-.80+i*.117;a=.20+row*.35;x=s*.51*math.sin(a);z=1.67+.43*math.cos(a)
                profile=[fitted(point) for point in [(x,y-.044,z),(x+s*.035,y,z+.014),(x,y+.068,z+.008),(x-s*.025,y,z-.009)]]
                C.plate('Wyvern inset chevron scale '+side+str(row)+'_'+str(i),profile,p['scales'],anatomy_weights,.004)

def wings(p):
    for s,side in [(-1,'L'),(1,'R')]:
        wrist=Vector((s*2.0,-.28,3.12));root=Vector((s*.40,-.23,1.72))
        tips=[Vector((s*4.75,-1.14,2.73)),Vector((s*3.55,-2.02,1.73)),Vector((s*1.78,-2.08,1.30))]
        for i,tip in enumerate(tips):
            bone='wing_digit_'+side+str(i)
            C.tube('Wyvern long wing finger bone '+side+str(i),[wrist,wrist.lerp(tip,.46)+Vector((0,.015,.052)),tip],[.039,.023,.003],p['horn'],bone,14,8)
        C.tube('Wyvern opposed wing thumb claw '+side,[wrist,wrist+Vector((s*.10,.075,.20)),wrist+Vector((s*.12,.25,.13))],[.045,.029,.001],p['horn'],'wing_wrist_'+side,14,7)
        for patch in range(3):
            a=tips[patch];b=tips[patch+1] if patch<2 else root;v=[];weights=[];rows=18;cols=18
            for r in range(rows+1):
                u=r/rows
                for c in range(cols+1):
                    t=c/cols;edge=a.lerp(b,t)+Vector((0,.20*math.sin(math.pi*t),.115*math.sin(math.pi*t)))
                    point=wrist.lerp(edge,u)+Vector((0,.080*math.sin(math.pi*u)*math.sin(math.pi*t),0));v.append(tuple(point))
                    n1='wing_digit_'+side+str(patch);n2='wing_digit_'+side+str(patch+1) if patch<2 else 'wing_upper_'+side
                    weights.append({'wing_wrist_'+side:1-u,n1:u*(1-t),n2:u*t})
            faces=[(r*(cols+1)+c,r*(cols+1)+c+1,(r+1)*(cols+1)+c+1,(r+1)*(cols+1)+c) for r in range(rows) for c in range(cols)]
            callback=lambda point,rows=weights,points=v:rows[min(range(len(points)),key=lambda j:(Vector(points[j])-point).length_squared)]
            # Assign known vertex indices directly; the thin double-sided membrane
            # requires no duplicate shell and shares the actual finger skeleton.
            obj=C.mesh('Wyvern scalloped tensioned membrane '+side+str(patch),v,faces,p['membrane'])
            obj.vertex_groups.clear()
            for name in set(k for row in weights for k in row):
                group=obj.vertex_groups.new(name=name)
                for j,row in enumerate(weights):
                    if row.get(name,0)>0:group.add([j],row[name],'REPLACE')
            p['membrane'].use_backface_culling=False
            border=[a.lerp(b,t/24)+Vector((0,.20*math.sin(math.pi*t/24),.115*math.sin(math.pi*t/24))) for t in range(25)]
            C.tube('Wyvern continuous membrane trailing edge '+side+str(patch),border,[.009]*25,p['scales'],n1,7,1)
            for vein in range(1,5):
                t=vein/5;edge=a.lerp(b,t)+Vector((0,.20*math.sin(math.pi*t),.115*math.sin(math.pi*t)))
                C.tube('Wyvern subtle leathery wing vein '+side+str(patch)+'_'+str(vein),[wrist,wrist.lerp(edge,.5)+Vector((0,.02,.004)),edge],[.008,.004,.001],p['scales'],n1 if t<.5 else n2,6,5)

def hand(p,side,bones):
    right=side=='R';cx,cy,cz=(.62,.24,3.20) if right else (-.31,.37,2.60);s=1 if right else -1
    bone='rider_hand_'+side
    parts=[C.sweep('Sorcerer joined gauntlet palm '+side,[(cx-s*.033,cy-.065,cz-.052),(cx,cy-.028,cz),(cx+s*.033,cy+.006,cz+.047)],[.038,.047,.031],[.028,.031,.02],p['steel'],bone,22,7)]
    for i in range(4):
        z=cz+.036-i*.024
        if right:
            path=[(cx-s*.017,cy-.027,z),(cx+s*.015,cy-.04,z+.004),(cx+s*.052,cy-.016,z),(cx+s*.042,cy+.033,z-.003),(cx+s*.009,cy+.034,z-.008)]
        else:
            path=[(cx+s*.012,cy-.027,z),(cx+s*.052,cy+.002,z),(cx+s*.062,cy+.038,z-.01),(cx+s*.033,cy+.06,z-.017)]
        parts.append(C.tube('Sorcerer curved separately defined finger '+side+str(i),path,[.013,.014,.012,.010,.007] if right else [.012,.013,.011,.007],p['steel'],bone,12,6))
    thumb=[(cx-s*.031,cy-.020,cz+.015),(cx-s*.043,cy+.011,cz+.054),(cx-s*.007,cy+.044,cz+.056),(cx+s*.009,cy+.026,cz+.036)]
    parts.append(C.tube('Sorcerer correctly opposed thumb '+side,thumb,[.019,.018,.014,.008],p['steel'],bone,12,6))
    C.sculpt_union(parts,'Sorcerer continuous five-finger gripping gauntlet '+side,p['steel'],2600,.005,bone)
    C.marker('sword_grip' if right else 'reins_grip',(cx,cy,cz),bone)

def rider(p,bones):
    # A contoured seat wraps over the scapular ridge; pelvis and thighs touch it.
    C.sweep('Sorcerer saddle contoured padded seat',[(0,-.56,2.13),(0,-.34,2.17),(0,-.12,2.15),(0,.04,2.11)],[.19,.24,.24,.15],[.048,.05,.039,.035],p['leather'],'spine',28,6)
    C.marker('saddle_seat',(0,-.29,2.175),'spine');C.marker('rider_seat_contact',(0,-.29,2.18),'rider_hips')
    torso=C.sweep('Sorcerer continuous seated robe body',[(0,-.29,2.12),(0,-.30,2.30),(0,-.30,2.48),(0,-.28,2.77),(0,-.26,2.92),(0,-.27,2.97)],[.17,.22,.18,.27,.27,.13],[.15,.17,.14,.18,.18,.10],p['robe'],sides=36,steps=9,detail=.026)
    limbparts=[torso]
    for s,side in [(-1,'L'),(1,'R')]:
        limbparts.append(C.sweep('Sorcerer seated wrapped thigh '+side,[(s*.14,-.30,2.19),(s*.34,-.14,2.05),(s*.50,.12,1.86)],[.13,.125,.091],[.13,.12,.092],p['robe'],sides=24,steps=7))
    C.sculpt_union(limbparts,'Sorcerer tailored joined robe torso and thighs',p['robe'],8500,.010,C.distance_weights(bones,{'rider_hips','rider_torso','rider_thigh_L','rider_thigh_R'}))
    # Cloth panel uses radial fitted draping, a continuous carved hem with folds.
    for s,side in [(-1,'L'),(1,'R')]:
        C.sweep('Sorcerer weight-bearing boot and calf '+side,[(s*.50,.12,1.85),(s*.49,.0,1.68),(s*.48,-.06,1.53),(s*.48,.06,1.50)],[.084,.071,.060,.061],[.078,.058,.056,.084],p['leather'],'rider_calf_'+side,26,7)
        C.ring('Sorcerer closed stirrup supporting boot '+side,(s*.49,.018,1.52),.104,.014,p['trim'],'rider_calf_'+side,'X',32)
        C.tube('Sorcerer real saddle stirrup leather '+side,[(s*.20,-.28,2.16),(s*.46,-.20,1.94),(s*.49,.018,1.61)],[.022,.018,.016],p['leather'],'rider_thigh_'+side,10,6)
        C.marker('boot_stirrup_contact_'+side,(s*.48,.015,1.49),'rider_calf_'+side)
    # Attached cloth cape has a shaped, asymmetric hem and layered vertical folds.
    v=[];rows=24;cols=28
    for j in range(rows+1):
        t=j/rows
        for i in range(cols+1):
            u=i/cols;angle=(u-.5)*2.9;w=.30+.36*t
            x=w*math.sin(angle);y=-.34-(.17+.45*t)*math.cos(angle)+.019*math.sin(u*TAU*6)*t;z=2.92-t*(1.38+.11*math.cos(u*TAU*3))
            v.append((x,y,z))
    faces=[(j*(cols+1)+i,j*(cols+1)+i+1,(j+1)*(cols+1)+i+1,(j+1)*(cols+1)+i) for j in range(rows) for i in range(cols)]
    C.mesh('Sorcerer folded continuous hanging mantle',v,faces,p['robe'],'rider_robe');p['robe'].use_backface_culling=False
    # Shoulder-to-hand sleeves are continuous tapered bent surfaces, with fitted cuffs.
    arms={'R':[(.25,-.23,2.90),(.39,-.17,3.02),(.55,-.11,3.07),(.60,.12,3.15),(.62,.21,3.18)],
          'L':[(-.25,-.23,2.90),(-.36,-.09,2.77),(-.42,.04,2.66),(-.37,.25,2.61),(-.31,.35,2.60)]}
    for side,path in arms.items():
        weights=C.distance_weights(bones,{'rider_upper_'+side,'rider_forearm_'+side,'rider_hand_'+side})
        C.sweep('Sorcerer natural bent seamless sleeve '+side,path,[.11,.10,.083,.061,.048],[.10,.10,.077,.056,.042],p['robe'],weights,28,8,detail=.025)
        hand(p,side,bones)
        cx,cy,cz=path[-1];C.ring('Sorcerer fitted engraved gauntlet cuff '+side,(cx,cy,cz),.052,.008,p['trim'],'rider_forearm_'+side,'Z',32)
    # Hood follows a fully enclosed head; inner face remains an ominous dark cavity.
    C.sweep('Sorcerer folded full protective cowl',[(0,-.28,2.94),(0,-.28,3.13),(0,-.29,3.32),(0,-.31,3.39)],[.10,.17,.145,.005],[.10,.15,.13,.008],p['robe'],'rider_head',36,8,detail=.06)
    C.shell('Sorcerer deeply hooded invisible face',(0,-.138,3.19),(.115,.013,.13),p['shadow'],'rider_head',32,20)
    for s in [-1,1]:
        C.tube('Sorcerer hood substantial stitched brow '+str(s),[(0,-.115,3.327),(s*.10,-.116,3.29),(s*.13,-.125,3.18),(s*.098,-.14,3.04)],[.022,.019,.019,.028],p['robe'],'rider_head',12,7)
    C.ring('Sorcerer fitted dark royal crown circlet',(0,-.285,3.315),.157,.016,p['steel'],'rider_head','Z',48)
    for i in range(9):
        a=TAU*i/9;c=Vector((.15*math.cos(a),-.285+.134*math.sin(a),3.315));z=.14 if i%2 else .095
        C.tube('Sorcerer ornate obsidian crown tine '+str(i),[c,c+Vector((.016*math.cos(a),.016*math.sin(a),z*.65)),c+Vector((.025*math.cos(a),.025*math.sin(a),z))],[.014,.019,.001],p['steel'],'rider_head',12,6)
        C.shell('Sorcerer inset crown cursed jewel '+str(i),tuple(c+Vector((.004*math.cos(a),.004*math.sin(a),.025))),(.012,.012,.024),p['glow'],'rider_head',16,8)
    # Sword hilt passes through opposed fingers. Blade is a tapered diamond section.
    C.tube('Sorcerer leather sword hilt in closed grip',[(.62,.24,3.115),(.62,.24,3.24),(.62,.24,3.365)],[.021,.019,.017],p['leather'],'rider_weapon',16,6)
    C.tube('Sorcerer curved thorn sword crossguard',[(.43,.24,3.34),(.51,.24,3.39),(.62,.24,3.365),(.73,.24,3.39),(.81,.24,3.34)],[.010,.018,.024,.018,.010],p['trim'],'rider_weapon',12,6)
    v=[]
    for z,w,d in [(3.38,.064,.020),(3.52,.079,.019),(3.93,.056,.014),(4.25,.001,.001)]:
        v.extend([(.62-w,.24,z),(.62,.24-d,z),(.62+w,.24,z),(.62,.24+d,z)])
    f=[(j*4+i,j*4+(i+1)%4,(j+1)*4+(i+1)%4,(j+1)*4+i) for j in range(3) for i in range(4)]+[(3,2,1,0),(12,13,14,15)]
    C.mesh('Sorcerer forged magical sword with diamond-section fuller',v,f,p['steel'],'rider_weapon',False)
    C.tube('Sorcerer sword luminous inset runic fuller',[(.62,.220,3.46),(.62,.222,3.80),(.62,.229,4.09)],[.003,.004,.001],p['glow'],'rider_weapon',8,8)
    for name in ['sword_tip','attack_muzzle']:C.marker(name,(.62,.24,4.25),'rider_weapon')
    # Real bridle fitted around the skull; reins originate at the bit and meet the hand.
    for s,side in [(-1,'L'),(1,'R')]:
        C.tube('Wyvern fitted muzzle bridle '+side,[(s*.13,1.59,2.41),(s*.18,1.40,2.60),(s*.23,.94,2.79),(s*.22,.70,2.68)],[.014]*4,p['leather'],'head',10,7)
        C.ring('Wyvern metal bridle bit ring '+side,(s*.16,1.56,2.43),.043,.008,p['trim'],'head','Y',24)
        C.tube('Sorcerer continuous bowed reins '+side,[(s*.16,1.56,2.43),(s*.22,1.10,2.40),(-.27,.70,2.48),(-.31,.40,2.60)],[.011,.010,.009,.008],p['leather'],C.distance_weights(bones,{'head','rider_hand_L','neck'}),10,10)
    C.tube('Wyvern connected fitted bridle noseband',[(-.16,1.53,2.48),(0,1.60,2.54),(.16,1.53,2.48)],[.018]*3,p['leather'],'head',10,7)

def animation():
    idle=[]
    for frame,s in [(0,0),(15,1),(30,0),(45,-1),(60,0),(75,1),(90,0),(105,-1),(120,0)]:
        idle.append((frame,{'wing_upper_L':(0,.035*s,.18*s),'wing_upper_R':(0,-.035*s,-.18*s),
          'wing_wrist_L':(0,0,.07*s),'wing_wrist_R':(0,0,-.07*s),'neck':(.018*s,0,0),
          'head':(-.012*s,0,0),'tail_tip':(.020*s,.012*s,0),'rider_torso':(-.006*s,0,0),
          'rider_robe':(.018*s,0,.008*s),'hind_upper_L':(.035*s,0,0),'hind_upper_R':(-.035*s,0,0)}))
    # Boss is an advancing invader and has no combat attack. Idle/Flight express
    # only locomotion. This optional flourish is an atelier action, never a hit.
    attack=[(9,{'rider_upper_R':(-.10,.03,-.08),'rider_forearm_R':(.07,0,0),'rider_torso':(.018,0,-.03)}),
      (18,{'rider_upper_R':(.18,-.015,.10),'rider_forearm_R':(-.08,0,0),'rider_torso':(-.02,0,.045),'neck':(-.035,0,0),'jaw':(.08,0,0)}),
      (28,{'rider_upper_R':(.08,0,.035),'rider_torso':(0,0,.02)}),(40,{'rider_upper_R':(.02,0,0)})]
    C.animate(attack,idle)
    C.RIG['assetRevision']='final-boss-v4';C.RIG['designName']='Morvath, the Dread Sovereign';C.RIG['twoLeggedWyvern']=True
    C.RIG['movement']='Flight clip only during advance; does not introduce a boss attack or damage mechanic'

def bounds():
    pts=[o.matrix_world@Vector(co) for o in C.PARTS if o.name in bpy.data.objects for co in o.bound_box]
    lo=[min(p[i] for p in pts) for i in range(3)];hi=[max(p[i] for p in pts) for i in range(3)]
    return dict(min=lo,max=hi,size=[hi[i]-lo[i] for i in range(3)])

def staging(dim,res=(1100,850),angle='front'):
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24
    scene.render.resolution_x=res[0];scene.render.resolution_y=res[1];scene.render.resolution_percentage=100
    scene.render.film_transparent=False;scene.world.color=(.12,.12,.12)
    centre=Vector((0,-.60,2.13));positions={'front':(8.5,15.5,6.4),'back':(-8,-14,6.4),'left':(-15,.0,4.8),'right':(15,0,4.8),'face':(1.2,4.5,3.9),'hands':(1.8,3.0,3.4),'seat':(4.2,2,3.0)}
    camera=bpy.data.objects.new('Morvath review camera',bpy.data.cameras.new('Morvath review camera'));bpy.context.collection.objects.link(camera);scene.camera=camera
    camera.location=positions[angle]
    if angle=='face':centre=Vector((0,-.17,3.21));scale=1.1
    elif angle=='hands':centre=Vector((.59,.20,3.20));scale=.60
    elif angle=='seat':centre=Vector((0,-.27,2.15));scale=2.25
    else:scale=11.0
    camera.rotation_euler=(centre-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=scale
    for name,loc,power,color,size in [('Key',(3,5,9),2300,(.88,.87,.99),7),('Fill',(-5,4,5),1800,(.60,.70,1),6),('Rim',(1,-5,6),2500,(.82,.34,.54),5)]:
        light=bpy.data.objects.new(name,bpy.data.lights.new(name,'AREA'));light.data.energy=power;light.data.color=color;light.data.shape='DISK';light.data.size=size;light.location=loc;light.rotation_euler=(centre-light.location).to_track_quat('-Z','Y').to_euler();bpy.context.collection.objects.link(light)
    floor=C.material('Morvath review ground','425154',.91)
    cube('Review floor',(0,-.5,.06),(15,14,.08),floor,0)

def batch_export(identifier):
    rig=C.RIG
    # Collapse only material batches, preserving vertex groups and skin weights.
    groups={}
    for obj in list(C.PARTS):
        if obj.name in bpy.data.objects:groups.setdefault(obj.data.materials[0],[]).append(obj)
    for mat,parts in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in parts:obj.select_set(True)
        bpy.context.view_layer.objects.active=parts[0]
        if len(parts)>1:bpy.ops.object.join()
        parts[0].name='Morvath authored surface '+mat.name;parts[0].parent=rig
    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.context.scene.objects:
        if obj.type not in ('LIGHT','CAMERA') and obj.name!='Review floor':obj.select_set(True)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=str(OUT/(identifier+'.glb')),export_format='GLB',use_selection=True,export_apply=False,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_extras=True,export_yup=True,export_cameras=False,export_lights=False)

def run():
    OUT.mkdir(parents=True,exist_ok=True);SOURCES.mkdir(parents=True,exist_ok=True);REVIEW.mkdir(parents=True,exist_ok=True)
    entries=[]
    only=sys.argv[sys.argv.index('--only')+1] if '--only' in sys.argv else None
    for identifier in ['host_50','host_50-tyrant','host_50-devourer']:
        if only and identifier not in only.split(','):continue
        bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);C.reset()
        bones=specs();C.rig(bones,'Morvath');p=palette(identifier);wyvern(p,bones);wings(p);rider(p,bones);animation();bpy.context.view_layer.update()
        # Keep sculpted face, hands and primary anatomy; simplify redundant
        # samples along long reins, wing veins, cuffs and robe tessellation.
        for obj in list(C.PARTS):
            if obj.name not in bpy.data.objects:continue
            count=sum(len(poly.vertices)-2 for poly in obj.data.polygons)
            if count<500 or any(word in obj.name for word in ('sculpted connected','five-finger','joined robe')):continue
            armatures=[mod for mod in obj.modifiers if mod.type=='ARMATURE']
            for mod in armatures:obj.modifiers.remove(mod)
            modifier=obj.modifiers.new('Preserve silhouette reduce redundant samples','DECIMATE');modifier.ratio=.56
            bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=modifier.name)
            modifier=obj.modifiers.new('Actual deform bones','ARMATURE');modifier.object=C.RIG
        remaining=sum(sum(len(poly.vertices)-2 for poly in obj.data.polygons) for obj in C.PARTS if obj.name in bpy.data.objects)
        if remaining>90000:
            for obj in list(C.PARTS):
                if obj.name not in bpy.data.objects or any(word in obj.name for word in ('five-finger','sculpted connected','joined robe')):continue
                count=sum(len(poly.vertices)-2 for poly in obj.data.polygons)
                if count<100:continue
                for mod in list(obj.modifiers):
                    if mod.type=='ARMATURE':obj.modifiers.remove(mod)
                modifier=obj.modifiers.new('Secondary surface web budget','DECIMATE');modifier.ratio=.80
                bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=modifier.name)
                modifier=obj.modifiers.new('Actual deform bones','ARMATURE');modifier.object=C.RIG
        dim=bounds();triangles=sum(sum(len(poly.vertices)-2 for poly in obj.data.polygons) for obj in C.PARTS if obj.name in bpy.data.objects)
        if triangles>95000:raise ValueError('Boss triangle budget exceeded: '+str(triangles))
        bpy.context.scene['Asset']='Wave 50 only; no mechanics altered';bpy.context.scene['Design']='Two-legged black wyvern; seated dark hooded sorcerer with closed crown and magic sword'
        staging(dim,(640,500));bpy.ops.wm.save_as_mainfile(filepath=str(SOURCES/(identifier+'.blend')))
        if '--no-render' not in sys.argv:
            bpy.context.scene.render.film_transparent=True;bpy.data.objects['Review floor'].hide_render=True
            bpy.context.scene.render.filepath=str(OUT/(identifier+'.png'));bpy.ops.render.render(write_still=True)
            bpy.data.objects['Review floor'].hide_render=False;bpy.context.scene.render.film_transparent=False
        batch_export(identifier)
        entries.append(dict(id=identifier,file=identifier+'.glb',portrait=identifier+'.png',style='designed-defenders-v8',revision='final-boss-v4',triangles=triangles,authoring='Blender 5.2',name='Morvath, the Dread Sovereign',archetype='queen-wyvern',source='blender/scenes/final-boss-v4/'+identifier+'.blend',bounds=dim,height=dim['size'][2],wingspan=dim['size'][0],nativeScale=1,semanticParts=['two-legged-wyvern','wing-digit-L','wing-digit-R','rider-seat-contact','saddle-seat','sword-grip','reins-grip','five-finger-gauntlets','dark-crown','attack_muzzle'],auraStage=4,animations=['Idle','Attack']))
        print('FINAL_BOSS_V4 '+identifier+' '+str(triangles)+' '+str(dim),flush=True)
    (ROOT/'artifacts/final-boss-v4-rows.json').write_text(json.dumps(entries,indent=2)+'\n',encoding='utf-8')

if __name__=='__main__':run()
