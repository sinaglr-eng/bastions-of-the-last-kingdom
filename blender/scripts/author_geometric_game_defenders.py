"""48 measured/reference-driven defender revisions, hierarchical game GLB.

The six approved source views are packed into each native file. Source FRONT
face dimensions set visible head proportions; rear and profiles determine hood
closure, capes and equipment depth. Hidden depths are estimated, not CAD kotes.
"""
import argparse,json,sys,math,hashlib,re
from pathlib import Path
from types import SimpleNamespace
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(Path(__file__).parent))
from geometric_game_common import Builder,metrics,export_and_check,render_views,head_coverage,geometry_digest
from geometric_defender_fit_v2 import fitted_boot,fitted_neck,sculpt_facets,bow_forward_plane,bounds,remove,contact,storm_hair_and_focus,soldier_fit,fitted_arm_joints,rest_contact_checks
from geometric_defender_fit_v3 import center_full_head_on_torso,storm_natural_hair_and_focus,engineer_source_nape_hair
FAMILIES=['soldier','archer','mage','frostwarden','stormcaller','cleric','druid','runebreaker']
OUT=ROOT/'output/design/geometric-game-v1/defenders';SCENES=ROOT/'blender/scenes/geometric-game-v1/defenders';EXPORTS=ROOT/'public/assets/geometric/defenders'
for p in (OUT,SCENES,EXPORTS):p.mkdir(parents=True,exist_ok=True)
SOURCES=json.loads((ROOT/'output/design/geometric-turnarounds-v1/manifest.json').read_text(encoding='utf-8'))
MEAS=json.loads((OUT/'reference-measurements.json').read_text(encoding='utf-8'))
MEAS={(v['family'],v['rank']):v for v in MEAS}
EQUIPMENT=json.loads((Path(__file__).parent/'defender_turnarounds_v3/equipment.json').read_text())
COLORS=['355D92','3C6938','843F6B','EDE0C6','D49638','F9E3BA']
# Manual face rectangles correct bright cloth joined into chroma masks. Integer
# edges are observed source pixels, not an assertion of subpixel accuracy.
FACES={
 'archer':[[222,102,341,173],[190,122,318,188],[274,125,375,193],[220,125,317,191],[213,133,302,192],[218,134,314,198]],
 'mage':[[209,168,329,228],[263,170,383,228],[225,170,339,226],[216,170,326,227],[226,174,331,234],[199,199,301,258]],
 'frostwarden':[[216,162,314,225],[212,167,315,230],[218,171,315,230],[214,164,311,231],[215,149,313,214],[221,175,311,232]],
 'stormcaller':[[190,135,315,222],[191,148,310,210],[198,147,325,212],[207,150,326,213],[209,145,332,210],[209,148,322,211]],
 'cleric':[[204,140,301,199],[293,147,390,205],[238,159,336,218],[232,160,346,217],[234,157,344,211],[236,165,329,217]],
 'druid':[[222,126,336,205],[212,144,312,213],[196,157,298,228],[224,155,320,219],[233,158,333,228],[228,157,328,227]],
 'runebreaker':[[169,138,304,198],[183,125,329,191],[204,138,337,199],[185,143,322,205],[187,135,332,199],[183,145,333,204]]}
TOPS={'archer':[52,61,67,64,76,55],'mage':[49,42,42,45,35,40],'frostwarden':[86,88,89,91,79,94],'stormcaller':[59,64,66,59,59,51],'cleric':[65,37,36,34,32,39],'druid':[61,73,89,85,86,85],'runebreaker':[76,63,67,66,65,58]}
SOLES={'archer':[403,415,417,421,418,421],'mage':[431,438,432,431,431,436],'frostwarden':[426,433,432,427,424,423],'stormcaller':[420,415,415,420,417,422],'cleric':[413,415,424,427,431,430],'druid':[421,416,424,421,424,421],'runebreaker':[422,416,426,436,426,415]}
# Manually read from actual source FRONT coordinates; measured separately
# from face calibration because the untitled Archer I sheet uses a taller crop.
BOW_SOURCE={'top':[77,80,77,17,53,44],'bottom':[375,379,390,399,405,414],
 'headTop':[15,42,49,53,61,55],'sole':[392,412,413,405,416,421]}
CLERIC_HEM_SOURCE={'hem':[370,374,385,394,404,397],
 'headTop':[65,37,36,34,32,39],'sole':[413,415,424,427,431,430]}
# Profile drawings show a narrow frontal cheek, hence are oblique. Infer
# depth after subtracting projected frontal width, rather than treating the
# entire silhouette's width as native depth. Readings are raster estimates.
HOOD_DEPTH_RATIOS={'archer':[.73,.725,.68,.69,.72,.65],
 'frostwarden':[.68,.67,.73,.74,.64,.70],'druid':[.67,.68,.70,.71,.69,.68],
 'cleric':[.71]}

def palette(f,r):
 return {'cloth':COLORS[r-1],'clothLight':''.join(f'{min(255,round(int(COLORS[r-1][i:i+2],16)*1.06)):02x}' for i in (0,2,4)),
 'skin':'EFC291','eyes':'282522','wood':'795536','leather':'694B35','leatherLight':'84613F','steel':'989BA2','steelLight':'BDC0C5','steelDark':'6D7179','gold':'D8AC52','goldLight':'F4CA67','goldDark':'B68431','ivory':'F1E4C9','ice':'79C8E6','iceLight':'C1EBEE','leaf':'829259','violet':'8743CB','hair':'98999D','hairLight':'BCBDC2','hairDark':'75767C','beard':'BF6C33','recess':'2F2B26','circletGreen':'3C6938','copper':'B97B4F'}

def plan(b,f,r):
 bb=FACES[f][r-1];top=TOPS[f][r-1];sole=SOLES[f][r-1];S=1.8/(sole-top);cx=(bb[0]+bb[2])/2
 b.cfg={'faceBBox':bb,'bodyTop':top,'sole':sole,'centerX':cx,'pixelsPerMeter':1/S,'observedFaceWidthM':(bb[2]-bb[0])*S,'observedFaceHeightM':(bb[3]-bb[1])*S}
 b.S=S;b.cx=cx;b.sole=sole;b.pt=lambda u,v,y=.0:((cx-u)*S,y,(sole-v)*S)
 return bb,S,cx,sole

def rig(b,headz,shoulderz,waistz,handcoords):
 b.torso=b.pivot('torso_pivot',(0,0,waistz));b.head=b.pivot('head_pivot',(0,0,headz),b.torso);b.joints={}
 for side,sg in [('R',1),('L',-1)]:
  shoulder=(sg*b.bodyw*.59,0,shoulderz);hand=handcoords[side];elbow=tuple(Vector(shoulder).lerp(Vector(hand),.55));elbow=(elbow[0],.02,elbow[2]-.05)
  up=b.pivot('upper_arm_'+side,shoulder,b.torso);lo=b.pivot('forearm_'+side,elbow,up);wrist=b.pivot('hand_'+side,hand,lo);wp=b.pivot('weapon_'+side,hand,wrist)
  b.joints[side]=(up,lo,wrist,wp,shoulder,elbow,hand)
  hip=(sg*b.bodyw*.24,0,waistz-.06);knee=(sg*b.bodyw*.28,0,.26);ankle=(sg*b.bodyw*.31,.0,.10)
  leg=b.pivot('upper_leg_'+side,hip);shin=b.pivot('shin_'+side,knee,leg);foot=b.pivot('foot_'+side,ankle,shin)
  b.joints['leg_'+side]=(leg,shin,foot,hip,knee,ankle)

def body(b,f,r):
 bb,S,cx,sole=plan(b,f,r);fw=(bb[2]-bb[0])*S;fh=(bb[3]-bb[1])*S;facecenter=(0,.16,(sole-(bb[1]+bb[3])/2)*S)
 b.facez=facecenter[2];b.facew=fw;b.faceh=fh;b.headFront=.16+fw*.68/2;b.bodyw=fw*1.10
 robe=f in ('mage','cleric');torso_top=(sole-(bb[3]+15))*S;waist=(sole-(bb[3]+94))*S;hem=max(.20,(sole-(bb[3]+(165 if robe else 146)))*S)
 if robe:hem=.09
 if f=='cleric':
  measured={k:v[r-1] for k,v in CLERIC_HEM_SOURCE.items()};hem=(measured['sole']-measured['hem'])*1.8/(measured['sole']-measured['headTop']);b.cfg['robeHemSourcePx']=measured;b.cfg['robeHemMeters']=hem
 if f=='runebreaker' and r>=4:hem=.21
 shoulderz=torso_top-.025
 handz=(sole-(bb[3]+(75 if f=='stormcaller' else 85)))*S
 rightx=b.bodyw*.77;leftx=-b.bodyw*.78
 if f=='archer':handcoords={'R':(rightx,.05,handz-.10),'L':(leftx,.21,handz+.12)}
 elif f=='stormcaller':handcoords={'R':(rightx,.18,handz+.07),'L':(leftx,.10,handz-.06)}
 elif f in ('mage','cleric') and r>=4:handcoords={'R':(rightx,.20,handz+.01),'L':(leftx,.22,handz-.025)}
 else:handcoords={'R':(rightx,.20,handz+.01),'L':(leftx,.06,handz-.12)}
 rig(b,facecenter[2],shoulderz,waist,handcoords)
 b.loft('Continuous tunic bodice',[b.chamfer(0,0,waist,b.bodyw*.91,.30,.028),b.chamfer(0,0,torso_top,b.bodyw,.32,.035)],['cloth','clothLight'],b.torso)
 b.loft('Flared robe' if robe else 'Flared split tunic',[b.chamfer(0,-.014,hem,b.bodyw*(1.40 if robe else 1.16),.37,.035),b.chamfer(0,0,waist+.009,b.bodyw*.90,.30,.025)],['cloth','clothLight'],b.torso)
 b.box('Waist belt',(0,.001,waist+.018),(b.bodyw*.94,.325,.052),'leather',.013,b.torso)
 if r>=3 or f=='stormcaller':
  b.box('Buckle rim',(0,.185,waist+.02),(.105,.035,.088),'gold' if f=='stormcaller' and r>=2 else 'steel',.010,b.torso);b.box('Buckle recess',(0,.207,waist+.02),(.062,.011,.047),'recess',.003,b.torso)
 for side in ('R','L'):
  up,lo,wrist,wp,sh,el,ha=b.joints[side];thick=b.bodyw*.195
  b.limb('Upper sleeve '+side,[sh,el],[thick,thick*.96],['cloth','clothLight'],up)
  b.limb('Forearm sleeve '+side,[el,ha],[thick*.96,thick*.88],'cloth',lo)
  b.box('Hand '+side,ha,(thick*1.60,thick*1.60,thick*1.65),'skin',thick*.18,wrist)
  leg,shin,foot,hip,knee,ank=b.joints['leg_'+side];sg=1 if side=='R' else -1
  b.limb('Trouser upper '+side,[hip,knee],[b.bodyw*.19,b.bodyw*.18],'leather' if r>=4 else 'cloth',leg)
  b.limb('Trouser shin '+side,[knee,ank],[b.bodyw*.18,b.bodyw*.17],'leather',shin)
  bx=sg*b.bodyw*.30;w=b.bodyw*.34
  boottop=.22 if f=='runebreaker' else .28
  fitted_boot(b,side,ank,knee,foot,shin,w,boottop)
 # Keep visible face entirely inside cover aperture; hidden scalp is omitted.
 if f in ('archer','druid','frostwarden') or (f=='cleric' and r==1):
  hoodtop=1.8;hoodbottom=(sole-(bb[3]+17))*S;height=hoodtop-hoodbottom;hoodwidth=fw*1.48
  front=.015+fw*.83/2;depth=hoodwidth*HOOD_DEPTH_RATIOS[f][r-1]
  hoodcenter=(0,front-depth/2,(hoodtop+hoodbottom)/2)
  b.cfg['hoodDepthWidthRatio']=HOOD_DEPTH_RATIOS[f][r-1];b.cfg['hoodDepthMethod']='Raster profile width corrected for oblique camera by visible cheek; posterior volume only, front aperture fixed';b.cfg['hoodDepthMeters']=depth
  upper=facecenter[2]+fh/2;lower=facecenter[2]-fh/2;peak=.015 if f=='archer' and r<3 else (.075 if f=='archer' else .032)
  aperture=[(0,front+.006,upper+peak),(fw*.47,front+.006,upper+.013),(fw*.55,front+.006,upper-.016),(fw*.55,front+.006,lower-.008),(fw*.40,front+.006,lower-.025),(-fw*.40,front+.006,lower-.025),(-fw*.55,front+.006,lower-.008),(-fw*.55,front+.006,upper-.016),(-fw*.47,front+.006,upper+.013)]
  hood=b.hood('Thick pointed hood',hoodcenter,hoodwidth,height,depth,['cloth','clothLight'],b.head,aperture,side_cutback=.105)
  if f=='archer':
   # A source-peaked roof is taller than the old cap calibration, especially
   # in I. Preserve the already measured face/opening and body joint centers;
   # only the six outer front/back roof vertices change, never the aperture.
   roof_source=BOW_SOURCE['headTop'][r-1];rise=(bb[1]-roof_source)*S
   apex=upper+rise;shoulder=upper+rise*.60
   for index,zroof in ((0,apex),(1,shoulder),(8,shoulder),
                       (9,apex-.018),(10,shoulder-.018),(17,shoulder-.018)):
    hood.data.vertices[index].co.z=zroof
   hood.data.update()
   b.cfg['hoodRoofSource']={'apexY':roof_source,'faceTopY':bb[1],
    'capToFaceHeightRatio':(bb[1]-roof_source)/(bb[3]-bb[1]),
    'apexMeters':apex,'method':'Observed source apex distance above fixed frontal face; pointed faceted roof, aperture unchanged'}
  # Source aperture face is the frontal rectangle only, with shallow cheek wall.
  fy=front-.032;b.headFront=fy;face=b.box('Observed face',(0,fy-.055,facecenter[2]),(fw,.11,fh),'skin',.018,b.head)
  b.coverSkin=[face];b.coverShell=[o for o in b.objects if o.name=='Thick pointed hood']
 else:
  face=b.box('Observed face',facecenter,(fw,fw*.68,fh),'skin',.025,b.head);b.coverSkin=[];b.coverShell=[]
  low=facecenter[2]-fh/2
 fitted_neck(b,face,torso_top,b.torso,b.head)
 for sg in (-1,1):b.box('Eye '+('R' if sg>0 else 'L'),(sg*fw*.24,b.headFront+.003,b.facez+fh*.04),(fw*.11,.012,fh*.23),'eyes',.001,b.head)
 b.robe=robe;b.waist=waist;b.shoulderz=shoulderz;b.hem=hem

def cape(b,r,kind='split',mat='cloth',bottom=.12):
 w=b.bodyw*1.15;top=b.shoulderz+.065;rear=-.29
 # A wrapped five-sector back shell, with physically distinct split tails.
 sec=[(-1,.07),(-1,-.10),(-.55,-.31),(.55,-.31),(1,-.10),(1,.07)]
 vs=[]
 for z,width,dep in [(top,w*.76,.7),(b.waist,w*.93,1),(bottom,w*1.14,1.20)]:vs += [(x*width,y*dep,z) for x,y in sec]
 # Closed thick panels around back, each independently manifold.
 for i in range(5):
  for j in range(2):
   q=[vs[j*6+i],vs[j*6+i+1],vs[(j+1)*6+i+1],vs[(j+1)*6+i]]
   if kind=='ragged' and j==1:q[2]=(q[2][0],q[2][1],q[2][2]+(.14 if i%2 else .02))
   b.panel('Cape sector '+str(i)+' '+str(j),q,.018,[mat,'clothLight'] if mat=='cloth' else mat,b.torso)
 if r>=5:
  for sg in (-1,1):
   x=sg*w*1.02;b.panel('Gold cape edge '+str(sg),[(sg*w*.76,.05,top),(sg*w*.79,.05,top),(x+.025*sg,.07,bottom),(x,.07,bottom)],.022,'gold',b.torso)

def collar(b,material='cloth',leaf=False):
 if leaf:
  z=b.shoulderz+.08
  for sg in (-1,1):
   # Broad outer shoulder leaves and separate overlapping chest leaves.
   b.panel('Large shoulder leaf '+str(sg),[(sg*b.bodyw*.24,.09,z+.06),(sg*b.bodyw*.80,.05,z-.02),(sg*b.bodyw*.89,.09,z-.13),(sg*b.bodyw*.41,.18,z-.09)],.032,material,b.torso,relief=.014)
   b.panel('Large chest leaf '+str(sg),[(sg*b.bodyw*.12,.19,z+.035),(sg*b.bodyw*.46,.205,z-.015),(sg*b.bodyw*.27,.235,z-.20),(sg*b.bodyw*.035,.23,z-.09)],.034,material,b.torso,relief=.017)
   b.panel('Rear shoulder leaf '+str(sg),[(sg*b.bodyw*.18,-.17,z+.04),(sg*b.bodyw*.67,-.20,z+.005),(sg*b.bodyw*.74,-.23,z-.13),(sg*b.bodyw*.24,-.24,z-.12)],.032,material,b.torso,relief=.014)
  return
 for i in range(7):
  a=(i-3)*math.pi/7;x=math.sin(a)*b.bodyw*.56;y=math.cos(a)*.20;z=b.shoulderz+.055
  tip=(x*1.22,y+.03,z-.15 if leaf else z-.08)
  outline=[(x-.065,y,z+.07),(x+.065,y,z+.07),tip] if leaf else [(x-.075,y,z+.06),(x+.075,y,z+.06),(x+.083,y+.027,z-.070),(x-.058,y+.030,z-.105)]
  b.panel(('Leaf mantle ' if leaf else 'Collar facet ')+str(i),outline,.035,material,b.torso,relief=.013)
 for i in (-1,0,1):
  x=i*b.bodyw*.33;y=-.19;z=b.shoulderz+.055
  outline=[(x-.09,y,z+.04),(x+.09,y,z+.04),(x+.11,y-.025,z-.07),(x-.08,y-.025,z-.10)]
  b.panel('Rear collar facet '+str(i),outline,.03,material,b.torso,relief=.01)

def round_brooch(b,name,x,y,z,radius,material):
 return b.panel(name,[(x+radius*math.cos(i*math.tau/10),y,z+radius*math.sin(i*math.tau/10)) for i in range(10)],.023,material,b.torso,relief=.006)

def frost_fur_collar(b):
 # The source fur wraps outside the hood, rather than disappearing inside it.
 # Preserve every hood/face vertex: only the independent torso garment changes.
 shell=next(v for v in b.coverage if v.get('type')=='hood')
 cx,cy,_=shell['center'];rx=b.facew*.74;ry=(shell['front']-shell['rear'])/2+.065
 top=b.facez-b.faceh/2-.024;height=b.faceh*.58
 for j in range(12):
  a=j*math.tau/12;x=cx+math.sin(a)*rx;y=cy+math.cos(a)*ry
  fur=b.box('Exterior ivory fur block '+str(j),(x,y,top-height/2),(.175,.115,height),'ivory',.027,b.torso)
  # Rotate the physical blocks around their own centers, with radial thickness.
  center=Vector((x,y,top-height/2));c=math.cos(-a);s=math.sin(-a)
  for v in fur.data.vertices:
   p=v.co-center;v.co=center+Vector((c*p.x-s*p.y,s*p.x+c*p.y,p.z))
  fur.data.update()
 b.cfg['furCollarPlacement']='Twelve closed ivory blocks outside the unchanged hood, visible front/back/profiles'

def cleric_rear_stole(b,r):
 bottom=b.hem+.014;top=b.shoulderz+.040
 if r in (2,3):
  for sg in (-1,1):
   x=sg*b.bodyw*.30;w=.13
   b.panel('Rear ivory stole '+str(sg),[(x-w/2,-.210,top),(x+w/2,-.210,top),(x+w/2,-.245,bottom),(x-w/2,-.245,bottom)],.023,'ivory',b.torso)
   if r==2:
    b.box('Rear stole cross upright '+str(sg),(x,-.277,bottom+.10),(.025,.018,.105),'gold',.002,b.torso)
    b.box('Rear stole cross arm '+str(sg),(x,-.279,bottom+.12),(.075,.018,.025),'gold',.002,b.torso)
 elif r in (5,6):
  # Follow all three depths of the real cape; panels remain on its outer back.
  stripes=[(0,b.bodyw*.36)] if r==5 else [(sg*b.bodyw*.27,b.bodyw*.22) for sg in (-1,0,1)]
  levels=[(top,-.247),(b.waist,-.338),(bottom,-.400)]
  for j,(x,w) in enumerate(stripes):
   for k in range(2):
    za,ya=levels[k];zc,yc=levels[k+1]
    b.panel('Rear cape ivory stole '+str(j)+' '+str(k),[(x-w/2,ya,za),(x+w/2,ya,za),(x+w/2,yc,zc),(x-w/2,yc,zc)],.016,'ivory',b.torso)
   if r==6 and j==0:
    b.box('Rear cape stole gold cross upright',(x,-.421,bottom+.11),(.025,.018,.105),'gold',.002,b.torso)
    b.box('Rear cape stole gold cross arm',(x,-.423,bottom+.13),(.075,.018,.025),'gold',.002,b.torso)

def book(b,r,material='violet'):
 wp=b.joints['L'][3];ha=b.joints['L'][6];x,y,z=ha
 if r<6:
  b.box('Bound prayer book',(x,y+.06,z+.12),(.25,.115,.32),material,.014,wp)
  b.box('Book edge pages',(x-.129,y+.062,z+.12),(.014,.079,.26),'ivory',.003,wp)
  for dx in (-.102,.102):
   for dz in (-.132,.132):b.box('Book corner',(x+dx,y+.144,z+.12+dz),(.035,.017,.035),'gold',.003,wp)
 else:
  for sg in (-1,1):
   outline=[(x,y+.17,z+.10),(x+sg*.23,y+.10,z+.20),(x+sg*.23,y-.10,z+.26),(x,y-.02,z+.16)]
   b.panel('Open book cover '+str(sg),outline,.025,material,wp);b.panel('Open pages '+str(sg),[(xx,yy+.012,zz+.012) for xx,yy,zz in outline],.008,'ivory',wp)

def staff(b,f,r):
 wp=b.joints['R'][3];ha=b.joints['R'][6];x,y,z=ha;tipheight=1.55 if f=='mage' else 1.80
 if f=='cleric':
  cross_top_px=[80,94,112,110,103,100][r-1];tipheight=(b.sole-cross_top_px)*b.S-.205
 b.rod('Staff shaft',(x+.04,y,.025),(x-.045,y,tipheight-.16),.027,'ice' if f=='frostwarden' else 'wood',wp)
 if f=='mage':
  hz=.23 if r>=5 else .16;cx=x-.045;verts=[(cx-.015,y,tipheight-hz)];rings=[]
  for j in range(8):
   a=j*math.tau/8;rr=.095*(1+.10*math.sin(j*2.1));rings.append((cx+rr*math.cos(a),y+rr*.72*math.sin(a),tipheight-hz*.15+.017*math.sin(j)))
  verts+=rings;verts.append((cx+.025,y-.014,tipheight+hz));faces=[(0,(j+1)%8+1,j+1) for j in range(8)]+[(j+1,(j+1)%8+1,9) for j in range(8)]
  b.mesh('Asymmetric eight facet purple crystal',verts,faces,'violet',wp)
  b.box('Crystal socket',(x-.041,y,tipheight-.17),(.105,.095,.090),'gold' if r>=5 else 'wood',.014,wp)
  if r>=5:
   for sg in (-1,0,1):b.rod('Staff crown prong '+str(sg),(x-.045+sg*.055,y,tipheight-.17),(x-.045+sg*.13,y,tipheight+.015),.018,'gold',wp)
 elif f=='druid':
  for j in range(1 if r<4 else (3 if r==6 else 2)):
   off=(j-(0 if r<4 else .5))* .13;b.jewel('Faceted leaf '+str(j),(x-.04+off,y,tipheight+.015-(abs(off)*.25)),.082,.145,.030,'leaf',wp)
   if r>=4:b.rod('Staff branch '+str(j),(x-.045,y,tipheight-.23),(x-.04+off,y,tipheight-.07),.027,'wood',wp)
 elif f=='frostwarden':
  if r!=2:b.jewel('Ice spear point',(x-.045,y,tipheight+.06),.083,.22,.066,['ice','iceLight'],wp)
  b.box('Ice socket',(x-.045,y,tipheight-.155),(.095,.095,.085),'ice',.014,wp)
  if r in (2,6):
   for sg in (-1,1):
    b.rod('Ice fork '+str(sg),(x-.045,y,tipheight-.13),(x-.045+sg*.13,y,tipheight-.01),.025,'ice',wp)
    b.jewel('Side ice prong '+str(sg),(x-.045+sg*.13,y,tipheight+.11),.045,.17,.04,'ice',wp)
 elif f=='cleric':
  b.box('Latin cross vertical',(x-.045,y,tipheight-.005),(.075,.075,.42),'gold',.006,wp)
  b.box('Latin cross horizontal',(x-.045,y,tipheight+.035),(.31,.085,.073),'gold',.006,wp)
  for zz in (.07,tipheight-.25):b.box('Staff gold ferrule',(x+.04 if zz<.2 else x-.04,y,zz),(.075,.075,.09),'gold',.007,wp)
 b.pivot('attack_muzzle',(x-.045,y+.04,tipheight),wp);b.pivot('staff_tip',(x-.045,y,tipheight),wp)

def bow(b,r):
 ha=b.joints['L'][6];x,y,z=ha;wp=b.joints['L'][3];bp=b.pivot('bow_pivot',ha,wp)
 measured={k:v[r-1] for k,v in BOW_SOURCE.items()};sourceS=1.8/(measured['sole']-measured['headTop'])
 low=(measured['sole']-measured['bottom'])*sourceS;high=(measured['sole']-measured['top'])*sourceS
 b.cfg['bowEndpointsSourcePx']=measured;b.cfg['bowEndpointHeightsM']={'lower':low,'upper':high}
 # End fittings remain inside the measured outer endpoints.
 if r>=5:low+=.05;high-=.05
 pts=[(x-.01,y,low),(x-.20,y,low+(z-low)*.35),(x-.24,y,low+(z-low)*.70),(x-.08,y,z),(x-.24,y,z+(high-z)*.30),(x-.20,y,z+(high-z)*.65),(x-.01,y,high)]
 b.limb('Faceted recurve bow',pts,[.033]*7,['wood','leatherLight'],bp,6)
 b.rod('Taut bowstring',pts[0],pts[-1],.004,'recess',bp,6)
 b.box('Bow wrapped grip',(x-.08,y,z),(.077,.070,.135),'leather',.008,bp)
 if r>=5:
  for k in (0,2,4,6):b.box('Steel bow band '+str(k),pts[k],(.083,.09,.10),'steel',.009,bp)
 b.pivot('bow_tip_upper',pts[-1],bp);b.pivot('bow_tip_lower',pts[0],bp);b.pivot('bow_nock',(x-.012,y,z),bp);b.pivot('attack_muzzle',(x-.01,y+.02,z),bp)
 bow_forward_plane(b,bp,(x-.08,y,z))
 # Real rear quiver with leather volume and separately authored arrows.
 a=(b.bodyw*.31,-.34,b.shoulderz-.40);c=(b.facew*.74+.12,-.38,b.shoulderz+.17)
 b.limb('Rear leather quiver',[a,c],[.12,.12],'leather',b.torso)
 for j in range(3):
  xx=c[0]+(j-1)*.08;upper=(xx,c[1],c[2]+.20+(j%2)*.04);b.rod('Quiver arrow '+str(j),(a[0]+(j-1)*.08,a[1],a[2]+.05),upper,.012,'wood',b.torso)
  b.box('Arrow feather '+str(j),(upper[0],upper[1],upper[2]-.04),(.062,.025,.13),'ivory',.006,b.torso)

def ice_shield(b,r):
 ha=b.joints['L'][6];x,y,z=ha;wp=b.joints['L'][3];rx=.20 if r<5 else .29;rz=.28 if r<5 else .37
 outline=[(x+rx*math.sin(i*math.tau/6),y+.21,z+rz*math.cos(i*math.tau/6)) for i in range(6)]
 b.panel('Ice shield body',outline,.09,['ice','iceLight'],wp,relief=.035)
 inner=[(x+(xx-x)*.72,yy+.04,z+(zz-z)*.72) for xx,yy,zz in outline];b.panel('Ice shield inset',inner,.025,'ice',wp)
 b.jewel('Ice shield boss',(x,y+.285,z),rx*.35,rz*.44,.04,'iceLight',wp)

def equipment(b,f,r):
 if f=='archer':
  bow(b,r)
  if r>=2:collar(b,'leather' if r==3 else 'cloth')
  if r>=2:
   round_brooch(b,'Mantle silver brooch',0,.241,b.shoulderz+.015,.041,'steel')
   a=(b.bodyw*.50,.208,b.shoulderz-.020);c=(-b.bodyw*.34,.207,b.waist+.04);b.limb('Diagonal quiver strap',[a,c],[.024,.024],'leather',b.torso,4)
  if r>=3:b.box('Leather jerkin',(0,.185,b.waist+.16),(b.bodyw*.74,.060,.32),'leather',.022,b.torso)
  if r>=4:cape(b,r)
  if r>=5:
   for side in ('R','L'):
    up,lo,_,_,sh,el,ha=b.joints[side];b.box('Steel shoulder '+side,(sh[0],.04,sh[2]+.03),(.25,.26,.12),'steel',.026,up);b.limb('Steel bracer '+side,[tuple(Vector(el).lerp(Vector(ha),.5)),ha],[.10,.10],'steel',lo)
  if r==6:
   b.panel('Silver chest guard',[(-b.bodyw*.35,.224,b.shoulderz+.01),(0,.224,b.shoulderz-.07),(b.bodyw*.35,.224,b.shoulderz+.01),(b.bodyw*.25,.224,b.waist+.13),(0,.26,b.waist+.07),(-b.bodyw*.25,.224,b.waist+.13)],.035,['steel','steelLight'],b.torso,relief=.018)
 elif f=='mage':
  # Broad volume brim and tapered asymmetric pointed crown; face below brim.
  brimz=b.facez+b.faceh*.5-.012;radius=b.facew*(.60 if r==1 else 1.18)
  def tilted_ring(z,rx,ry,n=10,cx=0,cy=.16):return [(xx,yy,zz-.12*(yy-.16)+.025*xx) for xx,yy,zz in b.ring(cx,cy,z,rx,ry,n)]
  b.loft('Pointed tilted hat brim',[tilted_ring(brimz-.020,radius,b.facew*.54),tilted_ring(brimz+.020,radius*.98,b.facew*.54)],['cloth','clothLight'],b.head)
  hatheight=1.80-brimz
  b.loft('Tall faceted hat',[tilted_ring(brimz+.010,b.facew*.59,b.facew*.43,8),tilted_ring(brimz+hatheight*.36,b.facew*.45,b.facew*.34,8,cx=-.015,cy=.145),b.ring(-.03,.13,brimz+hatheight*.74,b.facew*.21,b.facew*.16,8),b.ring(-.05,.12,1.80,.008,.008,8)],['cloth','clothLight'],b.head)
  # Fit the actual head roof under the tilted brim, including its rear corners.
  face=next(o for o in b.objects if o.name=='Observed face');inverse=face.matrix_world.inverted();upper=b.facez+b.faceh*.5
  for v in face.data.vertices:
   p=face.matrix_world@v.co;blend=max(0,min(1,(p.z-(upper-.075))/.075))
   roof=brimz-.014-.12*(p.y-.16)+.025*p.x
   p.z+=(roof-upper)*blend;v.co=inverse@p
  face.data.update()
  if r>=2:b.loft('Hat band',[tilted_ring(brimz+.027,b.facew*.61,b.facew*.45,8),tilted_ring(brimz+.080,b.facew*.57,b.facew*.42,8)],'gold' if r==6 else 'leather',b.head)
  if r==5:
   for j in range(8):
    a=j*math.tau/8;x=math.sin(a)*b.facew*.60;y=.16+math.cos(a)*b.facew*.44
    b.box('Hat gold stud '+str(j),(x,y,brimz+.054-.12*(y-.16)+.025*x),(.027,.027,.028),'gold',.004,b.head)
  staff(b,f,r)
  if r>=3:collar(b,'ivory' if r==6 else 'cloth')
  if r>=4:book(b,r)
  if r>=5:cape(b,r)
  if r>=5:
   for sg in (-1,1):round_brooch(b,'Cape gold brooch '+str(sg),sg*b.bodyw*.32,.247,b.shoulderz+.055,.041,'gold')
 elif f=='druid':
  staff(b,f,r)
  if r>=2:collar(b,'leaf',True)
  if r>=3:
   for sg in (-1,1):
    points=[(sg*b.facew*.55,-.04,1.67),(sg*b.facew*.75,-.03,1.83),(sg*b.facew*.82,-.03,2.04)]
    b.limb('Antler main '+str(sg),points,[.045,.036,.026],'wood',b.head,6)
    for j in (1,2):b.rod('Antler tine '+str(sg)+' '+str(j),points[j-1],(points[j-1][0]+sg*.14,-.03,points[j-1][2]+.16),.029,'wood',b.head,6)
  if r>=4:cape(b,r,'ragged',mat='ivory' if r==5 else 'cloth')
  if r>=5:
   for side in ('R','L'):
    _,lo,_,_,_,el,ha=b.joints[side];b.limb('Bark bracer '+side,[tuple(Vector(el).lerp(Vector(ha),.5)),ha],[.11,.10],'wood',lo)
 elif f=='frostwarden':
  staff(b,f,r)
  frost_fur_collar(b)
  if r in (3,4):
   ha=b.joints['L'][6];b.jewel('Floating diamond ice focus',(ha[0],ha[1]+.18,ha[2]+.12),.145,.245,.08,['ice','iceLight'],b.joints['L'][3])
  if r>=5:ice_shield(b,r)
  if r>=4:
   for side in ('R','L'):
    _,lo,_,_,_,el,ha=b.joints[side];b.limb('Steel bracer '+side,[tuple(Vector(el).lerp(Vector(ha),.55)),ha],[.10,.095],'steel',lo)
  if r>=5:cape(b,r,mat='gold')
  if r==6:
   for side in ('R','L'):
    up,_,_,_,sh,_,_=b.joints[side];b.jewel('Ice pauldron '+side,(sh[0],.08,sh[2]+.045),.16,.14,.13,'ice',up)
 elif f=='cleric':
  staff(b,f,r)
  if r>=2:
   base=b.facez+b.faceh*.5-.022;mitre_width_px=[142,136,142,137,138][r-2];w=mitre_width_px*b.S/2.2;b.cfg['mitreWidthSourcePx']=mitre_width_px
   mitre_front=b.headFront+.020;mitre_rear=.16-b.facew*.36-.026
   b.box('Fitted mitre foundation',(0,.16,base+.018),(b.facew*1.045,b.facew*.76,.052),'cloth',.012,b.head)
   corner=base+(1.8-base)*.42;uv=[(-w,base),(-w*1.10,corner),(0,1.8),(w*1.10,corner),(w,base)]
   b.panel('Bishop mitre front peak',[(x,mitre_front,z) for x,z in uv],.065,['cloth','clothLight'],b.head,relief=.014)
   b.panel('Bishop mitre rear peak',[(x,mitre_rear,z-.012 if z>base else z) for x,z in uv],.055,['cloth','clothLight'],b.head,relief=.008)
   for sg in (-1,1):b.panel('Mitre side wall '+str(sg),[(sg*w,mitre_front,base),(sg*w,mitre_rear,base),(sg*w*1.10,mitre_rear,corner),(sg*w*1.10,mitre_front,corner)],.035,'cloth',b.head)
   b.box('Mitre lower band',(0,(mitre_front+mitre_rear)/2,base+.018),(w*2.0,mitre_front-mitre_rear+.025,.065),'gold',.011,b.head)
   for sg in (-1,1):
    b.rod('Mitre gold edge '+str(sg),(sg*w*1.10,mitre_front+.035,corner),(0,mitre_front+.035,1.8),.016,'gold',b.head,6)
    b.rod('Mitre gold central edge '+str(sg),(sg*w*.24,mitre_front+.037,base),(sg*w*.08,mitre_front+.037,1.78),.012,'gold',b.head,6)
   b.box('Mitre front center stripe',(0,mitre_front+.039,(base+1.78)/2),(.058,.024,1.78-base),'ivory',.004,b.head)
   # Side/back draped cloth protects bare back while face stays in aperture.
   for sg in (-1,1):b.panel('Mitre side veil '+str(sg),[(sg*b.facew*.52,-.12,base),(sg*b.facew*.54,.16,base),(sg*b.facew*.65,.18,b.facez-b.faceh*.53),(sg*b.facew*.56,-.18,b.facez-b.faceh*.53)],.032,'ivory',b.head)
   b.box('Mitre rear veil',(0,-.145,b.facez),(b.facew*1.10,.065,b.faceh*1.12),'ivory',.022,b.head)
   for sg in (-1,1):
    x=sg*b.bodyw*.30;stole_bottom=b.hem+.015;b.panel('Ivory stole '+str(sg),[(x-.065,.209,b.shoulderz+.065),(x+.065,.209,b.shoulderz+.065),(x+.09,.26,stole_bottom),(x-.065,.26,stole_bottom)],.025,'ivory',b.torso)
    b.box('Stole cross upright '+str(sg),(x,.292,b.hem+.13),(.025,.018,.105),'gold',.002,b.torso);b.box('Stole cross arm '+str(sg),(x,.292,b.hem+.15),(.075,.018,.025),'gold',.002,b.torso)
  if r>=4:
   cape(b,r,mat='gold' if r>=5 else 'cloth');book(b,r,'recess' if r==5 else 'leather')
   for sg in (-1,1):round_brooch(b,'Gold cape brooch '+str(sg),sg*b.bodyw*.32,.247,b.shoulderz+.055,.046,'gold')
  if r==5:
   x,y,z=b.joints['L'][6];b.attach(round_brooch(b,'Prayer book gold seal',x,y+.157,z+.12,.047,'gold'),b.joints['L'][3])
  if r in (2,3,5,6):cleric_rear_stole(b,r)
 elif f=='stormcaller':
  storm_natural_hair_and_focus(b,r)
  if r>=2:cape(b,r,bottom=.31 if r<4 else .12)
  if r>=2:
   brooch_z=min(b.shoulderz+.055,b.facez-b.faceh*.5-.063)
   for sg in (-1,1):round_brooch(b,'Cape gold brooch '+str(sg),sg*b.bodyw*.32,.267,brooch_z,.046,'gold')
  if r>=3:
   for side in (('R',) if r==3 else ('R','L')):
    _,lo,_,_,_,el,ha=b.joints[side];rad=b.bodyw*.195
    b.limb('Casting bracer '+side,[tuple(Vector(el).lerp(Vector(ha),.38)),tuple(Vector(el).lerp(Vector(ha),.90))],[rad*1.04,rad*.98],['steel','steelLight'],lo)
    c=Vector(el).lerp(Vector(ha),.70);c.y+=rad*.91
    b.box('Fitted casting cuff face '+side,c,(rad*1.62,.073,rad*1.75),'steel',.025,lo)
  if r>=4:
   for side in ('R','L'):
    _,_,wrist,_,_,_,ha=b.joints[side];rad=b.bodyw*.195
    b.box('Casting hand metal guard '+side,(ha[0],ha[1]-.020,ha[2]+.024),(rad*1.73,rad*1.56,rad*1.68),['steel','steelLight'],.026,wrist)
  if r>=4:
   for sg in (-1,1):b.panel('Long source front stole '+str(sg),[(sg*b.bodyw*.37,.21,b.shoulderz+.05),(sg*b.bodyw*.24,.21,b.shoulderz+.05),(sg*b.bodyw*.38,.23,.15),(sg*b.bodyw*.60,.23,.15)],.025,'gold' if r==5 else 'ivory',b.torso)
  if r==6:
   for side in ('R','L'):
    up,_,_,_,sh,_,_=b.joints[side];b.box('Steel shoulder '+side,(sh[0],.03,sh[2]+.045),(.27,.27,.10),'steel',.018,up)
 elif f=='runebreaker':
  capbase=b.facez+b.faceh*.50-.026
  b.loft('Faceted work cap',[b.ring(0,.16,capbase,b.facew*.59,b.facew*.42,10),b.ring(0,.16,capbase+.15,b.facew*.62,b.facew*.44,10),b.ring(0,.16,1.8,b.facew*.27,b.facew*.23,10)],['cloth','clothLight'],b.head)
  b.box('Fitted work cap band',(0,.16,capbase+.025),(b.facew*1.19,b.facew*.84,.055),'cloth',.027,b.head)
  b.box('Work cap brim',(0,.16+b.facew*.40,capbase+.012),(b.facew*1.15,.14,.052),'cloth',.017,b.head)
  for j in (-1,0,1):
   cx=j*b.facew*.24;cy=b.headFront+.10;cz=b.facez-b.faceh*(.69 if j==0 else .56);rx=b.facew*.19;rz=b.faceh*(.52 if j==0 else .40)
   outline=[(cx-rx*.67,cy,cz+rz*.90),(cx+rx*.67,cy,cz+rz*.90),(cx+rx,cy,cz+rz*.28),(cx+rx*.80,cy,cz-rz*.69),(cx,cy,cz-rz),(cx-rx*.80,cy,cz-rz*.69),(cx-rx,cy,cz+rz*.28)]
   b.panel('Copper beard lobe '+str(j),outline,.09,'beard',b.head,relief=.035)
  b.cfg['beardProportions']='Three flat topped faceted lobes; central center below face by 0.69 face height, total lobe height 1.04 face height'
  wp=b.joints['R'][3];x,y,z=b.joints['R'][6]
  b.rod('Hammer haft',(x+.025,y,z-.22),(x-.11,y,z+.53),.038,'wood',wp)
  hx=x-.11;hz=z+.46
  if r==6:
   for sg in (-1,1):b.box('Double hammer steel block '+str(sg),(hx+sg*.112,y,hz),(.194,.23,.27),'steel',.025,wp)
   b.box('Double hammer central strap',(hx,y,hz),(.072,.243,.277),'leather',.008,wp)
  else:b.box('Mallet head' if r==1 else 'Hammer steel head',(hx,y,hz),(.36,.21,.23),'wood' if r==1 else 'steel',.024,wp)
  if r in (4,5):b.panel('Hammer claw',[(hx+.10,y+.02,hz+.08),(hx+.29,y+.02,hz+.12),(hx+.37,y+.02,hz-.02),(hx+.23,y+.02,hz+.045)],.11,'steel',wp)
  if r>=5:b.jewel('Hammer rune',(hx,y+.125,hz),.05,.066,.007,'violet',wp)
  lwp=b.joints['L'][3];x,y,z=b.joints['L'][6];b.box('Wooden ruler',(x-.025,y+.055,z+.06),(.080,.045,.65),'leatherLight',.005,lwp)
  for j in range(8):b.box('Ruler tick '+str(j),(x-.023,y+.084,z-.20+j*.075),(.043 if j%2==0 else .026,.006,.006),'recess',.001,lwp)
  b.pivot('attack_muzzle',(hx,y+.14,hz),wp)
  if r>=2:
   apronmat='ivory' if r==4 else 'leather'
   b.box('Leather work apron',(0,.195,b.waist+.05),(b.bodyw*.78,.065,.36 if r<4 else .47),apronmat,.016,b.torso)
   for sg in (-1,1):b.rod('Apron shoulder strap '+str(sg),(sg*b.bodyw*.34,.205,b.shoulderz),(sg*b.bodyw*.28,.22,b.waist+.10),.024,'leather',b.torso,4)
   if r<=4:
    b.box('Rear work apron',(0,-.195,b.waist+.05),(b.bodyw*.78,.065,.36 if r<4 else .47),apronmat,.016,b.torso)
   for sg in (-1,1):
    b.rod('Rear apron shoulder strap '+str(sg),(sg*b.bodyw*.34,-.205,b.shoulderz),(sg*b.bodyw*.28,-.220,b.waist+.10),.024,'leather',b.torso,4)
    if r<=4:b.box('Rear apron strap rivet '+str(sg),(sg*b.bodyw*.28,-.241,b.waist+.10),(.035,.021,.035),'steelLight',.008,b.torso)
  if r in (3,4):
   _,lo,_,_,_,el,ha=b.joints['R'];b.limb('Leather hammer bracer',[tuple(Vector(el).lerp(Vector(ha),.40)),ha],[.12,.11],'leather',lo)
  if r>=3:
   b.loft('Fitted contoured goggle strap',[
    b.ring(0,.16,capbase+.055,b.facew*.623,b.facew*.451,10),
    b.ring(0,.16,capbase+.105,b.facew*.633,b.facew*.461,10)],'leather',b.head)
   for sg in (-1,1):
    xx=sg*b.facew*.24;fy=.16+b.facew*.45+.025;gz=capbase+.085;rr=b.facew*.16
    outer=[(xx+rr*math.cos(j*math.tau/8),fy,gz+rr*math.sin(j*math.tau/8)) for j in range(8)];inner=[(xx+rr*.75*math.cos(j*math.tau/8),fy,gz+rr*.75*math.sin(j*math.tau/8)) for j in range(8)]
    vs=outer+inner+[(x,y-.04,z) for x,y,z in outer+inner];fs=[]
    for j in range(8):
     k=(j+1)%8;fs += [(j,k,8+k,8+j),(16+j,24+j,24+k,16+k),(j,16+j,16+k,k),(8+j,8+k,24+k,24+j)]
    b.mesh('Goggle steel frame '+str(sg),vs,fs,'steel',b.head);b.panel('Goggle lens '+str(sg),[(x,y-.006,z) for x,y,z in inner],.018,'recess',b.head)
  if r>=5:
   for side in ('R','L'):
    _,lo,_,_,_,el,ha=b.joints[side];b.limb('Metal wrist guard '+side,[tuple(Vector(el).lerp(Vector(ha),.30)),tuple(Vector(el).lerp(Vector(ha),.84))],[.185,.173],'steel',lo)
    c=Vector(el).lerp(Vector(ha),.64);c.y+=.12
    b.box('Metal wrist outer face '+side,c,(.30,.10,.21),'steel',.026,lo)
    b.box('Metal wrist face rivet '+side,(c.x,c.y+.061,c.z),(.035,.026,.035),'steelLight',.008,lo)
  if r>=5:
   b.box('Forged steel apron plate',(0,.24,b.waist+.10),(b.bodyw*.78,.072,.40),'steel',.055,b.torso)
   for sx in (-1,1):
    for sz in (-1,1):round_brooch(b,'Apron metal rivet '+str(sx)+' '+str(sz),sx*b.bodyw*.29,.291,b.waist+.10+sz*.14,.019,'steelLight')
   rearheight=.40 if r==5 else .25;rearcenter=b.waist+(.10 if r==5 else .145)
   b.box('Forged rear steel apron plate',(0,-.235,rearcenter),(b.bodyw*.78,.072,rearheight),'steel',.038,b.torso)
   for sg in (-1,1):b.box('Rear steel plate rivet '+str(sg),(sg*b.bodyw*.29,-.284,rearcenter+rearheight/2-.047),(.037,.026,.037),'steelLight',.008,b.torso)
  if r==6:b.jewel('Apron rune',(0,.299,b.waist+.10),.057,.082,.009,'violet',b.torso)

def soldier(rank):
 # Append the prior measured revision, preserving history and original topology.
 source=ROOT/f'blender/scenes/soldier-geometric-v1/soldier-t{rank}.blend'
 with bpy.data.libraries.load(str(source),link=False) as (data,to):to.collections=['MODEL • Soldier']
 coll=to.collections[0];bpy.context.scene.collection.children.link(coll)
 root=next(o for o in coll.objects if o.name.startswith('Soldier_Root'));root.name=f'soldier-{rank}';b=SimpleNamespace(id=f'soldier-{rank}',root=root,coll=coll,objects=[o for o in coll.objects if o.type=='MESH'],coverage=[])
 root['assetRevision']='geometric-game-v1';root['geometricRig']=True;root['locomotion']='biped';root['attackStyle']='spear' if rank==1 else 'sword';root['family']='soldier';root['tier']=rank
 def pivot(name,pos,parent):
  o=bpy.data.objects.new(name,None);coll.objects.link(o);o.location=pos;bpy.context.view_layer.update();m=o.matrix_world.copy();o.parent=parent;o.matrix_world=m;return o
 def attach(o,p):bpy.context.view_layer.update();m=o.matrix_world.copy();o.parent=p;o.matrix_world=m
 torso=pivot('torso_pivot',(0,0,.68),root);head=pivot('head_pivot',(0,.03,1.44),torso)
 # VI: historical leak came from hidden skin neck behind lower helmet edges.
 # A closed visor needs no hidden skull or neck skin. Remove both in revision.
 if rank==6:
  for o in list(b.objects):
   if o.name.startswith(('Face','Neck','Eye_')):b.objects.remove(o);bpy.data.objects.remove(o,do_unlink=True)
 for side,sg in [('R',1),('L',-1)]:
  handob=next(o for o in b.objects if o.name=='Hand_'+side);ha=sum((handob.matrix_world@Vector(v) for v in handob.bound_box),Vector())/8
  shoulder=Vector((sg*.30,0,1.08));elbow=(shoulder+ha)/2;up=pivot('upper_arm_'+side,shoulder,torso);lo=pivot('forearm_'+side,elbow,up);wrist=pivot('hand_'+side,ha,lo);wp=pivot('weapon_'+side,ha,wrist)
  leg=pivot('upper_leg_'+side,(sg*.22,0,.53),root);shin=pivot('shin_'+side,(sg*.23,0,.27),leg);foot=pivot('foot_'+side,(sg*.24,0,.11),shin)
  for o in b.objects:
   name=o.name.lower()
   if name=='hand_'+side.lower():attach(o,wrist)
   elif name.startswith('sleeve_'+side.lower()):attach(o,up if 'upper' in name else lo)
   elif name=='boot_'+side.lower():attach(o,foot)
   elif name=='trouser_'+side.lower():attach(o,leg)
   elif name.startswith('armor pauldron') and (('right' in name and side=='R') or ('left' in name and side=='L')):attach(o,up)
   elif name.startswith('armor knee guard') and (('right' in name and side=='R') or ('left' in name and side=='L')):attach(o,shin)
   elif name.startswith('armor waist tasset') and (('right' in name and side=='R') or ('left' in name and side=='L')):attach(o,leg)
   elif name.startswith('armor forearm cuff') and (('right' in name and side=='R') or ('left' in name and side=='L')):attach(o,lo)
   elif name=='armor sword gauntlet' and side=='R':attach(o,wrist)
   elif name=='armor shield gauntlet' and side=='L':attach(o,wrist)
   elif side=='R' and name.startswith(('sword','spear')):attach(o,wp)
   elif side=='L' and name.startswith('shield'):attach(o,wp)
  if side=='R':pivot('attack_muzzle',ha+Vector((0,.03,.22)),wp)
 for o in b.objects:
  name=o.name.lower()
  if name.startswith(('helmet','hair','face','eye_','neck')):attach(o,head)
  elif o.parent==root:attach(o,torso)
 skin=[o for o in b.objects if o.name=='Face'];covers=[o for o in b.objects if o.name.startswith(('Helmet','Hair'))]
 b.coverage=[head_coverage(skin,covers,rank==6)] if covers else []
 # Skin behind open helmet aperture is observed frontal face, not a full skull.
 if rank in (2,3,4,5) and b.coverage[0]['leaks']:
  face=skin[0];front=max(v.co.y for v in face.data.vertices)
  for v in face.data.vertices:
   if v.co.y<front-.02:v.co.x*=.70;v.co.y=max(v.co.y,.19)
  b.coverage=[head_coverage(skin,covers)]
  if b.coverage[0]['leaks']:
   bottom=min(v.co.z for v in face.data.vertices)
   for v in face.data.vertices:
    if v.co.y<front-.02 and v.co.z<bottom+.04:v.co.z+=.04
   b.coverage=[head_coverage(skin,covers)]
 return b

def save_reference(b,sheet):
 im=bpy.data.images.load(str(ROOT/'output/design/geometric-turnarounds-v1'/sheet['file']));im.use_fake_user=True;im.pack();c=bpy.data.collections.new('REFERENCE packed six views');bpy.context.scene.collection.children.link(c);c.hide_render=True;c.hide_viewport=True
 ob=bpy.data.objects.new('Authoritative six view sheet',None);c.objects.link(ob);ob.empty_display_type='IMAGE';ob.data=im
 b.root['referenceSha256']=sheet['sha256'];b.root['sourceViews']=6;b.root['sourceFile']=sheet['file']

def author(f,r,args):
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene.unit_settings.scale_length=1
 if f=='soldier':
  b=soldier_fit(soldier(r),r)
  skin=[o for o in b.objects if o.name=='Face'];covers=[o for o in b.objects if o.name.startswith(('Helmet','Hair'))]
  b.coverage=[head_coverage(skin,covers,r==6)] if covers else [{'passed':True,'method':'Bare head with physically fitted neckline'}]
 else:
  b=Builder(f'{f}-{r}',palette(f,r));body(b,f,r);equipment(b,f,r)
  if f in ('runebreaker','mage','stormcaller') or (f=='cleric' and r>=2):center_full_head_on_torso(b)
  if f=='runebreaker':engineer_source_nape_hair(b,r)
  fitted_arm_joints(b)
  b.root['family']=f;b.root['tier']=r;b.root['locomotion']='biped';b.root['attackStyle']='bow' if f=='archer' else ('hammer' if f=='runebreaker' else 'staff');b.root['bodyHeightMeters']=1.8
  b.root['measuredSource']=json.dumps(b.cfg)
  if b.coverSkin:b.coverage.append(head_coverage(b.coverSkin,b.coverShell))
  else:b.coverage.append({'passed':True,'method':'Open face cap/hat geometry; skin head stays below brim. No hood/closed helmet in this rank.'})
 sculpt_facets(b)
 b.contactChecks=rest_contact_checks(b)
 if hasattr(b,'stormContactChecks'):b.contactChecks+=b.stormContactChecks
 assert all(v['passed'] for v in b.contactChecks),(f,r,'Actual surface joint separation',b.contactChecks)
 b.root['assetRevision']='geometric-game-v3';b.root['jointFitRevision']='surface-fit-v3'
 b.root['jointSurfaceContactQa']=json.dumps(b.contactChecks)
 sheet=next(v for v in SOURCES['sheets'] if v['id']==f'{f}-{r}' and v['category']=='towers');save_reference(b,sheet)
 for result in b.coverage:
  if 'passed' in result:assert result['passed'],(f,r,'head coverage',result)
 b.root['headCoverageQa']=json.dumps(b.coverage);b.root['headCoveragePassed']=True
 b.root['equipment']=json.dumps(EQUIPMENT[f][r-1]);b.root['qualityStatus']='Physical checks are separate from visual match; 1 percent CAD accuracy is not certified from raster concepts.'
 dest=EXPORTS/f'{f}-{r}.glb';metric=export_and_check(b,dest);metric['jointSurfaceContactsRest']=b.contactChecks
 assert metric['nonManifoldEdges']==0,(f,r,'nonmanifold')
 assert abs(metric['boundsMin'][2])<.001,(f,r,'grounding')
 if not args.no_render:metric['views']=render_views(b,OUT/'renders'/f'{f}-{r}',(args.size,round(args.size*1.2)))
 elif args.preserve_renders:
  cached=previous[f'{f}-{r}']['metrics'];assert cached['geometrySha256']==metric['geometrySha256'],(f,r,'existing renders no longer match geometry')
  metric['views']=cached['views']
 bpy.ops.wm.save_as_mainfile(filepath=str(SCENES/f'{f}-{r}.blend'))
 row={'id':f'{f}-{r}','kind':'tower','family':f,'rank':r,'tier':r,'file':f'defenders/{f}-{r}.glb','portrait':f'portraits/{f}-{r}.png','locomotion':'biped','attackStyle':'spear' if f=='soldier' and r==1 else ('sword' if f=='soldier' else ('bow' if f=='archer' else ('hammer' if f=='runebreaker' else 'staff'))),'runtimePath':f'/assets/geometric/defenders/{f}-{r}.glb','nativeFile':str(SCENES/f'{f}-{r}.blend'),'sourceFile':sheet['file'],'sourceSha256':sheet['sha256'],'metrics':metric,'sourceMeasurements':getattr(b,'cfg',None),'sourceSixViewBoxes':MEAS.get((f,r),{}).get('sourceViewBoxes'),'qualityLimits':'Hidden depth/camera estimate, six consistent views; IoU and 1% goals must be independently measured before being claimed.'}
 if hasattr(b,'axisFit'):row['headAxisFit']=b.axisFit
 if hasattr(b,'stormDesign'):row['stormV3DesignOverride']=b.stormDesign
 print('DEFENDER_COMPLETE '+json.dumps({'id':row['id'],'triangles':metric['triangles'],'coverage':metric['coverage']}),flush=True);return row

parser=argparse.ArgumentParser();parser.add_argument('--families',default=','.join(FAMILIES));parser.add_argument('--ranks',default='1,2,3,4,5,6');parser.add_argument('--no-render',action='store_true');parser.add_argument('--preserve-renders',action='store_true');parser.add_argument('--size',type=int,default=300);parser.add_argument('--manifest-name',default='geometric-defenders.json');parser.add_argument('--ids',default='')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []);manifest=OUT/args.manifest_name;previous={}
if manifest.exists():previous={v['id']:v for v in json.loads(manifest.read_text())['assets']}
pairs=[(v.rsplit('-',1)[0],int(v.rsplit('-',1)[1])) for v in args.ids.split(',')] if args.ids else [(f,r) for f in args.families.split(',') for r in map(int,args.ranks.split(','))]
for f,r in pairs:
 row=author(f,r,args);previous[row['id']]=row;manifest.write_text(json.dumps({'revision':'geometric-game-v3','count':len(previous),'assets':list(previous.values())},indent=2),encoding='utf-8',newline='\n')
print('ALL_DEFENDERS_COMPLETE '+str(len(previous)),flush=True)
