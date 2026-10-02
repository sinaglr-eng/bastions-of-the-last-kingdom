"""Lady Claire V3: original continuous sculpted surfaces and a deforming rig.

The face, body, dress and hands are newly authored; no previous Claire meshes
are imported.  All visible anatomical forms are purpose-shaped mesh surfaces.
"""
import math
import bpy
from pathlib import Path
from mathutils import Vector, Matrix
from author_archer import custom, mat

TAU = math.tau
_PARTS = []
_RIG = None
FACE_PROFILE=[(1.646,.018,.033,.025,-.005),(1.662,.039,.057,.040,-.005),
              (1.687,.061,.070,.060,-.005),(1.720,.078,.078,.077,-.007),
              (1.756,.091,.082,.090,-.006),(1.792,.096,.080,.096,-.008),
              (1.827,.092,.077,.097,-.008),(1.862,.083,.066,.087,-.008),
              (1.896,.061,.045,.063,-.008),(1.924,.018,.015,.018,-.008)]


def material(name, colour, rough=.5, metal=0, emission=0):
    m = mat('Claire V3 ' + name, colour, metal, emission)
    s = m.node_tree.nodes.get('Principled BSDF')
    s.inputs['Roughness'].default_value = rough
    if name == 'Living warm skin':
        s.inputs['Subsurface Weight'].default_value = .07
        s.inputs['Subsurface Radius'].default_value = (.8, .35, .18)
    if 'silk' in name:
        s.inputs['Sheen Weight'].default_value = .22
        # A packed, authored textile normal texture survives the GLB export.
        # This is deliberately not a render-only Noise shader.
        image=bpy.data.images.get('Claire V3 woven satin normal')
        if not image:
            n=512;image=bpy.data.images.new('Claire V3 woven satin normal',n,n,alpha=False)
            image.colorspace_settings.name='Non-Color';pixels=[]
            for y in range(n):
                for x in range(n):
                    nx=.08*math.sin(TAU*x*96/n)+.025*math.sin(TAU*(x+y)*31/n)
                    ny=.08*math.sin(TAU*y*112/n)+.025*math.cos(TAU*(x-y)*23/n)
                    nz=math.sqrt(1-nx*nx-ny*ny)
                    pixels.extend((.5+.5*nx,.5+.5*ny,.5+.5*nz,1))
            image.pixels.foreach_set(pixels)
            texture=Path(__file__).resolve().parents[2]/'public/assets/models/textures/ladyclaire_silk_normal.png'
            texture.parent.mkdir(parents=True,exist_ok=True)
            image.filepath_raw=str(texture);image.file_format='PNG';image.save();image.pack()
        tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
        normal=m.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.22
        m.node_tree.links.new(tex.outputs['Color'],normal.inputs['Color'])
        m.node_tree.links.new(normal.outputs['Normal'],s.inputs['Normal'])
    return m


def mesh(name, verts, faces, material, weights='root', smooth=True):
    obj = custom(name, verts, faces, material)
    if smooth:
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    if isinstance(weights, str):
        group = obj.vertex_groups.new(name=weights)
        group.add(list(range(len(verts))), 1, 'REPLACE')
    else:
        for name in {key for row in weights for key in row}:
            group = obj.vertex_groups.new(name=name)
            for i, row in enumerate(weights):
                if row.get(name, 0) > 0:
                    group.add([i], row[name], 'REPLACE')
    modifier = obj.modifiers.new('Royal anatomical deform rig', 'ARMATURE')
    modifier.object = _RIG
    obj.parent = _RIG
    _PARTS.append(obj)
    return obj


def interpolation(profile, t):
    n = len(profile) - 1
    i = min(n - 1, int(t * n))
    f = t * n - i
    # Cubic Hermite gives continuous contour/tangent, rather than ring steps.
    a, b = profile[i], profile[i + 1]
    before, after = profile[max(0, i - 1)], profile[min(n, i + 2)]
    return tuple((2*f**3-3*f*f+1)*a[k] + (f**3-2*f*f+f)*(b[k]-before[k])*.5
                 + (-2*f**3+3*f*f)*b[k] + (f**3-f*f)*(after[k]-a[k])*.5
                 for k in range(len(a)))


def shape(name, profile, material, bone='root', count=48, rows=32, warp=None):
    vertices, weights = [], []
    for row in range(rows + 1):
        t = row / rows
        z, width, front, back, cy = interpolation(profile, t)
        for col in range(count):
            angle = TAU * col / count
            x = width * math.cos(angle)
            y = cy + math.sin(angle) * (front if math.sin(angle) >= 0 else back)
            v = Vector((x, y, z))
            if warp:
                v = Vector(warp(v, angle, t))
            vertices.append(tuple(v))
            weights.append(bone(v, t) if callable(bone) else {bone: 1})
    faces = [(r*count+c, r*count+(c+1)%count,
              (r+1)*count+(c+1)%count, (r+1)*count+c)
             for r in range(rows) for c in range(count)]
    faces += [tuple(reversed(range(count))), tuple(rows*count+c for c in range(count))]
    obj=mesh(name, vertices, faces, material, weights)
    uv=obj.data.uv_layers.new(name='Tailored surface UV')
    for polygon in obj.data.polygons:
        cols=[obj.data.loops[i].vertex_index%count for i in polygon.loop_indices]
        crosses=max(cols)-min(cols)>count/2
        for index in polygon.loop_indices:
            vertex=obj.data.loops[index].vertex_index
            col=vertex%count
            uv.data[index].uv=((1 if col==0 and crosses else col/count),(vertex//count)/rows)
    return obj


def rounded(name, centre, scale, material, bone='root', nu=24, nv=12):
    # Analytically shaped quad surface, used for tiny jewel/cornea forms only.
    v = []
    for j in range(nv+1):
        lat = math.pi*j/nv
        for i in range(nu):
            a = TAU*i/nu
            v.append((centre[0]+scale[0]*math.sin(lat)*math.cos(a),
                      centre[1]+scale[1]*math.sin(lat)*math.sin(a),
                      centre[2]+scale[2]*math.cos(lat)))
    f = [(j*nu+i,j*nu+(i+1)%nu,(j+1)*nu+(i+1)%nu,(j+1)*nu+i)
         for j in range(nv) for i in range(nu)]
    return mesh(name,v,f,material,bone)


def tube(name, points, radii, material, bone='root', sides=10, resolution=3):
    path = []
    for j in range((len(points)-1)*resolution+1):
        t=j/((len(points)-1)*resolution)
        path.append((Vector(interpolation(points,t)), interpolation([(r,) for r in radii],t)[0]))
    v,w = [],[];previous_normal=None
    for j,(p,r) in enumerate(path):
        direction = path[min(len(path)-1,j+1)][0]-path[max(0,j-1)][0]
        direction.normalize()
        # Parallel transport prevents sudden tube-frame flips at elbows and
        # wrists when a tangent becomes parallel to one global axis.
        n=previous_normal-direction*previous_normal.dot(direction) if previous_normal is not None else direction.cross(Vector((0,1,0)))
        if n.length < .001:n=direction.cross(Vector((1,0,0)))
        n.normalize(); b=direction.cross(n).normalized()
        previous_normal=n.copy()
        for i in range(sides):
            vv=p+r*(math.cos(TAU*i/sides)*n+math.sin(TAU*i/sides)*b)
            v.append(tuple(vv));w.append(bone(vv,j/(len(path)-1)) if callable(bone) else {bone:1})
    f=[(j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i)
       for j in range(len(path)-1) for i in range(sides)]
    f += [tuple(reversed(range(sides))),tuple((len(path)-1)*sides+i for i in range(sides))]
    return mesh(name,v,f,material,w)


def loop(name, points, radius, material, bone='root', sides=8):
    return tube(name, points+[points[0],points[1]], [radius]*(len(points)+2),material,bone,sides,1)


def _gauss(x,z,cx,cz,sx,sz):
    return math.exp(-((x-cx)/sx)**2-((z-cz)/sz)**2)


def skull_profile(z):
    low,high=0,1
    for _ in range(24):
        t=(low+high)/2
        if interpolation(FACE_PROFILE,t)[0]<z:low=t
        else:high=t
    return interpolation(FACE_PROFILE,(low+high)/2)


def facial_y(x,z):
    zz,width,front,back,cy=skull_profile(z)
    sine=math.sqrt(max(0,1-(x/width)**2))
    nose=.028*_gauss(x,z,0,1.765,.016,.024)+.014*_gauss(x,z,0,1.792,.012,.032)
    nose+=.004*(_gauss(x,z,.012,1.752,.009,.007)+_gauss(x,z,-.012,1.752,.009,.007))
    cheek=.006*(_gauss(x,z,.055,1.747,.030,.024)+_gauss(x,z,-.055,1.747,.030,.024))
    sockets=-.006*(_gauss(x,z,.044,1.789,.025,.017)+_gauss(x,z,-.044,1.789,.025,.017))
    philtrum=-.003*_gauss(x,z,0,1.720,.006,.008)
    return cy+front*sine+(nose+cheek+sockets+philtrum)*sine**8


def create_rig():
    global _RIG
    for action in list(bpy.data.actions):
        if action.name in ('Idle','Attack') or action.name.startswith(('Idle.','Attack.')):
            bpy.data.actions.remove(action)
    data=bpy.data.armatures.new('Claire V3 anatomical deform skeleton')
    rig=bpy.data.objects.new('Lady_Claire_Rig',data);bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active=rig;rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    specs=[('root',(0,0,.17),(0,0,1.12),None),
           ('pelvis',(0,0,1.1),(0,0,1.26),'root'),
           ('torso',(0,0,1.22),(0,0,1.52),'pelvis'),
           ('neck',(0,0,1.53),(0,0,1.65),'torso'),
           ('head',(0,0,1.65),(0,0,1.91),'neck'),
           ('upper_arm_R',(.166,0,1.50),(.248,.040,1.345),'torso'),
           ('forearm_R',(.248,.040,1.345),(.319,.131,1.188),'upper_arm_R'),
           ('hand_R',(.319,.131,1.188),(.334,.146,1.224),'forearm_R'),
           ('staff',(.339,.164,1.208),(.339,.164,2.116),'hand_R'),
           ('upper_arm_L',(-.166,0,1.50),(-.264,-.023,1.334),'torso'),
           ('forearm_L',(-.264,-.023,1.334),(-.284,.127,1.334),'upper_arm_L'),
           ('hand_L',(-.284,.127,1.334),(-.270,.146,1.397),'forearm_L'),
           ('hair_back',(0,-.06,1.82),(0,-.11,1.36),'head'),
           ('skirt_front',(0,.10,1.11),(0,.24,.25),'pelvis'),
           ('skirt_back',(0,-.10,1.11),(0,-.29,.25),'pelvis')]
    for s,side in [(1,'R'),(-1,'L')]:
        specs += [('upper_leg_'+side,(s*.071,0,1.10),(s*.071,.004,.66),'pelvis'),
                  ('lower_leg_'+side,(s*.071,.004,.66),(s*.071,.006,.25),'upper_leg_'+side),
                  ('foot_'+side,(s*.071,.006,.25),(s*.071,.11,.18),'lower_leg_'+side)]
    for side in ['R','L']:
        centre=Vector((.324,.136,1.206) if side=='R' else (-.276,.144,1.366))
        for i in range(5):
            a=centre+Vector((0,.003,(i-2)*.013))
            specs.append((f'finger_{side}_{i}',a,a+Vector((.028,.028,.007)),f'hand_{side}'))
    for name,start,end,parent in specs:
        bone=data.edit_bones.new(name);bone.head=start;bone.tail=end
        if parent:bone.parent=data.edit_bones[parent]
        bone.use_deform=True
    bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
    rig['assetRevision']='champions-v7.10';rig['designRevision']=10
    rig['animationContract']='Idle 2.4 s; Attack 1.0 s; effect at normalized 0.36'
    rig['attackReleaseFraction']=.36
    _RIG=rig
    return rig


def sculpt_face(p):
    # Original narrow adult cranium with tapered jaw, oval cheeks and a sculpted
    # nasal bridge integrated in the same continuous, high-resolution surface.
    profile=FACE_PROFILE
    def warp(v,a,t):
        if math.sin(a) <= 0:return v
        x,y,z=v
        nose=.028*_gauss(x,z,0,1.765,.016,.024)+.014*_gauss(x,z,0,1.792,.012,.032)
        nose+=.004*(_gauss(x,z,.012,1.752,.009,.007)+_gauss(x,z,-.012,1.752,.009,.007))
        cheek=.006*(_gauss(x,z,.055,1.747,.030,.024)+_gauss(x,z,-.055,1.747,.030,.024))
        sockets=-.006*(_gauss(x,z,.044,1.789,.025,.017)+_gauss(x,z,-.044,1.789,.025,.017))
        philtrum=-.003*_gauss(x,z,0,1.720,.006,.008)
        y+=(nose+cheek+sockets+philtrum)*max(0,math.sin(a))**8
        return x,y,z
    face=shape('Claire V3 original sculpted adult facial anatomy',profile,p['skin'],'head',64,38,warp)
    face['identitySource']='Claire V3 original sculpted topology; no V1/V2 geometry reused'
    face['eyeLineZ']=1.789;face['frontHairlineZ']=1.849
    # Mouth lips follow a gentle, closed arc. Upper lip has a cupid bow;
    # corners rise 1.8 mm. The seam has no visible oversized teeth.
    for upper in [True,False]:
        vertices=[];columns=24;rows=4
        for j in range(rows+1):
            t=j/rows
            for i in range(columns+1):
                x=(i/columns-.5)*.043
                taper=max(0,1-(x/.022)**2)
                seam=1.706+.0022*(abs(x)/.0215)**1.6
                extent=(.0045 if upper else -.0045)*t*taper
                cupid=.0014*math.exp(-((abs(x)-.006)/.004)**2)*t if upper else 0
                z=seam+extent+cupid
                y=.0714+.0018*math.sin(math.pi*t)*taper-.0018*(abs(x)/.022)**2
                vertices.append((x,y,z))
        faces=[(j*(columns+1)+i,j*(columns+1)+i+1,(j+1)*(columns+1)+i+1,(j+1)*(columns+1)+i)
               for j in range(rows) for i in range(columns)]
        mesh('Claire V3 continuous '+('upper cupid bow' if upper else 'lower')+' smiling lip surface',vertices,faces,p['rose'],'head')
    tube('Claire V3 recessed soft closed mouth line',[(x,.0718,1.706+.0022*(abs(x)/.0215)**1.6) for x in [-.020,-.012,0,.012,.020]], [.0003]*5,p['rose'],'head',5,2)
    for side in [-1,1]:
        x=side*.0435;z=1.791
        rounded('Claire V3 inset almond eye cornea '+str(side),(x,.057,z),(.0172,.0072,.0056),p['ivory'],'head',28,10)
        rounded('Claire V3 natural green iris '+str(side),(x,.0643,z),(.0048,.0012,.0050),p['iris'],'head',20,8)
        rounded('Claire V3 eye pupil '+str(side),(x,.0653,z),(.0021,.0008,.0029),p['shadow'],'head',16,8)
        rounded('Claire V3 moist eye catchlight '+str(side),(x-.0013,.0663,z+.0022),(.0010,.0005,.0010),p['ivory'],'head',10,6)
        for upper in [True,False]:
            vertices=[];columns=24;rows=5;edge=[]
            for j in range(rows+1):
                t=j/rows
                for i in range(columns+1):
                    a=math.pi*i/columns;xx=x-(.0177+.002*t)*math.cos(a)
                    inner=z+(.0062 if upper else -.0047)*math.sin(a)+side*(xx-x)*.035
                    outer=z+(.014 if upper else -.013)*math.sin(a)+(.0015 if upper else -.0015)
                    zz=inner+(outer-inner)*t
                    eyeedge=.0638+.0010*math.sin(a)
                    # The lid's elevation decays cubically into the original
                    # cheek/brow surface. Its boundary has the same tangent
                    # and shading normal as the face, and terminates 0.2 mm
                    # below that surface instead of leaving a raised disk lip.
                    innerx=x-.0177*math.cos(a)
                    base=facial_y(xx,zz)
                    yy=base+(eyeedge-facial_y(innerx,inner))*(1-t)**3-.0002*t**5
                    vertices.append((xx,yy,zz))
                    if j==0:edge.append((xx,yy,zz))
            faces=[(j*(columns+1)+i,j*(columns+1)+i+1,(j+1)*(columns+1)+i+1,(j+1)*(columns+1)+i) for j in range(rows) for i in range(columns)]
            mesh('Claire V3 '+('upper' if upper else 'lower')+' eyelid skin continuously blended into facial socket',vertices,faces,p['skin'],'head')
            if upper:tube('Claire V3 delicate upper lash rim',[(a,b+.0004,c-.0003) for a,b,c in edge],[.00040]*len(edge),p['shadow'],'head',4,1)
        brows=[(x-.022,.069,1.812),(x-.009,.077,1.820),(x+.011,.074,1.820),(x+.024,.066,1.813)]
        tube('Claire V3 swept natural blonde brow',brows,[.0013,.0021,.0018,.0006],p['hairdark'],'head',6,3)
        # Tucked, shaped pinna: thin rim, hollow concha and attached lobe.
        ear=rounded('Claire V3 attached human pinna',(side*.092,-.013,1.749),(.013,.018,.027),p['skin'],'head',16,10)
        rounded('Claire V3 gold pearl earring',(side*.098,.003,1.724),(.005,.005,.011),p['gold'],'head',12,8)


def hair_and_crown(p):
    # Scalp cap extends to the actual forehead and temples. All cap vertices
    # follow the head curvature; side edges descend to the ears.
    v=[];nu=48;nv=14
    for j in range(nv+1):
        t=j/nv
        for i in range(nu):
            a=TAU*i/nu
            if math.sin(a)>=0:
                boundary=1.852+.012*math.exp(-((abs(math.cos(a))-.48)/.23)**2)-.016*(1-math.sin(a))
            else:
                boundary=1.838+.013*math.sin(a)
            edge=math.acos((boundary-1.794)/.141)
            z=1.927-(1.927-boundary)*t
            zz,width,front,back,cy=skull_profile(min(z,1.9238))
            # Follow the actual newly sculpted cranium, tapering all hair
            # thickness to zero at the skin-boundary. There is no overhanging
            # planar strip, scalloped fringe or horizontal helmet-like lip.
            thickness=.0016*min(1,(1-t)/.12)
            x=(width+thickness)*math.cos(a)
            y=cy+((front if math.sin(a)>0 else back)+thickness)*math.sin(a)
            y+=.0005*math.sin(a*23+t*8)*math.sin(math.pi*t)
            v.append((x,y,z))
    f=[(j*nu+i,j*nu+(i+1)%nu,(j+1)*nu+(i+1)%nu,(j+1)*nu+i) for j in range(nv) for i in range(nu)]
    mesh('Claire V3 scalp hair with continuous natural forehead and temple line',v,f,p['hair'],'head')
    shape('Claire V3 continuous sculpted rear hair curtain',
          [(1.368,.108,.009,.013,-.137),(1.435,.143,.013,.019,-.135),
           (1.594,.115,.014,.020,-.122),(1.740,.097,.012,.018,-.109),
           (1.851,.084,.005,.012,-.101)],p['hair'],
          lambda v,t:{'head':t,'hair_back':1-t},36,18,
          lambda v,a,t:(v.x*(1+.018*math.sin(a*11+t*5)),v.y+.004*math.sin(a*13+t*7),v.z+.005*math.sin(a*5)*(1-t)**5))
    for index,a in enumerate([i*TAU/18 for i in range(18)]):
        # Front forehead stays visible: front locks start at temples, not centre.
        if math.sin(a)>.69:continue
        length=.50+.035*math.sin(index*1.7)
        points=[]
        for j in range(12):
            t=j/11
            r=.084+.031*min(1,t*5)+.009*math.sin(t*math.pi*2+index*.7)*math.sin(math.pi*t)
            r+=.045*t**1.5*abs(math.cos(a))**3
            aa=a+.045*math.sin(t*7+index)
            points.append((r*math.cos(aa),-.016+r*(.80 if math.sin(a)>0 else 1.04)*math.sin(aa)-.012*t,
                           1.884-length*t))
        # Broad, flattened anatomical hair ribbons form a continuous layered
        # hair curtain. They are sculpted sheets with thin closed side walls,
        # rather than visible round tube locks.
        vertices=[];weights=[];rows=22;cols=8
        for j in range(rows+1):
            t=j/rows;c=Vector(interpolation(points,t));width=.019*(1-.87*t**4)
            outward=Vector((math.cos(a),math.sin(a),0));tangent=Vector((-math.sin(a),math.cos(a),0))
            for k in range(cols):
                angle=TAU*k/cols
                vv=c+tangent*width*math.cos(angle)+outward*.007*(.8+.2*math.sin(t*8))*(1-.85*t**4)*math.sin(angle)
                vertices.append(tuple(vv));weights.append({'head':1-min(.9,t*.9),'hair_back':min(.9,t*.9)})
        faces=[(j*cols+k,j*cols+(k+1)%cols,(j+1)*cols+(k+1)%cols,(j+1)*cols+k) for j in range(rows) for k in range(cols)]
        faces += [tuple(reversed(range(cols))),tuple(rows*cols+k for k in range(cols))]
        mesh('Claire V3 long individually sculpted flattened blonde hair ribbon '+str(index),vertices,faces,p['hair'],weights)
        strand=[(x+.008*math.cos(a),y+.008*math.sin(a),z) for x,y,z in points]
        tube('Claire V3 engraved strand highlight '+str(index),strand,[.0014*(1-j/14) for j in range(12)],p['hairlight'],
             lambda vv,t:{'head':1-min(.9,t*.9),'hair_back':min(.9,t*.9)},4,1)
    part=[(.0007,facial_y(.0007,min(z,1.923))+.0018,z) for z in [1.925,1.917,1.906,1.882,1.855]]
    tube('Claire V3 subtle continuous centre part',part,
         [.00065,.00065,.00055,.00045,.0003],p['hairdark'],'head',4,3)
    # Tapered rolled band seats 2 mm outside scalp; ornate open-work fleur crown.
    _,crownwidth,crownfront,crownback,crowncy=skull_profile(1.872)
    crownpoints=[((crownwidth+.0085)*math.cos(TAU*i/48),crowncy+((crownfront if math.sin(TAU*i/48)>0 else crownback)+.0085)*math.sin(TAU*i/48),1.872+.002*math.cos(TAU*i/48)) for i in range(48)]
    loop('Claire V3 solid seated engraved crown band',crownpoints,.0065,p['gold'],'head',8)
    loop('Claire V3 crown upper chased bead rail',[(x,y,z+.015) for x,y,z in crownpoints],.0033,p['gold'],'head',6)
    for i in range(10):
        a=TAU*i/10;rad=Vector((math.cos(a),math.sin(a),0));tan=Vector((-math.sin(a),math.cos(a),0))
        c=Vector(((crownwidth+.0085)*math.cos(a),crowncy+((crownfront if math.sin(a)>0 else crownback)+.0085)*math.sin(a),1.885))
        h=.055+(.019 if math.sin(a)>.6 else 0)
        pts=[c-tan*.020,c-tan*.016+Vector((0,0,h*.62)),c+rad*.010+Vector((0,0,h)),c+tan*.016+Vector((0,0,h*.62)),c+tan*.020]
        tube('Claire V3 ornamental crown fleur arch '+str(i),pts,[.0032,.0036,.004,.0036,.0032],p['gold'],'head',7,2)
        rounded('Claire V3 crown warm sunstone '+str(i),c+rad*.005+Vector((0,0,.014)),(.006,.005,.009),p['magic'],'head',10,6)
        rounded('Claire V3 crown luminous pearl finial '+str(i),c+rad*.010+Vector((0,0,h)),(.0042,.0042,.006),p['ivory'],'head',8,4)


def body_and_gown(p):
    # Full neck, collarbones and shoulder anatomy is one continuous surface.
    shape('Claire V3 continuous neck and decolletage anatomy',
          [(1.420,.129,.078,.070,0),(1.467,.158,.089,.081,0),
           (1.503,.151,.080,.076,-.003),(1.535,.115,.065,.061,-.005),
           (1.560,.065,.043,.047,-.009),(1.588,.038,.033,.037,-.010),
           (1.677,.031,.026,.034,-.021)],p['skin'],
          lambda v,t:{'torso':1-max(0,(t-.6)/.4),'neck':max(0,(t-.6)/.4)},40,22)
    profile=[(.177,.353,.253,.287,-.017),(.275,.335,.249,.274,-.015),
             (.460,.286,.216,.238,-.010),(.720,.228,.174,.192,-.003),
             (.944,.172,.121,.145,0),(1.070,.134,.092,.111,0),
             (1.147,.112,.079,.087,0),(1.248,.118,.084,.089,0),
             (1.354,.142,.096,.093,0),(1.426,.158,.102,.089,0),
             (1.464,.155,.095,.085,0)]
    def warp(v,a,t):
        x,y,z=v
        lower=max(0,min(1,(1.12-z)/.85))
        fold=1+lower*(.105*math.cos(a*10+.6*lower)+.038*math.cos(a*5-lower*2.1)+.010*math.sin(a*23-lower))
        fold+=.025*math.exp(-((z-.70)/.24)**2)*math.sin(a*8+(z-.70)*14)
        x*=fold;y*=fold
        # Bodice princess seams and natural broad silk folds, not cones.
        if z>1.25:y+=.004*math.sin(a*6)*math.sin((z-1.25)*12)
        if t>.96:z-=.018*max(0,math.sin(a))**4*(1-abs(math.cos(a))*.5)
        z+=.007*math.sin(a*5+.4)*lower**4
        return x,y,z
    def weight(v,t):
        z=v.z
        if z>1.20:return {'torso':1}
        k=max(0,min(.8,(1.15-z)/.8))
        name='skirt_front' if v.y>0 else 'skirt_back'
        return {'pelvis':1-k,name:k}
    gown=shape('Claire V3 continuous tailored silk gown with volumetric cascading pleats',profile,p['silk'],weight,64,30,warp)
    # Actual cloth thickness is tessellated by Solidify before skinning export.
    thick=gown.modifiers.new('Woven silk thickness 2 mm','SOLIDIFY');thick.thickness=.0025
    bpy.context.view_layer.objects.active=gown
    bpy.ops.object.modifier_move_up(modifier=thick.name)
    bpy.ops.object.modifier_apply(modifier=thick.name)
    def garment_point(z,a):
        low,high=0,1
        for _ in range(24):
            mid=(low+high)/2
            if interpolation(profile,mid)[0]<z:low=mid
            else:high=mid
        t=(low+high)/2;zz,rx,front,back,cy=interpolation(profile,t)
        v=Vector((rx*math.cos(a),cy+(front if math.sin(a)>=0 else back)*math.sin(a),zz))
        return Vector(warp(v,a,t))
    for z in [1.147,.186]:
        pts=[tuple(garment_point(z,TAU*i/40)+Vector((math.cos(TAU*i/40)*.003,math.sin(TAU*i/40)*.003,0))) for i in range(40)]
        loop('Claire V3 embroidered golden '+('waist belt' if z>1 else 'weighted gown hem'),pts,.0038,p['gold'],'pelvis' if z>1 else 'root',6)
    # Fine curving embroidery sewn onto front skirt follows pleated surface.
    for side in [-1,1]:
        pts=[]
        for j in range(20):
            t=j/19;z=1.134-.892*t;rx=.113+(.345-.113)*t**.85;ry=.084+(.267-.084)*t**.85
            x=side*rx*(.30+.12*math.sin(t*math.pi*2))
            angle=math.acos(max(-1,min(1,x/rx)))
            vv=garment_point(z,angle);vv.y+=.003
            pts.append(tuple(vv))
        tube('Claire V3 gown scrolling gold embroidered seam '+str(side),pts,[.0024]*20,p['gold'],weight,5,1)
    for side in [-1,1]:
        # Sculpted soft satin sleeves have sculpted folds and thickness.
        c=Vector((side*.165,0,1.488))
        shape('Claire V3 folded off shoulder silk sleeve '+str(side),
              [(1.430,.052,.048,.042,0),(1.467,.055,.053,.049,0),(1.508,.046,.039,.044,0)],p['silk'],
              'upper_arm_R' if side>0 else 'upper_arm_L',32,14,
              lambda v,a,t:(v.x+c.x+side*(1-t)*.017,v.y+.002*math.sin(a*6),v.z))
    necklace=[(-.074,.072,1.547),(-.047,.087,1.533),(0,.100,1.520),(.047,.087,1.533),(.074,.072,1.547)]
    tube('Claire V3 fitted articulated gold necklace',necklace,[.0029]*5,p['gold'],'torso',8,4)
    rounded('Claire V3 engraved necklace sun pendant',(0,.105,1.507),(.011,.0045,.016),p['gold'],'torso',20,12)
    # Fully authored legs and grounded feet sit beneath the flowing gown; they
    # are editable human anatomy rather than an empty dress prop.
    for s,side in [(1,'R'),(-1,'L')]:
        shape('Claire V3 concealed continuous anatomical standing leg '+side,
              [(.239,.024,.027,.025,.008),(.380,.030,.033,.031,.004),
               (.500,.039,.039,.037,0),(.670,.030,.033,.031,.003),
               (.875,.048,.049,.045,0),(1.065,.053,.052,.048,0)],p['skin'],
              lambda v,t:{'lower_leg_'+side:1-max(0,min(1,(t-.48)/.12)),
                          'upper_leg_'+side:max(0,min(1,(t-.48)/.12))},16,12,
              lambda v,a,t:(v.x+s*.071,v.y,v.z))
        shape('Claire V3 grounded fitted ivory slipper '+side,
              [(.158,.031,.089,.035,.017),(.175,.035,.095,.041,.024),
               (.202,.033,.080,.037,.017),(.227,.025,.027,.026,.005)],p['silk'],
              'foot_'+side,16,6,lambda v,a,t:(v.x+s*.071,v.y,v.z))


def arms_and_hands(p):
    for side in ['R','L']:
        s=1 if side=='R' else -1
        shoulder=(s*.165,0,1.50)
        elbow=(.248,.040,1.345) if side=='R' else (-.264,-.023,1.334)
        wrist=(.319,.131,1.188) if side=='R' else (-.284,.127,1.334)
        points=[shoulder,(s*.205,.008,1.422),elbow,tuple(Vector(elbow).lerp(Vector(wrist),.58)),wrist]
        def armweight(v,t):
            k=max(0,min(1,(t-.39)/.29))
            hand=max(0,min(1,(t-.90)/.10))
            return {'upper_arm_'+side:(1-k)*(1-hand),'forearm_'+side:k*(1-hand),'hand_'+side:hand}
        tube('Claire V3 continuous anatomical '+side+' arm from deltoid to wrist',points,[.038,.034,.028,.027,.020],p['skin'],armweight,18,7)
        hand_start=len(_PARTS);digit_paths={}
        if side=='R':
            # Palm sits behind the shaft. Four separate fingers travel around
            # its right side then curl forward and back, in a true power grip.
            palm=shape('Claire V3 anatomical right grasping palm',
                       [(1.174,.018,.017,.014,.080),(1.187,.023,.017,.012,.087),
                        (1.211,.029,.018,.014,.092),(1.233,.026,.016,.011,.095),
                        (1.243,.012,.011,.010,.093)],p['skin'],'hand_R',24,14,
                       lambda v,a,t:(v.x+.287,v.y,v.z))
            for i in range(4):
                z=1.183+i*.014
                pts=[(.298,.103,z),(.322,.105,z+.002),(.333,.121,z+.001),(.328,.138,z-.001),(.313,.145,z-.001),(.303,.136,z)]
                pts.append((.300,.134,z));radii=[.0062,.0064,.0059,.0055,.0049,.0035,.0006]
                finger=tube('Claire V3 right '+['little','ring','middle','index'][i]+' curved independent gripping finger',pts,radii,p['skin'],'finger_R_'+str(i),10,4)
                digit_paths['finger_R_'+str(i)]=pts
                finger['digit']=i+1;finger['grip']='Wrapped around physical 14 mm staff shaft'
            pts=[(.271,.106,1.226),(.277,.130,1.237),(.296,.148,1.235),(.316,.151,1.229),(.324,.142,1.223)]
            thumb=tube('Claire V3 right anatomically opposed curved thumb',pts,[.009,.008,.0075,.0066,.0047],p['skin'],'finger_R_4',10,3);thumb['digit']=5
            digit_paths['finger_R_4']=pts
        else:
            centre=Vector((-.284,.132,1.362))
            shape('Claire V3 anatomical left open casting palm',
                  [(1.328,.018,.018,.016,.122),(1.350,.021,.014,.012,.137),
                   (1.374,.024,.013,.010,.147),(1.392,.020,.011,.009,.151)],p['skin'],'hand_L',24,14,
                  lambda v,a,t:(v.x-.277,v.y,v.z))
            lengths=[.042,.056,.061,.050]
            for i in range(4):
                x=-.297+i*.013;z=1.385
                l=lengths[i]
                pts=[(x,.151,z),(x-.001,.160,z+l*.40),(x-.004,.179,z+l*.76),(x-.007,.174,z+l*.96),(x-.008,.170,z+l)]
                finger=tube('Claire V3 left '+['little','ring','middle','index'][i]+' individually articulated curved finger',pts,[.0058,.0056,.0052,.0034,.0006],p['skin'],'finger_L_'+str(i),10,4);finger['digit']=i+1
                rounded('Claire V3 left integrated anatomical metacarpal knuckle '+str(i),(x,.151,1.386),(.0083,.012,.010),p['skin'],'hand_L',12,8)
                digit_paths['finger_L_'+str(i)]=pts
            pts=[(-.255,.144,1.365),(-.241,.157,1.375),(-.231,.170,1.383),(-.229,.164,1.392),(-.230,.161,1.395)]
            tube('Claire V3 left opposed thumb with natural thenar origin',pts,[.008,.007,.0062,.0040,.0007],p['skin'],'finger_L_4',10,4)
            rounded('Claire V3 integrated left thenar anatomy',(-.255,.139,1.361),(.009,.012,.014),p['skin'],'hand_L',12,8)
            digit_paths['finger_L_4']=pts
        weld_hand(_PARTS[hand_start:],side,digit_paths)
        if side=='R':
            for vertex in _PARTS[-1].data.vertices:
                vertex.co+=Vector((.025,.040,0))
        # A thin cuff is fitted above wrist, leaving joint room.
        c=Vector(wrist);normal=(Vector(wrist)-Vector(elbow)).normalized();axis=normal.cross(Vector((0,1,0))).normalized();axis2=normal.cross(axis)
        pts=[tuple(c-normal*.024+.023*(axis*math.cos(TAU*i/32)+axis2*math.sin(TAU*i/32))) for i in range(32)]
        loop('Claire V3 engraved fitted wrist cuff '+side,pts,.0035,p['gold'],'forearm_'+side,6)


def weld_hand(parts,side,paths):
    """Join and sculpt a connected palm/knuckle surface without finger seams.

    Submillimetre voxel union retains the separated fingers. Retopology is
    local to this hand and keeps the deliberately curved silhouettes.
    """
    for obj in parts:
        _PARTS.remove(obj)
        obj.modifiers.clear()
    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts:obj.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    bpy.ops.object.join();hand=parts[0]
    hand.name='Claire V3 sculpted continuous '+side+' hand with five separated curved digits'
    voxel=hand.modifiers.new('Continuous anatomical palm and knuckle sculpt','REMESH')
    voxel.mode='VOXEL';voxel.voxel_size=.0012;voxel.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=voxel.name)
    soften=hand.modifiers.new('Soft human knuckle and fingertip contour','SMOOTH');soften.factor=.55;soften.iterations=4
    bpy.ops.object.modifier_apply(modifier=soften.name)
    triangles=sum(len(f.vertices)-2 for f in hand.data.polygons)
    if triangles>3300:
        retopo=hand.modifiers.new('Local anatomical hand surface retopology','DECIMATE');retopo.ratio=3300/triangles
        bpy.ops.object.modifier_apply(modifier=retopo.name)
    hand.vertex_groups.clear()
    groups={name:hand.vertex_groups.new(name=name) for name in ['hand_'+side,*paths]}
    samples={name:[Vector(interpolation(path,j/40)) for j in range(41)] for name,path in paths.items()}
    for vertex in hand.data.vertices:
        distances={name:min((vertex.co-point).length for point in points) for name,points in samples.items()}
        name,distance=min(distances.items(),key=lambda item:item[1])
        amount=max(0,min(.90,(.013-distance)/.007))
        groups['hand_'+side].add([vertex.index],1-amount,'REPLACE')
        if amount:groups[name].add([vertex.index],amount,'REPLACE')
    mod=hand.modifiers.new('Royal anatomical deform rig','ARMATURE');mod.object=_RIG
    hand['digits']=5;hand['opposedThumb']=True;hand['digitPaths']=str(paths)
    hand['surfaceMethod']='Fresh V3 palm and curved digits joined, submillimetre union sculpt and local retopology'
    _PARTS.append(hand)


def staff_and_orbs(p,H):
    x,y=.339,.164
    tube('Claire V3 carved gold magical staff with sculpted tapered grip',
         [(x,y,.261),(x,y,.47),(x,y,1.16),(x,y,1.43),(x,y,1.88),(x,y,2.03)],
         [.008,.010,.012,.010,.012,.015],p['gold'],'staff',14,3)
    for z in [.39,.99,1.29,1.89]:
        loop('Claire V3 staff engraved raised grip collar',[(x+.015*math.cos(TAU*i/24),y+.015*math.sin(TAU*i/24),z) for i in range(24)],.003,p['gold'],'staff',6)
    for side in [-1,1]:
        pts=[(x,y,1.972),(x+side*.048,y,2.022),(x+side*.053,y,2.095),(x+side*.020,y,2.132),(x,y,2.140)]
        tube('Claire V3 staff sculpted gilded lotus focus arm '+str(side),pts,[.007,.007,.006,.004,.003],p['gold'],'staff',9,4)
    rounded('Claire V3 luminous inset amber staff spell focus',(x,y,2.075),(.026,.026,.040),p['magic'],'staff',24,12)
    # Semantic markers are parented to the actual deforming weapon bone.
    for name in ['staff_tip','attack_muzzle']:
        marker=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(marker)
        marker.parent=_RIG;marker.parent_type='BONE';marker.parent_bone='staff'
        marker.location=(0,-.041,0)  # corrected world parent matrix below
        bpy.context.view_layer.update()
        desired=Vector((x,y,2.075))
        marker.matrix_world=Matrix.Translation(desired)
        marker['socketBone']='staff';marker['effectReleaseFraction']=.36
    for i in range(3):
        a=i*TAU/3
        pos=(math.cos(a)*.43,math.sin(a)*.43,1.49+i*.085)
        before=len(_PARTS)
        rounded('Claire V3 independent warm magical orb '+str(i),pos,(.041,.041,.041),p['magic'],'root',20,12)
        loop('Claire V3 orbiting gold meridian '+str(i),[(pos[0]+.052*math.cos(TAU*j/32),pos[1],pos[2]+.052*math.sin(TAU*j/32)) for j in range(32)],.0023,p['gold'],'root',6)
        empty=bpy.data.objects.new('secret_orb_'+str(i),None);bpy.context.collection.objects.link(empty);empty.location=pos
        empty['secretOrbIndex']=i;empty['orbitRadius']=.43
        # These decorative orbs are independent of body skin. Private runtime
        # updates orbit position; armature-driven spell release is staff focus.
        for o in _PARTS[before:]:
            for vertex in o.data.vertices:vertex.co-=Vector(pos)
            o.modifiers.clear();o.parent=empty;o.matrix_parent_inverse=Matrix.Identity(4);o.matrix_basis=Matrix.Identity(4)


def animate(rig):
    scene=bpy.context.scene;scene.render.fps=30
    rig.animation_data_create()
    def action(name,keys,length):
        a=bpy.data.actions.new(name);rig.animation_data.action=a
        for frame,poses in keys:
            for bone in rig.pose.bones:
                bone.rotation_mode='XYZ';bone.rotation_euler=poses.get(bone.name,(0,0,0))
                bone.keyframe_insert('rotation_euler',frame=frame,group=bone.name)
        a['effectReleaseFraction']=.36 if name=='Attack' else 0
        a['durationSeconds']=length
        for curve in a.fcurves if hasattr(a,'fcurves') else []:
            for point in curve.keyframe_points:point.interpolation='BEZIER'
        track=rig.animation_data.nla_tracks.new();track.name=name
        strip=track.strips.new(name,0,a);strip.action_frame_start=0;strip.action_frame_end=length*30
        strip.name=name;track.mute=True
        return a
    idle=[]
    for f,s in [(0,0),(18,1),(36,0),(54,-1),(72,0)]:
        idle.append((f,{'torso':(.003*s,0,.004*s),'head':(.005*s,.007*s,-.004*s),
                        'upper_arm_L':(.012*s,0,.009*s),'forearm_L':(-.01*s,0,0),
                        'hair_back':(.008*s,.008*s,0),'skirt_front':(.006*s,0,0),'skirt_back':(-.004*s,0,0)}))
    idleaction=action('Idle',idle,2.4)
    attack=[(0,{}),
            (6,{'torso':(.005,0,-.085),'upper_arm_R':(.04,.01,-.015),'forearm_R':(.15,0,0),'hand_R':(-.03,0,0),'upper_arm_L':(.08,0,.09),'forearm_L':(-.10,0,0),'head':(0,0,.025)}),
            (10.8,{'torso':(.018,0,.055),'upper_arm_R':(.09,-.018,.035),'forearm_R':(.15,0,0),'hand_R':(-.025,0,0),'upper_arm_L':(-.12,0,-.075),'forearm_L':(.12,0,0),'head':(-.025,0,-.02),'hair_back':(-.014,.008,0),'skirt_back':(-.011,0,0)}),
            (15,{'torso':(.012,0,.045),'upper_arm_R':(.055,-.01,.025),'forearm_R':(.095,0,0),'upper_arm_L':(-.06,0,-.04),'forearm_L':(.07,0,0),'head':(-.012,0,-.014),'hair_back':(-.009,.005,0)}),
            (22,{'torso':(.003,0,.010),'upper_arm_R':(.015,0,.009),'forearm_R':(.022,0,0),'upper_arm_L':(-.015,0,-.010),'hair_back':(.009,-.007,0)}),(30,{})]
    attackaction=action('Attack',attack,1.0)
    rig.animation_data.action=idleaction
    scene.frame_set(0)
    return idleaction,attackaction


def build(H):
    global _PARTS
    _PARTS=[]
    rig=create_rig()
    p=dict(skin=material('Living warm skin','e9bb9e',.52),
           silk=material('Ivory pearl silk with soft sheen','f3ead5',.37),
           gold=material('Chased pale royal gold','deb54d',.25,.84,.08),
           hair=material('Honey blond groomed hair','c8a052',.48),
           hairlight=material('Silken blonde strand highlights','edd297',.43),
           hairdark=material('Warm blonde brows','836036',.63),
           ivory=material('Moist eyes and crown pearls','f8f1dd',.21),
           iris=material('Natural jade green irises','458159',.28),
           rose=material('Soft rose lips','b6756d',.47),
           shadow=material('Warm dark anatomical detail','382a23',.58),
           magic=material('Warm amber spell crystals','ffe4a5',.21,.10,1.35),
           stone=material('Royal limestone footing','929b87',.85))
    # Feet are concealed by the weighted full-length hem; footing geometry is
    # intentionally simple, while the actual figure is high-detail continuous.
    shape('Claire V3 beveled octagonal stone display footing',[(.01,.44,.44,.44,0),(.105,.44,.44,.44,0),(.155,.408,.408,.408,0)],p['stone'],'root',8,2)
    loop('Claire V3 secret gold footing inlay',[(.36*math.cos(TAU*i/40),.36*math.sin(TAU*i/40),.16) for i in range(40)],.006,p['gold'],'root',6)
    body_and_gown(p);sculpt_face(p);hair_and_crown(p);arms_and_hands(p);staff_and_orbs(p,H)
    animate(rig)
    rig['anatomy']='Individually sculpted five digits per hand, opposed thumbs, continuous adult face and gown'
    rig['grip']='Right fingers wrap around the physical staff; staff skin follows hand_R'
    return p
