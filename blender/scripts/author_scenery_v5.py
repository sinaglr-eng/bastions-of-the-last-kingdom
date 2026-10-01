"""Blender 5.2 V5: dry town footprints, alpine stream and staffed defenses.

Run node tools/author-scenery-layout.mjs first. V4 native designs remain intact;
V5 keeps their alpine palace, residents, animals, quarry and mountain camp.
"""
import bpy, math, sys, json, random
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
import author_scenery_v4 as V4
from scenery_orcs_v4 import build_orc_territory
S=V4.S
LAYOUT=json.loads((S.OUT/'layout-v5.json').read_text(encoding='utf-8'))
STREAM=LAYOUT['townStream']
RNG=random.Random(5031)
BASE_PALETTE=S.palette

def palette():
    p=BASE_PALETTE()
    for key,name,color in [('pine','Forest deep needles','365e45'),('pineLight','Forest new needles','5a7b52'),('bank','Alpine stream sand','a3ac8b')]:p[key]=S.A.mat(name,color)
    return p
S.palette=palette

def remove(objects):
    for obj in list(objects):bpy.data.objects.remove(obj,do_unlink=True)

def mesh_bounds(objects):
    bpy.context.view_layer.update()
    points=[o.matrix_world@Vector(v)for o in objects if o.type=='MESH' for v in o.bound_box]
    return (min(p.x for p in points),max(p.x for p in points),min(p.y for p in points),max(p.y for p in points))

def water_clearance(bounds):
    lo,hi,bottom,top=bounds
    # Blender +Y maps to game -Z. These samples are the exact runtime curve.
    closest=min(math.hypot(max(lo-(x-38),0,(x-38)-hi),max(bottom-(14-z),0,(14-z)-top))for x,h,z in STREAM['samples'])
    return closest-STREAM['waterWidth']/2

def store_footprint(marker,bounds):
    lo,hi,bottom,top=bounds
    for key,value in [('worldMinX',38+lo),('worldMaxX',38+hi),('worldMinZ',14-top),('worldMaxZ',14-bottom),('waterClearance',water_clearance(bounds))]:marker[key]=float(value)

def dry_buildings():
    houses=[o for o in bpy.context.scene.objects if o.get('sceneryRole')=='townBuilding']
    records=[]
    relocations={'Upper bakery':(21.4,5.8),'Wool merchants house':(21.5,-5.3),'South village home':(21.7,-7.8),'North millers cottage':(21.6,9.6),'Eastern guild house':(26.8,3.2),'Eastern schoolhouse':(26.7,8.7),'East riverside house':(22.1,-2.4),'Eastern candle maker':(26.3,-2.3),'Blue town hall':(12.4,9)}
    for house in houses:
        parts=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith(house.name+' ')]
        if house.name in relocations:
            x,y=relocations[house.name];dx=x-house.location.x;dy=y-house.location.y
            for obj in parts+[house]:obj.location.x+=dx;obj.location.y+=dy
            house['V5DryRelocation']=True
        records.append((house,parts,mesh_bounds(parts)))
    # Conservatively include roof/eaves and every footing, door step and chimney.
    for index,(house,parts,bounds)in enumerate(records):
        if water_clearance(bounds)<.26:
            candidates=[]
            for step in range(1,17):
                offsets=[(dx*.5,dy*.5)for dx in range(-step,step+1)for dy in range(-step,step+1)if max(abs(dx),abs(dy))==step]
                for dx,dy in offsets:
                    proposed=(bounds[0]+dx,bounds[1]+dx,bounds[2]+dy,bounds[3]+dy)
                    if water_clearance(proposed)<.26:continue
                    if proposed[0]<8.85 and proposed[2]<6.8 and proposed[3]>-6.8:continue
                    if any(j!=index and proposed[0]<b[1]+.20 and proposed[1]>b[0]-.20 and proposed[2]<b[3]+.20 and proposed[3]>b[2]-.20 for j,(_,_,b)in enumerate(records)):continue
                    candidates.append((dx*dx+dy*dy,dx,dy,proposed))
                if candidates:break
            if not candidates:raise ValueError('No dry footprint for '+house.name)
            _,dx,dy,bounds=min(candidates)
            for obj in parts+[house]:obj.location.x+=dx;obj.location.y+=dy
            records[index]=(house,parts,bounds)
            house['V5DryRelocation']=True
        store_footprint(house,bounds)
        if water_clearance(bounds)<.25:raise ValueError('House overlaps actual stream ribbon: '+house.name)
    # The waterwheel is allowed over water; the mill building itself stays dry.
    mill=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith('Canal watermill ')]
    marker=V4.marker('Mill dry building footprint','buildingFootprint',(14,11,0));store_footprint(marker,mesh_bounds(mill))
    if marker['waterClearance']<.25:raise ValueError('Mill house is in the stream')

def tree(name,x,y,height=3.5,broad=False,z=0,role='settlementTree'):
    radius=max(height*.25,1.14 if broad else 0)
    wx,wz=(x-25,-14-y)if role=='palisadeForest'else(x+38,14-y)
    if wx-radius<18.5 and wx+radius>-18.5 and wz-radius<18.5 and wz+radius>-18.5:return False
    before=set(bpy.context.scene.objects)
    S.cyl(name+' tapered trunk',(x,y,z+height*.38),.10,height*.76,'wood',7,.055)
    if broad:
        for i in range(4):
            a=i*2.399;xx=x+math.cos(a)*.45;yy=y+math.sin(a)*.45
            S.beam(name+' spreading limb',(x,y,z+height*.52),(xx,yy,z+height*.77),.042,'wood',5)
            S.orb(name+' broad crown',(xx,yy,z+height*.79),(.68,.68,.60),'pineLight')
        S.orb(name+' upper canopy',(x,y,z+height*.94),(.62,.63,.62),'pineLight')
    else:
        for i in range(3):
            S.cyl(name+' layered needles',(x+math.sin(i*2)*.05,y,z+height*(.43+i*.20)),height*(.25-i*.05),height*(.45-i*.045),'pineLight' if i==2 else 'pine',8,0)
    # The conservative canopy envelope is verified again on exported vertices.
    V4.marker(name,role,(x,y,z),canopyRadius=radius);return True

def rock(name,x,y,scale=1,z=0,role='settlementRock'):
    wx,wz=(x-25,-14-y)if role=='clanEdgeRock'else(x+38,14-y)
    if wx-.67*scale<18.5 and wx+.67*scale>-18.5 and wz-.49*scale<18.5 and wz+.49*scale>-18.5:return False
    S.orb(name+' weathered boulder',(x,y,z+.30*scale),(.65*scale,.48*scale,.47*scale),'shade')
    S.orb(name+' fractured shoulder',(x+.28*scale,y-.16*scale,z+.34*scale),(.39*scale,.33*scale,.31*scale),'granite')
    V4.marker(name,role,(x,y,z))

def accessible_streets():
    houses=[(o['worldMinX']-38,o['worldMaxX']-38,14-o['worldMaxZ'],14-o['worldMinZ'])for o in bpy.context.scene.objects if o.get('sceneryRole')in ['townBuilding','buildingFootprint']]
    streets=[o for o in bpy.context.scene.objects if o.get('sceneryRole')=='street']
    for street in streets:
        index=street.name.rsplit(' ',1)[-1]
        parts=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith('Royal town cobbled street '+index)]
        lo,hi,bottom,top=mesh_bounds(parts);along_x=hi-lo>top-bottom
        intervals=[(lo,hi)if along_x else(bottom,top)]
        for a,b,c,d in houses:
            if ((c<top and d>bottom)if along_x else(a<hi and b>lo)):
                cut0,cut1=(a-.12,b+.12)if along_x else(c-.12,d+.12)
                intervals=[part for start,end in intervals for part in [(start,min(end,cut0)),(max(start,cut1),end)]if part[1]-part[0]>.35]
        name=street.name;remove(parts+[street])
        for i,(start,end)in enumerate(intervals):
            bounds=(start,end,bottom,top)if along_x else(lo,hi,start,end)
            x,y=(bounds[0]+bounds[1])/2,(bounds[2]+bounds[3])/2
            S.box(name+' dry paving '+str(i),(x,y,.025),(bounds[1]-bounds[0],bounds[3]-bounds[2],.05),'plasterwarm')
            marker=V4.marker(name+' accessible segment '+str(i),'street',(x,y,0))
            store_footprint(marker,bounds)

def wall_defender(name,x,y,z,archer=False,facing=math.pi/2):
    before=set(bpy.context.scene.objects)
    for side in [-1,1]:
        S.box(name+' leather boot',(side*.10,.05,.085),(.15,.26,.17),'wood')
        S.beam(name+' armored shin',(side*.1,0,.18),(side*.085,0,.57),.066,'iron',6)
    S.orb(name+' azure tunic',(0,0,.80),(.20,.145,.29),'blue')
    S.box(name+' fitted breastplate',(0,.145,.84),(.33,.065,.34),'iron')
    S.beam(name+' neck',(0,0,1.02),(0,0,1.15),.052,'skin',6)
    S.orb(name+' vigilant face',(0,0,1.26),(.135,.12,.18),'skin')
    S.cyl(name+' steel helm',(0,0,1.40),.158,.14,'iron',8,.12)
    for side in [-1,1]:S.orb(name+' eye',(side*.043,.117,1.27),(.013,.009,.012),'dark')
    if archer:
        S.beam(name+' extended bow arm',(-.15,0,.99),(-.35,.20,.95),.055,'blue',6)
        S.beam(name+' drawing arm',(.17,0,.99),(.23,.30,1.03),.055,'blue',6)
        for a,b in [((-.40,.28,.55),(-.52,.30,.92)),((-.52,.30,.92),(-.40,.28,1.35))]:S.beam(name+' recurve bow',a,b,.026,'plank',5)
        S.beam(name+' taut bowstring',(-.40,.28,.55),(-.40,.28,1.35),.009,'bone',4)
        S.beam(name+' nocked arrow',(-.41,.29,.98),(.27,.29,.98),.012,'wood',4)
        S.cyl(name+' quiver',(0,-.20,.96),.083,.48,'wood',7)
        for dx in [-.045,0,.045]:S.beam(name+' quiver arrow',(dx,-.20,1.01),(dx,-.20,1.42),.011,'plank',4)
    else:
        for side in [-1,1]:S.beam(name+' steel sleeve',(side*.17,0,1.01),(side*.26,.08,.70),.062,'iron',6)
        S.box(name+' sword blade',(.28,.13,.65),(.04,.035,.93),'light')
        S.box(name+' sword guard',(.28,.13,.84),(.18,.06,.041),'gold')
        S.box(name+' blue kite shield',(-.31,.20,.79),(.29,.08,.47),'blue')
        S.box(name+' shield gold spine',(-.31,.25,.79),(.043,.018,.37),'gold')
    V4.transform_new(before,(x,y,z),facing)
    V4.marker(name,'wallArcher' if archer else 'wallSoldier',(x,y,z),walkwayHeight=z)

def wall_segment(name,a,b,height=2.15,deck=2.05):
    dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy);angle=math.atan2(dy,dx)
    S.curtain_wall(name,(a[0]+b[0])/2,(a[1]+b[1])/2,length,angle,height)
    # A real broad walk sits inside the parapet, with visible stone support arches.
    nx,ny=dy/length,-dx/length
    tread=S.box(name+' broad guard walkway',((a[0]+b[0])/2+nx*.35,(a[1]+b[1])/2+ny*.35,deck-.09),(length,.88,.18),'shade');tread.rotation_euler[2]=angle
    V4.marker(name,'royalWallSegment',(a[0],a[1],deck),aX=a[0],aY=a[1],bX=b[0],bY=b[1],walkwayHeight=deck)

def western_defenses():
    wall=LAYOUT['royalWesternWall'];x=wall['x'];gap=wall['gateHalfWidth'];north=wall['northY'];south=wall['southY'];deck=wall['walkwayHeight']
    segments=[((x,gap),(x,north)),((x,south),(x,-gap)),((x,north),(-6.9,north)),((-6.9,north),(-6.9,6.1)),((-6.9,-6.1),(-6.9,south)),((-6.9,south),(x,south))]
    for i,(a,b)in enumerate(segments):wall_segment('Western royal curtain '+str(i),a,b,2.15,deck)
    for y in [north,south]:S.castle_tower('Western royal corner tower',x,y,3.25,.61)
    for y in [-2.10,2.10]:S.castle_tower('Western royal gate guard tower',x,y,3.38,.56)
    S.box('Western gate upper sentry chamber',(x,0,3.25),(.95,3.4,.86),'stone')
    S.gabled_roof('Western gate slate ridge',x,0,3.69,1.25,3.65,.83)
    V4.marker('Open western royal gate','royalGate',(x,0,0),width=gap*2,corridor='Existing valley bridge')
    for side in [-1,1]:
        for j in range(4):wall_defender('Western parapet defender '+str(side)+' '+str(j),x+.32,side*(3.4+j*1.19),deck,j%2==0,math.pi/2)
    for y in [north,south]:wall_defender('Corner tower royal archer '+str(y),x,y,3.36,True,math.pi/2)
    for x,y in [(-5.4,5.76),(-.3,5.76),(-4.5,-5.76),(3.2,-5.76)]:
        S.box('Existing palace wall inner walkway',(x,y,1.53),(1.20,.64,.16),'shade')
        wall_defender('Palace terrace archer '+str(x)+' '+str(y),x,y,1.61,True,0 if y>0 else math.pi)

def expanded_farms():
    old_names={o.name for o in bpy.context.scene.objects if o.get('sceneryRole')=='farmPlot'}
    remove(o for o in bpy.context.scene.objects if o.name in old_names or any(o.name.startswith(name+' ')for name in old_names))
    for plot in LAYOUT['farmPlots']:
        name,x,y,w,d=(plot[k]for k in ['name','x','y','width','depth'])
        bounds=(x-w/2,x+w/2,y-d/2,y+d/2)
        if water_clearance(bounds)<.25:raise ValueError('Field overlaps stream: '+name)
        S.box(name+' broad cultivated soil',(x,y,.012),(w,d,.036),'soil')
        rows=max(8,int(d*1.5));columns=max(13,int(w*1.5))
        for row in range(rows):
            yy=y-d/2+.24+row*(d-.48)/(rows-1)
            S.beam(name+' long plowed furrow',(x-w/2+.12,yy,.053),(x+w/2-.12,yy,.053),.039,'wood',4)
            for column in range(columns):
                xx=x-w/2+.22+column*(w-.44)/(columns-1);h=.21+((row+column)%4)*.03
                S.beam(name+' crop stalk',(xx,yy,.055),(xx,yy,h),.009,'wheat',3)
                S.cyl(name+' full crop ear',(xx,yy,h+.05),.028,.10,'wheat',4,0)
        for side in [-1,1]:
            for along in range(6):S.beam(name+' farm timber post',(x-w/2+along*w/5,y+side*d/2,0),(x-w/2+along*w/5,y+side*d/2,.58),.033,'wood',5)
            S.beam(name+' farm boundary rail',(x-w/2,y+side*d/2,.40),(x+w/2,y+side*d/2,.40),.027,'plank',5)
        marker=V4.marker(name,'farmPlot',(x,y,0),width=w,depth=d,area=w*d);store_footprint(marker,bounds)
        V4.villager('Expanded '+name+' farmer',x-w*.4,y-d*.44,0,'farmer')

def stream_source_and_review():
    source=STREAM['samples'][0];x,y,z=source[0]-38,14-source[2],source[1]
    V4.marker('Independent alpine spring','springSource',(x,y,z),source='Mountains',downstreamOnly=True)
    for i,(dx,dy,dz,s)in enumerate([(-1.1,.45,-.1,1.6),(1.25,.6,-.05,1.4),(-.3,1.6,.7,1.9)]):rock('Alpine spring mouth '+str(i),x+dx,y+dy,s,z+dz,'springRock')
    # Review surfaces use the same 481 sampled vertices as the runtime ribbon.
    for width,offset,mat,name in [(STREAM['bankWidth'],-.092,'bank','V5 narrow stream bank preview'),(STREAM['waterWidth'],-.018,'blue','V5 independent alpine stream preview')]:
        vertices=[];faces=[];points=STREAM['samples']
        for i,(wx,h,wz)in enumerate(points):
            a=points[max(0,i-1)];b=points[min(len(points)-1,i+1)];direction=Vector((b[0]-a[0],-(b[2]-a[2]),0)).normalized();normal=Vector((-direction.y,direction.x,0))*width/2
            p=Vector((wx-38,14-wz,h+offset));vertices.extend([tuple(p+normal),tuple(p-normal)])
            if i:faces.append((i*2-2,i*2-1,i*2+1,i*2))
        obj=S.A.custom(name,vertices,faces,S.P[mat]);obj['reviewOnly']=True

def royal_town_v5():
    V4.inhabited_royal_town()
    remove(o for o in bpy.context.scene.objects if o.get('reviewOnly'))
    remove(o for o in bpy.context.scene.objects if o.name.startswith('Town orchard '))
    dry_buildings();accessible_streets();expanded_farms();western_defenses();stream_source_and_review()
    # Fill edges around the new fields and town without closing paths or water.
    buildings=[(o['worldMinX']-38,o['worldMaxX']-38,14-o['worldMaxZ'],14-o['worldMinZ'])for o in bpy.context.scene.objects if o.get('sceneryRole')in ['townBuilding','buildingFootprint','farmPlot']]
    for i,(x,y)in enumerate([(-7,11),(-5,13),(-8,-12),(-7,-15),(-8,-20),(-4,-22),(3,-25),(18,-25),(22,-25),(30,-26),(37,-23),(38,-17),(38,-9),(38,-1),(37,7),(35,11),(36,22),(31,26),(22,28),(5,28),(-5,25),(-9,19),(20,15),(28,15),(29,18),(32,19),(29,-3),(33,-1),(34,3),(-7,15),(-5,-25)]):
        if water_clearance((x-1,x+1,y-1,y+1))<.6:continue
        if any(x>lo-1.1 and x<hi+1.1 and y>bottom-1.1 and y<top+1.1 for lo,hi,bottom,top in buildings):continue
        tree('Royal shoulder tree '+str(i),x,y,2.8+(i%4)*.24,i%3==0)
        if i%3==0:rock('Royal shoulder stone '+str(i),x+.85,y-.65,.62)

def clan_perimeter():
    outline=LAYOUT['clanPalisade'];polygon=outline['polygon'];spacing=outline['stakeSpacing'];gate=outline['gateHalfWidth'];forest_count=0
    V4.marker('Complete outer clan perimeter','clanPerimeter',(0,0,0),polygon=json.dumps(polygon),gateX=outline['gateX'],gateHalfWidth=gate)
    for index,(a,b)in enumerate(zip(polygon,polygon[1:]+polygon[:1])):
        dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy);n=max(1,math.ceil(length/spacing));nx,ny=-dy/length,dx/length
        V4.marker('Outer palisade side '+str(index),'outerPalisadeSegment',(a[0],a[1],0),aX=a[0],aY=a[1],bX=b[0],bY=b[1],gateHalfWidth=gate if a[0]==b[0]==outline['gateX'] else 0)
        for i in range(n):
            t=i/n;x=a[0]+dx*t;y=a[1]+dy*t
            if abs(x-outline['gateX'])<.001 and abs(y)<gate:continue
            h=1.94+(i%4)*.075
            S.cyl('Outer closed stockade log',(x,y,h/2),.146,h,'wood',6,.123)
            S.cyl('Outer sharpened palisade crown',(x,y,h+.15),.151,.31,'plank',6,0)
            for z in [.50,1.35]:S.box('Outer stockade lash',(x,y,z),(.29,.22,.062),'hideedge')
            V4.marker('Outer stockade stake '+str(index)+' '+str(i),'outerPalisadeStake',(x,y,0),height=h)
        # Horizontal ties are continuous except across the functional gate.
        ranges=[(0,1)]
        if a[0]==b[0]==outline['gateX']:
            t1=(-gate-a[1])/dy;t2=(gate-a[1])/dy;lo,hi=sorted([t1,t2]);ranges=[(0,max(0,lo)),(min(1,hi),1)]
        for lo,hi in ranges:
            if hi-lo<=0:continue
            for z in [.59,1.42]:S.beam('Outer perimeter continuous timber tie',(a[0]+dx*lo,a[1]+dy*lo,z),(a[0]+dx*hi,a[1]+dy*hi,z),.060,'plank',6)
        for i in range(max(2,int(length/1.8))):
            t=(i+.45)/max(2,int(length/1.8));px=a[0]+dx*t;py=a[1]+dy*t
            if abs(px-outline['gateX'])<.1 and abs(py)<3:continue
            for layer in [0,1]:
                x=px+nx*(1.7+layer*1.9)+(RNG.random()-.5)*.42;y=py+ny*(1.7+layer*1.9)+(RNG.random()-.5)*.42
                if tree('Stockade rear forest '+str(index)+' '+str(i)+' '+str(layer),x,y,2.7+RNG.random()*1.0,False,0,'palisadeForest'):forest_count+=1
            if i%4==0:rock('Stockade landscape stone '+str(index)+' '+str(i),px+nx*2.0,py+ny*2.0,.65,0,'clanEdgeRock')
    gx=outline['gateX']
    for y in [-gate-.10,gate+.10]:
        S.beam('Outer clan gate oak upright',(gx,y,.02),(gx,y,2.83),.17,'wood',8)
        S.cyl('Outer clan gate tusk',(gx,y,3.1),.18,.62,'bone',7,0)
    S.beam('Outer clan gate overhead beam',(gx,-gate-.25,2.69),(gx,gate+.25,2.69),.16,'plank',8)
    V4.marker('Outer functional clan gate','clanGate',(gx,0,0),width=gate*2)
    for i,(x,y)in enumerate([(-29,-21.7),(-30,20),(-10,24.4),(4.3,8.5)]):S.watchtower('Outer stockade lookout '+str(i),x,y)
    for i,(x,y)in enumerate([(-27,-5),(-27,-13),(-8,-19),(-22,6.7),(-5,14),(-27,19)]):
        tree('Clan inner edge tree '+str(i),x,y,2.8+(i%3)*.25,False,0,'palisadeForest')
        rock('Clan inner path boulder '+str(i),x+.8,y-.7,.56,0,'clanEdgeRock')

def warcamp_v5():
    build_orc_territory(S);clan_perimeter()

def export_v5(name,build,view_center,ortho,camera_position):
    # V4 exporter keeps all semantically named source meshes, batches only copies,
    # and exports every role marker needed for actual-runtime geometry checks.
    V4.export_v4(name,build,view_center,ortho,camera_position)
    # Preserve the real native-scene review image alongside the editable source.
    from shutil import copyfile
    render_dir=S.ROOT/'blender/renders'
    render_dir.mkdir(parents=True,exist_ok=True)
    copyfile(S.REVIEW/(name+'-review.png'),render_dir/(name+'-review.png'))
    scene=bpy.context.scene;manifest=next(o for o in scene.objects if o.get('sceneryRole')=='manifest')
    return dict(file=name+'.glb',source=name+'.blend',style='scenery-v5',authoring='Blender 5.2',triangles=manifest['triangleCount'],roles=json.loads(manifest['roles']),review=name+'-review.png')

if __name__=='__main__':
    entries=[]
    only=sys.argv[sys.argv.index('--only')+1]if '--only'in sys.argv else None
    if only not in ['camp']:entries.append(export_v5('royal-castle-v5',royal_town_v5,(10,7,3.7),74,(-37,-49,44)))
    if only not in ['keep']:entries.append(export_v5('fortified-warcamp-v5',warcamp_v5,(-12,1,2.1),67,(41,-52,37)))
    path=S.OUT/'manifest.json';previous=json.loads(path.read_text())if path.exists()else []
    names={entry['file']for entry in entries};entries=[entry for entry in previous if entry['file']not in names]+entries
    path.write_text(json.dumps(entries,indent=2)+'\n',encoding='utf-8')
