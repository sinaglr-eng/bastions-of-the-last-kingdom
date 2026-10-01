"""Blender 5.2: alpine royal town, working watermill and inhabited frontier.

Reference photographs and plan: Bavarian Palace Administration,
https://www.neuschwanstein.de/englisch/palace/index.htm
https://www.neuschwanstein.de/englisch/palace/history.htm
The design adapts the limestone palas, red gateway and slender slate spires to
the game's original low-poly style; no photographic textures are used.
"""
import bpy, math, sys, json
from pathlib import Path
from mathutils import Vector,Matrix
sys.path.insert(0,str(Path(__file__).resolve().parent))
import author_scenery_v3 as V3
S=V3.S
from scenery_geometry import install
install(S)

old_palette=S.palette
def palette():
    p=old_palette()
    for key,name,color,metal in [
        ('stone','Alpine white limestone','d2d8c7',.02),
        ('light','Carved ivory limestone','edf0db',.02),
        ('brick','Rose brick gateway','a36954',0),
        ('skin','Village warm skin','d4b490',0),
        ('red','Village burgundy wool','854f4c',0),
        ('cow','Russet cattle hide','795943',0),
        ('wolf','Wolf grey fur','788681',0),
        ('troll','Mountain troll skin','698487',0),
        ('granite','Faceted mountain granite','718580',0),
    ]:p[key]=S.A.mat(name,color,metal)
    return p
S.palette=palette

def marker(name,role,pos,**metadata):
    obj=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(obj)
    obj.location=pos;obj['sceneryRole']=role
    for k,v in metadata.items():obj[k]=v
    return obj

def transform_new(before,position,angle=0):
    bpy.context.view_layer.update()
    transform=Matrix.Translation(position)@Matrix.Rotation(angle,4,'Z')
    for obj in set(bpy.context.scene.objects)-before:obj.matrix_world=transform@obj.matrix_world

def rounded_spire(name,x,y,height,radius=.74):
    S.cyl(name+' spreading foundation',(x,y,.60),radius*1.28,1.2,'shade',12,radius*1.08)
    S.cyl(name+' pale round shaft',(x,y,height/2),radius,height,'stone',12)
    for z in [1.2,height*.44,height*.73,height-.27]:S.cyl(name+' carved belt',(x,y,z),radius*1.065,.15,'light',12)
    for level in [.36,.60,.82]:
        for a in [0,math.pi/2,math.pi,3*math.pi/2]:
            S.arrow_window(name+' slim arched window',x+math.sin(a)*radius*1.004,y+math.cos(a)*radius*1.004,height*level,-a,.17,.72)
    S.cyl(name+' corbel crown',(x,y,height+.06),radius*1.16,.40,'light',12,radius*1.09)
    S.cyl(name+' steep slate roof',(x,y,height+1.62),radius*1.25,3.0,'roof',12,0)
    for z,r in [(height+.25,radius*1.24),(height+.90,radius*.97),(height+1.53,radius*.68)]:S.cyl(name+' slate spire seam',(x,y,z),r,.048,'rooflight',12)
    S.cyl(name+' finial',(x,y,height+3.28),.066,.34,'gold',6,0)
    return height+3.45

def palace_block(name,x,y,width,depth,height):
    S.box(name+' limestone facade',(x,y,height*.5+.48),(width,depth,height),'stone',.045)
    for z in [1.16,3.43,5.69,height+.35]:S.box(name+' facade string course',(x,y,z),(width+.15,depth+.16,.15),'light')
    for dx in [-width*.46,width*.46]:
        for dy in [-depth*.46,depth*.46]:
            S.box(name+' upright buttress',(x+dx,y+dy,height*.48),(.31,.32,height-.40),'light')
    for row in range(max(2,int((height-2.01)/2.18)+1)):
        z=2.03+row*2.18
        for column in range(max(3,int(width/1.18))):
            wx=x-width*.38+column*width*.76/(max(3,int(width/1.18))-1)
            for side in [-1,1]:S.arrow_window(name+' tall paired window',wx,y+side*(depth/2+.032),z,0,.33,.92)
    S.gabled_roof(name+' steep blue slate',x,y,height+.59,width+.59,depth+.66,2.53)
    for column in range(4):
        xx=x-width*.35+column*width*.70/3
        for side in [-1,1]:
            yy=y+side*depth*.34
            S.box(name+' roof dormer face',(xx,yy,height+1.29),(.47,.48,.57),'stone')
            S.gabled_roof(name+' dormer pointed roof',xx,yy,height+1.57,.68,.63,.47)
            S.arrow_window(name+' dormer slit',xx,yy+side*.25,height+1.29,0,.18,.32)

def alpine_palace():
    marker('RoyalAlpinePalace','palace',(0,0,0),reference='Neuschwanstein limestone palas and gateway')
    S.box('Castle mountain terrace',(0,0,.27),(17.2,13.2,.60),'shade',.10)
    S.box('Castle white upper terrace',(0,0,.63),(16.8,12.8,.13),'light')
    for i,(x,y)in enumerate([(-7.1,-5.7),(-3.2,-6.2),(1.1,-6.1),(5.1,-5.5),(7.7,-2.2),(7.7,3.5),(-6.0,6.1)]):
        S.orb('Alpine footing carved boulder '+str(i),(x,y,.30),(1.22,1.12,.63),'shade')
    palace_block('High royal palas',1.7,1.5,6.5,4.8,8.5)
    palace_block('Long northern knights hall',-2.6,4.25,5.3,2.4,6.3)
    palace_block('Southern bower wing',1.4,-3.8,5.9,2.0,5.0)
    rounded_spire('Great staircase tower',5.38,4.32,14.25,1.04)
    rounded_spire('Southwest slender turret',-1.8,-1.08,10.1,.59)
    rounded_spire('Palas eastern oriel',4.97,-.88,10.75,.56)
    rounded_spire('Bower south tower',4.48,-4.25,7.8,.58)
    # Warm gateway contrasts with the pale palas, as in the alpine reference.
    S.box('Red west gatehouse north shoulder',(-7.45,2.5,2.54),(2.1,3.0,4.0),'brick',.03)
    S.box('Red west gatehouse south shoulder',(-7.45,-2.4,2.54),(2.1,2.8,4.0),'brick',.03)
    S.box('Red gatehouse raised arch chamber',(-7.45,.07,4.36),(2.1,2.20,1.1),'brick')
    S.box('Dark west gate passage',(-8.515,.07,1.64),(.032,1.4,1.91),'dark')
    for y in [-.45,-.19,.07,.33,.59]:S.beam('West gateway portcullis',(-8.54,y,.75),(-8.54,y,2.55),.031,'iron',5)
    for y in [-2.52,2.58]:
        S.gabled_roof('Gateway steep slate roof',-7.45,y,4.60,2.42,3.4,1.19)
        rounded_spire('West gateway slender watch turret',-7.65,y+(1.38 if y>0 else -1.28),5.50,.50)
    for z in [1.13,2.46,3.73]:
        for y in [-2.55,2.65]:S.arrow_window('Gateway limestone framed lancet',-8.515,y,z,math.pi/2,.24,.70)
    S.box('Royal bailey paving',(-3.30,.0,.721),(6.7,6.2,.09),'light')
    for x in [-5.8,-4.5,-3.2,-1.9]:
        for y in [-2.2,-.8,.8,2.2]:S.box('Bailey decorative paving',(x,y,.78),(.47,.48,.023),'shade')
    for y in [-6.1,6.1]:S.curtain_wall('Low terrace crenellated wall',-.5,y,13.2,0,1.62)
    for i in range(5):S.box('Gate broad approach step',(-8.70-i*.24,.05,.66-i*.10),(.28,1.5,.12),'light')
    S.flag('Great tower royal blue standard',5.38,4.32,17.72,'blue',.84)
    for x,y,z in [(-1.8,-1.08,13.54),(4.48,-4.25,11.18),(-7.65,-3.80,8.93)]:S.flag('Alpine turret standard',x,y,z,'blue',.44)

def villager(name,x,y,angle=0,kind='town'):
    before=set(bpy.context.scene.objects)
    cloth='blue' if kind in ['guard','merchant'] else 'red' if kind=='town' else 'grass'
    for side in [-1,1]:
        S.box(name+' shoe',(side*.095,.025,.09),(.14,.23,.16),'wood',.008)
        S.beam(name+' trouser leg',(side*.095,0,.15),(side*.08,0,.56),.060,'dark',6)
        S.beam(name+' cloth arm',(side*.19,0,.92),(side*.235,.07,.65),.054,cloth,6)
        S.orb(name+' hand',(side*.238,.08,.63),(.048,.045,.056),'skin')
    S.orb(name+' tunic',(0,0,.76),(.187,.13,.255),cloth)
    S.beam(name+' neck',(0,0,.94),(0,0,1.11),.055,'skin',6)
    S.orb(name+' human head',(0,0,1.19),(.132,.112,.171),'skin')
    S.cyl(name+' village cap',(0,0,1.36),.141,.10,'wheat' if kind=='farmer' else 'wood',8,.10)
    for side in [-1,1]:S.orb(name+' eye',(side*.044,.107,1.213),(.013,.009,.013),'dark')
    S.orb(name+' small nose',(0,.124,1.174),(.027,.025,.026),'skin')
    if kind=='guard':
        S.beam(name+' halberd shaft',(.31,.05,0),(.31,.05,1.76),.022,'wood',6)
        S.cyl(name+' halberd spear',(.31,.05,1.87),.050,.23,'iron',4,0)
        S.box(name+' guard breastplate',(0,.129,.80),(.29,.046,.28),'iron')
    elif kind=='farmer':
        S.beam(name+' farming rake',(.27,.07,.03),(.27,.07,1.31),.024,'wood',5)
        S.box(name+' rake crossbar',(.27,.07,1.31),(.30,.061,.054),'plank')
        for dx in [-.12,-.06,0,.06,.12]:S.beam(name+' rake tooth',(.27+dx,.07,1.30),(.27+dx,.07,1.17),.012,'plank',4)
    transform_new(before,(x,y,0),angle)
    marker(name,'resident',(x,y,0),occupation=kind)

def fence_pen(name,x,y,width,depth):
    marker(name,'animalPen',(x,y,0),width=width,depth=depth)
    for side in [-1,1]:
        for axis in [0,1]:
            length=width if axis==0 else depth
            for i in range(int(length/.75)+1):
                offset=-length/2+i*length/int(length/.75)
                px=x+offset if axis==0 else x+side*width/2
                py=y+side*depth/2 if axis==0 else y+offset
                S.beam(name+' sturdy fencepost',(px,py,.015),(px,py,.78),.044,'wood',6)
            for z in [.33,.62]:
                a=(x-width/2,y+side*depth/2,z) if axis==0 else (x+side*width/2,y-depth/2,z)
                b=(x+width/2,y+side*depth/2,z) if axis==0 else (x+side*width/2,y+depth/2,z)
                S.beam(name+' pasture timber rail',a,b,.035,'plank',6)

def cow(name,x,y,angle=0):
    before=set(bpy.context.scene.objects)
    for side in [-1,1]:
        for along in [-1,1]:
            S.beam(name+' sturdy leg',(side*.22,along*.38,.12),(side*.22,along*.38,.64),.057,'cow',7)
            S.box(name+' hoof',(side*.22,along*.38,.075),(.14,.17,.14),'dark')
    S.orb(name+' barrel torso',(0,0,.82),(.39,.67,.34),'cow')
    S.orb(name+' white flank patch',(.352,-.04,.86),(.042,.32,.19),'white')
    S.orb(name+' long head',(0,.71,.96),(.25,.32,.24),'cow')
    S.orb(name+' muzzle',(0,.91,.86),(.19,.17,.13),'plasterwarm')
    for side in [-1,1]:
        S.orb(name+' ear',(side*.285,.68,1.10),(.15,.065,.065),'cow')
        S.beam(name+' ivory horn',(side*.18,.68,1.17),(side*.28,.67,1.37),.031,'bone',6)
        S.orb(name+' eye',(side*.175,.90,1.04),(.023,.023,.023),'dark')
    S.beam(name+' tail',(0,-.63,.93),(.075,-.81,.40),.021,'cow',6)
    S.orb(name+' tail tuft',(.075,-.81,.38),(.055,.045,.073),'dark')
    transform_new(before,(x,y,0),angle);marker(name,'cow',(x,y,0))

def watermill(x,y):
    V3.town_house('Canal watermill',x,y,2.8,3.0,2.48,True,'tile')
    marker('TownWorkingWatermill','watermill',(x,y,0))
    for level in [.90,1.89]:S.box('Mill timber sill',(x,y,level),(2.91,3.08,.11),'wood')
    center=Vector((x+3.0,y,.99));before=set(bpy.context.scene.objects)
    for side in [-1,1]:
        xx=center.x+side*.24
        bpy.ops.mesh.primitive_torus_add(major_radius=.95,minor_radius=.045,major_segments=20,minor_segments=6,location=(xx,center.y,center.z),rotation=(0,math.pi/2,0))
        obj=bpy.context.object;obj.name='Mill wheel iron rim';obj.data.materials.append(S.P['iron'])
        for spoke in range(10):
            a=spoke*math.tau/10
            S.beam('Mill wheel oak spoke',(xx,center.y,center.z),(xx,center.y+math.cos(a)*.92,center.z+math.sin(a)*.92),.035,'wood',6)
    for paddle in range(16):
        a=paddle*math.tau/16
        obj=S.box('Mill wheel water paddle',(center.x,center.y+math.cos(a)*.96,center.z+math.sin(a)*.96),(.59,.21,.11),'plank')
        obj.rotation_euler[0]=a
    S.beam('Mill wheel central axle',(center.x-.38,center.y,center.z),(center.x+.38,center.y,center.z),.095,'iron',10)
    for obj in set(bpy.context.scene.objects)-before:obj['dynamicGroup']='MillWaterwheel'
    marker('MillWaterwheel','waterwheel',tuple(center),rotationAxis='X',radius=.99)
    S.beam('Mill driven oak axle',(x+1.2,y,.99),(center.x-.30,y,.99),.09,'wood',8)
    S.box('Mill water-side stone pier',(x+1.6,y,.30),(.31,.66,.64),'stone')

def town_canal_bridge(x,y,width=4.7):
    marker('Town canal bridge','canalBridge',(x,y,0))
    for i in range(15):S.box('Town canal bridge stone tread',(x-width/2+i*width/14,y,.25),(.36,1.35,.18),'light')
    for side in [-1,1]:
        for i in range(8):S.box('Town canal bridge parapet pier',(x-width/2+i*width/7,y+side*.76,.58),(.22,.19,.62),'stone')
        S.beam('Town canal bridge timber handrail',(x-width/2,y+side*.76,.91),(x+width/2,y+side*.76,.91),.041,'wood',6)

def quarry():
    marker('EasternStoneQuarry','quarry',(22.6,21.7,0))
    # A terraced rock cut below the mountain, with working faces and extracted blocks.
    for row in range(3):
        for column in range(4):
            x=20.4+column*1.35;y=22.2+row*1.35
            S.box('Quarry terraced limestone face',(x,y,.5+row*.49),(1.53,1.43,1.0+row*.98),'shade',.045)
    for i in range(7):S.box('Quarry dressed extracted block',(20.4+(i%4)*.66,19.3+(i//4)*.7,.28),(.54,.55,.55),'stone',.012)
    for x in [22.0,24.2]:S.beam('Quarry timber crane frame',(x,20.2,.05),(x,20.2,2.88),.10,'wood',7)
    S.beam('Quarry crane lifting beam',(21.7,20.2,2.7),(24.8,20.2,2.7),.11,'plank',7)
    S.beam('Quarry hanging rope',(23.4,20.2,2.74),(23.4,20.2,.56),.018,'hideedge',5)
    S.box('Quarry suspended stone',(23.4,20.2,.42),(.53,.61,.63),'stone')
    for x in [19.4,21.8]:
        S.box('Quarry hand cart tray',(x,18.2,.51),(1.0,.78,.18),'wood')
        for side in [-1,1]:
            wheel=S.cyl('Quarry cart wheel',(x,18.2+side*.46,.29),.30,.12,'iron',10);wheel.rotation_euler[0]=math.pi/2
        S.box('Quarry cart limestone load',(x,18.2,.78),(.65,.53,.36),'light')
    villager('Quarry mason',23.3,18.60,.2,'farmer');villager('Quarry stonecutter',20.9,20.0,2.0,'farmer')

def inhabited_royal_town():
    alpine_palace()
    # A street network straddles the mill stream east of the hilltop palace.
    houses=[
        ('Royal gate inn',10.8,-3.9,3.0,2.5,2.5,True,'tile'),
        ('West merchant hall',11.1,4.3,2.8,2.3,2.1,False,'roof'),
        ('Upper bakery',14.8,5.4,2.5,2.2,1.8,True,'tile'),
        ('Wool merchants house',14.8,-4.4,2.6,2.0,2.1,True,'roof'),
        ('Blue town hall',11.2,9.0,3.1,2.8,3.0,False,'roof'),
        ('North granary',10.0,15.4,2.9,2.5,2.0,True,'tile'),
        ('Town cooper',13.9,15.2,2.5,2.2,1.8,True,'tile'),
        ('Bridge blacksmith',22.8,2.7,2.8,2.5,2.1,True,'roof'),
        ('East riverside house',22.1,-1.7,2.3,2.1,2.0,False,'tile'),
        ('Eastern guild house',26.2,3.2,3.0,2.4,2.5,False,'roof'),
        ('Eastern candle maker',26.3,-1.4,2.2,2.0,1.7,True,'tile'),
        ('North millers cottage',22.6,9.6,2.4,2.1,2.0,True,'tile'),
        ('Eastern schoolhouse',26.5,8.7,2.8,2.5,2.3,False,'roof'),
        ('South brewer',10.6,-9.3,2.6,2.4,1.9,True,'tile'),
        ('South village home',14.4,-10.3,2.4,2.1,1.8,False,'roof'),
        ('Cattle farm barn',25.5,-11.4,3.5,3.0,2.0,True,'tile'),
        ('Cattle farmers home',26.0,-7.0,2.7,2.3,1.7,True,'tile'),
        ('Shepherd long barn',8.0,-16.1,3.5,2.4,1.8,True,'tile'),
        ('Shepherd cottage',12.5,-17.1,2.6,2.1,1.6,True,'tile'),
        ('North field farmhouse',6.6,14.5,2.7,2.3,1.8,True,'tile'),
    ]
    for params in houses:
        V3.town_house(*params);marker(params[0],'townBuilding',(params[1],params[2],0))
    for index,(x,y,w,d)in enumerate([(10.8,.0,8.4,1.65),(14.1,1.3,1.65,16.0),(23.2,.0,10.0,1.65),(24.0,4.1,1.65,13.8),(9.5,9.0,1.60,12.8),(9.7,-12.4,1.5,8.0)]):
        S.box('Royal town cobbled street '+str(index),(x,y,.019),(w,d,.047),'plasterwarm')
        marker('Town street '+str(index),'street',(x,y,0),width=w,depth=d)
    S.cyl('Town market paved plaza',(10.6,.25,.067),2.55,.065,'light',16)
    S.cyl('Town market fountain',(10.6,.25,.45),.62,.72,'stone',12,.71)
    S.cyl('Fountain basin blue water',(10.6,.25,.83),.64,.035,'blue',12)
    S.cyl('Town market fountain pillar',(10.6,.25,1.17),.14,.67,'light',10)
    S.orb('Town fountain finial',(10.6,.25,1.6),(.21,.21,.24),'gold')
    for params in [('Fruit sellers stall',8.8,2.3,'blue'),('Bakers bread stall',12.6,2.4,'wheat'),('Wool trader stall',9.0,-2.5,'hide'),('South produce stall',12.6,-2.4,'grass')]:V3.market_stall(*params)
    for x,y in [(7.6,0),(13.1,0),(14.0,8),(14.0,-8),(21.2,0),(25.3,0),(24,7.1),(8.4,-9.5),(8.9,11.7)]:
        S.beam('Town lantern iron post',(x,y,.04),(x,y,1.84),.033,'iron')
        S.box('Town warm lantern glass',(x,y,1.79),(.18,.18,.28),'gold');S.cyl('Town lantern blue cap',(x,y,2.01),.15,.14,'roof',5,0)
    watermill(14,11)
    for y in [0,-8.0,15.3]:town_canal_bridge(17.8,y)
    for name,x,y in [('South wheat',4.6,-14.8),('South barley',16.5,-17.0),('East grain',29.6,-7.4),('North wheat',5.9,10.3),('North barley',11.9,18.9)]:
        V3.farmland(name,x,y,4.5,3.1);marker(name,'farmPlot',(x,y,0))
    fence_pen('Sheep pasture',6.1,-10.7,6.3,4.5)
    for i in range(9):
        x=4.3+(i%3)*1.65;y=-12.1+(i//3)*1.17;V3.sheep(x,y);marker('Pasture sheep '+str(i),'sheep',(x,y,0))
    fence_pen('Cattle pasture',25.3,-16.5,7.9,6.5)
    for i in range(6):cow('Pasture cow '+str(i),23.1+(i%3)*2.1,-18.1+(i//3)*2.6,(i%3)*.6)
    for x,y in [(5.0,-11.9),(7.4,-10.2),(24.2,-18.4)]:S.cyl('Pasture water trough',(x,y,.19),.25,.32,'wood',8)
    for x,y in [(-3.1,8.9),(-.7,9.8),(2.0,9.15),(4.1,9.5),(.2,-8.4),(3.8,-8.5),(26.3,15.5),(25.8,17.4),(28.2,16.1),(29.8,14.6)]:
        S.beam('Town orchard trunk',(x,y,.01),(x,y,1.66),.068,'wood',7)
        for side in [-1,1]:S.orb('Town orchard spreading crown',(x+side*.34,y,1.95),(.62,.64,.61),'grass')
        S.orb('Town orchard upper crown',(x,y,2.20),(.60,.62,.56),'grass')
    quarry()
    for i,(x,y,kind)in enumerate([(8.0,.3,'town'),(12.0,.2,'merchant'),(14,3.4,'town'),(14,-3.6,'town'),(9.0,3.6,'merchant'),(9.0,-3.6,'merchant'),(10,6.6,'town'),(12.5,8.1,'guard'),(14,12.3,'farmer'),(22,0,'town'),(24,0,'town'),(24,6.4,'town'),(22.3,6.5,'merchant'),(24,-4.8,'town'),(9.4,-6.2,'town'),(9.4,-12.9,'farmer'),(14.9,-15.0,'farmer'),(24.6,-13.8,'farmer'),(6.4,-8.0,'farmer'),(6.1,12.8,'farmer'),(-5.4,-1.5,'guard'),(-5.4,1.5,'guard')]):villager('Town resident '+str(i),x,y,(i*.83)%math.tau,kind)
    # A native source-only stream documents the mill placement in Blender.
    # Runtime owns the flowing shader channel, so this mesh is excluded from GLB.
    controls=[(23,-4),(31,-10),(45,-10),(55,-4),(55,3),(55,14),(55,22),(52,29),(40,32),(28,29),(20,24)]
    vertices=[];faces=[]
    for a,b in zip(controls,controls[1:]):
        start=Vector((a[0]-38,14-a[1],-.018));end=Vector((b[0]-38,14-b[1],-.018));d=(end-start).normalized();n=Vector((-d.y,d.x,0))*1.15
        k=len(vertices);vertices.extend([tuple(start+n),tuple(start-n),tuple(end-n),tuple(end+n)]);faces.append((k,k+1,k+2,k+3))
    review=S.A.custom('Working mill stream source preview',vertices,faces,S.P['blue']);review['reviewOnly']=True

def export_v4(name,build,view_center,ortho,camera_position):
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    S.P=S.palette();build();bpy.context.view_layer.update()
    scene=bpy.context.scene;objects=[o for o in scene.objects if o.type=='MESH' and not o.get('reviewOnly')];markers=[o for o in scene.objects if o.type=='EMPTY' and o.get('sceneryRole')]
    triangles=sum(sum(max(0,len(poly.vertices)-2)for poly in o.data.polygons)for o in objects)
    source_counts={role:sum(o.get('sceneryRole')==role for o in markers)for role in {o.get('sceneryRole')for o in markers}}
    copies=[];groups={}
    for source in objects:
        key=(source.get('dynamicGroup',''),source.data.materials[0].name)
        obj=source.copy();obj.data=source.data.copy();bpy.context.collection.objects.link(obj);groups.setdefault(key,[]).append(obj)
    wheel=next((o for o in markers if o.name=='MillWaterwheel'),None)
    for (dynamic,matname),pieces in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in pieces:obj.select_set(True)
        bpy.context.view_layer.objects.active=pieces[0]
        if len(pieces)>1:bpy.ops.object.join()
        obj=pieces[0];obj.name=name+' '+dynamic+' '+matname
        if dynamic and wheel:
            world=obj.matrix_world.copy();obj.parent=wheel;obj.matrix_world=world
        copies.append(obj)
    manifest=marker('SettlementManifest','manifest',(0,0,0),authoring='Blender 5.2',source=name+'.blend',triangleCount=triangles,roles=json.dumps(source_counts))
    markers.append(manifest)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in copies+markers:obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(S.OUT/(name+'.glb')),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_animations=False,export_cameras=False,export_lights=False)
    for obj in copies:bpy.data.objects.remove(obj,do_unlink=True)
    cam=S.A.configure_scene();cam.location=camera_position;target=Vector(view_center)
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=ortho
    for obj in scene.objects:
        if obj.type=='LIGHT':
            obj.location*=4;obj.data.energy*=10;obj.data.size*=4;obj.rotation_euler=(target-obj.location).to_track_quat('-Z','Y').to_euler()
    scene.cycles.samples=24;scene.render.resolution_x=1320;scene.render.resolution_y=960
    scene['Authoring']='Blender 5.2';scene['Scenery design']=name;scene['Triangle count']=triangles;scene['Settlement roles']=json.dumps(source_counts)
    if name.startswith('fortified-warcamp'):scene['Upcoming invader anchor']='Game Y-up local (2.25,0.595,0)'
    bpy.ops.wm.save_as_mainfile(filepath=str(S.SCENES/(name+'.blend')))
    scene.render.filepath=str(S.REVIEW/(name+'-review.png'));bpy.ops.render.render(write_still=True)
    print(json.dumps({'file':name+'.glb','triangles':triangles,'meshes':len(copies),'roles':source_counts,'authoring':'Blender 5.2','source':name+'.blend'}))

if __name__=='__main__':
    export_v4('royal-castle-v4',inhabited_royal_town,(9,1,4.5),52,(-30,-47,35))
    from scenery_orcs_v4 import build_orc_territory
    export_v4('fortified-warcamp-v4',lambda:build_orc_territory(S),(-12,-1,2.2),56,(35,-47,30))
