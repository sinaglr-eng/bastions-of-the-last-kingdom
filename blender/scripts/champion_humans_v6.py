"""Fresh character sculptures for the approved 37-champion release.

Independent of the recruit/archer mesh. Each character has a continuous sculpted
face, tailored torso/sleeves and an equipment silhouette matching its new role.
Called by author_army: build(family, author_army).
"""
import math
import bpy
from mathutils import Vector
import cohesive
import articulation

FAMILIES = {
    'rimewatch', 'frostblade', 'roseguard', 'highking', 'crownofages', 'thornwarden',
    'verdantguard', 'tempest', 'stormcitadel', 'greenheart', 'eldergrove',
    'sunward', 'dawnspire', 'wyvernhunter', 'kingdomprotector', 'mothernature',
    'royalranger', 'kingsrangerguard', 'elvenking', 'monk', 'archbishop',
    'archangel', 'royalmarshal',
}


class Sculpt:
    """Compact named sculpt/equipment primitives with a consistent +Y front."""
    def __init__(self, a, family):
        self.a, self.family = a, family
        # Identity colors are intentionally specified here rather than inferred
        # from a recruit rank; they belong to these newly authored costumes.
        colors = {
            'rimewatch': ('457b95', 'bfdde1'), 'frostblade': ('447896', 'd5ecf5'),
            'roseguard': ('943c50', 'e4b658'), 'highking': ('202733', 'a7bdcb'),
            'crownofages': ('554380', 'dfbf68'),
            'thornwarden': ('3c754d', 'b2c68b'), 'verdantguard': ('247b70', 'd6b95d'),
            'tempest': ('5b5897', 'b6dbed'), 'stormcitadel': ('234f77', 'afdcf1'),
            'greenheart': ('638544', 'cbbd83'), 'eldergrove': ('36594a', 'b7cb84'),
            'sunward': ('dfd1aa', 'd2a35b'), 'dawnspire': ('e4dfc6', 'c7e9ea'),
            'wyvernhunter': ('55778a', 'b9ccd0'), 'kingdomprotector': ('3d6796', 'd4b66b'),
            'mothernature': ('5f884e', 'e3d4a2'), 'royalranger': ('294f70', 'd0ab57'),
            'kingsrangerguard': ('263e66', 'd5b868'), 'elvenking': ('557343', 'd5c16a'),
            'monk': ('846342', 'd3b788'), 'archbishop': ('813d51', 'e0c074'),
            'archangel': ('799bb9', 'e2e8db'), 'royalmarshal': ('754528', 'd2a05a'),
        }
        color, accent = colors[family]
        self.p = {
            'cloth': a.mat(f'{family} tailored cloth', color),
            'trim': a.mat(f'{family} gilded embroidery', accent, .55),
            'skin': a.mat(f'{family} sculpted skin', 'd8aa85'),
            'steel': a.mat(f'{family} satin steel', 'a7bdc5', .7),
            'darkmetal': a.mat(f'{family} blue tempered steel', '344e5c', .65),
            'leather': a.mat(f'{family} chestnut leather', '694936'),
            'dark': a.mat(f'{family} shadow cloth', '283638'),
            'ivory': a.mat(f'{family} warm linen', 'eae1c5'),
            'hair': a.mat(f'{family} sculpted hair', '493729'),
            'eyes': a.mat(f'{family} focused eyes', '1b2930'),
            'stone': a.mat(f'{family} limestone plinth', 'a9b09d'),
            'edge': a.mat(f'{family} plinth edge', '66776c'),
            'glow': a.mat(f'{family} quiet magical light', accent, .25, .9),
        }

    def mat(self, name, color, metal=0, glow=0):
        return self.a.mat(f'{self.family} {name}', color, metal, glow)

    def orb(self, name, pos, scale, mat, seg=12, rings=6):
        return self.a.ellipsoid(name, pos, scale, mat, seg, rings)

    def rod(self, name, start, end, radius, mat, taper=None, seg=8):
        return self.a.rod(name, start, end, radius, mat, seg, end=taper)

    def box(self, name, pos, size, mat, bevel=.02):
        return self.a.cube(name, pos, size, mat, bevel)

    def ring(self, name, pos, radius, tube, mat, upright=False):
        o = self.a.torus(name, pos, radius, tube, mat)
        if upright: o.rotation_euler[0] = math.pi / 2
        return o

    def mesh(self, name, vertices, faces, mat, solid=0, smooth=False):
        o = self.a.custom(name, vertices, faces, mat)
        if solid:
            m = o.modifiers.new('Tailored fabric thickness', 'SOLIDIFY'); m.thickness = solid
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier=m.name)
        if smooth:
            for p in o.data.polygons: p.use_smooth = True
        return o

    def loft(self, name, levels, mat, sides=12, pleat=.0):
        # Each level is (z, width, depth, offset_y); a single seam-free garment.
        vs=[]
        for z, w, d, cy in levels:
            for j in range(sides):
                an=j*math.tau/sides; fold=1+(pleat if j%2 else -pleat)
                vs.append((w*math.cos(an)*fold, cy+d*math.sin(an)*fold, z))
        fs=[]
        for r in range(len(levels)-1):
            for j in range(sides):
                fs.append((r*sides+j, r*sides+(j+1)%sides,
                           (r+1)*sides+(j+1)%sides, (r+1)*sides+j))
        fs += [tuple(reversed(range(sides))), tuple(range((len(levels)-1)*sides,len(levels)*sides))]
        return self.mesh(name,vs,fs,mat,smooth=True)

    def plinth(self):
        self.a.cylinder('New champion octagonal plinth',(0,0,.06),.40,.12,self.p['edge'],8)
        self.a.cylinder('Sculpted champion stone cap',(0,0,.14),.385,.055,self.p['stone'],8,top=.365)
        self.ring('Identity inlay',(0,0,.17),.33,.013,self.p['trim'])

    def cloak(self, name='Swept sculpted cloak', length=.56, width=.39, mat=None, wind=0):
        mat=mat or self.p['cloth']; vs=[]
        for k,(z,w,y) in enumerate([(1.46,.24,-.065),(1.2,width*.82,-.20),(.9,width,-.28),(length,width*1.08,-.34)]):
            for j in range(9):
                t=j/8; x=(t-.5)*w*2+wind*k/3
                vs.append((x,y+.028*math.cos(j*math.pi),z+(.09*abs(t-.5) if k==3 else 0)))
        fs=[(r*9+j,r*9+j+1,(r+1)*9+j+1,(r+1)*9+j) for r in range(3) for j in range(8)]
        self.mesh(name,vs,fs,mat,.018,True)
        for j in [0,8]:
            for k in range(3): self.rod('Cape woven edge',vs[k*9+j],vs[(k+1)*9+j],.012,self.p['trim'],seg=5)

    def body(self, arms=None, robe=False, armor=False, slender=False, female=False,
             dwarf=False, bare=False, elf=False, hair='short', bald=False):
        """One new continuous face and tailored upper body, never an archer copy."""
        self.plinth()
        h=.83 if dwarf else 1
        w=1.24 if dwarf else (.87 if slender else 1)
        # New asymmetric planted feet and natural knees, continuously sculpted.
        legs=[]
        for side, y in [(-1,.085),(1,-.035)]:
            x=side*.125*w
            foot=self.orb('Rounded sculpted boot',(x,y+.075,.28),(.093*w,.17,.105),self.p['dark'],12,5)
            self.rod('Soft boot shaft',(x,y,.3),(x*.90,y-.02,.57*h+.08),.075*w,self.p['leather'],.069*w)
            legs.append(self.rod('Natural trouser calf',(x*.90,y-.02,.48*h+.12),(x*.84,y-.025,.69*h+.06),.076*w,self.p['dark'],.085*w))
            legs.append(self.rod('Natural trouser thigh',(x*.84,y-.025,.69*h+.06),(x*.58,0,.88*h+.03),.089*w,self.p['dark'],.105*w))
        cohesive.fuse(legs,'Continuous bent trouser anatomy',.022,550,self.p['dark'])
        waist=.98*h; shoulder=1.37*h; head=1.70*h
        torso=[]
        torso.append(self.orb('Tailored breast volume',(0,0,1.18*h),(.235*w,.15,.245*h),self.p['steel'] if armor else self.p['cloth'],12,7))
        torso.append(self.orb('Natural waist contour',(0,0,1.00*h),(.185*w,.135,.17*h),self.p['steel'] if armor else self.p['cloth'],12,6))
        if female:
            torso.append(self.orb('Continuous feminine tunic contour',(0,.025,1.20*h),(.218*w,.165,.19*h),self.p['cloth'],12,6))
        if robe:
            self.loft('Single flowing robe',[(.22,.30*w,.215,-.025),(.46,.31*w,.205,-.01),(.72,.25*w,.17,0),(.98*h,.185*w,.14,0)],self.p['cloth'],16,.06)
        else:
            self.loft('Tailored split tabard skirt',[(.74*h,.235*w,.17,0),(.91*h,.235*w,.17,0),(1.00*h,.19*w,.14,0)],self.p['cloth'],12,.045)
        self.loft('Continuous leather waist belt',[(waist-.035,.208*w,.152,0),(waist+.035,.205*w,.15,0)],self.p['leather'],12)
        self.box('Chased waist buckle',(0,.163,waist),(.074,.025,.061),self.p['trim'],.01)
        if arms is None:
            arms=[((-.21,0,1.34),(-.34,.06,1.18),(-.38,.23,1.10)),((.21,0,1.34),(.36,.03,1.17),(.40,.18,1.17))]
        hands=[]
        for i,(start,elbow,hand) in enumerate(arms):
            start=(start[0]*w,start[1],start[2]*h)
            elbow=(elbow[0]*w,elbow[1],elbow[2]*h)
            hand=(hand[0]*w,hand[1],hand[2]*h); hands.append(hand)
            upper,lower,wrist,weapon=articulation.limb(start,elbow,hand)
            sleeve=self.orb('Anatomical tailored shoulder',start,(.112*w,.11,.122*h),self.p['steel'] if armor else self.p['cloth'],10,5)
            arm_surface=[sleeve,self.rod('Seamless tailored upper arm',start,elbow,.076*w,self.p['steel'] if armor else self.p['cloth'],.069*w)]
            fused=cohesive.fuse(arm_surface,'Continuous articulated upper sleeve',.018,330,self.p['steel'] if armor else self.p['cloth'])
            articulation.attach([fused],upper);before_arm=set(bpy.context.scene.objects)
            self.rod('Fitted forearm',elbow,hand,.071*w,self.p['skin'] if bare else (self.p['steel'] if armor else self.p['leather']),.052*w)
            mid=Vector(elbow).lerp(Vector(hand),.32);end=Vector(elbow).lerp(Vector(hand),.45)
            self.rod('Bracer chased binding',mid,end,.072*w,self.p['trim'],seg=8)
            articulation.attach(set(bpy.context.scene.objects)-before_arm,lower)
            articulation.attach([self.orb('Natural gripping hand',hand,(.057*w,.052,.064),self.p['skin'] if bare else self.p['leather'],10,5)],wrist)
        cohesive.fuse(torso,'Continuous sculpted cuirass and upper sleeves' if armor else 'Seamless sculpted tunic and sleeves',.022,950,self.p['steel'] if armor else self.p['cloth'])
        skinparts=[self.orb('New sculpted head',(0,.022,head),(.149*w,.132,.192*h),self.p['skin'],16,8),
                   self.orb('Sculpted jaw',(0,.069,head-.075*h),(.121*w,.108,.109*h),self.p['skin'],12,6),
                   self.rod('Anatomical neck',(0,0,1.39*h),(0,.012,1.60*h),.073*w,self.p['skin'],seg=10),
                   self.orb('Natural nose',(0,.153,head+.006),(.031,.035,.049),self.p['skin'],10,5)]
        for side in [-1,1]:
            skinparts.append(self.orb('Sculpted pointed ear' if elf else 'Sculpted ear',(side*.155*w,.025,head+.01),(.065 if elf else .028,.045,.067 if elf else .046),self.p['skin'],10,5))
        cohesive.fuse(skinparts,'New continuous face ears and neck',.012,900,self.p['skin'])
        for x in [-.058,.058]:
            self.orb('Inset focused eye',(x*w,.149,head+.038),(.023,.009,.015),self.p['eyes'],8,4)
            self.rod('Sculpted eyebrow',(x*w-.027,.151,head+.072),(x*w+.027,.151,head+.072),.010,self.p['hair'],seg=5)
        self.rod('Defined lip',(-.031,.183,head-.073),(.031,.183,head-.073),.005,self.p['leather'],seg=5)
        if not bald:
            hairparts=[self.orb('Sculpted hair crown',(0,-.016,head+.108*h),(.159*w,.136,.104*h),self.p['hair'],12,6)]
            if hair in ('long','braid','elf'):
                for side in [-1,1]:
                    hairparts.append(self.rod('Swept long hair',(side*.129*w,-.045,head+.08),(side*.147*w,-.01,head-.19),.044,self.p['hair'],.032))
                hairparts.append(self.orb('Long swept hair back',(0,-.12,head-.058),(.13*w,.06,.21*h),self.p['hair'],12,6))
            cohesive.fuse(hairparts,'Continuous sculpted hair',.017,420,self.p['hair'])
            if hair=='braid':
                for i in range(7):self.orb('Woven side braid',(.16,-.055,head-.13-i*.045),(.033,.034,.039),self.p['hair'],8,4)
        return {'head':head,'shoulder':shoulder,'hands':hands,'h':h,'w':w}

    def helmet(self, head=1.7, full=False, crest=False):
        self.orb('New swept forged helmet',(0,-.018,head+.126),(.181,.156,.118),self.p['steel'],16,7)
        self.loft('Continuous shaped helmet brow',[(head+.042,.181,.15,-.012),(head+.083,.179,.146,-.012)],self.p['darkmetal'],12)
        for side in [-1,1]:
            self.box('Helmet sculpted cheek plate',(side*.144,.085,head-.055),(.046,.09,.18),self.p['steel'],.017)
        if full:
            self.mesh('Chiseled knight visor',[(-.126,.16,head+.04),(.126,.16,head+.04),(.106,.175,head-.10),(0,.21,head-.145),(-.106,.175,head-.10)],[(0,1,2,3,4)],self.p['darkmetal'],.025)
            for side in [-1,1]:self.box('Visor narrow eye slit',(side*.066,.186,head+.01),(.062,.012,.016),self.p['dark'],.002)
        if crest:
            for i in range(5):
                self.orb('Curved horsehair plume',(0,-.12+i*.06,head+.235+.05*math.sin(i*.7)),(.038,.051,.085),self.p['cloth'],8,4)

    def plate_helmet(self, heraldic=False, black=False):
        """Closed bascinet with a raised visor, actual eye openings and a gorget.

        The face plate is built around the eye slits rather than painting dark
        rectangles onto a human face. The rear shell encloses the whole skull.
        """
        for o in list(bpy.context.scene.objects):
            if o.name.startswith(('New continuous face ears and neck', 'Continuous sculpted hair',
                                  'Inset focused eye', 'Sculpted eyebrow', 'Defined lip')):
                bpy.data.objects.remove(o, do_unlink=True)
        steel=self.p['steel']; trim=self.p['trim']; dark=self.p['darkmetal']
        # A single curved occipital shell, rising to the bascinet's forged apex.
        levels=[(1.535,.140,.137,-.017),(1.66,.184,.159,-.022),
                (1.80,.188,.166,-.022),(1.90,.159,.144,-.034),
                (1.976,.081,.091,-.034),(2.005,.006,.012,-.025)]
        n=18; angles=[math.pi*.92+j*(math.pi*1.16)/(n-1) for j in range(n)]
        vs=[(w*math.cos(an),cy+d*math.sin(an),z) for z,w,d,cy in levels for an in angles]
        fs=[(r*n+j,r*n+j+1,(r+1)*n+j+1,(r+1)*n+j)
            for r in range(len(levels)-1) for j in range(n-1)]
        self.mesh('Closed forged bascinet rear shell',vs,fs,steel,.021,True)
        # Six columns form a folded center ridge and two open ocular slits.
        xs=[-.177,-.116,-.027,.027,.116,.177]
        rows=[(1.56,.116),(1.655,.240),(1.731,.202),(1.765,.198),(1.85,.171),(1.94,.107)]
        verts=[]
        for r,(z,depth) in enumerate(rows):
            for x in xs:
                taper=[.74,.96,1,1,.94,.69][r]
                verts.append((x*taper,depth-.056*(abs(x)/.177),z+.008*(abs(x)/.177)))
        faces=[]
        for r in range(len(rows)-1):
            for j in range(len(xs)-1):
                if r==2 and j in (1,3):continue
                faces.append((r*6+j,r*6+j+1,(r+1)*6+j+1,(r+1)*6+j))
        visor=self.mesh('Raised folded steel visor with open eye slits',verts,faces,steel,.014)
        bevel=visor.modifiers.new('Rounded visor folds','BEVEL');bevel.width=.006;bevel.segments=2
        bpy.context.view_layer.objects.active=visor;bpy.ops.object.modifier_apply(modifier=bevel.name)
        self.mesh('Bascinet curved front crown',verts[-6:]+[(0,-.025,2.005)],
                  [(j,j+1,6) for j in range(5)],steel,.014,True)
        # A dark inner hood can be seen through the geometric openings.
        self.orb('Helmet recessed shadow lining',(0,.104,1.73),(.139,.055,.143),self.p['dark'],12,6)
        self.rod('Visor raised center ridge',(0,.180,1.94),(0,.213,1.775),.010,trim,seg=6)
        self.rod('Visor folded beak ridge',(0,.213,1.775),(0,.25,1.655),.011,trim,seg=6)
        for side in [-1,1]:
            self.orb('Visor side pivot rivet',(side*.183,.050,1.77),(.022,.019,.025),trim,8,4)
            for j in range(3):
                x=side*(.051+j*.032); y=.231-.056*(abs(x)/.177)
                self.box('Recessed visor breathing aperture',(x,y+.006,1.685),(.013,.006,.030),dark,.002)
            self.rod('Rolled steel visor lower lip',(side*.012,.125,1.568),(side*.17,.072,1.57),.011,trim,seg=6)
        self.loft('Articulated steel gorget',[(1.397,.145,.12,-.013),(1.43,.163,.133,-.013),
                                           (1.50,.147,.119,-.013),(1.555,.116,.097,-.013)],steel,16)
        self.loft('Gorget overlapping collar seam',[(1.43,.168,.137,-.013),(1.446,.166,.135,-.013)],trim,16)
        if heraldic:
            # A swept red crest with gold saddle, distinct from the plain Knight.
            self.rod('Lionheart helmet gilded crest saddle',(0,-.155,1.956),(0,.07,1.991),.022,trim,seg=8)
            for i in range(6):
                y=-.18+i*.049
                self.orb('Lionheart swept crimson crest',(0,y,2.055+.036*math.sin(i*.62)),
                         (.032,.040,.081),self.p['cloth'],10,5)
            self.lion((0,.187,1.844),.047)
        if black:
            # The eye recess remains dark; a restrained cold glint is set deep inside.
            for side in [-1,1]:
                self.rod('Kingslayer recessed cold gaze',(side*.044,.157,1.750),
                         (side*.099,.154,1.754),.006,self.p['glow'],seg=5)
            for side in [-1,1]:
                self.leaf('Kingslayer swept helmet crest',(side*.105,-.088,1.946),
                          (side*.033,-.14,.105),steel,.028)

    def plate_armor(self, royal=False):
        """Convex breastplate, articulated fauld, cuisses and shaped sabatons."""
        steel=self.p['steel']; trim=self.p['trim']; dark=self.p['darkmetal']
        # Swept front plate has a central keel and contours under the arms.
        levels=[(1.045,.185,.145),(1.14,.208,.190),(1.29,.223,.211),(1.39,.177,.156)]
        n=9; verts=[]
        for z,w,depth in levels:
            for j in range(n):
                t=j/(n-1); x=(t-.5)*2*w
                verts.append((x,.085+(depth-.085)*math.sin(t*math.pi),z))
        fs=[(r*n+j,r*n+j+1,(r+1)*n+j+1,(r+1)*n+j) for r in range(3) for j in range(n-1)]
        self.mesh('Contoured forged breastplate',verts,fs,steel,.022,True)
        self.rod('Breastplate hammered center ridge',(0,.155,1.05),(0,.225,1.29),.011,trim,seg=6)
        for z in [.99,1.027,1.064]:
            self.loft('Overlapping articulated fauld plate',[(z-.025,.225,.175,0),(z+.019,.211,.166,0)],steel,16)
            self.loft('Fauld chased lower seam',[(z-.027,.229,.179,0),(z-.019,.227,.177,0)],dark,16)
        for side in [-1,1]:
            # Pair of hung hip plates and three shoulder lames with rolled edges.
            x=side*.126
            self.mesh('Suspended steel tasset',[(x-.098,.19,.99),(x+.098,.19,.99),
                                               (x+.084,.187,.80),(x-.084,.187,.80)],[(0,1,2,3)],steel,.019)
            for j in range(3):
                self.rod('Tasset overlapping steel seam',(x-.081,.205,.84+j*.052),
                         (x+.081,.205,.84+j*.052),.007,dark,seg=5)
                self.orb('Articulated shoulder lame',(side*(.237+j*.025),-.001,1.406-j*.046),
                         (.139-j*.010,.132,.049),steel,12,5)
            self.rod('Pauldron rolled steel lip',(side*.17,.123,1.401),
                     (side*.354,.092,1.356),.015,trim,seg=6)
            for z,width,depth in [(.70,.077,.052),(.575,.080,.056),(.385,.065,.053)]:
                self.orb('Rounded shaped leg armor plate',(side*.12,.133,z),(width,depth,.100),steel,12,6)
            self.orb('Full enclosing forged greave',(side*.12,.027,.474),(.087,.102,.167),steel,12,6)
            self.rod('Greave central rolled ridge',(side*.12,.189,.32),(side*.12,.185,.61),.010,trim,seg=6)
            for j in range(3):
                self.orb('Overlapping sabaton toe plate',(side*.125,.134+j*.052,.30-j*.015),
                         (.093,.057,.043),steel,12,5)
            self.orb('Steel articulated elbow couter',(side*.34,.07,1.17),(.083,.073,.068),steel,12,5)
            self.orb('Steel closed gauntlet',(side*.392,.20,1.15),(.066,.063,.072),steel,12,5)
        if royal:
            self.loft('Heraldic embossed breastplate collar',[(1.36,.221,.15,-.01),(1.39,.199,.141,-.01)],trim,16)

    def warhammer(self, x=.40, y=.21, z=1.64, sacred=False):
        self.rod('Bound warhammer wooden haft',(x,y,.91),(x,y,z+.01),.032,self.p['leather'],seg=10)
        for zz in [1.04,1.115,1.19]:
            self.rod('Warhammer grip wrapped bands',(x,y,zz-.011),(x,y,zz+.011),.037,self.p['trim'],seg=8)
        self.orb('Warhammer weighted pommel',(x,y,.88),(.049,.042,.048),self.p['trim'],10,5)
        self.box('Forged square warhammer head',(x,y,z),(.34,.15,.19),self.p['steel'],.019)
        for side in [-1,1]:
            self.box('Warhammer gilded striking face',(x+side*.176,y,z),(.033,.176,.22),self.p['trim'],.012)
            self.box('Warhammer recessed striking inset',(x+side*.197,y,z),(.010,.11,.137),self.p['darkmetal'],.005)
        self.box('Warhammer chased center binding',(x,y,z),(.073,.16,.201),self.p['trim'],.012)
        if sacred:
            self.rod('Holy hammer vertical blessing',(x,y+.087,z-.071),(x,y+.087,z+.075),.014,self.p['glow'],seg=6)
            self.rod('Holy hammer cross blessing',(x-.052,y+.088,z+.018),(x+.052,y+.088,z+.018),.010,self.p['glow'],seg=6)

    def crown(self, head=1.7, elven=False):
        z=head+.13
        self.loft('Royal chased circlet',[(z-.035,.169,.143,.012),(z+.017,.164,.14,.012)],self.p['trim'],12)
        for j in range(7 if elven else 8):
            an=j*math.tau/(7 if elven else 8);x=.167*math.cos(an);y=.012+.145*math.sin(an)
            self.rod('Leaf crown spire' if elven else 'Royal crown fleur', (x,y,z), (x*1.08,y*1.08,z+(.13 if elven else .09)),.023,self.p['trim'],.005,seg=5)
        self.orb('Crown central stone',(0,.16,z+.012),(.039,.014,.044),self.p['glow'],8,4)

    def mantle(self, fur=False, hood=False, head=1.7):
        self.loft('Sculpted shoulder mantle',[(1.34,.285,.17,-.015),(1.47,.23,.13,-.015)],self.p['ivory'] if fur else self.p['cloth'],12,.03)
        if fur:
            for j in range(9):
                an=.2+j*math.pi/8
                self.orb('Soft mantle fur tuft',(.235*math.cos(an),.145*math.sin(an),1.425),(.057,.05,.064),self.p['ivory'],8,4)
        if hood:
            # Open-faced cloth hood sculpt: side/roof/rear loft around face.
            arch=[(-.165,.15,head-.135),(-.194,.145,head+.02),(-.153,.13,head+.19),(0,.11,head+.255),(.153,.13,head+.19),(.194,.145,head+.02),(.165,.15,head-.135)]
            rear=[(x*.94,-.135,z-.035) for x,y,z in arch]
            vs=arch+rear+[(0,-.20,head+.04)]
            fs=[(i,i+1,8+i,7+i) for i in range(6)]+[(7+i,8+i,14) for i in range(6)]+[(13,7,14)]
            self.mesh('New fitted open hood',vs,fs,self.p['cloth'],.018,True)
            for a,b in zip(arch,arch[1:]):self.rod('Hood tailored edge',a,b,.013,self.p['trim'],seg=5)

    def blade(self, x=.40, y=.21, guard=1.15, length=.65, frost=False, broad=False, down=False):
        direction=-1 if down else 1
        self.rod('Wrapped sword handle',(x,y,guard-direction*.15),(x,y,guard),.032,self.p['leather'],seg=8)
        self.orb('Chased sword pommel',(x,y,guard-direction*.18),(.045,.042,.045),self.p['trim'],8,4)
        self.box('New swept sword crossguard',(x,y,guard),(.23,.06,.045),self.p['trim'],.015)
        w=.074 if broad else .043;tip=guard+direction*length
        vs=[(x-w,y,guard+direction*.025),(x+w,y,guard+direction*.025),(x+w*.78,y,tip-direction*.12),(x,y,tip),(x-w*.78,y,tip-direction*.12),(x,y+.028,guard+direction*.03),(x,y+.028,tip-direction*.13)]
        self.mesh('Forged broad blade' if broad else 'Forged narrow blade',vs,[(0,1,5),(1,2,6,5),(2,3,6),(3,4,6),(4,0,5,6),(0,4,3,2,1)],self.p['steel'])
        if frost:
            for i in range(4):self.box('Glowing etched frost sigil',(x,y+.031,guard+direction*(.12+i*.12)),(.024,.008,.042),self.p['glow'],.003)

    def shield(self, x=-.38, y=.25, z=1.08, style='kite', lion=False):
        if style=='round':
            o=self.a.cylinder('Round protective shield',(x,y,z),.24,.052,self.p['cloth'],16);o.rotation_euler[0]=math.pi/2
            self.ring('Round shield embossed rim',(x,y+.031,z),.227,.020,self.p['trim'],True)
        else:
            vs=[(x-.205,y,z+.25),(x+.205,y,z+.25),(x+.22,y,z-.03),(x,y,z-.31),(x-.22,y,z-.03)]
            self.mesh('Sculpted pointed heraldic shield',vs,[(0,1,2,3,4)],self.p['cloth'],.046)
            for a,b in zip(vs,vs[1:]+vs[:1]):self.rod('Chased shield border',a,b,.019,self.p['trim'],seg=6)
        if lion:self.lion((x,y+.045,z+.015),.12)
        else:
            self.rod('Shield protective sigil',(x,y+.038,z-.13),(x,y+.038,z+.15),.017,self.p['trim'],seg=5)
            self.rod('Shield blessing crossbar',(x-.09,y+.038,z+.045),(x+.09,y+.038,z+.045),.014,self.p['trim'],seg=5)

    def lion(self, pos, size=.10):
        x,y,z=pos
        self.orb('Embossed lion mane',(x,y,z),(size,.027,size),self.p['trim'],12,6)
        self.orb('Embossed lion muzzle',(x,y+.029,z-.016),(size*.47,.018,size*.39),self.p['darkmetal'],10,5)
        for side in [-1,1]:
            self.orb('Lion ear',(x+side*size*.55,y+.012,z+size*.55),(size*.24,.02,size*.25),self.p['trim'],8,4)
            self.orb('Lion eye',(x+side*size*.32,y+.028,z+size*.12),(.009,.008,.009),self.p['glow'],6,3)

    def pauldrons(self, large=False, leaf=False):
        for side in [-1,1]:
            self.orb('Leaf-shaped elven shoulder' if leaf else 'Rounded layered pauldron',(side*.235,-.015,1.40),(.16 if large else .135,.13,.09),self.p['trim'] if leaf else self.p['steel'],12,5)
            self.rod('Pauldron lower chased lip',(side*.17,.115,1.385),(side*.31,.11,1.36),.013,self.p['trim'],seg=6)

    def quiver(self, fancy=False):
        self.rod('Sculpted back quiver',(.22,-.18,.98),(.25,-.18,1.43),.075,self.p['leather'],.095,seg=10)
        self.rod('Quiver engraved rim',(.245,-.18,1.38),(.25,-.18,1.44),.098,self.p['trim'],seg=10)
        for i in range(4 if fancy else 3):
            x=.22+(i%2)*.055; y=-.2+(i//2)*.05; top=1.66+(i%3)*.065
            self.rod('Reserved arrow',(x-.015,y,1.23),(x,y,top),.008,self.p['ivory'],seg=5)
            self.mesh('Cut arrow feather',[(x,y,top),(x-.032,y,top-.055),(x-.032,y,top-.10),(x,y,top-.075)],[(0,1,2,3)],self.p['cloth'],.004)

    def bow(self, elven=False, royal=False, x=-.45, z=1.15, fan=1):
        # Distinct new side-held bow: limbs sweep outward instead of the recruit draw pose.
        pts=[(x,.26,z-.50),(x-.075,.27,z-.40),(x-.13,.29,z-.22),(x-.035,.28,z),(x-.13,.29,z+.22),(x-.075,.27,z+.40),(x,.26,z+.50)]
        for a,b in zip(pts,pts[1:]):self.rod('Leaf recurve limb' if elven else 'Royal horn bow' if royal else 'Ranger laminated bow',a,b,.026,self.p['trim'] if royal else self.p['leather'],seg=7)
        self.rod('Taut bowstring',pts[0],pts[-1],.005,self.p['ivory'],seg=4)
        self.rod('Bow wrapped grip',(x-.035,.28,z-.06),(x-.035,.28,z+.06),.036,self.p['dark'],seg=8)
        if elven:
            for side in [-1,1]:self.leaf('Elven bow leaf fin',(x-.07,.27,z+side*.37),(.10,.0,side*.09),self.p['trim'],.04)
        for i in range(fan):
            yy=.25+i*.037;zz=1.1+i*.022
            self.rod('Readied enchanted arrow',(.03,yy,zz),(.45,yy+.20,zz),.009,self.p['ivory'],seg=5)
            self.rod('Arrow steel point',(.45,yy+.20,zz),(.50,yy+.225,zz),.024,self.p['steel'],.002,seg=5)

    def crossbow(self):
        y=.34;z=1.12
        self.box('New arbalest carved stock',(0,y,z),(.074,.64,.075),self.p['leather'],.014)
        self.box('Crossbow brass trigger housing',(0,y-.15,z-.04),(.10,.13,.09),self.p['darkmetal'],.009)
        self.rod('Crossbow bolt rail',(0,y-.10,z+.05),(0,y+.40,z+.05),.014,self.p['steel'],seg=6)
        limbs=[(-.36,y+.21,z),(-.25,y+.31,z),(-.10,y+.27,z),(.10,y+.27,z),(.25,y+.31,z),(.36,y+.21,z)]
        for a,b in zip(limbs,limbs[1:]):self.rod('Forged crossbow limb',a,b,.025,self.p['darkmetal'],seg=8)
        for x in [-.36,.36]:self.rod('Drawn crossbow bowstring',(x,y+.21,z),(0,y-.07,z),.005,self.p['ivory'],seg=4)
        self.rod('Frostbound crossbow bolt',(0,y-.1,z+.075),(0,y+.43,z+.075),.012,self.p['ivory'],seg=6)
        self.rod('Ice bolt tip',(0,y+.43,z+.075),(0,y+.54,z+.075),.041,self.p['glow'],.003,seg=5)

    def leaf(self, name, start, end, mat, width=.06):
        a=Vector(start); b=a+Vector(end);d=b-a
        side=Vector((d.z,0,-d.x)).normalized()*width
        mid=a+d*.46; ridge=mid+Vector((0,.025,0))
        vs=[tuple(a),tuple(mid+side),tuple(b),tuple(mid-side),tuple(ridge),tuple(mid-Vector((0,.014,0)))]
        return self.mesh(name,vs,[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(0,5,1),(1,5,2),(2,5,3),(3,5,0)],mat, smooth=True)

    def staff(self, x=.40, top=1.96, style='sun', orbcolor=None):
        self.rod('New ceremonial staff shaft',(x,.18,.25),(x,.18,top-.18),.025,self.p['leather'],seg=8)
        for z in [.4,1.35,top-.20]:self.rod('Staff engraved cuff',(x,.18,z-.023),(x,.18,z+.023),.035,self.p['trim'],seg=8)
        if style=='forest':
            pts=[(x,.18,top-.28),(x-.08,.18,top-.16),(x+.02,.18,top),(x+.16,.18,top+.055)]
            for a,b in zip(pts,pts[1:]):self.rod('Living staff branch',a,b,.041,self.p['leather'],.025,seg=8)
            for k in range(3):self.leaf('Living staff leaf',(x+.02+k*.04,.19,top-.015+k*.02),(.10,.0,.10),self.p['cloth'],.037)
        elif style=='crozier':
            pts=[(x,.18,top-.2),(x,.18,top-.08),(x+.04,.18,top+.04),(x+.16,.18,top+.075),(x+.24,.18,top+.015),(x+.24,.18,top-.08),(x+.17,.18,top-.12)]
            for a,b in zip(pts,pts[1:]):self.rod('Bishop curved crozier',a,b,.025,self.p['trim'],seg=8)
        else:
            focus=self.mat('Staff spell focus',orbcolor or 'd2e9e6',.25,1.0)
            self.orb('Ceremonial staff luminous focus',(x,.18,top-.025),(.10,.10,.12),focus,12,6)
            self.ring('Staff engraved focus ring',(x,.18,top-.025),.15,.014,self.p['trim'],True)
            if style=='sun':
                for j in range(8):
                    an=j*math.tau/8
                    self.rod('Staff sun ray',(x+.13*math.sin(an),.18,top-.025+.13*math.cos(an)),(x+.20*math.sin(an),.18,top-.025+.20*math.cos(an)),.014,self.p['trim'],.004,seg=5)

    def book(self, x=-.35, z=1.10, floating=False):
        y=.29
        for side in [-1,1]:
            pages=self.box('Open tome parchment',(x+side*.073,y,z),(.135,.18,.04),self.p['ivory'],.008);pages.rotation_euler[1]=side*.20
            cover=self.box('Open tome embossed cover',(x+side*.078,y-.008,z-.03),(.151,.195,.019),self.p['cloth'],.007);cover.rotation_euler[1]=side*.20
            for i in range(3):self.rod('Tome illuminated line',(x+side*.026,y-.04+i*.043,z+.025),(x+side*.118,y-.04+i*.043,z+.041),.003,self.p['trim'],seg=4)
        self.rod('Bound tome spine',(x,y-.09,z-.013),(x,y+.10,z-.013),.025,self.p['leather'],seg=8)
        if floating:self.ring('Floating tome spell seal',(x,y,z-.075),.17,.009,self.p['glow'])

    def antlers(self, high=False):
        for side in [-1,1]:
            pts=[(side*.12,-.04,1.84),(side*.23,-.05,1.98),(side*.29,-.03,2.08 if high else 2.04),(side*.39,-.025,2.15 if high else 2.09)]
            for a,b in zip(pts,pts[1:]):self.rod('Natural carved antler',a,b,.026,self.p['ivory'],.011,seg=6)
            self.rod('Antler branching tine',pts[1],(side*.36,.045,2.02),.018,self.p['ivory'],.006,seg=5)
            if high:self.rod('Antler high branching tine',pts[2],(side*.32,-.04,2.21),.016,self.p['ivory'],.005,seg=5)

    def wings(self, arch=False):
        # Separate sculpted flight feathers rooted in a curved shoulder structure.
        ivory=self.p['ivory'];shade=self.mat('Wing soft blue underside','a2bbc1')
        for side in [-1,1]:
            before_wing=set(bpy.context.scene.objects)
            pts=[(side*.13,-.14,1.40),(side*.42,-.20,1.68),(side*.76,-.21,1.88),(side*(1.15 if arch else .98),-.20,1.84)]
            for a,b in zip(pts,pts[1:]):self.rod('Curved feathered wing root',a,b,.072,ivory,.040,seg=10)
            for j in range(8 if arch else 7):
                t=j/(7 if arch else 6)
                start=(side*(.29+t*(.84 if arch else .68)),-.215,1.62+.25*math.sin(t*math.pi*.75))
                end=(side*(.025+t*.045),-.005,-(.33+t*.28))
                self.leaf('Sculpted individual flight feather',start,end,ivory,.067 if arch else .058)
                self.rod('Feather central vane',start,Vector(start)+Vector(end)*.91,.006,shade,.002,seg=4)
            for j in range(5):
                t=j/4;start=(side*(.23+t*.55),-.13,1.58+.20*t)
                self.leaf('Overlapping wing covert',start,(side*.12,.005,-.19),shade,.065)
            articulation.attach(set(bpy.context.scene.objects)-before_wing,articulation.pivot('left_wing_pivot' if side<0 else 'right_wing_pivot',pts[0]))
        if arch:
            for side in [-1,1]:
                for j in range(4):self.leaf('Archangel lower feather fan',(side*(.16+j*.07),-.18,1.35),(side*(.13+j*.055),-.035,-.30),ivory,.054)

    def blossom(self, pos, petals=5, size=.028):
        x,y,z=pos; petal=self.mat('Flower warm petals','ddc995')
        for i in range(petals):
            an=i*math.tau/petals
            self.orb('Forest blossom petal',(x+size*math.cos(an),y,z+size*math.sin(an)),(size*.72,.012,size*.72),petal,6,3)
        self.orb('Forest blossom heart',(x,y+.012,z),(.015,.013,.015),self.p['trim'],6,3)


def _watchman(s):
    s.body(arms=[((-.21,0,1.34),(-.28,.21,1.22),(-.10,.32,1.12)),((.21,0,1.34),(.30,.18,1.18),(.07,.30,1.09))])
    s.cloak(length=.63,width=.30,mat=s.p['dark']);s.mantle(fur=True);s.helmet(crest=False)
    s.crossbow()
    s.box('Watch company bolt case',(.23,.07,.88),(.13,.13,.22),s.p['leather'],.025)
    for j in range(3):s.rod('Spare frost quarrel',(.20+j*.033,.08,.85),(.20+j*.033,.08,1.16),.012,s.p['glow'],seg=5)
    s.box('Watchman silver chest badge',(0,.177,1.25),(.09,.017,.13),s.p['trim'],.012)


def _knight(s):
    s.body(armor=True)
    s.cloak(length=.37,width=.35,wind=.04);s.plate_helmet();s.plate_armor()
    s.shield(style='kite');s.blade(frost=True,length=.80)
    s.rod('Frost insignia',(0,.211,1.12),(0,.239,1.35),.014,s.p['glow'],seg=5)


def _lionheart(s):
    s.body(armor=True);s.cloak(length=.26,width=.39);s.plate_helmet(heraldic=True);s.plate_armor(royal=True)
    s.lion((0,.221,1.22),.105);s.shield(lion=True);s.blade(broad=True,length=.67)
    for side in [-1,1]:
        for j in range(4):s.leaf('Lion mane shoulder scallop',(side*(.17+j*.04),.075,1.43),(side*.01,.035,-.13),s.p['trim'],.035)
    s.loft('Crimson heroic breast sash',[(1.11,.24,.159,0),(1.17,.24,.159,0)],s.p['cloth'],12)


def _kingslayer(s):
    # Entirely new character: forged midnight armor, a heavy rune blade and a
    # torn mantle. There are no wheels, bow limbs or siege-machine components.
    s.p['steel']=s.mat('Midnight blackened armor','27303a',.82)
    s.p['darkmetal']=s.mat('Armor recessed joints','10181f',.60)
    s.p['trim']=s.mat('Cold hammered steel edge','879fab',.76)
    s.p['cloth']=s.mat('Kingslayer soot velvet','19222c')
    s.p['dark']=s.mat('Kingslayer charcoal underarmor','101820')
    s.p['glow']=s.mat('Kingslayer frozen runes','93ddeb',.1,.85)
    s.body(armor=True)
    s.plate_helmet(black=True);s.plate_armor()
    s.cloak('Kingslayer swept ragged mantle',length=.25,width=.43,mat=s.p['cloth'],wind=-.12)
    s.blade(guard=1.19,length=.87,broad=True,frost=True,down=True)
    s.shield(style='kite')
    # A broken silver crown crosses the shield: a readable identity at map scale.
    for side in [-1,1]:
        s.rod('Broken crown shield crest',(-.38+side*.04,.302,1.065),
              (-.38+side*.10,.302,1.18),.020,s.p['trim'],.007,seg=6)
        s.rod('Kingslayer pointed shoulder flange',(side*.30,-.008,1.43),
              (side*.43,-.047,1.55),.034,s.p['steel'],.006,seg=6)
    s.box('Kingslayer shattered crown seal',(0,.237,1.24),(.14,.025,.07),s.p['trim'],.014)
    s.rod('Kingslayer cold breast rune',(0,.255,1.21),(0,.255,1.36),.010,s.p['glow'],seg=5)


def _king(s):
    s.body(armor=True,arms=[((-.21,0,1.34),(-.34,.09,1.18),(-.36,.22,1.15)),((.21,0,1.34),(.35,.035,1.30),(.40,.18,1.28))])
    s.cloak(length=.23,width=.44,wind=.09);s.mantle(fur=True);s.crown();s.pauldrons(large=True)
    s.blade(guard=1.24,length=.86,broad=True,down=True)
    s.lion((0,.18,1.21),.083)
    s.orb('King raised command seal',(-.36,.235,1.20),(.076,.05,.08),s.p['trim'],10,5)
    for i in range(5):s.box('Royal chain medallion',(-.12+i*.06,.161,1.37-abs(i-2)*.022),(.027,.018,.04),s.p['trim'],.005)


def _elven_ranger(s, elite=False, king=False):
    s.body(slender=True,elf=True,hair='elf',female=not elite and not king,
           arms=[((-.21,0,1.34),(-.34,.08,1.15),(-.42,.25,1.14)),((.21,0,1.34),(.29,.15,1.16),(.18,.31,1.15))])
    s.cloak(length=.42 if elite else .62,width=.32,wind=-.09);s.quiver(fancy=elite or king)
    s.bow(elven=True,royal=king,fan=3 if elite else 2)
    s.pauldrons(leaf=True)
    if king:
        s.crown(elven=True);s.mantle(fur=False)
        s.leaf('Elven king living breast crest',(0,.183,1.06),(0,0,.28),s.p['trim'],.09)
        for side in [-1,1]:s.leaf('Elven royal back banner',(side*.23,-.26,1.38),(side*.20,-.035,-.70),s.p['cloth'],.09)
    elif elite:
        s.ring('Elven elite brow circlet',(0,.022,1.80),.16,.017,s.p['trim'])
        for side in [-1,1]:s.leaf('Elite leaf breastplate',(side*.09,.176,1.05),(side*.015,0,.33),s.p['trim'],.078)
        for i in range(3):s.loft('Elite layered waist mail',[(.95-i*.065,.215+i*.015,.152+i*.01,0),(.987-i*.065,.218+i*.015,.156+i*.01,0)],s.p['darkmetal'],12)
    else:
        s.mantle(hood=False);s.leaf('Elven ranger chest leaf',(0,.17,1.05),(.045,0,.25),s.p['trim'],.073)
        for side in [-1,1]:s.leaf('Elven hair leaf',(side*.14,.0,1.86),(side*.09,0,.10),s.p['cloth'],.038)


def _ranger(s, royal=False, guard=False):
    s.body(hair='braid',arms=[((-.21,0,1.34),(-.34,.06,1.15),(-.42,.25,1.12)),((.21,0,1.34),(.29,.14,1.16),(.18,.28,1.13))])
    s.cloak(length=.31 if guard else .55,width=.34,wind=.05)
    s.bow(royal=royal or guard,fan=2 if guard else 1);s.quiver(fancy=royal or guard)
    if guard:
        s.helmet(full=False);s.pauldrons();s.box('Guard leather breastplate',(0,.151,1.22),(.30,.042,.23),s.p['darkmetal'],.03)
        for side in [-1,1]:s.rod('Guard royal chest chevron',(side*.13,.18,1.30),(0,.186,1.21),.019,s.p['trim'],seg=6)
        s.box('Guard tall quiver crest',(.27,-.18,1.46),(.11,.045,.16),s.p['trim'],.01)
    elif royal:
        s.mantle(fur=True);s.ring('Royal ranger brow band',(0,.015,1.79),.16,.016,s.p['trim'])
        s.orb('Royal ranger breast seal',(0,.176,1.27),(.055,.017,.07),s.p['trim'],10,5)
        s.rod('Royal decorated chest belt',(-.16,.155,1.39),(.17,.19,1.03),.033,s.p['leather'],seg=6)
        s.box('Royal ranger engraved belt case',(.24,.03,.90),(.12,.12,.18),s.p['cloth'],.015)
    else:
        s.mantle(hood=True);s.rod('Ranger diagonal chest belt',(-.16,.155,1.39),(.17,.19,1.03),.027,s.p['leather'],seg=6)
        for side in [-1,1]:s.leaf('Ranger hawk feather',(.13+side*.022,-.03,1.88),(side*.015,0,.19),s.p['ivory'],.033)


def _mage(s, arch=False):
    s.body(robe=True,arms=[((-.21,0,1.34),(-.34,.05,1.31),(-.45,.24,1.46)),((.21,0,1.34),(.34,.10,1.30),(.41,.22,1.44))])
    s.cloak(length=.25,width=.42,wind=.13)
    if arch:
        s.loft('High archmage sculpted collar',[(1.40,.27,.15,-.03),(1.59,.30,.115,-.10)],s.p['darkmetal'],12)
        s.ring('Archmage crown band',(0,.01,1.82),.16,.02,s.p['trim'])
        for side in [-1,1]:s.leaf('Archmage crown wing',(side*.15,-.03,1.82),(side*.15,-.015,.22),s.p['trim'],.055)
        for i in range(3):s.ring('Orbiting elemental circle',(0,0,1.80+i*.095),.32+i*.07,.012,s.p['glow'])
    else:
        s.mantle(hood=True)
        for side in [-1,1]:s.leaf('Elemental cloak sigil',(side*.17,.113,1.38),(side*.04,.02,-.15),s.p['trim'],.045)
    colors=[('Flame','ea8651'),('Tide','6cb8d2'),('Root','9ab562'),('Gale','d8e5e3')]
    positions=[(-.44,.25,1.56),(.43,.23,1.60),(-.35,-.08,1.92),(.30,-.07,2.03)]
    for i,((name,color),pos) in enumerate(zip(colors,positions)):
        ma=s.mat(f'{name} elemental focus',color,.1,1.1)
        s.orb(f'{name} floating elemental sphere',pos,(.092,.09,.097),ma,12,6)
        if name=='Flame':s.leaf('Shaped floating flame',pos,(.02,0,.18),ma,.065)
        if name=='Root':s.leaf('Elemental root leaf',(pos[0],pos[1],pos[2]+.07),(.09,0,.09),ma,.04)
    s.box('Mage woven spell seal',(0,.155,1.08),(.11,.022,.19),s.p['trim'],.014)
    for i in range(3 if arch else 2):s.rod('Layered robe embroidered hem',(-.22,.18,.28+i*.055),(.22,.18,.28+i*.055),.012,s.p['trim'],seg=6)


def _nature_spirit(s):
    """A levitating spirit grown from a continuous jade mist and living leaves."""
    s.plinth()
    jade=s.mat('Spirit softly luminous jade','92cbb3',0,.20)
    leaf=s.mat('Spirit living emerald leaves','428b69',0,.12)
    tips=s.mat('Spirit new spring leaf tips','b7dfa2',0,.28)
    bark=s.mat('Spirit curved living branch','526e59')
    light=s.mat('Spirit floating seed light','e2efb0',0,1.3)
    s.p['skin']=jade;s.p['cloth']=leaf;s.p['trim']=tips;s.p['glow']=light
    pieces=[s.orb('Spirit continuous upper breast',(0,.01,1.35),(.195,.134,.196),jade,16,8),
            s.orb('Spirit narrow flowing waist',(0,-.01,1.115),(.147,.13,.168),jade,16,8),
            s.orb('Spirit neck',(0,.01,1.59),(.055,.063,.13),jade,12,6),
            s.orb('Spirit serene face',(0,.025,1.805),(.131,.122,.175),jade,16,8),
            s.orb('Spirit sculpted jaw',(0,.056,1.725),(.107,.105,.100),jade,12,6),
            s.orb('Spirit delicate nose',(0,.147,1.804),(.026,.025,.042),jade,10,5)]
    # The torso descends into a curling single spirit tail; there are no human
    # trousers, boots or solid dress panels below the hovering body.
    points=[(0,-.014,1.14),(.024,-.017,.94),(.085,-.031,.76),(.152,-.046,.58),(.095,-.058,.44)]
    for i,(a,b) in enumerate(zip(points,points[1:])):
        pieces.append(s.rod('Continuous curling spirit tail',a,b,.142-i*.028,jade,.110-i*.029,seg=12))
    for side in [-1,1]:
        shoulder=(side*.17,.005,1.425);elbow=(side*.285,.10,1.37);hand=(side*.40,.195,1.54)
        upper,lower,wrist,weapon=articulation.limb(shoulder,elbow,hand)
        arm_surface=[s.orb('Spirit joined shoulder',shoulder,(.081,.079,.101),jade,12,6),s.rod('Spirit graceful upper arm',shoulder,elbow,.061,jade,.046,seg=10)]
        articulation.attach([cohesive.fuse(arm_surface,'Continuous spirit upper arm',.014,230,jade)],upper)
        articulation.attach([s.rod('Spirit raised forearm',elbow,hand,.047,jade,.034,seg=10)],lower)
        articulation.attach([s.orb('Spirit open offered hand',hand,(.041,.049,.055),jade,10,5)],wrist)
        pieces.append(s.leaf('Spirit tapered pointed ear',(side*.10,.010,1.826),(side*.102,-.01,.038),jade,.032))
    cohesive.fuse(pieces,'Continuous floating nature spirit anatomy',.016,1850,jade)
    for side in [-1,1]:
        s.orb('Spirit luminous inset eye',(side*.049,.143,1.833),(.016,.009,.010),light,8,4)
        s.rod('Spirit leaf-shaped brow',(side*.026,.147,1.86),(side*.071,.135,1.863),.006,bark,seg=5)
    s.rod('Spirit serene mouth',(-.026,.156,1.742),(.026,.156,1.742),.004,bark,seg=5)
    # An asymmetric crown of branch antlers and leafy hair, rather than a human
    # hairstyle and staff. Roots sweep around the spirit without joining feet.
    for side in [-1,1]:
        pts=[(side*.092,-.061,1.905),(side*.15,-.074,2.022),(side*.256,-.055,2.13),(side*.315,-.032,2.15)]
        for a,b in zip(pts,pts[1:]):s.rod('Living crown branch',a,b,.024,bark,.012,seg=8)
        s.rod('Crown natural branching twig',pts[1],(side*.13,-.052,2.18),.016,bark,.004,seg=6)
        for j in range(3):
            s.leaf('Crown luminous spring leaf',(side*(.13+j*.066),-.046,2.03+j*.032),
                   (side*.092,.03,.083),tips,.040)
        for j in range(4):
            start=(side*(.05+j*.041),-.104,1.927-j*.025)
            s.leaf('Swept leafy spirit hair',start,(side*(.02+j*.008),-.061,-(.29+j*.087)),leaf,.068-j*.007)
        for j in range(3):
            s.leaf('Spirit leaf collar',(side*(.065+j*.055),.095,1.488),
                   (side*.018,.044,-(.22+j*.025)),leaf,.069)
    s.blossom((-.11,.097,1.970),size=.024)
    s.blossom((.23,-.028,2.12),size=.025)
    # Long translucent mist ribbons give the body a hovering, wind-swept outline.
    mist=s.mat('Translucent nature spirit mist','7bc9ad',0,.27)
    shader=mist.node_tree.nodes.get('Principled BSDF');shader.inputs['Alpha'].default_value=.38
    mist.diffuse_color=(*mist.diffuse_color[:3],.38)
    mist.surface_render_method='DITHERED'
    for side in [-1,1]:
        vs=[]
        for j in range(9):
            t=j/8;ang=t*2.25+side*.38
            cx=side*(.10+.23*t)*math.cos(ang);cy=-.04-.20*math.sin(ang);z=1.10-.77*t
            width=.083*(1-t)+.006
            vs.extend([(cx-width,cy,z+.018),(cx+width,cy,z-.018)])
        s.mesh('Floating translucent spirit ribbon',vs,
               [(j*2,j*2+1,j*2+3,j*2+2) for j in range(8)],mist,.003,True)
    for side in [-1,1]:
        s.orb('Spirit offered floating seed',(side*.40,.198,1.66),(.031,.029,.047),light,10,5)
        for j in range(2):
            s.leaf('Weightless drifting nature leaf',(side*(.36+j*.11),.16-j*.055,1.39-j*.22),
                   (side*.068,.024,.091),tips,.035)
    for j in range(6):
        an=j*math.tau/6
        s.leaf('Spirit pedestal new shoots',(.24*math.cos(an),.24*math.sin(an),.174),
               (.07*math.cos(an),.06*math.sin(an),.10),leaf,.030)


def _forest(s, role):
    if role=='mother':return _nature_spirit(s)
    arch=role=='arch'
    s.body(robe=arch,slender=False,female=False,elf=False,hair='short',
           arms=[((-.21,0,1.34),(-.34,.07,1.25),(-.38,.25,1.29)),((.21,0,1.34),(.35,.035,1.16),(.40,.18,1.17))])
    if arch:
        s.cloak('Archdruid ancient leaf mantle',length=.31,width=.42,wind=-.07);s.antlers(high=True)
        s.staff(style='forest',top=1.96);s.book(x=-.38,z=1.27)
        for side in [-1,1]:
            for j in range(3):s.leaf('Archdruid layered leaf shoulder',(side*(.16+j*.046),.055,1.46),(side*.025,.025,-.17),s.p['trim'],.050)
        beard=[]
        for j in [-1,0,1]:beard.append(s.rod('Archdruid sculpted grey beard',(j*.049,.122,1.59),(j*.028,.15,1.31),.045,s.p['ivory'],.012,seg=8))
        cohesive.fuse(beard,'Continuous flowing archdruid beard',.015,350,s.p['ivory'])
        s.ring('Archdruid forest halo',(0,-.18,1.79),.27,.017,s.p['leather'],True)
    else:
        s.cloak('Master druid asymmetric bark cape',length=.60,width=.32,wind=.11);s.antlers(high=False)
        s.mantle(fur=True);s.staff(style='forest',top=1.93)
        for side in [-1,1]:s.leaf('Druid bark shoulder plate',(side*.18,.03,1.45),(side*.14,.08,-.16),s.p['leather'],.058)
        s.box('Druid seed satchel',(-.23,.04,.88),(.17,.13,.20),s.p['leather'],.026)
        s.orb('Druid poisonous seed focus',(-.38,.27,1.33),(.088,.064,.075),s.p['glow'],10,5)
        for j in range(3):s.leaf('Poison thorn seed',(-.39+j*.028,.28,1.35),(.014,.02,.11),s.p['cloth'],.021)


def _cleric(s, role):
    monk=role=='monk';bishop=role=='bishop'
    s.body(robe=True,bare=monk,bald=monk,hair='short',
           arms=[((-.21,0,1.34),(-.29,.10,1.20),(-.06,.28,1.23)),((.21,0,1.34),(.30,.08,1.20),(.40,.18,1.19))] if not monk else
                [((-.21,0,1.34),(-.30,.10,1.20),(-.10,.25,1.24)),((.21,0,1.34),(.30,.10,1.20),(.10,.25,1.24))])
    if monk:
        s.cloak('Monk folded cowl',length=.84,width=.25,mat=s.p['dark']);s.mantle(hood=False)
        s.loft('Monastic cord sash',[(.955,.213,.158,0),(.984,.21,.157,0)],s.p['ivory'],12)
        s.rod('Monk hanging knotted belt',(0,.18,.97),(.04,.20,.64),.014,s.p['ivory'],seg=6)
        for i in range(11):
            an=i*math.pi/10;x=.17*math.cos(an);z=1.31-.16*math.sin(an)
            s.orb('Monastic carved prayer bead',(x,.168,z),(.019,.019,.02),s.p['leather'],6,3)
        for side in [-1,1]:s.ring('Monk alternating chant seal',(side*.30,.16,.63),.11,.008,s.p['glow'])
        s.book(x=0,z=1.22)
    elif bishop:
        s.cloak('Archbishop long ceremonial cope',length=.23,width=.43)
        s.loft('Archbishop high stole collar',[(1.37,.257,.16,-.018),(1.50,.207,.13,-.015)],s.p['ivory'],12)
        for side in [-1,1]:
            s.box('Archbishop embroidered vertical stole',(side*.094,.177,1.03),(.080,.029,.58),s.p['trim'],.008)
            for i in range(3):s.rod('Stole ceremonial cross',(side*.094,.197,.87+i*.15),(side*.094,.197,.93+i*.15),.009,s.p['ivory'],seg=5)
        vs=[(-.16,-.10,1.82),(.16,-.10,1.82),(.155,.105,1.82),(-.155,.105,1.82),(0,-.065,2.12),(0,.10,2.10)]
        s.mesh('New curved bishop mitre',vs,[(0,1,4),(3,5,2),(0,4,5,3),(1,2,5,4),(0,3,2,1)],s.p['ivory'])
        s.rod('Mitre gilded ridge',(0,.106,1.84),(0,.103,2.09),.014,s.p['trim'],seg=6)
        s.staff(style='crozier',top=1.98);s.book(x=-.12,z=1.20)
    else:
        s.cloak('Priest flowing cream vestment',length=.30,width=.34)
        s.loft('Priest rounded linen collar',[(1.38,.247,.16,0),(1.45,.184,.12,0)],s.p['ivory'],12)
        for side in [-1,1]:s.box('Priest golden stole',(side*.084,.164,1.065),(.065,.025,.62),s.p['trim'],.01)
        s.staff(style='sun',top=1.86);s.book(x=-.10,z=1.20)
        s.rod('Priest chest blessing',(0,.178,1.20),(0,.178,1.35),.012,s.p['trim'],seg=5)
        s.rod('Priest chest blessing arms',(-.055,.178,1.29),(.055,.178,1.29),.009,s.p['trim'],seg=5)


def _angel(s, arch=False):
    s.body(robe=True,slender=True,female=not arch,hair='long',armor=arch,
           arms=[((-.21,0,1.34),(-.32,.10,1.24),(-.36,.30,1.30)),((.21,0,1.34),(.34,.04,1.19),(.40,.18,1.18))])
    s.wings(arch=arch)
    s.ring('Archangel double aureole' if arch else 'Angel circular aureole',(0,-.13,1.88),.245 if arch else .215,.018,s.p['trim'],True)
    if arch:
        s.ring('Archangel inner frost aureole',(0,-.14,1.88),.21,.011,s.p['glow'],True)
        s.pauldrons(leaf=True);s.crown(elven=True)
        s.staff(style='orb',top=1.95,orbcolor='aacfe9')
        s.orb('Archangel offered frost sphere',(-.36,.31,1.41),(.107,.098,.102),s.p['glow'],12,6)
        for side in [-1,1]:s.leaf('Archangel ice waist tasset',(side*.12,.11,1.02),(side*.03,.08,-.48),s.p['steel'],.075)
    else:
        s.staff(style='sun',top=1.90,orbcolor='f4e4b3')
        s.loft('Angel woven shoulder stole',[(1.37,.245,.16,0),(1.45,.205,.135,0)],s.p['ivory'],12)
        s.orb('Angel offered blessing',(-.36,.31,1.39),(.065,.054,.067),s.p['glow'],10,5)
        for side in [-1,1]:s.box('Angel golden robe edging',(side*.135,.176,.87),(.032,.014,.66),s.p['trim'],.005)


def _paladin(s):
    s.body(armor=True);s.plate_armor(royal=True);s.cloak(length=.39,width=.36)
    s.helmet(full=False,crest=True);s.shield(style='round');s.warhammer(sacred=True)
    s.loft('Paladin heraldic shoulder mantle',[(1.37,.29,.17,-.015),(1.46,.245,.14,-.015)],s.p['cloth'],12)
    s.rod('Paladin sacred breast sigil',(0,.232,1.09),(0,.244,1.36),.017,s.p['trim'],seg=6)
    s.rod('Paladin sacred breast arms',(-.083,.242,1.28),(.083,.242,1.28),.014,s.p['trim'],seg=6)
    for side in [-1,1]:s.orb('Paladin consecrated shoulder seal',(side*.245,.13,1.405),(.037,.019,.043),s.p['glow'],8,4)
    s.ring('Paladin protective ground ward',(0,0,.20),.405,.011,s.p['glow'])


def _dwarf(s):
    info=s.body(dwarf=True,bare=True,arms=[((-.21,0,1.34),(-.36,.10,1.25),(-.43,.21,1.32)),((.21,0,1.34),(.38,.11,1.25),(.48,.20,1.42))])
    head=info['head']
    s.loft('Dwarf fireproof leather apron',[(.43,.23,.175,0),(.75,.225,.17,0),(1.10,.19,.155,0)],s.p['leather'],12)
    s.box('Dwarf apron brass furnace badge',(0,.18,.91),(.10,.025,.10),s.p['trim'],.014)
    s.orb('Dwarf leather bomber cap',(0,-.015,head+.10),(.204,.167,.104),s.p['leather'],12,6)
    for side in [-1,1]:
        s.ring('Dwarf goggles bronze frame',(side*.066,.159,head+.055),.048,.014,s.p['trim'],True)
        s.orb('Dwarf goggles smoke lens',(side*.066,.162,head+.055),(.035,.012,.034),s.p['darkmetal'],8,4)
    beard=[]
    for j in [-1,0,1]:beard.append(s.rod('Dwarf heavy braided beard',(j*.061,.12,head-.03),(j*.044,.14,head-.29),.053,s.p['hair'],.018,seg=8))
    cohesive.fuse(beard,'Continuous dwarf braided beard',.016,360,s.p['hair'])
    for side in [-1,1]:s.ring('Beard brass binding',(side*.049,.14,head-.215),.028,.008,s.p['trim'])
    s.box('Dwarf alchemical bomb backpack',(0,-.21,.97),(.37,.17,.39),s.p['darkmetal'],.04)
    for side in [-1,1]:
        s.rod('Backpack brass pressure chimney',(side*.12,-.22,1.02),(side*.12,-.22,1.35),.036,s.p['trim'],seg=8)
        s.rod('Backpack leather shoulder strap',(side*.16,-.15,1.19),(side*.14,.155,.91),.025,s.p['leather'],seg=6)
    for x,y,z,size in [(-.53,.22,1.10,.12),(.595,.21,1.22,.15),(-.19,.19,.75,.085),(.19,.19,.74,.085)]:
        s.orb('Dwarf black powder spherical bomb',(x,y,z),(size,size,size),s.p['darkmetal'],12,6)
        s.rod('Bomb copper fuse collar',(x,y,z+size*.84),(x,y,z+size*1.13),size*.23,s.p['trim'],seg=6)
        s.rod('Curled visible bomb fuse',(x,y,z+size),(x+.036,y,z+size+.065),.011,s.p['ivory'],seg=5)
        s.orb('Bomb burning fuse spark',(x+.038,y,z+size+.070),(.018,.018,.026),s.mat('Burning bomb fuse','e8a554',0,1.5),6,3)


def build(family, a):
    if family not in FAMILIES: raise ValueError(f'Not a humanoid champion: {family}')
    before=set(bpy.context.scene.objects)
    s=Sculpt(a,family)
    if family=='rimewatch':_watchman(s)
    elif family=='frostblade':_knight(s)
    elif family=='roseguard':_lionheart(s)
    elif family=='highking':_kingslayer(s)
    elif family=='crownofages':_king(s)
    elif family in ('thornwarden','verdantguard','elvenking'):_elven_ranger(s,elite=family=='verdantguard',king=family=='elvenking')
    elif family in ('wyvernhunter','royalranger','kingsrangerguard'):_ranger(s,royal=family=='royalranger',guard=family=='kingsrangerguard')
    elif family in ('tempest','stormcitadel'):_mage(s,arch=family=='stormcitadel')
    elif family in ('greenheart','eldergrove','mothernature'):_forest(s,{'greenheart':'master','eldergrove':'arch','mothernature':'mother'}[family])
    elif family in ('sunward','monk','archbishop'):_cleric(s,{'sunward':'priest','monk':'monk','archbishop':'bishop'}[family])
    elif family in ('dawnspire','archangel'):_angel(s,arch=family=='archangel')
    elif family=='kingdomprotector':_paladin(s)
    elif family=='royalmarshal':_dwarf(s)
    created=[o for o in bpy.context.scene.objects if o not in before and o.type=='MESH']
    cohesive.soften_surfaces(created)
    for o in created:
        o['design_version']='champion-v6-original-sculpt'
        o['champion_family']=family
        o['new_sculpt']=True
    return s.p
