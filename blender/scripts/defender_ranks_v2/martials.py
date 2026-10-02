"""Soldier and Archer: approved six-level equipment progression."""
import math
import bpy
from mathutils import Vector

def hair(b):
    obj=b.rings('short_hair',[(0,-.01,1.92,.145,.115),(0,-.01,1.99,.15,.12),(0,-.02,2.015,.085,.07)],'hair');b.attach(obj,b.head)

def helmet(b,closed=False):
    if closed:
        obj=b.rings('closed_helm',[(0,.044,1.666,.160,.220),(0,.044,1.94,.181,.220),(0,.044,2.055,.106,.14)],'steel');b.attach(obj,b.head)
        b.attach(b.panel('closed_helm_eye_slit',[(-.118,.267,1.906),(.118,.267,1.906),(.118,.267,1.929),(-.118,.267,1.929)],.004,'eyes'),b.head)
    else:
        b.attach(b.rings('helmet',[(0,-.04,1.946,.168,.187),(0,-.047,2.008,.165,.185),(0,-.04,2.075,.04,.075)],'steel'),b.head)
        for s in (-1,1):b.attach(b.panel('helmet_cheek_'+str(s),[(s*.146,.173,1.96),(s*.194,.123,1.927),(s*.185,.14,1.686),(s*.146,.176,1.715)],.05,'steel'),b.head)

def breastplate(b,leather=False,trim=False):
    mat='boots' if leather else 'steel'
    obj=b.panel('leather_jerkin' if leather else 'breastplate',[(-.176,.148,1.43),(.176,.148,1.43),(.15,.166,1.17),(.105,.16,1.12),(-.105,.16,1.12),(-.15,.166,1.17)],.045,mat,True)
    b.attach(obj,b.torso)
    if trim:b.attach(b.panel('silver_chest_edging',[(-.177,.157,1.44),(0,.186,1.362),(.177,.157,1.44),(.172,.169,1.403),(0,.201,1.321),(-.172,.169,1.403)],.015,'steel'),b.torso)

def shoulders(b):
    for side,s in [('left',-1),('right',1)]:
        obj=b.panel('shoulder_plate_'+side,[(s*.175,.147,1.493),(s*.248,.13,1.477),(s*.339,.112,1.398),(s*.323,.124,1.363),(s*.200,.152,1.387)],.16,'steel',True)
        b.attach(obj,b.upper.get(side) or b.torso)

def sword(b):
    x=.53;y=.12;z=1.145
    b.attach(b.rod('sword_grip',(x,y,z-.13),(x,y,z+.03),.03,'boots'),b.weapon['right'])
    b.attach(b.box('sword_guard',(x,y,z+.08),(.24,.065,.045),'steel'),b.weapon['right'])
    b.attach(b.panel('sword_blade',[(x-.044,y+.022,z+.1),(x+.044,y+.022,z+.1),(x+.033,y+.022,2.08),(x,y+.022,2.21),(x-.033,y+.022,2.08)],.044,'steel',True),b.weapon['right'])

def shield(b,metal=False):
    x=-.55;y=.28;top=1.48;bottom=.75
    outline=[(x-.22,y,top),(x,y,top+.12),(x+.22,y,top),(x+.21,y,1.04),(x,y,bottom),(x-.21,y,1.04)]
    b.attach(b.panel('iron_shield' if metal else 'wooden_shield',outline,.065,'steel' if metal else 'wood',metal),b.weapon['left'])
    if not metal:
        for dx in (-.072,.075):b.attach(b.rod('wooden_shield_panel_seam',(x+dx,y+.004,1.03),(x+dx,y+.004,1.48),.006,'belt',4),b.weapon['left'])

def soldier(b):
    r=b.rank;b.body(hood=False,mantle=True,cape='long' if r>=5 else 'short')
    b.arm('right',(.32,.01,1.27),(.53,.12,1.145),metal=r>=5)
    b.arm('left',(-.28,.07,1.25),(-.47,.18,1.15),metal=r>=5)
    if r==1:
        hair(b);b.attach(b.rod('wooden_spear_shaft',(.53,.12,.20),(.53,.12,2.055),.022,'wood'),b.weapon['right'])
        b.attach(b.panel('wooden_spear_point',[(.53,.145,2.22),(.475,.145,2.045),(.53,.145,1.966),(.585,.145,2.045)],.048,'wood',True),b.weapon['right'])
    else:
        helmet(b,r==6);sword(b)
        if r>=3:shield(b,r>=5)
        if r>=4:breastplate(b)
        if r>=5:
            shoulders(b)
            for obj in b.objects:
                if 'Boot' in obj.name:obj.data.materials.clear();obj.data.materials.append(b.m['steel'])
            for s in (-1,1):b.attach(b.panel('armored_knee_'+str(s),[(s*.13-.062,.115,.77),(s*.13+.062,.115,.77),(s*.13+.066,.134,.62),(s*.13-.066,.134,.62)],.028,'steel',True),b.root)
    b.pivot('attack_muzzle',(.53,.12,1.45),b.weapon['right'])

def archer(b):
    r=b.rank;b.body(mantle=r>=2,cape=False if r==1 else 'long' if r>=4 else 'short',keep_equipment=True)
    b.arm('left',(-.35,.05,1.29),(-.62,.108,1.145))
    b.arm('right',(.29,.02,1.24),(.36,.07,.94))
    if r>=3:breastplate(b,True,r==6)
    if r>=5:shoulders(b)
    bow_parts=[o for o in b.objects if o.get('part') in ('Continuous_Recurve_Bow','Taut_Bow_String')]
    bow=b.weapon['left'];bow.name='bow_pivot'
    scale=[.67,.67,.92,1.0,1.0,1.02][r-1]
    for obj in bow_parts:
        for v in obj.data.vertices:
            v.co.z=1.145+(v.co.z-1.145)*scale
            if r==4:v.co.x=-.65+(v.co.x+.65)*.60
        b.attach(obj,bow)
    shape=next(o for o in bow_parts if o.get('part')=='Continuous_Recurve_Bow')
    if r>=5:
        shape.data.materials.append(b.m['ivory' if r==5 else 'steel'])
        for p in shape.data.polygons:
            z=sum(shape.data.vertices[i].co.z for i in p.vertices)/len(p.vertices)
            if z>1.83 or z<.46 or .93<z<1.02 or 1.32<z<1.40:p.material_index=1
        for v in shape.data.vertices:
            if v.co.x<-.67:v.co.x=-.67+(v.co.x+.67)*(1.25 if r==5 else 1.55)
    # Markers are actual moving bow tips. Runtime replaces the authored string.
    points=[v.co.copy() for v in shape.data.vertices]
    top=max(points,key=lambda p:p.z);low=min(points,key=lambda p:p.z)
    b.pivot('bow_tip_upper',tuple(top),bow);b.pivot('bow_tip_lower',tuple(low),bow)
    b.pivot('bow_nock',(.36,.07,.94),b.hand['right'])
    strings=b.pivot('authored_bowstring',(-.62,.108,1.145),bow)
    b.attach([o for o in bow_parts if o.get('part')=='Taut_Bow_String'],strings)
    b.pivot('attack_muzzle',(-.65,.108,1.145),bow)

def build(b):
    return soldier(b) if b.family=='soldier' else archer(b)
