"""Fresh V8 adult anatomical defenders, authored and exported in Blender 5.2.

8 basic families x 6 rank palettes, plus the 23 humanoid champion identities.
No older defender mesh is imported. No gameplay or manifest file is edited.
Run --family FAMILY[,FAMILY] --no-render for production-only export.
"""
import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
import author_archer as A
import author_army as army
from defender_surface_v8 import Surface, make_rig, actions, material, cubic, smoothstep, TAU
ROOT=A.ROOT;OUT=ROOT/'public/assets/models';PORTRAITS=ROOT/'public/assets/army'
SCENES=ROOT/'blender/scenes';REVIEW=ROOT/'blender/renders/defenders-v8-humans'
DATA=json.loads((ROOT/'data/towers.json').read_text(encoding='utf-8'))
BASIC=['soldier','archer','druid','mage','cleric','runebreaker','frostwarden','stormcaller']
FAMILIES=['rimewatch','frostblade','roseguard','highking','crownofages','thornwarden','verdantguard','tempest','stormcitadel','greenheart','eldergrove','sunward','dawnspire','wyvernhunter','kingdomprotector','mothernature','royalranger','kingsrangerguard','elvenking','monk','archbishop','archangel','royalmarshal']
COLOURS={'rimewatch':('457b95','bfdde1'),'frostblade':('447896','d5ecf5'),'roseguard':('943c50','e4b658'),'highking':('202733','a7bdcb'),'crownofages':('554380','dfbf68'),'thornwarden':('3c754d','b2c68b'),'verdantguard':('247b70','d6b95d'),'tempest':('5b5897','b6dbed'),'stormcitadel':('234f77','afdcf1'),'greenheart':('638544','cbbd83'),'eldergrove':('36594a','b7cb84'),'sunward':('dfd1aa','d2a35b'),'dawnspire':('e4dfc6','c7e9ea'),'wyvernhunter':('55778a','b9ccd0'),'kingdomprotector':('3d6796','d4b66b'),'mothernature':('5f884e','e3d4a2'),'royalranger':('294f70','d0ab57'),'kingsrangerguard':('263e66','d5b868'),'elvenking':('557343','d5c16a'),'monk':('846342','d3b788'),'archbishop':('813d51','e0c074'),'archangel':('799bb9','e2e8db'),'royalmarshal':('754528','d2a05a')}

class Defender:
    def __init__(self,family,rank=1):
        self.family=family;self.rank=rank;self.advanced=family in FAMILIES
        self.dwarf=family in ('runebreaker','royalmarshal');self.h=.83 if self.dwarf else 1;self.w=1.13 if self.dwarf else (.92 if family in ('thornwarden','dawnspire','mothernature') else 1)
        self.bow=family in ('archer','thornwarden','verdantguard','wyvernhunter','royalranger','kingsrangerguard','elvenking')
        self.crossbow=family=='rimewatch';self.wings=family in ('dawnspire','archangel')
        self.sword=family in ('soldier','frostwarden','frostblade','roseguard','highking','crownofages')
        self.hammer=family in ('runebreaker','kingdomprotector');self.prayer=family=='monk';self.bomb=family=='royalmarshal'
        self.armor=family in ('soldier','frostwarden','frostblade','roseguard','highking','crownofages','kingdomprotector','kingsrangerguard','archangel')
        self.robe=family in ('druid','mage','cleric','stormcaller','tempest','stormcitadel','greenheart','eldergrove','sunward','dawnspire','monk','archbishop','archangel','mothernature')
        self.elven=family in ('thornwarden','verdantguard','elvenking','mothernature')
        self.female=family in ('thornwarden','dawnspire','mothernature');self.closed=family in ('frostblade','roseguard','highking')
        self.kind='bow' if self.bow else 'crossbow' if self.crossbow else 'sword' if self.sword else 'hammer' if self.hammer else 'prayer' if self.prayer else 'bomb' if self.bomb else 'staff'
        colour,accent=COLOURS.get(family,(A.COLORS[rank-1],'c9a764'))
        self.p={
            'cloth':material(family+' V8 rank cloth',colour,.61,textile=True),
            'trim':material(family+' V8 crafted trim',accent,.31,.72),
            'steel':material(family+' V8 shaped plate silver','b8c6cb' if family!='highking' else '37424b',.29,.81),
            'skin':material(family+' V8 living skin','dfb194' if not self.female else 'e6baa0',.56),
            'leather':material(family+' V8 stitched chestnut leather','604530',.68),
            'dark':material(family+' V8 recessed seams and pupil','243033',.78),
            'hair':material(family+' V8 sculpted hair','9b7240' if self.female else '534130',.67),
            'ivory':material(family+' V8 woven linen and eye white','eee5d2',.65,textile=True),
            'iris':material(family+' V8 inset eyes','39735a',.28),
            'rose':material(family+' V8 natural lip seam','9a6255',.62),
            'nail':material(family+' V8 subtle warm fingernails','e5c1ae',.44),
            'magic':material(family+' V8 magical focus',DATA[family].get('color','#a6dac8').lstrip('#'),.32,.12,.6),
            'stone':material(family+' V8 carved limestone','a9b2a0',.86),
        }
        if family=='mothernature':self.p['skin']=material('Nature spirit V8 living jade skin','aacbb5',.55,0,.12)
        if family in ('greenheart','eldergrove','archbishop'):self.p['hair']=material(family+' V8 silver aged hair','b8b6a3',.7)
        # Hand poses are fully linked to a physical grip, never unrelated balls.
        if self.bow:
            self.pose={'L':[(-.175,0,1.465),(-.25,.20,1.38),(-.15,.44,1.34)],'R':[(.175,0,1.465),(.28,.20,1.38),(-.13,.225,1.365)]}
            self.grips={'L':(-.14,.478,1.37),'R':(-.14,.260,1.375)}
        elif self.crossbow:
            self.pose={'L':[(-.175,0,1.465),(-.27,.14,1.27),(-.10,.34,1.21)],'R':[(.175,0,1.465),(.28,.12,1.26),(.12,.31,1.22)]}
            self.grips={'L':(-.09,.377,1.235),'R':(.13,.347,1.245)}
        elif self.prayer:
            self.pose={'L':[(-.175,0,1.465),(-.29,.07,1.26),(-.075,.23,1.27)],'R':[(.175,0,1.465),(.29,.07,1.26),(.075,.23,1.27)]};self.grips={}
        else:
            self.pose={'L':[(-.175,0,1.465),(-.26,.025,1.29),(-.31,.16,1.285)],'R':[(.175,0,1.465),(.28,.028,1.30),(.33,.145,1.17)]}
            self.grips={'R':(.344,.191,1.202),'L':(-.317,.203,1.317)}
        self.create_rig();self.s=Surface(family,self.rig)

    def V(self,v):return (v[0]*self.w,v[1],.17+(v[2]-.17)*self.h)
    def create_rig(self):
        specs=[('root',(0,0,.17),(0,0,.86),None),('pelvis',(0,0,.87),(0,0,1.09),'root'),('torso',(0,0,1.09),(0,0,1.48),'pelvis'),('neck',(0,0,1.48),(0,0,1.60),'torso'),('head',(0,0,1.575),(0,0,1.87),'neck'),('cape',(0,-.13,1.43),(0,-.25,.65),'torso')]
        for side in ('L','R'):
            a,e,c=self.pose[side];handtail=Vector(c)+Vector((0,.024,.048))
            specs.extend([('upper_arm_'+side,a,e,'torso'),('forearm_'+side,e,c,'upper_arm_'+side),('hand_'+side,c,handtail,'forearm_'+side)])
            for i in range(5):
                pos=Vector(self.grips.get(side,tuple(handtail)))+Vector((0,0,(i-2)*.011));specs.append((f'finger_{side}_{i}',pos,pos+Vector((.014,.020,.013)),'hand_'+side))
            sign=1 if side=='R' else -1
            specs.extend([('thigh_'+side,(sign*.085,0,.925),(sign*.097,.016,.58),'pelvis'),('calf_'+side,(sign*.097,.016,.58),(sign*.11,.029,.245),'thigh_'+side),('foot_'+side,(sign*.11,.029,.245),(sign*.11,.145,.198),'calf_'+side)])
        if self.bow:specs.extend([('bow',self.grips['L'],tuple(Vector(self.grips['L'])+Vector((0,0,.42))),'hand_L'),('nocked_arrow',self.grips['R'],tuple(Vector(self.grips['R'])+Vector((0,.42,0))),'hand_R')])
        elif self.crossbow:specs.append(('crossbow',(0,.36,1.23),(0,.72,1.23),'hand_L'))
        elif not self.prayer:specs.append(('weapon',self.grips['R'],tuple(Vector(self.grips['R'])+Vector((0,0,.65))),'hand_R'))
        if self.wings:
            for sign,side in [(-1,'L'),(1,'R')]:specs.append(('wing_'+side,(sign*.12,-.13,1.42),(sign*.65,-.17,1.64),'torso'))
        self.rig=make_rig(self.family,[(n,self.V(a),self.V(b),p) for n,a,b,p in specs])
    def loft(self,name,profile,mat,bone='torso',sides=32,rows=18,warp=None,solid=0):
        return self.s.loft(name,profile,mat,bone,sides,rows,lambda v,a,t:self.V(warp(v,a,t) if warp else v),solid)
    def tube(self,name,points,radii,mat,bone='torso',sides=10,rows=20,cap=True,solid=0):return self.s.tube(name,[self.V(v) for v in points],radii,mat,bone,sides,rows,cap=cap,solid=solid)
    def gem(self,name,centre,scale,mat,bone='torso',sides=14,rows=7):return self.s.gem(name,self.V(centre),(scale[0]*self.w,scale[1],scale[2]*self.h),mat,bone,sides,rows)
    def loop(self,name,points,r,mat,bone='torso',sides=6):return self.s.loop(name,[self.V(v) for v in points],r,mat,bone,sides)
    def mesh(self,name,vertices,faces,mat,bone='torso',solid=0):return self.s.mesh(name,[self.V(v) for v in vertices],faces,mat,bone,solid)
    def plinth(self):
        self.loft('cut octagonal pedestal',[(.01,.40,.40,.40,0),(.055,.42,.42,.42,0),(.11,.42,.42,.42,0),(.15,.385,.385,.385,0)],self.p['stone'],'root',8,3)
        self.loop('rank identity inlay',[(.333*math.cos(TAU*i/32),.333*math.sin(TAU*i/32),.153) for i in range(32)],.006,self.p['cloth'],'root')
    def body(self):
        p=self.p;self.plinth()
        profile=[(.88,.124,.107,.103,0),(.94,.141,.11,.107,0),(1.035,.122,.109,.098,0),(1.14,.150,.116,.109,-.005),(1.27,.181,.121,.115,-.008),(1.38,.184,.110,.103,-.005),(1.47,.169,.081,.077,0),(1.535,.068,.065,.061,0)]
        def torso_weight(v,t):k=smoothstep(.2,.44,t);return {'pelvis':1-k,'torso':k}
        def tailor(v,a,t):
            folds=.0035*math.cos(a*12)*math.sin(t*math.pi)**2
            chest=.008*math.exp(-((v.z-1.30)/.11)**2)*max(0,math.sin(a))**3
            return (v.x*(1+folds),v.y+folds+chest,v.z)
        self.loft('continuous tailored torso and neck opening',profile,p['dark'] if self.armor else p['cloth'],torso_weight,36,24,tailor)
        self.loft('anatomical neck',[(1.475,.065,.062,.060,0),(1.53,.053,.051,.050,0),(1.59,.058,.057,.051,.006),(1.625,.068,.066,.065,.009)],p['skin'],'neck',24,12)
        for sign,side in [(-1,'L'),(1,'R')]:
            offset=sign*.096;cy=.025 if sign<0 else -.013
            def limbweight(v,t,side=side):k=smoothstep(.42,.60,t);return {'calf_'+side:1-k,'thigh_'+side:k}
            self.loft('continuous tailored trouser anatomy '+side,[(.24,.042,.044,.044,cy),(.35,.054,.058,.050,cy),(.49,.060,.066,.053,cy-.011),(.585,.060,.063,.055,cy-.006),(.69,.069,.073,.066,cy-.008),(.82,.080,.091,.078,cy-.011),(.925,.078,.081,.075,-.005)],p['dark'],limbweight,20,20,lambda v,a,t,offset=offset:(v.x+offset*(1-.2*t),v.y,v.z))
            self.loft('one-piece lasted leather boot '+side,[(.158,.051,.124,.055,cy+.023),(.183,.060,.137,.061,cy+.025),(.220,.059,.127,.060,cy+.020),(.26,.055,.067,.061,cy),(.345,.065,.073,.061,cy-.002),(.425,.069,.077,.065,cy-.008)],p['leather'],'calf_'+side,20,12,lambda v,a,t,offset=offset:(v.x+offset,v.y,v.z))
            self.loop('boot stitched upper seam '+side,[(offset+.055*math.cos(TAU*i/20),cy-.008+.062*math.sin(TAU*i/20),.420) for i in range(20)],.003,p['trim'],'calf_'+side)
        if self.robe:
            profile=[(.177,.244,.177,.165,-.012),(.23,.246,.176,.170,-.012),(.40,.234,.175,.166,-.011),(.66,.198,.149,.143,-.009),(.88,.164,.131,.123,-.003),(1.025,.137,.116,.108,0)]
            self.loft('sewn flowing robe with shaped longitudinal folds',profile,p['cloth'],'pelvis',40,20,lambda v,a,t:(v.x*(1+.028*math.cos(a*12)*(1-t)),v.y+.008*math.cos(a*12)*(1-t),v.z),.004)
            for sign in (-1,1):self.tube('embroidered robe hem seam',[(sign*.15,.127,1.014),(sign*.19,.16,.73),(sign*.21,.173,.43),(sign*.215,.19,.19)],[.004]*4,p['trim'],'pelvis',6,18)
        else:self.loft('tailored split waist tunic',[(.75,.188,.151,.147,0),(.83,.187,.15,.144,0),(.92,.158,.122,.120,0),(1.025,.137,.116,.109,0)],p['cloth'],'pelvis',32,10,lambda v,a,t:(v.x,v.y+.008*math.sin(a*8)*(1-t),v.z),.005)
        self.loft('close-fitting articulated waist belt',[(1.004,.141,.120,.113,0),(1.04,.14,.119,.112,0)],p['leather'],'pelvis',28,3)
        self.gem('small engraved belt buckle',(0,.125,1.024),(.022,.009,.023),p['trim'],'pelvis')

    def face(self):
        p=self.p;age=self.family in ('eldergrove','greenheart','crownofages','archbishop');face_start=len(self.s.parts)
        seed=sum(ord(c) for c in self.family);jaw=.079+((seed%7)-3)*.0025
        profile=[(1.568,.016,.025,.020,.015),(1.595,.048,.060,.049,.012),(1.625,jaw,.085,.069,.008),(1.677,.100,.095,.089,.002),(1.732,.112,.107,.104,-.003),(1.785,.110,.101,.111,-.004),(1.840,.109,.090,.103,-.009),(1.895,.087,.074,.084,-.013),(1.932,.036,.032,.035,-.016),(1.940,.004,.004,.004,-.016)]
        def gauss(x,z,cx,cz,wx,wz):return math.exp(-((x-cx)/wx)**2-((z-cz)/wz)**2)
        def anatomy(v,a,t):
            if math.sin(a)<=0:return v
            x,y,z=v;factor=max(0,math.sin(a))**7
            nose=.037*gauss(x,z,0,1.744,.017,.029)+.019*gauss(x,z,0,1.778,.012,.043)
            socket=-.009*(gauss(x,z,.043,1.803,.024,.018)+gauss(x,z,-.043,1.803,.024,.018))
            cheek=.008*(gauss(x,z,.067,1.722,.029,.030)+gauss(x,z,-.067,1.722,.029,.030))
            chin=.004*gauss(x,z,0,1.62,.034,.025)
            return (x,y+(nose+socket+cheek+chin)*factor,z)
        self.loft('original continuous adult face sculpt with integrated jaw cheeks and nasal bridge',profile,p['skin'],'head',48,34,anatomy)
        def face_y(x,z):
            row=min(range(201),key=lambda i:abs(cubic(profile,i/200)[0]-z));zz,width,front,back,cy=cubic(profile,row/200)
            a=math.acos(max(-1,min(1,x/max(.001,width))));return anatomy(Vector((x,cy+front*math.sin(a),z)),a,row/200)[1]
        for sign in (-1,1):
            x=sign*.0425;z=1.800;y=face_y(x,z)
            self.gem('inset almond cornea '+str(sign),(x,y-.003,z),(.016,.0065,.0071),p['ivory'],'head',20,10)
            self.gem('natural iris '+str(sign),(x,y+.0037,z),(.0049,.0015,.0052),p['iris'],'head',16,8)
            self.gem('pupil '+str(sign),(x,y+.005,z),(.0022,.0008,.0032),p['dark'],'head',12,6)
            for upper in (True,False):
                verts=[];columns=18;rows=4
                for j in range(rows+1):
                    t=j/rows
                    for i in range(columns+1):
                        a=math.pi*i/columns;xx=x-.0165*math.cos(a);inner=z+(.007 if upper else -.006)*math.sin(a)
                        zz=inner+(.008 if upper else -.007)*math.sin(a)*t;base=face_y(xx,zz)
                        yy=base+(.005*(1-t)**3)-.0003*t;verts.append((xx,yy,zz))
                fs=[(j*(columns+1)+i,j*(columns+1)+i+1,(j+1)*(columns+1)+i+1,(j+1)*(columns+1)+i) for j in range(rows) for i in range(columns)]
                self.mesh('blended anatomical eyelid '+str(sign)+' '+str(upper),verts,fs,p['skin'],'head')
            self.tube('swept natural eyebrow '+str(sign),[(x-.022,face_y(x-.022,1.827)+.002,1.827),(x-.009,face_y(x-.009,1.832)+.002,1.832),(x+.014,face_y(x+.014,1.832)+.002,1.832),(x+.022,face_y(x+.022,1.827)+.001,1.827)],[.0021,.0028,.0024,.0006],p['hair'],'head',6,16)
            # Ear folds have a pinna surface and concha rather than a cylinder.
            self.gem('sculpted attached ear '+str(sign),(sign*.111,-.012,1.733),(.016 if not self.elven else .033,.018,.029 if not self.elven else .041),p['skin'],'head',14,8)
            self.tube('ear helix fold '+str(sign),[(sign*.114,.002,1.715),(sign*.124,.004,1.737),(sign*.119,.002,1.758),(sign*.110,-.008,1.761)],[.0025]*4,p['skin'],'head',6,12)
        # Defined closed mouth, natural adult proportions; no oversized teeth.
        mouthz=1.666
        self.tube('soft cupid bow closed mouth',[(-.024,face_y(-.024,mouthz)+.001,mouthz+.002),(-.011,face_y(-.011,mouthz)+.002,mouthz),(-.004,face_y(-.004,mouthz)+.003,mouthz+.001),(0,face_y(0,mouthz)+.003,mouthz),( .011,face_y(.011,mouthz)+.002,mouthz),(.024,face_y(.024,mouthz)+.001,mouthz+.002)],[.0005,.0018,.002,.0018,.0018,.0005],p['rose'],'head',6,20)
        for sign in (-1,1):self.gem('soft recessed natural nostril '+str(sign),(sign*.010,face_y(sign*.010,1.730)+.0006,1.730),(.0031,.0010,.0014),p['rose'],'head',12,6)
        for upper in (True,False):
            v=[];cols=16;rr=3
            for r in range(rr+1):
                t=r/rr
                for i in range(cols+1):
                    x=(i/cols-.5)*.047;taper=max(0,1-(x/.024)**2);z=mouthz+.0016*(abs(x)/.023)**1.5+(.004 if upper else -.004)*t*taper
                    v.append((x,face_y(x,z)+.0018*math.sin(t*math.pi)*taper+.0007,z))
            fs=[(r*(cols+1)+i,r*(cols+1)+i+1,(r+1)*(cols+1)+i+1,(r+1)*(cols+1)+i) for r in range(rr) for i in range(cols)]
            self.mesh('natural shaped '+('upper cupid bow' if upper else 'lower')+' lip plane',v,fs,p['rose'],'head')
        if age:
            for sign in (-1,1):self.tube('soft age cheek crease '+str(sign),[(sign*.043,face_y(sign*.043,1.716)+.0007,1.716),(sign*.039,face_y(sign*.039,1.696)+.0005,1.696),(sign*.033,face_y(sign*.033,1.684)+.0002,1.684)],[.0007,.0007,.0002],p['rose'],'head',4,8)
        # Adult facial proportions: shorten the earlier excessively long
        # lower midface without scaling the inset eyes or widening the jaw.
        for obj in self.s.parts[face_start:]:
            for vertex in obj.data.vertices:
                z=.17+(1.80-.17)*self.h;vertex.co.z=z+(vertex.co.z-z)*(.65 if vertex.co.z<z else .85)
        if self.family!='monk':self.hair()

    def hair(self):
        p=self.p;v=[];n=40;rows=12
        for j in range(rows+1):
            t=j/rows
            for i in range(n):
                a=TAU*i/n;boundary=1.846 if math.sin(a)>=0 else 1.685
                boundary-=.038*(1-abs(math.sin(a))) if math.sin(a)>=0 else 0
                z=boundary+(1.948-boundary)*t;factor=math.sqrt(max(.002,1-((z-1.779)/.177)**2))
                v.append((.116*math.cos(a)*factor,-.010+.112*math.sin(a)*factor,z))
        fs=[(r*n+i,r*n+(i+1)%n,(r+1)*n+(i+1)%n,(r+1)*n+i) for r in range(rows) for i in range(n)]
        fs.append(tuple(rows*n+i for i in range(n)))
        self.mesh('continuous scalp hair with forehead and temple hairline',v,fs,p['hair'],'head',.003)
        long=self.female or self.elven or self.family in ('eldergrove','stormcaller','tempest')
        if long:
            for sign in (-1,1):
                verts=[];cols=10;rr=12
                for j in range(rr+1):
                    t=j/rr
                    for i in range(cols+1):
                        u=i/cols;x=sign*(.088+.052*u-.014*t);y=-.047-.078*u-.024*t+.004*math.cos(u*math.pi*5)
                        z=1.861-t*(.39+.09*u)
                        verts.append((x,y,z))
                fs=[(j*(cols+1)+i,j*(cols+1)+i+1,(j+1)*(cols+1)+i+1,(j+1)*(cols+1)+i) for j in range(rr) for i in range(cols)]
                self.mesh('layered swept long hair curtain '+str(sign),verts,fs,p['hair'],'head',.005)
                for i in range(5):self.tube('engraved flowing hair strand',[(sign*(.092+.008*i),-.052-.016*i,1.84),(sign*(.097+.007*i),-.057-.014*i,1.63),(sign*(.074+.01*i),-.076-.014*i,1.48-.02*i)],[.0012]*3,p['trim'] if self.family=='mothernature' else p['hair'],'head',4,16)
        if self.family in ('druid','greenheart','eldergrove','runebreaker','royalmarshal','crownofages'):
            verts=[];cols=20;rr=14
            for j in range(rr+1):
                t=j/rr
                for i in range(cols+1):
                    u=i/cols;x=(u-.5)*.18*(1-.66*t);y=.103+.035*math.sin(t*math.pi/2)+.004*math.cos(u*TAU*6);z=1.70-t*(.29-.045*abs(u-.5))
                    verts.append((x,y,z))
            fs=[(j*(cols+1)+i,j*(cols+1)+i+1,(j+1)*(cols+1)+i+1,(j+1)*(cols+1)+i) for j in range(rr) for i in range(cols)]
            self.mesh('continuous sculpted flowing beard with engraved locks',verts,fs,p['hair'],'head',.007)

    def arms(self):
        p=self.p
        for side in ('R','L'):
            a,e,w=self.pose[side];sign=1 if side=='R' else -1
            start=len(self.s.parts);paths={}
            arm=[a,tuple(Vector(a).lerp(Vector(e),.48)),e,tuple(Vector(e).lerp(Vector(w),.6)),w]
            self.tube('continuous deltoid elbow wrist anatomy '+side,arm,[.060,.048,.037,.039,.022],p['skin'],'hand_'+side,18,32)
            power=(side in self.grips and (side=='R' and not self.prayer or side=='L' and self.bow or self.crossbow))
            if power:
                gx,gy,gz=self.grips[side]
                # Palm sits behind the shaft; the four fingers wrap from its
                # ulnar edge around the handle with distinct curved joints.
                nock=self.bow and side=='R';px=gx-sign*(.020 if nock else .030);py=gy-(.019 if nock else .028)
                self.loft('shaped thenar metacarpal palm '+side,[(gz-.042,.018,.018,.019,py-.009),(gz-.021,.025,.021,.018,py),(gz+.012,.028,.020,.017,py+.001),(gz+.039,.020,.017,.014,py+.002)],p['skin'],'hand_'+side,20,12,lambda v,a,t,px=px:(v.x+px,v.y,v.z))
                for i in range(4):
                    z=gz-.027+i*.014
                    # Radius includes actual grip clearance. An opposed thumb
                    # crosses the index side, never emerging by the little finger.
                    pts=[(px+sign*.015,py+.009,z),(gx+sign*.016,gy-.018,z+.001),(gx+sign*.024,gy+.004,z),(gx+sign*.011,gy+.024,z-.002),(gx-sign*.009,gy+.026,z-.003),(gx-sign*.017,gy+.017,z-.004)]
                    if nock:pts=[(px+sign*.009,py+.008,z),(gx+sign*.009,gy-.010,z+.001),(gx+sign*.013,gy+.003,z),(gx+sign*.006,gy+.012,z-.001),(gx-sign*.006,gy+.012,z-.002),(gx-sign*.010,gy+.005,z-.002)]
                    self.tube('independent '+side+' power-grip finger '+str(i),pts,[.006,.0065,.006,.0055,.0048,.0014],p['skin'],f'finger_{side}_{i}',10,22);paths[f'finger_{side}_{i}']=[Vector(self.V(x)) for x in pts]
                pts=[(px-sign*.014,py+.006,gz+.015),(px-sign*.008,gy+.007,gz+.046),(gx-sign*.010,gy+.026,gz+.050),(gx+sign*.016,gy+.020,gz+.039),(gx+sign*.022,gy+.012,gz+.029)]
                self.tube('opposed anatomical thumb '+side,pts,[.010,.009,.0075,.006,.0018],p['skin'],f'finger_{side}_4',12,20);paths[f'finger_{side}_4']=[Vector(self.V(x)) for x in pts]
                palmcentre=(px,py,gz)
            else:
                # Open offering or nocking hand: one monotone, softly relaxed
                # phalange chain; no hooked-back fingertip or zigzag joints.
                cx,cy,cz=tuple(Vector(w)+Vector((0,.015,.031)))
                self.loft('open anatomically tapered metacarpal palm '+side,[(cz-.027,.018,.018,.014,cy-.009),(cz,.026,.014,.012,cy),(cz+.035,.022,.013,.011,cy+.007)],p['skin'],'hand_'+side,20,12,lambda v,a,t,cx=cx:(v.x+cx,v.y,v.z))
                for i,l in enumerate([.042,.054,.059,.052]):
                    x=cx+sign*(i-1.5)*.013;spread=sign*(i-1.5)*.0012
                    curl=[.020,.026,.029,.023][i]
                    pts=[(x,cy+.009,cz+.028),(x+spread*.3,cy+.009+curl*.15,cz+.028+l*.3),(x+spread*.8,cy+.009+curl*.49,cz+.028+l*.65),(x+spread,cy+.009+curl*.85,cz+.028+l*.9),(x+spread,cy+.009+curl,cz+.028+l)]
                    if self.bow and side=='R':
                        # Mediterranean draw grip: index/middle fingers curl
                        # around the actual string nock, rather than waving an
                        # unrelated open palm beside the loaded arrow.
                        nock=Vector(self.grips['R']);base=Vector((x,cy+.009,cz+.028))
                        pts=[tuple(base),tuple(base.lerp(nock,.40)+Vector((0,0,.018))),tuple(nock+Vector((.009,.010,.018-i*.006))),tuple(nock+Vector((.005,.016,.009-i*.006))),tuple(nock+Vector((0,.013,.004-i*.006)))]
                    self.tube('independent relaxed '+side+' finger '+str(i),pts,[.0059,.0062,.0056,.0047,.0012],p['skin'],f'finger_{side}_{i}',10,20);paths[f'finger_{side}_{i}']=[Vector(self.V(x)) for x in pts]
                pts=[(cx+sign*.020,cy,cz),(cx+sign*.036,cy+.013,cz+.007),(cx+sign*.047,cy+.022,cz+.019),(cx+sign*.051,cy+.023,cz+.027)]
                self.tube('relaxed opposed thumb '+side,pts,[.009,.0083,.0065,.0018],p['skin'],f'finger_{side}_4',12,20);paths[f'finger_{side}_4']=[Vector(self.V(x)) for x in pts];palmcentre=(cx,cy,cz)
            self.tube('seamless wrist to palm anatomical bridge '+side,[tuple(Vector(e).lerp(Vector(w),.78)),w,palmcentre],[.026,.022,.020],p['skin'],'hand_'+side,16,12)
            samples=[Vector(self.V(cubic(arm,j/60))) for j in range(61)];digits={name:[Vector(cubic([tuple(p) for p in pts],j/24)) for j in range(25)] for name,pts in paths.items()}
            def weights(v,side=side,samples=samples,digits=digits):
                name,d=min(((n,min((v-x).length for x in points)) for n,points in digits.items()),key=lambda pair:pair[1])
                if d<.012:
                    k=max(.25,min(.95,(.013-d)/.006));return {'hand_'+side:1-k,name:k}
                closest=min(range(61),key=lambda i:(v-samples[i]).length);t=closest/60;k=smoothstep(.33,.57,t);h=smoothstep(.82,.99,t)
                return {'upper_arm_'+side:(1-k)*(1-h),'forearm_'+side:k*(1-h),'hand_'+side:h}
            hand=self.s.union(self.s.parts[start:],'single continuous '+side+' arm wrist palm and five separated fingers',p['skin'],4300 if self.advanced else 3400,weights,.0020)
            hand['digits']=5;hand['opposedThumb']=True;hand['gripCentre']=self.V(self.grips.get(side,palmcentre))
            if not power:
                for digit in range(4):
                    path=[tuple(x) for x in paths[f'finger_{side}_{digit}']];centre=Vector(cubic(path,.86))
                    self.s.gem('thin curved natural fingernail '+side+str(digit),tuple(centre+Vector((0,-.0048,0))),(.003,.0006,.0046),p['nail'],f'finger_{side}_{digit}',12,6)
            # Tailored sleeves overlap anatomy at the real shoulder, and have
            # a thickness/taper rather than separated shoulder spheres.
            sleevepoints=[a,tuple(Vector(a).lerp(Vector(e),.48)),e]
            self.tube('tailored smoothly fitted upper sleeve '+side,sleevepoints,[.064,.051,.041],p['cloth'],'upper_arm_'+side,16,18)
            # A hollow, physically thick shell follows the SAME continuous
            # forearm curve. Straight capped sleeves previously cut across
            # the sculpted skin and created visible triangular boundary tears.
            self.tube('fitted hollow anatomical forearm bracer '+side,[cubic(arm,t) for t in [.56,.68,.79,.91]],[.046,.048,.044,.035],p['steel'] if self.armor else p['leather'],'forearm_'+side,16,20,False,.003)
            if self.armor:
                self.tube('hinged shaped elbow plate '+side,[tuple(Vector(a).lerp(Vector(e),.83)),e,tuple(Vector(e).lerp(Vector(w),.12))],[.043,.045,.041],p['steel'],'forearm_'+side,14,12)

    def cape(self,length=.49,width=.27):
        p=self.p;verts=[];n=18;rows=18
        for j in range(rows+1):
            t=j/rows
            for i in range(n+1):
                u=i/n;x=(u-.5)*2*(.16+(width-.16)*t);y=-.105-.12*math.sin(t*math.pi/2)+.014*math.cos(u*TAU*5)*t;z=1.48-(1.48-length)*t+.03*math.cos(u*math.pi*2)*t
                verts.append((x,y,z))
        fs=[(j*(n+1)+i,j*(n+1)+i+1,(j+1)*(n+1)+i+1,(j+1)*(n+1)+i) for j in range(rows) for i in range(n)]
        self.mesh('tailored pleated cape with woven material thickness',verts,fs,p['cloth'],'cape',.005)
        for sign in (-1,1):self.tube('cape sewn bound edge',[(sign*.16,-.105,1.48),(sign*.22,-.19,1.06),(sign*width,-.23,length+.03)],[.003]*3,p['trim'],'cape',6,20)

    def armorplates(self):
        p=self.p
        # Cuirass is fitted to the undercoat. Its breast contour and rolled
        # edges are actual sculpted surfaces; the waist is separate for flexion.
        self.loft('forged fitted breastplate and backplate',[(1.064,.138,.124,.117,-.001),(1.14,.16,.134,.121,0),(1.27,.193,.139,.127,-.005),(1.39,.187,.126,.113,-.005),(1.455,.160,.089,.081,0)],p['steel'],'torso',32,16,lambda v,a,t:(v.x,v.y+.010*math.exp(-((v.z-1.28)/.13)**2)*max(0,math.sin(a))**8,v.z),.004)
        for z in (1.071,1.11):self.loop('rolled lower cuirass edge',[(.146*math.cos(TAU*i/28),.128*math.sin(TAU*i/28),z) for i in range(28)],.0037,p['trim'],'torso')
        for sign,side in [(-1,'L'),(1,'R')]:
            # Three connected overlapping lames fit over the deltoid; no
            # unsupported floating spherical shoulder cap.
            for j in range(3):
                v=[];n=16;rr=5;shoulder,elbow,_=self.pose[side];shoulder=Vector(shoulder);elbow=Vector(elbow);direction=(elbow-shoulder).normalized();across=direction.cross(Vector((0,1,0))).normalized();front=direction.cross(across).normalized()
                for r in range(rr+1):
                    t=r/rr;centre=shoulder.lerp(elbow,.05+j*.12+t*.18);radius=.069-j*.006-.003*t
                    for i in range(n+1):
                        angle=TAU*(.055+.86*i/n);point=centre+radius*(across*math.cos(angle)+front*math.sin(angle));v.append(tuple(point))
                fs=[(r*(n+1)+i,r*(n+1)+i+1,(r+1)*(n+1)+i+1,(r+1)*(n+1)+i) for r in range(rr) for i in range(n)]
                self.mesh('overlapping forged shoulder lame '+side+str(j),v,fs,p['steel'],'upper_arm_'+side,.005)
            for j in range(2):
                self.loft('articulated waist fauld '+side+str(j),[(.88-j*.054,.177,.142,.135,0),(.915-j*.054,.171,.140,.132,0)],p['steel'],'pelvis',24,3,solid=.003)
            self.gem('shoulder hinge pin '+side,(sign*.214,.058,1.45),(.010,.007,.010),p['trim'],'upper_arm_'+side,10,6)
            self.loft('anatomical fitted greave '+side,[(.275,.060,.077,.065,.02),(.37,.073,.088,.075,.014),(.47,.076,.088,.075,.010),(.56,.075,.081,.075,.008)],p['steel'],'calf_'+side,18,10,lambda v,a,t,sign=sign:(v.x+sign*.097,v.y,v.z),.003)
            self.gem('waist fauld fastening '+side,(sign*.115,.12,.92),(.007,.006,.007),p['trim'],'pelvis',10,6)

    def helmet(self,closed=False,crested=False):
        p=self.p
        if closed:
            # Full skull shell and shaped visor with real geometric eye gaps.
            self.loft('fully enclosing forged great bascinet',[(1.585,.086,.089,.086,-.007),(1.65,.117,.096,.115,-.008),(1.74,.124,.119,.121,-.005),(1.85,.122,.097,.115,-.006),(1.94,.075,.070,.08,-.008),(1.973,.008,.011,.012,-.009)],p['steel'],'head',32,22,solid=.003)
            xs=[-.100,-.073,-.024,.024,.073,.100];rows=[(1.641,.121),(1.708,.153),(1.777,.134),(1.797,.131),(1.859,.108)];v=[]
            for z,y in rows:
                for x in xs:v.append((x,y-.022*(abs(x)/.1),z))
            fs=[]
            for j in range(4):
                for i in range(5):
                    if j==2 and i in (1,3):continue
                    fs.append((j*6+i,j*6+i+1,(j+1)*6+i+1,(j+1)*6+i))
            self.mesh('folded protective visor with ocular openings',v,fs,p['steel'],'head',.006)
            for sign in (-1,1):self.gem('visor opening deep lining',(sign*.049,.127,1.786),(.023,.004,.008),p['dark'],'head',12,6)
            self.tube('raised visor midline',[(0,.15,1.67),(0,.156,1.72),(0,.137,1.79),(0,.112,1.86)],[.003]*4,p['trim'],'head',6,18)
        else:
            v=[];n=32;rr=13
            for j in range(rr+1):
                t=j/rr
                for i in range(n):
                    a=TAU*i/n;z=1.843+.132*t;factor=math.sqrt(max(.001,1-t*t));v.append((.123*math.cos(a)*factor,-.007+.117*math.sin(a)*factor,z))
            fs=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(rr) for i in range(n)]
            self.mesh('forged open helmet skull shell',v,fs,p['steel'],'head',.004)
            self.loop('rolled helmet brow',[(.124*math.cos(TAU*i/32),-.007+.118*math.sin(TAU*i/32),1.847) for i in range(32)],.004,p['trim'],'head')
            for sign in (-1,1):self.mesh('shaped hinged cheek guard',[(sign*.110,.067,1.822),(sign*.116,.020,1.818),(sign*.108,.033,1.672),(sign*.096,.08,1.687)],[(0,1,2,3)],p['steel'],'head',.007)
        if crested:
            self.tube('sculpted flowing horsehair plume',[(0,-.04,1.97),(0,-.09,2.065),(0,-.19,2.06),(0,-.29,1.96)],[.032,.032,.026,.005],p['cloth'],'head',14,20)

    def hood(self):
        p=self.p;v=[];n=24;rr=14
        for j in range(rr+1):
            t=j/rr;z=1.49+.45*t
            for i in range(n+1):
                a=math.pi*.81+math.pi*1.38*i/n;w=.145+.010*math.sin(t*math.pi)-.026*max(0,(t-.77)/.23);dep=.116
                v.append((w*math.cos(a),-.017+dep*math.sin(a),z))
        fs=[(j*(n+1)+i,j*(n+1)+i+1,(j+1)*(n+1)+i+1,(j+1)*(n+1)+i) for j in range(rr) for i in range(n)]
        self.mesh('sewn sculpted open hood with face opening',v,fs,p['cloth'],'head',.006)
        for index in (0,n):self.tube('hood bound opening edge',[v[j*(n+1)+index] for j in range(rr+1)],[.004]*(rr+1),p['trim'],'head',6,24)

    def crown(self,elven=False):
        p=self.p;self.loop('forged seated crown brow band',[(.115*math.cos(TAU*i/40),-.008+.102*math.sin(TAU*i/40),1.862) for i in range(40)],.006,p['trim'],'head',8)
        for i in range(8):
            a=TAU*i/8;x=.112*math.cos(a);y=-.008+.099*math.sin(a);tip=(x*1.035,y,1.913+(.025 if i%2==0 else 0))
            self.leaf('crown sculpted fleur jewel '+str(i),(x,y,1.86),tuple(Vector(tip)-Vector((x,y,1.86))),p['trim'],.016,'head')
            if i%2==0:self.gem('crown set gemstone',(x,y,1.902),(.008,.008,.011),p['magic'],'head',12,6)

    def leaf(self,name,start,direction,mat,width=.038,bone='torso'):
        v=[];n=10;d=Vector(direction);a=Vector(start);side=d.cross(Vector((0,1,0))).normalized()
        for j in range(n+1):
            t=j/n;w=width*math.sin(math.pi*t)**.65;centre=a+d*t+Vector((0,.011*math.sin(math.pi*t),0))
            v.extend([tuple(centre-side*w),tuple(centre+Vector((0,.007*math.sin(math.pi*t),0))),tuple(centre+side*w)])
        f=[(j*3+i,j*3+i+1,(j+1)*3+i+1,(j+1)*3+i) for j in range(n) for i in range(2)]
        return self.mesh(name,v,f,mat,bone,.0018)

    def shield(self):
        p=self.p;x,y,z=self.grips['L'];shape=[(-.115,0,.15),(.115,0,.15),(.133,0,.026),(.085,0,-.125),(0,0,-.218),(-.085,0,-.125),(-.133,0,.026)]
        v=[(x+dx,y+.035+.027*(1-(dx/.14)**2),z+dz) for dx,dy,dz in shape];v.append((x,y+.066,z+.003))
        self.mesh('convex laminated heraldic shield',v,[(i,(i+1)%7,7) for i in range(7)],p['cloth'],'hand_L',.014)
        self.loop('shield forged rolled rim',v[:7],.007,p['trim'],'hand_L')
        self.tube('shield inner grasping grip',[(x-.033,y,z-.03),(x-.033,y,z+.042)],[.012,.012],p['leather'],'hand_L',12,12)
        self.tube('shield leather forearm loop',[(x-.052,y-.018,z-.05),(x+.022,y-.065,z-.03),(x+.070,y-.028,z+.045)],[.008]*3,p['leather'],'forearm_L',8,16)
        self.leaf('heraldic embossed shield crest',(x,y+.072,z-.080),(0,0,.18),p['trim'],.034,'hand_L')

    def swordweapon(self):
        p=self.p;x,y,z=self.grips['R'];guardz=z+.083;length=.54 if self.family=='soldier' else .64
        self.tube('bound shaped leather sword hilt',[(x,y,z-.063),(x,y,z+.063)],[.015,.015],p['leather'],'weapon',12,14)
        for i in range(5):self.loop('sword hilt leather wrapped seam',[(x+.0155*math.cos(TAU*j/12),y+.0155*math.sin(TAU*j/12),z-.047+i*.021) for j in range(12)],.0012,p['trim'],'weapon',4)
        self.tube('swept cast sword crossguard',[(x-.10,y-.002,guardz-.014),(x-.053,y,guardz),(x,y,guardz),(x+.053,y,guardz),(x+.10,y-.002,guardz-.014)],[.004,.008,.009,.008,.004],p['trim'],'weapon',10,24)
        self.gem('faceted sword pommel',(x,y,z-.075),(.024,.020,.025),p['trim'],'weapon',12,6)
        # A diamond-section blade with a full ridge and sharpened edges.
        profiles=[(guardz+.014,.027,.008),(guardz+.04,.028,.007),(guardz+length*.77,.022,.005),(guardz+length,.0008,.0004)]
        v=[]
        for zz,w,d in profiles:v.extend([(x-w,y,zz),(x,y+d,zz),(x+w,y,zz),(x,y-d,zz)])
        f=[(j*4+i,j*4+(i+1)%4,(j+1)*4+(i+1)%4,(j+1)*4+i) for j in range(3) for i in range(4)];f.extend([(3,2,1,0),(12,13,14,15)])
        self.mesh('forged tapered diamond-section longsword blade',v,f,p['steel'],'weapon')
        if self.family in ('frostwarden','frostblade','highking'):
            for i in range(4):self.tube('engraved blade runes',[(x-.008,y+.0085,guardz+.13+i*.095),(x+.007,y+.0085,guardz+.145+i*.095),(x-.004,y+.0085,guardz+.165+i*.095)],[.0018]*3,p['magic'],'weapon',4,8)
        self.s.socket('sword_tip',self.V((x,y,guardz+length)), 'weapon');self.s.socket('attack_muzzle',self.V((x,y,guardz+length)),'weapon')

    def staffweapon(self):
        p=self.p;x,y,z=self.grips['R'];top=2.08 if self.family in ('eldergrove','stormcitadel','archbishop') else 2.035
        self.tube('one-piece carved tapered staff',[(x,y,.18),(x-.01,y,.47),(x,y,z),(x+.008,y,1.72),(x,y,top-.11)],[.012,.014,.015,.012,.011],p['leather'] if self.family in ('druid','greenheart','eldergrove','mothernature') else p['trim'],'weapon',12,28)
        for zz in (.36,z+.072,top-.14):self.loop('staff engraved ferrule',[(x+.015*math.cos(TAU*j/20),y+.015*math.sin(TAU*j/20),zz) for j in range(20)],.0025,p['trim'],'weapon')
        for sign in (-1,1):self.tube('staff sculpted focus cradle',[(x,y,top-.13),(x+sign*.044,y,top-.08),(x+sign*.048,y,top+.016),(x,y,top+.065)],[.006,.007,.004,.002],p['trim'],'weapon',8,18)
        self.gem('staff inset magical focus',(x,y,top),(.027,.029,.040),p['magic'],'weapon',18,10)
        if self.family in ('cleric','sunward','dawnspire','archbishop','archangel'):
            self.loop('consecrated sun crozier halo',[(x+.079*math.cos(TAU*i/32),y,top+.079*math.sin(TAU*i/32)) for i in range(32)],.005,p['trim'],'weapon')
        if self.family in ('druid','greenheart','eldergrove','mothernature'):
            for sign in (-1,1):self.leaf('living staff leaf',(x+sign*.022,y,top-.032),(sign*.073,.014,.063),p['cloth'],.028,'weapon')
        self.s.socket('staff_tip',self.V((x,y,top)),'weapon');self.s.socket('attack_muzzle',self.V((x,y,top)),'weapon')

    def hammerweapon(self):
        p=self.p;x,y,z=self.grips['R'];top=z+.27
        self.tube('leather bound warhammer handle',[(x,y,z-.1),(x,y,z+.11),(x,y,top+.015)],[.015,.016,.012],p['leather'],'weapon',12,20)
        # Forged tapered octagonal striking head, authored along X.
        v=[];n=8;profile=[(-.105,.039),(-.090,.046),(-.036,.035),(.05,.037),(.085,.042),(.103,.029)]
        for xx,r in profile:
            for i in range(n):a=TAU*i/n;v.append((x+xx,y+r*math.cos(a),top+r*math.sin(a)))
        fs=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(profile)-1) for i in range(n)];fs.extend([tuple(reversed(range(n))),tuple((len(profile)-1)*n+i for i in range(n))])
        self.mesh('crafted forged hammer with chamfered striking faces',v,fs,p['steel'],'weapon')
        self.gem('engraved hammer sacred face seal',(x+.104,y,top),(.004,.022,.022),p['trim'],'weapon',12,8)
        self.s.socket('attack_muzzle',self.V((x,y,top)),'weapon')

    def bowweapon(self):
        p=self.p;x,y,z=self.grips['L']
        pts=[(x+.01,y+.058,z-.43),(x-.012,y+.085,z-.35),(x-.034,y+.050,z-.18),(x,y,z),(x-.034,y+.05,z+.18),(x-.012,y+.085,z+.35),(x+.01,y+.058,z+.43)]
        self.tube('laminated carved recurve bow',pts,[.005,.012,.013,.016,.013,.012,.005],p['leather'],'bow',12,40)
        for sign in (-1,1):self.tube('bow horn tip inlay',[(x-.015,y+.077,z+sign*.31),(x+.01,y+.058,z+sign*.43)],[.006,.003],p['trim'],'bow',8,12)
        draw=self.grips['R'];v=[self.V(pts[0]),self.V(draw),self.V(pts[-1])]
        def stringweights(point,t):
            k=1-abs(t-.5)*2;return {'bow':1-k,'hand_R':k}
        self.s.tube('taut physically nocked bowstring',v,[.0015]*3,p['ivory'],stringweights,5,16)
        dx,dy,dz=draw
        self.tube('nocked straight arrow shaft',[(dx,dy-.016,dz),(dx,dy+.45,dz)],[.0035,.0025],p['leather'],'nocked_arrow',8,12)
        self.mesh('arrow tapered steel broadhead',[(dx-.014,dy+.425,dz),(dx+.014,dy+.425,dz),(dx,dy+.48,dz),(dx,dy+.438,dz+.005),(dx,dy+.438,dz-.005)],[(0,3,2),(3,1,2),(1,4,2),(4,0,2),(0,4,1,3)],p['steel'],'nocked_arrow')
        for sign in (-1,1):self.leaf('arrow soft vaned fletching',(dx,dy-.01,dz),(sign*.013,.05,0),p['ivory'],.010,'nocked_arrow')
        # The released arrow mesh disappears; the muzzle stays on the actual
        # bow so its position is not collapsed by the arrow visibility scale.
        self.s.socket('attack_muzzle',self.V((dx,dy+.48,dz)),'bow')
        self.loft('stitched back quiver',[(.90,.066,.059,.059,-.157),(1.02,.071,.063,.062,-.178),(1.34,.070,.06,.063,-.170),(1.47,.076,.065,.065,-.171)],p['leather'],'torso',20,14,lambda v,a,t:(v.x+.14-.02*t,v.y,v.z),.004)
        for i in range(3):self.tube('quiver spare arrow',[(.105+i*.027,-.17,1.29),(.098+i*.027,-.17,1.59)],[.003]*2,p['leather'],'torso',6,8)

    def crossbowweapon(self):
        p=self.p
        self.tube('crossbow sculpted walnut stock',[(.12,.25,1.245),(.12,.42,1.245),(.02,.65,1.245),(0,.80,1.245)],[.031,.028,.024,.018],p['leather'],'crossbow',12,26)
        self.tube('tempered crossbow recurved prod',[(-.28,.65,1.24),(-.18,.72,1.25),(0,.66,1.25),(.18,.72,1.25),(.28,.65,1.24)],[.006,.012,.018,.012,.006],p['steel'],'crossbow',12,26)
        self.tube('taut crossbow loaded string',[(-.28,.65,1.24),(0,.43,1.245),(.28,.65,1.24)],[.0016]*3,p['ivory'],'crossbow',5,16)
        self.tube('loaded frost quarrel',[(0,.42,1.27),(0,.86,1.27)],[.004,.003],p['steel'],'crossbow',8,12)
        self.gem('quarrel frost crystal tip',(0,.874,1.27),(.014,.025,.012),p['magic'],'crossbow',12,6)
        self.s.socket('attack_muzzle',self.V((0,.86,1.27)),'crossbow')

    def featherwings(self):
        p=self.p
        for sign,side in [(-1,'L'),(1,'R')]:
            bone='wing_'+side
            self.tube('anatomical wing shoulder elbow leading edge '+side,[(sign*.105,-.127,1.42),(sign*.24,-.16,1.62),(sign*.49,-.17,1.79),(sign*.73,-.19,1.77)],[.045,.055,.044,.012],p['ivory'],bone,14,24)
            for j in range(11):
                root=Vector((sign*(.24+j*.045),-.171,1.63+.16*math.sin(j/10*math.pi/2)));tip=root+Vector((sign*(.11+j*.02),-.045,-(.24+j*.033)))
                self.leaf('layered primary feather with tapered vane '+side+str(j),tuple(root),tuple(tip-root),p['ivory'],.025 if j<5 else .03,bone)
                self.tube('feather central tapering quill', [tuple(root),tuple(root.lerp(tip,.55)),tuple(tip)],[.002,.0015,.0005],p['trim'],bone,5,12)
            for j in range(9):
                root=(sign*(.16+j*.047),-.13,1.55+.12*math.sin(j/8*math.pi));self.leaf('overlapping secondary and covert feather '+side+str(j),root,(sign*.1,-.01,-.20),p['ivory'],.029,bone)
            # Staggered short upper/median/greater covert rows cover the root
            # of the flight feathers and muscular leading edge. They form a
            # layered wing surface rather than a single comb of long plumes.
            for row in range(3):
                for j in range(9):
                    root=(sign*(.22+j*.053+(.015 if row%2 else 0)),-.145+row*.005,1.62+.16*math.sin(j/8*math.pi/2)-.034*row)
                    self.leaf('layered feather covert row '+side+str(row)+' '+str(j),root,(sign*(.025+.005*j),.004,-(.095+.009*j)),p['ivory'],.023+row*.003,bone)
        self.loop('aureole over sculpted crown',[(.18*math.cos(TAU*i/32),-.105,1.88+.18*math.sin(TAU*i/32)) for i in range(32)],.004,p['trim'],'head')

    def identity(self):
        p=self.p;f=self.family
        if self.closed:self.helmet(True)
        elif self.armor:self.helmet(False,crested=f in ('soldier','roseguard','kingdomprotector'))
        elif f in ('archer','wyvernhunter','rimewatch'):self.hood()
        self.cape(.28 if f in ('crownofages','archbishop','stormcitadel','roseguard') else .50,.31 if self.advanced else .27)
        if self.armor:self.armorplates()
        if self.sword:
            self.swordweapon();self.shield()
        elif self.hammer:self.hammerweapon()
        elif self.bow:self.bowweapon()
        elif self.crossbow:self.crossbowweapon()
        elif self.prayer:
            self.s.socket('attack_muzzle',self.V((0,.265,1.34)),'torso')
        elif self.bomb:
            x,y,z=self.grips['R'];self.gem('held alchemical firebomb',(x,y,z+.075),(.045,.045,.050),p['dark'],'weapon',20,12)
            self.tube('bomb socket and curved slow match',[(x,y,z+.12),(x,y,z+.145),(x+.023,y,z+.16)],[.009,.004,.002],p['trim'],'weapon',8,14)
            self.gem('burning fuse',(x+.023,y,z+.16),(.005,.005,.007),p['magic'],'weapon',12,6);self.s.socket('attack_muzzle',self.V((x,y,z+.075)),'weapon')
        else:self.staffweapon()
        if self.wings:self.featherwings()
        if f in ('druid','greenheart','eldergrove','mothernature'):
            for sign in (-1,1):
                self.tube('sculpted organically branching antler',[(sign*.09,-.045,1.9),(sign*.16,-.06,2.02),(sign*.23,-.055,2.095),(sign*.26,-.055,2.17)],[.014,.011,.008,.001],p['ivory'],'head',10,20)
                self.tube('antler branched tine',[(sign*.16,-.06,2.02),(sign*.13,-.045,2.12),(sign*.15,-.04,2.19)],[.008,.005,.001],p['ivory'],'head',8,12)
                for j in range(4):self.leaf('overlapping natural leaf mantle',(sign*(.12+j*.035),.038,1.46),(sign*.025,.018,-(.15+j*.025)),p['cloth'],.032,'torso')
            if f=='mothernature':
                # Nature Spirit keeps its hovering, nonhuman jade identity.
                for sign in (-1,1):self.tube('ascending translucent spirit ribbon',[(sign*.25,-.11,.33),(sign*.31,-.07,.66),(sign*.28,-.09,1.02),(sign*.20,-.10,1.35)],[.004,.009,.012,.003],p['magic'],'pelvis',8,24)
                for i in range(5):self.leaf('floating spirit leaves',(.30*math.cos(i*TAU/5),.27*math.sin(i*TAU/5),.5+i*.13),(.035,.015,.09),p['magic'],.023,'root')
        if f in ('crownofages','elvenking','stormcitadel','archangel'):self.crown(self.elven)
        if f=='mage':
            self.loft('sewn shaped wizard hat crown',[(1.866,.134,.12,.12,-.007),(1.905,.129,.115,.116,-.010),(2.00,.084,.079,.080,-.012),(2.1,.031,.037,.04,-.026),(2.16,.003,.005,.006,-.09)],p['cloth'],'head',28,18)
            self.loft('rounded stitched wizard brim',[(1.859,.182,.170,.16,-.01),(1.875,.183,.169,.16,-.01)],p['leather'],'head',32,3)
        if f in ('cleric','sunward','archbishop'):
            for sign in (-1,1):self.mesh('embroidered ceremonial stole',[(sign*.071,.108,1.48),(sign*.126,.130,1.38),(sign*.13,.137,.74),(sign*.074,.147,.735)],[(0,1,2,3)],p['ivory'],'torso',.003)
            self.loft('sculpted linen collar',[(1.43,.165,.11,.098,0),(1.49,.112,.085,.078,0),(1.515,.077,.064,.058,0)],p['ivory'],'torso',24,8)
            if f=='archbishop':
                self.loft('tailored folded ceremonial mitre',[(1.85,.112,.080,.080,-.014),(1.92,.105,.070,.065,-.011),(2.03,.082,.024,.022,-.007),(2.12,.001,.006,.006,-.003)],p['ivory'],'head',20,16)
                self.tube('mitre chased front ridge',[(0,.085,1.855),(0,.056,1.98),(0,.008,2.12)],[.004]*3,p['trim'],'head',6,16)
        if f in ('runebreaker','royalmarshal'):
            self.loft('stitched formed working apron',[(.45,.158,.136,.119,0),(.64,.165,.14,.124,0),(.84,.16,.143,.127,0),(1.02,.138,.122,.114,0),(1.33,.137,.126,.115,0)],p['leather'],'torso',28,16)
            for sign in (-1,1):
                self.tube('apron sewn shoulder strap',[(sign*.095,.092,1.48),(sign*.106,.136,1.33),(sign*.102,.144,1.20)],[.008]*3,p['trim'],'torso',6,16)
                self.loop('sculpted rounded eyeglass frame',[(sign*.044+.022*math.cos(TAU*i/24),.105,1.805+.022*math.sin(TAU*i/24)) for i in range(24)],.0026,p['trim'],'head')
            self.tube('spectacle bridge',[(-.022,.105,1.805),(0,.108,1.812),(.022,.105,1.805)],[.0022]*3,p['trim'],'head',6,12)
            self.loft('stitched shaped work cap',[(1.842,.115,.105,.112,-.006),(1.90,.114,.098,.10,-.012),(1.962,.026,.025,.026,-.012)],p['leather'],'head',28,12)
            self.mesh('shaped curved cap peak',[(-.107,.074,1.843),(0,.094,1.849),(.107,.074,1.843),(.09,.156,1.825),(0,.166,1.826),(-.09,.156,1.825)],[(0,1,4,5),(1,2,3,4)],p['leather'],'head',.005)
            if f=='runebreaker':
                x,y,z=self.grips['L'];self.mesh('held engraved measuring rule',[(x-.014,y,z-.12),(x+.014,y,z-.12),(x+.014,y,z+.14),(x-.014,y,z+.14)],[(0,1,2,3)],p['ivory'],'hand_L',.006)
                for i in range(8):self.tube('ruler engraved measure',[ (x-.012,y+.005,z-.10+i*.028),(x+.002,y+.005,z-.10+i*.028)],[.001]*2,p['dark'],'hand_L',4,4)
            else:
                self.loft('alchemical stitched backpack',[(.89,.143,.081,.088,-.18),(1.08,.148,.08,.085,-.18),(1.31,.139,.073,.077,-.18)],p['leather'],'torso',20,12)
                for sign in (-1,1):self.tube('alchemical pressure chimney',[(sign*.09,-.23,1.10),(sign*.09,-.23,1.42)],[.017,.013],p['trim'],'torso',10,14)
        if f in ('stormcaller','tempest','stormcitadel'):
            self.loop('storm engraved brow circlet',[(.114*math.cos(TAU*i/32),-.008+.101*math.sin(TAU*i/32),1.854) for i in range(32)],.0035,p['trim'],'head')
            for i in range(3 if f!='stormcaller' else 2):
                a=i*TAU/3;self.gem('floating elemental focus '+str(i),(.28*math.cos(a),.25*math.sin(a),1.65+.10*i),(.028,.028,.035),p['magic'],'torso',16,8)
        if f=='monk':
            for i in range(9):
                a=i*math.pi/8;self.gem('carved monastic prayer bead',(.125*math.cos(a),.128,1.4-.14*math.sin(a)),(.010,.010,.010),p['leather'],'torso',10,6)
            self.tube('knotted monastic waist cord',[(0,.125,1.02),(.035,.16,.88),(.015,.17,.72)],[.004]*3,p['ivory'],'pelvis',6,16)
        if f in ('roseguard','crownofages','kingdomprotector','kingsrangerguard'):
            self.leaf('engraved heraldic breast crest',(0,.15,1.15),(0,0,.20),p['trim'],.04,'torso')
        if f in ('thornwarden','verdantguard','elvenking','royalranger','kingsrangerguard'):
            for sign in (-1,1):self.leaf('fitted leaf embossed shoulder armor',(sign*.148,.025,1.48),(sign*.09,.02,-.14),p['trim'],.032,'upper_arm_'+('R' if sign>0 else 'L'))
        # Attached held book is authored around the left actual offering palm.
        if f in ('mage','cleric','sunward','eldergrove','archbishop'):
            x,y,z=self.grips['L'];self.mesh('stitched bound spellbook cover',[(x-.057,y-.010,z+.05),(x+.057,y-.01,z+.05),(x+.057,y+.075,z+.025),(x-.057,y+.075,z+.025)],[(0,1,2,3)],p['leather'],'hand_L',.017)
            self.mesh('individual parchment book block',[(x-.050,y-.005,z+.061),(x+.05,y-.005,z+.061),(x+.05,y+.066,z+.039),(x-.05,y+.066,z+.039)],[(0,1,2,3)],p['ivory'],'hand_L',.010)
        self.rig['identity']=DATA[f]['name'];self.rig['anatomy']='Adult face sculpt and five independently weighted separated fingers on continuous arm-wrist-palm surfaces'

    def build(self):
        self.body();self.face();self.arms();self.identity()
        # Seat the shorter adult face back onto the neck. Every scalp, crown,
        # helmet and ear follows this same authored placement, avoiding the
        # elongated exposed neck that a face-only correction would create.
        for obj in self.s.parts:
            if obj.vertex_groups.get('head'):
                for vertex in obj.data.vertices:vertex.co.z-=.070*self.h
        actions(self.rig,self.kind,self.wings)
        root=bpy.data.objects.new('defender_'+self.family,None);bpy.context.collection.objects.link(root);self.rig.parent=root
        root['modelRevision']='v8';root['articulationRevision']=3;root['attackReleaseFraction']=.36;root['designName']=DATA[self.family]['name']
        return self

def bounds():
    bpy.context.view_layer.update();points=[o.matrix_world@v.co for o in bpy.context.scene.objects if o.type=='MESH' for v in o.data.vertices]
    lo=[min(v[i] for v in points) for i in range(3)];hi=[max(v[i] for v in points) for i in range(3)]
    return {'min':lo,'max':hi,'size':[hi[i]-lo[i] for i in range(3)]}

def export_model(path):
    originals=[o for o in bpy.context.scene.objects if o.type=='MESH'];groups={};copies=[]
    for obj in originals:groups.setdefault(tuple(obj.data.materials),[]).append(obj)
    try:
        for materials,parts in groups.items():
            bpy.ops.object.select_all(action='DESELECT');selected=[]
            for obj in parts:
                copy=obj.copy();copy.data=obj.data.copy();bpy.context.collection.objects.link(copy);copy.select_set(True);selected.append(copy)
                # Keep the full editable authoring topology in the source.
                # Optimise production clothes/gear while retaining the face
                # and fingers, which carry the important small-scale identity.
                protected=any(word in obj.name for word in ('single continuous','adult face sculpt','anatomical eyelid','iris','cornea','pupil'))
                if not protected and len(copy.data.polygons)>30:
                    bpy.context.view_layer.objects.active=copy
                    mod=copy.modifiers.new('Web silhouette-preserving detail optimisation','DECIMATE');mod.ratio=.52 if path.name=='advanced_archangel.glb' else .57 if path.name.startswith('advanced_') else .42
                    bpy.ops.object.modifier_apply(modifier=mod.name)
            bpy.context.view_layer.objects.active=selected[0]
            if len(selected)>1:bpy.ops.object.join()
            obj=selected[0];obj.name='Export '+materials[0].name;copies.append(obj)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in copies:obj.select_set(True)
        for obj in bpy.context.scene.objects:
            if obj.type in ('ARMATURE','EMPTY'):obj.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=False,export_extras=True,export_skins=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_rest_position_armature=True,export_reset_pose_bones=True,export_anim_single_armature=True,export_cameras=False,export_lights=False)
        actual_triangles=sum(sum(len(p.vertices)-2 for p in obj.data.polygons) for obj in copies)
    finally:
        for obj in copies:
            if obj.name in bpy.data.objects:bpy.data.objects.remove(obj,do_unlink=True)
    return actual_triangles

def set_colour(mat,hex):
    rgba=tuple(A.linear(hex[i:i+2]) for i in (0,2,4))+(1,);mat.diffuse_color=rgba;mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=rgba

def frame_camera(camera,dim,where=(-2.7,7,2),size=(400,520)):
    centre=Vector(tuple((dim['min'][i]+dim['max'][i])/2 for i in range(3)));camera.location=centre+Vector(where);camera.rotation_euler=(centre-camera.location).to_track_quat('-Z','Y').to_euler()
    bpy.context.view_layer.update();points=[camera.matrix_world.inverted()@(o.matrix_world@Vector(v)) for o in bpy.context.scene.objects if o.type=='MESH' for v in o.bound_box]
    width=max(p.x for p in points)-min(p.x for p in points);height=max(p.y for p in points)-min(p.y for p in points);aspect=size[0]/size[1]
    camera.data.ortho_scale=max(height,width/aspect)*1.10;bpy.context.scene.render.resolution_x,bpy.context.scene.render.resolution_y=size;bpy.context.scene.render.resolution_percentage=100

def generate(families,render=True,views=False):
    REVIEW.mkdir(parents=True,exist_ok=True);records=[]
    for family in families:
        if family not in BASIC+FAMILIES:raise ValueError('Unowned family '+family)
        army.clear();model=Defender(family).build();scene=bpy.context.scene;scene.frame_set(0)
        dim=bounds();camera=A.configure_scene();frame_camera(camera,dim);scene.cycles.samples=18
        source=SCENES/(family+'_design_v8.blend');scene['ArtRevision']='defenders-v8';scene['Family']=family;scene['Champion']=DATA[family]['name'];scene['NativeBounds']=json.dumps(dim)
        scene['RankPalettes']=json.dumps(A.COLORS if family in BASIC else [COLOURS[family][0]])
        bpy.ops.wm.save_as_mainfile(filepath=str(source))
        for rank in range(1,7) if family in BASIC else [1]:
            if family in BASIC:
                set_colour(model.p['cloth'],A.COLORS[rank-1]);model.p['cloth'].name=family+' V8 Rank_'+str(rank)+'_cloth'
            scene.frame_set(0);name=f'human_{family}_t{rank}.glb' if family in BASIC else f'advanced_{family}.glb'
            triangles=export_model(OUT/name)
            record={'id':family+'-t'+str(rank),'file':name,'kind':'tower','family':family,'tier':rank,'style':'designed-defenders-v8','assetRevision':'designed-defenders-v8','designRevision':11,'modelRevision':'v8','authoring':'Blender','triangles':triangles,'name':DATA[family]['name'],'source':'blender/scenes/'+source.name,'bounds':dim,'articulationRevision':3,'rigType':'deform-armature','attackReleaseFraction':.36,'animationClips':{'Idle':2.4,'Attack':1.0},'bones':len(model.rig.data.bones),'attackJoints':sorted(b.name for b in model.rig.data.bones),'materials':len(set(mat for o in model.s.parts for mat in o.data.materials))}
            records.append(record)
            if render:
                scene.render.filepath=str(PORTRAITS/(family+'-t'+str(rank)+'.png'));bpy.ops.render.render(write_still=True);army.clean_portrait_metadata(Path(scene.render.filepath))
                if rank==1:
                    frame_camera(camera,dim,(0,7,1.4),(600,800));scene.render.filepath=str(REVIEW/(family+'-front.png'));bpy.ops.render.render(write_still=True);army.clean_portrait_metadata(Path(scene.render.filepath));frame_camera(camera,dim)
            print('V8_HUMAN '+family+' '+str(rank)+' '+str(triangles)+' triangles '+str(record['bones'])+' bones',flush=True)
        if views:
            for side,where in [('back',(0,-7,1.4)),('left',(-7,0,1.4)),('right',(7,0,1.4))]:
                frame_camera(camera,dim,where,(600,800));scene.render.filepath=str(REVIEW/(family+'-'+side+'.png'));bpy.ops.render.render(write_still=True);army.clean_portrait_metadata(Path(scene.render.filepath))
        # Persist this batch separately for root merge; never race the manifest.
        destination=ROOT/'artifacts'/('defender-humans-v8-metadata-'+families[0]+'.json');destination.write_text(json.dumps(records,indent=2)+'\n',encoding='utf-8')
    print('V8_HUMAN_METADATA '+str(destination),flush=True)

if __name__=='__main__':
    requested=sys.argv[sys.argv.index('--family')+1].split(',') if '--family' in sys.argv else BASIC+FAMILIES
    generate(requested,'--no-render' not in sys.argv,'--views' in sys.argv)
