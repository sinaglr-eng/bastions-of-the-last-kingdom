"""Dedicated physical source silhouettes for Iron Ram / Spell Eater / Soul Ogre.

Authored from all six approved views per subject. These three are deliberately
separate from the humanoid default: broad species torso, short legs and actual
source equipment. +Y front, +X own right, Z up; all joints are rigid pivots.
"""
import math,json
from mathutils import Vector
from geometric_game_common import linear

SILHOUETTES={
 'host_22':dict(facez=1.34,fw=.42,fh=.31,shoulder=1.16,belt=.59,halfwidth=.47,skin='C0B67D',rightz=.84,leftz=.48),
 'host_26':dict(facez=1.58,fw=.47,fh=.44,shoulder=1.31,belt=.74,halfwidth=.49,skin='9F9F62',rightz=.80,leftz=.65),
 'host_43':dict(facez=1.31,fw=.44,fh=.27,shoulder=1.12,belt=.52,halfwidth=.48,skin='C9C398',rightz=.57,leftz=.48),
}

def build_source_heavy_orc(b,row,ell,cone,leaf,annulus,gear):
 from geometric_roster_builder import open_helm
 aid=b.id;cfg=SILHOUETTES[aid];armored=aid=='host_22';spell=aid=='host_26';soul=aid=='host_43'
 def paint(key,value):
  rgba=tuple(linear(int(value[i:i+2],16)/255) for i in (0,2,4))+(1,)
  m=b.M[key];m.diffuse_color=rgba;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=rgba;m['source_srgb']='#'+value
  b.palette[key]=value
 paint('skin',cfg['skin']);paint('skin_light','C9C28B' if armored else 'ACAD6D' if spell else 'D2CEA4')
 paint('steel','87888A');paint('steel_light','ACABAA');paint('steel_dark','58595A');paint('leather','70573D');paint('dark','373734')
 if spell:paint('cloth','44443F')
 belt=cfg['belt'];shz=cfg['shoulder'];fw=cfg['fw'];fh=cfg['fh'];fz=cfg['facez'];tw=cfg['halfwidth']
 tor=b.pivot('torso_pivot',(0,0,belt));head=b.pivot('head_pivot',(0,0,fz-.10),tor)
 b.root['locomotion']='biped';b.root['attackStyle']='hammer';b.root['geometricRig']=True
 b.root['sourceHeavyOrcRevision']='source-heavy-orcs-v1';b.root['sourceSilhouetteReadings']=json.dumps(cfg)
 b.root['sourceRevision']='geometric-turnarounds-v1';b.root['sourceFile']=row['source'];b.root['sourceSha256']=row['sha256']
 b.root['scaleAssumption']='Raster concepts have no physical dimensions; source-specific broad torso and short-legged anatomy at approx 1.8m full sculpture height.'
 # A continuous closed, triangulated faceted body, never a thin stretched cube.
 chest_center=(shz+belt)/2+.04;chest_rz=(shz-belt)*.64
 ell(b,'Heavy species broad faceted thorax',(0,-.01,chest_center),(tw,.30,chest_rz),'steel' if armored else 'skin',tor,10,4)
 if armored:
  ell(b,'Fitted full iron breast and back armor',(0,.025,belt+.21),(tw*.98,.315,.32),['steel','steel_light'],tor,10,4)
 else:
  ell(b,'Source wide potbelly abdomen',(0,.065,belt+.16),(tw*.94,.33,.30),'skin_light',tor,10,4)
 # Short, spread legs and large grounded boots retain the source stance.
 legs={}
 for sn,sg in [('R',1),('L',-1)]:
  hip=(sg*tw*.53,-.01,belt-.07);knee=(sg*tw*.65,.015,.27);ank=(sg*tw*.69,.025,.12)
  thigh=b.pivot('upper_leg_'+sn,hip);shin=b.pivot('shin_'+sn,knee,thigh);foot=b.pivot('foot_'+sn,ank,shin);legs[sn]=(thigh,shin,foot,hip,knee,ank)
  b.limb('Heavy short upper leg '+sn,[hip,knee],[.165,.151],'steel_dark' if armored else 'skin',thigh,8)
  b.limb('Heavy short shin '+sn,[knee,ank],[.15,.132],'steel_dark' if armored else 'leather',shin,8)
  x=ank[0];bootmat='steel_dark' if armored else 'leather'
  b.loft('Grounded boot '+sn,[b.chamfer(x,.065,0,.34,.43,.035),b.chamfer(x,.065,.055,.35,.43,.035),b.chamfer(x,.035,.15,.31,.36,.029),b.chamfer(x,-.02,.225,.28,.26,.025)],bootmat,foot)
  if armored or soul:
   b.box('Layered metal kneecap '+sn,(knee[0],.16,.28),(.30,.12,.20),'steel',.027,shin)
   b.box('Steel armored boot instep '+sn,(x,.16,.125),(.29,.25,.10),'steel',.021,foot)
   for z in (.33,.405):b.box('Thigh overlapping iron lamella '+sn,(hip[0],.155,z),(.32,.115,.12),'steel',.018,thigh)
  else:
   b.limb('Broad leather ankle wrap '+sn,[(x,.025,.18),(x,.025,.26)],[.158,.15],'leather',shin,8)
 # Leather skirt is actual ragged closed cloth panels around the hip.
 n=12;top=b.ring(0,0,belt-.032,tw*.93,.27,n)
 bottom=[(tw*1.03*math.sin(i*math.tau/n),.29*math.cos(i*math.tau/n),belt-(.37 if spell else .30)+(.055 if i%2 else 0)) for i in range(n)]
 b.loft('Connected ragged leather battle skirt',[bottom,top],'leather',tor)
 for j in range(7):
  a=(j-3)*.39;x=tw*.99*math.sin(a);y=.29*math.cos(a);z=belt-.055;low=belt-(.35 if spell else .32)+(.026 if j%2 else 0)
  outline=[(x-.061,y+.020,z),(x+.061,y+.020,z),(x+.065,y+.035,low+.045),(x,y+.040,low),(x-.063,y+.035,low+.046)]
  b.panel('Individual source ragged leather skirt flap',outline,.022,'leather',tor,.012)
  if armored and j in (0,1,5,6):b.box('Hip overlapping plate',(x,y+.045,belt-.15),(.19,.065,.20),'steel',.026,tor)
 for j in range(-2,3):
  a=math.pi+j*.43;x=tw*.99*math.sin(a);y=.29*math.cos(a);z=belt-.055;low=belt-(.34 if spell else .30)+(.025 if j%2 else 0)
  b.panel('Individual source rear ragged leather skirt flap',[(x-.064,y-.015,z),(x+.064,y-.015,z),(x+.063,y-.030,low+.044),(x,y-.035,low),(x-.060,y-.030,low+.041)],.022,'leather',tor,.009)
 # Continuous broad horizontal belt and perimeter rivets.
 b.loft('Continuous heavy leather belt',[b.ring(0,0,z,tw*.99,.32,12) for z in (belt-.015,belt+.085)],'leather',tor)
 for j in range(12):
  a=j*math.tau/12;ell(b,'Waist belt actual metal rivet',(tw*1.008*math.sin(a),.329*math.cos(a),belt+.035),(.018,.018,.018),'steel_light',tor,6,2)
 if not spell:
  b.box('Front belt square metal rim',(0,.344,belt+.025),(.19,.041,.13),'steel_light',.014,tor)
  b.box('Front belt buckle dark aperture',(0,.368,belt+.025),(.125,.010,.072),'leather',.002,tor)
  b.box('Belt buckle pin',(.017,.379,belt+.025),(.035,.012,.069),'steel',.003,tor)
 # Canonical articulated arms. Paired shoulders are much broader than the head.
 arms={}
 for sn,sg in [('R',1),('L',-1)]:
  sh=(sg*(tw+.015),0,shz);ha=(sg*(tw+.17),.22,cfg['rightz'] if sg>0 else cfg['leftz']);el=(sg*(tw+.16),.045,(shz+ha[2])/2)
  up=b.pivot('upper_arm_'+sn,sh,tor);fore=b.pivot('forearm_'+sn,el,up);hand=b.pivot('hand_'+sn,ha,fore);weapon=b.pivot('weapon_'+sn,ha,hand);arms[sn]=(up,fore,hand,weapon,sh,el,ha)
  ell(b,'Heavy connected deltoid '+sn,sh,(.221,.222,.225),'skin',up,8,3)
  b.limb('Muscular upper arm '+sn,[sh,el],[.209,.202],'skin',up,8)
  b.limb('Muscular heavy forearm '+sn,[el,ha],[.190,.152],'skin',fore,8)
  ell(b,'Broad grasping orc fist '+sn,ha,(.167,.158,.173),'skin_light',hand,8,3)
  for j in range(3):b.box('Visible curled orc knuckle '+sn,(ha[0]+(j-1)*.073,ha[1]+.123,ha[2]+.008),(.064,.063,.100),'skin',.012,hand)
  if armored or soul:
   # Three overlapping closed iron segments show the source cuff seams.
   A=Vector(el).lerp(Vector(ha),.48);C=Vector(el).lerp(Vector(ha),.86)
   b.limb('Full segmented armored bracer '+sn,[tuple(A),tuple(C)],[.207,.18],'steel',fore,8)
   for t in (.49,.70,.86):
    c=Vector(el).lerp(Vector(ha),t);d=(Vector(ha)-Vector(el)).normalized();b.limb('Bracer raised metal edge '+sn,[tuple(c-d*.018),tuple(c+d*.018)],[.213 if t<.8 else .185]*2,'steel_light',fore,8)
    ell(b,'Bracer front iron rivet '+sn,(c.x,c.y+.21,c.z),(.022,.014,.022),'steel_light',fore,6,2)
   # Curved source shoulder armor with two overlapping lower layers.
   for k in range(2 if soul else 3):
    p=Vector(sh).lerp(Vector(el),.12+k*.14);ell(b,'Stacked source iron pauldron '+sn,tuple(p),(.263-k*.011,.265-k*.011,.175),['steel','steel_light'],up,8,3)
    for off in (-.115,.115):ell(b,'Pauldron visible iron rivet '+sn,(p.x+off,p.y+.245,p.z+.057),(.018,.014,.018),'steel_light',up,6,2)
  else:
   A=Vector(el).lerp(Vector(ha),.48);C=Vector(el).lerp(Vector(ha),.80);b.limb('Wide plain leather wrist binding '+sn,[tuple(A),tuple(C)],[.20,.18],'leather',fore,8)
 # Source helmets are metal covers around a shallow visible face aperture.
 if not spell:
  open_helm(b,head,(0,-.035,fz),fw,fh)
  shell=next(o for o in b.objects if o.name=='Continuous wrapped hood open steel helmet')
  # Actual posterior crown volume, rather than a flat unrelieved rear panel.
  shell.data.vertices[32].co.y-=.060;shell.data.update()
  front=-.035+fw*.34
  # A shallow observed face, without a hidden full skull or scalp behind metal.
  b.box('Observed face',(0,front-.033,fz),(fw*.94,.055,fh*.89),'skin',.014,head)
  b.box('Orc actual broad exposed lower jaw',(0,front+.033,fz-fh*.35),(fw*1.04,.096,fh*.22),'skin_light',.017,head)
  if soul:
   b.box('Helmet solid source front iron visor',(0,front+.013,fz+fh*.09),(fw*1.02,.08,fh*.73),'steel',.026,head)
   for sg in (-1,1):b.box('Helmet actual black square eye recess',(sg*fw*.235,front+.057,fz+fh*.14),(.055,.012,.059),'eyes',.001,head)
   b.box('Helmet actual black nose recess',(0,front+.057,fz-fh*.15),(.047,.012,.052),'eyes',.001,head)
  else:
   for sg in (-1,1):b.box('Eye '+('R' if sg>0 else 'L'),(sg*fw*.235,front+.004,fz+fh*.075),(fw*.14,.012,fh*.20),'eyes',.001,head)
  for sg in (-1,1):cone(b,'Large source ivory lower tusk',(sg*fw*.355,front+.102,fz-fh*.29),(sg*fw*.34,front+.100,fz-fh*.01),fw*.080,'ivory',head,4)
  for sg in (-1,1):ell(b,'Helmet brow visible metal rivet',(sg*fw*.48,front+.029,fz+fh*.55),(.016,.014,.016),'steel_light',head,6,2)
  if armored:
   for sg in (-1,1):
    p=[(sg*.24,-.08,1.61),(sg*.33,-.08,1.79),(sg*.49,-.065,1.77),(sg*.56,-.045,1.61),(sg*.49,-.005,1.48),(sg*.385,.01,1.49),(sg*.36,.018,1.58)]
    b.limb('Actual curled segmented ram horn',p,[.111,.127,.116,.103,.085,.067,.022],'wood',head,6)
   # Two metal horn mounting straps bind the source helmet.
   for sg in (-1,1):b.box('Ram horn mounting iron bracket',(sg*.28,front-.025,1.615),(.115,.18,.08),'steel',.012,head)
 else:
  b.box('Observed face',(0,0,fz),(fw,fw*.65,fh),'skin',.035,head);front=fw*.65/2
  b.box('Orc broad source projecting jaw',(0,front+.057,fz-fh*.31),(fw*1.04,.14,fh*.24),'skin_light',.025,head)
  for sg in (-1,1):
   b.box('Eye '+('R' if sg>0 else 'L'),(sg*fw*.205,front+.006,fz+fh*.10),(fw*.14,.012,fh*.18),'eyes',.001,head)
   cone(b,'Long source ivory orc tusk',(sg*fw*.36,front+.117,fz-fh*.25),(sg*fw*.345,front+.107,fz+fh*.05),fw*.071,'ivory',head,4)
 # Breastplate / straps exist around the entire body, not a small flat sticker.
 def strap(name,A,C,width,mat,parent):
  A,C=Vector(A),Vector(C);u=(C-A).cross(Vector((0,1,0))).normalized()*width/2
  return b.panel(name,[tuple(A-u),tuple(A+u),tuple(C+u),tuple(C-u)],.032,mat,parent)
 if not spell:
  for rear in (False,True):
   sg=-1 if rear else 1;y=sg*.285
   for j in (-1,1):
    A=(j*.36,y,shz+.045)
    # Source FRONT has paired descending shoulder straps, not a giant X
    # across the breast/belly. The BACK alone has the crossed harness.
    C=(-j*.34,sg*.322,belt+.13) if rear else (j*.245,sg*.342,shz-.245)
    strap('Source crossed leather armor harness',A,C,.116,'leather',tor)
    for t in (.10,.77):
     p=Vector(A).lerp(Vector(C),t);b.box('Actual iron baldric mounting plate',tuple(p+Vector((0,sg*.027,0))),(.148,.043,.115),'steel',.013,tor)
     for dx in (-.042,.042):ell(b,'Baldric mounting rivet',(p.x+dx,p.y+sg*.053,p.z),(.014,.014,.014),'steel_light',tor,6,2)
   if rear:
    b.panel('Back iron pentagonal harness hub',[( -.11,sg*.353,shz-.10),(.11,sg*.353,shz-.10),(.085,sg*.360,shz-.23),(0,sg*.367,shz-.285),(-.085,sg*.360,shz-.23)],.035,'steel',tor,.012)
   elif soul:
    strap('Source horizontal front chest leather harness',(-.255,.350,shz-.185),(.255,.350,shz-.185),.094,'leather',tor)
    b.box('Source upper chest square buckle rim',(0,.379,shz-.185),(.115,.020,.090),'ivory',.007,tor)
    b.box('Source upper chest buckle dark inset',(0,.392,shz-.185),(.078,.008,.052),'leather',.001,tor)
  if soul:
   b.panel('Large source front skirt iron shield',[( -.135,.354,belt+.04),(.135,.354,belt+.04),(.135,.38,belt-.22),(0,.39,belt-.32),(-.135,.38,belt-.22)],.039,'steel',tor,.015)
   # Source small navel is dark inset rather than a peach human chest.
   b.box('Source visible small ogre navel',(0,.399,belt+.165),(.031,.006,.025),'dark',.001,tor)
 # Unique five obsidian blocks with actual hollow angular gold rune strokes.
 if spell:
  stones=[(-.37,.08,1.48),(.37,.08,1.48),(-.275,.29,1.31),(.275,.29,1.31),(0,.365,1.21),(-.29,-.245,1.47),(.29,-.245,1.47),(0,-.31,1.44)]
  for j,(x,y,z) in enumerate(stones):
   b.box('Source massive obsidian collar stone',(x,y,z),(.265,.19,.25),'cloth',.039,tor)
   if j<5:
    yy=y+.105;pts=[(x-.039,yy,z+.040),(x+.039,yy,z+.040),(x+.049,yy,z-.005),(x,yy,z-.055),(x-.049,yy,z-.005),(x-.039,yy,z+.040)]
    if j in (0,1):pts=[(x-.04,yy,z-.035),(x-.04,yy,z+.04),(x+.037,yy,z+.04),(x+.037,yy,z-.013),(x+.009,yy,z-.013)]
    for k in range(len(pts)-1):b.rod('Source inset golden rune stroke',pts[k],pts[k+1],.012,'gold',tor,4)
  b.box('Source ivory skull buckle',(0,.371,belt+.008),(.20,.047,.16),'ivory',.026,tor)
  for sg in (-1,1):b.box('Skull buckle dark square socket',(sg*.048,.397,belt+.013),(.045,.008,.052),'eyes',.001,tor)
  b.panel('Skull buckle pointed nose',[(0,.400,belt-.027),(.022,.400,belt-.061),(-.022,.400,belt-.061)],.009,'eyes',tor)
  for j in range(3):b.box('Skull buckle little lower tooth',((j-1)*.046,.374,belt-.099),(.034,.038,.046),'ivory',.004,tor)
 # Actual source weapons stay connected to the authored right hand pivot.
 wp=arms['R'][3];ha=Vector(arms['R'][6]);bottom=ha+Vector((.012,-.015,-.34));top=ha+Vector((.18,0,.55 if armored else .47 if spell else .62))
 b.limb('Actual solid grasped weapon shaft',[tuple(bottom),tuple(top)],[.044,.054],'wood',wp,8)
 if spell:
  c=top+Vector((0,0,.025));ell(b,'Source heavy faceted spiked mace ball',tuple(c),(.235,.229,.248),'steel_dark',wp,8,3)
  # Four belt spikes and top/bottom spikes, plus front/rear crowns.
  dirs=[Vector((math.cos(i*math.tau/6),math.sin(i*math.tau/6),0)) for i in range(6)]
  dirs += [Vector((0,0,1)),Vector((0,0,-1))]
  dirs += [Vector((math.cos(i*math.tau/4)*.7,math.sin(i*math.tau/4)*.7,sg*.7)).normalized() for i in range(4) for sg in (-1,1)]
  for d in dirs:cone(b,'Source mace solid iron spike',tuple(c+d*.21),tuple(c+d*.34),.057,'steel',wp,5)
 else:
  c=top+Vector((0,0,.045));size=(.43,.385,.435) if armored else (.35,.33,.47)
  b.box('Source massive solid iron hammer head',tuple(c),size,'steel',.037,wp)
  # Rivets on three visible surfaces preserve the iron square equipment.
  for xx in (-.15,.15):
   for zz in (-.15,.15):ell(b,'Hammer actual face iron rivet',(c.x+xx,c.y+size[1]/2+.009,c.z+zz),(.020,.015,.020),'steel_light',wp,6,2)
  for sg in (-1,1):
   b.box('Solid hammer metal binding',(c.x+sg*(size[0]/2-.029),c.y,c.z),(.040,size[1]+.016,size[2]+.016),'steel_light',.013,wp)
   if soul:
    for zz in (-.145,.145):cone(b,'Soul hammer short stud spike',(c.x+sg*size[0]/2,c.y+.02,c.z+zz),(c.x+sg*(size[0]/2+.055),c.y+.02,c.z+zz),.048,'steel_dark',wp,4)
  b.box('Solid iron weapon pommel',tuple(bottom),(.115,.105,.12),'steel',.015,wp)
 b.pivot('attack_muzzle',tuple(top),wp)
 # Soul Ogre carries two real tall enclosed cage frames with suspended gems.
 if soul:
  for sg in (-1,1):
   x=sg*.45;y=-.028;bottom=1.285;top=1.665
   b.box('Soul cage shoulder iron mounting',(x,y,1.235),(.21,.24,.115),'steel_dark',.02,tor)
   for zz in (bottom,top):
    b.loft('Soul cage octagonal bronze rim',[b.ring(x,y,zz-.027,.181,.181,8),b.ring(x,y,zz+.027,.181,.181,8)],'wood',tor)
    for k in range(8):
     a=k*math.tau/8;ell(b,'Soul cage rim visible metal rivet',(x+.188*math.sin(a),y+.188*math.cos(a),zz),(.018,.018,.019),'steel_light',tor,6,2)
   for dx,dy in ((-.125,-.125),(-.125,.125),(.125,-.125),(.125,.125)):
    b.box('Soul cage actual vertical bronze upright',(x+dx,y+dy,(bottom+top)/2),(.026,.026,top-bottom),'wood',.004,tor)
   b.jewel('Suspended actual turquoise soul crystal',(x,y,1.471),.108,.168,.09,'rune',tor)
   b.rod('Soul gem actual inner suspension',(x,y,1.60),(x,y,top-.023),.013,'steel_dark',tor,5)
   b.loft('Soul cage stepped closed bronze roof',[b.ring(x,y,1.692,.138,.138,8),b.ring(x,y,1.720,.138,.138,8),b.ring(x,y,1.750,.088,.088,8),b.ring(x,y,1.776,.088,.088,8)],'wood',tor)
   cone(b,'Soul cage closed roof top knob',(x,y,1.776),(x,y,1.821),.037,'wood',tor,6)
  rune=b.M['rune'].node_tree.nodes['Principled BSDF'];rune.inputs['Emission Color'].default_value=(.09,.62,.42,1);rune.inputs['Emission Strength'].default_value=.28
 return b
