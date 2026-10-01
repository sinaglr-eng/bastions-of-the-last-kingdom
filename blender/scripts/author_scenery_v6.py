"""Blender 5.2 V6: complete frontier walls, spacious grazing and mixed woodland.

The V5 native scenes remain intact. Run tools/author-scenery-layout-v6.mjs
before this authoring script; all footprint checks use the runtime rivers.
"""
import bpy, math, sys, json, random
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
import author_scenery_v5 as V5
V4=V5.V4
S=V5.S
LAYOUT=json.loads((S.OUT/'layout-v6.json').read_text(encoding='utf-8'))
V5.LAYOUT=LAYOUT
V5.STREAM=LAYOUT['townStream']
BASE_PALETTE=S.palette

def palette():
    p=BASE_PALETTE()
    for key,name,color in [
        ('birch','Silver birch bark','c0c5a9'),('birchLeaf','Soft meadow birch leaves','8caa6b'),
        ('oakLeaf','Broad oak foliage','63844e'),('firLeaf','Deep fir needles','315848'),
        ('pasture','Soft grazing meadow','879166'),('pastureLight','Grazed meadow patches','a4aa78')
    ]:p[key]=S.A.mat(name,color)
    return p
S.palette=palette

def inside(p,polygon):
    x,y=p;hit=False
    for a,b in zip(polygon,polygon[1:]+polygon[:1]):
        if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:hit=not hit
    return hit

def edge_distance(p,a,b):
    dx,dy=b[0]-a[0],b[1]-a[1]
    t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)))
    return math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)

def polygon_area(polygon):
    return abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(polygon,polygon[1:]+polygon[:1])))/2

def main_water_clearance(bounds):
    lo,hi,bottom,top=bounds
    return min(math.hypot(max(lo-(x-38),0,(x-38)-hi),max(bottom-(14-z),0,(14-z)-top)) for x,h,z in LAYOUT['mainRiver']['samples'])-LAYOUT['mainRiver']['waterWidth']/2

def dry_ground(bounds,margin=.25):
    return min(main_water_clearance(bounds),V5.water_clearance(bounds))>=margin

def main_river_review():
    if any(o.name=='V6 main river water review' for o in bpy.context.scene.objects):return
    for width,offset,mat,name in [(5.5,-.095,'bank','V6 main river bank review'),(4.1,-.025,'blue','V6 main river water review')]:
        vertices=[];faces=[];points=LAYOUT['mainRiver']['samples']
        for i,(wx,h,wz) in enumerate(points):
            a=points[max(0,i-1)];b=points[min(len(points)-1,i+1)]
            tangent=Vector((b[0]-a[0],-(b[2]-a[2]),0)).normalized();normal=Vector((-tangent.y,tangent.x,0))*width/2
            p=Vector((wx-38,14-wz,h+offset));vertices.extend([tuple(p+normal),tuple(p-normal)])
            if i:faces.append((i*2-2,i*2-1,i*2+1,i*2))
        obj=S.A.custom(name,vertices,faces,S.P[mat]);obj['reviewOnly']=True

def natural_tree(name,x,y,height,species,heading,role):
    radius=height*.26 if species in ['pine','fir'] else 1.20
    wx,wz=(x-25,-14-y) if role=='palisadeForest' else (x+38,14-y)
    if wx-radius<18.5 and wx+radius>-18.5 and wz-radius<18.5 and wz+radius>-18.5:return False
    before=set(bpy.context.scene.objects)
    S.cyl(name+' tapered trunk',(0,0,height*.39),.075 if species=='birch' else .105,height*.78,'birch' if species=='birch' else 'wood',7,.046)
    if species in ['pine','fir']:
        for i in range(3):
            crown=S.cyl(name+' irregular needle tier',(math.sin(i*2.43)*height*.018,math.cos(i*2.83)*height*.014,height*(.44+i*.20)),height*(.25-i*.052),height*(.43-i*.025),'firLeaf' if species=='fir' else 'pineLight' if i==2 else 'pine',7 if species=='pine' else 9,0)
            crown.rotation_euler[2]=i*.73
    else:
        for i,(dx,dy,z,sx,sy,sz) in enumerate([(-.35,.06,.70,.73,.62,.60),(.40,-.12,.81,.75,.72,.67),(.02,.04,.98,.72,.67,.70)]):
            S.beam(name+' spreading limb',(0,0,height*.47),(dx,dy,height*z),.032,'birch' if species=='birch' else 'wood',5)
            S.orb(name+' loose broad crown',(dx,dy,height*z),(sx,sy,sz),'birchLeaf' if species=='birch' else 'oakLeaf')
    V4.transform_new(before,(x,y,0),heading)
    V4.marker(name,role,(x,y,0),species=species,height=height,heading=heading,canopyRadius=radius,naturalScatter=True)
    return True

def complete_western_defenses():
    wall=LAYOUT['royalWesternWall'];x=wall['x'];gap=wall['gateHalfWidth'];north=wall['northY'];south=wall['southY'];deck=wall['walkwayHeight'];bank=wall['riverBankEnd']
    segments=[((x,gap),(x,north)),((x,south),(x,-gap)),((x,8.5),(-6.9,8.5)),((-6.9,8.5),(-6.9,6.1)),((-6.9,-6.1),(-6.9,south)),((-6.9,south),(x,south)),((x,south),bank)]
    for i,(a,b) in enumerate(segments):
        name='Western royal curtain '+str(i);before=set(bpy.context.scene.objects)
        V5.wall_segment(name,a,b,2.15,deck)
        parts=[o for o in set(bpy.context.scene.objects)-before if o.type=='MESH']
        bounds=V5.mesh_bounds(parts)
        if not dry_ground(bounds,.12):raise ValueError('Royal wall enters the river: '+name)
        marker=next(o for o in set(bpy.context.scene.objects)-before if o.get('sceneryRole')=='royalWallSegment')
        V5.store_footprint(marker,bounds);marker['mainRiverClearance']=main_water_clearance(bounds)
    for name,px,py in [('Northern frontier watchtower',x,north),('Southern river bank watchtower',bank[0],bank[1])]:
        before=set(bpy.context.scene.objects);S.castle_tower(name,px,py,3.25,.61)
        bounds=V5.mesh_bounds([o for o in set(bpy.context.scene.objects)-before if o.type=='MESH'])
        if not dry_ground(bounds,.10):raise ValueError('Frontier tower enters water: '+name)
        marker=V4.marker(name,'frontierTower',(px,py,0));V5.store_footprint(marker,bounds);marker['mainRiverClearance']=main_water_clearance(bounds)
        V5.wall_defender(name+' archer',px,py,3.36,True,math.pi/2)
    for y in [-2.10,2.10]:S.castle_tower('Western royal gate guard tower',x,y,3.38,.56)
    S.box('Western gate upper sentry chamber',(x,0,3.25),(.95,3.4,.86),'stone')
    S.gabled_roof('Western gate slate ridge',x,0,3.69,1.25,3.65,.83)
    V4.marker('Open western royal gate','royalGate',(x,0,0),width=gap*2,corridor='Existing valley bridge')
    guard_y=[-7.4,-5.5,-3.4,3.4,5.6,8.8,15.7,24.6,34.1,43.9]
    for i,y in enumerate(guard_y):V5.wall_defender('Western parapet defender '+str(i),x+.32,y,deck,i%3!=1,math.pi/2)
    for i,(a,b) in enumerate(segments[-1:]):V5.wall_defender('Southern bank parapet soldier '+str(i),(a[0]+b[0])*.5,(a[1]+b[1])*.5+.28,deck,False,math.pi)
    for x,y in [(-5.4,5.76),(-.3,5.76),(-4.5,-5.76),(3.2,-5.76)]:
        S.box('Existing palace wall inner walkway',(x,y,1.53),(1.20,.64,.16),'shade')
        V5.wall_defender('Palace terrace archer '+str(x)+' '+str(y),x,y,1.61,True,0 if y>0 else math.pi)

def spacious_pastures():
    V5.remove(o for o in bpy.context.scene.objects if o.name.startswith(('Sheep pasture','Cattle pasture','Pasture sheep','Pasture cow','Pasture water trough')))
    for plot in LAYOUT['pastures']:
        name=plot['name'];cx,cy=plot['x'],plot['y'];w,d=plot['width'],plot['depth'];polygon=[[cx+x,cy+y]for x,y in plot['polygon']]
        bounds=(cx-w/2-.06,cx+w/2+.06,cy-d/2-.06,cy+d/2+.06)
        if not dry_ground(bounds,.25):raise ValueError('Enlarged pasture reaches water: '+name)
        floor=[(x,y,.01)for x,y in polygon]
        S.A.custom(name+' irregular grazing ground',floor,[tuple(range(len(floor)))],S.P['pasture'])
        for a,b in zip(polygon,polygon[1:]+polygon[:1]):
            length=math.dist(a,b);n=max(1,math.ceil(length/.85))
            for i in range(n):
                x=a[0]+(b[0]-a[0])*i/n;y=a[1]+(b[1]-a[1])*i/n
                S.beam(name+' irregular fencepost',(x,y,.015),(x,y,.80),.044,'wood',6)
            for z in [.33,.64]:S.beam(name+' grazing boundary rail',(a[0],a[1],z),(b[0],b[1],z),.036,'plank',6)
        marker=V4.marker(name,'animalPen',(cx,cy,0),width=w,depth=d,area=polygon_area(polygon),polygon=json.dumps(polygon),animal=plot['animal'],naturalScatter=True)
        V5.store_footprint(marker,bounds);marker['mainRiverClearance']=main_water_clearance(bounds)
        rng=random.Random(plot['seed']);positions=[]
        for attempt in range(10000):
            if len(positions)==plot['count']:break
            x=cx+(rng.random()-.5)*(w-2.3);y=cy+(rng.random()-.5)*(d-2.3)
            if not inside((x,y),polygon) or min(edge_distance((x,y),a,b)for a,b in zip(polygon,polygon[1:]+polygon[:1]))<1.05:continue
            if any(math.hypot(x-px,y-py)<plot['minimumSpacing']for px,py in positions):continue
            positions.append((x,y));heading=rng.uniform(0,math.tau)
            animal_name='Grazing '+plot['animal']+' '+str(len(positions)-1)
            if plot['animal']=='cow':
                V4.cow(animal_name,x,y,heading);animal=next(o for o in bpy.context.scene.objects if o.name==animal_name)
            else:
                before=set(bpy.context.scene.objects);V4.V3.sheep(0,0)
                for o in set(bpy.context.scene.objects)-before:o.name=animal_name+' '+o.name
                V4.transform_new(before,(x,y,0),heading);animal=V4.marker(animal_name,'sheep',(x,y,0))
            animal['heading']=heading;animal['minimumSpacing']=plot['minimumSpacing'];animal['pasture']=name;animal['naturalScatter']=True
        if len(positions)!=plot['count']:raise ValueError('Pasture scatter cannot fit all animals')
        for i in range(12):
            x=cx+(rng.random()-.5)*(w-1.1);y=cy+(rng.random()-.5)*(d-1.1)
            if not inside((x,y),polygon):continue
            S.cyl(name+' grazed grass patch',(x,y,.025),.22+rng.random()*.32,.016,'pastureLight',7)
        S.box(name+' long watering trough',(cx-w*.31,cy+d*.30,.19),(.95,.34,.34),'wood')
        S.box(name+' trough water',(cx-w*.31,cy+d*.30,.365),(.85,.26,.021),'blue')

def royal_woodland():
    footprints=[(o['worldMinX']-38,o['worldMaxX']-38,14-o['worldMaxZ'],14-o['worldMinZ'])for o in bpy.context.scene.objects if o.get('sceneryRole')in ['townBuilding','buildingFootprint','farmPlot','animalPen','street']]
    footprints.append((18.6,26.2,17.4,26.3)) # Working quarry faces and crane access.
    rng=random.Random(6439);positions=[];species=['pine','birch','fir','oak']
    for attempt in range(4500):
        if len(positions)>=88:break
        x=-8+rng.random()*46;y=-26+rng.random()*73
        if -9.2<x<9.2 and -7.1<y<7.1:continue
        if any(lo-1.35<x<hi+1.35 and bottom-1.35<y<top+1.35 for lo,hi,bottom,top in footprints):continue
        if not dry_ground((x-1.2,x+1.2,y-1.2,y+1.2),.6):continue
        if any(math.hypot(x-px,y-py)<2.05 for px,py in positions):continue
        height=2.5+rng.random()*1.35;kind=species[len(positions)%4];heading=rng.uniform(0,math.tau)
        if natural_tree('Royal open-ground woodland '+str(len(positions)),x,y,height,kind,heading,'settlementTree'):
            positions.append((x,y))
            if len(positions)%6==0:V5.rock('Royal woodland stone '+str(len(positions)),x+.88,y-.51,.48+rng.random()*.35)

def dry_residents():
    houses=[(o['worldMinX']-38,o['worldMaxX']-38,14-o['worldMaxZ'],14-o['worldMinZ'])for o in bpy.context.scene.objects if o.get('sceneryRole')in ['townBuilding','buildingFootprint']]
    for resident in [o for o in bpy.context.scene.objects if o.get('sceneryRole')=='resident']:
        parts=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith(resident.name+' ')]
        bounds=V5.mesh_bounds(parts)
        if dry_ground(bounds,.06):continue
        candidates=[]
        for ring in range(1,16):
            for ix in range(-ring,ring+1):
                for iy in range(-ring,ring+1):
                    if max(abs(ix),abs(iy))!=ring:continue
                    dx,dy=ix*.3,iy*.3;proposed=(bounds[0]+dx,bounds[1]+dx,bounds[2]+dy,bounds[3]+dy)
                    if not dry_ground(proposed,.13):continue
                    if any(proposed[0]<b and proposed[1]>a and proposed[2]<d and proposed[3]>c for a,b,c,d in houses):continue
                    candidates.append((dx*dx+dy*dy,dx,dy));
            if candidates:break
        if not candidates:raise ValueError('Resident has no dry walkway: '+resident.name)
        _,dx,dy=min(candidates)
        for obj in parts+[resident]:obj.location.x+=dx;obj.location.y+=dy
        resident['V6DryWalkway']=True

def royal_town_v6():
    V4.inhabited_royal_town()
    V5.remove(o for o in bpy.context.scene.objects if o.get('reviewOnly') or o.name.startswith('Town orchard '))
    barn=next(o for o in bpy.context.scene.objects if o.name=='Shepherd long barn')
    dx,dy=5.5-barn.location.x,-16.6-barn.location.y
    for obj in [barn]+[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith(barn.name+' ')]:obj.location.x+=dx;obj.location.y+=dy
    barn['V6PastureRelocation']=True
    V5.dry_buildings();V5.accessible_streets();V5.expanded_farms()
    complete_western_defenses();spacious_pastures();V5.stream_source_and_review();main_river_review();dry_residents();royal_woodland()

def natural_clan_forest():
    polygon=LAYOUT['clanPalisade']['polygon'];config=LAYOUT['clanPalisade'];rng=random.Random(config['forestSeed']);positions=[]
    minx,maxx=min(p[0]for p in polygon)-9,max(p[0]for p in polygon)+9
    miny,maxy=min(p[1]for p in polygon)-9,max(p[1]for p in polygon)+9
    species=['pine','fir','birch','oak']
    for attempt in range(35000):
        if len(positions)>=195:break
        x=rng.uniform(minx,maxx);y=rng.uniform(miny,maxy)
        if inside((x,y),polygon):continue
        distance=min(edge_distance((x,y),a,b)for a,b in zip(polygon,polygon[1:]+polygon[:1]))
        if not 1.2<distance<config['forestDepth']:continue
        # A broad bare approach through the gate stays visible from the board.
        if x>config['gateX']-1 and abs(y)<4.2:continue
        if any(math.hypot(x-px,y-py)<config['forestMinimumSpacing']for px,py in positions):continue
        # Clusters follow irregular patches; density thins outward, never rows.
        patch=.65+.22*math.sin(x*.33+y*.17)+.12*math.cos(y*.51-x*.11)
        if rng.random()>patch*(1-.035*distance):continue
        height=2.6+rng.random()*1.55;kind=species[(len(positions)+int(rng.random()*4))%4]
        if natural_tree('Stockade mixed woodland '+str(len(positions)),x,y,height,kind,rng.uniform(0,math.tau),'palisadeForest'):
            positions.append((x,y))
            if len(positions)%8==0:V5.rock('Mixed woodland scattered stone '+str(len(positions)),x+.55,y-.35,.54+rng.random()*.34,0,'clanEdgeRock')
    if len(positions)<175:raise ValueError('Incomplete natural stockade woodland')

def warcamp_v6():
    V5.build_orc_territory(S)
    # Preserve the continuous stockade geometry while replacing its row trees.
    old_tree=V5.tree;V5.tree=lambda *args,**kwargs:False
    try:V5.clan_perimeter()
    finally:V5.tree=old_tree
    natural_clan_forest()

def export_v6(name,build,view_center,ortho,camera_position):
    V4.export_v4(name,build,view_center,ortho,camera_position)
    from shutil import copyfile
    render_dir=S.ROOT/'blender/renders';render_dir.mkdir(parents=True,exist_ok=True)
    copyfile(S.REVIEW/(name+'-review.png'),render_dir/(name+'-review.png'))
    manifest=next(o for o in bpy.context.scene.objects if o.get('sceneryRole')=='manifest')
    return dict(file=name+'.glb',source=name+'.blend',style='scenery-v6',authoring='Blender 5.2',triangles=manifest['triangleCount'],roles=json.loads(manifest['roles']),review=name+'-review.png')

if __name__=='__main__':
    entries=[];only=sys.argv[sys.argv.index('--only')+1]if '--only'in sys.argv else None
    if only!='camp':entries.append(export_v6('royal-castle-v6',royal_town_v6,(11,13,4),94,(-42,-61,49)))
    if only!='keep':entries.append(export_v6('fortified-warcamp-v6',warcamp_v6,(-12,1,2.1),78,(41,-52,37)))
    path=S.OUT/'manifest.json';previous=json.loads(path.read_text())if path.exists()else []
    names={entry['file']for entry in entries}
    path.write_text(json.dumps([entry for entry in previous if entry['file']not in names]+entries,indent=2)+'\n',encoding='utf-8')
