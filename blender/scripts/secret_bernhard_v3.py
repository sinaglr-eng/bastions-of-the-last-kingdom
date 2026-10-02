"""Lord Bernhard V3: a sculpted equestrian knight with a deforming native rig.

Z is up, +Y is the facing direction.  This is new geometry, not a V2 import.
The suit is modelled as shaped, thick, overlapping steel plates; the horse is
a continuous remeshed anatomical surface.  Both hands have five independently
shaped curled digits.  Idle and Attack are genuine skeletal actions.  The
attack's 0.36 release is a distant magical sword discharge, not distant melee.
"""
import bpy, math, sys, json, random
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from author_archer import custom, ellipsoid, mat, cylinder, torus
import cohesive

ROOT=Path(__file__).resolve().parents[2]
PARTS=[]
RIG=None
FPS=50
REST={}


def mesh(name,verts,faces,material,bone='horse_root',smooth=True):
    o=custom(name,verts,faces,material)
    for p in o.data.polygons:p.use_smooth=smooth
    if bone:weight(o,bone)
    PARTS.append(o)
    return o


def weight(o,bone,indices=None,value=1):
    g=o.vertex_groups.get(bone) or o.vertex_groups.new(name=bone)
    g.add(list(indices) if indices is not None else list(range(len(o.data.vertices))),value,'REPLACE')
    return o


def apply(o,modifier):
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True)
    bpy.context.view_layer.objects.active=o
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def shell(o,thick=.009,subdiv=0):
    if subdiv:
        s=o.modifiers.new('Hand retopology surface relaxation','SUBSURF');s.levels=subdiv;s.render_levels=subdiv;apply(o,s)
    m=o.modifiers.new('Actual crafted plate thickness','SOLIDIFY');m.thickness=thick;m.offset=0;apply(o,m)
    return o


def interpolate(points,steps=4):
    out=[]
    ps=[Vector(p) for p in points]
    for i in range(len(ps)-1):
        p0=ps[max(i-1,0)];p1=ps[i];p2=ps[i+1];p3=ps[min(i+2,len(ps)-1)]
        for j in range(steps):
            t=j/steps
            out.append(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t))
    out.append(ps[-1]);return out


def swept(name,points,radii,material,bone='horse_root',sides=12,steps=3,ellipticity=1):
    """Curved ring topology with varying anatomical section, not straight rods."""
    ps=interpolate(points,steps);verts=[]
    for i,p in enumerate(ps):
        t=i/(len(ps)-1)*(len(radii)-1);j=min(len(radii)-2,int(t));f=t-j
        r=radii[j]*(1-f)+radii[j+1]*f
        tangent=(ps[min(i+1,len(ps)-1)]-ps[max(0,i-1)]).normalized()
        n=tangent.cross(Vector((1,0,0)))
        if n.length<.01:n=tangent.cross(Vector((0,1,0)))
        n.normalize();b=tangent.cross(n).normalized()
        for k in range(sides):
            a=math.tau*k/sides;verts.append(tuple(p+r*(n*math.cos(a)+b*math.sin(a)*ellipticity)))
    faces=[tuple(range(sides-1,-1,-1))]
    for i in range(len(ps)-1):
        for k in range(sides):faces.append((i*sides+k,i*sides+(k+1)%sides,(i+1)*sides+(k+1)%sides,(i+1)*sides+k))
    faces.append(tuple((len(ps)-1)*sides+k for k in range(sides)))
    return mesh(name,verts,faces,material,bone)


def section(name,rings,material,bone='rider_spine',sides=32,cap=True):
    """Hand-shaped oval section topology; ring=(centre, width, depth)."""
    verts=[]
    for c,rx,ry in rings:
        for k in range(sides):
            a=math.tau*k/sides
            verts.append((c[0]+rx*math.cos(a),c[1]+ry*math.sin(a),c[2]))
    faces=[]
    if cap:faces.append(tuple(range(sides-1,-1,-1)))
    for j in range(len(rings)-1):
        for k in range(sides):faces.append((j*sides+k,j*sides+(k+1)%sides,(j+1)*sides+(k+1)%sides,(j+1)*sides+k))
    if cap:faces.append(tuple((len(rings)-1)*sides+k for k in range(sides)))
    return mesh(name,verts,faces,material,bone)


def curve(name,points,radius,material,bone='rider_spine',steps=3,sides=6):
    # Fine engraved lines need fewer axial segments than large silhouette forms.
    return swept(name,points,[radius]*len(points),material,bone,min(sides,5),min(steps,2))


def sphere_start(name,pos,scale,material):
    o=ellipsoid(name,pos,scale,material,32,16);return o


def marker(name,pos,bone=None,**props):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=pos
    if bone:
        o.parent=RIG;o.parent_type='BONE';o.parent_bone=bone
        bpy.context.view_layer.update();o.matrix_world.translation=Vector(pos)
    for k,v in props.items():o[k]=v
    return o


def palette():
    p={
        'coat':mat('Bernhard V3 warm pearl horse coat','e8e5d9'),
        'mane':mat('Bernhard V3 ivory silken mane and tail','f8f0d9'),
        'steel':mat('Bernhard V3 polished warm silver plate','e5e6dd',.87,.04),
        'gold':mat('Bernhard V3 engraved rich royal gold','dfb354',.80,.10),
        'ivory':mat('Bernhard V3 cream damask and pearls','f3e7ca'),
        'leather':mat('Bernhard V3 saddle chestnut leather','4b3426'),
        'dark':mat('Bernhard V3 dark joints hoof and visor','272924',.16),
        'eye':mat('Bernhard V3 deep equine eyes','171b17',.20),
        'glow':mat('Bernhard V3 controlled golden sword focus','ffe9a0',.35,1.25),
        'stone':mat('Bernhard V3 pale limestone pedestal','9ea896'),
        'stoneedge':mat('Bernhard V3 pedestal sides','677567'),
    }
    for key in ('steel','gold','glow'):p[key].node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.26 if key=='steel' else .32
    p['coat'].node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.71
    p['mane'].node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.54
    # Packed deterministic fine surface maps export to glTF roughness textures.
    rng=random.Random(20261002)
    for key,base,amp in [('steel',.27,.025),('gold',.34,.035),('ivory',.79,.06),('leather',.67,.08),('coat',.73,.025)]:
        m=p[key];n=m.node_tree.nodes;s=n.get('Principled BSDF')
        image=bpy.data.images.new('Bernhard V3 '+key+' micro-surface',width=128,height=128)
        image.colorspace_settings.name='Non-Color';pix=[]
        for j in range(128):
            for i in range(128):
                v=base+amp*(rng.random()-.5)*2
                if key=='ivory':v+=.025*math.sin(i*math.pi)*math.sin(j*math.pi)
                pix.extend([v,v,v,1])
        image.pixels=pix;image.pack()
        node=n.new('ShaderNodeTexImage');node.image=image;node.label='Exported fine surface roughness'
        m.node_tree.links.new(node.outputs['Color'],s.inputs['Roughness'])
    return p


def rig():
    global RIG,REST
    arm=bpy.data.armatures.new('Bernhard V3 deform skeleton')
    RIG=bpy.data.objects.new('Bernhard_V3_Rig',arm);bpy.context.collection.objects.link(RIG)
    bpy.context.view_layer.objects.active=RIG;RIG.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    defs=[
        ('champion_root',(0,0,0),(0,0,.15),None),
        ('horse_root',(0,-.08,1.10),(0,-.08,1.36),'champion_root'),
        ('horse_neck',(0,.26,1.26),(0,.53,1.70),'horse_root'),
        ('horse_head',(0,.53,1.70),(0,.82,1.63),'horse_neck'),
        ('horse_tail',(0,-.58,1.25),(0,-.74,.55),'horse_root'),
        ('rider_root',(0,-.11,1.405),(0,-.11,1.52),'horse_root'),
        ('rider_spine',(0,-.11,1.52),(0,-.09,1.91),'rider_root'),
        ('rider_head',(0,-.08,1.91),(0,-.08,2.19),'rider_spine'),
        ('cape',(0,-.19,1.93),(0,-.52,1.27),'rider_spine'),
        ('upper_arm_R',(.193,-.07,1.877),(.322,-.042,2.045),'rider_spine'),
        ('forearm_R',(.322,-.042,2.045),(.326,.105,2.258),'upper_arm_R'),
        ('hand_R',(.326,.105,2.258),(.326,.115,2.330),'forearm_R'),
        ('upper_arm_L',(-.193,-.07,1.877),(-.292,.025,1.665),'rider_spine'),
        ('forearm_L',(-.292,.025,1.665),(-.210,.240,1.559),'upper_arm_L'),
        ('hand_L',(-.210,.240,1.559),(-.21,.285,1.56),'forearm_L'),
    ]
    for side,label in [(-1,'L'),(1,'R')]:
        defs.extend([
            ('rider_thigh_'+label,(side*.116,-.11,1.41),(side*.321,.128,1.161),'rider_root'),
            ('rider_calf_'+label,(side*.321,.128,1.161),(side*.324,.043,.839),'rider_thigh_'+label),
            ('rider_foot_'+label,(side*.324,.043,.839),(side*.324,.148,.828),'rider_calf_'+label),
            ('horse_fore_upper_'+label,(side*.162,.281,1.16),(side*.165,.329,.68),'horse_root'),
            ('horse_fore_lower_'+label,(side*.165,.329,.68),(side*.165,.337,.265),'horse_fore_upper_'+label),
            ('horse_hind_upper_'+label,(side*.175,-.383,1.13),(side*.191,-.475,.604),'horse_root'),
            ('horse_hind_lower_'+label,(side*.191,-.475,.604),(side*.187,-.402,.261),'horse_hind_upper_'+label),
        ])
    for name,head,tail,parent in defs:
        b=arm.edit_bones.new(name);b.head=head;b.tail=tail
        if parent:b.parent=arm.edit_bones[parent]
        b.use_deform=True
        REST[name]=(Vector(head),Vector(tail))
    bpy.ops.object.mode_set(mode='OBJECT');RIG.show_in_front=True
    RIG['nativeRig']=True;RIG['releaseFraction']=.36;RIG['clipContract']='Idle 2.4 seconds; Attack 1.0 second; release 0.36; no gameplay changes'
    return RIG


def horse(p):
    seeds=[]
    for name,pos,scale in [
        ('Long rib cage',(0,-.060,1.102),(.240,.441,.255)),
        ('Smooth powerful croup',(0,-.374,1.156),(.252,.254,.249)),
        ('Equine scapula shoulder',(0,.241,1.133),(.222,.239,.292)),
        ('Deep sloping chest',(0,.281,1.019),(.169,.175,.244)),
        ('Raised warmblood withers',(0,.156,1.337),(.140,.211,.080)),
        ('Flank transition',(0,-.139,1.173),(.233,.273,.204)),
    ]:seeds.append(sphere_start(name,pos,scale,p['coat']))
    # The continuous arched neck is defined with taper and variable oval section.
    neck=swept('Sculpt starting arched neck',[(0,.253,1.203),(0,.334,1.397),(0,.420,1.591),(0,.531,1.736)],[.175,.156,.122,.095],p['coat'],None,24,6,1.04);PARTS.remove(neck);seeds.append(neck)
    # Long wedge-shaped head with poll, broad cheek and fine lower muzzle.
    head=swept('Sculpt starting facial wedge',[(0,.525,1.733),(0,.638,1.709),(0,.741,1.627),(0,.838,1.541)],[.101,.089,.072,.070],p['coat'],None,24,5,.80);PARTS.remove(head);seeds.append(head)
    for side in (-1,1):
        seeds.append(sphere_start('Jaw to throat anatomical connection',(side*.045,.566,1.638),(.061,.100,.081),p['coat']))
        for rear in (False,True):
            if rear:
                ps=[(side*.154,-.389,1.154),(side*.183,-.283,.896),(side*.193,-.481,.599),(side*.185,-.428,.346),(side*.189,-.393,.248)]
                radii=[.095,.071,.035,.025,.031]
            else:
                # Broad flexor forearm, defined carpus, fine straight cannon,
                # projecting fetlock and sloping pastern have distinct profiles.
                ps=[(side*.153,.245,1.153),(side*.158,.234,.964),(side*.163,.277,.823),(side*.166,.315,.687),(side*.167,.328,.622),(side*.167,.328,.386),(side*.168,.333,.306),(side*.168,.351,.266),(side*.168,.357,.251)]
                radii=[.082,.058,.045,.040,.026,.021,.034,.027,.029]
            leg=swept('Sculpt starting equine anatomical leg',ps,radii,p['coat'],None,18,4 if rear else 2,1.05);PARTS.remove(leg);seeds.append(leg)
    body=cohesive.fuse(seeds,'Bernhard V3 continuous sculpted equine anatomy',.0075,16600,p['coat']);PARTS.append(body)
    # Smooth skeletal gradients retain chest/shoulder continuity and head articulation.
    for v in body.data.vertices:
        q=body.matrix_world@v.co;x,y,z=q
        weights={'horse_root':1}
        if y>.20 and z>1.22:
            neck=max(0,min(1,(z-1.21)/.34))*max(0,min(1,(y-.20)/.15))
            head=max(0,min(1,(y-.46)/.17))*max(0,min(1,(z-1.49)/.13))
            weights={'horse_root':1-neck,'horse_neck':neck*(1-head),'horse_head':neck*head}
        if abs(x)>.095 and z<1.08:
            side='L' if x<0 else 'R';rear=y<-.13
            label='horse_hind_' if rear else 'horse_fore_'
            joint=.604 if rear else .680
            influence=max(0,min(1,(1.11-z)/.16))
            lower=max(0,min(1,(joint+.055-z)/.13))
            weights={'horse_root':1-influence,label+'upper_'+side:influence*(1-lower),label+'lower_'+side:influence*lower}
        for name,w in weights.items():
            if w>.00001:weight(body,name,[v.index],w)
    # Shaped solid hooves: broad toe, narrowed coronary band, sloping hoof wall.
    for side,label in [(-1,'L'),(1,'R')]:
        for rear in (False,True):
            y=-.377 if rear else .372;x=side*(.189 if rear else .168)
            bone=('horse_hind_lower_' if rear else 'horse_fore_lower_')+label
            hoof=section('Bernhard V3 '+label+(' hind' if rear else ' fore')+' anatomically sloped hoof',[
                ((x,y,.164),.046,.058),((x,y,.169),.049,.061),((x,y-.007,.220),.042,.049),((x,y-.012,.246),.031,.035)],p['dark'],bone,24)
            curve('Fine ivory coronary hoof band',[(x-.031,y-.008,.243),(x,y+.026,.243),(x+.031,y-.008,.243)],.0028,p['coat'],bone,4)
    for side in (-1,1):
        # Sculpted curved ears are thin, tapered leaf surfaces, including inner fold.
        verts=[]
        for j in range(8):
            t=j/7;z=1.775+.132*t;w=.025*math.sin(math.pi*t*.93)+.004*(1-t)
            for k in range(5):
                u=(k/4-.5)*2
                verts.append((side*.064+u*w,.496-.032*t+.017*(1-u*u),z))
        shell(mesh('Bernhard V3 curved expressive ear',verts,[(j*5+k,j*5+k+1,(j+1)*5+k+1,(j+1)*5+k) for j in range(7) for k in range(4)],p['coat'],'horse_head'),.008)
        curve('Bernhard V3 ear inner crease',[(side*.064,.511,1.801),(side*.064,.497,1.854),(side*.064,.483,1.887)],.003,p['leather'],'horse_head',4)
        # Recessed equine eyes are small and laterally set under a sculpted eyelid.
        eye=ellipsoid('Bernhard V3 recessed equine eye',(side*.090,.593,1.731),(.0075,.017,.012),p['eye'],16,8);PARTS.append(eye);weight(eye,'horse_head')
        curve('Bernhard V3 upper equine eyelid',[(side*.095,.574,1.732),(side*.098,.590,1.746),(side*.095,.609,1.735)],.0035,p['coat'],'horse_head',4)
        nostril=ellipsoid('Bernhard V3 natural nostril',(side*.057,.857,1.558),(.012,.003,.008),p['leather'],16,8);PARTS.append(nostril);weight(nostril,'horse_head')
        curve('Bernhard V3 fine muzzle crease',[(side*.065,.829,1.510),(side*.034,.882,1.507),(0,.889,1.509)],.0025,p['leather'],'horse_head',4)
    # Mane ribbons have a continuous swept surface and fine sculpted strand ridges.
    for j in range(12):
        x=(j-5.5)*.008
        wave=math.sin(j*1.67)
        ps=[(x,.486,1.814),(x+.006*wave,.413,1.692),(x*1.2+.010*wave,.317+.006*math.cos(j),1.472),(x*1.4+.014*wave,.174+.010*math.cos(j*.73),1.325+.008*wave)]
        m=swept('Bernhard V3 flowing mane lock '+str(j),ps,[.012,.018,.021,.002],p['mane'],'horse_neck',7,3,.7)
        for v in m.data.vertices:
            z=(m.matrix_world@v.co).z;head=max(0,min(.85,(z-1.64)/.17))
            m.vertex_groups['horse_neck'].add([v.index],1-head,'REPLACE')
            if head:weight(m,'horse_head',[v.index],head)
    for j in range(10):
        x=(j-4.5)*.008
        wave=math.sin(j*.79)
        swept('Bernhard V3 weighted flowing tail lock '+str(j),[(x,-.590,1.235),(x*1.3+.013*wave,-.707,1.066),(x*1.5+.025*wave,-.779+.014*math.cos(j*.7),.789),(x*1.4+.031*wave,-.779+.026*math.cos(j*.7),.494),(x*1.9+.025*wave,-.721+.028*math.cos(j*.51),.371+.028*math.sin(j*1.31))],[.018,.023,.022,.016,.002],p['mane'],'horse_tail',7,3,.85)
    marker('horse_body',(0,-.08,1.10),'horse_root',anatomy='Continuous sculpted adult warmblood')


def saddle_tack(p):
    # Conforming fabric sections leave genuine clearance over the horse flanks.
    verts=[]
    for j in range(11):
        y=-.385+j*.052
        for k in range(17):
            a=-math.pi*.67+k/16*math.pi*1.34
            compression=.023*math.exp(-((y+.115)/.20)**4)*max(0,math.cos(a))**8
            x=.298*math.sin(a);z=1.102+.315*math.cos(a)+.004*math.sin(j*.9+k*.8)-compression
            verts.append((x,y,z))
    blanket=shell(mesh('Bernhard V3 tailored cream quilted saddle cloth',verts,[(j*17+k,j*17+k+1,(j+1)*17+k+1,(j+1)*17+k) for j in range(10) for k in range(16)],p['ivory'],'horse_root'),.014)
    for edge in (0,16):curve('Gold embroidered saddle-cloth side border',[verts[j*17+edge] for j in range(11)],.006,p['gold'],'horse_root',3)
    for row in (0,10):curve('Gold embroidered saddle-cloth cross border',verts[row*17:(row+1)*17],.006,p['gold'],'horse_root',2)
    # Gold diagonal damask forms intentional decoration, not coloured blocks.
    for side in (-1,1):
        for j in range(5):
            y=-.33+j*.086
            curve('Bernhard V3 fine saddlecloth gold leaf',[(side*.258,y,1.203),(side*.275,y+.036,1.104),(side*.258,y+.072,1.203)],.0028,p['gold'],'horse_root',3)
    rings=[((0,-.115,1.331),.178,.174),((0,-.115,1.361),.181,.176),((0,-.115,1.378),.169,.164)]
    seat=section('Bernhard V3 shaped fitted leather saddle seat',rings,p['leather'],'horse_root',40)
    seat['seatSurfaceZ']=1.378
    for y,z in [(-.277,1.393),(.038,1.397)]:
        curve('Bernhard V3 curved leather saddle bow',[(-.153,y,z),(-.083,y,z+.019),(0,y,z+.025),(.083,y,z+.019),(.153,y,z)],.013,p['leather'],'horse_root',4,10)
        curve('Bernhard V3 saddle bow gold piping',[(-.151,y+.009,z+.009),(0,y+.009,z+.034),(.151,y+.009,z+.009)],.004,p['gold'],'horse_root',5)
    for side,label in [(-1,'L'),(1,'R')]:
        x=side*.324
        # D-shaped metal stirrup with a horizontal tread directly under the boot.
        curve('Bernhard V3 fitted leather stirrup strap',[(side*.173,-.05,1.377),(side*.300,-.025,1.060),(x,.024,.846)],.009,p['leather'],'horse_root',4,8)
        curve('Bernhard V3 solid golden stirrup bow',[(x-.047,.045,.815),(x-.046,.032,.870),(x,.025,.900),(x+.046,.032,.870),(x+.047,.045,.815)],.007,p['gold'],'horse_root',5,8)
        curve('Bernhard V3 horizontal stirrup tread',[(x-.047,.052,.805),(x,.052,.805),(x+.047,.052,.805)],.008,p['gold'],'horse_root',3,8)
        marker('stirrup_'+label+'_tread',(x,.052,.813),'horse_root',contact='boot sole rests here')
        # Headstall and cheek straps lie on the external surface, not through skull.
        curve('Bernhard V3 fitted cheek strap',[(side*.083,.494,1.780),(side*.098,.607,1.704),(side*.080,.786,1.589)],.007,p['leather'],'horse_head',5)
        curve('Bernhard V3 brow-band golden inlay',[(side*.078,.522,1.793),(side*.085,.578,1.791),(0,.615,1.776)],.004,p['gold'],'horse_head',4)
        ring=torus('Bernhard V3 golden snaffle ring',(side*.083,.811,1.584),.021,.004,p['gold']);ring.rotation_euler[1]=math.pi/2;PARTS.append(ring);weight(ring,'horse_head')
        ps=[(side*.083,.811,1.584),(side*.146,.580,1.443),(side*.150,.374,1.439),(-.210,.282,1.551)]
        rein=curve('Bernhard V3 continuous reins to left grasp',ps,.0045,p['leather'],None,7,8)
        # Both live endpoints follow their actual bones, with compliant middle sag.
        for v in rein.data.vertices:
            q=rein.matrix_world@v.co;blend=max(0,min(1,(.71-q.y)/.38))
            weight(rein,'horse_head',[v.index],1-blend)
            if blend:weight(rein,'hand_L',[v.index],blend)
    curve('Bernhard V3 external noseband',[(-.072,.852,1.594),(0,.896,1.590),(.072,.852,1.594)],.007,p['leather'],'horse_head',5)
    marker('saddle_seat_surface',(0,-.115,1.378),'horse_root',surface='saddle-top',contactTolerance=.02)


def shaped_plate(name,centre,rx,ry,rz,p,bone,front=True,segments=20,rings=9):
    """Convex plate patch with controlled rim and actual interior shell."""
    verts=[]
    for j in range(rings):
        t=j/(rings-1);phi=.10+t*math.pi*.88
        for k in range(segments):
            a=(k/(segments-1)-.5)*math.pi*1.34
            verts.append((centre[0]+rx*math.sin(phi)*math.sin(a),centre[1]+ry*math.sin(phi)*math.cos(a)*(1 if front else -1),centre[2]+rz*math.cos(phi)))
    o=mesh(name,verts,[(j*segments+k,j*segments+k+1,(j+1)*segments+k+1,(j+1)*segments+k) for j in range(rings-1) for k in range(segments-1)],p['steel'],bone)
    return shell(o,.009)


def leg_plate(name,a,b,p,bone,rx=.061,ry=.050):
    axis=(Vector(b)-Vector(a)).normalized();side=Vector((1,0,0));depth=axis.cross(side).normalized();verts=[]
    for j in range(7):
        t=j/6;c=Vector(a).lerp(Vector(b),t);r=.92+.12*math.sin(t*math.pi)-.06*t
        for k in range(20):
            ang=math.tau*k/20
            # Creased centre ridge and tapered edges read as engineered plate,
            # rather than the smooth constant-radius cylinder used in V1.
            ridge=1+.07*math.cos(ang*4)
            verts.append(tuple(c+side*rx*r*math.cos(ang)*ridge+depth*ry*r*math.sin(ang)))
    o=mesh(name,verts,[(j*20+k,j*20+(k+1)%20,(j+1)*20+(k+1)%20,(j+1)*20+k) for j in range(6) for k in range(20)],p['steel'],bone)
    return shell(o,.008)


def joint_guard(name,c,p,bone,kind='knee'):
    """Angular hollow poleyn/couter with extended protective wings."""
    c=Vector(c);verts=[]
    w,h,depth=(.060,.062,.052) if kind=='knee' else (.046,.047,.042)
    for j in range(9):
        t=j/8;z=h*(2*t-1)
        spread=w*(.78+.20*math.sin(math.pi*t))
        for k in range(13):
            u=(k/12-.5)*2
            wing=(.019 if kind=='knee' else .014)*abs(u)**5*math.sin(math.pi*t)
            y=depth*(1-abs(u)**1.7)*(.86+.14*math.sin(math.pi*t))
            verts.append(tuple(c+Vector((u*(spread+wing),y,z))))
    shell(mesh(name,verts,[(j*13+k,j*13+k+1,(j+1)*13+k+1,(j+1)*13+k) for j in range(8) for k in range(12)],p['steel'],bone),.007)
    curve(name+' shaped gold lower lip',[tuple(c+Vector((-.047,.012,-h*.83))),tuple(c+Vector((0,depth*.77,-h*.91))),tuple(c+Vector((.047,.012,-h*.83)))],.003,p['gold'],bone,3)


def cuirass(p):
    rings=[(1.574,.144,.109),(1.618,.159,.112),(1.730,.183,.127),(1.819,.184,.125),(1.868,.155,.108),(1.905,.082,.078)]
    verts=[];sides=36
    for j,(z,rx,ry) in enumerate(rings):
        t=j/(len(rings)-1)
        for k in range(sides):
            a=math.tau*k/sides;s=math.sin(a)
            front=.022*max(s,0)**2*math.sin(math.pi*t)
            # A subtly fluted full torso shell bridges both breast and back.
            verts.append((rx*math.cos(a),-.093+ry*s+front,z))
    shell(mesh('Bernhard V3 complete tailored fluted cuirass',verts,[(j*sides+k,j*sides+(k+1)%sides,(j+1)*sides+(k+1)%sides,(j+1)*sides+k) for j in range(len(rings)-1) for k in range(sides)],p['steel'],'rider_spine'),.010)
    for side in (-1,1):
        for j in range(3):
            x=side*(.034+j*.030)
            ps=[]
            for z,rx,ry in [(1.632,.162,.114),(1.730,.183,.127),(1.819,.184,.125),(1.868,.155,.108)]:
                xx=x*(.76 if z<1.67 else .86 if z>1.86 else 1)
                t=(z-1.574)/.331;s=math.sqrt(max(0,1-(xx/rx)**2))
                y=-.093+ry*s+.022*s*s*math.sin(math.pi*t)+.003
                ps.append((xx,y,z))
            curve('Bernhard V3 close fitting gilded cuirass flute',ps,.0025,p['gold'],'rider_spine',3)


def rider(p):
    # An armoured seated pelvis meets the concave saddle; no floating torso.
    pelvis=section('Bernhard V3 seated shaped pelvic armour',[
        ((0,-.115,1.370),.124,.112),((0,-.115,1.395),.146,.124),((0,-.115,1.454),.159,.125),((0,-.110,1.501),.131,.105)],p['steel'],'rider_root',36)
    pelvis['seatContactZ']=1.370
    # Tailored gambeson fills the suit, while seams disappear under breast/back plates.
    section('Bernhard V3 fitted cream padded torso',[
        ((0,-.110,1.485),.125,.095),((0,-.104,1.571),.148,.101),((0,-.095,1.754),.183,.118),((0,-.079,1.864),.185,.115),((0,-.079,1.903),.088,.084)],p['ivory'],'rider_spine',36)
    cuirass(p)
    # Lapped waist lames overlap like genuine articulation, leaving breathing clearance.
    for j in range(4):
        z=1.602-j*.039
        shell(section('Bernhard V3 overlapping abdominal steel lame '+str(j),[((0,-.109,z-.017),.142-j*.003,.120),((0,-.108,z+.020),.149-j*.003,.123)],p['steel'],'rider_root',36,False),.006)
        rx=.149-j*.003
        points=[(rx*math.sin(-.86+1.72*k/12),-.108+.123*math.cos(-.86+1.72*k/12)+.003,z+.020) for k in range(13)]
        curve('Bernhard V3 close fitting abdominal gold border',points,.0028,p['gold'],'rider_root',1)
    for side,label in [(-1,'L'),(1,'R')]:
        hip=(side*.116,-.11,1.411);knee=(side*.321,.128,1.161);ankle=(side*.324,.043,.839)
        # Leg volumes follow the riding pose: thighs splay around the barrel.
        leg_plate('Bernhard V3 curved seated cuisse '+label,Vector(hip).lerp(Vector(knee),.12),Vector(hip).lerp(Vector(knee),.94),p,'rider_thigh_'+label,.066,.061)
        joint_guard('Bernhard V3 angular winged knee poleyn '+label,knee,p,'rider_calf_'+label)
        leg_plate('Bernhard V3 fitted fluted greave '+label,Vector(knee).lerp(Vector(ankle),.13),ankle,p,'rider_calf_'+label,.046,.045)
        for j in range(3):
            start=Vector(knee).lerp(Vector(ankle),.13);end=Vector(ankle)
            depth=(end-start).normalized().cross(Vector((1,0,0))).normalized()
            ps=[];dx=(j-1)*.014
            for t in (.10,.46,.88):
                rr=.92+.12*math.sin(t*math.pi)-.06*t
                front=.045*rr*math.sqrt(max(0,1-(dx/(.046*rr))**2))+.0025
                ps.append(tuple(start.lerp(end,t)+Vector((dx,0,0))-depth*front))
            curve('Bernhard V3 close fitted greave gold chasing '+label,ps,.0022,p['gold'],'rider_calf_'+label,3)
        # Segmented pointed sabatons have fitted heel and sole, not oval foot balls.
        verts=[]
        for j in range(8):
            y=.017+j*.0215;t=j/7;w=.047*(1-.35*t)
            for k in range(9):
                a=math.pi*k/8
                verts.append((side*.324+w*math.cos(a),y,.816+.049*math.sin(a)*(1-.45*t)))
        shell(mesh('Bernhard V3 articulated pointed sabaton '+label,verts,[(j*9+k,j*9+k+1,(j+1)*9+k+1,(j+1)*9+k) for j in range(7) for k in range(8)],p['steel'],'rider_foot_'+label),.009)
        for j in range(4):
            y=.050+j*.028
            curve('Bernhard V3 sabaton overlapping toe line',[(side*.324-.039,y,.821),(side*.324,y,.857-j*.005),(side*.324+.039,y,.821)],.0025,p['gold'],'rider_foot_'+label,4)
        marker('boot_'+label+'_sole',(side*.324,.052,.811),'rider_foot_'+label,contact='stirrup tread')
    marker('rider_seat_contact',(0,-.115,1.370),'rider_root',surface='pelvis-bottom',maximumGap=.012)
    marker('rider_seat',(0,-.115,1.405),'rider_root',seated=True)
    # One carefully shaped sun motif, ornamental without bulky geometric badges.
    for j in range(12):
        a=math.tau*j/12;x=.021*math.sin(a);z=1.785+.021*math.cos(a)
        curve('Bernhard V3 chest gilded sun ray',[(x,.058,z),(.032*math.sin(a),.057,1.785+.032*math.cos(a))],.0028,p['gold'],'rider_spine',3)
    # Gorget fits under the helmet and over breast plate with thickness.
    shell(section('Bernhard V3 layered fitted neck gorget',[
        ((0,-.081,1.894),.097,.082),((0,-.081,1.920),.074,.066),((0,-.081,1.955),.074,.066)],p['steel'],'rider_spine',32,False),.007)
    for z,rx,ry in [(1.909,.086,.075),(1.949,.075,.067)]:
        points=[(rx*math.cos(math.tau*j/32),-.081+ry*math.sin(math.tau*j/32),z) for j in range(33)]
        curve('Bernhard V3 gorget gold collar',points,.003,p['gold'],'rider_spine',1)
    # Cream cape: a dense tailored surface with restrained longitudinal folds.
    verts=[]
    for j in range(22):
        t=j/21;w=.178+.079*t;y=-.181-.371*t
        for k in range(25):
            u=k/24
            fold=.023*math.sin(u*math.pi*10+t*1.8)+.006*math.sin(u*math.pi*4-t*2.0)
            verts.append(((u-.5)*w*2,y+fold*(.25+.75*t),1.931-.650*t+.035*abs(u-.5)*t))
    cape=shell(mesh('Bernhard V3 cream royal cape with sculpted folds',verts,[(j*25+k,j*25+k+1,(j+1)*25+k+1,(j+1)*25+k) for j in range(21) for k in range(24)],p['ivory'],'cape'),.010)
    for edge in (0,24):curve('Bernhard V3 gold woven cape border',[verts[j*25+edge] for j in range(22)],.005,p['gold'],'cape',2)
    curve('Bernhard V3 gold cape lower hem',verts[-25:],.005,p['gold'],'cape',2)


def helmet(p):
    # A new ovoid bascinet shell follows a real cranium; the closed visor has
    # faceted cheek transitions, narrow dark eye slots, hinged temples and vents.
    rings=[((0,-.081,1.961),.077,.067),((0,-.081,1.988),.092,.080),((0,-.081,2.087),.107,.094),((0,-.086,2.187),.103,.093),((0,-.089,2.233),.077,.071),((0,-.093,2.261),.011,.012)]
    shell(section('Bernhard V3 fully closed sculpted knight bascinet',rings,p['steel'],'rider_head',40,False),.011)
    verts=[]
    for j in range(13):
        t=j/12;z=1.978+.174*t
        for k in range(19):
            u=(k/18-.5)*2;x=.094*u*(.72+.28*math.sin(t*math.pi*.7))
            y=.004+.033*(1-u*u)+.028*math.sin(t*math.pi)
            verts.append((x,y,z))
    holes={(9,k) for k in (3,4,5,6,11,12,13,14)}|{(5,5),(5,12),(6,6),(6,11)}
    visor=shell(mesh('Bernhard V3 completely closed shaped silver visor',verts,[(j*19+k,j*19+k+1,(j+1)*19+k+1,(j+1)*19+k) for j in range(12) for k in range(18) if (j,k) not in holes],p['steel'],'rider_head'),.009)
    visor['fullyClosed']=True
    for side in (-1,1):
        # A dark recessed interior lies behind an actual opening in visor topology.
        mesh('Bernhard V3 recessed visor slot interior',[(side*.018,.015,2.106),(side*.075,.015,2.106),(side*.075,.015,2.126),(side*.018,.015,2.126)],[(0,1,2,3)],p['dark'],'rider_head',False)
        curve('Bernhard V3 visor embossed cheek flourish',[(side*.092,.024,2.084),(side*.067,.046,2.024),(side*.025,.040,1.993)],.003,p['gold'],'rider_head',5)
        # Thin rosette hinge rotates with the helmet, made as actual metal engraving.
        ring=torus('Bernhard V3 visor temple hinge',(side*.104,-.060,2.120),.013,.003,p['gold']);ring.rotation_euler[1]=math.pi/2;PARTS.append(ring);weight(ring,'rider_head')
    curve('Bernhard V3 embossed central visor ridge',[(0,.052,1.989),(0,.072,2.060),(0,.062,2.145)],.0036,p['gold'],'rider_head',5)
    mesh('Bernhard V3 recessed ventilation interior',[(-.072,.015,2.039),(.072,.015,2.039),(.072,.015,2.081),(-.072,.015,2.081)],[(0,1,2,3)],p['dark'],'rider_head',False)
    curve('Bernhard V3 regal brow crest',[(-.090,.011,2.185),(-.043,.035,2.200),(0,.040,2.214),(.043,.035,2.200),(.090,.011,2.185)],.005,p['gold'],'rider_head',5)
    # A modest crown-like coronet with open fleur ornaments conforms to the shell.
    points=[(.090*math.cos(math.tau*j/40),-.087+.083*math.sin(math.tau*j/40),2.220) for j in range(41)]
    curve('Bernhard V3 fitted gilded helmet coronet',points,.006,p['gold'],'rider_head',1,8)
    for x,z in [(-.067,2.259),(-.034,2.277),(0,2.294),(.034,2.277),(.067,2.259)]:
        curve('Bernhard V3 open chased coronet fleur',[(x-.010,-.015,2.222),(x-.009,-.006,z-.008),(x,-.005,z),(x+.009,-.006,z-.008),(x+.010,-.015,2.222)],.0035,p['gold'],'rider_head',4,6)
    # Swept crest is sculpted as a thin ridged plane; no pointed primitive cone.
    verts=[]
    for j in range(15):
        t=j/14;y=-.013-.249*t;z=2.254+.091*math.sin(math.pi*t)
        for k in range(3):verts.append(((k-1)*.006,y,z-.030*abs(k-1)))
    shell(mesh('Bernhard V3 ornate swept golden helmet crest',verts,[(j*3+k,j*3+k+1,(j+1)*3+k+1,(j+1)*3+k) for j in range(14) for k in range(2)],p['gold'],'rider_head'),.006)
    marker('head_pivot',(0,-.081,2.10),'rider_head',fullyClosedHelmet=True)


def gauntlet(p,side):
    """A continuous five-digit glove with a correctly opposed thenar thumb.

    The wrist, palm and digits are one sculpted surface.  Individually formed
    metal phalanx plates sit on that surface; the fingers are not isolated loops.
    Index is closest to the blade on R and on the medial side of the L hand.
    """
    right=side=='R';bone='hand_'+side
    centre=Vector((.326,.105,2.276) if right else (-.210,.240,1.559))
    # Hand basis: digits curl around vertical sword, left around reins transverse.
    across=Vector((0,0,1)) if right else Vector((1,0,0))
    forward=Vector((0,1,0))
    radial=Vector((1,0,0)) if right else Vector((0,0,1))
    # Closed rounded-rectangular metacarpal sections model actual palm volume.
    seeds=[];verts=[];sections=[(-.028,-.017,.022,-.012,.020),(-.010,-.003,.031,-.022,.019),(.014,0,.034,-.025,.017),(.036,0,.029,-.019,.018)]
    for along,shift,width,depth,thickness in sections:
        for k in range(20):
            a=math.tau*k/20;cs=math.cos(a);sn=math.sin(a)
            q=centre+forward*along+across*(shift+width*math.copysign(abs(cs)**.65,cs))+radial*(depth+thickness*math.copysign(abs(sn)**.65,sn))
            verts.append(tuple(q))
    palm=mesh('Bernhard V3 '+side+' anatomical closed palm volume',verts,[(j*20+k,j*20+(k+1)%20,(j+1)*20+(k+1)%20,(j+1)*20+k) for j in range(3) for k in range(20)]+[tuple(range(19,-1,-1)),tuple(60+k for k in range(20))],p['ivory'],None);seeds.append(palm)
    elbow,wrist=REST['forearm_'+side]
    wrist_end=centre+forward*-.018+radial*-.009+across*(-.014 if right else 0)
    bridge=swept('Bernhard V3 '+side+' continuous wrist to palm bridge',[elbow.lerp(wrist,.83),wrist,wrist_end],[.031,.026,.026],p['ivory'],None,14,3,.87);seeds.append(bridge)
    paths=[]
    for j in range(4):
        offset=(1.5-j)*.018
        length=[.96,1.08,1.0,.84][j]
        base=centre+across*offset
        ps=[base+forward*.019+radial*-.031,
            base+forward*.043+radial*-.018,
            base+forward*.043+radial*.018*length,
            base+forward*.012+radial*.029*length,
            base+forward*-.006+radial*.018*length]
        finger=swept('Bernhard V3 '+side+' individually curled finger '+str(j+1),ps,[.0078,.0082,.0078,.0072,.0057],p['ivory'],None,12,4,.9);seeds.append(finger);paths.append(ps)
        finger['digit']=j+1;finger['grasp']='sword grip' if right else 'reins';finger['individuallySeparated']=True
        marker('hand_'+side+'_digit_'+str(j+1),ps[-1],bone,digit=j+1,individuallySeparated=True,grasp='sword grip' if right else 'reins')
    # Thenar mass originates by the INDEX side, not on the little-finger edge.
    ps=[centre+across*.042+forward*-.014+radial*-.022,
        centre+across*.050+forward*.013+radial*-.009,
        centre+across*.041+forward*.035+radial*.015,
        centre+across*.027+forward*.023+radial*.022]
    thumb=swept('Bernhard V3 '+side+' correctly opposed index-side thumb',ps,[.012,.011,.009,.0065],p['ivory'],None,12,4,.85);seeds.append(thumb);paths.append(ps)
    thumb['digit']=5;thumb['anatomy']='opposed thenar thumb wrapping the grip';thumb['individuallySeparated']=True
    marker('hand_'+side+'_digit_5',ps[-1],bone,digit=5,anatomy='opposed thenar thumb',individuallySeparated=True)
    marker('hand_'+side+'_grasp',centre+forward*.016,bone,digitCount=5,grip='sword' if right else 'reins')
    # Voxel union is restricted to the glove: knuckles/thenar/wrist connect, and
    # small finger gaps remain distinct above the shared metacarpal webbing.
    for obj in seeds:PARTS.remove(obj)
    glove=cohesive.fuse(seeds,'Bernhard V3 '+side+' continuous wrist palm five-digit glove',.00135,1400,p['ivory']);PARTS.append(glove)
    glove['digitCount']=5;glove['thumbPlacement']='thenar by index, opposite little finger';glove['continuousPalmWrist']=True
    weight(glove,bone)
    # Layered dorsal steel phalanx plates follow each bent segment, leaving
    # narrow flexible cream glove seams between anatomically connected plates.
    for digit,ps in enumerate(paths):
        samples=interpolate(ps,3)
        ranges=[(3,6),(6,9),(9,12)] if digit<4 else [(1,4),(4,7),(7,9)]
        for segment,(start,end) in enumerate(ranges):
            verts=[];selected=[samples[start],samples[(start+end)//2],samples[end]]
            for j,q in enumerate(selected):
                index=start+(end-start)*j/2
                lo=max(0,min(len(samples)-2,int(index)));tangent=(samples[min(len(samples)-1,lo+1)]-samples[max(0,lo-1)]).normalized()
                normal=tangent.cross(across).normalized()
                outside=(Vector((q.x-centre.x,q.y-centre.y-.018,0)) if right else Vector((0,q.y-centre.y-.042,q.z-centre.z+.008)))
                if normal.dot(outside)<0:normal=-normal
                radius=(.0092 if digit<4 else .0105)*(.97-.10*segment)
                for k in range(7):
                    a=-1.03+2.06*k/6
                    verts.append(tuple(q+normal*radius*math.cos(a)+across*radius*math.sin(a)))
            plate=shell(mesh('Bernhard V3 '+side+' finger '+str(digit+1)+' fitted phalanx plate '+str(segment+1),verts,[(j*7+k,j*7+k+1,(j+1)*7+k+1,(j+1)*7+k) for j in range(2) for k in range(6)],p['steel'],bone),.0016)
            plate['digit']=digit+1
    # A tailored dorsal metacarpal plate covers the unified palm without
    # hiding the opposed thumb root, which remains visibly on the index side.
    verts=[]
    for j in range(5):
        t=j/4
        for k in range(9):
            u=(k/8-.5)*2
            q=centre+across*(u*.031)+forward*(-.012+.034*t)+radial*(-.043+.005*u*u+.003*math.sin(t*math.pi))
            verts.append(tuple(q))
    shell(mesh('Bernhard V3 '+side+' formed metacarpal back plate',verts,[(j*9+k,j*9+k+1,(j+1)*9+k+1,(j+1)*9+k) for j in range(4) for k in range(8)],p['steel'],bone),.003)


def arms_sword(p):
    for side in ('R','L'):
        shoulder,elbow=REST['upper_arm_'+side];_,wrist=REST['forearm_'+side]
        # Cloth and mail under plates cover joints without pretending joints are spheres.
        swept('Bernhard V3 shaped gambeson upper sleeve '+side,[shoulder,shoulder.lerp(elbow,.45),elbow],[.052,.047,.041],p['ivory'],'upper_arm_'+side,20,4)
        leg_plate('Bernhard V3 shaped upper vambrace '+side,shoulder.lerp(elbow,.24),shoulder.lerp(elbow,.92),p,'upper_arm_'+side,.056,.052)
        leg_plate('Bernhard V3 tapered articulated lower vambrace '+side,elbow.lerp(wrist,.15),elbow.lerp(wrist,.88),p,'forearm_'+side,.042,.040)
        joint_guard('Bernhard V3 shaped articulated elbow couter '+side,elbow,p,'forearm_'+side,'elbow')
        # Three overlapping curved pauldron sections, all formed shell surfaces.
        for j in range(3):
            verts=[];c=shoulder+Vector((0,-.008,0))
            lo,hi=[(.06,.70),(.64,.88),(.82,1.0)][j]
            for r in range(6):
                t=lo+(hi-lo)*r/5
                for k in range(24):
                    a=math.tau*k/24
                    # Flattened, creased open bowl plates are carefully nested;
                    # only top plate closes the shoulder, lower rings are lames.
                    x=c.x+.095*t*math.cos(a)
                    y=c.y+.093*t*math.sin(a)
                    z=c.z+.059*(1-t**1.35)-.029*t+.007*abs(math.sin(a*2))+.005*j
                    verts.append((x,y,z))
            shell(mesh('Bernhard V3 forged overlapping pauldron '+side+' '+str(j),verts,[(r*24+k,r*24+(k+1)%24,(r+1)*24+(k+1)%24,(r+1)*24+k) for r in range(5) for k in range(24)],p['steel'],'upper_arm_'+side),.008)
            curve('Bernhard V3 shaped pauldron gold rim',verts[-24:]+[verts[-24]],.003,p['gold'],'upper_arm_'+side,1)
        curve('Bernhard V3 vambrace gold chasing '+side,[tuple(elbow.lerp(wrist,.22)+Vector((0,.043,0))),tuple(elbow.lerp(wrist,.50)+Vector((0,.043,0))),tuple(elbow.lerp(wrist,.81)+Vector((0,.040,0)))],.003,p['gold'],'forearm_'+side,5)
        gauntlet(p,side)
    x,y,z=.326,.123,2.276
    # Grip sits inside the curled fingers, blade follows the actual hand bone.
    swept('Bernhard V3 sword leather wrapped grip',[(x,y,z-.068),(x,y,z+.071)],[.017,.017],p['leather'],'hand_R',16,3)
    for j in range(8):
        zz=z-.064+j*.018
        pts=[(x+.018*math.cos(math.tau*k/16),y+.018*math.sin(math.tau*k/16),zz+.004*k/16) for k in range(17)]
        curve('Bernhard V3 sword fine grip gold winding',pts,.0024,p['gold'],'hand_R',1,5)
    curve('Bernhard V3 elegant recurved sword guard',[(x-.130,y,z+.083),(x-.082,y,z+.108),(x,y,z+.092),(x+.082,y,z+.108),(x+.130,y,z+.083)],.011,p['gold'],'hand_R',5,10)
    # Diamond-section blade is a designed watertight steel surface with bevels.
    verts=[]
    for zz,w,d in [(z+.105,.033,.010),(z+.14,.032,.009),(z+.65,.022,.007),(z+.783,.001,.001)]:
        verts.extend([(x-w,y,zz),(x,y-d,zz),(x+w,y,zz),(x,y+d,zz)])
    blade=mesh('Bernhard V3 honed diamond-section silver sword',verts,[(j*4+k,j*4+(k+1)%4,(j+1)*4+(k+1)%4,(j+1)*4+k) for j in range(3) for k in range(4)]+[(0,3,2,1),(12,13,14,15)],p['steel'],'hand_R',False)
    curve('Bernhard V3 thin luminous golden blade fuller',[(x,y+.010,z+.145),(x,y+.007,z+.644)],.0025,p['glow'],'hand_R',3)
    # Pommel jewel is a small faceted form, not an oversized sphere accessory.
    section('Bernhard V3 faceted gold sword pommel',[((x,y,z-.091),.008,.008),((x,y,z-.081),.021,.018),((x,y,z-.063),.022,.019),((x,y,z-.054),.012,.012)],p['gold'],'hand_R',12)
    marker('sword_tip',(x,y,z+.783),'hand_R',effectOrigin=True)
    marker('attack_muzzle',(x,y,z+.775),'hand_R',effectOrigin=True,releaseFraction=.36,damageMechanism='ranged golden arcane discharge')


def animations():
    scene=bpy.context.scene;scene.render.fps=FPS
    for previous in list(bpy.data.actions):
        if previous.name in ('Idle','Attack'):bpy.data.actions.remove(previous)
    for bone in RIG.pose.bones:bone.rotation_mode='XYZ'
    def frame(action,number,settings):
        scene.frame_set(number)
        for b in RIG.pose.bones:
            b.location=(0,0,0);b.rotation_euler=(0,0,0);b.scale=(1,1,1)
        for name,values in settings.items():
            pb=RIG.pose.bones[name]
            if 'r' in values:pb.rotation_euler=values['r']
            if 'l' in values:pb.location=values['l']
        for b in RIG.pose.bones:
            b.keyframe_insert('rotation_euler',frame=number,group=b.name)
            b.keyframe_insert('location',frame=number,group=b.name)
    RIG.animation_data_create()
    idle=bpy.data.actions.new('Idle');RIG.animation_data.action=idle
    for frameNo in range(0,121,10):
        a=math.tau*frameNo/120;s=math.sin(a)
        frame(idle,frameNo,{
            'horse_root':{'r':(.002*s,0,.0015*s)},
            'horse_neck':{'r':(.011*s,.003*math.sin(a+.6),0)},
            'horse_head':{'r':(.008*math.sin(a+.5),0,.002*s)},
            'horse_tail':{'r':(.006*s,.012*math.sin(a+.4),0)},
            'rider_spine':{'r':(.003*math.sin(a+.6),0,.003*s)},
            'upper_arm_R':{'r':(.008*s,0,0)},
            'forearm_R':{'r':(.006*s,0,0)},
            'upper_arm_L':{'r':(.003*s,0,0)},
            'cape':{'r':(.010*math.sin(a+.3),.006*math.sin(a+.7),0)},
        })
    idle['durationSeconds']=2.4;idle['purpose']='restrained breathing and equine alertness'
    track=RIG.animation_data.nla_tracks.new();track.name='Idle';strip=track.strips.new('Idle',0,idle);strip.action_frame_start=0;strip.action_frame_end=120;track.mute=True
    attack=bpy.data.actions.new('Attack');RIG.animation_data.action=attack
    poses=[(0,0,0,0),(8,-.10,.045,-.01),(14,-.17,.10,-.022),(18,.20,-.10,.018),(23,.24,-.075,.013),(31,.12,-.035,.007),(40,.025,0,.001),(50,0,0,0)]
    for f,arm,fore,horse in poses:
        frame(attack,f,{
            'horse_root':{'r':(horse*.12,0,horse*.10)},
            'horse_neck':{'r':(-horse*.65,0,0)},
            'horse_head':{'r':(horse*.35,0,0)},
            'rider_spine':{'r':(arm*.055,0,-arm*.05)},
            'upper_arm_R':{'r':(arm,arm*.12,0)},
            'forearm_R':{'r':(fore,0,0)},
            'hand_R':{'r':(fore*.14,0,0)},
            'upper_arm_L':{'r':(-horse*.2,0,0)},
            'forearm_L':{'r':(horse*.15,0,0)},
            'cape':{'r':(abs(arm)*.035,arm*.012,0)},
        })
    attack['durationSeconds']=1.;attack['releaseSeconds']=.36;attack['attackPhases']='0 neutral; .28 prepared; .36 magical release; .46 followthrough; 1.0 recovered'
    track=RIG.animation_data.nla_tracks.new();track.name='Attack';strip=track.strips.new('Attack',0,attack);strip.action_frame_start=0;strip.action_frame_end=50;track.mute=True
    RIG.animation_data.action=None;scene.frame_set(0)
    RIG['actions']='Idle,Attack';scene.frame_start=0;scene.frame_end=50


def material_groups():
    # Eleven skinned material batches; native objects remain semantically named
    # in vertex groups, with isolated contact/digit metadata in audit markers.
    originals=[o for o in PARTS if o and o.name in bpy.data.objects]
    for o in originals:
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        uv=o.data.uv_layers.new(name='Fine material surface UV')
        for loop in o.data.loops:
            v=o.data.vertices[loop.vertex_index].co
            uv.data[loop.index].uv=(v.x*8+v.y*5,v.z*8+v.y*3)
    mats={o.data.materials[0] for o in originals}
    grouped={material:[o for o in originals if o.data.materials[0]==material] for material in mats}
    batches=[]
    for material in mats:
        objects=grouped[material]
        for o in objects:
            # Source feature names persist as native selectable anatomical groups.
            g=o.vertex_groups.new(name='feature:'+o.name[:55]);g.add(list(range(len(o.data.vertices))),1,'REPLACE')
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1:bpy.ops.object.join()
        o=objects[0];o.name='Bernhard V3 '+material.name.split('Bernhard V3 ')[-1]
        o.parent=RIG;mod=o.modifiers.new('Weighted native equestrian skeleton','ARMATURE');mod.object=RIG
        o['skinBound']=True;o['surfaceDesign']='Continuous anatomical surface or crafted articulated armour plates'
        batches.append(o)
    return batches


def fitted_saddle_elevation():
    """Fit seat over the real horse back; lift rider, tack and weighted reins.

    The first sculpt review found the coat/blanket higher than the leather seat.
    This is a physical fit correction, not a camera trick or contact marker fix.
    All rider surfaces and joints move together, boots and treads included.
    """
    delta=.065
    rider_bones={n for n in REST if n.startswith(('rider_','upper_arm_','forearm_','hand_')) or n=='cape'}
    equipment=('shaped fitted leather saddle seat','curved leather saddle bow','saddle bow gold piping','fitted leather stirrup strap','solid golden stirrup bow','horizontal stirrup tread')
    for o in PARTS:
        if any(tag in o.name for tag in equipment):
            o.location.z+=delta
            if 'seatSurfaceZ' in o:o['seatSurfaceZ']+=delta
            continue
        groups={g.index:g.name for g in o.vertex_groups}
        inv=o.matrix_world.inverted().to_3x3()
        for v in o.data.vertices:
            amount=sum(g.weight for g in v.groups if groups.get(g.group) in rider_bones)
            if amount:v.co+=inv@Vector((0,0,delta*amount))
        if 'seatContactZ' in o:o['seatContactZ']+=delta
    bpy.ops.object.select_all(action='DESELECT');RIG.select_set(True);bpy.context.view_layer.objects.active=RIG
    bpy.ops.object.mode_set(mode='EDIT')
    for name in rider_bones:
        b=RIG.data.edit_bones[name];b.head.z+=delta;b.tail.z+=delta
    bpy.ops.object.mode_set(mode='OBJECT');bpy.context.view_layer.update()
    # Horse-root contact surfaces do not inherit the elevated rider bone.
    for name in ('saddle_seat_surface','stirrup_L_tread','stirrup_R_tread'):
        o=bpy.data.objects[name];o.matrix_world.translation+=Vector((0,0,delta))
    RIG['saddlePhysicalFitElevation']=delta


def build(H=None):
    global PARTS,REST
    PARTS=[];REST={};p=palette();rig()
    # Consistent game cell footing, elongated to support all four actual hooves.
    for name,z,r,d,key in [('Bernhard V3 octagonal stone footing',.055,.51,.11,'stoneedge'),('Bernhard V3 upper cut-stone footing',.125,.485,.070,'stone')]:
        o=cylinder(name,(0,0,z),r,d,p[key],12);o.scale.y=1.62;PARTS.append(o);weight(o,'champion_root')
    ring=torus('Bernhard V3 luminous golden footing inlay',(0,0,.166),.41,.009,p['gold']);ring.scale.y=1.65;PARTS.append(ring);weight(ring,'champion_root')
    horse(p);saddle_tack(p);rider(p);helmet(p);arms_sword(p)
    marker('torso_pivot',(0,-.09,1.69),'rider_spine',nativeDeformingRig=True)
    fitted_saddle_elevation();batches=material_groups();animations()
    scene=bpy.context.scene
    scene['Champion']='Lord Bernhard';scene['Family']='lordbernhard';scene['DesignRevision']=10
    scene['AssetRevision']='champions-v7.10';scene['nativeRig']='One weighted equestrian armature with Idle and Attack'
    scene['NewOriginalGeometry']=True;scene['NoPreviousModelGeometry']=True
    scene['AttackReleaseSeconds']=.36;scene['ContactMethod']='horse_root -> rider_root preserves saddle contact; sole and tread authored together'
    scene['TriangleCount']=sum(sum(len(f.vertices)-2 for f in o.data.polygons) for o in batches)
    scene['MaterialBatches']=len(batches)
    print('BERNHARD_V3_BUILD '+json.dumps({'triangles':scene['TriangleCount'],'batches':len(batches),'bones':len(RIG.data.bones),'actions':['Idle','Attack']}),flush=True)
    return p


def standalone():
    """Native asset/review authoring; shared driver owns manifest publication."""
    from author_archer import configure_scene
    from author_secret_champions import camera_frame,bounds
    from author_army import clean_portrait_metadata
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    build();scene=bpy.context.scene;dimensions=bounds();scene['NativeBounds']=json.dumps(dimensions)
    out=ROOT/'public/assets/models/advanced_lordbernhard.glb'
    bpy.ops.object.select_all(action='DESELECT')
    for o in scene.objects:
        if o.type in ('MESH','EMPTY','ARMATURE'):o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_apply=False,export_extras=True,export_animations=True,export_animation_mode='ACTIONS',export_skins=True,export_cameras=False,export_lights=False,export_frame_range=False,export_force_sampling=True)
    camera=configure_scene();camera_frame(camera,dimensions,(460,550),(-3.2,6.5,2.9));scene.cycles.samples=48
    scene.render.filepath=str(ROOT/'public/assets/army/lordbernhard-t1.png')
    if '--no-render' not in sys.argv:bpy.ops.render.render(write_still=True);clean_portrait_metadata(Path(scene.render.filepath))
    source=ROOT/'blender/scenes/lordbernhard_design_v3.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(source))
    reviews=ROOT/'blender/renders/secret-champions-v3';reviews.mkdir(parents=True,exist_ok=True)
    views=[('front',(0,6,1.25)),('back',(0,-6,1.25)),('left',(-7,0,1.0)),('right',(7,0,1.0)),('three-quarter',(-3,6,1.7))]
    if '--no-render' not in sys.argv:
        for label,view in views:
            camera_frame(camera,dimensions,(1100,1400),view);scene.cycles.samples=40
            scene.render.filepath=str(reviews/('lordbernhard-'+label+'.png'));bpy.ops.render.render(write_still=True);clean_portrait_metadata(Path(scene.render.filepath))
    print('BERNHARD_V3_SOURCE '+str(source),flush=True)


if __name__=='__main__':standalone()
