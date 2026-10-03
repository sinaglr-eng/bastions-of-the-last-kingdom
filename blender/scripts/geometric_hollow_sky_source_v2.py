"""Source 40: upright, hollow, two-legged skeletal sky king."""
import math

def hollow_sky_king(b,row,ell,cone,wings,leaf):
 torso=b.pivot('torso_pivot',(0,0,.98))
 head=b.pivot('head_pivot',(0,.32,1.64),torso)
 # A vertical open oval cage, with the captive small green face and focus
 # inside it; no opaque animal barrel is placed behind the visible ribs.
 b.limb('Sky king exposed ivory spine',[(0,-.28,.64),(0,-.25,1.02),(0,-.21,1.44)],[.09,.09,.075],'ivory',torso,6)
 for side in (-1,1):
  for j in range(7):
   z=1.42-j*.112;rr=.25+.14*math.sin((j+.2)/7*math.pi)
   pts=[(side*.055,-.25,z),(side*rr,-.16,z-.015),(side*(rr+.015),.15,z-.045),(side*.19,.31,z-.065)]
   b.limb('Sky king seven open ivory ribs per side',pts,[.046,.044,.042,.038],'ivory',torso,5)
 b.jewel('Sky king central large green soul heart',(0,.20,.98),.125,.225,.095,'rune',torso)['visualCue']='soul'
 pilot=b.pivot('captive_soul_pivot',(0,.16,1.25),torso)
 b.box('Sky king captive dark cowl',(0,.15,1.265),(.29,.22,.25),'steel_dark',.025,pilot)
 b.box('Sky king small green captive face',(0,.283,1.245),(.20,.026,.135),'skin',.015,pilot)
 for side in (-1,1):b.box('Captive square eye',(side*.048,.304,1.255),(.035,.012,.044),'dark',.001,pilot)
 # Vertebrae bend forward into a genuinely separate long skull and jaw.
 neck=[(0,-.20,1.42),(0,-.14,1.63),(0,.03,1.78),(0,.29,1.71)]
 b.limb('Sky king curved exposed cervical bones',neck,[.11,.105,.085,.08],'ivory',torso,6)
 for j in range(3):ell(b,'Sky king collar vertebra',(0,neck[j][1],neck[j][2]),(.125,.12,.10),'steel_dark',torso,6,2)
 b.loft('Sky king faceted long ivory skull',[
  [(-w,yy,zz-.105),(w,yy,zz-.105),(w,yy,zz+.09),(w*.65,yy,zz+.18),(-w*.65,yy,zz+.18),(-w,yy,zz+.09)]
  for yy,w,zz in [(.19,.25,1.69),(.48,.23,1.64),(.70,.15,1.54)]
 ],'ivory',head)
 for side in (-1,1):
  b.box('Sky king skull deep rectangular eye socket',(side*.105,.722,1.648),(.080,.027,.102),'dark',.006,head)
  for j in range(3):
   x=side*(.16+j*.055)
   b.limb('Sky king six actual curved ivory crown horns',[(x,.23-j*.085,1.84),(x+side*.07,.19-j*.085,1.98),(x+side*.06,.13-j*.085,2.13-j*.055)],[.054,.044,.009],'ivory',head,5)
 jaw=b.pivot('mouth_pivot',(0,.43,1.51),head)
 b.panel('Sky king actual visible front triangular skull nose',[(-.040,.733,1.581),(.040,.733,1.581),(0,.733,1.526)],.014,'dark',head)
 b.box('Sky king hollow open lower jaw',(0,.52,1.445),(.34,.31,.08),'ivory',.022,jaw)
 b.box('Sky king dark open mouth cavity',(0,.57,1.535),(.31,.20,.15),'dark',.015,jaw)
 for j in range(6):
  x=(j-2.5)*.056
  cone(b,'Sky king upper hanging ivory tooth',(x,.735,1.595),(x,.741,1.485),.025,'ivory',head,4)
  cone(b,'Sky king lower ivory tooth',(x,.733,1.478),(x,.738,1.545),.022,'ivory',jaw,4)
 b.pivot('attack_muzzle',(0,.75,1.53),jaw)
 # Two bent hind legs. Wings are the only forelimbs.
 for side in (-1,1):
  tag='R' if side>0 else 'L';hip=(side*.28,-.06,.71);knee=(side*.43,.015,.44);ankle=(side*.33,.16,.13)
  thigh=b.pivot('upper_leg_'+tag,hip);shin=b.pivot('shin_'+tag,knee,thigh);foot=b.pivot('foot_'+tag,ankle,shin)
  b.limb('Sky king bent ivory thigh '+tag,[hip,knee],[.13,.12],'ivory',thigh,6)
  ell(b,'Sky king thigh black armored plate',(side*.33,.045,.61),(.19,.15,.15),'steel_dark',thigh,6,2)
  b.limb('Sky king articulated hind shin '+tag,[knee,ankle],[.085,.075],'ivory',shin,6)
  b.box('Animal grounded foot '+tag,(side*.33,.20,.105),(.27,.27,.21),'steel_dark',.032,foot)
  for j in range(3):cone(b,'Sky king large ivory toe claw',(side*.33+(j-1)*.072,.28,.10),(side*.33+(j-1)*.09,.45,.025),.040,'ivory',foot,5)
 # Broad overlapping dark scales follow the back, leaving the front hollow.
 for j in range(7):
  z=.72+j*.115;rr=.30+.09*math.sin(j/7*math.pi)
  b.panel('Sky king overlapping dorsal armor',[(-rr,-.31,z+.095),(0,-.39,z+.18),(rr,-.31,z+.095),(rr*.82,-.35,z-.045),(0,-.43,z-.12),(-rr*.82,-.35,z-.045)],.065,'steel_dark',torso,.040)
  cone(b,'Sky king dorsal ivory armor spike',(0,-.40,z+.08),(0,-.52,z+.18),.055,'ivory',torso,5)
 for side in (-1,1):
  b.panel('Sky king broad dark shoulder mantle',[(side*.18,-.11,1.50),(side*.46,-.12,1.55),(side*.55,.12,1.34),(side*.34,.17,1.25)],.07,'steel_dark',torso,.03)
 wings(b,'bat',(0,-.15,1.25),span=1.23,height=.86,parent=torso,material='cloth',ragged=True)
 # Armored segmented tail sweeps sideways and curls up, clear of both feet.
 pts=[(0,-.34,.71),(-.21,-.53,.50),(-.47,-.68,.35),(-.72,-.63,.36),(-.91,-.54,.51),(-.98,-.48,.76)]
 b.limb('Sky king segmented ivory tail',pts,[.13,.12,.10,.082,.06,.025],'ivory',torso,6)
 for p in pts[:-1]:ell(b,'Sky king dark tail vertebra armor',p,(.15,.16,.12),'steel_dark',torso,6,2)
 cone(b,'Sky king broad pointed armored tail',pts[-1],(-1.03,-.45,1.00),.12,'steel_dark',torso,5)
 b.root['locomotion']='flying';b.root['attackStyle']='breath'
 return b
