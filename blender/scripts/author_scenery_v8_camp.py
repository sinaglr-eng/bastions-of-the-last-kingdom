"""Native V8 camp: preserve V6 territory; fit tents around real walk lanes.

Run with official Blender 5.2 --background --python this_file. No historical
scene, source image or castle asset is changed. Named source parts remain editable.
"""
import bpy, math, sys, json
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
import author_scenery_v6 as V6
V5,V4,S=V6.V5,V6.V4,V6.S
CONFIG=json.loads((S.ROOT/'data/scenery-v8-camp.json').read_text(encoding='utf-8'))
LANES=[(a,b) for lane in CONFIG['lanes'] for a,b in zip(lane,lane[1:])]

def point_segment(p,a,b):
    dx,dy=b[0]-a[0],b[1]-a[1];t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)))
    return math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t)

def rectangle_lane(bounds,a,b):
    lo,hi,bottom,top=bounds
    # Slab intersection tests the full road centreline, not just its endpoints.
    enter,leave=0,1
    for start,end,mn,mx in [(a[0],b[0],lo,hi),(a[1],b[1],bottom,top)]:
        if abs(end-start)<1e-12:
            if not mn<=start<=mx:enter,leave=1,0;break
        else:
            t1,t2=sorted(((mn-start)/(end-start),(mx-start)/(end-start)));enter=max(enter,t1);leave=min(leave,t2)
    if enter<=leave:return 0
    corners=[(lo,bottom),(lo,top),(hi,bottom),(hi,top)]
    return min([point_segment(p,a,b) for p in corners]+[
      math.hypot(max(lo-p[0],0,p[0]-hi),max(bottom-p[1],0,p[1]-top)) for p in [a,b]])

def lane_clearance(bounds):return min(rectangle_lane(bounds,a,b) for a,b in LANES)-CONFIG['laneWidth']/2
def overlap(a,b,margin=.13):return a[0]<b[1]+margin and a[1]>b[0]-margin and a[2]<b[3]+margin and a[3]>b[2]-margin
def bounds(parts):return V5.mesh_bounds(parts)
def permitted(box,obstacles):
    lo,hi,bottom,top=box
    return lane_clearance(box)>=CONFIG['laneMargin'] and all(V6.inside(p,V6.LAYOUT['clanPalisade']['polygon']) for p in [(lo,bottom),(lo,top),(hi,bottom),(hi,top)]) and not any(overlap(box,b) for b in obstacles)

def fitted_offset(box,obstacles):
    if permitted(box,obstacles):return 0,0
    for ring in range(1,41):
        candidates=[]
        for ix in range(-ring,ring+1):
            for iy in range(-ring,ring+1):
                if max(abs(ix),abs(iy))!=ring:continue
                dx,dy=ix*.25,iy*.25;proposed=(box[0]+dx,box[1]+dx,box[2]+dy,box[3]+dy)
                if permitted(proposed,obstacles):candidates.append((dx*dx+dy*dy,dx,dy))
        if candidates:return min(candidates)[1:]
    raise ValueError('No clear nearby camp shoulder for '+str(box))

def record(name,role,position,parts,**extra):
    b=bounds(parts);marker=V4.marker(name,role,position,cosmeticOnly=True,gameplayEffect='none',**extra)
    for key,value in zip(['localMinX','localMaxX','localMinY','localMaxY'],b):marker[key]=value
    marker['laneClearance']=lane_clearance(b)
    return marker,b

def canvas_roof(name,x,y,z,width,depth,height):
    vertices=[(x-width/2,y-depth/2,z),(x+width/2,y-depth/2,z),(x+width/2,y+depth/2,z),(x-width/2,y+depth/2,z),(x-width/2,y,z+height),(x+width/2,y,z+height)]
    S.A.custom(name,vertices,[(0,1,5,4),(4,5,2,3),(0,4,3),(1,2,5),(3,2,1,0)],S.P['v8Canvas'])
    for yy in [y-depth/2,y+depth/2]:S.beam(name+' timber eave',(x-width/2,yy,z),(x+width/2,yy,z),.045,'v8Wood',6)
    S.beam(name+' weathered ridge',(x-width/2-.05,y,z+height),(x+width/2+.05,y,z+height),.055,'v8Wood',6)

def firewood(name,x,y):
    for side in [-1,1]:
        S.beam(name+' raised trestle',(x+side*.72,y-.46,.08),(x+side*.72,y+.46,.08),.065,'v8Wood',6)
        S.beam(name+' stack upright',(x+side*.72,y-.35,.08),(x+side*.72,y-.35,.91),.051,'v8Wood',6)
    for row in range(4):
        for column in range(5-row%2):
            xx=x+(column-(4-row%2)/2)*.29;zz=.20+row*.23
            S.beam(name+' split oak log',(xx,y-.41,zz),(xx,y+.39,zz),.122,'v8Wood',7)
            for yy in [y-.418,y+.40]:
                end=S.cyl(name+' visible pale cut end',(xx,yy,zz),.105,.018,'v8Cut',7);end.rotation_euler[0]=math.pi/2
    canvas_roof(name+' weather shelter',x,y,1.14,1.95,1.23,.29)

def armory(name,x,y):
    for side in [-1,1]:
        S.beam(name+' rack leg',(x+side*.79,y-.3,.02),(x+side*.79,y+.25,.02),.078,'v8Wood',6)
        S.beam(name+' oak upright',(x+side*.79,y,.06),(x+side*.79,y,1.65),.061,'v8Wood',6)
    for z in [.45,1.23]:S.beam(name+' rack crossbar',(x-.87,y,z),(x+.87,y,z),.053,'v8Wood',6)
    for i in range(5):
        xx=x-.61+i*.29
        S.beam(name+' spear shaft',(xx,y-.055,.12),(xx,y-.055,1.80),.023,'v8Cut',6)
        S.cyl(name+' spear steel point',(xx,y-.055,1.94),.069,.28,'v8Iron',4,0)
    for side in [-1,1]:
        S.box(name+' resting shield',(x+side*.63,y-.19,.62),(.45,.095,.67),'v8Wood',.028)
        S.orb(name+' shield boss',(x+side*.63,y-.26,.62),(.08,.035,.08),'v8Iron')
    canvas_roof(name+' stores awning',x,y,2.15,2.1,1.14,.35)

def camp_tree(name,x,y,index):
    h=2.8+(index%3)*.28
    S.beam(name+' tapered trunk',(x,y,.02),(x,y,h*.76),.085,'v8Wood',7)
    if index%3==0:
        for row in range(3):S.cyl(name+' layered fir crown',(x+.03*math.sin(row),y,h*(.47+row*.19)),h*(.26-row*.055),h*.42,'v8Pine',8,0)
    else:
        for dx,dy,z,sx,sy,sz in [(-.3,.06,.69,.65,.60,.57),(.34,-.12,.82,.69,.63,.61),(.02,.04,.98,.64,.63,.65)]:
            S.beam(name+' spreading oak branch',(x,y,h*.46),(x+dx,y+dy,h*z),.028,'v8Wood',5)
            S.orb(name+' loose oak crown',(x+dx,y+dy,h*z),(sx,sy,sz),'v8Leaf' if index%2 else 'v8LeafLight')

def supply_cart(name,x,y):
    S.box(name+' plank bed',(x,y,.42),(1.4,.78,.13),'v8Cut')
    for yy in [y-.41,y+.41]:
        S.box(name+' timber sideboard',(x,yy,.62),(1.43,.07,.43),'v8Wood')
        wheel=S.cyl(name+' iron bound wheel',(x-.20,yy,.29),.31,.12,'v8Iron',10);wheel.rotation_euler[0]=math.pi/2
    for side in [-1,1]:S.beam(name+' forward pull shaft',(x+.63,y+side*.25,.40),(x+1.56,y+side*.27,.29),.039,'v8Wood',6)
    for i in range(3):S.box(name+' strapped provision crate',(x-.41+i*.38,y,.79),(.33,.60,.54),'v8Canvas',.015)

def warcamp_v8():
    bpy.ops.wm.open_mainfile(filepath=str(S.SCENES/CONFIG['inherits']))
    V5.remove(o for o in bpy.context.scene.objects if o.get('sceneryRole')=='manifest')
    for key,label,color in [('v8Wood','V8 camp weathered oak','65503a'),('v8Cut','V8 camp fresh cut timber','bf9967'),('v8Canvas','V8 camp storage canvas','977653'),('v8Iron','V8 camp tempered iron','687376'),('v8Pine','V8 camp deep fir','315647'),('v8Leaf','V8 camp leafy oak','65894f'),('v8LeafLight','V8 camp pale oak','80a15d')]:S.P[key]=S.A.mat(label,color)
    tent_groups=[]
    for prefix,count in [('Outlying clan tent ',8),('Clan hide pavilion ',14)]:
        for i in range(count):
            name=prefix+str(i);parts=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith(name+' ')]
            if not parts:raise ValueError('Missing inherited tent '+name)
            tent_groups.append((name,parts))
    # Existing roofs/pens/caves and the full stockade remain fixed. Preserve
    # source tent ropes too; a nominal centre-point clearance would miss them.
    tent_parts={o for name,parts in tent_groups for o in parts}
    obstacles=[bounds(parts) for prefix in ['Rear clan lodge','Far western lodge','Northern clan lodge','Warlord great hall','Northern hut','Southern hide lodge','Western supply lodge'] if (parts:=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith(prefix+' ')])]
    for o in bpy.context.scene.objects:
        if o.get('sceneryRole') in ['wolfPen','wolfCage']:obstacles.append((o.location.x-o['width']/2,o.location.x+o['width']/2,o.location.y-o['depth']/2,o.location.y+o['depth']/2))
    for name,parts in tent_groups:
        b=bounds(parts);other=[bounds(p) for n,p in tent_groups if n!=name];dx,dy=fitted_offset(b,obstacles+other)
        for o in parts:o.location.x+=dx;o.location.y+=dy
        # Existing V4 pavilion marker follows the actual moved source assembly.
        if name.startswith('Clan hide pavilion '):
            old=bpy.context.scene.objects.get(name.replace('Clan hide pavilion ','Clan pavilion '));old.location.x+=dx;old.location.y+=dy
        b=bounds(parts);record(name+' clear walkway','campTent',(sum(b[:2])/2,sum(b[2:])/2,0),parts,movedX=dx,movedY=dy)
    obstacles += [bounds(parts) for _,parts in tent_groups]
    for index,(a,b) in enumerate(LANES):
        V4.marker('Camp walk lane '+str(index),'campWalkLane',(a[0],a[1],0),aX=a[0],aY=a[1],bX=b[0],bY=b[1],width=CONFIG['laneWidth'])
    placements=[('Covered split-log stack '+str(i),'campFirewood',p,firewood)for i,p in enumerate(CONFIG['firewood'])]+[('Clan weapons store '+str(i),'campArmory',p,armory)for i,p in enumerate(CONFIG['armories'])]+[('Quartermaster supply cart','campSupplyCart',CONFIG['supplyCart'],supply_cart)]+[('Inner camp tree '+str(i),'campTree',p,lambda name,x,y,i=i:camp_tree(name,x,y,i))for i,p in enumerate(CONFIG['trees'])]
    for name,role,(x,y),builder in placements:
        before=set(bpy.context.scene.objects);builder(name,x,y);parts=[o for o in set(bpy.context.scene.objects)-before if o.type=='MESH'];b=bounds(parts);dx,dy=fitted_offset(b,obstacles)
        for o in parts:o.location.x+=dx;o.location.y+=dy
        _,b=record(name,role,(x+dx,y+dy,0),parts);obstacles.append(b)
    bpy.context.scene['V8 inherited source']=CONFIG['inherits'];bpy.context.scene['Camp walkways']='Full tent ropes and added structures clear all preserved walk lanes by at least 0.22m'

if __name__=='__main__':
    entry=V6.export_v6('fortified-warcamp-v8',warcamp_v8,(-12,1,2.1),73,(41,-52,43))
    entry.update(style='scenery-v8',inherits=CONFIG['inherits'],gameplayEffect='none',layout='scenery-v8-camp.json')
    path=S.OUT/'manifest.json';previous=json.loads(path.read_text()) if path.exists() else []
    path.write_text(json.dumps([item for item in previous if item['file']!=entry['file']]+[entry],indent=2)+'\n',encoding='utf-8')
