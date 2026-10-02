"""The complete army, authored in Blender using the approved archer proportions.
Run: blender -b --python blender/scripts/author_army.py
Optional --family soldier (one family), --no-render (export/source only).
"""
import bpy, json, math, sys
from pathlib import Path
from mathutils import Vector, Matrix
sys.path.insert(0,str(Path(__file__).resolve().parent))
import author_archer as A
import articulation
from author_archer import cube,ellipsoid,cylinder,rod,custom,torus,mat

ROOT=A.ROOT;OUT=A.OUT;PORTRAITS=ROOT/'public/assets/army';SCENES=A.SCENES
PORTRAITS.mkdir(parents=True,exist_ok=True)
DATA=json.loads((ROOT/'data/towers.json').read_text(encoding='utf-8'))
BASIC=['soldier','archer','druid','mage','cleric','runebreaker','frostwarden','stormcaller']

def clear():
    bpy.ops.object.select_all(action='DESELECT')
    for o in list(bpy.context.scene.objects):bpy.data.objects.remove(o,do_unlink=True)

def meshes():return [o for o in bpy.context.scene.objects if o.type=='MESH']
def remove_prefix(objects,prefixes):
    for o in list(objects):
        if any(o.name.startswith(p) for p in prefixes):bpy.data.objects.remove(o,do_unlink=True)

def palette(objects):
    def find(prefix):return next(m for o in objects for m in o.data.materials if m.name.startswith(prefix))
    return dict(cloth=find('Rank_'),trim=find('Antique brass'),leather=find('Chestnut'),dark=find('Dark seams'),skin=find('Warm skin'),steel=find('Steel arrowhead') if any(o.name.startswith('Leaf arrowhead') for o in objects) else mat('Brushed steel','99aab0',.7),ivory=find('Linen'),hair=find('Auburn'))

def recolor(material,color):
    rgba=(*[A.linear(color[i:i+2]) for i in (0,2,4)],1)
    material.diffuse_color=rgba;material.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=rgba

def arm(a,b,c,p,armored=False):
    upper,lower,hand,weapon=articulation.limb(a,b,c)
    before=set(meshes())
    ellipsoid('Shaped shoulder',a,(.12,.12,.12),p['cloth'],10,5)
    rod('Tailored upper sleeve',a,b,.079,p['cloth'],8,end=.066)
    articulation.attach(set(meshes())-before,upper);before=set(meshes())
    rod('Bound bracer',b,c,.071,p['steel'] if armored else p['leather'],8,end=.055)
    v=Vector(b).lerp(Vector(c),.25);w=Vector(b).lerp(Vector(c),.39)
    rod('Bracer edging',v,w,.074,p['trim'],8)
    articulation.attach(set(meshes())-before,lower);before=set(meshes())
    ellipsoid('Held glove',c,(.069,.06,.072),p['leather'],10,5)
    for dz in [-.031,0,.031]:rod('Articulated fingers',(c[0]-.035,c[1]+.041,c[2]+dz),(c[0]+.025,c[1]+.042,c[2]+dz),.009,p['skin'],5)
    articulation.attach(set(meshes())-before,hand)

def staff(p,crystal=False,color='b28de7'):
    rod('Staff shaft',(.40,.16,.18),(.40,.16,1.78),.027,p['leather'],8)
    for z in [.42,1.48,1.72]:cylinder('Staff brass binding',(.40,.16,z),.044,.055,p['trim'],8)
    focus=mat('Staff focus',color,.25,.65)
    if crystal:
        cylinder('Crystal socket',(.40,.16,1.78),.11,.12,p['trim'],6,top=.085)
        cylinder('Faceted crystal',(.40,.16,1.94),.11,.28,focus,5,top=0)
        cylinder('Lower crystal',(.40,.16,1.79),.05,.1,focus,5,top=.11)
    else:
        ellipsoid('Spell focus',(.40,.16,1.89),(.14,.14,.14),focus,12,6)
        for side in [-1,1]:rod('Focus prong',(.40+side*.09,.16,1.71),(.40+side*.14,.16,1.93),.018,p['trim'],6)

def book(p):
    cover=cube('Leather spellbook',(-.34,.29,1.07),(.24,.16,.065),p['leather']);cover.rotation_euler[0]=.4
    pages=cube('Bound parchment',(-.34,.302,1.111),(.212,.13,.047),p['ivory'],.007);pages.rotation_euler[0]=.4
    for x in [-.41,-.37,-.32,-.28]:rod('Illuminated script',(x,.33,1.135),(x,.37,1.15),.005,p['trim'],4)

def sword(p,x=.40,z=.86,long=False):
    rod('Leather sword grip',(x,.18,z-.17),(x,.18,z),.031,p['leather'],8)
    ellipsoid('Sword pommel',(x,.18,z-.19),(.048,.04,.05),p['trim'],8,4)
    cube('Swept sword guard',(x,.18,z+.02),(.25,.06,.052),p['trim'],.012)
    custom('Tempered blade',[(x-.048,.16,z+.04),(x+.048,.16,z+.04),(x+.037,.16,z+.65),(x,.16,z+(.92 if long else .80)),(x-.037,.16,z+.65),(x,.192,z+.05),(x,.18,z+.67)],[(0,1,5),(1,2,6,5),(2,3,6),(3,4,6),(4,0,5,6),(0,4,3,2,1)],p['steel'])

def shield(p,ice=False):
    x=-.36;y=.25;z=.94
    verts=[(x-.21,y,z+.23),(x+.21,y,z+.23),(x+.23,y,z-.05),(x,y,z-.34),(x-.23,y,z-.05)]
    o=custom('Kite shield',verts,[(0,1,2,3,4)],p['cloth']);m=o.modifiers.new('Shield thickness','SOLIDIFY');m.thickness=.055;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=m.name)
    for a,b in zip(verts,verts[1:]+verts[:1]):rod('Shield rim',a,b,.024,p['steel'] if ice else p['trim'],6)
    rod('Shield crest',(x,y+.015,z-.16),(x,y+.015,z+.14),.018,p['ivory'],6)
    rod('Heraldic crossbar',(x-.095,y+.018,z+.02),(x+.095,y+.018,z+.02),.015,p['ivory'],6)

def helmet(p,crest=True):
    ellipsoid('Forged helmet dome',(0,.012,1.84),(.195,.167,.13),p['steel'],12,6)
    cylinder('Helmet brow',(0,.015,1.78),.185,.047,p['trim'],12)
    for x in [-.174,.174]:cube('Hinged cheek guard',(x,.06,1.64),(.041,.18,.19),p['steel'],.012)
    if crest:
        custom('Horsehair crest',[(-.032,-.11,1.92),(-.032,.15,1.92),(-.025,.10,2.11),(-.025,-.13,2.13),(.032,-.11,1.92),(.032,.15,1.92),(.025,.10,2.11),(.025,-.13,2.13)],[(0,1,2,3),(4,7,6,5),(3,2,6,7),(1,5,6,2)],p['cloth'])

def antlers(p):
    for side in [-1,1]:
        points=[(side*.15,-.04,1.86),(side*.29,-.03,2.03),(side*.33,-.03,2.20),(side*.43,-.03,2.27)]
        for a,b in zip(points,points[1:]):rod('Carved antler',a,b,.03,p['ivory'],6,end=.014)
        rod('Antler branch',points[1],(side*.44,.04,2.09),.021,p['ivory'],5,end=.008)

def basic(family,rank):
    objects=A.build_archer(rank);p=palette(objects)
    if family=='archer':return p
    remove_prefix(objects,['Sleeve shoulder','Cloth upper arm','Leather bracer','Bracer brass','Gloved hand','Glove finger','Recurve','Bow ','Upper drawn','Lower drawn','Nocked','Leaf arrowhead','Arrow fletching','Quiver','Spare arrow','Strap clasp'])
    for o in list(bpy.context.scene.objects):
        if o.type=='EMPTY' and o.get('articulation'):bpy.data.objects.remove(o,do_unlink=True)
    if family!='frostwarden':remove_prefix(meshes(),['Open hood','Hood contrast','Loose hair'])
    # Hair follows the ranger proportions; the final sculpt pass joins facial anatomy.
    if family not in ['soldier','frostwarden']:
        ellipsoid('Swept hair cap',(0,-.01,1.86),(.173,.14,.087),p['hair'],12,5)
        for x in [-.14,.14]:rod('Temple hair',(x,.09,1.82),(x,.06,1.62),.029,p['hair'],6,end=.013)
    if family in ['mage','cleric','druid','stormcaller']:
        cylinder('Layered robe',(0,-.006,.63),.285,.63,p['cloth'],10,top=.20)
        for x in [-.19,.19]:rod('Robe embroidered hem',(x,.182,.36),(x*.68,.182,.87),.011,p['trim'],5)
    if family=='soldier':
        helmet(p);cube('Plate cuirass',(0,.18,1.16),(.30,.075,.29),p['steel'],.04)
        for x in [-.23,.23]:ellipsoid('Steel pauldron',(x,0,1.37),(.145,.145,.08),p['steel'],10,5)
        arm((-.22,0,1.33),(-.31,.10,1.16),(-.35,.20,.98),p,True)
        arm((.22,0,1.33),(.37,.08,1.15),(.40,.17,.90),p,True);shield(p);sword(p)
    elif family=='druid':
        antlers(p);leaf=mat('Forest leaf','6f9152');bark=mat('Oak wood','795532')
        for x in [-.24,.24]:
            for j in range(3):ellipsoid('Leaf mantle',(x,.03+j*.04,1.36-j*.025),(.13,.075,.035),leaf,8,4)
        for x in [-.06,0,.06]:rod('Braided druid beard',(x,.172,1.59),(x*.5,.20,1.36),.039,p['ivory'],7,end=.007)
        arm((.22,0,1.33),(.36,.05,1.11),(.40,.17,1.03),p);arm((-.22,0,1.33),(-.30,.08,1.12),(-.35,.26,1.10),p)
        rod('Living oak staff',(.40,.16,.18),(.40,.16,2.05),.033,bark,7)
        for dx in [-.11,.12]:rod('Staff bough',(.40,.16,1.76),(.40+dx,.16,2.12),.022,bark,5,end=.009);ellipsoid('Staff leaves',(.40+dx,.16,2.07),(.10,.055,.045),leaf,8,4)
        ellipsoid('Acorn focus',(.40,.16,1.96),(.082,.082,.11),mat('Emerald seed','a2d481',0,.4),10,5)
        ellipsoid('Mushroom cap',(-.30,.19,.30),(.10,.10,.045),mat('Amber mushroom','ba7048'),10,4)
    elif family=='mage':
        cylinder('Wide hat brim',(0,0,1.88),.285,.048,p['leather'],12)
        cylinder('Pointed wizard hat',(0,0,2.055),.217,.34,p['cloth'],10,top=.055)
        rod('Bent hat tip',(0,0,2.20),(.10,-.03,2.30),.055,p['cloth'],7,end=.005)
        cylinder('Hatband',(0,0,1.925),.203,.055,p['trim'],10,top=.176)
        arm((.22,0,1.33),(.34,.07,1.15),(.40,.17,1.06),p);arm((-.22,0,1.33),(-.31,.08,1.09),(-.34,.26,1.09),p);staff(p);book(p)
    elif family=='cleric':
        custom('Sun priest mitre',[(-.16,-.04,1.84),(.16,-.04,1.84),(.13,-.04,2.04),(0,-.04,2.17),(-.13,-.04,2.04),(-.16,.12,1.84),(.16,.12,1.84),(.13,.12,2.04),(0,.12,2.17),(-.13,.12,2.04)],[(0,1,2,3,4),(5,9,8,7,6),(0,5,6,1),(1,6,7,2),(2,7,8,3),(3,8,9,4),(4,9,5,0)],p['cloth'])
        rod('Mitre sun seam',(0,.13,1.87),(0,.13,2.08),.013,p['trim'],5)
        for x in [-.105,.105]:cube('Priestly stole',(x,.207,1.0),(.068,.026,.65),p['ivory'],.006)
        arm((.22,0,1.33),(.34,.07,1.15),(.40,.17,1.06),p);arm((-.22,0,1.33),(-.31,.08,1.09),(-.34,.26,1.09),p);book(p);staff(p,color='ffd76a')
        halo=torus('Sun halo',(0,-.09,1.91),.27,.015,p['trim']);halo.rotation_euler[0]=math.pi/2
    elif family=='runebreaker':
        # A working dwarf: a broad, short body and a full-size expressive head.
        remove_prefix(meshes(),['Front leather breastplate','Breastplate seam'])
        cap=ellipsoid('Engineer leather work cap',(0,-.006,1.865),(.19,.158,.082),p['leather'],16,8)
        cube('Engineer cap peak',(0,.16,1.838),(.30,.115,.024),p['leather'],.012)
        cube('Engineer stitched apron',(0,.187,1.055),(.385,.038,.53),p['leather'],.028)
        for x in [-.142,.142]:rod('Apron shoulder strap',(x,.182,1.31),(x,.223,1.11),.018,p['trim'],6)
        cube('Apron tool pocket',(0,.221,.99),(.24,.033,.15),p['dark'],.014)
        beard=ellipsoid('Engineer full copper beard',(0,.171,1.49),(.155,.091,.19),p['hair'],16,8)
        for j in range(5):
            x=(j-2)*.047;rod('Engineer copper braided beard',(x,.207,1.59),(x*.78,.235,1.31+abs(j-2)*.03),.042,p['hair'],9,end=.016)
            cylinder('Engineer beard binding',(x*.78,.235,1.36+abs(j-2)*.03),.025,.033,p['trim'],9)
        for side in [-1,1]:
            rod('Engineer copper moustache',(side*.012,.218,1.624),(side*.10,.228,1.60),.019,p['hair'],8,end=.012)
            frame=torus('Engineer spectacle frame',(side*.073,.221,1.706),.056,.008,p['trim']);frame.rotation_euler[0]=math.pi/2
            rod('Engineer spectacle temple',(side*.127,.209,1.711),(side*.171,.07,1.722),.008,p['trim'],6)
        rod('Engineer spectacle bridge',(-.017,.229,1.713),(.017,.229,1.713),.007,p['trim'],6)
        arm((.22,0,1.33),(.34,.09,1.17),(.39,.21,1.08),p);arm((-.22,0,1.33),(-.33,.12,1.17),(-.36,.25,1.12),p)
        bpy.context.view_layer.update()
        joint_originals={o:o.matrix_world.copy() for o in bpy.context.scene.objects if o.type=='EMPTY' and o.get('articulation')}
        mesh_targets={}
        head_prefixes=('Head','Cheek','Nose','Eye','Focused','Auburn eyebrow','Mouth','Swept hair','Temple hair','Engineer leather work cap','Engineer cap peak','Engineer full copper beard','Engineer copper','Engineer beard','Engineer spectacle')
        for o in meshes():
            if o.name.startswith(('Octagonal','Beveled limestone','Rank inlay','Radiant','Floating')):continue
            if o.name.startswith(head_prefixes):o.matrix_world=Matrix.Translation((0,0,-.32))@Matrix.Diagonal((1.10,1.08,1,1))@o.matrix_world
            else:o.matrix_world=Matrix.Translation((0,0,.17*(1-.72)))@Matrix.Diagonal((1.30,1.12,.72,1))@o.matrix_world
            mesh_targets[o]=o.matrix_world.copy()
        def depth(o):return 0 if not o.parent else 1+depth(o.parent)
        for o in sorted(joint_originals,key=depth):
            o.matrix_world=Matrix.Translation((0,0,.17*(1-.72)))@Matrix.Diagonal((1.30,1.12,.72,1))@joint_originals[o]
        # Moving a parent also moves its descendants; restore each intended world pose once.
        for o,target in mesh_targets.items():o.matrix_world=target
        # Hand-sized carpenter's hammer and a visibly graduated measuring ruler.
        rod('Engineer small hammer handle',(.507,.235,.65),(.507,.235,1.08),.024,p['leather'],10)
        cube('Engineer carpenter hammer',(.507,.235,1.065),(.26,.14,.14),p['steel'],.023)
        cube('Engineer hammer striking face',(.65,.235,1.065),(.035,.153,.15),p['dark'],.008)
        for side in [-1,1]:rod('Engineer hammer fork',(.385,.235+side*.042,1.06),(.35,.235+side*.057,1.12),.016,p['steel'],6)
        cube('Engineer measuring ruler',(-.468,.28,.94),(.08,.039,.60),p['ivory'],.006)
        for j in range(11):
            z=.67+j*.05;length=.052 if j%5==0 else .025
            rod('Engineer ruler graduation',(-.5,.303,z),(-.5+length,.303,z),.0035,p['dark'],4)
        cube('Engineer ruler end cap',(-.468,.28,1.244),(.084,.044,.024),p['trim'],.003)
    elif family=='frostwarden':
        fur=mat('Winter fur','e1e3d5');ice=mat('Glacial facets','a7e4eb',.15,.25)
        for j in range(10):
            a=j*math.tau/10;ellipsoid('Fur mantle',(.26*math.cos(a),.16*math.sin(a),1.38),(.085,.066,.071),fur,8,4)
        arm((.22,0,1.33),(.35,.06,1.16),(.4,.17,1.06),p);arm((-.22,0,1.33),(-.31,.12,1.15),(-.36,.23,.95),p);staff(p,True,'a8edf1');shield(p,True)
        for x in [-.15,0,.15]:cylinder('Shield ice shard',(-.36+x,.285,1.12),.053,.21,ice,4,top=0)
    elif family=='stormcaller':
        cylinder('Storm circlet',(0,0,1.81),.176,.055,p['trim'],12)
        for x in [-.13,0,.13]:rod('Swept storm hair',(x,-.01,1.86),(x+.11,-.07,2.05),.058,p['ivory'],7,end=.004)
        arm((.22,0,1.33),(.37,.1,1.16),(.45,.29,1.21),p);arm((-.22,0,1.33),(-.36,.1,1.16),(-.44,.29,1.21),p)
        spark=mat('Lightning','fff1a7',.2,1.3)
        for side in [-1,1]:
            ellipsoid('Storm orb',(side*.46,.29,1.36),(.1,.1,.1),spark,10,5)
            points=[(side*.45,.29,1.46),(side*.52,.29,1.64),(side*.41,.29,1.60),(side*.48,.29,1.81)]
            for a,b in zip(points,points[1:]):rod('Forked lightning',a,b,.014,spark,5)
    return p

def wing(side,origin,color,feathers=True,scale=1):
    x,y,z=origin;metal=mat('Wing surface',color,.05)
    if feathers:
        for j in range(7):
            a=(x+side*(.1+j*.12)*scale,y,z+(.32-j*.027)*scale)
            b=(x+side*(.38+j*.12)*scale,y-.06,z+(.05-j*.10)*scale)
            rod('Layered flight feather',a,b,.068*scale,metal,6,end=.008)
        rod('Wing leading edge',(x,y,z+.27*scale),(x+side*1.12*scale,y,z+.21*scale),.08*scale,metal,7,end=.03)
    else:
        verts=[(x,y,z),(x+side*.48*scale,y,z+.67*scale),(x+side*1.19*scale,y,z+.27*scale),(x+side*.89*scale,y,z-.24*scale),(x+side*.4*scale,y,z-.12*scale)]
        custom('Dragon wing membrane',verts,[(0,1,2),(0,2,3),(0,3,4)],metal)
        rim=mat('Wing bone','b6a788')
        for idx in [1,2,3,4]:rod('Wing bone',verts[0],verts[idx],.023*scale,rim,6)

def mount(kind,p):
    # Rider scaled onto the saddle; the same approved human detailing stays visible.
    rider=meshes()
    bpy.context.view_layer.update()
    for o in list(rider):
        if o.name.startswith(('Octagonal','Beveled limestone','Rank inlay','Radiant','Floating')):bpy.data.objects.remove(o,do_unlink=True)
        else:o.matrix_world=Matrix.Translation((0,-.08,.58))@Matrix.Diagonal((.64,.64,.64,1))@o.matrix_world
    feather=kind in ['griffin','phoenix'];skin=mat('Mount hide',{'griffin':'9b7049','wolf':'7e98a4','dragon':'557b95','phoenix':'cf723c'}[kind])
    detail=mat('Mount highlights',{'griffin':'ebe4ca','wolf':'d3e3df','dragon':'c2b4e6','phoenix':'ffd077'}[kind])
    cylinder('Mounted footing',(0,0,.055),.58,.11,p['dark'],10);cylinder('Mounted stone top',(0,0,.126),.55,.06,mat('Mount stone','abb19e'),10)
    ellipsoid('Mount body',(0,-.04,.68),(.31,.49,.28),skin,12,7)
    ellipsoid('Mount chest',(0,.28,.79),(.26,.29,.29),detail if feather else skin,12,6)
    for x in [-.22,.22]:
        for y in [-.32,.28]:
            rod('Mount leg',(x,y,.70),(x*1.08,y+.045,.23),.071,skin,7,end=.045)
            ellipsoid('Mount paw',(x*1.08,y+.10,.21),(.10,.15,.055),detail,8,4)
            for dx in [-.04,0,.04]:rod('Claw',(x*1.08+dx,y+.17,.22),(x*1.08+dx,y+.23,.18),.011,p['ivory'],5,end=.003)
    ellipsoid('Mount neck',(0,.44,.93),(.16,.21,.31),detail if feather else skin,12,6)
    ellipsoid('Mount head',(0,.51,1.18),(.20,.24,.19),detail if feather else skin,12,6)
    ellipsoid('Mount muzzle',(0,.70,1.13),(.11,.16,.075),p['trim'] if feather else detail,10,5)
    for x in [-.135,.135]:
        ellipsoid('Mount eye',(x,.685,1.23),(.035,.015,.025),p['dark'],8,4)
        rod('Alert ear',(x,.46,1.28),(x*1.15,.43,1.53),.071,skin,6,end=.005)
    points=[(0,-.46,.77),(.17,-.67,.87),(.23,-.87,1.03),(.34,-.92,1.12)]
    for a,b in zip(points,points[1:]):rod('Mount tail',a,b,.06,skin,7,end=.025)
    cube('Saddle',(0,-.12,.96),(.42,.37,.075),p['leather'],.025)
    for x in [-.26,.26]:rod('Bridle',(x,.22,.74),(x*.55,.66,1.12),.014,p['leather'],5)
    if kind!='wolf':
        for side in [-1,1]:wing(side,(side*.21,-.08,.83),{'griffin':'e7dcc0','phoenix':'f4b751','dragon':'8e75ad'}[kind],feather,.85)
    else:
        for j in range(8):
            a=j*math.tau/8;ellipsoid('Winter mane',(.21*math.cos(a),.35,.93+.20*math.sin(a)),(.09,.09,.075),detail,8,4)

def siege(kind):
    p=basic('soldier',1);crew=meshes()
    bpy.context.view_layer.update()
    for o in list(crew):
        if o.name.startswith(('Octagonal','Beveled limestone','Rank inlay','Kite shield','Shield','Heraldic','Tempered','Sword','Leather sword','Swept sword')):bpy.data.objects.remove(o,do_unlink=True)
        else:o.matrix_world=Matrix.Translation((-.46,-.23,.12))@Matrix.Diagonal((.43,.43,.43,1))@o.matrix_world
    wood=mat('Oiled oak','795638');steel=mat('Forged siege iron','56666b',.6);gold=p['trim']
    for x in [-.47,.47]:
        for y in [-.32,.32]:
            wheel=cylinder('Iron-rimmed wheel',(x,y,.32),.23,.11,steel,12);wheel.rotation_euler[1]=math.pi/2
            hub=cylinder('Oak wheel hub',(x*1.012,y,.32),.17,.12,wood,10);hub.rotation_euler[1]=math.pi/2
            for a in range(4):
                ang=a*math.pi/2;rod('Wheel spoke',(x*1.02,y,.32),(x*1.02,y+math.cos(ang)*.15,.32+math.sin(ang)*.15),.017,gold,5)
    cube('Siege chassis',(0,0,.43),(.87,.9,.14),wood,.03)
    for x in [-.28,.28]:cube('Iron chassis strap',(x,0,.512),(.045,.89,.022),steel,.004)
    if kind=='cannon':
        rod('Cannon cradle',(-.31,0,.55),(.31,0,.55),.10,steel,10)
        rod('Dragon cannon barrel',(0,-.38,.72),(0,.60,.92),.18,steel,12,end=.135)
        for t in [.15,.65,.91]:
            a=Vector((0,-.38,.72)).lerp(Vector((0,.60,.92)),t);b=a+Vector((0,.065,.013));rod('Barrel brass binding',a,b,.183-t*.04,gold,12)
        mouth=cylinder('Dark cannon bore',(0,.65,.93),.115,.012,p['dark'],12);mouth.rotation_euler[0]=math.pi/2-.2
        for side in [-1,1]:rod('Dragon barrel horn',(side*.13,.47,1.0),(side*.23,.63,1.22),.048,gold,6,end=0)
    elif kind=='catapult':
        for x in [-.29,.29]:
            rod('Catapult upright',(x,-.08,.5),(x,-.02,1.15),.06,wood,6)
            rod('Triangular brace',(x,.36,.49),(x,-.02,1.10),.036,wood,6)
        rod('Catapult axle',(-.38,0,.91),(.38,0,.91),.068,steel,10)
        arm_start=set(meshes())
        rod('Throwing arm',(0,.26,.63),(0,-.53,1.52),.065,wood,6,end=.043)
        ellipsoid('Slung boulder',(0,-.53,1.54),(.18,.16,.16),mat('Siege stone','777d70'),10,5)
        torus('Sling rim',(0,-.53,1.52),.16,.025,p['leather'])
        pivot=bpy.data.objects.new('siege_arm',None);bpy.context.collection.objects.link(pivot);pivot.location=(0,0,.91)
        bpy.context.view_layer.update()
        for o in set(meshes())-arm_start:
            matrix=o.matrix_world.copy();o.parent=pivot;o.matrix_world=matrix
    else:
        cylinder('Ballista pivot',(0,0,.66),.14,.30,steel,10)
        cube('Ballista stock',(0,.03,.86),(.12,1.2,.12),wood,.018)
        for side in [-1,1]:
            rod('Ballista bow limb',(0,.28,.87),(side*.5,.18,.89),.055,wood,7,end=.032)
            rod('Ballista string',(side*.5,.18,.89),(0,-.39,.91),.009,p['ivory'],4)
        rod('Heavy ballista bolt',(0,-.37,.96),(0,.80,.96),.024,p['ivory'],6)
        tip=cylinder('Ballista arrowhead',(0,.86,.96),.066,.15,steel,4,top=0);tip.rotation_euler[0]=-math.pi/2
    return p

def elemental(kind):
    bark=mat('Ancient bark' if kind=='tree' else 'Glacial body','6a5038' if kind=='tree' else '81afc2',.05)
    pale=mat('Living canopy' if kind=='tree' else 'Frost facets','739457' if kind=='tree' else 'd1eff0')
    glow=mat('Living eyes','dcf49a' if kind=='tree' else 'cdfaff',0,1.3)
    cylinder('Elemental footing',(0,0,.08),.48,.16,mat('Elemental stone','829182'),10)
    for x in [-.22,.22]:
        rod('Elemental leg',(x,.02,.22),(x*.85,0,.88),.14,bark,7,end=.12)
        ellipsoid('Elemental foot',(x,.12,.23),(.19,.25,.10),bark,8,5)
        rod('Massive arm',(x*1.7,0,1.42),(x*2.35,.08,.97),.16,bark,7,end=.13)
        ellipsoid('Elemental fist',(x*2.35,.10,.91),(.17,.14,.19),pale,8,5)
    cylinder('Faceted torso',(0,0,1.22),.29,.81,bark,8,top=.36)
    ellipsoid('Ancient head',(0,.02,1.91),(.25,.22,.28),bark,10,6)
    for x in [-.1,.1]:ellipsoid('Elemental eye',(x,.223,1.95),(.047,.018,.022),glow,8,4)
    for x in [-.35,0,.35]:
        if kind=='tree':
            rod('Crown branch',(x*.4,0,2.06),(x,0,2.40-abs(x)*.2),.072,bark,6,end=.019)
            ellipsoid('Tree crown',(x,-.02,2.28),(.25,.20,.14),pale,10,5)
        else:cylinder('Ice crown shard',(x*.5,0,2.18),.09,.45-abs(x)*.25,pale,5,top=0)
    if kind=='tree':
        for x in [-.13,0,.13]:rod('Hanging root beard',(x,.20,1.80),(x*.7,.22,1.56),.047,bark,6,end=.013)
        for x in [-.37,.37]:ellipsoid('Mossy shoulder',(x,-.02,1.6),(.22,.18,.11),pale,10,5)
    else:
        for x in [-.2,0,.2]:cylinder('Torso crystal',(x,.24,1.24),.08,.4,pale,5,top=0)
    A.cohesive.elemental()

def advanced(family):
    """Every approved champion is a purpose-built design, not a basic-class variant."""
    import champion_humans_v6, champion_engines_v6, champion_beasts_v6
    for design in (champion_humans_v6, champion_engines_v6, champion_beasts_v6):
        if family in design.FAMILIES:return design.build(family,sys.modules[__name__])
    raise ValueError(f'Missing original champion design: {family}')

def export_current(file):
    objects=meshes();copies=[]
    groups={(o.parent,o.data.materials[0]) for o in objects}
    for parent,material in groups:
        parts=[]
        for original in objects:
            if original.data.materials[0]!=material or original.parent!=parent:continue
            copy=original.copy();copy.data=original.data.copy();bpy.context.collection.objects.link(copy);parts.append(copy)
        bpy.ops.object.select_all(action='DESELECT')
        for o in parts:o.select_set(True)
        bpy.context.view_layer.objects.active=parts[0]
        if len(parts)>1:bpy.ops.object.join()
        copies.append(parts[0])
    bpy.ops.object.select_all(action='DESELECT')
    for o in copies:o.select_set(True)
    for o in bpy.context.scene.objects:
        if o.type=='EMPTY':o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/file),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_animations=False,export_cameras=False,export_lights=False)
    for o in copies:bpy.data.objects.remove(o,do_unlink=True)
    return sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects)

def frame_camera(cam):
    points=[o.matrix_world@Vector(v) for o in meshes() for v in o.bound_box]
    lo=Vector(tuple(min(p[i] for p in points) for i in range(3)));hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
    centre=(lo+hi)/2;cam.location=centre+Vector((-3.3,6,2.6));cam.rotation_euler=(centre-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.ortho_scale=max(2.5,(hi.z-lo.z)*1.23,(hi.x-lo.x)*1.40)

def clean_portrait_metadata(path):
    """Keep original pixels/color chunks; omit Blender's local-file render stamps."""
    png=path.read_bytes();chunks=[png[:8]];offset=8
    while offset<len(png):
        length=int.from_bytes(png[offset:offset+4],'big');end=offset+length+12
        if png[offset+4:offset+8] not in (b'tEXt',b'zTXt',b'iTXt',b'eXIf'):chunks.append(png[offset:end])
        offset=end
    path.write_bytes(b''.join(chunks))

def generate(render=True,family=None):
    requested=set(family.split(',')) if family else None
    if requested and not requested.issubset(DATA):raise ValueError('Unknown requested family')
    families=[f for f in DATA if not requested or f in requested]
    basic_families=[f for f in families if f in BASIC]
    if basic_families:
        import author_defender_ranks_v2
        author_defender_ranks_v2.OUT=OUT
        author_defender_ranks_v2.generate(','.join(basic_families),render=render)
    families=[f for f in families if f not in BASIC]
    entries=json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
    # Secret champions own their native rigid rig, bounds and current art manifest.
    # Generic finalization/budgeting would reparent their orbs and horse parts.
    secret_families=[f for f in families if DATA[f].get('secret')]
    for fam in (f for f in families if f not in secret_families):
        advanced_unit=bool(DATA[fam].get('advanced'));ranks=[1] if advanced_unit else range(1,7)
        for rank in ranks:
            clear();advanced(fam) if advanced_unit else basic(fam,rank)
            articulation.finalize(fam)
            A.cohesive.human()
            A.cohesive.budget_meshes()
            file=f'advanced_{fam}.glb' if advanced_unit else f'human_{fam}_t{rank}.glb'
            triangles=export_current(file)
            if triangles>=10000:raise ValueError(f'{fam} exceeds triangle budget: {triangles}')
            entries=[e for e in entries if not(e.get('family')==fam and e.get('tier')==rank and e.get('kind')=='tower')]
            entries.append(dict(file=file,kind='tower',family=fam,tier=rank,style='champion-v6' if advanced_unit else 'archer-v2' if fam=='archer' else 'hero-v5',authoring='Blender',triangles=triangles,**articulation.metadata(),**({'designRevision':6,'name':DATA[fam]['name']} if advanced_unit else {})))
            cam=A.configure_scene();frame_camera(cam);scene=bpy.context.scene
            scene.render.resolution_x=360;scene.render.resolution_y=420;scene.render.resolution_percentage=100;scene.cycles.samples=24
            if rank==1:
                scene['Style']='Original champion silhouettes, unified smooth anatomy, crafted fantasy equipment' if advanced_unit else 'Approved archer proportions, hand-cut fantasy materials, original class equipment'
                if advanced_unit:
                    scene['Champion']=DATA[fam]['name'];scene['Family']=fam;scene['DesignRevision']=6
                bpy.ops.wm.save_as_mainfile(filepath=str(SCENES/f'{fam}_design_v1.blend'))
            if render:
                portrait_path=PORTRAITS/f'{fam}-t{rank}.png'
                scene.render.filepath=str(portrait_path);bpy.ops.render.render(write_still=True)
                clean_portrait_metadata(portrait_path)
            print(f'ARMY: {fam} rank {rank}, {triangles} triangles',flush=True)
        (OUT/'manifest.json').write_text(json.dumps(entries,indent=2)+'\n',encoding='utf-8')
    if secret_families:
        import author_secret_champions
        author_secret_champions.OUT=OUT
        author_secret_champions.army=sys.modules[__name__]
        author_secret_champions.generate(render=render,family=','.join(secret_families))
    print('ARMY: all requested families complete',flush=True)

if __name__=='__main__':
    family=sys.argv[sys.argv.index('--family')+1] if '--family' in sys.argv else None
    generate('--no-render' not in sys.argv,family)
