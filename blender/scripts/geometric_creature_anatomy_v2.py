"""Source-guided equine, dragon and avian anatomy with actual fitted joints.

Native +Y front, +X right, Z up. Meshes are closed and articulated using the
existing two-link runtime pivots; curved shin geometry includes real hocks.
"""
import math
from mathutils import Vector

def cloth_grid(b,name,grid,mat,parent,offset):
 n=len(grid);rows=3;cols=n//rows;vs=list(grid)+[tuple(Vector(p)+Vector(offset)) for p in grid];fs=[]
 for rr in range(rows-1):
  for cc in range(cols-1):
   i=rr*cols+cc;fs.extend([(i,i+1,i+cols+1,i+cols),(i+n,i+cols+n,i+cols+1+n,i+1+n)])
 boundary=list(range(cols))+[rr*cols+cols-1 for rr in range(1,rows)]+list(range((rows-1)*cols+cols-2,(rows-1)*cols-1,-1))+[rr*cols for rr in range(rows-2,0,-1)]
 for j,i in enumerate(boundary):k=boundary[(j+1)%len(boundary)];fs.append((i,k,k+n,i+n))
 return b.mesh(name,vs,fs,mat,parent)

def feather_wings(b,origin,span,height,parent,material):
 """Curved broad flight feathers overlap around an actual elbow and wrist."""
 ox,oy,oz=origin
 for side in (-1,1):
  root=(ox+side*.18,oy,oz);pa=b.pivot('wing_'+('R' if side>0 else 'L'),root,parent)
  elbow=(ox+side*span*.43,oy-.03,oz+height*.26);wrist=(ox+side*span*.64,oy-.09,oz+height*.42)
  b.limb('Bird contacting shoulder elbow wrist wing',[root,elbow,wrist],[.13,.11,.085],material,pa,10)
  for j,(dx,dz) in enumerate([(1.00,.94),(1.12,.60),(1.11,.26),(.97,-.04),(.77,-.29)]):
   start=(ox+side*span*(.43+.035*j),oy-.045,oz+height*(.30-.065*j));end=(ox+side*span*dx,oy-.14-.016*j,oz+height*dz)
   a=Vector(start);c=Vector(end);p=a.lerp(c,.30)+Vector((0,.035,height*.045));q=a.lerp(c,.74)+Vector((0,.028,height*.033));width=span*(.16 if j<3 else .145)
   b.limb('Bird curved overlapping broad primary feather',[a,p,q,c],[(width*.46,.043),(width,.047),(width*.78,.031),(.010,.008)],material,pa,8)
  for j in range(4):
   a=Vector((ox+side*.21,oy+.065,oz-.02-j*.022));c=Vector((ox+side*span*(.51+j*.095),oy+.035,oz+height*(.45-j*.18)));mid=a.lerp(c,.58)+Vector((0,.02,.015))
   b.limb('Bird overlapping rounded wing covert',[a,mid,c],[(span*.095,.049),(span*.13,.057),(.015,.009)],material,pa,8)

def membrane_wings(b,root,z,span,height,mat,membrane,small=False):
 for side in (-1,1):
  shoulder=(side*.26,-.16,z);elbow=(side*span*.43,-.17,z+height*.42);wrist=(side*span*.60,-.23,z+height)
  pa=b.pivot('wing_'+('R' if side>0 else 'L'),shoulder,root)
  tips=[(side*span,-.30,z+height*.45),(side*span*.79,-.29,z-.20),(side*span*.51,-.24,z-.085),(side*.29,-.16,z-.20)]
  outline=[shoulder,elbow,wrist]+tips
  b.panel('Dragon closed stretched anatomical wing membrane',outline,.026,membrane,pa,.024)
  b.limb('Dragon segmented wing shoulder elbow wrist',[shoulder,elbow,wrist],[.075 if not small else .055,.056,.043],mat,pa,10)
  for j,tip in enumerate(tips):
   p=Vector(wrist).lerp(Vector(tip),.52)+Vector((0,.013,.008));b.limb('Dragon membrane articulated finger',[wrist,p,tip],[.035,.026,.009],mat,pa,8)
  b.limb('Dragon wing contacting forward thumb',[wrist,(wrist[0]+side*.035,wrist[1]+.016,wrist[2]+.095)],[.040,.006],'ivory',pa,8)

def quadruped_legs(b,root,ell,cone,coat,horse=False,small=False):
 z=.88 if horse else .58 if small else .68
 for front,ly in [(True,.34 if horse else .31),(False,-.43 if horse else -.36)]:
  for side in (-1,1):
   label=('F' if front else 'B')+('R' if side>0 else 'L')
   if horse:
    hip=(side*.245,ly,z-.07);knee=(side*.255,ly+(.025 if front else -.06),.46);hock=(side*.26,ly+(.010 if front else -.14),.255);ankle=(side*.26,ly+.045,.14)
    thighr=[(.115,.118),(.100,.094),(.084,.079)];shinr=[(.085,.080),(.072,.064),(.058,.061)]
   else:
    hip=(side*(.265 if small else .335),ly,z-.075);knee=(side*(.32 if small else .405),ly+(-.065 if front else -.13),.295 if front else .24);hock=(side*(.325 if small else .405),ly+(.035 if front else .05),.16);ankle=(side*(.315 if small else .385),ly+.11,.12)
    thighr=[(.145,.153),(.140,.135),(.102,.098)] if not small else [(.112,.13),(.109,.117),(.090,.085)];shinr=[(.102,.098),(.085,.078),(.072,.070)]
   up=b.pivot('upper_leg_'+label,hip,root);shin=b.pivot('shin_'+label,knee,up);foot=b.pivot('foot_'+label,ankle,shin)
   mid=Vector(hip).lerp(Vector(knee),.53)
   b.limb('Animal upper leg '+label,[hip,mid,knee],thighr,coat,up,12)
   b.limb('Animal shin '+label,[knee,hock,ankle],shinr,coat,shin,12)
   ell(b,'Animal contacting anatomical knee '+label,knee,(shinr[0][0]*1.09,shinr[0][1]*1.09,shinr[0][0]*1.09),coat,shin,12,4)
   ell(b,'Animal contacting articulated fetlock '+label,ankle,(shinr[-1][0]*1.13,shinr[-1][1]*1.15,.084),'ivory' if horse else coat,foot,12,4)
   fx,fy,fz=ankle
   if horse:
    b.loft('Animal grounded foot '+label,[b.ring(fx,fy+.023,.00,.089,.117,10),b.ring(fx,fy+.023,.028,.108,.132,10),b.ring(fx,fy+.018,.135,.082,.103,10)],'dark',foot)
    b.limb('Horse lower contacting pale sock '+label,[(fx,fy,.115),(fx,fy,.230)],[(.069,.070),(.076,.070)],'ivory',shin,10)
   else:
    rx=.13 if not small else .11;ry=.16 if not small else .145
    b.loft('Animal grounded foot '+label,[b.ring(fx,fy+.04,.00,rx*.86,ry*.92,12),b.ring(fx,fy+.05,.035,rx,ry,12),b.ring(fx,fy+.05,.125,rx*.96,ry*.92,12),b.ring(fx,fy+.025,.166,rx*.63,ry*.58,12)],coat,foot)
    for j in range(3):
     xx=fx+(j-1)*rx*.57;b.limb('Dragon contacting curved ivory toe claw',[(xx,fy+.151,.083),(xx,fy+.212,.063),(xx,fy+.24,.019)],[.035,.021,.006],'ivory',foot,8)

def horse(b,row,ell,cone,leaf,annulus,humanoid,lion):
 coat='steel_light' if b.id=='frostblade' else 'copper';root=b.pivot('mount_torso_pivot',(0,-.09,.88));poll=(0,.66,1.34);head=b.pivot('mount_head_pivot',poll,root)
 ell(b,'Horse rounded barrel and ribs',(0,-.09,.88),(.34,.615,.355),coat,root,16,7)
 ell(b,'Horse actual shoulder and chest',(0,.25,.91),(.31,.265,.34),coat,root,14,6)
 ell(b,'Horse rounded hindquarter musculature',(0,-.45,.88),(.32,.28,.335),coat,root,14,6)
 b.limb('Horse continuous swept muscular neck',[(0,.23,.94),(0,.32,1.11),(0,.43,1.35),poll],[(.235,.24),(.22,.22),(.175,.205),(.154,.19)],coat,root,14)
 skull=[poll,(0,.795,1.29),(0,.975,1.15),(0,1.072,1.064)]
 b.limb('Horse elongated anatomical skull and nasal bridge',skull,[(.157,.205),(.152,.202),(.129,.151),(.136,.102)],coat,head,14)
 jaw=b.pivot('mouth_pivot',(0,.96,1.07),head)
 ell(b,'Horse contacting rounded muzzle',(0,1.058,1.054),(.145,.113,.107),'ivory',jaw,14,5)
 b.pivot('attack_muzzle',(0,1.175,1.044),jaw)
 for side in (-1,1):
  ell(b,'Horse actual dark lateral eye',(side*.165,.783,1.316),(.020,.047,.040),'eyes',head,8,3)
  ell(b,'Horse fitted dark nostril',(side*.070,1.158,1.079),(.023,.011,.017),'dark',jaw,8,3)
  b.limb('Horse tapered attentive external ear',[(side*.10,.626,1.473),(side*.125,.607,1.602),(side*.135,.588,1.676)],[(.044,.059),(.035,.044),(.007,.010)],coat,head,8)
  b.limb('Horse dark inner ear',[(side*.105,.646,1.49),(side*.124,.622,1.607)],[(.024,.018),(.008,.009)],'leather',head,8)
 # Fitted mane follows the actual arched neck; the horse has no square jaw.
 b.limb('Horse contacting short faceted mane',[(0,.18,1.05),(0,.265,1.28),(0,.435,1.46),(0,.635,1.50)],[(.060,.050),(.057,.045),(.052,.044),(.040,.036)],'steel_dark' if b.id=='frostblade' else 'hair',root,10)
 quadruped_legs(b,root,ell,cone,coat,horse=True)
 b.limb('Horse curved continuous tail',[(0,-.625,1.01),(0,-.78,.87),(0,-.83,.48),(0,-.88,.13)],[(.088,.088),(.095,.093),(.074,.078),(.018,.024)],'steel_dark' if b.id=='frostblade' else 'hair',root,12)
 for side in (-1,1):
  grid=[(side*.255,.41,1.11),(side*.255,-.10,1.21),(side*.24,-.57,1.11),(side*.375,.44,.84),(side*.378,-.10,.84),(side*.355,-.58,.87),(side*.390,.32,.49),(side*.402,-.12,.405),(side*.373,-.52,.49)]
  cloth_grid(b,'Horse fitted curved three-section flank caparison',grid,'cloth',root,(-side*.025,0,0))
  for ia,ib in [(6,7),(7,8),(8,5),(3,6)]:b.rod('Horse source fitted caparison broad lower hem',grid[ia],grid[ib],.027,'gold' if b.id=='roseguard' else 'ivory',root,8)
  if b.id=='roseguard':lion(b,(side*.426,-.11,.655),.13,root,side=side)
  else:
   b.panel('Knight caparison visible side diamond',[(side*.430,-.115,.82),(side*.430,-.02,.66),(side*.430,-.115,.51),(side*.430,-.21,.66)],.025,'ivory',root,.014)
 chest=[(-.28,.56,1.02),(.28,.56,1.02),(.295,.56,.54),(0,.575,.44),(-.295,.56,.54)]
 b.panel('Horse fitted pointed chest caparison',chest,.028,'cloth',root,.019)
 for ia,ib in [(2,3),(3,4)]:b.rod('Horse contacting broad chest lower hem',chest[ia],chest[ib],.026,'gold' if b.id=='roseguard' else 'ivory',root,8)
 if b.id=='roseguard':lion(b,(0,.614,.71),.13,root)
 else:b.jewel('Horse frontal source ivory diamond',(0,.600,.72),.093,.158,.025,'ivory',root)
 if b.id=='frostblade':
  b.panel('Horse fitted faceted forehead chanfron',[(-.105,.776,1.36),(0,.718,1.459),(.105,.776,1.36),(.087,1.062,1.146),(0,1.133,1.10),(-.087,1.062,1.146)],.025,'steel',head,.019)
 for side in (-1,1):b.limb('Horse fitted cheek bridle leather',[(side*.159,.622,1.459),(side*.162,.813,1.30),(side*.154,1.068,1.06)],[.018]*3,'leather',head,8)
 b.limb('Horse contacting fitted noseband',[(-.15,1.076,1.065),(0,1.175,1.064),(.15,1.076,1.065)],[.019]*3,'leather',head,8)
 rider(b,row,root,1.29,ell,annulus,humanoid,horse_mount=True)
 return root

def rider(b,row,root,seat,ell,annulus,humanoid,horse_mount=False):
 s=row['spec'];ident=b.id;scale=.85 if horse_mount else .83
 # Actual seat top, hips above the back, thighs spread beyond the rib barrel
 # and shins hanging along its flanks rather than inside the mount.
 b.limb('Rider anatomical fitted saddle seat',[(0,.01,seat-.085),(0,-.18,seat-.085)],[(.23,.08),(.22,.077)],'leather',root,12)
 for yy in (.125,-.285):b.limb('Saddle raised fitted contacting pommel cantle',[(-.23,yy,seat-.046),(0,yy,seat+.035),(.23,yy,seat-.046)],[.041]*3,'leather',root,10)
 spec={**s,'bodyKind':'humanoid','mounted':False,'wingStyle':None,'wings':False,'cloak':'short' if s.get('cloak') else False,'helmet':ident in ('frostblade','thunderheart'),'hood':False,'hat':'cone' if ident=='phoenix' else None,'crown':False}
 if ident=='roseguard':spec['armorPlates']=True
 before=set(b.objects);ctx=humanoid(b,{**row,'spec':spec},True,(0,-.09,seat-.04*scale),scale,True,{'seatHipX':.19,'seatKneeX':.48 if horse_mount else .57,'seatKneeY':.095,'seatKneeZ':-.20,'seatAnkleX':.50 if horse_mount else .59,'seatAnkleY':.04,'seatAnkleZ':-.43})
 b.attach(ctx['torso'],root)
 for leg in ctx['legs'].values():b.attach(leg,root)
 ell(b,'Rider visible pelvis seated on saddle',(0,-.09,seat+.041),(.21,.19,.101),'leather',ctx['torso'],12,4)
 for ob in set(b.objects)-before:
  if ident in ('phoenix','thunderheart'):
   for j,mt in enumerate(ob.data.materials):
    if mt in (b.M['cloth'],b.M['cloth_light']):ob.data.materials[j]=b.M['riderpurple']
    elif ident=='thunderheart' and mt in (b.M['steel'],b.M['steel_dark'],b.M['steel_light']):ob.data.materials[j]=b.M['riderarmor']
 for side in (-1,1):
  ankle=ctx['P']((side*(.50 if horse_mount else .59),.04,-.43));st=(ankle[0],ankle[1]+.11,ankle[2]-.045)
  annulus(b,'Rider fitted actual hanging stirrup',st,.061,.014,'steel',root,True,10,4)
  b.limb('Stirrup leather contacting suspension strap',[(side*.235,-.11,seat-.03),(st[0],st[1]-.02,st[2]+.047)],[.021]*2,'leather',root,8)
 if horse_mount:
  for side in (-1,1):b.limb('Rider connected actual leather reins',[ctx['hands']['L'],(side*.155,1.064,1.08)],[.010]*2,'leather',ctx['weapons']['L'],6)
 if ident=='roseguard':
  pts=[ctx['P']((-.27,-.24,.62)),ctx['P']((.27,-.24,.62)),(.37,-.49,1.18),(.34,-.73,1.055),(0,-.755,1.01),(-.34,-.73,1.055),(-.37,-.49,1.18)]
  b.panel('Lionheart rider fitted maroon cape over saddle',pts,.035,'cloth',ctx['torso'],.026)
  for j in range(len(pts)):b.rod('Lionheart rider cape actual wide gold hem',pts[j],pts[(j+1)%len(pts)],.024,'gold',ctx['torso'],8)
 return ctx

def dragon(b,row,ell,cone,leaf,annulus,humanoid):
 ident=b.id;s=row['spec'];baby=ident=='embercrown';mounted=bool(s.get('mounted'));z=.58 if baby else .68;coat='cloth';root=b.pivot('mount_torso_pivot' if mounted else 'torso_pivot',(0,-.12,z))
 ell(b,'Dragon sculpted continuous rounded rib barrel',(0,-.12,z),(.34,.44,.31) if baby else (.43,.59,.385),coat,root,14,6)
 ell(b,'Dragon anatomical chest and shoulders',(0,.20,z+.10),(.31,.28,.29) if baby else (.355,.35,.32),coat,root,12,5)
 hz=1.00 if baby else 1.34 if ident=='worldfire' else 1.12;hy=.53 if baby else .66
 head=b.pivot('mount_head_pivot' if mounted else 'head_pivot',(0,hy,hz),root)
 neck=[(0,.22,z+.13),(0,.34,z+.31),(0,hy-.12,hz-.08),(0,hy,hz)]
 b.limb('Dragon connected swept curved muscular neck',neck,[(.215,.22),(.195,.19),(.181,.19),(.17,.16)],coat,root,12)
 ell(b,'Dragon sculpted faceted cranial volume',(0,hy-.018,hz+.016),(.27,.253,.235) if baby else (.285,.263,.225),coat,head,12,5)
 b.limb('Dragon tapered multi-section snout',[(0,hy+.09,hz-.016),(0,hy+.29,hz-.070),(0,hy+.412,hz-.096)],[(.22,.16),(.207,.128),(.169,.108)],coat,head,12)
 jaw=b.pivot('mouth_pivot',(0,hy+.15,hz-.16),head)
 b.limb('Dragon contacting lower articulated jaw',[(0,hy+.07,hz-.188),(0,hy+.29,hz-.19),(0,hy+.385,hz-.172)],[(.172,.085),(.169,.075),(.139,.057)],coat,jaw,12)
 b.pivot('attack_muzzle',(0,hy+.439,hz-.130),jaw)
 for side in (-1,1):
  b.box('Dragon actual fitted small lateral eye',(side*.175,hy+.177,hz+.063),(.058,.017,.066),'eyes',.007,head)
  ell(b,'Dragon actual fitted muzzle nostril',(side*.072,hy+.418,hz-.064),(.024,.009,.018),'dark',head,8,3)
  b.limb('Dragon curved tapered swept horn',[(side*.18,hy-.067,hz+.179),(side*.25,hy-.142,hz+.302),(side*.266,hy-.22,hz+.408)],[(.083,.075),(.054,.048),(.008,.006)],'wood' if baby else 'gold',head,10)
  for j in range(2):b.limb('Dragon contacting visible small jaw fang',[(side*(.09+j*.054),hy+.30-j*.066,hz-.144),(side*(.09+j*.054),hy+.306-j*.066,hz-.21)], [.020,.005],'ivory',jaw,6)
 if s.get('horns',0)>2:b.limb('Mage dragon third source crown horn',[(0,hy-.17,hz+.16),(0,hy-.23,hz+.31),(0,hy-.28,hz+.37)],[(.073,.071),(.044,.038),(.007,.006)],'gold',head,10)
 quadruped_legs(b,root,ell,cone,coat,small=baby)
 # Broad ivory belly and throat remain a continuous fitted surface, not ribs
 # hovering in front of the animal or an unrelated triangular front panel.
 # The material-bearing patch overlaps the actual outside of the rounded
 # chest. A previous center behind the barrel hid it in front views.
 ell(b,'Dragon fitted continuous broad ivory belly',(0,.404 if baby else .474,z+.015),(.245,.086,.280) if baby else (.283,.096,.325),'ivory',root,12,5)
 neckr=[(.215,.22),(.195,.19),(.181,.19),(.17,.16)];throat=[]
 for j,p in enumerate(neck):
  d=(Vector(neck[min(j+1,len(neck)-1)])-Vector(neck[max(j-1,0)])).normalized();front=Vector((0,d.z,-d.y)).normalized()
  throat.append(Vector(p)+front*(neckr[j][1]-.014))
 b.limb('Dragon contacting continuous segmented ivory throat',throat,[(.194,.037),(.178,.037),(.162,.035),(.148,.033)],'ivory',root,12)
 tail=[(0,-.48,z+.025),(0,-.575,z+.010),(.004,-.67,z+.033),(.014,-.752,z+.078),(.028,-.817,z+.151),(.044,-.864,z+.25),(.061,-.891,z+.37),(.077,-.901,z+.50),(.09,-.895,z+.63),(.098,-.879,z+.755),(.102,-.855,z+.86)] if baby else [(0,-.61,z+.04),(0,-.90,z-.04),(.16,-1.17,z+.01),(.34,-1.33,z+.18)]
 tailr=[(.14*(1-j/(len(tail)-1))+.025*j/(len(tail)-1),.13*(1-j/(len(tail)-1))+.024*j/(len(tail)-1)) for j in range(len(tail))] if baby else [(.14,.13),(.105,.10),(.073,.072),(.043,.040)]
 b.limb('Dragon smoothly segmented continuous swept tail',tail,tailr,coat,root,12)
 if baby:
  p=Vector(tail[-1]);b.limb('Baby dragon fitted curved main tail flame',[p-Vector((0,0,.035)),p+Vector((0,.004,.055)),p+Vector((.014,.002,.16)),p+Vector((.047,-.015,.27))],[(.080,.072),(.127,.100),(.075,.065),(.005,.006)],'orange',root,10)
  b.limb('Baby dragon overlapping curved gold inner flame',[p+Vector((0,.055,.015)),p+Vector((0,.074,.08)),p+Vector((-.014,.075,.16))],[(.055,.030),(.059,.031),(.006,.006)],'gold',root,8)
  for side in (-1,1):b.limb('Baby dragon contacting outward curved flame lick',[p+Vector((side*.047,0,.014)),p+Vector((side*.116,-.008,.06)),p+Vector((side*.10,-.015,.156))],[(.052,.04),(.041,.029),(.006,.006)],'orange',root,8)
 elif ident=='phoenix':
  b.limb('Mage dragon genuine second forked tail',[tail[-2],(-.17,-1.20,z+.14),(-.36,-1.33,z+.26)],[(.075,.073),(.053,.05),(.009,.008)],coat,root,10)
 elif ident=='thunderheart':
  p=Vector(tail[-1]);b.panel('Dragon actual golden lightning tail', [tuple(p+Vector(q)) for q in [(-.08,0,-.04),(.035,0,.18),(.03,0,.035),(.20,0,.115),(.045,0,-.13),(.07,0,.025)]],.050,'gold',root,.021)
 # Attach each dorsal fin to an actual centerline surface. As the tail
 # descends, its fin bases descend with it rather than hovering at back Z.
 for j in range(s.get('backSpikes',0)):
  path=[(0,-.29,z+.345),(0,-.49,z+.260),(0,-.69,z+.151),(.04,-.91,z+.085),(.16,-1.13,z+.10)]
  base=Vector(path[min(j,len(path)-1)]);b.limb('Dragon contacting swept dorsal fin',[base,base+Vector((0,-.08,.17)),base+Vector((0,-.14,.215))],[(.080,.061),(.046,.035),(.006,.008)],'gold',root,8)
 membrane_wings(b,root,z+.23,.72 if baby else 1.07,.34 if baby else .86 if ident=='worldfire' else .59,coat,'orange' if baby else 'ivory',baby)
 if mounted:rider(b,row,root,z+.405,ell,annulus,humanoid)
 return root

def bird(b,row,ell,cone,leaf):
 root=b.pivot('torso_pivot',(0,-.025,1.02));head=b.pivot('head_pivot',(0,.135,1.40),root)
 ell(b,'Thunderbird actual rounded breast and abdomen',(0,-.025,1.06),(.268,.228,.33),'cloth',root,14,6)
 b.limb('Thunderbird contacting curved feathered neck',[(0,.01,1.23),(0,.095,1.32),(0,.135,1.40)],[(.19,.165),(.17,.153),(.16,.14)],'cloth',root,12)
 ell(b,'Thunderbird faceted rounded eagle cranium',(0,.135,1.40),(.242,.211,.229),'cloth',head,12,5)
 for side in (-1,1):
  b.box('Thunderbird fitted dark avian eye',(side*.142,.303,1.439),(.059,.014,.067),'eyes',.007,head)
  b.limb('Thunderbird swept contacting head crest',[(side*.06,.11,1.56),(side*.11,-.006,1.69),(side*.13,-.035,1.742)],[(.081,.070),(.057,.043),(.009,.007)],'cloth_light',head,8)
 jaw=b.pivot('mouth_pivot',(0,.294,1.342),head)
 b.limb('Thunderbird actual curved hooked upper beak',[(0,.287,1.385),(0,.402,1.371),(0,.447,1.307)],[(.102,.076),(.084,.061),(.007,.009)],'gold',head,10)
 b.limb('Thunderbird contacting lower beak',[(0,.296,1.322),(0,.404,1.312)],[(.072,.034),(.018,.012)],'gold',jaw,8)
 b.pivot('attack_muzzle',(0,.453,1.33),jaw)
 for j in range(5):
  a=(j-2)*.055;leaf(b,'Thunderbird layered fitted ivory neck feather',(a,.21,1.245),(a*1.85,.222,1.005-abs(j-2)*.014),.062,'ivory',head)
 feather_wings(b,(0,-.10,1.145),.93,.65,root,'cloth')
 for j in (-1,0,1):
  start=(j*.065,-.135,.941);end=(j*.225,-.375,.603 if j else .515);mid=tuple(Vector(start).lerp(Vector(end),.60)+Vector((0,-.025,.025)))
  b.limb('Thunderbird overlapping broad lightning tail feather',[start,mid,end],[(.075,.035),(.109,.040),(.010,.007)],'cloth_light',root,8)
 for side in (-1,1):
  name='R' if side>0 else 'L';hip=(side*.13,.003,.878);knee=(side*.144,.002,.73);ankle=(side*.151,.17,.787)
  up=b.pivot('upper_leg_'+name,hip,root);shin=b.pivot('shin_'+name,knee,up);foot=b.pivot('foot_'+name,ankle,shin)
  b.limb('Bird curved feather-covered thigh',[hip,(side*.15,-.034,.78),knee],[.081,.074,.055],'cloth',up,10)
  b.limb('Bird actual reverse bent hock and scaled shin',[knee,(side*.155,.082,.755),ankle],[.042,.036,.031],'leather',shin,10)
  ell(b,'Bird contacting crouched talon ankle',ankle,(.044,.042,.043),'leather',foot,10,3)
  for j in (-1,0,1):
   x=ankle[0]+j*.042;pts=[(x,.164,.784),(x+j*.012,.232,.744),(x+j*.015,.243,.683),(x+j*.014,.20,.671)]
   b.limb('Bird actual curling three forward talons',pts,[.024,.022,.018,.006],'leather',foot,8)
   b.limb('Bird contacting forward talon ivory claw',[pts[-2],pts[-1]],[.017,.004],'ivory',foot,8)
  b.limb('Bird actual curled rear talon',[(ankle[0],.16,.786),(ankle[0],.080,.735),(ankle[0],.079,.687),(ankle[0],.115,.683)],[.023,.021,.017,.004],'leather',foot,8)
 b.root['locomotion']='flying'
 return root

def build_refined_creature(b,row,ell,cone,leaf,annulus,humanoid,lion):
 if row['spec']['bodyKind']=='horse':return horse(b,row,ell,cone,leaf,annulus,humanoid,lion)
 if row['spec']['bodyKind']=='bird':return bird(b,row,ell,cone,leaf)
 return dragon(b,row,ell,cone,leaf,annulus,humanoid)
