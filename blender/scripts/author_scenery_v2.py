"""Blender 5.2 landmark designs, editable source scenes and material-batched GLBs.

Run: blender --background --python blender/scripts/author_scenery_v2.py
Coordinates are Blender Z-up; glTF export converts to the game's Y-up world.
"""
import bpy, math, sys, json
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
import author_archer as A

OUT=ROOT/'public/assets/scenery'
SCENES=ROOT/'blender/scenes'
REVIEW=ROOT/'artifacts'
for directory in (OUT,SCENES,REVIEW):directory.mkdir(parents=True,exist_ok=True)

def palette():
    values={
        'stone':('Warm dressed limestone','a8b1a0',.02,0),
        'light':('Carved pale stone','dae0c7',.02,0),
        'shade':('Weathered foundation','738276',.02,0),
        'roof':('Blue slate roof','375e75',.08,0),
        'rooflight':('Slate ridge caps','6f91a0',.15,0),
        'gold':('Aged gilded fittings','c8a86d',.7,0),
        'wood':('Dark timber beams','5b4230',0,0),
        'plank':('Warm cut timber','94734c',0,0),
        'iron':('Black forged iron','394544',.7,0),
        'dark':('Deep window recess','263c42',0,0),
        'blue':('Royal azure cloth','386f8c',0,0),
        'hide':('Red ochre hide','834c3d',0,0),
        'hideedge':('Hide seams','bb8960',0,0),
        'bone':('Weathered tusk ivory','d8ceb0',0,0),
        'soil':('Packed camp earth','776f51',0,0),
        'grass':('Moss between stones','758762',0,0),
        'fire':('Hearth flame','ffb36c',0,1.4),
        'ember':('Hearth embers','c75e31',0,.6),
    }
    return {key:A.mat(name,color,metal,glow) for key,(name,color,metal,glow) in values.items()}

P={}
def box(name,pos,size,mat='stone',bevel=0):return A.cube(name,pos,size,P[mat],bevel)
def cyl(name,pos,radius,height,mat='stone',sides=12,top=None):return A.cylinder(name,pos,radius,height,P[mat],sides,top)
def beam(name,start,end,radius=.05,mat='wood',sides=6):return A.rod(name,start,end,radius,P[mat],sides)
def orb(name,pos,size,mat='bone'):return A.ellipsoid(name,pos,size,P[mat],8,4)

def flag(name,x,y,z,mat='blue',scale=1,angle=0):
    beam(name+' pole',(x,y,z),(x,y,z+1.2*scale),.027*scale,'gold')
    vertices=[(x,y,z+1.07*scale),(x+.57*scale,y+.05*scale,z+.95*scale),
              (x+.51*scale,y+.03*scale,z+.39*scale),(x,y,z+.47*scale)]
    if angle:
        vertices=[(x+(px-x)*math.cos(angle)-(py-y)*math.sin(angle),y+(px-x)*math.sin(angle)+(py-y)*math.cos(angle),pz) for px,py,pz in vertices]
    A.custom(name+' pennant',vertices,[(0,1,2,3)],P[mat])
    cyl(name+' finial',(x,y,z+1.25*scale),.065*scale,.16*scale,'gold',6,0)

def gabled_roof(name,x,y,z,width,depth,height,mat='roof'):
    verts=[(x-width/2,y-depth/2,z),(x+width/2,y-depth/2,z),
           (x+width/2,y+depth/2,z),(x-width/2,y+depth/2,z),
           (x-width/2,y,z+height),(x+width/2,y,z+height)]
    A.custom(name,verts,[(0,1,5,4),(4,5,2,3),(0,4,3),(1,2,5),(3,2,1,0)],P[mat])
    trim='rooflight' if mat=='roof' else 'bone'
    beam(name+' carved ridge',(x-width/2-.08,y,z+height+.035),(x+width/2+.08,y,z+height+.035),.065,trim)
    for side in [-1,1]:beam(name+' eave',(x-width/2,y+side*depth/2,z),(x+width/2,y+side*depth/2,z),.045,trim)
    for offset in [-.35,0,.35]:
        yy=y+offset*depth
        zz=z+height*(1-abs(offset)*2)
        beam(name+' slate course',(x-width/2,yy,zz+.02),(x+width/2,yy,zz+.02),.017,'rooflight' if mat=='roof' else 'hideedge',4)

def arrow_window(name,x,y,z,angle=0,wide=.15,tall=.54):
    recess=box(name+' inset',(x,y,z),(wide,.055,tall),'dark');recess.rotation_euler[2]=angle
    for side in [-1,1]:
        dx=side*(wide/2+.035)*math.cos(angle);dy=side*(wide/2+.035)*math.sin(angle)
        frame=box(name+' side stone',(x+dx,y+dy,z),(.058,.085,tall+.06),'light');frame.rotation_euler[2]=angle
    cap=box(name+' lintel',(x,y,z+tall/2+.03),(wide+.14,.09,.065),'light');cap.rotation_euler[2]=angle
    sill=box(name+' sill',(x,y,z-tall/2-.04),(wide+.16,.12,.08),'shade');sill.rotation_euler[2]=angle

def castle_tower(name,x,y,height=3.6,radius=.59,spire=False):
    cyl(name+' battered footing',(x,y,.28),radius*1.23,.56,'shade',12,radius*1.08)
    cyl(name+' ashlar shaft',(x,y,height/2),radius,height,'stone',12)
    for level in [.66,1.7,height-.38]:cyl(name+' stone string course',(x,y,level),radius*1.04,.12,'light',12)
    cyl(name+' corbelled gallery',(x,y,height+.04),radius*1.19,.29,'light',12,radius*1.12)
    for i in range(8):
        angle=i*math.tau/8
        xoff=math.cos(angle)*radius*.89;yoff=math.sin(angle)*radius*.89
        merlon=box(name+' crown merlon',(x+xoff,y+yoff,height+.35),(.22,.22,.36),'stone')
        merlon.rotation_euler[2]=angle
    for i in range(4):
        angle=i*math.tau/4
        # Recess faces are broad enough to read at battlefield distance.
        wx=x+math.sin(angle)*radius*1.005;wy=y+math.cos(angle)*radius*1.005
        arrow_window(name+' loophole',wx,wy,height*.63,-angle,wide=.12,tall=.45)
    if spire:
        cyl(name+' pointed slate spire',(x,y,height+.87),radius*1.16,1.5,'roof',12,0)
        cyl(name+' spire gilding',(x,y,height+1.66),.075,.22,'gold',6,0)
    return height+.53

def curtain_wall(name,x,y,length,angle=0,height=1.75):
    wall=box(name+' parapet wall',(x,y,height/2),(length,.35,height),'stone');wall.rotation_euler[2]=angle
    for level,size,mat in [(.23,.24,'shade'),(height-.16,.12,'light')]:
        band=box(name+' masonry course',(x,y,level),(length+.04,.43,size),mat);band.rotation_euler[2]=angle
    for i in range(max(2,int(length/.47))):
        along=-length/2+.20+i*(length-.40)/max(1,int(length/.47)-1)
        merlon=box(name+' crenellation',(x+math.cos(angle)*along,y+math.sin(angle)*along,height+.17),(.24,.39,.38),'light')
        merlon.rotation_euler[2]=angle

def royal_castle():
    # Outer bailey, corner towers and a west-facing gate linked to the valley bridge.
    box('Castle stepped rock footing',(0,0,.08),(8.4,6.7,.24),'shade',.06)
    box('Castle pale cobbled courtyard',(0,0,.22),(7.9,6.2,.09),'light')
    for x in [-3.55,3.55]:
        for y in [-2.55,2.55]:castle_tower('Bailey corner tower',x,y,3.05,.62,spire=True)
    curtain_wall('North curtain',0,2.55,7.2)
    curtain_wall('South curtain',0,-2.55,7.2)
    curtain_wall('East curtain',3.55,0,5.2,math.pi/2)
    for y in [-2.0,2.0]:curtain_wall('West gate shoulder',-3.55,y,1.25,math.pi/2)
    for y in [-1.03,1.03]:castle_tower('Royal gatehouse tower',-3.44,y,3.13,.56)
    # Arched opening remains visibly dark behind narrow iron bars.
    box('Gatehouse upper chamber',(-3.45,0,2.18),(.88,1.46,.80),'stone',.025)
    box('Gatehouse window',(-3.91,0,2.35),(.03,.47,.42),'dark')
    gabled_roof('Gatehouse blue roof',-3.45,0,2.62,1.15,2.3,.62)
    box('Portcullis deep passage',(-3.88,0,.88),(.055,1.06,1.36),'dark')
    for y in [-.41,-.20,0,.20,.41]:beam('Gate vertical iron bar',(-3.94,y,.31),(-3.94,y,1.48),.026,'iron',4)
    for z in [.58,1.14]:beam('Gate iron transom',(-3.95,-.53,z),(-3.95,.53,z),.024,'iron',4)
    for i in range(9):box('Drawbridge timber plank',(-4.06-i*.17,0,.16),(.15,1.25,.11),'plank')
    for y in [-.65,.65]:beam('Drawbridge suspension chain',(-3.87,y,1.68),(-5.21,y,.25),.021,'iron',6)
    # Monumental donjon: tiered masonry and a roof framed by watch turrets.
    box('Great keep lower hall',(.68,0,1.7),(3.25,2.85,2.98),'stone',.025)
    for level in [.53,1.78,2.96]:box('Donjon carved belt course',(.68,0,level),(3.42,3.02,.13),'light')
    for x in [-.80,2.15]:
        for y in [-1.35,1.35]:
            box('Donjon projecting buttress',(x,y,1.43),(.38,.35,2.35),'shade')
            box('Donjon buttress cap',(x,y,2.66),(.44,.42,.16),'light')
    gabled_roof('Grand slate roof',.68,0,3.12,3.78,3.37,1.64)
    for x in [-.35,.67,1.67]:
        for y in [-1.45,1.45]:arrow_window('Great hall tall window',x,y,2.18,0,wide=.25,tall=.76)
    # Tall rear citadel and a side chapel give a layered castle silhouette.
    castle_tower('High royal citadel',2.33,1.8,5.48,.67,spire=True)
    flag('Citadel royal standard',2.33,1.8,7.1,'blue',.82)
    box('Chapel stone nave',(.9,-1.97,1.01),(2.13,.89,1.43),'stone')
    gabled_roof('Chapel slate roof',.9,-1.97,1.76,2.37,1.23,.73)
    for x in [.28,.91,1.53]:arrow_window('Chapel narrow window',x,-2.43,1.21,wide=.14,tall=.48)
    flag('Royal keep roof banner',.5,0,4.89,'blue',.74)
    for y in [-1.03,1.03]:flag('Gatehouse guard pennant',-3.44,y,3.67,'blue',.52)
    # A lion-like gilded crest reads as heraldry without introducing text assets.
    cyl('Royal entrance crest',(-3.98,0,2.21),.19,.035,'gold',10).rotation_euler[1]=math.pi/2
    for y in [-.083,.083]:orb('Crest raised petals',(-4.01,y,2.23),(.035,.056,.085),'light')
    # Courtyard paving, stair treads and storage make the castle inhabited.
    for x in [-2.55,-2.16,-1.77]:
        for y in [-1.57,-1.16,-.75,.75,1.16,1.57]:box('Courtyard inset paving',(x,y,.277),(.34,.33,.014),'shade')
    for i in range(5):box('Keep entrance stair',(-1.12-i*.12,0,.28+i*.075),(.19,.82,.12),'light')
    for x,y in [(2.62,-1.74),(2.94,-1.71),(-2.30,1.79)]:
        cyl('Castle supply barrel',(x,y,.50),.14,.45,'plank',10)
        for z in [.32,.66]:cyl('Barrel iron hoop',(x,y,z),.146,.045,'iron',10)

def palisade_stake(name,x,y,height=1.85):
    cyl(name+' trunk',(x,y,height/2),.095,height,'wood',6,.079)
    cyl(name+' sharpened tip',(x,y,height+.13),.11,.27,'plank',6,0)
    for z in [.35,1.27]:box(name+' lash tie',(x,y,z),(.18,.13,.065),'hideedge')

def watchtower(name,x,y):
    for dx in [-.41,.41]:
        for dy in [-.41,.41]:beam(name+' timber leg',(x+dx,y+dy,0),(x+dx*.92,y+dy*.92,2.03),.09,'wood')
    box(name+' raised deck',(x,y,1.99),(1.04,1.04,.14),'plank')
    for side in [-1,1]:
        beam(name+' crossed braces',(x-.40,y+side*.41,.55),(x+.40,y+side*.41,1.71),.056,'plank')
        beam(name+' deck guard',(x-.51,y+side*.48,2.39),(x+.51,y+side*.48,2.39),.065,'wood')
        beam(name+' roof mast',(x,y+side*.37,2.02),(x,y+side*.37,2.82),.065,'wood')
    gabled_roof(name+' hide roof',x,y,2.77,1.4,1.25,.53,'hide')
    for i in range(5):beam(name+' ladder rung',(x-.18,y-.58,.20+i*.31),(x+.18,y-.58,.20+i*.31),.035,'plank')

def lodge(name,x,y,width=1.6,depth=1.45,height=1.2):
    box(name+' timber foundation',(x,y,.15),(width,depth,.26),'wood')
    box(name+' clay and wood wall',(x,y,height*.50),(width*.89,depth*.88,height*.86),'hideedge')
    gabled_roof(name+' stitched hide roof',x,y,height,width*1.22,depth*1.17,height*.6,'hide')
    for yy in [-depth*.36,depth*.36]:beam(name+' frame upright',(x+width*.46,y+yy,.20),(x+width*.46,y+yy,height+.08),.075,'wood')
    box(name+' dark doorway',(x+width*.45+.015,y,.57),(.03,.46,.83),'dark')
    for i in range(4):beam(name+' hanging doorway fringe',(x+width*.49,y-.28+i*.185,height*.85),(x+width*.49,y-.28+i*.185,height*.60),.025,'hide',4)
    beam(name+' bone roof ridge',(x-width*.7,y,height*1.61),(x+width*.7,y,height*1.61),.066,'bone')

def hearth(x,y):
    for i in range(9):
        angle=i*math.tau/9;orb('Hearth ring stone',(x+math.cos(angle)*.29,y+math.sin(angle)*.29,.13),(.11,.095,.09),'shade')
    for angle in [0,math.pi/3,-math.pi/3]:beam('Hearth split logs',(x-.26*math.cos(angle),y-.26*math.sin(angle),.16),(x+.26*math.cos(angle),y+.26*math.sin(angle),.16),.064,'wood')
    for i in range(4):
        angle=i*2.2;cyl('Golden hearth flame',(x+math.cos(angle)*.11,y+math.sin(angle)*.11,.31),.10,.44+i*.037,'fire',6,0)

def fortified_warcamp():
    # Irregular earth pad and a complete palisade enclose a small fortified settlement.
    cyl('Warcamp packed earth',(0,0,-.06),4.55,.10,'soil',18)
    box('Warcamp interior gravel',(0,0,.005),(7.8,6.5,.02),'soil')
    for x in [-4.12,4.12]:
        for i in range(23):
            y=-3.48+i*.316
            if x>0 and abs(y)<1.24:continue
            palisade_stake('East palisade' if x>0 else 'West palisade',x,y,1.70+(i%4)*.065)
    for y in [-3.49,3.49]:
        for i in range(26):palisade_stake('Long palisade',-4.12+i*.329,y,1.72+(i%5)*.04)
        for z in [.53,1.18]:beam('Palisade horizontal tie',(-4.12,y-.04,z),(4.12,y-.04,z),.065,'plank')
    for z in [.53,1.18]:
        beam('West palisade horizontal tie',(-4.16,-3.48,z),(-4.16,3.48,z),.065,'plank')
        for side in [-1,1]:beam('East palisade horizontal tie',(4.16,side*1.24,z),(4.16,side*3.48,z),.065,'plank')
    for x,y in [(-3.35,-2.77),(-3.35,2.77),(3.35,-2.77),(3.35,2.77)]:watchtower('Corner timber watchtower',x,y)
    # Open gate frames the upcoming invader's presentation dais, behind the wall.
    for y in [-1.3,1.3]:
        beam('Great gate timber upright',(4.12,y,.02),(4.12,y,2.67),.16,'wood',8)
        cyl('Gate tusk crown',(4.12,y,2.97),.17,.60,'bone',7,0)
        flag('Gate clan pennant',4.08,y,2.83,'hide',.54,angle=math.pi/2)
    beam('Great gate crossbeam',(4.12,-1.45,2.52),(4.12,1.45,2.52),.13,'wood',8)
    for side in [-1,1]:beam('Gate leaning tusk',(4.12,side*1.21,1.40),(4.12,side*.92,2.10),.071,'bone',7)
    lodge('Warlord great hall',-1.47,.23,2.53,2.22,1.52)
    for name,x,y in [('Northern hut',.12,2.18),('Southern hide lodge',-.03,-2.09),('Western supply lodge',-2.58,-1.75)]:lodge(name,x,y,1.38,1.23,1.0)
    # A clear, elevated space for exactly one next-wave figure.
    cyl('Invader preview carved dais',(2.25,0,.24),.86,.48,'shade',12,.79)
    cyl('Invader preview pale rim',(2.25,0,.515),.82,.10,'bone',12,.77)
    cyl('Invader preview earth inset',(2.25,0,.573),.74,.02,'soil',12)
    for i in range(12):
        angle=i*math.tau/12
        mark=box('Preview dais carved rune',(2.25+math.cos(angle)*.79,math.sin(angle)*.79,.486),(.035,.07,.055),'iron');mark.rotation_euler[2]=angle
    # Forge, supplies, weapon racks and a cart make the settlement feel occupied.
    hearth(.65,.97)
    box('Blacksmith stone base',(1.38,1.85,.29),(.62,.51,.57),'shade',.025)
    box('Blacksmith iron anvil',(1.38,1.85,.65),(.70,.31,.17),'iron',.035)
    for x,y in [(.73,-1.57),(1.06,-1.60),(-1.66,2.17),(-1.99,2.14)]:
        cyl('Clan supply barrel',(x,y,.34),.19,.65,'plank',10)
        for z in [.14,.49]:cyl('Barrel leather hoop',(x,y,z),.199,.06,'wood',10)
    for i in range(3):
        box('Stacked supply crate',(.43+i*.42,-1.35,.18),(.37,.41,.35),'plank')
        box('Crate forged corner',(.43+i*.42,-1.56,.20),(.05,.032,.31),'iron')
    for x in [-.84,.43]:beam('Weapon rack upright',(x,1.52,.09),(x,1.52,1.14),.055,'wood')
    beam('Weapon rack crossbar',(-.84,1.52,1.01),(.43,1.52,1.01),.045,'plank')
    for i in range(4):
        x=-.69+i*.30;beam('Racked spear shaft',(x,1.50,.17),(x,1.50,1.58),.022,'plank',5)
        cyl('Racked spear point',(x,1.50,1.69),.068,.24,'iron',4,0)
    flag('Warlord great hall standard',-1.47,.23,2.61,'hide',.85,angle=math.pi/2)
    for x,y in [(3.58,-1.31),(3.58,1.31),(-2.6,1.31)]:
        beam('Watch torch pole',(x,y,.01),(x,y,1.49),.042,'wood')
        cyl('Torch iron bowl',(x,y,1.50),.095,.16,'iron',8,.13)
        cyl('Watch torch flame',(x,y,1.73),.115,.37,'fire',7,0)

def export_scene(name,build,camera_x):
    global P
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    P=palette();build();objects=[obj for obj in bpy.context.scene.objects if obj.type=='MESH']
    triangles=sum(sum(max(0,len(poly.vertices)-2) for poly in obj.data.polygons) for obj in objects)
    # Sources keep every named building part. Only temporary export copies are batched.
    copies=[]
    for material in P.values():
        pieces=[]
        for source in objects:
            if not source.data.materials or source.data.materials[0]!=material:continue
            obj=source.copy();obj.data=source.data.copy();bpy.context.collection.objects.link(obj);pieces.append(obj)
        if not pieces:continue
        bpy.ops.object.select_all(action='DESELECT')
        for obj in pieces:obj.select_set(True)
        bpy.context.view_layer.objects.active=pieces[0]
        if len(pieces)>1:bpy.ops.object.join()
        pieces[0].name=name+' '+material.name;copies.append(pieces[0])
    bpy.ops.object.select_all(action='DESELECT')
    for obj in copies:obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False)
    for obj in copies:bpy.data.objects.remove(obj,do_unlink=True)
    cam=A.configure_scene();cam.location=(camera_x,-15,11.5)
    target=Vector((0,0,3.0 if name=='royal-castle-v2' else 1.15))
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.ortho_scale=15.5 if name=='royal-castle-v2' else 13.5
    for obj in bpy.context.scene.objects:
        if obj.type=='LIGHT':
            obj.location*=3;obj.data.energy*=8;obj.data.size*=3
            obj.rotation_euler=(target-obj.location).to_track_quat('-Z','Y').to_euler()
    scene=bpy.context.scene;scene.cycles.samples=24;scene.render.resolution_x=900;scene.render.resolution_y=760
    scene['Authoring']='Blender 5.2';scene['Scenery design']='V2 layered fortification';scene['Triangle count']=triangles
    if name=='fortified-warcamp-v2':scene['Upcoming invader anchor']='Game Y-up local (2.25, 0.595, 0); native Blender (2.25, 0, 0.595)'
    bpy.ops.wm.save_as_mainfile(filepath=str(SCENES/(name+'.blend')))
    scene.render.filepath=str(REVIEW/(name+'-review.png'));bpy.ops.render.render(write_still=True)
    print(json.dumps({'file':name+'.glb','triangles':triangles,'meshes':len(copies),'authoring':'Blender 5.2','source':name+'.blend'}))

if __name__=='__main__':
    export_scene('royal-castle-v2',royal_castle,-11)
    export_scene('fortified-warcamp-v2',fortified_warcamp,12)
