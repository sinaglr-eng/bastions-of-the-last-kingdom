"""Editable clan territory, wolf holdings and mountain inhabitants (Blender Z-up).

The caller owns palette initialization, export, batching and scene rendering.
"""
import bpy, math
from mathutils import Matrix
import author_scenery_v3 as V3


def marker(name,role,position,**properties):
    obj=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(obj)
    obj.location=position;obj['sceneryRole']=role
    for key,value in properties.items():obj[key]=value
    return obj


def transform_new(before,x,y,z=0,angle=0,scale=1):
    bpy.context.view_layer.update()
    matrix=Matrix.Translation((x,y,z))@Matrix.Rotation(angle,4,'Z')@Matrix.Diagonal((scale,scale,scale,1))
    for obj in set(bpy.context.scene.objects)-before:obj.matrix_world=matrix@obj.matrix_world


def trail(S,name,points,width=1.05):
    for a,b in zip(points,points[1:]):
        dx,dy=b[0]-a[0],b[1]-a[1]
        road=S.box(name+' trodden earth',((a[0]+b[0])/2,(a[1]+b[1])/2,.026),(math.hypot(dx,dy),width,.023),'soil')
        road.rotation_euler[2]=math.atan2(dy,dx)


def pen(S,name,x,y,width,depth,cage=False):
    marker(name,'wolfCage' if cage else 'wolfPen',(x,y,0),width=width,depth=depth)
    S.box(name+' packed floor',(x,y,.013),(width,depth,.025),'soil')
    height=1.45 if cage else 1.05
    for side in [-1,1]:
        yy=y+side*depth/2
        for i in range(8):
            xx=x-width/2+i*width/7
            S.beam(name+' fence upright',(xx,yy,.02),(xx,yy,height),.042,'iron' if cage else 'wood',5)
        for h in [.34,height-.12]:S.beam(name+' fence rail',(x-width/2,yy,h),(x+width/2,yy,h),.043,'wood',5)
        xx=x+side*width/2
        for i in range(6):
            yy=y-depth/2+i*depth/5
            S.beam(name+' side upright',(xx,yy,.02),(xx,yy,height),.042,'iron' if cage else 'wood',5)
        for h in [.34,height-.12]:S.beam(name+' side rail',(xx,y-depth/2,h),(xx,y+depth/2,h),.043,'wood',5)
    if cage:
        for i in range(8):
            xx=x-width/2+i*width/7
            S.beam(name+' roof cage bar',(xx,y-depth/2,height),(xx,y+depth/2,height),.029,'iron',5)
        S.box(name+' cage latch',(x,y-depth/2-.055,.8),(.19,.09,.27),'iron')
    else:
        S.gabled_roof(name+' wolf shelter roof',x-width*.30,y+depth*.25,.70,width*.35,depth*.4,.46,'hide')
        S.box(name+' drinking trough',(x+width*.31,y+depth*.26,.16),(.7,.4,.29),'wood')
        S.box(name+' trough water',(x+width*.31,y+depth*.26,.312),(.56,.28,.021),'blue')


def wolf(S,name,x,y,angle=0):
    before=set(bpy.context.scene.objects)
    for side in [-1,1]:
        for yy in [-.33,.30]:
            S.beam(name+' strong leg',(side*.17,yy,.1),(side*.18,yy,.53),.058,'wolf',6)
            S.orb(name+' paw',(side*.17,yy+.05,.09),(.09,.14,.07),'shade')
    S.orb(name+' long flank',(0,0,.60),(.28,.51,.28),'wolf')
    S.orb(name+' high withers',(0,.29,.75),(.25,.25,.31),'wolf')
    S.orb(name+' alert head',(0,.48,.97),(.21,.24,.24),'wolf')
    S.orb(name+' muzzle',(0,.69,.93),(.15,.23,.12),'shade')
    S.orb(name+' nose',(0,.88,.93),(.065,.047,.052),'dark')
    for side in [-1,1]:
        S.cyl(name+' pointed ear',(side*.14,.44,1.22),.095,.30,'wolf',4,0)
        S.orb(name+' amber eye',(side*.142,.65,1.015),(.027,.029,.024),'gold')
    S.beam(name+' thick tail',(0,-.38,.69),(.09,-.75,.46),.105,'wolf',7)
    S.beam(name+' tail tip',(.09,-.75,.46),(.1,-.95,.30),.07,'shade',6)
    transform_new(before,x,y,0,angle)
    marker(name,'wolf',(x,y,.6))


def mountain_person(S,name,x,y,z,ogre=False,seated=False,facing=0):
    before=set(bpy.context.scene.objects)
    skin='orcshadow' if ogre else 'troll';clothes='hide' if ogre else 'orccloth'
    scale=1.28 if ogre else 1
    if seated:
        S.orb(name+' boulder seat',(0,-.05,.20),(.42,.32,.25),'stone')
        for side in [-1,1]:
            S.beam(name+' folded thigh',(side*.22,.02,.48),(side*.33,.43,.29),.13,skin,7)
            S.beam(name+' folded shin',(side*.33,.43,.29),(side*.34,.66,.12),.10,skin,7)
        base=.48
    else:
        for side in [-1,1]:
            S.orb(name+' broad foot',(side*.20,.07,.14),(.19,.28,.12),skin)
            S.beam(name+' heavy shin',(side*.21,0,.24),(side*.21,0,.67),.14,skin,7)
            S.beam(name+' bowed thigh',(side*.21,0,.67),(side*.17,0,1.02),.18,skin,7)
        base=.94
    S.orb(name+' hunched broad torso',(0,-.06,base+.48),(.45,.29,.51),skin)
    if ogre:S.orb(name+' rounded belly',(0,.13,base+.26),(.42,.31,.35),skin)
    S.cyl(name+' ragged hide skirt',(0,0,base+.03),.34,.38,clothes,8,.30)
    S.box(name+' heavy belt',(0,.01,base+.20),(.70,.49,.09),'wood')
    for side in [-1,1]:
        elbow=(side*.55,.04,base+.36)
        hand=(side*.52,.31,base+.13)
        S.beam(name+' powerful upper arm',(side*.39,-.02,base+.75),elbow,.15,skin,7)
        S.beam(name+' forearm',elbow,hand,.12,skin,7)
        S.orb(name+' clenched fist',hand,(.14,.13,.15),skin)
    head=base+1.05
    S.orb(name+' protruding head',(0,.07,head),(.28,.24,.31),skin)
    S.orb(name+' heavy jaw',(0,.23,head-.12),(.23,.16,.14),skin)
    S.orb(name+' overhanging brow',(0,.26,head+.06),(.26,.068,.055),'shade')
    for side in [-1,1]:
        S.orb(name+' eye',(side*.1,.306,head+.025),(.04,.021,.033),'bone')
        S.orb(name+' eye pupil',(side*.1,.327,head+.025),(.016,.008,.019),'dark')
        S.cyl(name+' long lower tusk',(side*.17,.34,head-.09),.035,.22,'bone',5,0)
        S.orb(name+' pointed ear',(side*.29,.02,head+.01),(.16,.063,.085),skin)
    S.orb(name+' broad nose',(0,.32,head-.026),(.09,.067,.068),skin)
    if not seated:
        S.beam(name+' brutal club handle',(.55,.30,.19),(.55,.30,1.70),.067,'wood',7)
        S.cyl(name+' stone club head',(.55,.30,1.85),.25,.58,'stone',7,.19)
        for h in [1.62,1.94]:S.cyl(name+' club binding',(.55,.30,h),.26,.075,'hide',7)
    transform_new(before,x,y,z,facing,scale)
    marker(name,'ogre' if ogre else 'troll',(x,y,z),seated=seated)


def cave(S):
    # A real stone arch, dark recessed opening and an irregular mountain mass.
    x,y=-23,12
    marker('Guarded clan mountain cave','cave',(x,y-3.1,0),width=2.8,height=2.6)
    def crag(name,center,size):
        vertices=[];n=9
        for row,(radius,h)in enumerate([(1,-.74),(.98,-.20),(.71,.43),(.30,.88)]):
            for i in range(n):
                a=i*math.tau/n+.18*row;r=radius*(.88+.16*math.sin(i*2.73+row*.86))
                vertices.append((center[0]+math.cos(a)*size[0]*r,center[1]+math.sin(a)*size[1]*r,center[2]+size[2]*(h+.046*math.sin(i*1.9+row))))
        faces=[]
        for row in range(3):
            for i in range(n):faces.append((row*n+i,row*n+(i+1)%n,(row+1)*n+(i+1)%n,(row+1)*n+i))
        faces.append(tuple(range(3*n,4*n)));faces.append(tuple(reversed(range(n))))
        S.A.custom(name,vertices,faces,S.P['granite'])
    for xx,yy,zz,sizes in [(-25,13.8,2.3,(2.8,3.1,3.0)),(-21.9,14.1,3.4,(3.2,3.3,3.7)),(-24.4,16.1,4.8,(3.1,3.0,3.8))]:
        crag('Cave faceted granite shoulder',(xx,yy,zz),sizes)
    S.box('Cave left cliff foot',(x-2.6,y-1.9,1.15),(2.1,3.7,2.5),'granite',.055)
    S.box('Cave right cliff foot',(x+2.4,y-1.9,1.30),(1.8,3.7,2.8),'granite',.045)
    crag('Cave roof granite',(x,y-.7,3.2),(3.5,2.6,1.8))
    # Recessed black mouth avoids an empty tent painted onto a cliff.
    S.box('Cave tunnel floor',(x,y-.45,.05),(2.4,5.5,.10),'dark')
    S.box('Cave deep entrance darkness',(x,y+.25,1.17),(2.25,.12,2.40),'dark')
    for side in [-1,1]:S.box('Cave inner tunnel wall',(x+side*1.19,y-.6,1.17),(.12,3.7,2.40),'dark')
    for i in range(9):
        angle=i*math.pi/8
        block=S.box('Cave vaulted stone arch',(x+math.cos(angle)*1.55,y-3.16,.45+math.sin(angle)*2.1),(.72,.68,.69),'shade' if i%3==0 else 'granite',.035)
        block.rotation_euler[1]=angle-math.pi/2
    for xx in [x-1.8,x+1.9]:
        V3.orc_figure('Mountain cave spear guard',xx,y-4.0,False,math.pi,True)
        marker('Cave sentinel','caveGuard',(xx,y-4,0))
        S.beam('Cave entry burning torch',(xx+.5,y-4.2,.1),(xx+.5,y-4.2,1.8),.044,'wood',5)
        S.cyl('Cave torch flame',(xx+.5,y-4.2,1.91),.12,.32,'fire',5,0)


def upper_camp(S):
    marker('Highland troll and ogre terrace','mountainCamp',(-15.5,19,4),width=10,depth=7)
    S.orb('Highland rocky foundation',(-15.5,19,1.66),(5.4,4.0,2.9),'shade')
    S.box('Highland level stone ledge',(-15.5,19,3.87),(9.6,7.0,.25),'stone',.08)
    for i in range(9):S.box('Highland carved approach step',(-11.7,13.2+i*.31,.21+i*.44),(1.25,.38,.40),'shade')
    for i,(x,y)in enumerate([(-18,20.3),(-14.4,20.7),(-11.8,19.7)]):
        before=set(bpy.context.scene.objects);V3.small_hide_tent('Highland hide lodge '+str(i),x,y,.25*i)
        bpy.context.view_layer.update()
        for obj in set(bpy.context.scene.objects)-before:obj.location.z+=4
        marker('Highland lodge '+str(i),'mountainTent',(x,y,4))
    before=set(bpy.context.scene.objects);S.hearth(-16,17.9)
    for obj in set(bpy.context.scene.objects)-before:obj.location.z+=4
    marker('Highland communal fire','mountainFire',(-16,17.9,4))
    for i,(x,y)in enumerate([(-17.0,17.4),(-16.2,19.0),(-14.9,17.5)]):mountain_person(S,'Seated highland troll '+str(i),x,y,4,seated=True,facing=i*2.2)
    mountain_person(S,'Troll ledge watchman',-19.2,17.8,4,facing=math.pi)
    mountain_person(S,'Ogre mountain guardian',-12.2,16.7,4,True,facing=math.pi)
    mountain_person(S,'Ogre clan elder',-17.9,21.0,4,True,True,facing=.5)
    for x,y in [(-19.5,18.0),(-19.5,20.4),(-11.0,20.6)]:
        S.beam('Highland bone totem post',(x,y,4),(x,y,6.3),.067,'wood',6)
        S.orb('Highland totem skull',(x,y,6.33),(.19,.16,.22),'bone')


def build_orc_territory(S):
    V3.inhabited_warcamp()
    marker('Original fortified clan gate','stockade',(0,0,0))
    tent_sites=[(-17.1,-6.1),(-21.6,-4.7),(-24.9,-7.6),(-17,-11),(-22,-11.8),(-25,-15.7),(-17.9,-16.9),(-12.9,-13),(-9,-15.7),(-5,-12.4),(-4.4,-17),(-21.8,1.1),(-24.6,3.3),(-16.5,9.4)]
    for i,(x,y)in enumerate(tent_sites):
        V3.small_hide_tent('Clan hide pavilion '+str(i),x,y,(i%4-.5)*.28)
        marker('Clan pavilion '+str(i),'tent',(x,y,0))
    for i,(x,y)in enumerate([(-19,-8.9),(-14.9,-15.6),(-6.3,-14.9),(-23.2,-1.9)]):
        S.hearth(x,y);marker('Outer clan fire '+str(i),'campfire',(x,y,0))
        for j in range(3):
            a=j*math.tau/3+.25
            px=x+math.cos(a)*.85;py=y+math.sin(a)*.85
            V3.orc_figure('Outer fire seated orc '+str(i)+' '+str(j),px,py,True,math.atan2(y-py,x-px)-math.pi/2)
            marker('Outer camp inhabitant '+str(i)+' '+str(j),'seatedOrc',(px,py,0))
    pen(S,'Western wolf paddock',-17.5,3.2,5.5,4.7)
    pen(S,'Northern wolf training pen',-9.4,13.5,4.0,3.3)
    pen(S,'Iron wolf holding cage',-14.1,12.7,2.7,2.5,True)
    pen(S,'Southern captured wolf cage',-24.2,-19.5,2.8,2.5,True)
    for i,(x,y)in enumerate([(-18.8,3),(-16.5,2.4),(-17.3,4.2),(-18.7,1.4),(-9.7,13.0),(-8.6,14),(-10.5,14.2),(-14.5,12.6),(-13.6,12.9),(-24.7,-19.5),(-23.6,-19.8)]):wolf(S,'Clan captured wolf '+str(i),x,y,i*.73)
    for i,(x,y)in enumerate([(-15.4,6.2),(-6.8,13.4),(-21.7,-19.1),(-25.7,-11.6),(-14.1,-18.6),(-2.8,-15.0)]):
        V3.orc_figure('Far clan boundary guard '+str(i),x,y,False,(i*.73)%math.tau,True)
        marker('Outer boundary guard '+str(i),'campGuard',(x,y,0))
    for points in [[(-3,-4),(-10,-10),(-17,-9),(-23,-9)], [(-12,-10),(-14,-16),(-23,-18)], [(-11,2),(-14,7),(-19,7),(-23,8)], [(-6,7),(-6,12),(-11,15)]]:trail(S,'Clan connecting track',points,1.1)
    cave(S);upper_camp(S)
