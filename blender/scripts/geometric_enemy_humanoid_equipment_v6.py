"""Source-specific V6 enemy heads, fitted clothing/armor and whole held gear.

Pure Blender scene helpers: no native, raster, export or manifest IO. The two
owned authors load immutable V5 scenes and call this once. Mounted mode leaves
all rider spine/hip/leg/seat transforms untouched. +Y forward, metres, Z up.
"""
import bpy,math,json
from mathutils import Vector,Matrix
from geometric_game_common import metrics
from geometric_roster_builder import ell,cone,annulus,leaf,gear
from geometric_champion_creature_fit_v4 import semantic,descendants,remove
from geometric_champion_shapes_v5 import material,boolean,tree

UNMOUNTED=(1,2,3,4,6,7,8,9,10,11,12,13,14,16,17,18,20,21,22,23,24,26,31,32,33,36,38,41,43,44,46,49)
# width / actual thorax width, height / width, depth / width, source head cover.
# Values are source-specific estimates; no common enemy head normalization.
HEAD={1:(.79,.76,.69,'hood'),2:(1.43,.72,.66,'ears'),3:(.48,.82,.70,'pot'),4:(.80,.79,.67,'cap'),6:(.47,.78,.70,'bare'),7:(.77,.73,.65,'crocodile'),8:(.52,.79,.67,'bare'),9:(.82,.65,.64,'hood-mask'),10:(.52,.83,.71,'horn-cap'),11:(.70,.78,.67,'cap'),12:(.50,.82,.66,'ears'),13:(.75,.77,.66,'braids'),14:(.72,.79,.67,'cap'),16:(.69,.82,.66,'gold-mask'),17:(.50,.80,.72,'bare'),18:(.69,.80,.67,'tall-hood'),20:(.50,.78,.70,'bone-crown'),21:(.48,.79,.74,'bare'),22:(.69,.79,.69,'ram-cap'),23:(.69,.70,.65,'hood'),24:(.58,.78,.66,'ears'),26:(.55,.79,.73,'bare'),31:(.66,.72,.65,'twin-hood'),32:(.48,.79,.73,'bare'),33:(.72,.73,.67,'hood'),36:(.72,.80,.68,'crown'),38:(.77,.70,.65,'hood-mask'),41:(.75,.77,.67,'cap'),43:(.54,.80,.71,'cap'),44:(.68,.81,.67,'closed-mask'),46:(.54,.87,.73,'hollow-helmet'),49:(.53,.74,.77,'bare')}
RIDER_HEAD={5:'ears',15:'red-hair',19:'red-hood',25:'cap',27:'hood-skull',28:'hood',29:'hood',30:'crown',34:'skull-mask',35:'crescent-cap',37:'hood',39:'red-mask',42:'cap',45:'cap',47:'hood',48:'hood',50:'tall-hood'}

def sem(b,prefix,parent=None):
 return[o for o in b.objects if semantic(o).startswith(prefix) and (parent is None or descendants(o,parent))]
def bound(obs):
 assert obs,'missing actual structural selection'
 q=metrics(obs);return Vector(q['boundsMin']),Vector(q['boundsMax'])
def center(obs):
 lo,hi=bound(obs);return(lo+hi)/2
def pivot(b,name):
 exact=[o for o in b.root.children_recursive if o.type=='EMPTY'and o.name==name]
 if not exact:exact=[o for o in b.root.children_recursive if o.type=='EMPTY'and o.name.split('.')[0]==name]
 return exact[0]if exact else None
def gone(b,obs):
 remove(b,list(set(obs)))
def endpoint(b,pa,name,p):
 nodes=[o for o in pa.children_recursive if o.type=='EMPTY'and o.name.split('.')[0]==name]
 ob=nodes[0]if nodes else b.pivot(name,p,pa);bpy.context.view_layer.update();m=ob.matrix_world.copy();m.translation=Vector(p);ob.matrix_world=m;return ob
def bend(b,name,pts,radii,mat,pa,n=10):
 return b.limb(name,[tuple(p)for p in pts],radii,mat,pa,n)

def grid_shell(b,name,xs,zs,y_function,thick,mat,pa,holes=()):
 """One closed curved shell with genuine empty grid-cell apertures."""
 nx=len(xs);nz=len(zs);vs=[]
 for depth in(0,-thick):
  vs.extend((x,y_function(x,z)+depth,z)for z in zs for x in xs)
 N=nx*nz;faces=[];edge={}
 for j in range(nz-1):
  for i in range(nx-1):
   if(i,j)in holes:continue
   q=(j*nx+i,j*nx+i+1,(j+1)*nx+i+1,(j+1)*nx+i);faces+=[q,tuple(reversed(tuple(a+N for a in q)))]
   for a,c in zip(q,q[1:]+q[:1]):edge.setdefault(tuple(sorted((a,c))),[]).append((a,c))
 for uses in edge.values():
  if len(uses)==1:
   a,c=uses[0];faces.append((a,a+N,c+N,c))
 return b.mesh(name,vs,faces,mat,pa)

def source_hood(b,pa,c,w,h,d,mode='hood'):
 """Peaked cloth wraps a domed rear scalp rather than extruded flat board."""
 x,y,z=c;front=y+d*.50;rear=y-d*.56
 if mode=='twin-hood':
  outer=[(-.62,-.62),(-.71,-.24),(-.68,.58),(-.38,1.50),(0,.78),(.38,1.50),(.68,.58),(.71,-.24),(.62,-.62),(0,-.70)]
  inner=[(-.49,-.44),(-.52,-.18),(-.50,.24),(-.33,.43),(0,.60),(.33,.43),(.50,.24),(.52,-.18),(.49,-.44),(0,-.52)]
 else:
  peak=1.50 if mode=='tall-hood'else .96
  outer=[(0,peak),(.45,.69),(.68,.17),(.66,-.46),(.43,-.68),(-.43,-.68),(-.66,-.46),(-.68,.17),(-.45,.69)]
  inner=[(0,.65),(.34,.49),(.51,.22),(.51,-.43),(.39,-.52),(-.39,-.52),(-.51,-.43),(-.51,.22),(-.34,.49)]
 n=len(outer);rings=[]
 for yy,sx,sz in[(front,1,1),(y-d*.18,.96,.96),(rear,.68,.79)]:rings.append([(x+a*w*sx,yy,z+q*h*sz)for a,q in outer])
 rings.append([(x+a*w,front+.002,z+q*h)for a,q in inner]);rings.append([(x+a*w*.93,rear+.028,z+q*h*.92)for a,q in inner])
 vs=[p for ring in rings for p in ring]+[(x,rear-.024,z+h*.12)];faces=[]
 for i in range(n):
  j=(i+1)%n;faces.extend([(i,j,n+j,n+i),(n+i,n+j,2*n+j,2*n+i),(2*n+i,2*n+j,5*n),(i,3*n+i,3*n+j,j),(3*n+i,4*n+i,4*n+j,3*n+j)])
 faces.append(tuple(reversed(range(4*n,5*n))))
 ob=b.mesh('V6 source fitted domed cloth hood',vs,faces,['steel_dark','steel']if b.id=='host_46'else'leather'if b.id=='host_19'else['cloth','cloth_light'],pa)
 b.coverage.append({'type':'hood','shell':semantic(ob),'actualFaceBearing':'Observed face','sourceMode':mode,'rule':'Genuine aperture; protected top/back/side actual skin rays required, no hidden scalp proxy.'})
 return ob

def source_cap(b,pa,c,w,h,d,mode='cap'):
 x,y,z=c;base=z+h*.46
 metal='v6_rust_steel' if b.id=='host_04' else 'purple' if b.id=='host_35' else 'steel'
 ob=b.loft('V6 source fitted rounded metal cap',[b.ring(x,y,base,w*.55,d*.54,12),b.ring(x,y-.01,base+h*.22,w*.54,d*.52,12),b.ring(x,y-.01,base+h*.40,w*.30,d*.32,12),b.ring(x,y,base+h*.43,w*.12,d*.13,12)],['steel_dark',metal],pa)
 if b.id in('host_10','host_14'):ob['semanticPart']='V6 source fitted rounded metal cap helmet shell';ob.name=ob['semanticPart'];ob.data.name=ob['semanticPart']+' mesh'
 b.loft('V6 source seated metal cap rim',[b.ring(x,y,base-.012,w*.555,d*.555,12),b.ring(x,y,base+.025,w*.559,d*.559,12)],'steel',pa)
 # Short forehead band follows the cap instead of a tall slab down the back.
 grid_shell(b,'V6 source riveted forehead strap',[x-w*.13,x+w*.13],[base-.04,base+h*.39],lambda xx,zz:y+d*.51-.025*(zz-base)/h,.019,'steel',pa)
 for sx in(-1,1):ell(b,'V6 cap physical brow rivet',(x+sx*w*.095,y+d*.515,base+.012),(.012,.008,.012),'steel_dark',pa,8,3)
 if mode in('horn-cap','ram-cap'):
  for sign in(-1,1):
   if mode=='ram-cap':pts=[(x+sign*w*.49,y-.03,base+h*.13),(x+sign*w*.81,y-.035,base+h*.42),(x+sign*w*.91,y+.03,base+h*.09),(x+sign*w*.69,y+.07,base-h*.05),(x+sign*w*.63,y+.10,base+h*.05)]
   else:pts=[(x+sign*w*.47,y-.03,base+h*.14),(x+sign*w*.72,y-.02,base+h*.24),(x+sign*w*.78,y+.015,base+h*.57),(x+sign*w*.70,y+.02,base+h*.78)]
   bend(b,'V6 source curved contacting helmet horn',pts,[w*.13,w*.13,w*.095,w*.02]if len(pts)==4 else[w*.16,w*.14,w*.105,w*.08,w*.016],'wood'if mode=='ram-cap'else'ivory',pa)
 return ob

def real_mask(b,pa,c,w,h,d,mat='gold',full=True):
 x,y,z=c;front=y+d*.5;xs=[x-w*.49,x-w*.31,x-w*.12,x+w*.12,x+w*.31,x+w*.49]
 zs=[z-h*.45,z-h*.06,z+h*.08,z+h*.28,z+h*.46]
 ob=grid_shell(b,'V6 source continuous fitted mask with real eye openings',xs,zs,lambda xx,zz:front+.030+.040*max(0,1-abs(xx-x)/(w*.5))-.018*abs(zz-z)/h,.019,mat,pa,((1,2),(3,2)))
 ob['realEyeApertures']=2;ob['maskIsContinuousShell']=True
 for sign in(-1,1):
  bend(b,'V6 mask actual contacting side fastening band',[(x+sign*w*.47,front+.027,z),(x+sign*w*.52,y+d*.26,z),(x+sign*w*.51,y-d*.27,z)],[w*.038,w*.040,w*.039],mat,pa,8)
 return ob

def ears(b,pa,c,w,h,d):
 x,y,z=c
 for sign in(-1,1):
  reach=1.08 if b.id in('host_02','host_09')else .84
  outline=[(x+sign*w*.43,y+d*.06,z+h*.18),(x+sign*w*reach,y-d*.03,z+h*.65),(x+sign*w*(reach-.13),y+d*.12,z+h*.06),(x+sign*w*.47,y+d*.14,z-h*.02)]
  b.panel('V6 source pointed ear with broad anatomical root',outline,w*.11,['skin','skin_light'],pa,w*.045)

def source_scrap_pose(b):
 """Source tinker is squat; shorten legs and lower its attached upper body."""
 def zfit(z):return z*.72 if z<.47 else z-.1316
 mesh_positions={o:[o.matrix_world@v.co for v in o.data.vertices]for o in b.objects}
 def depth(o):return 0 if o.parent is None else 1+depth(o.parent)
 empties=sorted([o for o in b.root.children_recursive if o.type=='EMPTY'],key=depth)
 matrices={o:o.matrix_world.copy()for o in empties}
 for ob in empties:
  m=matrices[ob];m.translation.z=zfit(m.translation.z);ob.matrix_world=m
 bpy.context.view_layer.update()
 for ob,ps in mesh_positions.items():
  inv=ob.matrix_world.inverted()
  for v,p in zip(ob.data.vertices,ps):p.z=zfit(p.z);v.co=inv@p
  ob.data.update()

 # The unarmed source left fist hangs beside the hip, leaving the broad
 # shoulder plate visible, instead of extending in front of its metal face.
 for name,delta in(('forearm_L',Vector((0,-.025,-.035))),('hand_L',Vector((0,-.13,-.145)))):
  ob=pivot(b,name);m=ob.matrix_world.copy();m.translation+=delta;ob.matrix_world=m
 bpy.context.view_layer.update()
 # Pack, braces, crank and actual gear remain one fitted physical assembly.
 pack=sem(b,'Actual crooked scrap backpack');pc=center(pack)
 targets=sem(b,('Actual crooked scrap backpack','Scrap backpack','Source backpack top actual cogwheel'))
 for ob in targets:
  inv=ob.matrix_world.inverted()
  for v in ob.data.vertices:
   p=ob.matrix_world@v.co;p=pc+(p-pc)*.77;p.y+=.045;v.co=inv@p
  ob.data.update()

def source_small_bell_carrier(b,anatomy):
 # A small goblin carries an outsized bell in the source. Physical full
 # body/joints scale together before its separate bell is reconstructed.
 factor=.78
 for ob in b.root.children_recursive:
  if ob.type=='MESH':
   for v in ob.data.vertices:v.co*=factor
   ob.data.update()
  ob.location*=factor
 bpy.context.view_layer.update()
 if anatomy and anatomy.get('headSeatM'):anatomy['headSeatM']=[x*factor for x in anatomy['headSeatM']]

def heads(b,entry,mounted,anatomy):
 wave=int(entry['id'].split('_')[1]);oldfaces=sem(b,'Observed face');parents=list(dict.fromkeys(o.parent for o in oldfaces))
 if not parents:
  parent=pivot(b,'head_pivot');parents=[parent]if parent and wave!=40 else[]
 torso=sem(b,('V6 source anatomical thorax','V6 rider source seated thorax','Tailored continuous bodice','Faceted species chest','Mutant actual wood chest chassis','Separated phantom armor upper chest plate'))
 bodywidth=(bound(torso)[1].x-bound(torso)[0].x)if torso else .58
 records=[]
 for pa in parents:
  fs=sem(b,'Observed face',pa);oldlo,oldhi=bound(fs)if fs else bound(sem(b,('Helmet solid crown shell',),pa));oc=(oldlo+oldhi)/2
  head_anatomy=(anatomy or{}).get('secondDrummer',{})if pa.name.startswith('drummer_')else(anatomy or{})
  if mounted:
   w=(oldhi.x-oldlo.x)*.83;h=(oldhi.z-oldlo.z)*.92;d=w*.66;mode=RIDER_HEAD.get(wave,'hood');base=Vector(head_anatomy['headSeatM']).z if head_anatomy.get('headSeatM')else oldlo.z
  else:
   fw,fh,fd,mode=HEAD[wave];w=bodywidth*fw;h=w*fh;d=w*fd;base=Vector(anatomy['headSeatM']).z if anatomy and anatomy.get('headSeatM')else oldlo.z
  cy=Vector(head_anatomy['headSeatM']).y if head_anatomy.get('headSeatM')else oc.y
  c=Vector((oc.x,cy,base+h*.5));oldparts=sem(b,('Observed face','Orc broad jaw','Orc actual broad exposed lower jaw','Eye ','Ivory tusk','Pointed anatomical ear','Continuous wrapped hood','Helmet ','Red braid','Huntress','Red braided','Lower cloth face mask','Dust dancer','Ash pickpocket','Copper mask','Crown continuous band','Crown tall tooth','Twin long hood','Inquisitor angled golden forehead','Inquisitor real gold hood aperture','Ash executioner opaque','Ash executioner long ivory'),pa)
  gone(b,oldparts)
  if mode=='hollow-helmet':
   source_hood(b,pa,c,w,h,d,'hood');real_mask(b,pa,c,w,h,d,'steel_dark');gone(b,sem(b,'V6 source continuous fitted mask',pa));ell(b,'V6 hollow helmet deep dark cavity',(c.x,c.y+d*.08,c.z),(w*.43,d*.18,h*.38),'dark',pa,10,4)
   for sign in(-1,1):bend(b,'V6 revenant real armored hollow cheek',[(c.x+sign*w*.49,c.y+d*.48,c.z+h*.2),(c.x+sign*w*.47,c.y+d*.46,c.z-h*.45)],[w*.07,w*.08],'steel',pa)
  else:
   if wave==49:
    polygon=[(-.34,.50),(.34,.50),(.50,.31),(.48,-.32),(.31,-.50),(-.31,-.50),(-.48,-.32),(-.50,.31)]
    face=b.loft('Observed face',[[(c.x+a*w*factor,c.y+q*d,c.z+h*zz)for a,q in polygon]for factor,zz in((.87,-.50),(1,-.20),(1.03,.23),(.85,.50))],['skin','skin_light'],pa)
   else:face=b.box('Observed face',c,(w,d,h),['skin','skin_light'],min(.042,w*.105),pa)
   front=c.y+d*.5
   for sign in(-1,1):b.box('Eye '+('R'if sign>0 else'L'),(c.x+sign*w*.22,front+.004,c.z+h*.13),(w*.12,.012,h*.15),'eyes',.002,pa)
   if wave not in(2,3,4,5,9,12,16,24,27,34,38,39,44,45):
    b.box('Orc broad jaw',(c.x,front+(.045 if wave==49 else .015),c.z-h*.29),(w*(1.04 if wave==49 else .92),w*(.27 if wave==49 else .14),h*.24),'skin_light',w*.06,pa)
    for sign in(-1,1):bend(b,'Ivory tusk',[(c.x+sign*w*.39,front+w*.12,c.z-h*.26),(c.x+sign*w*.40,front+w*.105,c.z+h*(.19 if wave==49 else-.06))],[w*(.12 if wave==49 else .055),.004],'ivory',pa,8)
   if mode in('ears','braids','hood-mask','crown','red-hair','red-hood','crescent-crown') or wave in(4,11,14,22,26,28,29,37,41):ears(b,pa,c,w,h,d)
   if 'hood'in mode or mode in('gold-mask','closed-mask','red-mask','skull-mask'):source_hood(b,pa,c,w,h,d,mode)
   if mode in('cap','horn-cap','ram-cap','crescent-cap'):source_cap(b,pa,c,w,h,d,mode)
   if wave==47:source_cap(b,pa,c,w,h,d,'cap')
   if mode=='crescent-cap':
    bend(b,'V6 eclipse source contacting silver brow crest',[(c.x-w*.28,front+.015,c.z+h*.52),(c.x,front+.02,c.z+h*.80),(c.x+w*.28,front+.015,c.z+h*.52)],[w*.035,w*.040,w*.035],'steel',pa,8)
   if mode in('gold-mask','closed-mask','red-mask','skull-mask'):real_mask(b,pa,c,w,h,d,'gold'if mode=='gold-mask'else'red'if mode=='red-mask'else'ivory'if mode=='skull-mask'else'steel_dark')
   if mode=='hood-mask':
    outline=[(c.x-w*.49,front+.018,c.z-h*.02),(c.x+w*.49,front+.018,c.z-h*.02),(c.x+w*.39,front+.03,c.z-h*.35),(c.x,front+.065,c.z-h*.53),(c.x-w*.39,front+.03,c.z-h*.35)];b.panel('V6 source fitted lower cloth face mask',outline,.024,'red'if wave==38 else'cloth',pa,.013)
   if mode in('braids','red-hair'):
    ell(b,'V6 source rounded red hair scalp',(c.x,c.y-.015,c.z+h*(.43 if wave==13 else .38)),(w*(.56 if wave==13 else .54),d*(.59 if wave==13 else .55),h*(.34 if wave==13 else .25)),'red',pa,12,4)
    for sign in(-1,1):
     for j in range(9 if wave==13 else 8):
      p=(c.x+sign*w*(.50+.016*math.sin(j)),front+w*.065+j*w*.009,c.z+h*.38-j*w*.125)if wave==13 else(c.x+sign*w*(.47+.016*math.sin(j)),c.y+d*.22-j*d*.06,c.z+h*.25-j*w*.105)
      ell(b,'V6 source intertwined segmented red braid',p,(w*.115,w*.10,w*.085)if wave==13 else(w*.10,w*.087,w*.073),'red',pa,8,3)
   if mode in('crown','crescent-crown'):
    annulus(b,'V6 source contacting gold crown band',(c.x,c.y,c.z+h*.47),w*.53,w*.035,'gold',pa,n=12,m=6)
    for j in range(5):
     a=j*math.tau/5;xx=c.x+math.sin(a)*w*.52;yy=c.y+math.cos(a)*w*.34
     bend(b,'V6 source small curved crown prong',[(xx,yy,c.z+h*.47),(xx,yy,c.z+h*.65),(xx*.985,yy,c.z+h*.72)],[w*.045,w*.035,.003],'gold',pa,8)
  records.append({'joint':pa.name,'mode':mode,'oldActualFaceBoundsM':[list(oldlo),list(oldhi)],'newActualFaceBoundsM':[list(v)for v in bound(sem(b,'Observed face',pa))]if sem(b,'Observed face',pa)else None,'sourceWidthToActualThorax':None if mounted else HEAD[wave][0],'baseSeatedAtM':base,'completeFacePartsActualSemantic':['Observed face','Orc broad jaw','Eye L','Eye R'],'bearingParts':['V6 hollow helmet deep dark cavity']if mode=='hollow-helmet'else['Observed face']})
 return records

def fitted_plate(b,name,part,pa,mat='steel',size=.92):
 lo,hi=bound(part);c=(lo+hi)/2;w=(hi.x-lo.x)*size;h=(hi.z-lo.z)*.88;d=hi.y-lo.y
 # Broad shell has several real folds and thin thickness. Back of shell is
 # inserted into the actual outer volume; exposed rivets intersect metal.
 ob=grid_shell(b,name,[c.x-w*.5,c.x-w*.32,c.x,c.x+w*.32,c.x+w*.5],[c.z-h*.5,c.z,c.z+h*.5],lambda xx,zz:hi.y-.014+.028*(1-abs(xx-c.x)/(w*.5))+.014*(1-abs(zz-c.z)/(h*.5)),.032,mat,pa)
 for sign in(-1,1):
  for zz in(c.z-h*.39,c.z+h*.38):ell(b,name+' attached exposed rivet',(c.x+sign*w*.36,hi.y+.004,zz),(.015,.010,.015),'steel_dark',pa,8,3)
 return ob

def scrap_anatomy(b):
 """The source tinker has stocky exposed calves and broad forearms."""
 for side in('L','R'):
  for label,parentname,radius in(('thigh','upper_leg_',.085),('calf','shin_',.076)):
   pa=pivot(b,parentname+side);old=[o for o in b.objects if o.parent==pa and semantic(o).startswith(('Upper leg '+side,'Lower leg '+side,'Knee contacting articulated joint '+side,'Ankle contacting boot joint '+side))]
   a=pa.matrix_world.translation.copy();nxt=pivot(b,('shin_'if label=='thigh'else'foot_')+side).matrix_world.translation.copy();gone(b,old)
   bend(b,'V6 scrap source short thick '+label+' '+side,[a+Vector((0,0,.022)),a.lerp(nxt,.48),nxt],[radius,radius*.98,radius*.81],'skin',pa,10)
  fp=pivot(b,'foot_'+side);boots=sem(b,'Grounded boot',fp)
  if boots:
   lo,hi=bound(boots);cx=(lo.x+hi.x)/2;cy=(lo.y+hi.y)/2;gone(b,boots)
   b.loft('V6 scrap source squat worn leather boot '+side,[b.ring(cx,cy,.001,.108,.136,8),b.ring(cx,cy,.073,.112,.139,8),b.ring(cx,cy-.015,.146,.073,.085,8)],'leather',fp)
  ap=pivot(b,'upper_arm_'+side);el=pivot(b,'forearm_'+side);hp=pivot(b,'hand_'+side)
  for pa,end,label,r in((ap,el,'Upper arm ',.093),(el,hp,'Forearm ',.088)):
   gone(b,sem(b,(label+side,'Connected shoulder '+side,'Elbow contacting articulated joint '+side),pa));a=pa.matrix_world.translation.copy();e=end.matrix_world.translation.copy()
   pts=[a,a.lerp(e,.48),e];radii=[r,r*1.13,r*.86]
   if label=='Upper arm ':
    bl,bh=bound(sem(b,'Tailored continuous bodice'));sgn=-1 if side=='L'else 1;pts=[Vector((sgn*(bh.x-bl.x)*.39,(bh.y+bl.y)/2,a.z)),*pts];radii=[r*.95,*radii]
   bend(b,'V6 scrap source broad '+label.lower()+side,pts,radii,'skin',pa,10)

def scrap_shoulder(b,pa,skin):
 lo,hi=bound(skin);cx=(lo.x+hi.x)/2;cz=hi.z;w=.32
 # A single closed broad rectangular plate bends over the shoulder. The
 # previous open crescent and separate bolts cannot substitute for this face.
 path=[(hi.y-.006,cz-.33),(hi.y+.012,cz-.15),(hi.y-.017,cz+.009),((hi.y+lo.y)/2,cz+.032),(lo.y+.006,cz-.006),(lo.y-.005,cz-.21)]
 xs=[cx-w*.5,cx-w*.25,cx,cx+w*.25,cx+w*.5];vs=[]
 for off in(0,-.035):
  for y,z in path:
   for x in xs:vs.append((x,y+off,z-.044*abs(x-cx)/(w*.5)))
 nx=len(xs);ny=len(path);N=nx*ny;fs=[]
 for j in range(ny-1):
  for i in range(nx-1):
   q=(j*nx+i,j*nx+i+1,(j+1)*nx+i+1,(j+1)*nx+i);fs.extend([q,tuple(reversed(tuple(n+N for n in q)))])
 boundary=list(range(nx))+[j*nx+nx-1 for j in range(1,ny)]+list(range((ny-1)*nx+nx-2,(ny-1)*nx-1,-1))+[j*nx for j in range(ny-2,0,-1)]
 for a,c in zip(boundary,boundary[1:]+boundary[:1]):fs.append((a,a+N,c+N,c))
 ob=b.mesh('V6 scrap single broad curved rusty rectangular shoulder shell',vs,fs,['v6_rust_steel','steel_dark'],pa)
 for xx in(cx-w*.34,cx+w*.34):
  for yy,zz in(path[0],path[1]):ell(b,'V6 scrap attached shoulder exposed rivet',(xx,yy+.004,zz-.044*abs(xx-cx)/(w*.5)),(.017,.014,.017),'steel_dark',pa,8,3)
 return ob

def source_connected_upper_arms(b,wave):
 """Replace source bare/sleeved upper-arm solids that miss the torso seam."""
 if wave not in(2,9,23):return
 body=sem(b,('Tailored continuous bodice','Faceted species chest'))
 for side in('L','R'):
  pa=pivot(b,'upper_arm_'+side);old=sem(b,'Upper arm '+side,pa)
  if not old:continue
  lo,hi=bound(old);mid=(lo+hi)/2;rad=(hi.x-lo.x)*.44
  nearest,normal,_,_=tree(body).find_nearest(mid)
  root=nearest-normal*.018;elbow=pivot(b,'forearm_'+side).matrix_world.translation.copy()
  key=old[0].data.materials[0].name.split('.')[0];b.M.setdefault(key,old[0].data.materials[0])
  gone(b,old)
  bend(b,'Upper arm '+side,[root,mid,elbow],[rad,rad*1.03,rad*.88],key,pa,10)

def source_actual_humanoid_pelvis(b,wave):
 """True anatomical waist connects chest into legs beneath fitted garments."""
 if wave not in(16,18,36,44):return
 torso=pivot(b,'torso_pivot');lo,hi=bound(sem(b,'Tailored continuous bodice'));c=(lo+hi)/2;w=hi.x-lo.x;d=hi.y-lo.y;hip=pivot(b,'upper_leg_L').matrix_world.translation.z
 b.loft('V6 source anatomical pelvis',[b.ring(c.x,c.y,hip-.032,w*.36,d*.42,12),b.ring(c.x,c.y,hip+.06,w*.44,d*.49,12),b.ring(c.x,c.y,lo.z+.020,w*.45,d*.48,12)],'cloth',torso)

def armor(b,wave):
 if wave not in(4,10,11,13,14,22,25,28,30,35,36,37,39,41,42,43,46,47,50):return[]
 torso=pivot(b,'torso_pivot');body=sem(b,('V6 source anatomical thorax','V6 rider source seated thorax','Tailored continuous bodice','Faceted species chest','Separated phantom armor upper chest plate'))
 gone(b,sem(b,('Breastplate fitted shell','Shoulder plate ','Source layered riveted shoulder iron','Source shoulder actual exposed rivet','Source shoulder metal top continuous wrap','Armor shoulder spike','Fitted knee armor')))
 new=[]
 if wave not in(4,10,13,43):
  new.append(fitted_plate(b,'V6 source curved fitted breastplate',body,torso,'steel_dark'if wave==36 else'steel'))
  # Rear metal belongs to the torso too; low plate coverage preserves straps.
  lo,hi=bound(body);c=(lo+hi)/2
  b.box('V6 source contacting small rear armor plate',(c.x,lo.y-.003,c.z),(hi.x-lo.x-.045,.038,(hi.z-lo.z)*.58),'steel_dark',.030,torso)
 for side in('L','R'):
  if wave==4 and side=='R':continue
  pa=pivot(b,'upper_arm_'+side);skin=sem(b,('V6 source anatomical upper arm '+side,'V6 scrap source broad upper arm '+side,'Upper arm '+side,'Muscular upper arm '+side,'Connected shoulder '+side,'Heavy connected deltoid '+side),pa)
  if not skin:continue
  lo,hi=bound(skin);c=(lo+hi)/2;sgn=-1 if side=='L'else 1;top=hi.z-.016;w=hi.x-lo.x;d=hi.y-lo.y
  if wave==4:new.append(scrap_shoulder(b,pa,skin));continue
  tiers=3 if wave in(10,22,43)else 1
  for k in range(tiers):
   zz=top-k*w*.25;outline=[(c.x-w*.57,hi.y-.012,zz),(c.x+w*.57,hi.y-.012,zz-w*.10),(c.x+w*.54,hi.y+.010,zz-w*.50),(c.x,c.y+d*.65,zz-w*.58),(c.x-w*.54,hi.y+.010,zz-w*.38)]
   ob=b.panel('V6 source angled fitted shoulder plate '+side,outline,.042,['steel','steel_dark'],pa,.024);new.append(ob)
   bend(b,'V6 source continuous shoulder top metal binding '+side,[(c.x-w*.42,lo.y+.018,zz),(c.x-w*.42,c.y,zz+.018),(c.x-w*.42,hi.y-.015,zz)],[.026,.026,.026],'steel',pa)
   for xx in(c.x-w*.36,c.x+w*.36):ell(b,'V6 source contacting shoulder rivet '+side,(xx,hi.y+.008,zz-w*.18),(.017,.012,.017),'steel_dark',pa,8,3)
  if wave in(13,14,22,36,41,43,46):
   fore=pivot(b,'forearm_'+side);fs=sem(b,('V6 source anatomical forearm '+side,'Forearm '+side,'Muscular heavy forearm '+side),fore)
   if fs:new.append(fitted_plate(b,'V6 source wrapped wrist armor '+side,fs,fore,'leather'if wave==13 else'steel'))
   for label in('shin','upper_leg'):
    joint=pivot(b,label+'_'+side);parts=sem(b,('V6 source anatomical '+('shin'if label=='shin'else'thigh')+' '+side,'Lower leg '+side,'Upper leg '+side,'Heavy short shin '+side,'Heavy short upper leg '+side),joint)
    if parts:new.append(fitted_plate(b,'V6 source articulated leg armor '+side+' '+label,parts,joint))
 return[o.name for o in new]

def source_layers(b,wave):
 torso=pivot(b,'torso_pivot');body=sem(b,('V6 source anatomical thorax','V6 rider source seated thorax','Tailored continuous bodice','Faceted species chest','Separated phantom armor upper chest plate','Mutant actual wood chest chassis'))
 if not torso or not body:return[]
 lo,hi=bound(body);cx=(lo.x+hi.x)/2;cy=(lo.y+hi.y)/2;w=hi.x-lo.x;d=hi.y-lo.y;top=hi.z-.025;hip=min(pivot(b,'upper_leg_'+s).matrix_world.translation.z for s in('L','R')if pivot(b,'upper_leg_'+s));new=[]
 if wave in(18,23,31,33,38,44,50):
  gone(b,sem(b,('Continuous flared garment hem','Leather ragged skirt','Crossed leather baldric','Real rear cape','Shoulder folded cape')))
  for level in range(3):
   zz=top-level*(top-hip)*.27
   for k in range(12):
    a=k*math.tau/12;rad=w*(.48+.017*level);base=Vector((cx+rad*math.sin(a),cy+d*.52*math.cos(a),zz));tip=Vector((cx+(rad+.075)*math.sin(a+.08),cy+(d*.52+.043)*math.cos(a+.08),zz-(top-hip)*(.31+.08*(k%3==0))))
    if wave==23:tip.z-=.16
    ob=leaf(b,'V6 source overlapping ragged mantle tier',base,tip,w*.15,'cloth'if k%3 else'cloth_light',torso);new.append(ob.name)
  # Ragged skirt hangs from the actual pelvis/belt, with varying pointed hems.
  for k in range(12):
   a=k*math.tau/12;base=Vector((cx+w*.42*math.sin(a),cy+d*.46*math.cos(a),hip+.12));tip=base+Vector((math.sin(a)*.053,math.cos(a)*.032,-.25-.08*(k%2)))
   if wave==23:tip.z-=.13
   ob=leaf(b,'V6 source contacting ragged skirt layer',base,tip,w*.13,'cloth',torso);new.append(ob.name)
 if wave==49:
  gone(b,sem(b,('Leather ragged skirt','Continuous flared garment hem','Grounded boot','Continuous leather waist belt','Belt buckle','Crossed leather baldric','Leather wrist cuff','Dorsal obsidian','Greatmaw actual overlapping obsidian','Greatmaw full overlapping rear obsidian carapace','Greatmaw rear carapace actual broad spike','Obsidian overlapping carapace','Breastplate fitted shell','Fitted knee armor','Shoulder plate','Ground claw','Troll actual long ivory finger claw','Connected ragged leather battle skirt')))
  # Bulky irregular overlapping obsidian armor wraps the back and shoulders,
  # including a contacting crown above the actual head; it is rigid rock.
  for row in range(4):
   z=hip+.13+row*(top-hip+.19)/3
   for col in range(3):
    j=row*3+col;xx=(col-1)*w*(.245+.018*(row%2))+w*.046*math.sin(j*2.31);yy=lo.y+.065-.065*(col==1)+.026*math.cos(j*1.78);zz=z+.049*math.sin(j*1.39)
    ob=ell(b,'V6 Greatmaw fitted irregular broad obsidian back armor',(xx,yy,zz),(w*(.235+.026*math.sin(j*1.83)),.17+.033*(j%3)/2,.215+.05*math.cos(j*1.19)),'steel_dark',torso,5+j%3,3);new.append(ob.name)
    a=Vector((xx,yy-.07,z+.13));cone(b,'V6 Greatmaw contacting jagged dorsal obsidian crown spike',a,a+Vector((xx*.13,-.10,.21+.025*(col%2))),.105,'steel_dark',torso,5)
  for side in('L','R'):
   ap=pivot(b,'upper_arm_'+side);arm=sem(b,'V6 source anatomical upper arm '+side,ap);al,ah=bound(arm);ac=(al+ah)/2;sgn=-1 if side=='L'else 1
   for j in range(2):
    pos=(ac.x+sgn*.07,ac.y-.035,ah.z-.025-j*.12);ell(b,'V6 Greatmaw source contacting shoulder obsidian mass',pos,(.23,.205,.20),'steel_dark',ap,6,3);cone(b,'V6 Greatmaw contacting shoulder armor spike',pos,(pos[0]+sgn*.18,pos[1]-.06,pos[2]+.22),.11,'steel_dark',ap,5)
   fp=pivot(b,'forearm_'+side);fore=sem(b,'V6 source anatomical forearm '+side,fp);fl,fh=bound(fore);fc=(fl+fh)/2
   ell(b,'V6 Greatmaw source contacting forearm obsidian plate',(fc.x+sgn*.105,fc.y+.03,fc.z),(.17,.20,.20),'steel_dark',fp,6,3)
 if wave==4:
  # Existing V4 crate remains fitted; expose the missing five timber boards.
  pack=sem(b,'Actual crooked scrap backpack')
  if pack:
   p0,p1=bound(pack);pc=(p0+p1)/2
   for j in range(5):
    x=p0.x+(j+.5)*(p1.x-p0.x)/5;b.box('V6 scrap actual rear backpack timber board',(x,p0.y-.015,pc.z),((p1.x-p0.x)/5-.008,.035,p1.z-p0.z),'wood',.011,torso)
  # Rebuild the actual gear ring immediately above its wooden pack, using a
  # short contacting axle rather than the old tall decorative stalk.
  gone(b,sem(b,('Scrap shoulder','Scrap gear','Scrap armor visible stud','Scrap backpack raised wooden gear support','Scrap backpack rotating gear','Source backpack top actual cogwheel')))
  faces=sem(b,'Observed face');capz=bound(faces)[1].z
  gp=Vector((.23,lo.y-.20,capz+.06));bend(b,'V6 scrap short pack contacting gear axle',[(gp.x,gp.y,hi.z-.03),gp],[.030,.030],'wood',torso)
  gear(b,'V6 scrap source toothed gear close above pack',gp,.105,'steel_dark',torso)
 if wave in(3,17,20,32):
  # Continuous harness rods curve over the actual shoulder and rear torso.
  for sign in(-1,1):
   pts=[(cx+sign*w*.23,hi.y-.018,hip+.04),(cx+sign*w*.29,hi.y-.01,top-.03),(cx+sign*w*.31,cy,top+.004),(cx+sign*w*.23,lo.y+.015,top-.02),(cx+sign*w*.20,lo.y+.005,hip+.06)]
   if wave==32:pts[-1]=(cx-sign*w*.23,lo.y+.005,hip+.06)
   # Fit the strap to the real convex body rather than its rectangular bounds.
   # Intermediate surface samples preserve the potbelly/shoulder curvature.
   fitted=[];bv=tree(body)
   for a,dst in zip(pts,pts[1:]):
    a=Vector(a);dst=Vector(dst)
    for k in range(4):
     q,n,_,_=bv.find_nearest(a.lerp(dst,k/4));fitted.append(q-n*.009)
   q,n,_,_=bv.find_nearest(Vector(pts[-1]));fitted.append(q-n*.009)
   ob=bend(b,'V6 source contacting shoulder and back leather harness',fitted,[(w*.04,.026)]*len(fitted),'leather',torso);new.append(ob.name)
 if wave==9:
  gone(b,sem(b,('Continuous flared garment hem','Leather ragged skirt','Real rear cape','Shoulder folded cape','Crossed leather baldric')))
  for k in range(7):
   xx=cx+(k-3)*w*.15;p,n,_,_=tree(body).find_nearest(Vector((xx,lo.y-.15,top-.045)))
   ob=leaf(b,'V6 dust dancer source fitted overlapping ragged rear leather cloak',p-n*.008,Vector((xx+w*.065*math.sin(k),lo.y-.08,hip-.085-.035*(k%2))),w*.27,'leather',torso);new.append(ob.name)
  for k in range(8):
   a=k*math.tau/8;root=Vector((cx+w*.40*math.sin(a),cy+d*.43*math.cos(a),hip+.08));ob=leaf(b,'V6 source contacting ragged skirt layer',root,root+Vector((.026*math.sin(a),.026*math.cos(a),-.16-.025*(k%2))),w*.18,'leather',torso);new.append(ob.name)
 return new

def hand_grip(b,pa):
 hand=pa.parent;meshes=[o for o in b.objects if o.parent==hand and semantic(o).startswith(('Grasping hand','V6 source anatomical palm','Broad grasping orc fist'))]
 return center(meshes)if meshes else pa.matrix_world.translation.copy()

def held_blade(b,pa,g,kind,scale,down=False,color='steel'):
 """Connected handle/guard/blade built as a whole around real grip."""
 sign=-1 if pa.name.startswith('weapon_L')else 1
 direction=Vector((sign*.32,.07,-.95 if down else .95)).normalized();u=Vector((direction.z,0,-direction.x)).normalized();shaft_end=g+direction*scale*.18
 bend(b,'V6 source contacting blade leather hilt',[g-direction*scale*.14,shaft_end],[scale*.034,scale*.034],'leather',pa,10)
 guard=shaft_end+direction*scale*.014;bend(b,'V6 source physical curved blade guard',[guard-u*scale*.135,guard,guard+u*scale*.135],[scale*.025,scale*.027,scale*.025],'steel_dark',pa,8)
 if kind in('dagger','sword'):
  length=scale*(.40 if kind=='dagger'else .77);a=guard+direction*.004;tip=a+direction*length+u*scale*(.25 if b.id=='host_09'else .10)
  outline=[a-u*scale*.055,a+u*scale*.07,a+direction*length*.46+u*scale*.105,tip,a+direction*length*.39-u*scale*.065]
  ob=b.panel('V6 source curved forged '+kind+' blade',[tuple(p)for p in outline],scale*.025,color,pa,scale*.018)
 else:
  pts=[guard,guard+direction*scale*.34,guard+direction*scale*.46+u*scale*.15,guard+direction*scale*.26+u*scale*.24]
  bend(b,'V6 source real inward curved hook',pts,[scale*.044,scale*.06,scale*.048,.004],color,pa,10);tip=pts[-1]
 endpoint(b,pa,'attack_muzzle',tip);endpoint(b,pa,'sword_tip',tip)

def held_spear(b,pa,g,scale,wave):
 direction=Vector((-.23 if wave==2 else-.04,.03,1)).normalized();bottom=g-direction*scale*.61;top=g+direction*scale*.76
 bend(b,'V6 source continuous held spear shaft',[bottom,top],[scale*.025,scale*.024],'wood',pa,10)
 if wave==41:
  b.jewel('V6 phalanx source single broad faceted diamond spear head',top+Vector((0,0,.115*scale)),.092*scale,.34*scale,.045*scale,'steel',pa)
  endpoint(b,pa,'attack_muzzle',top+Vector((0,0,.285*scale)))
  return
 for j in range(1 if wave in(35,39,42)else 3):
  a=top+direction*scale*(-.015-j*.14);u=Vector((direction.z,0,-direction.x));outline=[a-u*scale*.055,a+u*scale*.055,a+direction*scale*.24]
  b.panel('V6 source overlapping barbed spear metal',list(map(tuple,outline)),scale*.035,'purple'if wave==35 else'gold'if wave==42 else'steel',pa,scale*.015)
 if wave in(35,39,42):
  a=top-direction*scale*.27;u=Vector((1,0,0));outline=[a,a+u*.22+Vector((0,0,-.025)),a+u*.20+Vector((0,0,-.205)),a+Vector((0,0,-.155))]
  b.panel('V6 source physical contacting spear pennant',list(map(tuple,outline)),.018,'purple'if wave==35 else'red',pa,.005)
  if wave==35:
   from geometric_roster_builder import crescent
   crescent(b,'V6 eclipse spear actual attached silver crescent pennant seal',a+Vector((.11,.024,-.085)),.044,'steel',pa)
 endpoint(b,pa,'attack_muzzle',top+direction*scale*.225)

def source_weapons(b,wave):
 parts=[];weapons=[o for o in b.root.children_recursive if o.type=='EMPTY'and o.name.split('.')[0]in('weapon_R','weapon_L')]
 for pa in weapons:
  held=[o for o in b.objects if descendants(o,pa)]
  if not held:continue
  kinds=' '.join(semantic(o).lower()for o in held);g=hand_grip(b,pa);scale=.90 if wave in(2,5,9,12,16,38)else 1.13 if wave in(3,6,10,17,20,22,26,32,43)else 1.0
  if any(q in kinds for q in('crossbow','bowstring','door shield','shield','lantern','staff','bell','gear')):continue
  if 'spear'in kinds:gone(b,held);held_spear(b,pa,g,scale,wave)
  elif any(q in kinds for q in('dagger','sword','hook')):
   kind='hook'if'hook'in kinds else'sword'if'sword'in kinds else'dagger';gone(b,held);held_blade(b,pa,g,kind,scale*(.65 if wave==9 else .80 if wave==18 else 1),wave in(9,18,38),'purple'if wave==33 else'steel')
  elif wave==4:
   gone(b,held);head=g+Vector((0,.014,.195));bend(b,'V6 scrap contacting compact hammer wooden shaft',[g-Vector((0,0,.125)),head],[.031,.034],'wood',pa)
   b.box('V6 scrap solid rectangular rusty steel hammer head',head,(.245,.125,.128),['v6_rust_steel','steel_dark'],.025,pa)
   for sign in(-1,1):b.box('V6 scrap hammer worn forged striking face',head+Vector((sign*.111,0,0)),(.025,.132,.136),'steel_dark',.007,pa)
   endpoint(b,pa,'attack_muzzle',head+Vector((0,.066,0)))
  elif wave==3:
   gone(b,held);head=g+Vector((0,.014,scale*.30));bend(b,'V6 source connected wooden mallet shaft',[g-Vector((0,0,scale*.19)),head],[scale*.035,scale*.04],'wood',pa)
   body=bend(b,'V6 source solid rounded strapped mallet head',[head+Vector((-.21*scale,0,0)),head+Vector((.21*scale,0,0))],[(scale*.13,scale*.14)]*2,'wood',pa,12)
   for sign in(-1,1):bend(b,'V6 source contacting iron mallet end strap',[head+Vector((sign*.17*scale-.015*scale,0,0)),head+Vector((sign*.17*scale+.015*scale,0,0))],[(scale*.139,scale*.149)]*2,'steel_dark',pa,12)
   endpoint(b,pa,'attack_muzzle',head+Vector((0,.15*scale,0)))
  parts.extend(o.name for o in b.objects if descendants(o,pa))
 return parts

def apply_humanoid_equipment_v6(b,entry,mounted=False,anatomy=None):
 wave=int(entry['id'].split('_')[1]);assert not b.root.get('enemyHumanoidEquipmentV6'),(b.id,'V6 helper must start from immutable baseline')
 for key,alt in(('skin_light','skin'),('cloth_light','cloth'),('eyes','dark'),('steel','steel_dark'),('steel_dark','steel'),('leather','wood'),('rune','cloth'),('purple','cloth'),('moss','cloth'),('ivory','skin'),('gold','steel')):
  if key not in b.M and alt in b.M:b.M[key]=b.M[alt]
 for key,color in({'skin':'758153','skin_light':'91966B','cloth':'3D3543','cloth_light':'575062','dark':'191C20','eyes':'111614','steel':'A6ABA8','steel_dark':'53555A','wood':'77553C','leather':'584438','ivory':'D9D1B2','gold':'C6A35B','rune':'56C7BB','purple':'684787','moss':'586D3D','red':'884D48'}).items():
  if key not in b.M:material(b,key,color)
 if wave==4:material(b,'v6_rust_steel','807668');source_scrap_pose(b);scrap_anatomy(b)
 if wave==12:source_small_bell_carrier(b,anatomy)
 if wave==2:
  for ob in sem(b,'Tailored continuous bodice'):
   lo,hi=bound([ob]);cx=(lo.x+hi.x)/2;inv=ob.matrix_world.inverted()
   for v in ob.data.vertices:
    p=ob.matrix_world@v.co;t=(p.z-lo.z)/(hi.z-lo.z);p.x=cx+(p.x-cx)*(.89-.17*min(1,t*2));v.co=inv@p
   ob.data.update()
 if wave==49:
  for name in('skin','skin_light'):material(b,name,'787A72'if name=='skin'else'85867E')
 if wave==50:
  for key,color in({'cloth':'242326','cloth_light':'353338','steel':'4E4B47','steel_dark':'28272A','gold':'CFA34C'}).items():material(b,key,color)
 if wave==42:
  material(b,'steel','46474B');material(b,'steel_dark','303237')
 before=set(b.objects);head=heads(b,entry,mounted,anatomy)
 plates=armor(b,wave);cloth=source_layers(b,wave);weapons=source_weapons(b,wave)
 source_connected_upper_arms(b,wave)
 source_actual_humanoid_pelvis(b,wave)
 import sys
 from geometric_enemy_source_equipment_v6 import apply_source_equipment_v6
 unique=apply_source_equipment_v6(b,entry,sys.modules[__name__])
 if wave==46:
  for record in head:record['bearingParts']=['V6 revenant continuous actual open armored helmet shell']
 from geometric_enemy_secondary_details_v6 import apply_secondary_details_v6
 secondary=apply_secondary_details_v6(b,entry,sys.modules[__name__]);extra_contacts=[]
 if wave in(11,14,16,36):
  if wave==16:material(b,'v6_visible_brown_source_harness','78563A')
  torso=pivot(b,'torso_pivot');body=sem(b,('V6 source anatomical thorax','Tailored continuous bodice','Faceted species chest'));lo,hi=bound(body);cx=(lo.x+hi.x)/2;w=hi.x-lo.x;hip=pivot(b,'upper_leg_L').matrix_world.translation.z
  bearing=body+sem(b,('V6 source contacting small rear armor plate','V6 source overlapping ragged mantle tier','V6 detail source overlapping pointed mantle'))
  if wave==16:bearing+=sem(b,('V6 pickpocket actual fitted dark leather jacket','V6 pickpocket dark fitted layered leather contacting torn layered flap'))
  bv=tree(bearing)
  gone(b,sem(b,'Crossed leather baldric'))
  for sign in(-1,1):
   path=[]
   for j in range(13):
    t=j/12;x=cx+sign*w*(.34-.66*t);z=hi.z-.055-(hi.z-.055-hip-.075)*t;q,n,_,_=bv.ray_cast(Vector((x,lo.y-.4,z)),Vector((0,1,0)),1)
    if q is None:q,n,_,_=bv.find_nearest(Vector((x,lo.y-.25,z)))
    path.append(q-n*.006)
   strap=bend(b,'V6 source actual visible fitted brown crossed rear carrying strap '+str(sign),path,[.026]*len(path),'v6_visible_brown_source_harness'if wave==16 else'leather',torso,10)
   extra_contacts.append({'name':'Actual visible rear carrying strap fitted onto outer clothing or armor '+strap.name,'leftParts':[semantic(strap)],'leftObjectNames':[strap.name],'rightParts':sorted(set(semantic(o)for o in bearing)),'rightObjectNames':[o.name for o in bearing]})
 if wave==44:
  torso=pivot(b,'torso_pivot');body=sem(b,'Tailored continuous bodice');lo,hi=bound(body);w=hi.x-lo.x;cy=(hi.y+lo.y)/2;hip=pivot(b,'upper_leg_L').matrix_world.translation.z;robe_parts=sem(b,'V6 ash executioner real ankle length folded dark purple robe');bv=tree(robe_parts)
  for sign in(-1,1):
   path=[]
   for j in range(13):
    z=hi.z-.09-(hi.z-.09-.16)*j/12;x=sign*w*(.24+.05*j/12);q,n,_,_=bv.ray_cast(Vector((x,lo.y-.50,z)),Vector((0,1,0)),1)
    if q is None:q,n,_,_=bv.find_nearest(Vector((x,lo.y-.30,z)))
    path.append(q+n*.003)
   trim=bend(b,'V6 ash executioner actual long contacting orange rear robe facing '+str(sign),path,[.018]*len(path),'v6_ochre',torso,8)
   extra_contacts.append({'name':'Actual orange rear facing seated on its own long robe '+trim.name,'leftParts':[semantic(trim)],'leftObjectNames':[trim.name],'rightParts':sorted(set(semantic(o)for o in robe_parts)),'rightObjectNames':[o.name for o in robe_parts]})
  for side in('L','R'):
   ap=pivot(b,'upper_arm_'+side);arm=sem(b,('Upper arm '+side,'Connected shoulder '+side),ap);al,ah=bound(arm);ac=(al+ah)/2
   for j in range(4):
    a=j*math.tau/4;q,n,_,_=tree(arm).find_nearest(Vector((ac.x+.07*math.sin(a),ac.y+.14*math.cos(a),ah.z+.03)));tip=q+Vector((.025*math.sin(a),.035*math.cos(a),-.17));base=q-n*.008
    # A broad physical ochre backing extends around both tapered cloth edges;
    # a thin centre rod disappears inside the cloth and cannot depict a facing.
    edge=leaf(b,'V6 ash executioner actual broad orange gold edged shoulder mantle facing',base,tip-Vector((0,0,.015)),.165,'v6_ochre',ap)
    piece=leaf(b,'V6 ash executioner actual fitted dark purple shoulder mantle flap',base+Vector((0,.003,0)),tip,.120,'v6_executioner_robe',ap)
    extra_contacts.extend([{'name':'Actual individual purple shoulder mantle flap enters arm '+piece.name,'leftParts':[semantic(piece)],'leftObjectNames':[piece.name],'rightParts':sorted(set(semantic(o)for o in arm)),'rightObjectNames':[o.name for o in arm]},{'name':'Actual orange mantle facing touches its own cloth '+edge.name,'leftParts':[semantic(edge)],'leftObjectNames':[edge.name],'rightParts':[semantic(piece)],'rightObjectNames':[piece.name]}])
  # Follow the actual ragged lower ring, including the back and both profiles,
  # instead of substituting the two vertical robe facings for a bottom hem.
  for robe in robe_parts:
   bv_hem=tree([robe]);ring=[robe.matrix_world@v.co for v in list(robe.data.vertices)[:14]];hem_path=[]
   for j,a in enumerate(ring):
    c=ring[(j+1)%len(ring)]
    for k in range(5):
     p=a.lerp(c,k/5);out=Vector((p.x,p.y-cy,0)).normalized();q,n,_,_=bv_hem.find_nearest(p+out*.006);hem_path.append(q+out*.004)
   hem_path.append(hem_path[0]);hem=bend(b,'V6 ash executioner actual continuous ragged orange gold lower robe hem',hem_path,[.024]*len(hem_path),'v6_ochre',torso,8)
   extra_contacts.append({'name':'Actual continuous orange ragged hem contacts its own real robe','leftParts':[semantic(hem)],'leftObjectNames':[hem.name],'rightParts':[semantic(robe)],'rightObjectNames':[robe.name]})
 if wave==13:
  pa=pivot(b,'head_pivot');lo,hi=bound(sem(b,'Observed face',pa));c=(lo+hi)/2;w=hi.x-lo.x;d=hi.y-lo.y;hh=hi.z-lo.z
  for sign in(-1,1):
   for j in range(9):
    ell(b,'V6 huntress source rear contacting segmented red braid',(c.x+sign*w*(.25+.012*math.sin(j)),c.y-d*.54-j*w*.003,c.z+hh*.38-j*w*.125),(w*.115,w*.10,w*.085),'red',pa,8,3)
 if wave==44:
  pa=pivot(b,'head_pivot');hood=sem(b,'V6 source fitted domed cloth hood',pa);hl,hh=bound(hood);fl,fh=bound(sem(b,'Observed face',pa));fc=(fl+fh)/2
  for ob in sem(b,'V6 detail executioner short side ivory crown point',pa):
   pts=[ob.matrix_world@v.co for v in ob.data.vertices];old=sum(pts[:-1],Vector())/(len(pts)-1);sgn=-1 if old.x<0 else 1;q,n,_,_=tree(hood).find_nearest(Vector((fc.x+sgn*(fh.x-fl.x)*.42,fc.y+(fh.y-fl.y)*.38,hh.z-.022)));base=q-n*.005;inv=ob.matrix_world.inverted()
   for k,v in enumerate(ob.data.vertices):
    p=pts[k]+base-old
    if k==len(pts)-1:p.z=base.z+.17
    v.co=inv@p
   ob.data.update()
 pilot={'applied':False,'physicalContacts':[]}
 if wave==24:
  from geometric_enemy_pilot_frame_v6 import apply_final_source24_v6
  pilot=apply_final_source24_v6(b,entry,sys.modules[__name__])
 if wave==31:
  pa=pivot(b,'weapon_R')
  for ob in sem(b,'V6 inquisitor source gold sun staff whole continuous held shaft',pa):ob.data.materials.clear();ob.data.materials.append(b.M['wood'])
  pa=pivot(b,'weapon_L')
  for ob in sem(b,'Shield real back and rim',pa):ob.data.materials.clear();ob.data.materials.append(b.M['gold'])
  for side in('L','R'):
   pa=pivot(b,'upper_arm_'+side);skulls=sem(b,'V6 inquisitor actual contacting ivory shoulder skull actual carved cranial shell',pa)
   if skulls:
    arm=sem(b,('Upper arm ','Connected shoulder '),pa);al,ah=bound(arm);ac=(al+ah)/2;q,n,_,_=tree(arm).find_nearest(Vector((ac.x,al.y-.16,ah.z-.010)));delta=q+n*.040+Vector((0,0,.030))-center(skulls)
    # Seat the actual skull assembly on the rear upper shoulder. Its source
    # parchment then hangs directly down the back rather than returning
    # from a skull planted on the forward face of the shoulder plate.
    for ob in sem(b,('V6 inquisitor actual contacting ivory shoulder skull','V6 detail inquisitor contacting hanging parchment seal','V6 detail inquisitor actual parchment rune strokes'),pa):
     inv=ob.matrix_world.inverted()
     for vertex in ob.data.vertices:vertex.co=inv@(ob.matrix_world@vertex.co+delta)
     ob.data.update()
    lo,hi=bound(skulls);cx=(lo.x+hi.x)/2;q,n,_,_=tree(skulls).find_nearest(Vector((cx,hi.y+.05,lo.z+.045)));root=q-n*.009;cx=root.x;yy=root.y;top=root.z
    seal=b.panel('V6 inquisitor source actual contacting hanging ivory shoulder parchment '+side,[(cx-.035,yy,top),(cx+.035,yy,top),(cx+.039,yy,top-.20),(cx+.010,yy,top-.184),(cx-.035,yy,top-.205)],.020,'ivory',pa,0)
    extra_contacts.append({'name':'Actual shoulder parchment root enters its carved skull '+side,'leftParts':[semantic(seal)],'leftObjectNames':[seal.name],'rightParts':sorted(set(semantic(o)for o in skulls)),'rightObjectNames':[o.name for o in skulls]})
    for j in range(3):
     rune=bend(b,'V6 inquisitor actual attached dark parchment rune '+side,[(cx-.017,yy+.002,top-.038-.05*j),(cx+.019,yy+.002,top-.055-.05*j)],[.005,.005],'dark',pa,6)
     extra_contacts.append({'name':'Actual individual parchment rune touches its own cloth '+rune.name,'leftParts':[semantic(rune)],'leftObjectNames':[rune.name],'rightParts':[semantic(seal)],'rightObjectNames':[seal.name]})
    # Source tabs also hang down the upper BACK directly from each skull.
    # The forward tabs alone were hidden by the shoulder plate in profiles.
    q,n,_,_=tree(skulls).ray_cast(Vector((cx,lo.y-.20,lo.z+.080)),Vector((0,1,0)),1);assert q is not None,('missing rear skull parchment bearing',b.id,side)
    root=q-n*.009;cx=root.x;yy=root.y;top=root.z
    robe=sem(b,'V6 detail inquisitor continuous folded source robe');rl,rh=bound(robe);outer_y=rl.y-.023
    def rear_y(x,z):
     t=min(1,max(0,(top-z)/.080));return yy*(1-t)+min(yy,outer_y)*t
    rear=grid_shell(b,'V6 inquisitor actual visible rear hanging ivory shoulder parchment '+side,[cx-.039,cx,cx+.039],[top-.235,top-.12,top-.035,top],rear_y,-.020,'ivory',pa)
    extra_contacts.append({'name':'Actual visible rear parchment root enters its own carved shoulder skull '+side,'leftParts':[semantic(rear)],'leftObjectNames':[rear.name],'rightParts':sorted(set(semantic(o)for o in skulls)),'rightObjectNames':[o.name for o in skulls]})
    for j in range(3):
     pts=[]
     for xx,zz in((cx-.019,top-.060-.05*j),(cx+.020,top-.077-.05*j)):
      q,n,_,_=tree([rear]).ray_cast(Vector((xx,outer_y-.15,zz)),Vector((0,1,0)),1);assert q is not None;pts.append(q+n*.002)
     rune=bend(b,'V6 inquisitor actual dark visible rear parchment rune '+side,pts,[.005,.005],'dark',pa,6)
     extra_contacts.append({'name':'Actual individual rear parchment rune touches its own cloth '+rune.name,'leftParts':[semantic(rune)],'leftObjectNames':[rune.name],'rightParts':[semantic(rear)],'rightObjectNames':[rear.name]})
 if mounted and wave in(27,50):
  dark='29343F'if wave==27 else'242326';metal='545D64'if wave==27 else'383638'
  material(b,'v6_actual_source_dark_rider_cloth',dark);material(b,'v6_actual_source_dark_rider_iron',metal)
  fabrics=('V6 source fitted domed cloth hood','V6 source overlapping ragged mantle tier','V6 source contacting ragged skirt layer','V5 folded fitted cloak','Real rear cape')
  irons=('V6 source curved fitted breastplate','V6 source contacting small rear armor plate','V6 source angled fitted shoulder plate','V6 source continuous shoulder top metal binding','V6 source wrapped wrist armor','V6 source articulated leg armor','V6 rider source seated thorax')
  for ob in sem(b,fabrics+irons):
   ob.data.materials.clear();ob.data.materials.append(b.M['v6_actual_source_dark_rider_cloth'if semantic(ob).startswith(fabrics)else'v6_actual_source_dark_rider_iron'])
 if wave==33:
  material(b,'v6_actual_wraith_bright_silver_girdle','CDD2D2',metal=.12)
  for ob in sem(b,'V6 detail wraith source exposed silver waist girdle'):ob.data.materials.clear();ob.data.materials.append(b.M['v6_actual_wraith_bright_silver_girdle'])
  hip=pivot(b,'upper_leg_L').matrix_world.translation.z
  for ob in sem(b,'V6 detail source overlapping pointed mantle'):
   lo,hi=bound([ob]);floor=hip+.143
   if lo.z<floor:
    inv=ob.matrix_world.inverted()
    for v in ob.data.vertices:
     p=ob.matrix_world@v.co;p.z=floor+(p.z-lo.z)/(hi.z-lo.z)*(hi.z-floor);v.co=inv@p
    ob.data.update()
  for ob in sem(b,'V6 detail source contacting torn pointed skirt'):
   lo,hi=bound([ob]);delta=min(0,hip+.069-hi.z)
   inv=ob.matrix_world.inverted()
   for v in ob.data.vertices:
    p=ob.matrix_world@v.co;p.z+=delta;v.co=inv@p
   ob.data.update()
   actual_pelvis=sem(b,'V6 source anatomical pelvis');lo,hi=bound([ob]);roots=[ob.matrix_world@v.co for v in ob.data.vertices if(ob.matrix_world@v.co).z>=hi.z-.035]
   nearest=[(p,*tree(actual_pelvis).find_nearest(p)[:2])for p in roots];p,q,n=min(nearest,key=lambda r:(r[0]-r[1]).length);delta=q-p-n*.008
   for v in ob.data.vertices:v.co=inv@(ob.matrix_world@v.co+delta)
   ob.data.update()
 from geometric_enemy_physical_scopes_v6 import bind_enemy_physical_scopes_v6
 physical=bind_enemy_physical_scopes_v6(b,entry);physical['contacts'].extend(unique.get('physicalContacts',[]));physical['contacts'].extend(secondary.get('physicalContacts',[]));physical['contacts'].extend(extra_contacts);physical['contacts'].extend(pilot.get('physicalContacts',[]));b.root['enemyPhysicalContractV6']=json.dumps(physical,ensure_ascii=False)
 result={'applied':True,'sourceWave':wave,'mountedMode':mounted,'riderSeatTransformsPreserved':bool(mounted),'sourceHeadAssemblies':head,'actualNewArmorParts':plates,'actualNewClothParts':cloth,'actualHeldParts':weapons,'uniqueSourceRecipes':unique,'secondarySourceRecipes':secondary,'finalSourcePilotFrame':pilot,'physicalScopeSelections':physical,'newMeshParts':[o.name for o in b.objects if o not in before],'absoluteSourceScaleCertified':False,'sourceRasterPixelsModified':False}
 b.root['enemyHumanoidEquipmentV6']=True;b.root['enemySourceEquipmentV6']=json.dumps(result)
 return result
