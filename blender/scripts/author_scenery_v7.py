"""Blender 5.2: additive dry stakes and thornbrush before the royal western wall.

Open the actual V6 source rather than rebuilding it. Original meshes, pastures,
streets, river samples and camp source remain unchanged.
"""
import bpy,math,sys,json,random
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
import author_scenery_v6 as V6
S,V4,V5=V6.S,V6.V4,V6.V5
LAYOUT=json.loads((S.OUT/'layout-v7.json').read_text(encoding='utf-8'))
V6.LAYOUT=LAYOUT;V5.LAYOUT=LAYOUT;V5.STREAM=LAYOUT['townStream']

def new_parts(before):return [o for o in set(bpy.context.scene.objects)-before if o.type=='MESH']

def mark_defense(name,role,point,parts,**metadata):
    bounds=V5.mesh_bounds(parts);config=LAYOUT['royalOuterDefenses']
    if not V6.dry_ground(bounds,config['waterMargin']):raise ValueError('Defensive landscape touches water: '+name)
    if bounds[1]>config['wallX']-config['minimumWallGap']:raise ValueError('Defensive landscape touches the curtain wall: '+name)
    if bounds[2]<config['gateRoadHalfWidth'] and bounds[3]>-config['gateRoadHalfWidth']:raise ValueError('Defensive landscape closes the bridge road: '+name)
    marker=V4.marker(name,role,point,cosmeticOnly=True,gameplayEffect='none',**metadata)
    V5.store_footprint(marker,bounds);marker['mainRiverClearance']=V6.main_water_clearance(bounds)
    return marker

def sharpened_stake(index,x,y,rng):
    name='Outer royal angled stake '+str(index);before=set(bpy.context.scene.objects)
    lean=.30+rng.random()*.16;height=.83+rng.random()*.43
    base=Vector((x,y,.025));tip=Vector((x-lean,y+rng.uniform(-.10,.10),height))
    axis=(tip-base).normalized();cut=tip-axis*.25
    radius=.063+rng.random()*.021
    S.beam(name+' dark oak shaft',base,cut,radius,'v7StakeWood',6)
    crown=S.cyl(name+' sharp fresh-cut point',(cut+tip)*.5,radius,.25,'v7StakeCut',6,0)
    crown.rotation_euler=(tip-cut).to_track_quat('Z','Y').to_euler()
    parts=new_parts(before);bounds=V5.mesh_bounds(parts)
    if not V6.dry_ground(bounds,LAYOUT['royalOuterDefenses']['waterMargin']):
        V5.remove(parts);return False
    mark_defense(name,'defensiveStake',tuple(base),parts,lean=lean,height=height,tipX=tip.x,tipY=tip.y,tipZ=tip.z)
    return True

def thornbrush(index,x,y,rng):
    name='Outer royal thornbrush '+str(index);before=set(bpy.context.scene.objects)
    heading=rng.uniform(0,math.tau);radius=.22+rng.random()*.11;height=.27+rng.random()*.18
    # Bent woody branches and visible triangular thorns, with sparse low leaves.
    for branch in range(4):
        angle=heading+branch*math.tau/4+rng.uniform(-.24,.24)
        middle=Vector((x+math.cos(angle)*radius*.4,y+math.sin(angle)*radius*.4,height*.66))
        end=Vector((x+math.cos(angle)*radius,y+math.sin(angle)*radius,height*(.74+rng.random()*.33)))
        S.beam(name+' bent thorn stem',(x,y,.025),middle,.024,'v7ThornWood',4)
        S.beam(name+' spreading briar twig',middle,end,.018,'v7ThornWood',4)
        for t in [.38,.77]:
            p=middle.lerp(end,t);thorn=S.cyl(name+' sharp thorn',p,.033,.125,'v7ThornWood',3,0)
            thorn.rotation_euler=(Vector((math.cos(angle+.95),math.sin(angle+.95),.45))).to_track_quat('Z','Y').to_euler()
        for side in [-1,1]:
            a=tuple(end);b=(end.x+math.cos(angle+side*.8)*.11,end.y+math.sin(angle+side*.8)*.11,end.z+.055)
            c=(end.x+math.cos(angle+side*1.8)*.075,end.y+math.sin(angle+side*1.8)*.075,end.z-.025)
            S.A.custom(name+' sparse pointed briar leaves',[a,b,c],[(0,1,2)],S.P['v7ThornLeaf'])
    parts=new_parts(before);bounds=V5.mesh_bounds(parts)
    if not V6.dry_ground(bounds,LAYOUT['royalOuterDefenses']['waterMargin']) or bounds[1]>LAYOUT['royalOuterDefenses']['wallX']-.52:
        V5.remove(parts);return False
    mark_defense(name,'defensiveThornbrush',(x,y,0),parts,height=height,heading=heading)
    return True

def royal_town_v7():
    bpy.ops.wm.open_mainfile(filepath=str(S.SCENES/'royal-castle-v6.blend'))
    V5.remove(o for o in bpy.context.scene.objects if o.get('sceneryRole')=='manifest')
    S.P={
        'v7StakeWood':S.A.mat('V7 weathered defensive oak','665039'),
        'v7StakeCut':S.A.mat('V7 sharpened pale oak tips','c3a172'),
        'v7ThornWood':S.A.mat('V7 dark tangled thorn stems','4e4b39'),
        'v7ThornLeaf':S.A.mat('V7 sparse muted briar leaves','657957')
    }
    rng=random.Random(LAYOUT['royalOuterDefenses']['seed']);config=LAYOUT['royalOuterDefenses'];count=0
    for band in config['bands']:
        steps=math.ceil((band['toY']-band['fromY'])/config['stakeSpacing'])
        for i in range(steps):
            y=band['fromY']+(i+.2+rng.random()*.4)*(band['toY']-band['fromY'])/steps
            for row in range(config['stakeRows']):
                # Staggered narrow uneven bands, leaning outward from the castle.
                x=config['wallX']-.67-row*.43-rng.random()*.15
                if rng.random()<.10:continue
                if sharpened_stake(count,x,y+rng.uniform(-.11,.11),rng):count+=1
    if count<95:raise ValueError('Incomplete royal defensive stake band')
    brush_count=0;positions=[]
    for attempt in range(900):
        if brush_count==config['thornCount']:break
        band=rng.choice(config['bands']);x=config['wallX']-1.12-rng.random()*.30;y=rng.uniform(band['fromY']+.4,band['toY']-.4)
        if any(math.hypot(x-px,y-py)<.75 for px,py in positions):continue
        if thornbrush(brush_count,x,y,rng):positions.append((x,y));brush_count+=1
    if brush_count<16:raise ValueError('Incomplete dry thornbrush border')
    bpy.context.scene['V7 inherited source']='royal-castle-v6.blend'
    bpy.context.scene['Defensive landscape']='Cosmetic only; bridge road and river clear'

if __name__=='__main__':
    entry=V6.export_v6('royal-castle-v7',royal_town_v7,(11,13,4),94,(-42,-61,49))
    entry['style']='scenery-v7';entry['inherits']='royal-castle-v6.blend';entry['gameplayEffect']='none'
    path=S.OUT/'manifest.json';previous=json.loads(path.read_text())if path.exists()else []
    path.write_text(json.dumps([item for item in previous if item['file']!=entry['file']]+[entry],indent=2)+'\n',encoding='utf-8')
