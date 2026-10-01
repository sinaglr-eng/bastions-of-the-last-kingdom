"""Blender 5.2 castle town and inhabited orc encampment for scenery edition V3.

The original V2 landmarks remain editable and form the centers of these scenes.
Only scenery files are generated: no defender assets, gameplay JSON or manifests.
"""
import bpy, math, sys
from pathlib import Path
from mathutils import Matrix,Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
import author_scenery_v2 as S

base_palette=S.palette
def palette():
    result=base_palette()
    for key,name,color,metal in [
        ('plaster','Ivory lime plaster','d8c8a5',0),
        ('plasterwarm','Warm village plaster','b99c77',0),
        ('tile','Terracotta village tiles','976b53',0),
        ('wheat','Golden wheat and hay','c5ad62',0),
        ('orc','Olive orc skin','718d59',0),
        ('orcshadow','Orc jaw and ears','526c43',0),
        ('orccloth','Tribal red cloth','78493d',0),
        ('white','Fleece and linen','d4d5b7',0),
    ]:result[key]=S.A.mat(name,color,metal)
    return result
S.palette=palette

def resize_new(objects,scale):
    transform=Matrix.Diagonal((scale,scale,scale,1))
    for obj in objects:obj.matrix_world=transform@obj.matrix_world

def town_house(name,x,y,width=2.0,depth=1.9,height=1.7,warm=False,roof='roof'):
    wall='plasterwarm' if warm else 'plaster'
    S.box(name+' dressed footing',(x,y,.17),(width+.17,depth+.17,.34),'shade')
    S.box(name+' plaster walls',(x,y,height*.54),(width,depth,height),wall)
    for dx in [-width*.43,width*.43]:
        for dy in [-depth*.43,depth*.43]:S.beam(name+' corner timber',(x+dx,y+dy,.29),(x+dx,y+dy,height+.16),.065,'wood')
    S.box(name+' upper floor sill',(x,y,height*.56),(width+.06,depth+.06,.095),'plank')
    S.gabled_roof(name+' tiled roof',x,y,height+.19,width+ .40,depth+.46,.93,roof)
    S.box(name+' oak doorway',(x,y-depth*.505,.75),(.49,.065,1.04),'wood')
    for dx in [-width*.31,width*.31]:
        S.box(name+' window shadow',(x+dx,y-depth*.51,height*.68),(.32,.06,.35),'dark')
        S.box(name+' timber window cross',(x+dx,y-depth*.55,height*.68),(.055,.04,.38),'plank')
        S.box(name+' window lintel',(x+dx,y-depth*.55,height*.68+.20),(.41,.04,.058),'plank')
    S.box(name+' chimney stack',(x-width*.26,y+depth*.14,height+1.02),(.31,.36,.69),'stone')
    S.box(name+' chimney coping',(x-width*.26,y+depth*.14,height+1.41),(.39,.43,.10),'light')
    for dx in [-.38,.38]:S.box(name+' door stair',(x+dx*.15,y-depth*.58,.13),(.64,.22,.16),'light')

def market_stall(name,x,y,cloth='blue'):
    for dx in [-.66,.66]:
        for dy in [-.49,.49]:S.beam(name+' post',(x+dx,y+dy,0),(x+dx,y+dy,1.6),.045,'wood')
    S.box(name+' goods counter',(x,y,.57),(1.42,.90,.14),'plank')
    for i in range(5):
        panel=S.box(name+' striped canopy',(x-.58+i*.29,y,1.58),(.27,1.21,.06),cloth if i%2 else 'white')
        panel.rotation_euler[0]=.11
    for i in range(4):S.orb(name+' market produce',(x-.46+i*.30,y-.15,.73),(.12,.11,.12),'wheat' if i%2 else 'grass')

def farmland(name,x,y,width=3.8,depth=2.7):
    S.box(name+' soil bed',(x,y,.007),(width,depth,.025),'soil')
    for row in range(6):
        yy=y-depth/2+.22+row*(depth-.4)/5
        S.beam(name+' dark plowed furrow',(x-width/2+.10,yy,.041),(x+width/2-.10,yy,.041),.045,'wood',4)
        for column in range(7):
            xx=x-width/2+.27+column*(width-.54)/6
            height=.23+((column+row)%3)*.045
            S.beam(name+' wheat stalk',(xx,yy,.044),(xx,yy,height),.011,'wheat',3)
            S.cyl(name+' wheat ear',(xx,yy,height+.055),.036,.115,'wheat',4,0)
    for side in [-1,1]:
        S.beam(name+' low field rail',(x-width/2,y+side*depth/2,.41),(x+width/2,y+side*depth/2,.41),.031,'plank')
        for xx in [x-width/2,x,x+width/2]:S.beam(name+' field fencepost',(xx,y+side*depth/2,.01),(xx,y+side*depth/2,.56),.038,'wood')

def village_windmill(x,y):
    S.cyl('Mill battered stone tower',(x,y,1.36),.83,2.72,'stone',10,.57)
    S.cyl('Mill terracotta roof',(x,y,3.03),.9,1.04,'tile',10,0)
    for z in [.7,1.5]:S.arrow_window('Mill narrow window',x,y-.71,z,wide=.14,tall=.42)
    # A bold wooden four-bladed windmill faces the south town fields.
    center=Vector((x,y-.92,2.36))
    for angle in [math.pi/4+i*math.pi/2 for i in range(4)]:
        end=center+Vector((math.cos(angle)*1.72,0,math.sin(angle)*1.72))
        S.beam('Mill blade spar',center,end,.035,'wood')
        blade=S.box('Mill linen sail',tuple(center+(end-center)*.69),(.45,.08,1.02),'white')
        blade.rotation_euler[1]=-angle+math.pi/2
    S.orb('Mill axle cap',tuple(center),(.14,.12,.14),'wood')

def sheep(x,y):
    for dx in [-.13,.13]:
        for dy in [-.19,.19]:S.beam('Pasture sheep leg',(x+dx,y+dy,.03),(x+dx,y+dy,.37),.035,'iron')
    S.orb('Pasture sheep fleece',(x,y,.48),(.27,.37,.25),'white')
    S.orb('Pasture sheep head',(x,y+.35,.57),(.13,.16,.15),'shade')

def castle_town():
    before=set(bpy.context.scene.objects);S.royal_castle()
    resize_new(set(bpy.context.scene.objects)-before,1.6)
    # The small town extends behind the epic castle, entirely beyond the board.
    for name,x,y,w,d,h,warm,roof in [
        ('Town gate inn',6.8,-5.4,2.8,2.15,2.25,True,'tile'),
        ('Blue-roof town house',7.9,5.55,2.05,2.1,1.85,False,'roof'),
        ('Market merchant house',10.8,5.35,2.3,2.02,2.05,True,'roof'),
        ('Market baker house',11.1,-4.20,2.3,2.0,1.95,False,'tile'),
        ('Eastern town hall',14.65,2.0,3.0,2.8,2.6,False,'roof'),
        ('Town smithy',14.7,-2.70,2.5,2.1,1.6,True,'tile'),
        ('North farming cottage',12.4,9.0,2.05,1.65,1.50,True,'tile'),
        ('Village granary',16.75,6.4,2.3,2.8,2.0,True,'roof'),
        ('South cattle barn',12.6,-9.0,3.15,2.2,1.50,True,'tile'),
    ]:town_house(name,x,y,w,d,h,warm,roof)
    S.cyl('Village market cobbles',(10.6,.30,.045),3.08,.065,'shade',16)
    S.cyl('Market fountain basin',(10.7,.29,.36),.61,.61,'stone',12,.68)
    S.cyl('Market fountain water',(10.7,.29,.65),.60,.025,'blue',12)
    S.cyl('Fountain central pillar',(10.7,.29,1.0),.13,.78,'light',10)
    S.orb('Fountain gilded ornament',(10.7,.29,1.46),(.20,.20,.21),'gold')
    for name,x,y,cloth in [('Produce stall',8.9,2.68,'blue'),('Village cloth stall',12.0,2.57,'hide'),('Bakers stall',8.84,-2.25,'wheat')]:market_stall(name,x,y,cloth)
    for x,y,width,depth in [(5.8,0,1.85,2.8),(8.7,.38,4.0,1.4),(13.0,.38,3.9,1.4),(10.6,4.0,1.2,2.5),(10.6,-3.5,1.2,2.7)]:
        S.box('Town cobblestone lane',(x,y,.02),(width,depth,.035),'shade')
    for x,y in [(6.2,-2.6),(6.2,2.7),(8.0,3.4),(12.9,3.4),(12.9,-2.6),(16.0,-.1)]:
        S.beam('Town lantern wrought post',(x,y,.04),(x,y,1.8),.033,'iron')
        S.box('Town lantern case',(x,y,1.76),(.17,.17,.28),'gold')
        S.cyl('Town lantern cap',(x,y,1.96),.16,.13,'roof',5,0)
    for name,x,y in [('North wheat strip',7.2,8.6),('East wheat strip',17.1,10.1),('South wheat strip',7.4,-9.15)]:farmland(name,x,y)
    village_windmill(18.0,-7.45)
    for x,y in [(16.3,-10.0),(17.0,-10.25),(16.8,-9.50),(15.75,-9.48),(17.5,-9.35)]:sheep(x,y)
    for i in range(6):
        S.beam('Pasture enclosure post',(15.1+i*.56,-10.83,.01),(15.1+i*.56,-10.83,.64),.043,'wood')
    S.beam('Pasture enclosure rail',(15.1,-10.83,.42),(18.0,-10.83,.42),.031,'plank')
    # Walls and two smaller watchtowers protect the town without enclosing farms.
    for y in [-6.87,7.13]:S.curtain_wall('Town outer defense',11.2,y,10.6,0,1.14)
    for y in [-6.87,7.13]:S.castle_tower('Eastern town watchtower',16.54,y,2.12,.46,True)
    S.curtain_wall('Eastern town wall',16.56,.08,11.96,math.pi/2,1.14)
    S.flag('Town hall royal pennant',14.65,2.0,3.88,'blue',.72)
    for x,y in [(-3.1,8.9),(-.7,9.8),(1.4,9.15),(3.8,9.5),(.2,-8.4),(3.8,-8.5),(15.5,10.4)]:
        S.beam('Town orchard trunk',(x,y,.01),(x,y,1.68),.073,'wood',7)
        for side in [-1,1]:
            S.beam('Orchard spreading branch',(x,y,1.04),(x+side*.44,y,1.75),.034,'wood')
            S.orb('Orchard fruit canopy',(x+side*.35,y,1.88),(.64,.65,.58),'grass')
        S.orb('Orchard crown',(x,y,2.14),(.60,.62,.59),'grass')

def orc_figure(name,x,y,seated=False,facing=0,spear=False):
    before=set(bpy.context.scene.objects)
    zhead=1.16 if seated else 1.57
    if seated:
        S.cyl(name+' sitting stump',(0,0,.21),.22,.42,'wood',7)
        S.orb(name+' seated cloth torso',(0,0,.72),(.23,.17,.31),'orccloth')
        for side in [-1,1]:
            S.beam(name+' folded thigh',(side*.13,0,.43),(side*.17,.24,.29),.082,'orccloth',7)
            S.beam(name+' bent shin',(side*.17,.24,.29),(side*.18,.39,.13),.064,'orcshadow',7)
            S.box(name+' leather boot',(side*.18,.43,.11),(.15,.24,.13),'wood',.01)
            S.beam(name+' resting arm',(side*.23,0,.84),(side*.28,.13,.60),.057,'orc',7)
            S.beam(name+' forearm',(side*.28,.13,.60),(side*.16,.29,.56),.046,'orc',7)
            S.orb(name+' knuckled hand',(side*.16,.29,.56),(.067,.057,.062),'orc')
    else:
        for side in [-1,1]:
            S.box(name+' patrol boot',(side*.12,.048,.13),(.17,.25,.23),'wood',.015)
            S.beam(name+' patrol trousers',(side*.12,0,.24),(side*.10,0,.73),.09,'orccloth',7)
            S.beam(name+' strong arm',(side*.28,0,1.19),(side*.31,.055,.84),.072,'orc',7)
            S.orb(name+' gloved hand',(side*.31,.07,.81),(.077,.070,.092),'orcshadow')
        S.orb(name+' standing broad torso',(0,0,.96),(.255,.18,.31),'orccloth')
        for side in [-1,1]:S.orb(name+' iron shoulder guard',(side*.26,0,1.20),(.14,.16,.09),'iron')
        S.box(name+' wide leather belt',(0,.005,.77),(.46,.34,.09),'wood')
        S.box(name+' iron belt clasp',(0,.18,.78),(.085,.03,.084),'iron')
    S.beam(name+' neck',(0,0,zhead-.30),(0,.015,zhead-.12),.085,'orc',8)
    S.orb(name+' orc head',(0,0,zhead),(.19,.16,.225),'orc')
    S.orb(name+' heavy jutting jaw',(0,.095,zhead-.11),(.155,.11,.12),'orcshadow')
    S.orb(name+' orc brow',(0,.115,zhead+.056),(.175,.067,.050),'orcshadow')
    for side in [-1,1]:
        S.orb(name+' pointed ear',(side*.202,0,zhead+.035),(.11,.057,.053),'orc')
        S.orb(name+' watchful eye',(side*.073,.157,zhead+.025),(.033,.012,.022),'bone')
        S.orb(name+' dark pupil',(side*.073,.171,zhead+.025),(.013,.008,.014),'dark')
        S.cyl(name+' ivory tusk',(side*.083,.198,zhead-.091),.024,.12,'bone',5,0)
    S.orb(name+' broad nose',(0,.165,zhead-.035),(.052,.045,.058),'orc')
    if not seated:
        S.cyl(name+' guard helmet',(0,0,zhead+.165),.205,.18,'iron',10,.15)
        if spear:
            S.beam(name+' sentinel spear',(.39,.13,.06),(.39,.13,1.95),.028,'plank',5)
            S.cyl(name+' spear iron head',(.39,.13,2.07),.07,.25,'iron',4,0)
            S.box(name+' tribal shield',(-.33,.10,.95),(.24,.08,.45),'wood',.022)
            S.box(name+' shield iron spine',(-.33,.155,.95),(.055,.025,.37),'iron')
    bpy.context.view_layer.update()
    transform=Matrix.Translation((x,y,0))@Matrix.Rotation(facing,4,'Z')
    for obj in set(bpy.context.scene.objects)-before:obj.matrix_world=transform@obj.matrix_world

def small_hide_tent(name,x,y,angle=0):
    before=set(bpy.context.scene.objects)
    verts=[(-.92,-.82,.06),(.92,-.82,.06),(.92,.82,.06),(-.92,.82,.06),(0,-.82,1.28),(0,.82,1.28)]
    S.A.custom(name+' continuous hide',verts,[(0,4,5,3),(4,1,2,5),(0,1,4),(3,5,2)],S.P['hide'])
    S.A.custom(name+' dark entry',[(-.34,-.836,.06),(.34,-.836,.06),(0,-.836,.68)],[(0,1,2)],S.P['dark'])
    S.beam(name+' ridge pole',(0,-1.01,1.36),(0,1.01,1.36),.057,'bone')
    for side in [-1,1]:
        S.beam(name+' front timber',(side*.96,-.85,.03),(0,-.85,1.40),.038,'plank')
        S.beam(name+' anchor rope',(0,-.85,1.30),(side*1.30,-1.17,.04),.012,'hideedge',4)
        S.cyl(name+' ground stake',(side*1.30,-1.17,.10),.035,.21,'wood',5,0)
    bpy.context.view_layer.update()
    transform=Matrix.Translation((x,y,0))@Matrix.Rotation(angle,4,'Z')
    for obj in set(bpy.context.scene.objects)-before:obj.matrix_world=transform@obj.matrix_world

def inhabited_warcamp():
    S.fortified_warcamp()
    # Secondary lodges and hide tents spread behind and around the first stockade.
    for name,x,y in [('Rear clan lodge',-7.8,-.4),('Far western lodge',-12.0,2.8),('Northern clan lodge',-7.2,7.1)]:S.lodge(name,x,y,2.08,1.65,1.2)
    for index,(x,y,angle)in enumerate([(-5.8,-4.2,.4),(-9.9,-5.7,-.2),(-12.1,-1.9,.3),(-5.2,5.6,.3),(-10.5,6.8,-.3),(-3.2,-6.5,.6),(-11.8,-7.3,.1),(-8.8,9.8,-.4)]):small_hide_tent('Outlying clan tent '+str(index),x,y,angle)
    fire_circles=[(-6.8,2.35),(-7.3,-6.3),(-10.6,4.38)]
    for circle,(x,y)in enumerate(fire_circles):
        S.hearth(x,y)
        for person in range(3):
            angle=person*math.tau/3+.22*circle
            px=x+math.cos(angle)*.78;py=y+math.sin(angle)*.78
            facing=math.atan2(y-py,x-px)-math.pi/2
            orc_figure('Campfire companion '+str(circle)+' '+str(person),px,py,True,facing)
    # More open fires warm the guard lanes; no props encroach on the preview dais.
    S.hearth(-1.33,-4.74);S.hearth(-11.8,.7)
    for index,(x,y,facing)in enumerate([(3.82,-1.55,math.pi/2),(3.85,1.62,math.pi/2),(-4.74,-3.57,2.4),(-4.71,3.85,.7),(-13.5,-4.5,-1.5),(-11.1,8.2,0)]):orc_figure('Camp perimeter sentry '+str(index),x,y,False,facing,True)
    for x,y in [(-6.0,7.1),(-12.9,3.8),(-13.5,-6.6),(-10.6,-8.6)]:
        S.beam('Outer camp torch',(x,y,.02),(x,y,1.56),.045,'wood')
        S.cyl('Outer torch iron basket',(x,y,1.58),.13,.18,'iron',8,.16)
        S.cyl('Outer camp flame',(x,y,1.86),.13,.47,'fire',6,0)
    for x,y in [(-7.6,5.35),(-12.4,4.19),(-5.0,-5.18),(-10.0,-8.0)]:
        for i in range(3):S.cyl('Clan stacked provision barrel',(x+i*.31,y,.28),.14,.54,'plank',8)
    # Outer bone totems and low perimeter stakes mark an inhabited military village.
    for x,y in [(-13.9,4.0),(-8.5,10.9),(-2.5,-8.0)]:
        S.beam('Clan boundary totem',(x,y,.02),(x,y,2.3),.082,'wood')
        S.orb('Totem carved skull',(x,y,2.24),(.17,.19,.20),'bone')
        for side in [-1,1]:S.beam('Totem horn',(x+side*.11,y,2.24),(x+side*.31,y,2.67),.044,'bone')
    for i in range(16):
        x=-13.7+i*.59;y=-9.30+math.sin(i*.43)*.55
        S.palisade_stake('Outer rear guard line',x,y,1.2+(i%3)*.08)

if __name__=='__main__':
    S.export_scene('royal-castle-v3',castle_town,-18,view_center=(5,0,3.8),ortho_scale=36,camera_position=(-22,-31,22))
    S.export_scene('fortified-warcamp-v3',inhabited_warcamp,24,view_center=(-4.8,.5,1.3),ortho_scale=30,camera_position=(23,-29,19))
