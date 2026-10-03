"""Physical, articulated geometric sculptures for the 88 enemy/champion sources.

Source drawings define identity and proportions; meters are an explicit assumed
game scale. No camera-dependent geometry or baked image impostors are used.
"""
import bpy,math,json,random
from mathutils import Vector
from geometric_game_common import Builder

COLORS={
 'rimewatch':('385b8a','eee1c1'),'frostblade':('476b92','f2e9cb'),'roseguard':('823743','d9ae60'),
 'highking':('273042','899ac0'),'crownofages':('50346c','d9ad55'),'thornwarden':('365b35','91a16a'),
 'verdantguard':('277369','d4b85f'),'tempest':('76508c','eadac7'),'stormcitadel':('285e71','e8dabd'),
 'embercrown':('a75f38','ffd098'),'worldfire':('527199','edd5a0'),'starfall':('8255a1','d8a2e4'),
 'thunderheart':('77529f','d9c19a'),'phoenix':('c87844','e6cca1'),'greenheart':('45652f','9fb354'),
 'eldergrove':('4b642d','c9b772'),'sunward':('f0e0bb','d4a34f'),'winterhold':('87acda','c4e8ff'),
 'dawnspire':('f0e4c5','d5b060'),'royalmarshal':('996b39','dab061'),'wyvernhunter':('3f5d86','eddfc7'),
 'royalarsenal':('304b78','d7ac5c'),'rangermentor':('785439','b9aa68'),'kingdomprotector':('406394','dfb45b'),
 'mothernature':('718145','dcd0a5'),'royalranger':('3e5d89','dcb662'),'kingsrangerguard':('38517b','e9dbc3'),
 'elvenking':('385332','dabb61'),'emeraldgolem':('b3aa93','81a242'),'mechanicalgolem':('526d73','d6af62'),
 'monk':('796043','d9c69c'),'archbishop':('ecdfc0','d4a553'),'archangel':('5577a6','f0e2be'),
}

# Native face slab dimensions include the forehead covered by the sculpted
# fringe. Per-source visible aperture/skin measurements are stored separately.
FACE_ASPECT={'rimewatch':.82,'thornwarden':.78,'verdantguard':.81,'tempest':.72,'stormcitadel':.78,'greenheart':.76,'eldergrove':.77,'sunward':.78,'dawnspire':.79,'royalmarshal':.62,'wyvernhunter':.84,'royalranger':.73,'kingsrangerguard':.80,'elvenking':.84,'crownofages':.76,'monk':.69,'archbishop':.60}

def ell(b,name,pos,radii,mat,parent=None,n=8,rings=4):
 x,y,z=pos;rx,ry,rz=radii;vs=[(x,y,z-rz)];fs=[]
 for j in range(1,rings+1):
  a=-math.pi/2+j*math.pi/(rings+1)
  for k in range(n):
   t=k*math.tau/n;vs.append((x+rx*math.cos(a)*math.sin(t),y+ry*math.cos(a)*math.cos(t),z+rz*math.sin(a)))
 vs.append((x,y,z+rz));top=len(vs)-1
 for k in range(n):fs.append((0,1+(k+1)%n,1+k));fs.append((top,1+(rings-1)*n+k,1+(rings-1)*n+(k+1)%n))
 for j in range(rings-1):
  for k in range(n):
   a=1+j*n+k;c=1+j*n+(k+1)%n;fs.extend([(a,c,c+n),(a,c+n,a+n)])
 return b.mesh(name,vs,fs,mat,parent)

def cone(b,name,a,c,r,mat,parent=None,n=6):
 a,c=Vector(a),Vector(c);d=(c-a).normalized();u=d.cross(Vector((0,1,0)) if abs(d.y)<.9 else Vector((1,0,0))).normalized();v=d.cross(u)
 vs=[tuple(a+u*math.cos(i*math.tau/n)*r+v*math.sin(i*math.tau/n)*r) for i in range(n)]+[tuple(c)]
 return b.mesh(name,vs,[tuple(reversed(range(n)))]+[(i,(i+1)%n,n) for i in range(n)],mat,parent)

def annulus(b,name,pos,radius,tube,mat,parent=None,vertical=False,n=12,m=4):
 x,y,z=pos;vs=[];fs=[]
 for i in range(n):
  a=i*math.tau/n
  for j in range(m):
   t=j*math.tau/m;r=radius+tube*math.cos(t)
   vs.append((x+r*math.cos(a),y+tube*math.sin(t),z+r*math.sin(a)) if vertical else (x+r*math.cos(a),y+r*math.sin(a),z+tube*math.sin(t)))
 for i in range(n):
  for j in range(m):fs.append((i*m+j,((i+1)%n)*m+j,((i+1)%n)*m+(j+1)%m,i*m+(j+1)%m))
 return b.mesh(name,vs,fs,mat,parent)

def leaf(b,name,a,c,width,mat,parent=None):
 a,c=Vector(a),Vector(c);d=c-a;u=d.cross(Vector((0,1,0))).normalized()*width;mid=a.lerp(c,.43)
 return b.panel(name,[tuple(a),tuple(mid+u),tuple(c),tuple(mid-u)],.025,mat,parent,.035)

def strap(b,name,a,c,width,mat,parent=None):
 a,c=Vector(a),Vector(c);u=(c-a).cross(Vector((0,1,0))).normalized()*width/2
 return b.panel(name,[tuple(a-u),tuple(a+u),tuple(c+u),tuple(c-u)],.026,mat,parent)

def lion(b,pos,r,parent,side=False):
 """Raised readable lion relief: lobed mane, muzzle, eyes and nose."""
 x,y,z=pos
 def Q(q):return (x+(1 if side is True else side)*q[1],y+q[0],z+q[2]) if side else (x+q[0],y+q[1],z+q[2])
 for j in range(10):
  a=j*math.tau/10;ell(b,'Lion embossed mane lobe',Q((r*.67*math.sin(a),.014,r*.67*math.cos(a))),(.042 if side else r*.31,r*.31 if side else .042,r*.32),'gold',parent,5,2)
 ell(b,'Lion embossed broad face',Q((0,.048,0)),(.040 if side else r*.53,r*.53 if side else .040,r*.61),'gold',parent,6,3)
 for sn in (-1,1):
  ell(b,'Lion paired muzzle',Q((sn*r*.19,.078,-r*.25)),(.027 if side else r*.23,r*.23 if side else .027,r*.20),'gold',parent,5,2)
  ell(b,'Lion recessed eye',Q((sn*r*.22,.089,r*.16)),(.009 if side else r*.10,r*.10 if side else .009,r*.07),'dark',parent,4,2)
 cone(b,'Lion dark nose',Q((0,.086,-r*.08)),Q((0,.103,-r*.22)),r*.10,'dark',parent,4)

def gear(b,name,pos,r,mat,parent):
 x,y,z=pos;annulus(b,name+' hollow toothed hub',pos,r*.65,r*.19,mat,parent,True,12,4)
 for j in range(12):
  a=j*math.tau/12;dx,dz=math.sin(a),math.cos(a)
  b.rod(name+' radial tooth',(x+dx*r*.71,y,z+dz*r*.71),(x+dx*r,y,z+dz*r),r*.14,mat,parent,4)

def rays(b,name,pos,r,parent):
 x,y,z=pos
 for j in range(12):
  a=j*math.tau/12;dx,dz=math.sin(a),math.cos(a)
  cone(b,name+' ray',(x+dx*r*.94,y,z+dz*r*.94),(x+dx*r*1.47,y,z+dz*r*1.47),r*.115,'gold',parent,4)

def crescent(b,name,pos,r,mat,parent):
 x,y,z=pos;points=[]
 for j in range(10):
  a=math.radians(42)+j*math.radians(276)/9;points.append((x+math.sin(a)*r,y,z+math.cos(a)*r))
 b.limb(name,points,[.04]*10,mat,parent,5)

def crown(b,pos,width,mat='gold',parent=None,points=5):
 x,y,z=pos;annulus(b,'Crown continuous band',(x,y,z),width*.535,.036,mat,parent,n=12,m=6)
 for k in range(points):
  a=k*math.tau/points;cx=x+math.sin(a)*width*.515;cy=y+math.cos(a)*width*.515
  cone(b,'Crown tall tooth',(cx,cy,z+.018),(cx,cy,z+.16 if k%2==0 else z+.12),.064,mat,parent,4)

def palette(row):
 s=row['spec'];identity=row['id'];enemy=row['category']=='enemies';wave=s.get('wave',0)
 cloth,trim=COLORS.get(identity,(s.get('color','#63715a').lstrip('#'),s.get('accent','#b89b6c').lstrip('#')))
 skin=row['face_sample_srgb'].lstrip('#') if enemy else 'efbd89'
 if enemy:
  skin='a0a465' if s['bodyKind'] not in ('troll','ogre') else '939664' if s['bodyKind']=='troll' else 'd4b28a'
  if wave==3:skin='e3b98e'
  if wave in (8,23,27,33):skin='7e8ca2' if wave==8 else '91b1c1' if wave!=23 else 'a1d6c8'
  if wave==27:skin='c8c7b4'
  if wave in (32,49):skin='92917c'
  if wave==50:skin='d8c4a7'
  cloth='694d36' if wave not in (8,14,16,18,23,31,33,36,38,44,46,49,50) else {8:'3c4149',14:'454548',16:'38373c',18:'2f2b3e',23:'384553',31:'302e38',33:'574261',36:'662f2e',38:'353634',44:'343136',46:'4f5358',49:'333337',50:'302a3c'}[wave]
  cloth={5:'5f5667',15:'693444',19:'655f62',25:'514855',27:'b9cabd',28:'82664b',29:'665078',30:'423947',34:'655c68',35:'5a3f78',37:'494552',39:'58748f',40:'b9b0a1',42:'423943',45:'3e3647',47:'303337',48:'423947',50:'302a3c'}.get(wave,cloth)
  trim='c29860' if wave not in (16,31,36,44,50) else 'be884b'
 return {'cloth':cloth,'cloth_light':bright(cloth,1.16),'trim':trim,'skin':skin,'skin_light':bright(skin,1.12),'leather':'654b34','dark':'27282c','steel':'8b8b8d','steel_light':'b2afb0','steel_dark':'53545a','gold':'d4a85a','wood':'745034','ivory':'e9d6b1','eyes':'292724','hair':'67412c','copper':'a45c33','red':'a84c3d','moss':'718038','rune':'79cec3','iceblue':'83c6ed','pink':'ac7b8b','orange':'e9913e','purple':'936ac4','riderpurple':'695087','riderarmor':'a79cbe','base':'bd9e76'}

def bright(c,f):return ''.join(f'{min(255,round(int(c[i:i+2],16)*f)):02x}' for i in (0,2,4))

def ragged(b,name,z,width,depth,height,mat,parent):
 n=12;top=b.ring(0,0,z,width,depth,n);bottom=[(width*1.16*math.sin(i*math.tau/n),depth*1.16*math.cos(i*math.tau/n),z-height+(height*.27 if i%2 else 0)) for i in range(n)]
 return b.loft(name,[bottom,top],mat,parent)

def helm(b,head,c,w,h,style='closed',crest=None):
 x,y,z=c;metal='steel_dark' if b.id=='highking' else 'cloth' if b.id in ('kingdomprotector','archangel') else 'steel';dep=w*.73
 # No hidden skin cranium exists under a closed helmet. Square apertures are
 # genuine recesses with opaque inner shadow, all parented to the head joint.
 ell(b,'Helmet solid crown shell',(x,y-.035,z+h*.17),(w*.56,dep*.50,h*.62),metal,head,12,5)
 front=y+dep/2+.046;eye_z=z+h*.11
 # A beveled continuous cheek/chin visor forms the lower faceplate. Its
 # central ridge is part of the metal surface, never a rectangular nose.
 outline=[(x-w*.49,front-.024,z+h*.012),(x+w*.49,front-.024,z+h*.012),(x+w*.44,front-.019,z-h*.35),(x+w*.22,front-.004,z-h*.52),(x-w*.22,front-.004,z-h*.52),(x-w*.44,front-.019,z-h*.35)]
 b.panel('Helmet opaque faceted visor',outline,.058,metal,head,w*.11)
 b.limb('Helmet chin guard',[(x,y,z-h*.25),(x,y,z-h*.48)],[w*.43,w*.32],metal,head,10)
 brow=[(x-w*.50,front-.024,z+h*.20),(x-w*.41,front-.028,z+h*.40),(x,front-.020,z+h*.49),(x+w*.41,front-.028,z+h*.40),(x+w*.50,front-.024,z+h*.20)]
 b.panel('Helmet brow visor ridge',brow,.041,metal,head,w*.047)
 # Two horizontal recesses are bounded by actual brow, cheek and a narrow
 # central ridge; their dark backing stays deeper than the metal lips.
 for side in (-1,1):
  b.panel('Helmet cheek '+str(side),[(x+side*w*.50,front-.032,z+h*.23),(x+side*w*.50,front-.032,z-h*.23),(x+side*w*.35,front-.008,z-h*.24),(x+side*w*.36,front-.008,z+h*.23)],.050,metal,head,.013)
  b.box('Helmet eye square recess',(x+side*w*.235,front-.038,eye_z),(w*.24,.014,h*.14),'eyes',.003,head)
 b.panel('Helmet nose visor bridge',[(x-w*.050,front+.025,z+h*.25),(x+w*.050,front+.025,z+h*.25),(x+w*.042,front+.05,z-h*.045),(x-w*.042,front+.05,z-h*.045)],.030,metal,head,.018)
 b.limb('Helmet contacting armored neck gorget',[(x,y-.015,z-h*.60-.10),(x,y-.01,z-h*.40),(x,y,z-h*.24)],[w*.22,w*.225,w*.26],metal,head,10)
 b.loft('Helmet articulated rounded lower collar',[b.ring(x,y,z-h*.57,w*.31,w*.25,12),b.ring(x,y,z-h*.44,w*.32,w*.255,12)],metal,head)
 if b.id=='host_46':
  for ob in list(b.objects):
   if any(n in ob.name for n in ('Helmet opaque faceted visor','Helmet nose visor bridge','Helmet eye square recess')):b.objects.remove(ob);bpy.data.objects.remove(ob,do_unlink=True)
  b.box('Revenant helmet actual hollow dark opening',(x,front-.052,z-h*.025),(w*.78,.020,h*.52),'dark',.025,head)
  for j in range(3):b.jewel('Revenant visible teal flame inside helmet',(x+(j-1)*w*.20,front-.032,z-h*.10),w*.062,h*.16,w*.032,'rune',head)
 if b.id=='highking' and not crest:crest='fin'
 if crest:
  if crest=='crossbar':
   b.rod('Helmet contacting transverse crest support',(x,y,z+h*.64),(x,y,z+h*.94),.025,'gold',head,8)
   b.box('Helmet transverse crest',(x,y,z+h*.94),(w*.64,.11,.105),'gold',.01,head)
  else:b.box('Helmet fin crest',(x,y-.035,z+h*.79),(.08,dep*.76,h*.40),'cloth',.009,head)
 b.coverage.append({'type':'closed-helmet','shell':'Helmet solid crown shell','hiddenSkinMeshes':0,'rule':'Hidden scalp/skin omitted; opaque visor recess. No skin can protrude.'})

def open_helm(b,head,c,w,h):
 """Metal crown/cheeks/back surround the intentionally exposed front face."""
 x,y,z=c;front=y+w*.34;rear=y-w*.36
 outer=[(-w*.49,-h*.52),(-w*.66,-h*.30),(-w*.66,h*.70),(-w*.43,h*1.05),(w*.43,h*1.05),(w*.66,h*.70),(w*.66,-h*.30),(w*.49,-h*.52)]
 inner=[(-w*.43,-h*.49),(-w*.54,-h*.28),(-w*.54,h*.26),(-w*.42,h*.40),(w*.42,h*.40),(w*.54,h*.26),(w*.54,-h*.28),(w*.43,-h*.49)]
 vs=[(x+xx,front,z+zz) for xx,zz in outer]+[(x+xx,rear,z+zz) for xx,zz in outer]+[(x+xx,front+.009,z+zz) for xx,zz in inner]+[(x+xx,rear+.04,z+zz) for xx,zz in inner]+[(x,rear-.009,z+h*.10)];fs=[]
 for i in range(8):j=(i+1)%8;fs.extend([(i,j,8+j,8+i),(i,16+i,16+j,j),(16+i,24+i,24+j,16+j),(8+i,8+j,32)])
 fs.append(tuple(reversed(range(24,32))));b.mesh('Continuous wrapped hood open steel helmet',vs,fs,'steel_dark',head)
 b.box('Helmet exposed-face center brow plate',(x,front+.023,z+h*.65),(w*.26,.06,h*.61),'steel',.020,head)
 b.coverage.append({'type':'hood','shell':'Continuous wrapped hood open steel helmet','rule':'Visible front face retained; side/top/back enclosed by actual metallic shell; hidden scalp omitted.'})

def hair(b,head,c,w,h,tonsure=False,blonde=False):
 x,y,z=c;mat='ivory' if blonde and b.id in ('elvenking','crownofages') else 'gold' if blonde else 'hair'
 if b.id=='sunward':mat='hair'
 if tonsure:
  # The drawn short face is below a broad rounded cranium. The ring of hair
  # wraps the skull sides instead of sitting as a flat doughnut on the face.
  b.loft('Tonsure wrapped faceted hair ring',[b.ring(x,y,z+w*.23,w*.53,w*.35,12),b.ring(x,y,z+w*.40,w*.54,w*.35,12),b.ring(x,y,z+w*.44,w*.42,w*.29,12)],mat,head)
  ell(b,'Tonsure exposed scalp',(x,y,z+w*.38),(w*.42,w*.30,w*.095),'skin',head,12,3)
 else:
  b.loft('Hair closed faceted cap',[b.ring(x,y-.02,z+h*.23,w*.51,w*.33,10),b.ring(x,y-.02,z+h*.48,w*.52,w*.34,10),b.ring(x,y-.01,z+h*.64,w*.31,w*.24,10)],mat,head)
  leaf(b,'Hair parted fringe',(x-w*.48,y+w*.33,z+h*.35),(x+w*.18,y+w*.37,z+h*.29),w*.13,mat,head)
  if b.id=='sunward':
   for side in (-1,1):
    b.panel('Priest actual warm brown faceted side hair',[(x+side*w*.44,y+w*.23,z+h*.44),(x+side*w*.61,y+.015,z+h*.21),(x+side*w*.64,y+w*.11,z-h*.46),(x+side*w*.45,y+w*.23,z-h*.32)],.095,mat,head,.035)
   b.panel('Priest full warm brown rear hair',[ (x-w*.53,y-w*.27,z+h*.43),(x+w*.53,y-w*.27,z+h*.43),(x+w*.61,y-w*.30,z-h*.43),(x,y-w*.40,z-h*.55),(x-w*.61,y-w*.30,z-h*.43)],.09,mat,head,.055)

def face(b,head,c,w,h,hood=False,enemy=False,tusks=True,ears=False,beard=False,hat=None,helmet=False,crest=None,tonsure=False):
 x,y,z=c
 if helmet:
  helm(b,head,c,w,h,crest=crest);return
 depth=w*.60
 b.box('Observed face',(x,y,z),(w,depth,h),'skin',min(w*.08,.035),head)
 front=y+depth/2+.005
 for side in (-1,1):b.box('Eye '+('R' if side>0 else 'L'),(x+side*w*.235,front+.005,z+h*.10),(w*.13,.014,h*.18),'eyes',.001,head)
 if enemy and tusks:
  b.box('Orc broad jaw',(x,front+.020,z-h*.31),(w*1.04,.105,h*.23),'skin_light',.025,head)
  for side in (-1,1):cone(b,'Ivory tusk',(x+side*w*.35,front+.09,z-h*.24),(x+side*w*.34,front+.075,z-h*.025),w*.063,'ivory',head,4)
 if ears:
  for side in (-1,1):cone(b,'Pointed anatomical ear',(x+side*w*.43,y,z+h*.10),(x+side*w*.94,y-.03,z+h*.47),w*.18,'skin',head,4)
 elif not enemy and not hood:
  for side in (-1,1):b.box('Observed small anatomical ear',(x+side*w*.53,y-.01,z+h*.02),(w*.10,w*.16,h*.37),'skin',.014,head)
 if hood:
  hoodpart=wrapped_hood(b,'Continuous wrapped hood',(x,y-.02,z),w,h,depth*1.19,'cloth',head)
  if not enemy:
   hood_contour_band(b,hoodpart,'Hood fitted integral ivory facing','ivory',head)
   b.panel('Hair fringe entirely within hood aperture',[(x-w*.47,front+.026,z+h*.53),(x+w*.47,front+.026,z+h*.53),(x+w*.43,front+.039,z+h*.41),(x+w*.11,front+.055,z+h*.34),(x-w*.16,front+.05,z+h*.45),(x-w*.44,front+.039,z+h*.36)],.025,'gold' if b.id in ('greenheart','eldergrove') else 'hair',head,.012)
 elif not enemy:hair(b,head,c,w,h,tonsure=tonsure,blonde=b.id in ('dawnspire','elvenking','sunward','crownofages'))
 if hat=='cone':
  b.loft('Wizard hat broad brim',[b.ring(x,y,z+h*.44,w*.82,w*.61,14),b.ring(x,y,z+h*.50,w*.85,w*.63,14),b.ring(x,y,z+h*.54,w*.77,w*.58,14)],'cloth',head)
  b.loft('Wizard pointed cap',[b.ring(x,y,z+h*.48,w*.54,w*.39,12),b.ring(x-w*.025,y-.006,z+h*.86,w*.41,w*.30,12),b.ring(x-w*.07,y-.032,z+h*1.22,w*.25,w*.19,12),b.ring(x-w*.24,y-.09,z+h*1.56,w*.035,w*.03,12)],'cloth',head)
  b.loft('Wizard hat fitted crown band',[b.ring(x,y,z+h*.50,w*.54,w*.40,12),b.ring(x-w*.01,y-.005,z+h*.62,w*.51,w*.38,12)],'trim',head)
  b.jewel('Hat buckle',(x,y+w*.53,z+h*.72),.06,.06,.024,'gold',head)
 if hat=='mitre':
  bottom=z+h*.46;peak=bottom+w*1.32;yy=y+depth*.45
  b.panel('Archbishop high front mitre',[(x-w*.59,yy,bottom),(x-w*.54,yy,bottom+w*.62),(x,yy,peak),(x+w*.54,yy,bottom+w*.62),(x+w*.59,yy,bottom)],depth*.42,'ivory',head,.04)
  b.panel('Archbishop high rear mitre',[(x-w*.59,y-depth*.40,bottom),(x-w*.50,y-depth*.40,bottom+w*.66),(x,y-depth*.40,peak-.015),(x+w*.50,y-depth*.40,bottom+w*.66),(x+w*.59,y-depth*.40,bottom)],depth*.30,'ivory',head,.04)
  for a,q in [((x-w*.58,yy+.042,bottom+.035),(x+w*.58,yy+.042,bottom+.035)),((x,yy+.045,bottom),(x,yy+.045,peak-.04))]:b.rod('Mitre gilded facing',a,q,.033,'gold',head,4)
  for side in (-1,1):b.rod('Mitre diagonal gold edge',(x+side*w*.54,yy+.042,bottom+w*.62),(x,yy+.045,peak-.03),.027,'gold',head,4)
 if hat=='cap':b.loft('Dwarf low faceted red cap',[b.ring(x,y-.02,z+h*.49,w*.56,w*.37,10),b.ring(x,y-.02,z+h*.77,w*.49,w*.32,10),b.ring(x,y-.02,z+h*.93,w*.28,w*.21,10)],'red',head)
 if beard and b.id not in ('royalmarshal','griffinbomber'):
  b.panel('Continuous wedge beard',[(x-w*.43,front+.06,z-h*.10),(x,front+.10,z-h*.23),(x+w*.43,front+.06,z-h*.10),(x+w*.27,front+.07,z-h*.48),(x,front+.12,z-h*.74),(x-w*.28,front+.07,z-h*.48)],.07,'ivory' if b.id=='eldergrove' else 'hair',head,.03)
  if b.id=='eldergrove':
   for side in (-1,1):leaf(b,'Archdruid actual white parted moustache',(x,front+.105,z-h*.05),(x+side*w*.43,front+.13,z-h*.24),w*.11,'ivory',head)
   for j in range(3):leaf(b,'Archdruid layered white beard lock',(x+(j-1)*w*.19,front+.13,z-h*.19),(x+(j-1)*w*.12,front+.14,z-h*(.78+.17*(j==1))),w*.13,'ivory',head)
 if beard and b.id in ('royalmarshal','griffinbomber'):
  for j in (-1,0,1):
   cx=x+j*w*.23;ww=w*(.22 if j else .26);top=z-h*.035;bottom=z-h*(1.06 if j==0 else .82)
   b.panel('Dwarf full copper fivefacet beard lobe',[(cx-ww,front+.065,top),(cx+ww,front+.065,top),(cx+ww*.85,front+.10,bottom+h*.15),(cx,front+.145,bottom),(cx-ww*.85,front+.10,bottom+h*.15)],.080,'copper',head,.038)

def joints(b,shoulder,elbow,hand,side,torso):
 up=b.pivot('upper_arm_'+side,shoulder,torso);fore=b.pivot('forearm_'+side,elbow,up);wrist=b.pivot('hand_'+side,hand,fore);weap=b.pivot('weapon_'+side,hand,wrist)
 return up,fore,wrist,weap

def wrapped_hood(b,name,c,w,h,dep,mat,parent):
 """Peaked outer silhouette measured separately from the low face aperture."""
 x,y,z=c;front=y+dep/2;rear=y-dep/2
 out=[(0,w*.94),(.54*w,w*.61),(.75*w,w*.13),(.72*w,-h*.48),(.54*w,-h*.67),(-.54*w,-h*.67),(-.72*w,-h*.48),(-.75*w,w*.13),(-.54*w,w*.61)]
 aperture=[(0,h*.74),(.43*w,h*.51),(.54*w,h*.24),(.54*w,-h*.44),(.43*w,-h*.58),(-.43*w,-h*.58),(-.54*w,-h*.44),(-.54*w,h*.24),(-.43*w,h*.51)]
 outer=[(x+xx,front,z+zz) for xx,zz in out];back=[(x+xx*.94,rear,z+zz*.91) for xx,zz in out];inner=[(x+xx,front+.005,z+zz) for xx,zz in aperture];cavity=[(xx,rear+.025,zz) for xx,yy,zz in inner]
 n=len(out);vs=outer+back+inner+cavity+[(x,rear-.009,z+.05)];fs=[]
 for i in range(n):j=(i+1)%n;fs.extend([(i,j,n+j,n+i),(i,2*n+i,2*n+j,j),(2*n+i,3*n+i,3*n+j,2*n+j),(n+i,n+j,4*n)])
 fs.append(tuple(reversed(range(3*n,4*n))));ob=b.mesh(name,vs,fs,mat,parent)
 b.coverage.append({'type':'hood','shell':name,'faceAspect':h/w,'outerPeakAboveFace':w*.94,'rule':'Physical thick shell with independently low inner face aperture; hidden scalp omitted'})
 return ob

def hood_contour_band(b,shell,name,mat,parent):
 """Closed band uses the actual shell aperture vertices, with physical overlap."""
 n=9;verts=[v.co.copy() for v in shell.data.vertices];outer=verts[:n];inner=verts[2*n:3*n]
 rim=[inner[i].lerp(outer[i],.23) for i in range(n)]
 front=[tuple(v+Vector((0,.014,0))) for v in rim+inner]
 back=[tuple(v-Vector((0,.009,0))) for v in rim+inner];vs=front+back;fs=[]
 for i in range(n):
  j=(i+1)%n;fs.extend([(i,j,n+j,n+i),(2*n+i,3*n+i,3*n+j,2*n+j),(i,2*n+i,2*n+j,j),(n+i,n+j,3*n+j,3*n+i)])
 return b.mesh(name,vs,fs,mat,parent)

def humanoid(b,row,mounted=False,origin=(0,0,0),scale=1,seat=False,custom=None):
 s=row['spec'];enemy=row['category']=='enemies';kind=s.get('bodyKind','humanoid');wave=s.get('wave',0);custom=custom or {}
 p=row['eyes_front_px'];fw=max(.33,min(.75,(p[2]-p[0])*.0105));fh=fw*(.81 if enemy or s.get('helmet') else .55)
 if mounted:fw=.53 if row['id'] in ('frostblade','roseguard') else .43;fh=fw*(.80 if s.get('helmet') or enemy else .55)
 if custom.get('faceWidth'):fw=custom['faceWidth'];fh=fw*(.81 if enemy else .55)
 source_eye_y=(p[1]+p[3])/2
 # One disclosed physical pixel scale, with front-eye landmark measurements
 # rather than forcing all source heads to one height.
 facez=(410-source_eye_y)*(1.8/352)-fh*.10+fw*.05 if not mounted else .88
 if not enemy and not mounted:fh=fw*FACE_ASPECT.get(b.id,fh/fw)
 if kind=='ogre':fw=max(.43,fw);fh=fw*.84
 compact=s.get('compact') or s.get('europeanMonk');robe=s.get('robe') or wave in (18,23,31,33,44)
 shoulder=facez-fh*.50-.065;belt=.62 if not mounted else .36
 tw=.30 if kind=='humanoid' else .19 if kind=='goblin' else .42 if kind=='troll' else .46
 if not enemy:tw=.30 if not s.get('bulky') else .35
 if compact:tw*=1.16
 if mounted:tw=.27;shoulder=.63;belt=.12
 if custom.get('sourceCompactTorso'):
  tw=.325;shoulder=.59;belt=.18
 if wave==12:fw=.45;fh=.35;facez=.67;shoulder=.45;belt=.29
 ox,oy,oz=origin
 def P(q):return (ox+q[0]*scale,oy+q[1]*scale,oz+q[2]*scale)
 def SZ(q):return tuple(v*scale for v in q)
 torso=b.pivot('torso_pivot',P((0,0,belt)),b.root);head=b.pivot('head_pivot',P((0,0,facez-.15)),torso)
 skinbody=enemy and wave not in (14,18,23,31,33,36,38,41,43,44,46,50)
 bodymat='skin' if skinbody else 'cloth'
 if kind in ('troll','ogre'):
  ell(b,'Faceted species chest',P((0,0,(shoulder+belt)/2)),SZ((tw,.26 if kind=='ogre' else .24,(shoulder-belt)*.68)),bodymat,torso,10,4)
  if kind=='ogre':ell(b,'Potbellied ogre abdomen',P((0,.10,belt+.18)),SZ((tw*1.12,.33,.30)),'skin_light',torso,10,4)
 else:
  b.loft('Tailored continuous bodice',[[P(v) for v in b.ring(0,0,z,w,d,8)] for z,w,d in [(belt-.025,tw*.85,.21),(belt+.12,tw,.23),(shoulder,tw,.23)]],bodymat,torso)
 hem=.14 if robe else .48
 if mounted:hem=.00
 if enemy and not robe:ragged(b,'Leather ragged skirt',oz+(belt-.03)*scale,tw*scale,.18*scale if kind=='goblin' else .24*scale,.17*scale if kind=='goblin' else .23*scale,'leather',torso)
 else:
  garment=[[P(v) for v in b.ring(0,0,z,w,d,10)] for z,w,d in [(hem,tw*1.37,.30),(belt-.04,tw*.90,.21)]]
  if b.id=='stormcitadel':
   # This reference is a footless hovering robe. Its pointed hem is physical;
   # no hidden boots or humanoid legs are added beneath it.
   garment[0]=[P((x,y,.16+.12*abs(x)/(tw*1.37))) for x,y,z in b.ring(0,0,hem,tw*1.37,.30,10)]
  b.loft('Continuous flared garment hem',garment,'cloth',torso)
  if not enemy:
   trimend=.16+.12*.72/1.37+.018 if b.id=='stormcitadel' else hem+.025
   for side in (-1,1):strap(b,'Gilded front garment trim',P((side*tw*.33,.24,belt-.03)),P((side*tw*.72,.29,trimend)),.035*scale,'trim',torso)
 b.loft('Continuous leather waist belt',[[P(v) for v in b.ring(0,0,z,tw*.98,.235,10)] for z in (belt-.045,belt+.04)],'leather',torso)
 b.box('Belt buckle',P((0,.245,belt)),SZ((.12,.055,.095)),'gold' if not enemy else 'steel',.012*scale,torso)
 # Closed helmets suppress the whole skin head, including scalp, at creation.
 openhelmet=wave in (4,10,11,14,22,24,25,35,36,41,42,43,45,47)
 closed=(s.get('helmet',False) and not openhelmet) or wave==46
 hood=s.get('hood',False) or s.get('headShape')=='hood' or b.id in ('greenheart','eldergrove','verdantguard','stormcitadel') or wave in (1,9,12,16,18,23,31,33,38,44,50)
 if s.get('europeanMonk'):hood=False
 if not closed:b.limb('Connected neck inside collar',[P((0,0,shoulder-.005)),P((0,0,facez-fh*.36))],[.10*scale,.115*scale],'skin',head,8)
 # Skin/helmet parts are assembled at full local size, then transformed once.
 before=set(b.objects);face(b,head,(0,0,facez),fw,fh,hood,enemy,wave not in (2,9,12,16,18,24,27,28,34,38,39,44,46,50),s.get('elfEars',False) or kind=='goblin',s.get('beard',False) or b.id=='eldergrove',s.get('hat'),closed,s.get('helmetCrest'),s.get('tonsure',False))
 for ob in set(b.objects)-before:
  if wave==19 and ob.name.startswith('Continuous wrapped hood'):
   ob.data.materials.clear();ob.data.materials.append(b.M['leather'])
  for v in ob.data.vertices:v.co=Vector(P(v.co))
  ob.data.update()
 if openhelmet and wave!=24:
  before=set(b.objects);open_helm(b,head,(0,0,facez),fw,fh)
  for ob in set(b.objects)-before:
   for v in ob.data.vertices:v.co=Vector(P(v.co))
 if s.get('headShape')=='pot':
  b.loft('Cooking pot helmet',[[P(v) for v in b.ring(0,-.03,z,fw*.61,d,10)] for z,d in [(facez+fh*.32,fw*.44),(facez+fh*.90,fw*.37)]],'steel_dark',head)
  for side in (-1,1):annulus(b,'Pot side handle',P((side*fw*.60,-.03,facez+fh*.62)),.07*scale,.015*scale,'steel',head,True,8,4)
 if s.get('crown') and wave!=31:
  before=set(b.objects);crown(b,(0,0,facez+fh*.49),fw,parent=head,points=s.get('crownPoints',5))
  for ob in set(b.objects)-before:
   for v in ob.data.vertices:v.co=Vector(P(v.co))
 if wave in ():
  if not closed:
   b.loft('Open steel helmet crown',[[P(v) for v in b.ring(0,-.03,z,fw*.59,d,8)] for z,d in [(facez+fh*.21,fw*.37),(facez+fh*.66,fw*.34)]],'steel_dark',head)
   b.box('Open helmet brow rim',P((0,fw*.34,facez+fh*.21)),SZ((fw*1.20,.09,.095)),'steel',.01*scale,head)
 # Legs use independent knee/foot pivots and connected volumes.
 legs={}
 for side in (-1,1):
  if b.id=='stormcitadel':continue
  sn='R' if side>0 else 'L';lx=side*(tw*.55);hip=(lx,0,belt-.08);knee=(side*tw*.65,.015,.33);ankle=(side*tw*.69,.035,.13)
  if kind=='goblin':knee=(side*tw*.62,.01,.36);ankle=(side*tw*.83,.02,.10)
  if wave==12:knee=(side*tw*.62,.01,.19);ankle=(side*tw*.83,.02,.10)
  if wave==9:hip=(side*tw*.69,0,belt-.08);knee=(side*tw*1.14,.025,.33);ankle=(side*tw*1.84,.055,.13)
  if seat:
   hip=(side*custom.get('seatHipX',.18),custom.get('seatHipY',0),.04)
   knee=(side*custom.get('seatKneeX',.32),custom.get('seatKneeY',.12),custom.get('seatKneeZ',-.14))
   ankle=(side*custom.get('seatAnkleX',.37),custom.get('seatAnkleY',.09),custom.get('seatAnkleZ',-.28))
  up=b.pivot('upper_leg_'+sn,P(hip));shin=b.pivot('shin_'+sn,P(knee),up);foot=b.pivot('foot_'+sn,P(ankle),shin)
  legs[sn]=up
  r=.12 if kind not in ('goblin','troll','ogre') else .075 if kind=='goblin' else .17
  b.limb('Upper leg '+sn,[P(hip),P(knee)],[r*scale,r*.87*scale],'steel_dark' if wave==46 else 'skin' if enemy else 'cloth',up)
  b.limb('Lower leg '+sn,[P(knee),P(ankle)],[r*.87*scale,r*.72*scale],'steel_dark' if wave==46 else 'skin' if enemy else 'leather',shin)
  ell(b,'Knee contacting articulated joint '+sn,P(knee),SZ((r*.94,r*.95,r*.92)),'steel_dark' if wave==46 else 'skin' if enemy else 'cloth',shin,10,3)
  # Fit the grounded ankle volume inside the existing sole without moving
  # its actual joint center or the anatomical leg chain.
  ankle_rz=min(r*.79,ankle[2]-.006) if b.id in ('host_03','host_06','host_08','host_10','host_17','host_20','host_21','host_32','host_46','host_49') else r*.79
  ell(b,'Ankle contacting boot joint '+sn,P(ankle),SZ((r*.80,r*.81,ankle_rz)),'steel_dark' if wave==46 else 'skin' if enemy else 'leather',foot,10,3)
  bootz=ankle[2]-.045 if seat else .095
  b.box('Grounded boot '+sn,P((ankle[0],.065,bootz)),SZ((r*2.25,.33,.19)),'skin' if wave==33 else 'steel' if closed and not hood else 'leather',.028*scale,foot)
  if s.get('europeanMonk'):
   b.box('Sandal exposed toes '+sn,P((ankle[0],.19,.095)),SZ((.17,.17,.075)),'skin',.014*scale,foot)
  if wave in (2,8,49):
   for j in range(3):cone(b,'Ground claw '+sn,P((ankle[0]+(j-1)*r*.55,.22,.08)),P((ankle[0]+(j-1)*r*.55,.35,.025)),r*.22*scale,'ivory',foot,4)
  if wave==2:
   for j in range(3):b.limb('Thornstrider actual ankle cloth wrap',[P((ankle[0],ankle[1],.12+j*.027)),P((ankle[0],ankle[1],.139+j*.027))],[r*.94*scale]*2,'ivory',shin,6)
 hands={};arms={};weapons={}
 for side in (-1,1):
  sn='R' if side>0 else 'L';sx=side*(tw+.055);hx=side*(tw+.19);hz=.68
  if s.get('longArms'):hx=side*(tw+.32);hz=.28
  if kind=='goblin':hx=side*(tw+.16);hz=.69
  if wave==12:hz=.37
  if mounted:hx=side*.36;hz=.36
  if s.get('weapon') in ('staff','crozier','spear','lance','hammer','axe','cross','ram','cleaver','sword') and side>0:hz=.78 if not mounted else .43
  if wave==12:hz=.41 if side>0 else .34
  if s.get('weapon')=='bow' and side<0:hz=.78
  if s.get('weapon')=='crossbow':hx=side*.15;hz=.82
  if s.get('weapon')=='greatsword':hx=side*.13;hz=.88+side*.08
  if b.id=='highking' and s.get('weapon')=='greatsword':hx=-side*.09;hz=.63+side*.12
  if s.get('weapon')=='bomb':hx=side*.19;hz=.72
  if b.id=='griffinbomber' and s.get('weapon')=='bomb':hx=side*(.43 if side>0 else .41);hz=1.10 if side>0 else .36
  if s.get('europeanMonk'):hz=.84 if side>0 else .68
  if b.id=='dawnspire' and side<0:hz=.93
  sh=(sx,0,shoulder-.02);el=(side*(tw+.14),.06,(shoulder+hz)/2);ha=(hx,.23,hz)
  up,fore,wrist,weap=joints(b,P(sh),P(el),P(ha),sn,torso);hands[sn]=P(ha);arms[sn]=up;weapons[sn]=weap
  r=.115 if not s.get('longArms') else .18
  if kind=='goblin':r=.067
  if kind=='ogre':r=.19
  ell(b,'Connected shoulder '+sn,P(sh),SZ((r*1.30,r*1.28,r*1.17)),bodymat,up,8,3)
  b.limb('Upper arm '+sn,[P(sh),P(el)],[r*scale,r*.97*scale],bodymat,up)
  b.limb('Forearm '+sn,[P(el),P(ha)],[r*.96*scale,r*.79*scale],bodymat,fore)
  ell(b,'Elbow contacting articulated joint '+sn,P(el),SZ((r,r*.99,r)),bodymat,fore,10,3)
  ell(b,'Grasping hand '+sn,P(ha),SZ((r*1.03,r*.92,r*1.03)),'skin' if not closed else 'steel_dark',wrist,8,3)
  if robe and not enemy:b.limb('Broad cuff '+sn,[P((el[0],el[1],el[2]-.02)),P((ha[0],ha[1]-.045,ha[2]-.03))],[r*1.5*scale,r*1.75*scale],'cloth',fore)
  if enemy and not robe:
   cuffa=Vector(el).lerp(Vector(ha),.74);cuffb=Vector(el).lerp(Vector(ha),.91);b.limb('Leather wrist cuff '+sn,[P(cuffa),P(cuffb)],[r*1.08*scale,r*.93*scale],'leather',fore)
  if wave in (8,49):
   for j in range(3):cone(b,'Troll actual long ivory finger claw',P((ha[0]+(j-1)*.082,ha[1]+.06,ha[2]-.01)),P((ha[0]+(j-1)*.096,ha[1]+.13,ha[2]-.28)),.045*scale,'ivory',wrist,5)
   if wave==8:
    for j in range(2):b.jewel('Actual teal regeneration arm shard',P((ha[0]+side*.07,.14,(el[2]+ha[2])/2+j*.17)),.06*scale,.10*scale,.039*scale,'rune',fore)['visualCue']='regen'
  if wave==21:
   for j in range(3):
    aa=Vector(el).lerp(Vector(ha),j*.28);bb=aa+Vector((side*.08,-.015,-.21));b.rod('Root troll actual bark forearm branch',P(aa),P(bb),.057*scale,'wood',fore,5);ell(b,'Root troll arm moss',P(aa+Vector((0,.06,.02))),SZ((.082,.08,.06)),'moss',fore,5,2)
 ctx={'P':P,'SZ':SZ,'head':head,'torso':torso,'facez':facez,'fw':fw,'fh':fh,'shoulder':shoulder,'belt':belt,'tw':tw,'hands':hands,'arms':arms,'weapons':weapons,'legs':legs,'scale':scale,'enemy':enemy,'mounted':mounted}
 decoration(b,row,ctx);equipment(b,row,ctx)
 if wave in (4,10,20,36,41):
  from geometric_enemy_equipment_final_v1 import apply_source_equipment_final
  apply_source_equipment_final(b,row,ctx)
 if b.id in ('rimewatch','greenheart','royalranger'):
  from geometric_champion_fit_v3 import apply_source_fit_v3
  apply_source_fit_v3(b,row,ctx)
 if not hasattr(b,'humanContexts'):b.humanContexts=[]
 b.humanContexts.append(ctx)
 return ctx

def decoration(b,row,c):
 s=row['spec'];wave=s.get('wave',0);P=c['P'];SZ=c['SZ'];tor=c['torso'];head=c['head'];fz=c['facez'];fw=c['fw'];tw=c['tw'];belt=c['belt'];sh=c['shoulder'];scale=c['scale']
 cloak='long' if b.id=='kingdomprotector' else s.get('cloak')
 if cloak:
  width=tw*1.55;bottom=.16 if cloak in ('long','split') else .42
  outline=[(-tw,-.255,sh),(-width,-.30,bottom+.08),(-.08,-.35,bottom),(0,-.36,bottom+.22),(.08,-.35,bottom),(width,-.30,bottom+.08),(tw,-.255,sh)] if cloak=='split' else [(-tw,-.255,sh),(-width,-.31,bottom),(width,-.31,bottom),(tw,-.255,sh)]
  b.panel('Real rear cape',[P(q) for q in outline],.036*scale,'cloth',tor,.016*scale)
  for side in (-1,1):b.panel('Shoulder folded cape',[P(q) for q in [(side*.04,.235,sh+.035),(side*tw*1.34,.04,sh+.015),(side*tw*1.19,.30,sh-.10)]],.035*scale,'trim' if not c['enemy'] else 'leather',c['arms']['R' if side>0 else 'L'],.017*scale)
 if s.get('shoulderShape') in ('leaf','wide') or b.id in ('greenheart','eldergrove','elvenking') or wave==7:
  for side in (-1,1):
   for j in range(3):leaf(b,'Layered leaf shoulder',P((side*tw*.56,.08,sh+.045)),P((side*(tw+.17+j*.04),.14,sh-.10-j*.065)),.07*scale,'moss' if c['enemy'] else 'cloth_light',c['arms']['R' if side>0 else 'L'])
 armor=bool(s.get('helmet') or s.get('armorPlates') or wave in (4,10,11,13,14,22,24,36,41,43,46))
 if armor:
  b.box('Breastplate fitted shell',P((0,.24,(sh+belt)/2)),SZ((tw*1.68,.08,(sh-belt)*.69)),'steel_dark' if b.id=='highking' or wave==50 else 'steel',.026*scale,tor)
  for side in (-1,1):
   arm=c['arms']['R' if side>0 else 'L'];ell(b,'Shoulder plate '+str(side),P((side*(tw+.025),.018,sh+.027)),SZ((.18,.23,.115)),'steel_dark' if b.id=='highking' or wave==50 else 'steel',arm,6,3)
   if s.get('shoulderShape')=='spike' or wave in (14,36,46):cone(b,'Armor shoulder spike',P((side*(tw+.07),0,sh+.08)),P((side*(tw+.23),-.04,sh+.30)),.068*scale,'steel_dark',arm,4)
  for side in (-1,1):b.box('Fitted knee armor '+str(side),P((side*tw*.65,.14,.34)),SZ((.23,.07,.16)),'steel',.016*scale,bpy.data.objects.get('shin_'+('R' if side>0 else 'L')))
 if c['enemy']:
  strap(b,'Crossed leather baldric R',P((tw*.69,.27,sh)),P((-tw*.65,.27,belt+.015)),.095*scale,'leather',tor)
  if wave not in (8,23,33,49):strap(b,'Crossed leather baldric L',P((-tw*.69,.26,sh)),P((tw*.65,.26,belt+.015)),.095*scale,'leather',tor)
 if s.get('halo') and b.id!='sunward':
  annulus(b,'Genuine hollow halo',P((0,0,fz+c['fh']*.89)),fw*.58*scale,.025*scale,'gold',head,False,12,4)
 if s.get('antlers') or wave==20:
  count=s.get('antlerBranches',3);height=.38 if count>2 else .24
  for side in (-1,1):
   pts=[(side*fw*.32,-.08,fz+fw*.55),(side*fw*.66,-.08,fz+fw*.89),(side*fw*.82,-.09,fz+fw*.89+height)]
   b.limb('Branched antler main',[P(q) for q in pts],[.045*scale,.040*scale,.022*scale],'ivory' if wave==20 else 'wood',head,6)
   for j in range(count):b.rod('Antler side fork',P((side*fw*(.57+.09*j),-.08,fz+fw*.88+height*j/count)),P((side*fw*(.84+.06*j),-.07,fz+fw*.88+height*(j+.8)/count)),.041*scale,'ivory' if wave==20 else 'wood',head,5)
 quivercount=4 if b.id=='elvenking' else s.get('quiverCount',0)
 if quivercount:
  qpos=(tw*1.18,-.43,sh-.06) if b.id=='elvenking' else (tw*.58,-.34,sh-.06)
  b.limb('Real back quiver',[P((qpos[0],qpos[1],qpos[2]-.32)),P((qpos[0]+.11,qpos[1],qpos[2]+.19))],[.105*scale,.115*scale],'leather',tor)
  for j in range(quivercount):
   x=qpos[0]+(j-(quivercount-1)/2)*.045;yy=qpos[1]-.02
   b.rod('Separate quiver arrow shaft',P((x,yy,sh-.06)),P((x+.09,yy,sh+.40)),.014*scale,'ivory',tor,5);cone(b,'Quiver arrow broad fletch',P((x+.065,yy,sh+.22)),P((x+.10,yy,sh+.40)),.045*scale,'ivory' if b.id=='elvenking' else 'trim',tor,4)
 if s.get('chestMark'):
  mark=s['chestMark'];pos=P((0,.30,(sh+belt)/2+.05))
  if mark in ('cross','stole'):
   b.box('Chest cross vertical',pos,SZ((.055,.035,.23)),'gold',.008*scale,tor);b.box('Chest cross horizontal',P((0,.32,(sh+belt)/2+.085)),SZ((.20,.03,.055)),'gold',.006*scale,tor)
  elif mark=='lion':lion(b,pos,.115*scale,tor)
  else:b.jewel('Signature chest '+mark,pos,.10*scale,.13*scale,.045*scale,'gold',tor)
  if mark=='stole':
   for side in (-1,1):strap(b,'Archbishop full length gilded stole',P((side*.13,.288,sh)),P((side*.18,.30,.18)),.070*scale,'gold',tor)
 if b.id in ('greenheart','eldergrove'):
  for side in (-1,1):
   for j in range(4):leaf(b,'Druid overlapping leaf robe tier',P((side*.07,.27,sh-.08-j*.17)),P((side*(.30+j*.015),.29,max(.12,sh-.30-j*.17))),.09*scale,'cloth_light',tor)
 if b.id=='elvenking':
  for side in (-1,1):b.loft('Elven king broad long ivory hair',[[P(v) for v in b.ring(side*fw*.51,-.04,z,.105,.14,6)] for z in (fz+c['fh']*.33,sh-.17)],'ivory',head)
  b.panel('Elven king flowing ivory rear hair',[P(q) for q in [(-fw*.45,-.20,fz+c['fh']*.28),(fw*.45,-.20,fz+c['fh']*.28),(fw*.44,-.29,sh-.11),(0,-.33,sh-.25),(-fw*.44,-.29,sh-.11)]],.09*scale,'ivory',head,.035*scale)
  b.jewel('Elven crown green royal stone',P((0,fw*.47,fz+c['fh']*.72)),.07*scale,.10*scale,.035*scale,'moss',head)
 if b.id=='griffinbomber':
  b.box('Dwarf pilot actual silver forehead goggles band',P((0,fw*.34,fz+c['fh']*.38)),SZ((fw*.95,.055,.067)),'steel_light',.007*scale,head)
  for side in (-1,1):
   annulus(b,'Dwarf pilot actual silver round goggles',P((side*fw*.23,fw*.38,fz+c['fh']*.34)),.052*scale,.014*scale,'steel_light',head,True,8,4)
   ell(b,'Dwarf pilot dark glass goggles lens',P((side*fw*.23,fw*.401,fz+c['fh']*.34)),SZ((.041,.012,.040)),'dark',head,8,2)
 if b.id=='crownofages':
  for side in (-1,1):b.loft('Royal flowing ivory side hair',[[P(v) for v in b.ring(side*fw*.49,-.03,z,.10,.13,6)] for z in (fz+c['fh']*.29,sh-.05)],'ivory',head)
  b.jewel('King actual purple crown jewel',P((0,fw*.46,fz+c['fh']*.72)),.075*scale,.11*scale,.038*scale,'purple',head)
 if b.id=='dawnspire':
  for zz in ((sh+belt)/2+.07,belt):b.jewel('Angel source blue chest and belt jewel',P((0,.31,zz)),.067*scale,.10*scale,.042*scale,'iceblue',tor)
 if b.id=='royalranger':
  b.loft('Royal ranger blue beret cap',[[P(v) for v in b.ring(-.07,-.02,z,w,d,10)] for z,w,d in [(fz+c['fh']*.38,fw*.62,fw*.39),(fz+c['fh']*.60,fw*.60,fw*.36),(fz+c['fh']*.83,fw*.45,fw*.31)]],'cloth',head)
 if b.id=='sunward':
  pp=P((0,-.10,fz+c['fh']*.58));annulus(b,'Priest sun headband vertical halo',pp,fw*.63*scale,.025*scale,'gold',head,True,12,4);rays(b,'Priest solar headband',pp,fw*.63*scale,head)
  pp=P((0,.282,sh-.19));ell(b,'Priest large golden chest sundisk',pp,SZ((.088,.025,.088)),'gold',tor,10,2)
  for j in range(8):
   a=j*math.tau/8;cone(b,'Priest chest sun eight rays',P((math.sin(a)*.06,.285,sh-.19+math.cos(a)*.06)),P((math.sin(a)*.135,.285,sh-.19+math.cos(a)*.135)),.028*scale,'gold',tor,4)
  b.jewel('Priest gold diamond belt clasp',P((0,.268,belt)),.08*scale,.105*scale,.035*scale,'gold',tor)
 if s.get('backpack')=='twinCylinders':
  for side in (-1,1):b.limb('Twin backpack cylinder',[P((side*.23,-.30,sh-.25)),P((side*.34,-.32,sh+.22))],[.095*scale,.095*scale],'steel_dark',tor,8);annulus(b,'Backpack brass rim',P((side*.34,-.32,sh+.22)),.095*scale,.018*scale,'gold',tor)
 if s.get('europeanMonk'):
  annulus(b,'Monk rope cincture',P((0,0,belt)),tw*1.01*scale,.024*scale,'ivory',tor,False,16,4)
  for side in (-1,1):b.rod('Monk dangling rope',P((-.14+side*.025,.27,belt)),P((-.14+side*.035,.33,.27+side*.025)),.023*scale,'ivory',tor,6);ell(b,'Monk rope terminal knot',P((-.14+side*.035,.33,.27+side*.025)),SZ((.036,.032,.045)),'ivory',tor,6,3)
  b.panel('Monk folded down hood',[P(q) for q in [(-tw,-.24,sh+.08),(tw,-.24,sh+.08),(0,-.40,sh-.25)]],.06*scale,'cloth',tor,.03*scale)
  for side in (-1,1):b.panel('Monk folded front collar',[P(q) for q in [(0,.29,sh-.12),(side*tw*.94,.11,sh+.04),(side*tw*.60,.29,sh-.09)]],.040*scale,'cloth_light',tor,.015*scale)
 if s.get('headShape')=='crocodile':
  b.box('Crocodile upper skull',P((0,.18,fz+c['fh']*.54)),SZ((fw*1.42,.66,.19)),'ivory',.055*scale,head)
  for side in (-1,1):
   for j in range(4):
    yy=-.01+j*.165;zz=fz+c['fh']*.54-.086
    cone(b,'Crocodile externally visible hanging jaw tooth',P((side*fw*.61,yy,zz)),P((side*fw*.61,yy+.009,zz-.12)),.026*scale,'ivory',head,4)
  ell(b,'Marsh hunter faceted skull roof',P((0,-.025,fz+c['fh']*.65)),SZ((fw*.69,.37,.20)),'ivory',head,8,3)
  for side in (-1,1):
   b.box('Marsh skull authentic externally visible side socket',P((side*(fw*.72+.016),-.035,fz+c['fh']*.60)),SZ((.014,.14,.09)),'dark',.012*scale,head)
   b.box('Marsh skull frontal snout nostril',P((side*fw*.14,.519,fz+c['fh']*.54)),SZ((.025,.012,.025)),'dark',.004*scale,head)
  for side in (-1,1):
   for j in range(5):leaf(b,'Actual layered marsh cloak reed leaf',P((side*.045,-.315,sh-.05-j*.13)),P((side*(.30+j*.025),-.31,sh-.25-j*.13)),.09*scale,'moss',tor)
 if wave in (13,15):
  caprings=[(fz+c['fh']*.44,.58,.41),(fz+c['fh']*.67,.57,.40),(fz+c['fh']*.86,.31,.24)] if wave==13 else [(fz+c['fh']*.26,.54,.38),(fz+c['fh']*.56,.55,.39),(fz+c['fh']*.72,.31,.30)]
  b.loft('Red braided orc full faceted hair cap',[[P(v) for v in b.ring(0,-.025,z,fw*w,fw*d,10)] for z,w,d in caprings],'red',head)
  if wave==13:
   b.panel('Huntress visible full red rear scalp hair',[P(q) for q in [(-fw*.55,-fw*.36,fz+c['fh']*.64),(fw*.55,-fw*.36,fz+c['fh']*.64),(fw*.57,-fw*.37,fz-c['fh']*.26),(0,-fw*.41,fz-c['fh']*.49),(-fw*.57,-fw*.37,fz-c['fh']*.26)]],.035*scale,'red',head,.025*scale)
   for side in (-1,1):b.panel('Huntress substantial red side hair',[P(q) for q in [(side*fw*.55,-fw*.35,fz+c['fh']*.61),(side*fw*.55,fw*.24,fz+c['fh']*.48),(side*fw*.55,fw*.23,fz-c['fh']*.16),(side*fw*.55,-fw*.35,fz-c['fh']*.31)]],.035*scale,'red',head,.02*scale)
  for side in (-1,1):b.limb('Red braid',[P((side*fw*.50,0,fz+.18)),P((side*fw*.53,.08,fz-.10)),P((side*fw*.58,.10,sh-.13))],[.07*scale,.065*scale,.045*scale],'red',head,6)
  for side in (-1,1):
   for j in range(4):ell(b,'Red braid separate woven knot',P((side*fw*.54,.083,fz+.10-j*.13)),SZ((.08,.07,.081)),'red',head,6,2)
 if wave in (6,21,49):
  random.seed(wave)
  for j in range(20 if wave!=49 else 9):
   a=j*math.tau/(20 if wave!=49 else 9);x=math.sin(a)*tw*1.08;y=math.cos(a)*.27-.06;z=sh+.13+random.random()*.07
   if wave==49:ell(b,'Obsidian overlapping carapace',P((x,y,z)),SZ((.15,.18,.17)),'steel_dark',tor,5,3)
   else:ell(b,'Moss shoulder cluster',P((x,y,z)),SZ((.10,.11,.075)),'moss',tor,5,2)
  if wave==6:
   for j in range(3):b.jewel('Runestone back',P(((j-1)*.25,-.23,sh+.23+(j==1)*.23)),.13*scale,.22*scale,.10*scale,'steel',tor)
   for j in range(5):
    x=(j-2)*.19;b.rod('Mushroom stalk',P((x,-.12,sh+.17)),P((x,-.12,sh+.31+(j%2)*.08)),.025*scale,'ivory',tor,6);ell(b,'Mushroom hexagonal cap',P((x,-.12,sh+.32+(j%2)*.08)),SZ((.09,.085,.04)),'base',tor,6,2)
  if wave==21:
   for side in (-1,1):
    for j in range(3):b.rod('Root bark branching back',P((side*(.12+j*.10),-.29,sh-.17)),P((side*(.16+j*.12),-.35,sh+.37+j*.08)),.045*scale,'wood',tor,5);leaf(b,'Root new shoot',P((side*(.16+j*.12),-.34,sh+.35+j*.08)),P((side*(.24+j*.12),-.34,sh+.46+j*.08)),.04*scale,'moss',tor)
 if s.get('pouch'):
  for side in (-1,1) if s.get('pouchCount')==2 else [1]:ell(b,'Heavy attached loot pouch',P((side*(tw+.10),-.03,belt-.09)),SZ((.16,.17,.23)),'gold' if wave==16 else 'leather',tor,7,3)
 if wave==20:
  for j in range(2):skull(b,P((.22+(j-.5)*.18,-.26,sh+.24+j*.07)),.105*scale,tor)
 if wave==1:
  xx=max(tw+.29,fw*.75+.18)
  for j in range(2):skull(b,P((xx+j*.23,.025,sh+.56-j*.14)),(.145 if j==0 else .115)*scale,c['arms']['R'])
  b.limb('Scavenger actual two-skull shoulder tray',[P((xx-.15,.035,sh+.40)),P((xx+.36,.035,sh+.24))],[.065*scale,.065*scale],'leather',c['arms']['R'],4)
 if wave==1:
  ell(b,'Scavenger actual heavy rear sack',P((.17,-.42,(sh+belt)/2+.03)),SZ((.29,.20,.34)),'leather',tor,8,4);skull(b,P((0,.30,belt)),.080*scale,tor)
 if wave==3:
  for side in (-1,1):
   pp=P((side*(tw+.045),.03,belt-.06));annulus(b,'Ogre actual hanging iron frying pan rim',pp,.145*scale,.023*scale,'steel',tor,True,12,4);ell(b,'Frying pan concave shadow bowl',(pp[0],pp[1]-.008,pp[2]),SZ((.125,.012,.125)),'steel_dark',tor,10,2);b.rod('Pan belt leather handle',P((side*(tw+.045),.03,belt+.21)),P((side*(tw+.045),.03,belt+.045)),.026*scale,'steel_dark',tor,5)
 if wave==4:
  b.box('Actual crooked scrap backpack',P((.11,-.35,sh-.13)),SZ((.48,.28,.57)),'wood',.024*scale,tor);gear(b,'Scrap helmet actual gear',P((fw*.58,.01,fz+c['fh']*.99)),.14*scale,'steel_dark',head)
  for side in (-1,1):
   for j in range(3):ell(b,'Scrap armor visible stud',P((side*(tw*.62),.302,sh-.10-j*.11)),SZ((.025,.018,.026)),'steel_dark',tor,5,2)
 if wave==11:skull(b,P((tw+.09,.09,sh+.13)),.15*scale,c['arms']['R'])
 if wave==16:
  yy=fw*.35;b.panel('Ash pickpocket full copper faceted mask',[P(q) for q in [(-fw*.48,yy,fz),(-fw*.43,yy,fz+c['fh']*.32),(0,yy+.06,fz+c['fh']*.61),(fw*.43,yy,fz+c['fh']*.32),(fw*.48,yy,fz),(0,yy+.06,fz-c['fh']*.61)]],.037*scale,'gold',head,.035*scale)
  for side in (-1,1):b.box('Copper mask square shadow eye',P((side*fw*.22,yy+.085,fz+c['fh']*.12)),SZ((fw*.15,.013,c['fh']*.23)),'dark',.002*scale,head)
 if wave==26:
  for j in range(7):
   a=(j-3)*.45;pp=P((math.sin(a)*.34,math.cos(a)*.26,sh+.09-abs(j-3)*.01));b.box('Actual wide runic collar plate',pp,SZ((.17,.15,.17)),'steel_dark',.022*scale,tor)
   if j in (1,3,5):b.jewel('Runic collar large golden ward',(pp[0],pp[1]+.09*scale,pp[2]),.055*scale,.071*scale,.017*scale,'gold',tor)
  skull(b,P((0,.30,belt)),.09*scale,tor)
 if wave==43:
  for side in (-1,1):lantern(b,P((side*.38,-.04,sh+.27)),.19*scale,tor)
 if wave==32:
  # Actual open rib cage surrounds the lantern, never a glowing painted chest.
  for ob in list(b.objects):
   if 'Faceted species chest' in ob.name:b.objects.remove(ob);bpy.data.objects.remove(ob,do_unlink=True)
   elif 'Crossed leather baldric' in ob.name:
    for v in ob.data.vertices:v.co.y=-abs(v.co.y)-.08*scale
  ell(b,'Soul drinker solid rear torso behind open frontal ribs',P((0,-.16,(sh+belt)/2)),SZ((tw*.97,.13,(sh-belt)*.62)),'skin',tor,10,4)
  for side in (-1,1):strap(b,'Soul drinker frontal harness beside chest opening',P((side*.32,.20,sh)),P((side*.30,.22,belt+.055)),.09*scale,'leather',tor)
  for side in (-1,1):
   b.rod('Open ribcage side spine',P((side*.24,-.10,belt+.03)),P((side*.24,-.10,sh)),.075*scale,'skin',tor,6)
   for j in range(4):b.limb('Separate open ivory rib',[P((side*.26,-.04,sh-j*.10)),P((side*.25,.18,sh-j*.10-.015)),P((side*.10,.29,sh-j*.10-.035))],[.035*scale]*3,'ivory',tor,5)
  lantern(b,P((0,.27,(sh+belt)/2)),.14*scale,tor)
 if wave in (11,20):
  for j in range(5):annulus(b,'Actual linked belt chain',P((-.07+(j%2)*.045,.30,belt-j*.045)),.043*scale,.013*scale,'steel',tor,True,8,4)
 if wave in (10,22,30):
  for side in (-1,1):
   pts=[]
   for j in range(6):
    a=j*math.pi*.29;pts.append(P((side*(fw*.45+.17*math.sin(a)),-.035,fz+c['fh']*.52+.18*math.cos(a))))
   b.limb('Curved segmented ram horn',pts,[.095*scale-j*.010*scale for j in range(6)],'wood' if wave in (22,30) else 'ivory',head,5)
 if wave==12:
  # Bell is a thick closed metal shell with a genuine empty flared mouth.
  n=10;zc=sh+.14;outer=[b.ring(0,-.28,zc,.48,.38,n),b.ring(0,-.28,zc+.69,.30,.25,n)];inner=[b.ring(0,-.28,zc+.02,.44,.34,n),b.ring(0,-.28,zc+.64,.26,.21,n)];vs=[P(q) for ring in outer+inner for q in ring];fs=[]
  for j in range(n):
   k=(j+1)%n;fs.extend([(j,k,n+k,n+j),(2*n+j,3*n+j,3*n+k,2*n+k),(j,2*n+j,2*n+k,k),(n+j,n+k,3*n+k,3*n+j)])
  b.mesh('Cracked temple bell genuine hollow shell',vs,fs,'gold',tor);annulus(b,'Bell top suspension handle',P((0,-.28,zc+.74)),.095*scale,.028*scale,'wood',tor,True,8,4)
  b.panel('Bell dark crack', [P(q) for q in [(-.015,-.035,zc+.46),(.032,-.033,zc+.32),(-.025,.008,zc+.17),(.030,.008,zc)]],.006*scale,'dark',tor)
 if wave==17:
  b.rod('Tall cursed totem actual trunk',P((.16,-.31,belt)),P((.16,-.31,sh+.68)),.078*scale,'wood',tor,6)
  for j in range(3):skull(b,P((.16,-.31,sh+.17+j*.20)),.13*scale,tor)
 if wave==20:
  for j in range(7):
   a=(j-3)*.23;b.limb('Mammoth crown curved rib',[P((math.sin(a)*.30,-.16,fz+.14)),P((math.sin(a)*.45,-.12,fz+.41)),P((math.sin(a)*.43,-.06,fz+.67))],[.037*scale,.028*scale,.019*scale],'ivory',head,5)
  b.box('Bone throne genuine rear seat',P((0,-.39,sh+.05)),SZ((.60,.12,.65)),'wood',.018*scale,tor)
  for side in (-1,1):b.rod('Bone throne tall rear post',P((side*.32,-.42,belt)),P((side*.32,-.42,sh+.61)),.045*scale,'ivory',tor,6)
 if wave==23:
  for j in range(3):
   p=P(((j-1)*.36,.02,fz+.30+(.15 if j==1 else 0)));b.jewel('Separate floating ivory soul face mask',p,.10*scale,.18*scale,.036*scale,'ivory',b.root)
   for side in (-1,1):b.box('Floating mask square eye',(p[0]+side*.035*scale,p[1]+.036*scale,p[2]+.01*scale),SZ((.025,.013,.035)),'eyes',.001,b.root)
 if wave==24:
  # Living iron frame surrounds the real pilot face with an actual opening.
  for side in (-1,1):b.box('Pilot frame side',P((side*(fw*.63),.01,fz)),SZ((.12,.49,c['fh']*1.35)),'wood',.018*scale,head)
  for zz in (-1,1):b.box('Pilot frame rim',P((0,.01,fz+zz*c['fh']*.64)),SZ((fw*1.43,.49,.105)),'steel',.012*scale,head)
  for j in range(3):
   for k in range(3):b.box('Riveted mutant chest plate',P(((j-1)*.14,.29,(sh+belt)/2+(k-1)*.13)),SZ((.125,.05,.12)),'steel',.005*scale,tor)
 if wave==9:
  yy=fw*.36+.022
  b.panel('Dust dancer actual brown lower face mask',[P(q) for q in [(-fw*.48,yy,fz-c['fh']*.04),(fw*.48,yy,fz-c['fh']*.04),(fw*.40,yy+.025,fz-c['fh']*.48),(0,yy+.055,fz-c['fh']*.78),(-fw*.40,yy+.025,fz-c['fh']*.48)]],.035*scale,'leather',head,.020*scale)
 if wave in (18,38):
  b.box('Lower cloth face mask',P((0,fw*.33,fz-c['fh']*.23)),SZ((fw*.90,.045,c['fh']*.34)),'red' if wave==38 else 'leather',.012*scale,head)
  if wave==18:
   for j in range(5):b.rod('Mask stitched mouth',P((-.12+j*.06,fw*.36,fz-c['fh']*.17)),P((-.12+j*.06,fw*.36,fz-c['fh']*.29)),.007*scale,'ivory',head,4)
 if wave==31:
  for side in (-1,1):leaf(b,'Twin long hood upward point',P((side*fw*.38,-.08,fz+c['fh']*.58)),P((side*fw*.46,-.09,fz+c['fh']*1.64)),.12*scale,'cloth',head)
  seals=b.pivot('refraction_shards',P((0,.32,sh-.10)),tor)
  for j in range(3):b.jewel('Distinct order protective seal',P((0,.32,sh-.10-j*.20)),.065*scale,.080*scale,.033*scale,'gold',seals)['visualCue']='refraction'
  for side in (-1,1):
   skull(b,P((side*.28,.20,sh+.055)),.063*scale,c['arms']['R' if side>0 else 'L']);strap(b,'Inquisitor actual parchment shoulder seal',P((side*.28,.235,sh)),P((side*.28,.245,sh-.30)),.068*scale,'ivory',tor)
  for side in (-1,1):strap(b,'Inquisitor long golden robe facing',P((side*.14,.255,belt)),P((side*.23,.31,.15)),.024*scale,'gold',tor)
  for side in (-1,1):b.rod('Inquisitor real gold hood aperture trim',P((side*fw*.53,fw*.39,fz-c['fh']*.40)),P((side*fw*.53,fw*.39,fz+c['fh']*.23)),.025*scale,'gold',head,4);b.rod('Inquisitor angled golden forehead trim',P((side*fw*.53,fw*.39,fz+c['fh']*.23)),P((0,fw*.39,fz+c['fh']*.74)),.025*scale,'gold',head,4)
 if wave in (33,46):
  for ob in list(b.objects):
   if any(n in ob.name for n in ('Faceted species chest','Potbellied ogre abdomen','Tailored continuous bodice','Connected neck inside collar')):b.objects.remove(ob);bpy.data.objects.remove(ob,do_unlink=True)
  for side in (-1,1):b.box('Separated phantom armor upper chest plate',P((side*tw*.45,.06,(sh+belt)/2+.10)),SZ((tw*.75,.38,(sh-belt)*.46)),'steel_dark' if wave==46 else 'cloth',.022*scale,tor)
  b.limb('Phantom contacting physical armor neck collar',[P((0,0,(sh+belt)/2+.12)),P((0,0,sh+.025)),P((0,0,fz-c['fh']*.29))],[.14*scale,.135*scale,.12*scale],'steel_dark' if wave==46 else 'cloth',head,10)
  for j in range(3):
   pp=((j-1)*tw*.63,.36,(sh+belt)/2+.08-.06*(j==1)) if wave==46 else ((j-1)*.11,.12,belt+.10+.10*(j==1))
   b.jewel('Visible suspended ghost core',P(pp),(.115 if wave==46 and j==1 else .060 if wave==46 else .043)*scale,(.17 if wave==46 and j==1 else .11 if wave==46 else .093)*scale,(.07 if wave==46 and j==1 else .045 if wave==46 else .037)*scale,'rune',tor)
  if wave==46:
   for j in range(4):b.jewel('Hollow revenant actual teal waist soul flame',P(((j-1.5)*.10,.30,belt+.09)),.057*scale,.115*scale,.047*scale,'rune',tor)
 if wave==44:
  # A metal face guard has two legitimate eye openings, not an exposed whole
  # green face. The existing wrapped cowl still protects sides/top/back.
  yy=fw*.36+.036;hh=c['fh']
  b.box('Ash executioner opaque metal lower face guard',P((0,yy,fz-hh*.29)),SZ((fw*.96,.075,hh*.47)),'steel_dark',.015*scale,head)
  b.box('Ash executioner opaque metal upper face guard',P((0,yy,fz+hh*.40)),SZ((fw*.96,.075,hh*.28)),'steel_dark',.015*scale,head)
  b.box('Ash executioner opaque metal nose bridge',P((0,yy+.008,fz+hh*.095)),SZ((fw*.21,.086,hh*.38)),'steel_dark',.011*scale,head)
  for side in (-1,1):b.box('Ash executioner opaque metal side eye guard',P((side*fw*.425,yy,fz+hh*.07)),SZ((fw*.15,.075,hh*.48)),'steel_dark',.012*scale,head)
  b.jewel('Ash executioner long ivory forehead blade',P((0,yy+.053,fz+hh*.70)),.075*scale,.25*scale,.035*scale,'ivory',head)
 if wave==34:skull(b,P((0,fw*.34,fz+.02)),.19*scale,head)
 if wave==14:
  shards=b.pivot('refraction_shards',P((0,0,fz+.23)))
  for j in range(3):b.jewel('Three separate silver mirror protections',P(((j-1)*.36,0,fz+.37+(.22 if j==1 else 0))),.075*scale,.14*scale,.06*scale,'steel_light',shards)['visualCue']='refraction'
 if wave==49:
  for tier in range(5):
   for j in range(5):
    xx=(j-2)*tw*.46;zz=sh+.22-tier*.19;yy=-.30-.035*abs(j-2)
    ell(b,'Greatmaw full overlapping rear obsidian carapace',P((xx,yy,zz)),SZ((tw*.30,.16,.145)),'steel_dark',tor,6,3)
    if (tier+j)%2==0:cone(b,'Greatmaw rear carapace actual broad spike',P((xx,yy-.11,zz+.02)),P((xx,yy-.24,zz+.16)),.085*scale,'steel_dark',tor,5)
  b.box('Belly second maw recess',P((0,.285,belt+.27)),SZ((.59,.045,.30)),'dark',.025*scale,tor)
  b.jewel('Belly soul glow',P((0,.329,belt+.26)),.105*scale,.13*scale,.07*scale,'rune',tor)
  for j in range(6):
   for top in (True,False):cone(b,'Maw ivory tooth',P((-.235+j*.094,.34,belt+.42 if top else belt+.12)),P((-.235+j*.094,.36,belt+.31 if top else belt+.23)),.030*scale,'ivory',tor,4)
 if s.get('magicRune'):
  for j in range(3 if wave==26 else 1):b.jewel('Magic immunity embedded rune',P(((j-1)*.16 if wave==26 else 0,.315,(sh+belt)/2+.10)),.04*scale,.066*scale,.018*scale,'orange',tor)['visualCue']='magicImmune'
 if s.get('crystals') and b.id in ('tempest','stormcitadel'):
  if b.id=='tempest':
   for x,y,z,mat in [(.27,.14,fz+.55,'iceblue'),(-.44,.14,fz+.55,'iceblue'),(-.74,.14,fz+.22,'purple'),(-.64,.25,fz-.21,'orange'),(.64,-.20,fz-.28,'moss')]:
    b.jewel('Separate elemental focus crystal '+mat,P((x,y,z)),.075*scale,.14*scale,.055*scale,mat,b.root)
  else:
   for j in range(8):
    a=j/8*math.tau;b.jewel('Separate elemental focus crystal',P((math.sin(a)*.64,.03,fz+.12+math.cos(a)*.32)),.075*scale,.14*scale,.055*scale,'iceblue',b.root)
 if b.id=='greenheart':
  x,y,z=c['hands']['L'];b.jewel('Offered druid thorn',(x,y+.11*scale,z+.23*scale),.07*scale,.12*scale,.07*scale,'moss',c['weapons']['L'])
 if wave==8:
  b.panel('Frost troll large dark shaggy rear mane',[P(q) for q in [(-fw*.55,-.27,fz+c['fh']*.54),(fw*.55,-.27,fz+c['fh']*.54),(tw+.22,-.36,sh-.07),(tw+.16,-.37,belt+.04),(0,-.43,belt-.09),(-tw-.16,-.37,belt+.04),(-tw-.22,-.36,sh-.07)]],.12*scale,'dark',head,.07*scale)
  for side in (-1,1):
   for j in range(3):leaf(b,'Frost troll overlapping thick shoulder mane',P((side*fw*.43,.07,fz+.08-j*.08)),P((side*(tw+.15+j*.025),.11,sh-.13-j*.10)),.13*scale,'dark',head)
 if wave==21:
  for j in range(10):
   a=j*math.tau/10;xx=math.sin(a)*tw*.82;yy=math.cos(a)*.275
   pts=[(xx*.92,yy*.93,sh+.05),(xx,yy,sh-.16),(xx*.84,yy*.95,belt+.13),(xx*.93,yy*.90,belt-.07)]
   b.limb('Root troll continuous entwined torso bark',[P(v) for v in pts],[.075*scale,.083*scale,.069*scale,.052*scale],'wood',tor,5)
   if j%2==0:ell(b,'Root troll broad moss over bark',P((xx,yy+.02,sh-.22)),SZ((.14,.10,.12)),'moss',tor,5,2)
  for side in (-1,1):
   label='R' if side>0 else 'L';upper=c['arms'][label];fore=bpy.data.objects.get('forearm_'+label);hand=c['hands'][label]
   sx=side*(tw+.055);hx=side*(tw+.32);hz=.28 if s.get('longArms') else .68
   for j in range(7):
    a=j*math.tau/7;dy=math.cos(a)*.15;dx=math.sin(a)*.15
    b.limb('Root troll thick wrapped upper arm bark',[P((sx+dx,dy,sh-.03)),P((side*(tw+.14)+dx,dy+.06,(sh+hz)/2))],[.063*scale,.065*scale],'wood',upper,5)
    b.limb('Root troll thick wrapped forearm bark',[P((side*(tw+.14)+dx,dy+.06,(sh+hz)/2)),(hand[0]+dx*scale,hand[1]+dy*scale,hand[2])],[.064*scale,.046*scale],'wood',fore,5)
 if s.get('orbCount'):
  x,y,z=c['hands']['L'];ell(b,'Single offered ice orb',(x,y+.055,z+.13*scale),(.11*scale,.11*scale,.11*scale),'iceblue' if b.id=='archangel' else 'rune',c['weapons']['L'],8,4)
 if s.get('plume'):leaf(b,'Single broad hat plume',P((-.07,0,fz+c['fh']*.61)),P((.15,-.02,fz+c['fh']*1.1)),.075*scale,'ivory',head)
 if s.get('wingStyle') and s['bodyKind']=='humanoid':wings(b,kind='feather',origin=P((0,-.20,sh+.06)),span=.98*scale,height=.75*scale,parent=tor,material='ivory')

def skull(b,pos,r,parent):
 x,y,z=pos;b.box('Carved ivory skull',(x,y,z),(r*1.6,r*1.1,r*1.5),'ivory',r*.2,parent)
 for side in (-1,1):b.box('Skull square socket',(x+side*r*.32,y+r*.57,z+r*.11),(r*.32,.011,r*.39),'dark',.001,parent)
 b.box('Skull lower jaw',(x,y+r*.03,z-r*.60),(r*.96,r*.82,r*.42),'ivory',r*.07,parent)

def mask_skull(b,pos,r,parent):
 x,y,z=pos
 b.panel('Source carved bone skull faceted broad mask',[(x-r*.82,y,z+r*.61),(x-r*.54,y,z+r*.85),(x+r*.54,y,z+r*.85),(x+r*.82,y,z+r*.61),(x+r*.87,y,z-r*.10),(x+r*.51,y,z-r*.58),(x-r*.51,y,z-r*.58),(x-r*.87,y,z-r*.10)],r*.45,'ivory',parent,r*.16)
 for side in (-1,1):
  b.box('Bone skull true dark square socket',(x+side*r*.38,y+r*.27,z+r*.20),(r*.38,r*.07,r*.44),'dark',r*.025,parent)
  ell(b,'Bone skull protruding faceted cheek',(x+side*r*.68,y+r*.24,z-r*.23),(r*.24,r*.18,r*.25),'ivory',parent,5,2)
 b.panel('Bone skull recessed triangle nose',[(x-r*.12,y+r*.35,z-r*.02),(x+r*.12,y+r*.35,z-r*.02),(x,y+r*.35,z-r*.31)],r*.04,'dark',parent)
 for j in range(5):cone(b,'Bone skull five hanging real fangs',(x+(j-2)*r*.20,y+r*.28,z-r*.40),(x+(j-2)*r*.20,y+r*.29,z-r*(.77 if j in (0,4) else .69)),r*.105,'ivory',parent,4)

def lantern(b,pos,r,parent):
 x,y,z=pos;b.jewel('Soul lantern crystal',(x,y,z),r*.51,r*.83,r*.44,'rune',parent)['visualCue']='regen'
 for side in (-1,1):
  for yy in (-1,1):b.rod('Lantern cage upright',(x+side*r*.69,y+yy*r*.58,z-r),(x+side*r*.69,y+yy*r*.58,z+r),r*.13,'wood',parent,6)
 for zz in (-1,1):b.box('Lantern cage rim',(x,y,z+zz*r),(r*1.9,r*1.62,r*.23),'wood',r*.07,parent)

def equipment(b,row,c):
 s=row['spec'];P=c['P'];SZ=c['SZ'];scale=c['scale'];weapon=s.get('weapon');wave=s.get('wave',0);hands=c['hands'];piv=c['weapons'];tor=c['torso']
 if wave==18:weapon='hook'
 if wave==17:weapon='hammer'
 if weapon in ('claws','fists',None):return
 def build(side,kind):
  x,y,z=hands[side];pa=piv[side]
  if b.id=='monk' and kind=='cross':
   y+=.22*scale
   b.rod('Monk full cross shaft held in front of hand',(x,y,z-.12*scale),(x,y,z+.45*scale),.029*scale,'wood',pa,4)
   b.box('Monk clearly visible full cross horizontal arm',(x,y,z+.29*scale),(.33*scale,.074*scale,.078*scale),'wood',.006*scale,pa)
   for j in range(3):ell(b,'Monk fingers actually wrapping cross grip',(x+(j-1)*.027*scale,y-.044*scale,z+.017*scale),(.027*scale,.080*scale,.035*scale),'skin',bpy.data.objects.get('hand_'+side),6,2)
   b.pivot('attack_muzzle',(x,y+.07*scale,z+.44*scale),pa)
   return
  if wave==17:
   b.rod('Totem troll actual wooden club handle',(x,y,z-.17*scale),(x-.07*scale,y,z+.61*scale),.043*scale,'wood',pa,6);ell(b,'Totem troll massive knotted wooden club',(x-.05*scale,y,z+.46*scale),(.17*scale,.16*scale,.34*scale),'wood',pa,6,3);return
  if wave==12:
   b.rod('Bell striker actual short mallet grip',(x,y,z-.08*scale),(x-.05*scale,y,z+.32*scale),.029*scale,'wood',pa,6);ell(b,'Bell striker bone mallet',(x-.05*scale,y,z+.37*scale),(.12*scale,.12*scale,.12*scale),'ivory',pa,8,3);return
  if wave==6 and kind=='hammer':
   rockz=.24*scale;b.rod('Moss troll real short club grip',(x,y,z-.02*scale),(x,y,rockz+.23*scale),.030*scale,'wood',pa,6);ell(b,'Moss troll grounded faceted stone club',(x,y,rockz),(.24*scale,.22*scale,.24*scale),'steel',pa,7,4)
   for j in range(4):ell(b,'Stone club moss inset',(x+.15*math.sin(j*math.tau/4)*scale,y+.15*math.cos(j*math.tau/4)*scale,rockz+.15*scale),(.06*scale,.06*scale,.02*scale),'moss',pa,5,2)
   b.pivot('attack_muzzle',(x,y+.25*scale,rockz),pa);return
  if kind in ('staff','crozier','spear','lance','cross','hammer','axe','ram','cleaver','sword','hook','dagger'):
   bottom=z-(.19 if kind=='cross' else .62)*scale if kind not in ('dagger','hook','sword','cleaver') else z-.16*scale
   top=z+(.80 if kind in ('staff','crozier','spear','lance') else .58 if kind in ('hammer','axe','ram') else .29 if kind=='cross' else .38)*scale
   b.rod('Connected '+kind+' handle',(x,y,bottom),(x,y,top),.028*scale,'wood' if kind not in ('sword','hook','dagger') else 'leather',pa,6)
   if kind in ('sword','dagger','cleaver','hook'):
    guard=z+.14*scale;b.box(kind+' guard',(x,y,guard),((.12 if kind=='hook' else .30)*scale,.065*scale,.050*scale),'gold' if not c['enemy'] else 'steel',.009*scale,pa)
    length=.89 if kind=='sword' else .49 if kind=='dagger' else .48;wid=.105 if kind=='sword' else .067 if kind=='dagger' else .17
    points=[(x-wid*scale,y+.035,guard+.04*scale),(x+wid*scale,y+.035,guard+.04*scale),(x+wid*.67*scale,y+.035,guard+(length-.16)*scale),(x,y+.035,guard+length*scale),(x-wid*.67*scale,y+.035,guard+(length-.16)*scale)]
    if kind=='cleaver':points=[(x-.12*scale,y+.036,guard),(x+.23*scale,y+.036,guard+.07*scale),(x+.21*scale,y+.036,guard+.60*scale),(x-.12*scale,y+.036,guard+.46*scale)]
    if kind=='dagger' and wave in (9,18,38,48):
     ss=1 if side=='R' else -1;points=[(x-ss*.045*scale,y+.03,guard),(x+ss*.08*scale,y+.03,guard),(x+ss*.20*scale,y+.03,guard+.18*scale),(x+ss*.22*scale,y+.03,guard+.35*scale),(x+ss*.34*scale,y+.03,guard+.46*scale),(x+ss*.05*scale,y+.03,guard+.32*scale)]
    if kind=='hook':
     ss=1 if side=='R' else -1
     curve=[(0,0),(.14,.12),(.29,.08),(.37,-.03),(.36,-.20),(.28,-.37),(.14,-.49),(.20,-.26),(.20,-.10),(.15,-.025),(.01,-.02)] if wave==18 else [(0,0),(.16,.14),(.22,.29),(.19,.42),(.13,.47),(.02,.44),(-.025,.40),(.07,.395),(.12,.34),(.13,.27),(.09,.17),(-.035,.045)]
     points=[(x+ss*dx*scale,y+.03,guard+dz*scale) for dx,dz in curve]
    b.panel('Physical '+kind+' blade',points,.060*scale,'purple' if wave==33 else 'steel_dark' if wave in (44,50) else 'steel_light',pa,.035*scale)
    b.box(kind+' pommel',(x,y,bottom),(.09*scale,.09*scale,.065*scale),'gold' if not c['enemy'] else 'steel',.013*scale,pa)
   elif kind in ('spear','lance'):
    b.jewel('Spear faceted metal tip',(x,y,top+.13*scale),.075*scale,.21*scale,.045*scale,'iceblue' if b.id=='archangel' else 'purple' if wave in (35,37) else 'steel_light',pa)
    if wave==37:
     for sign in (-1,1):b.jewel('Riftwolf spear fork purple crystal',(x+sign*.075*scale,y,top+.16*scale),.034*scale,.17*scale,.028*scale,'purple',pa)
    if b.id=='thunderheart':
     b.panel('Dragonrider actual gold lightning spearhead',[(x-.03*scale,y+.047,top),(x-.08*scale,y+.047,top+.27*scale),(x+.045*scale,y+.047,top+.23*scale),(x-.025*scale,y+.047,top+.53*scale),(x+.14*scale,y+.047,top+.16*scale),(x+.035*scale,y+.047,top+.18*scale)],.045*scale,'gold',pa,.024*scale)
    if kind=='lance':b.panel('Lance cloth pennant',[(x+.027*scale,y,top-.015*scale),(x+.027*scale,y,top-.33*scale),(x+.19*scale,y,top-.20*scale),(x+.15*scale,y,top-.08*scale)],.015*scale,'cloth',pa)
    if wave in (35,42):
     pp=[(x+.02*scale,y,top-.02*scale),(x+.27*scale,y,top-.10*scale),(x+.22*scale,y,top-.37*scale),(x+.14*scale,y,top-.30*scale),(x+.02*scale,y,top-.39*scale)]
     b.panel('Source eclipse or fire spear physical pennant',pp,.018*scale,'purple' if wave==35 else 'orange',pa,.008*scale)
     if wave==35:crescent(b,'Eclipse spear pennant golden crescent',(x+.14*scale,y+.025,top-.18*scale),.073*scale,'ivory',pa)
    if s.get('staffTop')=='fork':b.rod('Spear barb',(x,y,top+.05*scale),(x+.17*scale,y,top-.10*scale),.021*scale,'steel',pa,5)
   elif kind in ('hammer','ram'):
    if wave==6:
     ell(b,'Moss troll grounded faceted stone club',(x,y,bottom+.08*scale),(.25*scale,.22*scale,.29*scale),'steel',pa,7,4)
     for j in range(4):ell(b,'Stone club moss inset',(x+.15*math.sin(j*math.tau/4)*scale,y+.15*math.cos(j*math.tau/4)*scale,bottom+.24*scale),(.06*scale,.06*scale,.02*scale),'moss',pa,5,2)
    else:
     b.box('Massive transverse '+kind+' head',(x,y,top),(.53*scale,.27*scale,.32*scale),'wood' if wave==3 else 'steel',.044*scale,pa)
     for dx in (-.23,.23):b.box('Hammer metal end binding',(x+dx*scale,y,top),(.07*scale,.28*scale,.33*scale),'gold' if b.id=='kingdomprotector' else 'steel_dark',.014*scale,pa)
   elif kind=='axe':
    sign=1 if side=='R' else -1;b.panel('Broad axe curved cutting head',[(x,y+.07,top+.08*scale),(x+sign*.30*scale,y+.07,top+.21*scale),(x+sign*.42*scale,y+.07,top-.08*scale),(x+sign*.31*scale,y+.07,top-.31*scale),(x,y+.07,top-.17*scale)],.11*scale,'red' if wave==13 else 'steel_dark',pa,.04*scale)
   elif kind=='cross':
    b.box('Prayer cross horizontal',(x,y,top-.13*scale),(.33*scale,.07*scale,.085*scale),'wood',.005*scale,pa)
   elif kind in ('staff','crozier'):
    stafftop='crystal' if b.id in ('tempest','phoenix') else s.get('staffTop');r=.145*scale
    if wave==32:
     lantern(b,(x,y,top+.03*scale),.14*scale,pa)
     for sign in (-1,1):b.limb('Soul drinker staff ivory horn crown',[(x+sign*.10*scale,y,top+.13*scale),(x+sign*.16*scale,y,top+.30*scale),(x+sign*.10*scale,y,top+.45*scale)],[.046*scale,.037*scale,.018*scale],'ivory',pa,5)
    elif wave==23:
     for sign in (-1,1):b.limb('Warlock branched skull staff',[(x,y,top-.08*scale),(x+sign*.11*scale,y,top+.08*scale),(x+sign*.10*scale,y,top+.26*scale)],[.032*scale]*3,'wood',pa,5)
     b.jewel('Staff actual fourth ivory soul mask',(x,y+.02,top+.22*scale),.12*scale,.21*scale,.045*scale,'ivory',pa)
     for sign in (-1,1):b.box('Skull staff mask square aperture',(x+sign*.045*scale,y+.063,top+.25*scale),(.04*scale,.010,.059*scale),'dark',.001,pa)
    elif kind=='crozier' or stafftop in ('sun',None):
     annulus(b,'Staff genuine hollow ring',(x,y,top+.12*scale),r,.027*scale,'gold' if not c['enemy'] else 'wood',pa,True,10,4)
     if stafftop=='sun':ell(b,'Staff full golden sun disk',(x,y+.030,top+.12*scale),(.147*scale,.039*scale,.147*scale),'gold',pa,12,3);rays(b,'Staff solar disk',(x,y,top+.12*scale),r,pa)
    elif stafftop in ('leaf','branch'):
     for j in range(3 if stafftop=='branch' else 1):leaf(b,'Staff leaf focus',(x+(j-1)*.10*scale,y,top),(x+(j-1)*.16*scale,y,top+.36*scale),.10*scale,'moss',pa)
    elif stafftop=='fork':
     for sign in (-1,1):b.limb('Staff fork prong',[(x,y,top-.08*scale),(x+sign*.15*scale,y,top+.08*scale),(x+sign*.15*scale,y,top+.25*scale)],[.029*scale]*3,'wood',pa,6)
     b.jewel('Fork staff crystal',(x,y,top+.23*scale),.075*scale,.13*scale,.056*scale,'iceblue',pa)
    elif stafftop=='orb':
     ell(b,'Angel actual blue orb',(x,y,top+.23*scale),(.135*scale,.135*scale,.135*scale),'iceblue',pa,10,4)
     for j in range(3):
      a=j*math.tau/3;b.limb('Orb crown gilded support',[(x,y,top-.03*scale),(x+math.sin(a)*.16*scale,y+math.cos(a)*.16*scale,top+.13*scale),(x+math.sin(a)*.15*scale,y+math.cos(a)*.15*scale,top+.26*scale)],[.023*scale]*3,'gold',pa,5)
    else:
     b.jewel('Staff crystal',(x,y,top+.15*scale),.11*scale,.19*scale,.09*scale,'purple' if b.id in ('tempest','phoenix') else 'rune',pa)
     if b.id=='tempest':
      for sign in (-1,1):b.limb('Tempest actual wood fork supporting purple crystal',[(x,y,top-.045*scale),(x+sign*.13*scale,y,top+.065*scale),(x+sign*.115*scale,y,top+.23*scale)],[.030*scale,.033*scale,.022*scale],'wood',pa,5)
    b.pivot('staff_tip',(x,y,top+.16*scale),pa)
   b.pivot('attack_muzzle',(x,y+.07*scale,top+.05*scale),pa)
  elif kind=='bow':
   ht=1.32*scale*s.get('weaponScale',1);half=.20*scale
   hi,lo=(.58,.42) if b.id=='elvenking' else (.5,.5)
   # Native +Y is the firing direction. The actual bow/string lie in YZ;
   # the curved stave is forward of the string, which draws toward -Y.
   pts=[(x,y-.22*scale,z+ht*hi),(x,y+.055*scale,z+ht*hi*.60),(x,y,z),(x,y+.055*scale,z-ht*lo*.60),(x,y-.22*scale,z-ht*lo)]
   stave=b.limb('Continuous open bow stave',pts,[.030*scale,.041*scale,.042*scale,.041*scale,.028*scale],'gold' if not c['enemy'] else 'wood',pa,8)
   b.limb('Bow contacting wrapped grip',[(x,y,z-.075*scale),(x,y,z+.075*scale)],[.048*scale]*2,'leather',pa,8)
   nock=(x,y-.22*scale,z)
   b.limb('Physical bowstring',[pts[0],nock,pts[-1]],[.006*scale]*3,'ivory',pa,4)
   for name,pos in [('bow_grip',(x,y,z)),('bow_nock',nock),('bow_string_top',pts[0]),('bow_string_bottom',pts[-1]),('attack_muzzle',(x,y+.12*scale,z))]:b.pivot(name,pos,pa)
   stave['bowPlane']='forward-vertical';pa['bowPlane']='forward-vertical';b.root['bowPlane']='forward-vertical'
  elif kind=='crossbow':
   # Trigger is RIGHT; left wrist supports the physically connected fore-stock.
   x,y,z=0,.36,0
   z=sum(p[2] for p in hands.values())/2
   pa=piv['R'];b.box('Crossbow connected stock',(x,y,z),(.18*scale,.68*scale,.105*scale),'wood',.018*scale,pa)
   pts=[(-.40*scale,y+.11*scale,z+.02*scale),(-.22*scale,y+.23*scale,z+.03*scale),(0,y+.28*scale,z+.04*scale),(.22*scale,y+.23*scale,z+.03*scale),(.40*scale,y+.11*scale,z+.02*scale)]
   b.limb('Crossbow transverse bow limbs',pts,[.042*scale]*5,'wood',pa,5);b.rod('Crossbow taut string',pts[0],pts[-1],.009*scale,'ivory',pa,4)
   b.rod('Loaded crossbow bolt',(0,y-.18*scale,z+.075*scale),(0,y+.48*scale,z+.075*scale),.015*scale,'steel',pa,5);cone(b,'Crossbow bolt crystal tip',(0,y+.46*scale,z+.075*scale),(0,y+.65*scale,z+.075*scale),.061*scale,'rune' if b.id=='rimewatch' else 'steel_light',pa,4)
   b.pivot('attack_muzzle',(0,y+.65*scale,z+.075*scale),pa)
  elif kind=='bomb':
   pos=(x,y+.07*scale,z+.13*scale) if b.id=='griffinbomber' else ((hands['R'][0]+hands['L'][0])/2,max(hands['R'][1],hands['L'][1])+.04,(hands['R'][2]+hands['L'][2])/2)
   ell(b,'Physical held hex bomb',pos,(.22*scale,.22*scale,.22*scale),'steel_dark',pa,8,3);b.rod('Bomb wick',(pos[0],pos[1],pos[2]+.20*scale),(pos[0]+.07*scale,pos[1],pos[2]+.31*scale),.020*scale,'wood',pa,5);b.jewel('Bomb small flame',(pos[0]+.07*scale,pos[1],pos[2]+.33*scale),.035*scale,.065*scale,.035*scale,'orange',pa)
   b.pivot('attack_muzzle',pos,pa)
  elif kind=='greatsword':
   a=Vector(hands['L']);grip=Vector(hands['R']);d=(grip-a).normalized();u=Vector((d.z,0,-d.x));base=a-d*.10*scale;guard=grip+d*.15*scale
   b.rod('Two handed sword actual hilt',base,guard,.043*scale,'leather',pa,10)
   bladebase=guard+d*.045*scale;length=.94*scale;bladeend=bladebase+d*length;ww=.115*scale
   # Symmetric shoulders, straight parallel cutting edges and one centered
   # tip; every point is computed along the same hilt axis, not two axes.
   vs=[tuple(bladebase-u*ww),tuple(bladebase+u*ww),tuple(bladeend-d*.16*scale+u*ww*.88),tuple(bladeend),tuple(bladeend-d*.16*scale-u*ww*.88)]
   b.panel('Kingslayer long diagonal blade',vs,.075*scale,'steel_light',pa,.043*scale)
   b.rod('Greatsword guard',guard-u*.235*scale,guard+u*.235*scale,.040*scale,'steel',pa,8)
   ell(b,'Greatsword round contacting pommel',tuple(base),SZ((.066,.063,.066)),'steel_dark',pa,10,3)
 if weapon=='bow':build('L',weapon)
 else:build('R',weapon)
 if s.get('dualWeapons') or wave in (11,18):build('L',weapon)
 if s.get('secondary')=='prayerBook':
  x,y,z=hands['L'];b.box('Closed leather prayer book',(x,y+.04,z+.13*scale),(.20*scale,.09*scale,.29*scale),'dark',.015*scale,piv['L']);b.box('Book gilded spine',(x+.08*scale,y+.10,z+.13*scale),(.030*scale,.02*scale,.28*scale),'gold',.003*scale,piv['L'])
 shield=s.get('shield')
 if shield:
  x,y,z=hands['L'];z-=.03*scale;pa=piv['L'];w=.46*scale;h=.80*scale
  if b.id=='kingsrangerguard':
   # The approved back-mounted option leaves the crossbow grip and support
   # wrist accessible. Reverse facing so the crest faces the character back.
   x,y,z=P((0,-.31,(c['shoulder']+c['belt'])/2));pa=b.pivot('back_shield_pivot',(x,y,z),tor)
  if shield in ('round',True):
   outline=[(x+w*.60*math.sin(j*math.tau/10),y+.13,z+w*.60*math.cos(j*math.tau/10)) for j in range(10)]
  elif shield=='gate':outline=[(x-w*.85,y+.14,z-h*.56),(x+w*.85,y+.14,z-h*.56),(x+w*.85,y+.14,z+h*.64),(x-w*.85,y+.14,z+h*.64)]
  elif shield=='tower':outline=[(x-w/2,y+.13,z-h*.53),(x+w/2,y+.13,z-h*.53),(x+w/2,y+.13,z+h*.53),(x-w/2,y+.13,z+h*.53)]
  else:outline=[(x-w*.57,y+.13,z+h*.44),(x,y+.13,z+h*.56),(x+w*.57,y+.13,z+h*.44),(x+w*.48,y+.13,z-h*.28),(x,y+.13,z-h*.63),(x-w*.48,y+.13,z-h*.28)]
  b.panel('Shield real back and rim',outline,.070*scale,'gold' if not c['enemy'] else 'steel',pa,.025*scale)
  inner=[(x+(vx-x)*.86,vy+.021,z+(vz-z)*.86) for vx,vy,vz in outline];b.panel('Shield inset front',inner,.033*scale,'cloth' if not c['enemy'] else 'dark' if shield=='mirror' else 'wood',pa,.025*scale)
  if b.id=='kingdomprotector':
   b.box('Shield Latin cross tall shaft',(x,y+.191,z-.035*scale),SZ((.065,.045,.41)),'gold',.006*scale,pa);b.box('Shield Latin cross short bar',(x,y+.196,z+.09*scale),SZ((.26,.045,.068)),'gold',.006*scale,pa)
  elif b.id=='kingsrangerguard':
   cy=y+.208;zz=z+.10*scale
   b.panel('Royal ranger guard visible gold crown shield crest',[(x-.13*scale,cy,zz-.08*scale),(x-.16*scale,cy,zz+.12*scale),(x-.065*scale,cy,zz+.055*scale),(x,cy,zz+.185*scale),(x+.065*scale,cy,zz+.055*scale),(x+.16*scale,cy,zz+.12*scale),(x+.13*scale,cy,zz-.08*scale)],.028*scale,'gold',pa,.012*scale)
  elif b.id=='roseguard':lion(b,(x,y+.192,z),.17*scale,pa)
  elif wave==31:
   annulus(b,'Inquisitor actual hollow sun shield seal',(x,y+.214,z),.135*scale,.021*scale,'gold',pa,True,12,4);rays(b,'Inquisitor golden sun seal',(x,y+.214,z),.135*scale,pa)
  elif b.id=='crownofages':
   b.rod('Shield royal fleur-de-lis stem',(x,y+.203,z-.14*scale),(x,y+.203,z+.13*scale),.025*scale,'gold',pa,5)
   b.panel('Royal fleur-de-lis broad central relief',[(x-.04*scale,y+.214,z+.02*scale),(x-.062*scale,y+.214,z+.14*scale),(x-.037*scale,y+.214,z+.21*scale),(x,y+.214,z+.245*scale),(x+.037*scale,y+.214,z+.21*scale),(x+.062*scale,y+.214,z+.14*scale),(x+.04*scale,y+.214,z+.02*scale)],.025*scale,'gold',pa,.018*scale)
   for side in (-1,1):b.panel('Royal fleur-de-lis curled broad petal relief',[(x,y+.216,z-.01*scale),(x+side*.09*scale,y+.216,z+.035*scale),(x+side*.16*scale,y+.216,z+.09*scale),(x+side*.18*scale,y+.216,z+.15*scale),(x+side*.155*scale,y+.216,z+.195*scale),(x+side*.12*scale,y+.216,z+.21*scale),(x+side*.084*scale,y+.216,z+.17*scale),(x+side*.095*scale,y+.216,z+.11*scale),(x+side*.04*scale,y+.216,z+.08*scale)],.025*scale,'gold',pa,.018*scale)
  elif shield=='gate':
   for j in range(4):
    b.box('Door shield separate upright slat',(x+(j-1.5)*w*.38,y+.181,z+.025*scale),(w*.34,.029*scale,h*1.14),'wood',.005*scale,pa)
   for zz in (-.25,.24):
    b.box('Door shield iron cross brace',(x,y+.215,z+zz*scale),(w*1.65,.035*scale,.060*scale),'steel_dark',.006*scale,pa)
    for j in range(4):ell(b,'Door shield actual metal nail',(x+(j-1.5)*w*.39,y+.242,z+zz*scale),(.018*scale,.010*scale,.018*scale),'steel',pa,5,2)
  else:b.jewel('Shield front diamond boss',(x,y+.183,z),.085*scale,.16*scale,.035*scale,'gold' if not c['enemy'] else 'steel_light',pa)
  for zz in (-.11,.11):annulus(b,'Shield visible rear arm strap',(x,y-.02,z+zz*scale),.083*scale,.018*scale,'leather',pa,False,8,4)
  if wave==41:
   shards=b.pivot('refraction_shards',(x,y+.20,z+.39*scale),pa)
   for j in range(3):b.jewel('Shield separate protective node',(x+(j-1)*.12*scale,y+.20,z+.39*scale),.045*scale,.072*scale,.038*scale,'rune',shards)['visualCue']='refraction'
  if b.id=='kingsrangerguard':
   pa.rotation_euler.z=math.pi
   for side in (-1,1):b.limb('Back shield contacting leather suspension strap',[P((side*.12,-.235,c['shoulder']-.04)),P((side*.13,-.425,(c['shoulder']+c['belt'])/2+.11))],[.024*scale]*2,'leather',tor,6)

def wings(b,kind='bat',origin=(0,0,1),span=1.05,height=.55,parent=None,material='cloth',ragged=False):
 if kind in ('feather','blade'):
  from geometric_creature_anatomy_v2 import feather_wings
  return feather_wings(b,origin,span,height,parent,material)
 ox,oy,oz=origin
 for side in (-1,1):
  root=(ox+side*.22,oy,oz);pa=b.pivot('wing_'+('R' if side>0 else 'L'),root,parent)
  wrist=(ox+side*span*.60,oy-.06,oz+height);tip=(ox+side*span,oy-.17,oz+height*.38)
  if kind in ('feather','blade'):
   b.limb('Feather wing enclosed arm',[root,(ox+side*span*.40,oy,oz+height*.24)],[.060,.038],material,pa,6)
   ends=[(.61,1.12),(.93,.74),(1.02,.38),(.95,.02),(.79,-.25),(.57,-.43)]
   for j,(dx,dz) in enumerate(ends):
    start=(root[0]+side*j*.017,oy-.020,oz-j*.018);end=(ox+side*span*dx,oy-.030,oz+height*dz)
    leaf(b,'Layered broad anatomical flight feather',start,end,.155 if j<3 else .135,material,pa)
   for j in range(4):
    start=(root[0]+side*.008,oy+.055,oz-.01);end=(ox+side*span*(.40+j*.13),oy+.055,oz+height*(.51-j*.26));leaf(b,'Overlapping broad short feather covert',start,end,.12,material,pa)
  else:
   lower=[(ox+side*span*.82,oy-.17,oz-.32),(ox+side*span*.56,oy-.11,oz-.15),(ox+side*.30,oy,oz-.22)]
   outline=[root,wrist,tip,lower[0],lower[1],lower[2]]
   if ragged:outline=[root,wrist,tip,(ox+side*span*.92,oy-.17,oz-.11),(ox+side*span*.88,oy-.17,oz-.37),lower[1],(ox+side*span*.48,oy-.09,oz-.27),lower[2]]
   b.panel('Continuous faceted wing membrane',outline,.025,material,pa,.018)
   b.limb('Wing leading forelimb',[root,wrist,tip],[.063,.048,.018],'ivory' if b.id in ('host_27','host_40') else 'steel_dark',pa,6)
   for pt in lower:b.rod('Wing membrane finger',wrist,pt,.026 if b.id in ('host_27','host_40') else .020,'ivory' if b.id in ('host_27','host_40') else 'steel_dark',pa,5)
   cone(b,'Wing wrist claw',wrist,(wrist[0]+side*.055,wrist[1],wrist[2]+.09),.04,'ivory',pa,4)

def beast(b,row):
 s=row['spec'];identity=b.id;wave=s.get('wave',0);kind=s['bodyKind'];enemy=row['category']=='enemies';mounted=bool(s.get('mounted')) and wave!=40;horse=kind=='horse';wolf=s.get('beastKind')=='wolf';bear=s.get('species')=='bear';griffin=s.get('species')=='griffin';bird=kind=='bird';bat=kind=='bat';wyvern=kind=='wyvern'
 if identity in ('frostblade','roseguard','embercrown','worldfire','thunderheart','phoenix','griffinbomber','rangermentor'):
  from geometric_creature_anatomy_v3 import build_source_creature_v3
  return build_source_creature_v3(b,row,ell,cone,leaf,annulus,humanoid,lion)
 if identity in ('frostblade','roseguard','embercrown','worldfire','starfall','thunderheart','phoenix'):
  from geometric_creature_anatomy_v2 import build_refined_creature
  return build_refined_creature(b,row,ell,cone,leaf,annulus,humanoid,lion)
 if wave==40:
  from geometric_hollow_sky_source_v2 import hollow_sky_king
  return hollow_sky_king(b,row,ell,cone,wings,leaf)
 if wave==39:return manta(b,row)
 skin='cloth' if not horse else 'steel_light' if identity=='frostblade' else 'hair';scale=.87 if s.get('dragonAge')=='baby' else 1.;z=.66 if not bat else .70;tail_y=-.80
 if bat:z=1.45 if wave in (5,34) else .70
 if wyvern:z=.78
 if horse:z=.83
 root=b.pivot('mount_torso_pivot' if mounted else 'torso_pivot',(0,0,z));headpos=(0,.60,1.06) if not horse else (0,.64,1.19)
 if bat:headpos=(0,.30,z)
 if bird:headpos=(0,.10,1.41)
 if identity=='worldfire':headpos=(0,.57,1.46)
 if bear:headpos=(0,.48,1.03)
 if wyvern:headpos=(-.43 if wave==50 else 0,.94,1.54)
 head=b.pivot('mount_head_pivot' if mounted else 'head_pivot',headpos,root)
 bodyr=(.44,.60,.45) if kind=='dragon' else (.34,.56,.35) if not bear else (.44,.57,.43)
 if s.get('dragonAge')=='baby':bodyr=(.36,.43,.36)
 if bat:bodyr=(.24,.24,.33)
 if bird:bodyr=(.27,.20,.40)
 ell(b,'Species continuous faceted trunk',(0,-.12,z),bodyr,skin,root,10,4)
 if not bat and not bird:
  neckpts=[(0,.24,z+.12),(0,.39,z+.45),headpos]
  if wyvern:neckpts=[(0,.24,z+.04),(-.10 if wave==50 else 0,.48,z+.22),(-.30 if wave==50 else 0,.64,z+.58),headpos]
  b.limb('Connected angular neck',neckpts,[.24,.17]+([.14] if len(neckpts)==4 else [])+[.19],'ivory' if horse else skin,root,8)
 fw=.60 if s.get('dragonAge')=='baby' else .64 if wolf else .47 if not horse else .32;fh=.43 if s.get('dragonAge')=='baby' else .43 if wolf else .33 if not horse else .39
 if bat:fw=.42;fh=.37
 if bear:fw=.65;fh=.51
 if bird:fw=.53;fh=.40
 x,y,hz=headpos;b.box('Species chamfered head',headpos,(fw,.38,fh),'ivory' if griffin else skin,.055,head)
 jaw=b.pivot('mouth_pivot',(x,y+.16,hz-.10),head);b.box('Distinct species muzzle',(x,y+.225,hz-.09),(fw*.77,.26,fh*.45),'ivory' if horse or bear else skin,.045,jaw)
 b.pivot('attack_muzzle',(x,y+.38,hz-.10),jaw)
 for side in (-1,1):
  b.box('Creature square eye',(x+side*fw*.26,y+.20,hz+.055),(.060,.014,.074),'red' if wolf else 'eyes',.003,head)
  if not bird:
   if bear:annulus(b,'Round bear ear',(x+side*.31,y-.05,hz+.28),.080,.035,'leather',head,True,8,4)
   elif bat:
    b.panel('Bat actual huge external ear',[(x+side*fw*.29,y-.05,hz+fh*.17),(x+side*fw*.94,y-.065,hz+fh*1.39),(x+side*fw*.89,y-.025,hz+fh*.41),(x+side*fw*.52,y+.005,hz+fh*.10)],.032,skin,head,.025)
    b.panel('Bat pink ear aperture',[(x+side*fw*.45,y+.007,hz+fh*.22),(x+side*fw*.84,y+.005,hz+fh*1.14),(x+side*fw*.78,y+.018,hz+fh*.43)],.012,'pink',head)
   else:cone(b,'Anatomical creature ear',(x+side*fw*.39,y-.04,hz+fh*.37),(x+side*fw*.61,y-.08,hz+fh*.88),.095,skin,head,4)
 if bat and wave not in (27,34):b.box('Bat actual flattened pink nose',(x,y+.376,hz-.025),(.19,.040,.15),'pink',.014,jaw)
 if wolf:
  for ob in list(b.objects):
   if ob.name.startswith('Distinct species muzzle'):b.objects.remove(ob);bpy.data.objects.remove(ob,do_unlink=True)
  b.loft('Wolf actual tapered long snout',[[ (x-w,yy,hz-.18),(x+w,yy,hz-.18),(x+w*.90,yy,hz-.01),(x+w*.57,yy,hz+.04),(x-w*.57,yy,hz+.04),(x-w*.90,yy,hz-.01)] for yy,w in [(y+.12,.24),(y+.40,.20),(y+.52,.12)]],skin,jaw)
  b.box('Wolf black broad nose',(x,y+.536,hz-.10),(.19,.034,.092),'dark',.018,jaw)
  for j in range(3):cone(b,'Wolf red faceted head armor',(x,y-.02+j*.10,hz+.23),(x,y+.01+j*.10,hz+.40-j*.025),.11,'red',head,4)
 if bird or griffin:
  cone(b,'Eagle beak',(x,y+.22,hz),(x,y+.50,hz-.10),.15,'gold',head,4)
 if griffin:
  for j in range(5):a=(j-2)*.45;leaf(b,'Gryphon real eagle mane feather',(math.sin(a)*.15,y+.07,hz-.08),(math.sin(a)*.30,y+.15,hz-.40),.09,'ivory',head)
 if not horse and not bear and not bird:
  for side in (-1,1):cone(b,'Creature fang',(x+side*fw*.21,y+.33,hz-.12),(x+side*fw*.21,y+.33,hz-.02),.026,'ivory',head,4)
 if s.get('horns') or wyvern or s.get('hornCount'):
  count=s.get('horns',s.get('hornCount',2));count=2 if count==0 else count
  for j in range(count):
   side=-1 if j%2 else 1;cone(b,'Swept creature horn',(x+side*fw*.35,y-.10-j*.02,hz+fh*.40),(x+side*(fw*.43+j*.025),y-.25-j*.015,hz+fh*.96+j*.04),.068,'gold' if not enemy else 'steel_dark',head,5)
 if s.get('crown') and not mounted and wave!=40:crown(b,(x,y,hz+fh*.50+.012),fw*.40 if bear else fw,parent=head,points=s.get('crownPoints',3))
 # Species limbs: wyverns/bats have only two hind legs; dragons/horses/
 # wolves/bears/griffins have four actual legs, never six.
 numlegs=2 if wyvern or bat or bird else 4
 for j in range(numlegs):
  side=-1 if j%2 else 1;front=j<2 and numlegs==4;label=('F' if front else 'B')+('R' if side>0 else 'L') if numlegs==4 else ('R' if side>0 else 'L')
  ly=.34 if front else -.39;hip=(side*.27,ly,z-.15);knee=(side*.28,ly+.045,.29);ankle=(side*.28,ly+.06,.10)
  if kind=='dragon':hip=(side*.31,ly,z-.13);knee=(side*.41,ly+.14 if front else ly-.12,.265);ankle=(side*.36,ly+.11,.10)
  if bear:hip=(side*.31,ly,z-.12);knee=(side*.36,ly+.12 if front else ly-.10,.255);ankle=(side*.33,ly+.10,.11)
  if bat:hip=(side*.12,-.02,z-.19);knee=(side*.15,.015,z-.38);ankle=(side*.16,.04,z-.43)
  if bird:hip=(side*.12,.04,z-.19);knee=(side*.17,.10,z-.31);ankle=(side*.13,.17,z-.26)
  up=b.pivot('upper_leg_'+label,hip);shin=b.pivot('shin_'+label,knee,up);foot=b.pivot('foot_'+label,ankle,shin)
  r=.075 if horse or bat or bird else .15 if bear else .13 if kind=='dragon' else .11;b.limb('Animal upper leg '+label,[hip,knee],[r*1.24,r],skin,up,6);b.limb('Animal shin '+label,[knee,ankle],[r,r*.83],skin,shin,6)
  ell(b,'Animal contacting knee joint '+label,knee,(r*1.06,r*1.04,r*1.06),skin,shin,10,3)
  # These grounded bear/gryphon/wolf fetlock volumes fit inside the soles.
  # Preserve the actual joint center and articulated chain; only bound the
  # lower contour, which previously extended below the terrain.
  ankle_rz=min(r*.94,ankle[2]-.006) if identity in ('rangermentor','griffinbomber','host_19','host_37','host_47') else r*.94
  ell(b,'Animal contacting ankle joint '+label,ankle,(r*.91,r*.94,ankle_rz),skin,foot,10,3)
  footz=.095 if not bat and not bird else ankle[2]-.015;b.box('Animal grounded foot '+label,(ankle[0],ankle[1]+.04,footz),(r*2.4,.26,.19 if not bat and not bird else .10),'dark' if horse else skin,.027,foot)
  if not horse:
   for k in range(3):cone(b,'Animal foot claw',(ankle[0]+(k-1)*r*.60,ankle[1]+.14,footz-.02),(ankle[0]+(k-1)*r*.60,ankle[1]+.25,footz-.07),.023,'ivory',foot,4)
 if not bird:
  tailpoints=[(0,-.56,z-.05),(0,-.88,z-.12),(.20,-1.14,z-.03),(.39,-1.24,z+.17)]
  if horse:tailpoints=[(0,-.63,z+.07),(0,-.71,.43),(0,-.69,.11)]
  if bear:tailpoints=[(0,-.55,z),(0,-.66,z-.04)]
  if bat:tailpoints=[(0,-.17,z-.10),(0,-.32,z-.27)]
  if identity=='embercrown':tailpoints=[(0,-.51,z-.03),(0,-.75,z+.17),(.05,-.60,z+.54),(.10,-.47,z+.95)]
  b.limb('Connected articulated tail',tailpoints,[.13*(1-j/len(tailpoints)) for j in range(len(tailpoints))],skin,root,6)
  if s.get('tailStyle')=='flame':
   ell(b,'Dragon orange hovering flame core',tailpoints[-1],(.12,.12,.17),'orange',root,6,3)
   for j in range(3):cone(b,'Dragon flame angular lick',(tailpoints[-1][0]+(j-1)*.065,tailpoints[-1][1],tailpoints[-1][2]+.04),(tailpoints[-1][0]+(j-1)*.07,tailpoints[-1][1],tailpoints[-1][2]+.28-abs(j-1)*.09),.064,'orange',root,4)
  if s.get('tailStyle')=='split':b.limb('Dragon actual second branching tail',[tailpoints[-2],(-.19,-1.15,z+.10),(-.38,-1.19,z+.32)],[.078,.045,.018],skin,root,6)
 if s.get('backSpikes'):
  for j in range(s['backSpikes']):cone(b,'Dragon actual broad dorsal gold spike',(0,-.54+j*.20,z+.28),(0,-.59+j*.20,z+.49),.105,'gold',root,5)
 if s.get('saddlebags'):
  for side in (-1,1):
   ell(b,'Gryphon bomber actual hanging hex bomb bag',(side*.43,-.19,z-.04),(.17,.23,.24),'leather',root,6,3)
   b.limb('Bomb bag real connected saddle strap',[(side*.15,-.12,z+.29),(side*.37,-.16,z+.07)],[.024,.024],'leather',root,4)
   ell(b,'Bomb pack exposed black held payload',(side*.43,-.12,z+.12),(.12,.14,.11),'steel_dark',root,6,2)
 if bird:
  for j in range(3):leaf(b,'Lightning tail feather',((j-1)*.06,-.15,z-.14),((j-1)*.25,-.28,z-.55),.10,'cloth_light',root)
  for j in range(5):
   a=(j-2)*.40;leaf(b,'Thunderbird layered ivory neck feather',(math.sin(a)*.14,.23,headpos[2]-.08),(math.sin(a)*.27,.20,headpos[2]-.42),.095,'ivory',head)
 if s.get('wings') or s.get('wingStyle') or bat or wyvern or bird or griffin:
  membr='pink' if bat and wave in (5,25,34) else 'rune' if wave==27 else 'orange' if identity in ('embercrown','phoenix') or wave in (42,50) else 'ivory' if griffin or identity in ('worldfire','thunderheart') else 'red' if wave in (15,45,48) else 'cloth_light'
  wings(b,'feather' if bird or griffin else 'bat',(0,-.12,z+.25),span=.80 if s.get('dragonAge')=='baby' else 1.10 if not wyvern else 1.35,height=.36 if s.get('dragonAge')=='baby' else .94 if bird else .82 if identity=='worldfire' else .60,parent=root,material=membr,ragged=s.get('wingRagged',False))
 if identity in ('embercrown','worldfire','thunderheart','phoenix'):
  b.panel('Dragon continuous broad faceted ivory belly',[(-.16,.53,z+.50),(-.26,.50,z+.19),(-.28,.40,z-.13),(-.18,.35,z-.27),(.18,.35,z-.27),(.28,.40,z-.13),(.26,.50,z+.19),(.16,.53,z+.50)],.056,'ivory',root,.025)
  b.panel('Dragon continuous ivory throat',[(-.16,.55,z+.41),(-.14,.63,headpos[2]-.19),(.14,.63,headpos[2]-.19),(.16,.55,z+.41)],.041,'ivory',root,.017)
 if horse:
  b.panel('Horse cloth chest caparison',[(-.35,.54,.88),(.35,.54,.88),(.36,.54,.40),(0,.57,.29),(-.36,.54,.40)],.030,'cloth',root,.025)
  for side in (-1,1):
   b.panel('Horse cloth front flank drape',[(side*.35,.44,.93),(side*.39,-.09,.88),(side*.42,-.10,.36),(side*.39,.35,.42)],.035,'cloth',root,.025)
   b.panel('Horse cloth rear flank drape',[(side*.39,-.09,.88),(side*.35,-.56,.93),(side*.38,-.50,.46),(side*.42,-.10,.36)],.035,'cloth_light',root,.020)
  for side in (-1,1):
   for a,q in [((side*.39,.35,.42),(side*.42,-.10,.36)),((side*.42,-.10,.36),(side*.38,-.50,.46))]:b.rod('Horse ivory faceted flank lower hem',a,q,.032,'gold' if identity=='roseguard' else 'ivory',root,5)
   if identity=='roseguard':lion(b,(side*.453,-.12,.63),.13,root,True)
   else:leaf(b,'Horse flank heraldic emblem',(side*.452,-.12,.48),(side*.452,-.12,.76),.10,'gold',root)
  for side in (-1,1):b.rod('Horse ivory chest hem',(0,.575,.29),(side*.36,.565,.40),.028,'ivory',root,5)
  if identity=='roseguard':lion(b,(0,.615,.57),.13,root)
  else:b.jewel('Horse frontal caparison heraldry',(0,.59,.57),.10,.17,.03,'gold',root)
  for side in (-1,1):b.limb('Horse bridle side',[(side*.17,.55,1.41),(side*.20,.80,1.18),(side*.15,.85,1.02)],[.023]*3,'leather',head,5)
  strap(b,'Horse noseband',(-.20,.92,1.05),(.20,.92,1.05),.052,'leather',head)
 if bear:
  # Cloth covers both flanks and the rear, with the source's wide gold hem
  # and raised leaf crests. It is a separate substantial draped garment.
  def clothsheet(name,vs,offset):
   pts=list(vs)+[tuple(Vector(q)+Vector(offset)) for q in vs];fs=[]
   for rr in range(2):
    for cc in range(2):
     i=rr*3+cc;fs.extend([(i,i+1,i+4,i+3),(i+9,i+12,i+13,i+10)])
   boundary=[0,1,2,5,8,7,6,3]
   for j,i in enumerate(boundary):k=boundary[(j+1)%8];fs.append((i,k,k+9,i+9))
   return b.mesh(name,pts,fs,'moss',root)
  for side in (-1,1):
   # Three physical rows follow the shoulder-to-flank curve. The middle row
   # stays beyond the widest torso; a single diagonal face cut through it.
   grid=[(side*.33,.21,1.045),(side*.33,-.14,1.045),(side*.33,-.65,1.045),
         (side*.52,.26,.75),(side*.52,-.14,.75),(side*.52,-.64,.75),
         (side*.555,.16,.44),(side*.555,-.15,.32),(side*.535,-.56,.47)]
   clothsheet('Bear curved closed green mantle flank',grid,(-side*.028,0,0))
   for aa,bb in [(0,1),(1,2),(2,5),(5,8),(8,7),(7,6),(6,3),(3,0)]:b.rod('Bear broad golden mantle trim',grid[aa],grid[bb],.022,'gold',root,5)
   xx=side*.585;yy=-.15
   b.rod('Bear actual leaf crest gold stem',(xx,yy,.45),(xx,yy,.76),.014,'gold',root,5)
   for endy,endz in [(yy,.80),(yy-.13,.71),(yy+.13,.71)]:
    a=Vector((xx,yy,.59));cc=Vector((xx,endy,endz));mid=a.lerp(cc,.46);t=Vector((0,-(cc.z-a.z),cc.y-a.y)).normalized()*.040
    b.panel('Bear actual three lobed gold leaf crest',[tuple(a),tuple(mid+t),tuple(cc),tuple(mid-t)],.018,'gold',root,.009)
  roof=[(-.33,.21,1.045),(0,.21,1.065),(.33,.21,1.045),(-.33,-.14,1.045),(0,-.14,1.125),(.33,-.14,1.045),(-.33,-.65,1.045),(0,-.65,1.07),(.33,-.65,1.045)]
  clothsheet('Bear curved continuous green mantle shoulder drape',roof,(0,0,-.025))
  rear=[(-.33,-.678,1.045),(.33,-.678,1.045),(.38,-.69,.89),(-.38,-.69,.89)]
  b.panel('Bear source green upper rear mantle band',rear,.025,'moss',root,.008)
  for j in range(4):b.rod('Bear rear mantle broad gold hem',rear[j],rear[(j+1)%4],.020,'gold',root,5)
 if mounted and wave!=40:
  if wave not in (5,34):b.box('Rider saddle physical contact',(0,-.04,z+.27),(.47,.43,.12),'leather',.028,root)
  riderspec={**s,'bodyKind':'humanoid','mounted':False,'wingStyle':None,'wings':False,'cloak':'long' if wave==50 else 'short' if s.get('cloak') else False,'helmet':horse and identity=='frostblade' or not horse and identity=='thunderheart','hood':wave in (19,27,29,37,48,50),'hat':'cone' if identity=='phoenix' else None,'beard':identity=='griffinbomber','shield':s.get('shield'),'crown':False if wave==50 else s.get('crown',False)}
  if identity=='roseguard':riderspec['helmet']=False
  riderrow={**row,'spec':riderspec};before=set(b.objects);hctx=humanoid(b,riderrow,True,(0,.23 if wave in (5,34) else -.07,z-1.03 if wave in (5,34) else z+.30),.62 if wave in (5,34) else .85 if horse else .76,True)
  if identity=='roseguard':
   pts=[hctx['P']((-.27,-.235,.65)),hctx['P']((.27,-.235,.65)),(.39,-.51,.92),(.36,-.71,.47),(0,-.75,.40),(-.36,-.71,.47),(-.39,-.51,.92)]
   b.panel('Lionheart rider long maroon cape over horse back',pts,.042,'cloth',hctx['torso'],.040)
   for j in range(len(pts)):b.rod('Lionheart rider wide golden cape hem',pts[j],pts[(j+1)%len(pts)],.026,'gold',hctx['torso'],5)
  if wave in (27,34):
   mask_skull(b,hctx['P']((0,.40,hctx['facez']+.05)),hctx['fw']*(.61 if wave==34 else .56)*hctx['scale'],hctx['head'])
  if wave==27:
   for ob in set(b.objects)-before:
    if any(name in ob.name.lower() for name in ('hood','bodice','garment','shoulder plate','breastplate')):
     for j,mat in enumerate(ob.data.materials):ob.data.materials[j]=b.M['steel_dark']
  if wave in (5,34):
   for side in (-1,1):b.limb('Bat scout actual suspended harness strap',[(side*.18,-.08,z+.04),(side*.23,-.08,z-.80)],[.027]*2,'leather',root,5)
   b.rod('Scout square harness lower crossbar',(-.24,-.08,z-.79),(.24,-.08,z-.79),.027,'leather',root,5)
  if identity in ('phoenix','thunderheart'):
   for ob in set(b.objects)-before:
    for j,mt in enumerate(ob.data.materials):
     if mt in (b.M['cloth'],b.M['cloth_light']) or identity=='thunderheart' and mt in (b.M['steel'],b.M['steel_dark'],b.M['steel_light']):ob.data.materials[j]=b.M['riderpurple']
  # The scene contains both mount and rider. Rider pivots receive a prefix to
  # avoid accidentally animating mount knees as the rider's knees.
  # Kept humanoid standard names drive attack; mount standard names use FL..BR.
  for side in (-1,1):
   hand=hctx['hands']['L'];b.rod('Rider connected leather reins',hand,(side*.16,.76,headpos[2]-.04),.012,'leather',hctx['weapons']['L'],5)
   if wave not in (5,34):annulus(b,'Rider stirrup',(side*.31,-.01,z+.04),.065,.013,'steel',root,True,8,4)
  if wave==5:hctx['weapons']['R'].rotation_euler.x=math.pi
  if wave==50:
   b.box('Bernhard throne back',(0,-.35,z+.95),(.43,.14,1.12),'steel_dark',.027,root)
   for side in (-1,1):
    for j in range(2):cone(b,'Throne high finial',(side*(.23+j*.06),-.35,z+1.12-j*.15),(side*(.23+j*.06),-.35,z+1.39-j*.14),.055,'wood',root,4)
   b.jewel('Throne rear amber crest',(0,-.46,z+1.07),.075,.18,.04,'orange',root)
 if wave in (25,28):
  b.box('Riveted flight carapace',(0,.28,z),(.50,.12,.43),'steel',.025,root)
  for j in range(3):b.box('Flight armor panel',(0,.31,z-.12+j*.12),(.42,.08,.10),'steel_dark',.018,root)
  if wave==25:
   b.panel('Iron bat angular face mask',[(-.25,.50,z-.18),(-.23,.50,z+.15),(0,.53,z+.28),(.23,.50,z+.15),(.25,.50,z-.18),(0,.56,z-.27)],.045,'steel',head,.025)
   for side in (-1,1):b.box('Iron bat helmet rectangular eye',(side*.11,.544,z+.05),(.063,.012,.072),'dark',.002,head)
 if wave in (27,40):
  # Skeletal flight anatomy is visibly open. Membranes remain separate real
  # wings while skull, hollow chest and leg bones replace solid fleshy blocks.
  for ob in list(b.objects):
   if any(n in ob.name for n in ('Species continuous faceted trunk','Species chamfered head','Distinct species muzzle','Creature fang')):b.objects.remove(ob);bpy.data.objects.remove(ob,do_unlink=True)
  mask_skull(b,(headpos[0],headpos[1]+.17,headpos[2]),.28,head)
  for side in (-1,1):
   for j in range(5):b.limb('Skeletal wyvern open rib',[ (side*.06,-.28+j*.12,z+.32),(side*.33,-.28+j*.12,z+.16),(side*.21,-.28+j*.12,z-.20)],[.029]*3,'ivory',root,5)
  b.rod('Skeletal wyvern backbone',(0,-.49,z+.30),(0,.31,z+.30),.071,'ivory',root,6)
  if wave==40:
   b.root['attackStyle']='breath'
   b.jewel('Suspended necromancer soul lantern',(0,.27,z+.01),.085,.15,.07,'rune',root)
   b.box('Necromancer suspended heart face',(0,.30,z+.19),(.20,.13,.16),'skin',.019,root)
   for side in (-1,1):b.box('Heart necromancer eye',(side*.045,.371,z+.21),(.035,.012,.045),'eyes',.001,root)
 if wave==29:
  shards=b.pivot('refraction_shards',(0,.15,z+.33),root)
  for j in range(3):b.jewel('Separate prismatic flying shield shard',((j-1)*.51,.15,z+.23+(j==1)*.10),.095,.18,.075,'rune',shards)['visualCue']='refraction'
 if wave==30:
  for side in (-1,1):
   pts=[(side*.21,.47,z+.17),(side*.42,.48,z+.38),(side*.51,.47,z+.16),(side*.42,.47,z-.10),(side*.25,.48,z-.13),(side*.20,.48,z+.03)]
   b.limb('Storm wing lord actual large rolled gold bat horn',pts,[.089,.086,.081,.074,.055,.029],'gold',head,6)
 if wave==34:mask_skull(b,(0,headpos[1]+.27,headpos[2]+.05),.275,head)
 if wave==35:
  for side in (-1,1):crescent(b,'Eclipse bat large ivory crescent shoulder plate',(side*.62,.08,z+.32),.18,'ivory',root)
 if wave==45:
  # Two distinct riders share one flying mount and a large real drum.
  for ob in list(b.objects):
   if ob.name=='Rider saddle physical contact':continue
   # Existing rider assembly shifts right as a complete rigid root subtree.
  hctx['torso'].location.x+=.24
  for ob in hctx['legs'].values():ob.location.x+=.24
  second={**row,'id':row['id']+'_drummer','spec':{**s,'bodyKind':'humanoid','weapon':'fists','mounted':False,'helmet':True}}
  before=set(bpy.data.objects);humanoid(b,second,True,(-.25,-.06,z+.30),.65,True)
  for ob in set(bpy.data.objects)-before:
   if ob.type=='EMPTY':ob.name='drummer_'+ob.name.split('.')[0]
  ell(b,'Large shared troll-hide war drum',(0,.27,z+.65),(.26,.15,.25),'wood',root,10,3)
  annulus(b,'War drum metal rim',(0,.42,z+.65),.24,.026,'steel',root,True,10,4)
  skull(b,(0,.45,z+.65),.080,root)
  for prefix,xx in [('',.24),('drummer_',-.25)]:
   for side in (-1,1):
    label='R' if side>0 else 'L';pp=bpy.data.objects.get(prefix+'weapon_'+label)
    if pp:
     hand=pp.matrix_world.translation;b.rod('Actual drummer raised wooden stick',hand,(hand.x,hand.y,hand.z+.38),.018,'wood',pp,5);ell(b,'Drummer mallet wooden end',(hand.x,hand.y,hand.z+.40),(.034,.036,.043),'wood',pp,6,2)
 if wave==50:
  for ob in list(b.objects):
   if any(n in ob.name for n in ('Species chamfered head','Distinct species muzzle','Creature square eye','Creature fang','Anatomical creature ear')):b.objects.remove(ob);bpy.data.objects.remove(ob,do_unlink=True)
  hx,hy,hz=headpos
  rings=[]
  for yy,w,low,high in [(hy-.19,.29,hz-.15,hz+.24),(hy+.25,.21,hz-.20,hz+.10),(hy+.48,.07,hz-.29,hz-.02)]:rings.append([(hx-w,yy,low),(hx+w,yy,low),(hx+w,yy,high),(hx-w,yy,high)])
  b.loft('Lord Bernhard wyvern long hooked skull',rings,'steel_dark',head)
  for side in (-1,1):
   b.box('Wyvern amber eye',(hx+side*.21,hy+.27,hz+.065),(.068,.021,.042),'orange',.006,head)
   for j in range(3):cone(b,'Wyvern swept obsidian head horn',(hx+side*(.17+j*.03),hy-.01-j*.07,hz+.16),(hx+side*(.27+j*.065),hy-.28-j*.08,hz+.34+j*.035),.062,'steel_dark',head,5)
  # Throne rear is a peaked Gothic frame with real metal/wood rails.
  for ob in list(b.objects):
   if ob.name=='Bernhard throne back':b.objects.remove(ob);bpy.data.objects.remove(ob,do_unlink=True)
  b.panel('Bernhard peaked throne back',[(-.23,-.34,z+.40),(-.23,-.34,z+1.03),(0,-.34,z+1.25),(.23,-.34,z+1.03),(.23,-.34,z+.40)],.10,'cloth',root,.015)
  for side in (-1,1):b.rod('Throne angular side rail',(side*.24,-.36,z+.37),(side*.24,-.36,z+1.06),.033,'wood',root,5);b.rod('Throne peaked rail',(side*.24,-.36,z+1.06),(0,-.36,z+1.27),.030,'wood',root,5)
  for j in range(6):cone(b,'Obsidian dorsal armor plate',(0,-.54+j*.16,z+.25),(0,-.56+j*.16,z+.42),.082,'steel_dark',root,4)
  for ob in b.objects:
   if 'Physical sword blade' in ob.name:
    pts=[ob.matrix_world@v.co for v in ob.data.vertices];x=sum(q.x for q in pts)/len(pts);y=max(q.y for q in pts)+.01;zz=min(q.z for q in pts)
    b.rod('Bernhard amber sword rune channel',(x,y,zz+.14),(x,y,zz+.50),.014,'orange',bpy.data.objects.get('weapon_R'),4)
    b.jewel('Bernhard sword rune diamond',(x,y,zz+.43),.033,.075,.012,'orange',bpy.data.objects.get('weapon_R'));break
  b.jewel('Bernhard chest actual amber focus',(0,.205,z+.67),.065,.09,.042,'orange',bpy.data.objects.get('torso_pivot'))
  b.limb('Bernhard wyvern chest obsidian harness',[(headpos[0],.96,headpos[2]-.27),(-.19,.63,z+.15),(0,.42,z-.04)],[.10,.13,.16],'steel_dark',root,6)
 if wave==42:
  wp=bpy.data.objects.get('weapon_R')
  if wp:wp.rotation_euler.x=-math.radians(62)
 if wolf:
  for j in range(5):cone(b,'Wolf jagged dorsal ridge',(0,-.40+j*.18,z+.27),(0,-.42+j*.18,z+.44),.065,'steel_dark',root,4)
  if wave==47:
   skull(b,(0,headpos[1]+.29,headpos[2]+.03),.22,head)
   b.rod('Last howl actual banner pole',(-.30,-.30,z+.30),(-.30,-.30,z+1.52),.026,'wood',root,6)
   b.panel('Last howl large crimson standard',[(-.30,-.30,z+1.52),(.22,-.30,z+1.47),(.11,-.30,z+1.20),(.25,-.30,z+1.03),(-.30,-.30,z+1.10)],.020,'red',root,.010)
 if wave==48:
  for side in (-1,1):
   b.panel('Black fire thief long actual scarf',[(side*.12,-.16,z+.94),(side*.22,-.28,z+.82),(side*.27,-.80,z+.60),(side*.13,-.65,z+.74)],.019,'cloth',root,.009)
   cone(b,'Thief actual gold runic bell',(side*.26,.01,z+.45),(side*.26,.01,z+.30),.064,'gold',root,6);annulus(b,'Thief bell dark hollow mouth',(side*.26,.01,z+.30),.058,.014,'gold',root,False,8,4)

def manta(b,row):
 root=b.pivot('mount_torso_pivot',(0,0,.64));head=b.pivot('mount_head_pivot',(0,.32,.64),root)
 ell(b,'Flat broad manta continuous body',(0,-.08,.64),(.56,.58,.235),'cloth',root,12,4)
 b.box('Manta low angular head',(0,.50,.63),(.70,.34,.25),'cloth',.047,head)
 b.pivot('attack_muzzle',(0,.71,.60),head)
 ell(b,'Manta real broad dark oval mouth',(0,.686,.568),(.24,.014,.050),'dark',head,12,3)
 for side in (-1,1):
  b.box('Manta square eye',(side*.22,.686,.71),(.069,.014,.060),'eyes',.002,head)
  annulus(b,'Manta frontal curled mouth lobe',(side*.28,.692,.567),.077,.029,'cloth',head,True,8,4)
  wing=b.pivot('wing_'+('R' if side>0 else 'L'),(side*.29,0,.67),root)
  outline=[(side*.20,.36,.73),(side*.59,.22,.76),(side*1.16,.14,1.015),(side*.93,-.50,.69),(side*.53,-.64,.58),(side*.20,-.45,.61)]
  n=len(outline);vs=outline+[(x,y,z-.095) for x,y,z in outline]+[(side*.54,-.08,.755),(side*.54,-.08,.610)];fs=[]
  for j in range(n):
   k=(j+1)%n;fs.extend([(2*n,j,k),(2*n+1,k+n,j+n),(j,j+n,k+n,k)])
  b.mesh('Manta actual thick faceted full disc wing',vs,fs,'cloth',wing)
  for j in range(3):b.rod('Manta fin submerged bony support',(side*.30,0,.73),(side*(.62+j*.18),-.33+j*.16,.77),.012,'cloth_light',wing,5)
  for j in range(3):
   b.box('Manta white lightning rune stroke',(side*.72,-.06-j*.055,.822),(.055,.04,.011),'ivory',.001,wing)
 b.limb('Manta hooked tail',[(0,-.34,.67),(0,-.64,.68),(.16,-.92,.72)],[.066,.043,.014],'cloth',root,6)
 for j in range(3):b.box('Manta overlapping dorsal plate',(0,-.12+j*.14,.79),(.40,.16,.085),'steel',.021,root)
 s={**row['spec'],'bodyKind':'humanoid','mounted':False,'weapon':'spear','helmet':False,'hood':True,'armorPlates':False,'headShape':'diamond'};before=set(b.objects);ctx=humanoid(b,{**row,'spec':s},True,(0,-.06,.84),.80,True)
 for ob in set(b.objects)-before:
  if 'hood' in ob.name.lower():
   for j,mat in enumerate(ob.data.materials):ob.data.materials[j]=b.M['steel_dark']
 faceparent=ctx['head'];fz=ctx['P']((0,0,ctx['facez']))[2];b.panel('Manta rider intimidating red mask',[(-.105,.11,fz-.12),(.105,.11,fz-.12),(.12,.11,fz+.09),(0,.12,fz+.17),(-.12,.11,fz+.09)],.025,'red',faceparent,.02)
 for side in (-1,1):b.box('Manta red mask actual two black eye apertures',(side*.050,.145,fz+.035),(.046,.016,.053),'dark',.002,faceparent)
 pa=ctx['weapons']['R']
 hand=ctx['hands']['R'];xx,yy,zz=hand;b.panel('Manta rider real torn crimson spear pennant',[(xx,yy,zz+.58),(xx-.12,yy,zz+.55),(xx-.13,yy,zz+.21),(xx-.06,yy,zz+.27),(xx-.025,yy,zz+.14)],.016,'red',pa,.008)
 pa.rotation_euler.y=.42

def construct(b,row):
 if b.id in ('winterhold','emeraldgolem','mechanicalgolem'):
  from geometric_construct_source_v1 import build_source_construct
  return build_source_construct(b,row,ell,cone,leaf,annulus,gear)
 s=row['spec'];kind=s['elementalType'];nature=kind=='nature';ice=kind=='ice';stone=kind=='stone';mach=kind=='machine';skin='cloth';tor=b.pivot('torso_pivot',(0,0,.66));head=b.pivot('head_pivot',(0,0,1.22),tor)
 if nature:
  for j in range(3):b.jewel('Distinct floating lower crystal',((j-1)*.27,0,.19+abs(j-1)*.06),.115,.15,.11,'moss')
  for j in range(3):
   a=j*math.tau/3;b.limb('Intertwined curved nature root trunk',[(math.sin(a)*.11,math.cos(a)*.08,.36),(math.sin(a+.8)*.16,math.cos(a+.8)*.11,.61),(math.sin(a+1.6)*.14,math.cos(a+1.6)*.10,.86),(math.sin(a+2.4)*.16,math.cos(a+2.4)*.08,1.12)],[.10,.13,.12,.15],'wood',tor,6)
  for side in (-1,1):
   for j in range(3):leaf(b,'Nature layered leaf shoulder collar',(side*.04,.13,1.13),(side*(.26+j*.085),.18,1.01-j*.055),.10,'moss',tor)
 else:
  ell(b,'Construct faceted chest',(0,0,.98),(.38,.26,.33),skin,tor,8,3)
  if mach:
   b.box('Mechanical broad chest armor plate',(0,.26,.98),(.67,.12,.48),'cloth',.028,tor);gear(b,'Large chest actual golden gear',(0,.354,.98),.205,'gold',tor)
   for side in (-1,1):
    for zz in (.78,1.17):ell(b,'Machine chest gold rivet',(side*.27,.333,zz),(.024,.020,.024),'gold',tor,6,2)
  for side in (-1,1):
   sn='R' if side>0 else 'L';hip=(side*.17,0,.65);knee=(side*.24,0,.31);foot=(side*.27,.03,.10);up=b.pivot('upper_leg_'+sn,hip);sh=b.pivot('shin_'+sn,knee,up);fp=b.pivot('foot_'+sn,foot,sh)
   b.limb('Construct upper leg',[hip,knee],[.15,.14],skin,up,6);b.limb('Construct lower leg',[knee,foot],[.14,.12],skin,sh,6);b.box('Construct grounded shoe',(foot[0],.09,.10),(.34,.39,.20),'trim' if mach else skin,.032,fp)
 if stone:ell(b,'Golem low bulbous faceted stone head',(0,.01,1.32),(.36,.24,.26),'cloth',head,8,3)
 else:b.box('Observed face nature' if nature else 'Construct continuous chamfered head',(0,.01,1.33),(.52,.39,.34),'skin' if nature else skin,.040,head)
 if nature:
  aperture=[(x,.286,z) for x,z in [(0,1.515),(.20,1.51),(.278,1.47),(.278,1.20),(.19,1.135),(-.19,1.135),(-.278,1.20),(-.278,1.47),(-.20,1.51)]]
  b.hood('Continuous wrapped hood nature leaf shell',(0,0,1.33),.76,.64,.56,'moss',head,aperture)
  # Three overlapping rings of broad leaves close the rear and both sides;
  # the observed warm face is retained only inside the front aperture.
  for tier in range(3):
   zz=1.54-tier*.17
   for j in range(7):
    a=1.12+j*(math.tau-2.24)/6;rx=.395;ry=.305
    aa=Vector((rx*math.sin(a),ry*math.cos(a),zz+.08));cc=Vector((rx*1.10*math.sin(a),ry*1.10*math.cos(a),zz-.18));mid=aa.lerp(cc,.43);tan=Vector((math.cos(a),-math.sin(a),0))*.115
    b.panel('Nature real overlapping side and rear head leaf',[tuple(aa),tuple(mid+tan),tuple(cc),tuple(mid-tan)],.025,'moss' if (tier+j)%2 else 'cloth_light',head,.020)
 for side in (-1,1):b.box('Construct square eye',(side*.12,.211,1.35),(.072,.015,.09),'eyes',.002,head)
 for side in (-1,1):
  sn='R' if side>0 else 'L';sh=(side*.35,0,1.11);el=(side*.49,.04,.87);ha=(side*.57,.13,.65)
  if nature:el=(side*.52,.05,.98);ha=(side*.65,.13,1.12)
  up,fore,wrist,weap=joints(b,sh,el,ha,sn,tor)
  ell(b,'Construct angular shoulder',sh,(.21,.22,.17),skin,up,6,3);b.limb('Construct upper arm',[sh,el],[.14,.15],skin,up,6);b.limb('Construct forearm',[el,ha],[.16,.20],skin,fore,6)
  if nature:
   ell(b,'Nature rounded bark palm',ha,(.10,.095,.10),'wood',wrist,6,3);b.jewel('Nature held green elemental jewel',(ha[0],ha[1]+.025,ha[2]+.19),.10,.17,.080,'moss',weap)
   for j in range(3):leaf(b,'Nature hand leaf fingers',(ha[0]+(j-1)*.045,ha[1],ha[2]),(ha[0]+(j-1)*.075,ha[1]+.015,ha[2]+.17),.039,'moss',wrist)
  elif mach and side>0:
   b.box('Mechanical double cannon housing',(ha[0],.13,ha[2]),(.34,.38,.29),'cloth',.035,weap)
   for j in (-1,1):
    xx=ha[0]+j*.097;b.rod('Arm cannon long forged barrel',(xx,.12,ha[2]),(xx,.49,ha[2]),.084,'steel_dark',weap,8);annulus(b,'Actual large cannon golden hollow muzzle',(xx,.515,ha[2]),.069,.026,'gold',weap,True,10,4);ell(b,'Cannon recessed black bore',(xx,.496,ha[2]),(.047,.007,.047),'dark',weap,8,2)
   b.pivot('attack_muzzle',(ha[0],.545,ha[2]),weap)
  elif mach:
   b.box('Massive mechanical golden fist',(ha[0],ha[1]+.035,ha[2]),(.43,.39,.40),'cloth',.044,wrist)
   for xx in (-.185,.185):b.box('Mechanical fist golden side binding',(ha[0]+xx,ha[1]+.052,ha[2]),(.064,.42,.42),'gold',.016,wrist)
   for j in range(3):b.box('Mechanical large articulated front knuckle',(ha[0]+(j-1)*.105,ha[1]+.259,ha[2]+.06),(.095,.05,.22),'steel',.009,wrist)
  else:ell(b,'Massive asymmetric faceted fist',ha,(.29 if side>0 and stone else .22,.25,.27),skin,wrist,7,3)
 if stone:
  random.seed(411)
  for ob in list(b.objects):
   if any(n in ob.name for n in ('Construct faceted chest','Construct angular shoulder','Construct forearm','Construct upper leg','Construct lower leg','Massive asymmetric')):
    pts=[ob.matrix_world@v.co for v in ob.data.vertices];centre=sum(pts,Vector())/len(pts)
    for j in range(3):
     pp=(centre.x+(j-1)*.065,centre.y+.17,centre.z+.06*(j-1));leaf(b,'Stone golem raised green vine leaf',pp,(pp[0]+.11,pp[1]+.005,pp[2]+.08),.046,'moss',ob.parent)
    b.limb('Golem actual winding vine',[(centre.x-.09,centre.y+.20,centre.z-.15),(centre.x+.11,centre.y+.23,centre.z),(centre.x-.05,centre.y+.20,centre.z+.15)],[.018]*3,'moss',ob.parent,5)
 if not mach:
  for j in range(s.get('crystals',3)):
   a=(j-(s.get('crystals',3)-1)/2)*.48;b.jewel('Large shoulder crystal',(.44*math.sin(a),-.16,1.49+.16*math.cos(a)),.11,.26+.08*math.cos(a),.11,'moss' if stone or nature else 'rune',tor)
 if mach:
  for side in (-1,1):b.limb('Two mechanical exhaust chimney',[(side*.23,-.18,1.20),(side*.35,-.20,1.64)],[.091,.091],'steel_dark',tor,8);annulus(b,'Chimney hollow gold mouth',(side*.35,-.20,1.64),.087,.022,'gold',tor,False,8,4)
 if nature:
  crow={'id':b.id,'spec':{**s,'antlers':True,'antlerBranches':4},'category':'champions'}
  dummy={'P':lambda q:q,'SZ':lambda q:q,'torso':tor,'head':head,'facez':1.33,'fw':.52,'fh':.40,'tw':.30,'belt':.65,'shoulder':1.12,'scale':1,'enemy':False,'arms':{'R':bpy.data.objects['upper_arm_R'],'L':bpy.data.objects['upper_arm_L']}}
  decoration(b,crow,dummy)

def siege(b,row):
 s=row['spec'];engine=s.get('engineType');root=b.pivot('torso_pivot',(0,0,.48));weapon=b.pivot('weapon_R',(0,0,.75),root)
 b.box('Siege continuous structural chassis',(0,0,.36),(.73,1.01,.21),'wood',.036,root)
 for side in (-1,1):
  for j in (-1,1):
   x=side*.46;y=j*.35;pa=b.pivot('wheel_'+str(side)+'_'+str(j),(x,y,.24));n=12;vs=[];fs=[]
   for xx,rad in [(x-.087,.238),(x+.087,.238),(x-.087,.150),(x+.087,.150)]:vs.extend([(xx,y+math.sin(k*math.tau/n)*rad,.24+math.cos(k*math.tau/n)*rad) for k in range(n)])
   for k in range(n):kk=(k+1)%n;fs.extend([(k,kk,n+kk,n+k),(2*n+k,3*n+k,3*n+kk,2*n+kk),(k,2*n+k,2*n+kk,kk),(n+k,n+kk,3*n+kk,3*n+k)])
   b.mesh('Actual thick annular iron wagon wheel',vs,fs,'steel_dark',pa)
   for k in range(6):
    a=k*math.tau/6;b.rod('Wheel actual heavy timber spoke',(x,y,.24),(x,y+math.sin(a)*.193,.24+math.cos(a)*.193),.037,'wood',pa,5);ell(b,'Wheel visible outer face metal rivet',(x+side*.090,y+math.sin(a)*.20,.24+math.cos(a)*.20),(.018,.023,.023),'steel',pa,6,2)
   b.rod('Wheel actual large axle hub',(x-.13,y,.24),(x+.13,y,.24),.075,'gold',pa,8)
   b.rod('Wheel spanning axle',(-.48,y,.24),(.48,y,.24),.034,'steel',root,6)
 for side in (-1,1):
  b.box('Siege actual outer timber chassis rail',(side*.30,0,.41),(.13,1.05,.14),'wood',.018,root)
  for yy in (-.37,.37):
   b.box('Cart structural iron corner binding',(side*.30,yy,.435),(.15,.105,.16),'steel_dark',.012,root);ell(b,'Siege structural visible golden bolt',(side*.30,yy+.062,.45),(.025,.015,.025),'gold',root,6,2)
 if engine in ('ballista','fireBallista'):
  b.box('Ballista center launching rail',(0,.08,.67),(.18,1.32,.12),'wood',.02,weapon)
  b.box('Ballista actual recessed firing groove',(0,.13,.737),(.050,1.17,.012),'dark',.003,weapon)
  for side in (-1,1):
   b.limb('Ballista physical diagonal stock support',[(side*.27,-.35,.44),(side*.26,.08,.71),(side*.28,.35,.44)],[.049]*3,'wood',root,4)
  for z in [.78] if engine=='ballista' else [.65,.98]:
   pts=[(-.64,.35,z),(-.36,.45,z),(-.12,.40,z),(0,.36,z),(.12,.40,z),(.36,.45,z),(.64,.35,z)];b.limb('Ballista wide articulated bow',pts,[.064]*len(pts),'wood',weapon,5);b.rod('Ballista taut bowstring',pts[0],pts[-1],.012,'ivory',weapon,4)
   for xx in (-.36,0,.36):b.box('Ballista bow limb iron binding',(xx,.445 if xx else .38,z),(.067,.16,.14),'steel_dark',.009,weapon)
  b.rod('Loaded central long bolt',(0,-.53,.78),(0,.75,.78),.021,'steel',weapon,6);cone(b,'Large ballista bolt point',(0,.72,.78),(0,.97,.78),.072,'orange' if engine=='fireBallista' else 'steel_light',weapon,4)
  if engine=='fireBallista':
   for j in range(3):b.jewel('Separate fire ammo crystal',((j-1)*.20,-.37,.92),.085,.13,.073,'red',root)
 elif engine=='catapult':
  for side in (-1,1):
   b.limb('Triangular catapult upright',[(side*.34,-.35,.42),(side*.32,0,1.06),(side*.34,.33,.42)],[.066]*3,'wood',root,5)
  b.rod('Catapult transverse throwing pivot',(-.43,0,1.02),(.43,0,1.02),.064,'gold',root,8)
  b.rod('Single loaded throwing arm',(0,.30,.55),(0,-.50,1.35),.065,'wood',weapon,5);annulus(b,'Catapult actual hollow loaded bowl',(0,-.51,1.36),.18,.055,'wood',weapon,False,10,4);ell(b,'Loaded faceted stone',(0,-.51,1.41),(.14,.14,.15),'steel',weapon,8,3)
  b.jewel('Front firing direction gold marker',(0,.54,.43),.12,.16,.035,'gold',root)
 else:
  b.box('Royal cannon rotating turret',(0,.02,.80),(.69,.63,.38),'cloth',.044,weapon)
  for side in (-1,1):
   for yy in (-.22,.21):ell(b,'Royal cannon gilded armor stud',(side*.33,yy,.82),(.024,.024,.026),'gold',weapon,6,2)
  # The approved crown is embossed on the blue LOWER carriage plates, below
  # the muzzles. It is not a physical crown on top of the rotating turret.
  b.box('Royal arsenal blue lower front heraldic plate',(0,.551,.445),(.66,.044,.24),'cloth',.012,root)
  mark=[(-.13,-.085),(-.16,.105),(-.065,.045),(0,.16),(.065,.045),(.16,.105),(.13,-.085)]
  b.panel('Royal cannon visible lower front golden crown emblem',[(xx,.586,.445+zz) for xx,zz in mark],.024,'gold',root,.012)
  for side in (-1,1):
   b.box('Royal arsenal blue lower flank heraldic plate',(side*.387,0,.445),(.038,.59,.25),'cloth',.010,root)
   b.panel('Royal cannon visible lower side gold crown emblem',[(side*.414,-xx,.445+zz) for xx,zz in mark],.022,'gold',root,.011)
  for j in range(3):
   x=(j-1)*.21;b.rod('Three cannon forged barrel',(x,.15,.85),(x,.68,.85),.083,'steel_dark',weapon,8);annulus(b,'Cannon real hollow muzzle',(x,.70,.85),.073,.020,'gold',weapon,True,8,4);b.box('Cannon dark recessed bore',(x,.685,.85),(.102,.008,.102),'dark',.012,weapon)
  leaf(b,'Lightning antenna',(0,0,1.03),(.13,0,1.43),.050,'gold',weapon)
 b.rod('Rear loading winch',(-.27,-.50,.52),(.27,-.50,.52),.052,'steel_dark',root,8)
 annulus(b,'Rear loading crank',(.33,-.50,.52),.11,.021,'gold',root,True,8,4)
 b.pivot('attack_muzzle',(0,.95,.78 if engine!='tripleCannon' else .85),weapon)

def goblin_machine(b,row):
 """Riveted mutant frame or actual engine-driven scrap wingcraft."""
 wave=row['spec']['wave'];flying=wave==28;root=b.pivot('mount_torso_pivot' if flying else 'torso_pivot',(0,0,.72));head=None if flying else b.pivot('head_pivot',(0,.01,1.30),root)
 if flying:
  b.box('Scrapwing actual central wood engine chassis',(0,.01,.65),(.66,.54,.54),'wood',.035,root)
  b.box('Scrapwing bolted frontal engine plate',(0,.312,.65),(.58,.064,.47),'steel',.019,root)
  for side in (-1,1):
   b.limb('Scrapwing real barrel engine',[(side*.32,0,.68),(side*.51,0,.68)],[.17,.17],'wood',root,8)
   annulus(b,'Barrel engine metallic rim',(side*.49,0,.68),.166,.027,'steel_dark',root,True,8,4)
   pa=b.pivot('wing_'+('R' if side>0 else 'L'),(side*.30,-.03,.81),root)
   pts=[(side*.28,-.03,.82),(side*1.14,-.055,1.62),(side*1.08,-.06,.64),(side*.52,-.05,.48)]
   b.panel('Actual rigid tan scrapwing sail',pts,.026,'wood',pa,.020)
   for a,c in [(pts[0],pts[1]),(pts[1],pts[2]),(pts[0],pts[2]),(pts[2],pts[3])]:b.rod('Scrapwing real iron timber wing strut',a,c,.027,'steel_dark',pa,5)
   for j in range(3):ell(b,'Wingframe hexagonal hinge',(side*(.37+j*.25),-.022,.90+j*.23),(.057,.025,.057),'steel',pa,6,2)
  pilot={**row,'spec':{**row['spec'],'bodyKind':'goblin','mounted':False,'hood':True,'wings':False,'wingStyle':None,'helmet':False}}
  # Attack limbs stay standard; the hull receives no duplicate humanoid head.
  humanoid(b,pilot,True,(0,-.07,.92),.58,True)
  cone(b,'Scrapwing underside actual metal keel',(0,0,.41),(0,0,.24),.15,'steel_dark',root,4)
 else:
  b.box('Mutant actual wood chest chassis',(0,0,.90),(.64,.50,.69),'wood',.031,root)
  for j in range(3):
   for k in range(3):
    x=(j-1)*.173;z=.92+(k-1)*.18;b.box('Mutant separate riveted chest tile',(x,.272,z),(.16,.055,.165),'steel',.009,root);ell(b,'Mutant chest actual raised rivet',(x,.309,z),(.025,.016,.025),'steel_dark',root,6,2)
  face(b,head,(0,.10,1.37),.33,.29,False,True,False,True,False,None,False)
  for side in (-1,1):
   b.box('Mutant enclosing upright wood pilot frame',(side*.31,-.012,1.40),(.16,.49,.61),'wood',.019,head)
   for j in range(3):ell(b,'Pilot frame actual iron rivet',(side*.31,.254,1.17+j*.23),(.028,.015,.028),'steel',head,6,2)
  for zz in (1.11,1.69):b.box('Mutant enclosing metal frame crosspiece',(0,-.012,zz),(.71,.50,.10),'steel_dark',.017,head)
  for side in (-1,1):
   sn='R' if side>0 else 'L';sh=(side*.42,0,1.14);el=(side*.55,.035,.88);ha=(side*.65,.08,.60);up,fore,wrist,weap=joints(b,sh,el,ha,sn,root)
   b.box('Mutant massive hinged shoulder armor',sh,(.27,.42,.26),'steel',.025,up)
   b.limb('Mutant actual boxlike upper arm',[sh,el],[.15,.14],'wood',up,4);b.limb('Mutant massive forearm gauntlet',[el,ha],[.18,.21],'steel',fore,4)
   if side<0:gear(b,'Mutant huge handheld iron cogwheel',(ha[0],ha[1]+.19,ha[2]),.235,'steel_dark',weap)
   else:b.box('Mutant actual heavy iron fist',ha,(.31,.36,.31),'steel_dark',.021,wrist)
   hip=(side*.22,0,.60);knee=(side*.29,.035,.32);ank=(side*.31,.055,.13);th=b.pivot('upper_leg_'+sn,hip);shin=b.pivot('shin_'+sn,knee,th);foot=b.pivot('foot_'+sn,ank,shin)
   b.limb('Mutant hinged upper iron leg',[hip,knee],[.14,.14],'wood',th,4);b.limb('Mutant hinged lower iron leg',[knee,ank],[.16,.18],'steel',shin,4);b.box('Construct grounded shoe',(ank[0],.12,.105),(.36,.42,.21),'steel',.023,foot)
   for parent,pos in [(up,sh),(fore,el),(shin,knee),(foot,ank)]:ell(b,'Mutant actual gold iron hinge rivet',(pos[0],pos[1]+.22,pos[2]),(.030,.018,.030),'steel_dark',parent,6,2)

def build(row):
 b=Builder(row['id'],palette(row));s=row['spec'];kind=s.get('bodyKind','humanoid')
 if b.id=='mothernature':
  from geometric_champion_creature_fit_v4 import build_integrated_nature_v4
  build_integrated_nature_v4(b,row)
 elif s.get('wave') in (22,26,43):
  from geometric_heavy_orc_source_v1 import build_source_heavy_orc
  build_source_heavy_orc(b,row,ell,cone,leaf,annulus,gear)
 elif s.get('wave') in (24,28):goblin_machine(b,row)
 elif kind=='siege':siege(b,row)
 elif kind=='elemental':construct(b,row)
 elif kind in ('horse','dragon','bird','beast','bat','wyvern'):beast(b,row)
 else:humanoid(b,row)
 flying=s.get('flying') or s.get('floating') or kind in ('bat','bird','wyvern')
 b.root['locomotion']=b.root.get('locomotion','flying' if flying else 'quadruped' if kind in ('horse','dragon','beast') else 'crawler' if kind=='siege' else 'biped')
 b.root['attackStyle']=b.root.get('attackStyle','siege' if kind=='siege' else 'breath' if kind in ('dragon','bird','beast','wyvern') and not s.get('mounted') else s.get('weapon','staff'))
 b.root['sourceRevision']='geometric-turnarounds-v1';b.root['sourceFile']=row['source'];b.root['sourceSha256']=row['sha256'];b.root['scaleAssumption']='Source has no dimensions; human scale approx 1.8m, species anatomy retained.'
 from geometric_champion_creature_fit_v4 import apply_source_fit_v4
 apply_source_fit_v4(b,row)
 b.root['anatomyRevision']=b.root.get('anatomyRevision','geometric-contact-anatomy-v2')
 return b
