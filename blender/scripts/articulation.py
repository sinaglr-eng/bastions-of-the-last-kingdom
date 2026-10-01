"""Blender-authored rigid articulation; rest geometry stays in world space.

The exporter may batch meshes only inside these named joints. Runtime clones
move real limb/equipment descendants without changing cached mesh geometry.
"""
import bpy
from mathutils import Vector


def parent_keep_world(obj, parent):
    bpy.context.view_layer.update()
    transform=obj.matrix_world.copy();obj.parent=parent
    obj.matrix_world=transform


def pivot(name, location, parent=None):
    obj=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(obj)
    obj.location=location;obj.empty_display_type='PLAIN_AXES';obj.empty_display_size=.065
    obj['articulation']='defender-v1'
    if parent:parent_keep_world(obj,parent)
    return obj


def limb(shoulder, elbow, hand):
    side='L' if shoulder[0]<0 else 'R'
    upper=pivot('upper_arm_'+side,shoulder)
    lower=pivot('forearm_'+side,elbow,upper)
    wrist=pivot('hand_'+side,hand,lower)
    weapon=pivot('weapon_'+side,hand,wrist)
    return upper,lower,wrist,weapon


def attach(parts, parent):
    for obj in parts:
        if obj and obj.name in bpy.data.objects:parent_keep_world(obj,parent)


def articulated_parts(parts, shoulder, elbow, hand):
    upper,lower,wrist,weapon=limb(shoulder,elbow,hand)
    for obj in parts:
        name=obj.name.lower()
        joint=upper if any(k in name for k in ('shoulder','upper arm','sleeve')) else wrist if any(k in name for k in ('hand','fist','palm','finger','thumb','glove')) else lower
        parent_keep_world(obj,joint)
    return upper,lower,wrist,weapon


def centre(obj):
    return sum((obj.matrix_world@Vector(v) for v in obj.bound_box),Vector())/8


def meshes():return [o for o in bpy.context.scene.objects if o.type=='MESH']


def finalize(family):
    """Attach class equipment and upper-body detail to the authored limb chain."""
    bpy.context.view_layer.update()
    objects=meshes()
    limbs={side:bpy.context.scene.objects.get('upper_arm_'+side) for side in ('L','R')}
    weapons={side:bpy.context.scene.objects.get('weapon_'+side) for side in ('L','R')}
    if not any(limbs.values()):
        # Siege weapons retain their chassis and their dedicated throwing pivot.
        if family in ('kingsreach','fireballista','royalarsenal'):
            weapon=pivot('weapon_pivot',(0,0,.95))
            for obj in objects:
                if obj.parent:continue
                if any(k in obj.name.lower() for k in ('ballista','crossbow','bolt','bow limb','bowstring','launch rail','barrel','cannon')):
                    parent_keep_world(obj,weapon)
            pivot('attack_muzzle',(0,.71,1.12),weapon)
        return
    waist=min((o.matrix_world.translation.z for o in limbs.values() if o),default=1.34)*.70
    torso=pivot('torso_pivot',(0,0,waist))
    for joint in limbs.values():
        if joint:parent_keep_world(joint,torso)
    head=bpy.context.scene.objects.get('head_pivot') or pivot('head_pivot',(0,0,waist+.49))
    parent_keep_world(head,torso)
    for name in ('left_wing_pivot','right_wing_pivot'):
        wing=bpy.context.scene.objects.get(name)
        if wing:parent_keep_world(wing,torso)
    bow_parts=[];staff_parts=[];string_parts=[]
    for obj in objects:
        if obj.parent:continue
        name=obj.name.lower();pos=centre(obj);side='L' if pos.x<0 else 'R'
        weapon=weapons.get(side) or weapons.get('R') or weapons.get('L')
        if any(k in name for k in ('plinth','pedestal','footing','stone top','stone cap','inlay','ankle halo','floating light mote')):continue
        if any(k in name for k in ('staff','crozier','spell focus','focus prong','acorn focus')):
            parent_keep_world(obj,weapons.get('R') or weapon);staff_parts.append(obj)
        elif any(k in name for k in ('bowstring','drawn bowstring')):
            parent_keep_world(obj,weapons.get('L') or weapon);string_parts.append(obj)
        elif any(k in name for k in ('recurve','bow limb','bow laminate','bow grip','bow wrapped','horn bow','laminated bow','elven bow')):
            parent_keep_world(obj,weapons.get('L') or weapon);bow_parts.append(obj)
        elif any(k in name for k in ('crossbow','arbalest','quarrel','ice bolt tip')):
            parent_keep_world(obj,weapons.get('R') or weapon)
        elif any(k in name for k in ('sword','blade','warhammer','hammer','ruler','frost sigil')):
            parent_keep_world(obj,weapons.get('R') or weapon)
        elif any(k in name for k in ('shield','heraldic crossbar')) or ('lion' in name and pos.x<-.2):
            parent_keep_world(obj,weapons.get('L') or weapon)
        elif any(k in name for k in ('arrowhead','nocked arrow','arrow fletching','readied enchanted arrow','arrow steel point')):
            parent_keep_world(obj,weapons.get('R') or weapon)
        elif any(k in name for k in ('offered','spellbook','parchment','tome','illuminated script','storm orb','forked lightning','poisonous seed','poison thorn seed')):
            parent_keep_world(obj,weapon)
        elif ('bomb' in name or 'fuse' in name) and abs(pos.x)>.35:
            parent_keep_world(obj,weapon)
        elif any(k in name for k in ('pauldron','shoulder lame','shoulder flange','elbow couter','gauntlet','shoulder scallop','shoulder plate')):
            joint=limbs.get(side)
            if joint:parent_keep_world(obj,joint)
        elif any(k in name for k in ('fist finger','shoulder projecting','moss on shoulder','articulated finger')):
            joint=limbs.get(side) if 'shoulder' in name else bpy.context.scene.objects.get('hand_'+side)
            if joint:parent_keep_world(obj,joint)
        elif pos.z>waist+.51 and abs(pos.x)<.35:
            parent_keep_world(obj,head)
        elif pos.z>waist or any(k in name for k in ('cloak','cape','mantle')):
            parent_keep_world(obj,torso)
    if staff_parts:
        # This marker follows the staff and is the actual spell origin, not a guessed tower height.
        focus=max(staff_parts,key=lambda obj:centre(obj).z)
        pos=centre(focus);pivot('staff_tip',tuple(pos),focus.parent)
    elif family in ('mage','stormcaller','tempest','stormcitadel','mothernature'):
        hand=bpy.context.scene.objects.get('hand_R')
        if hand:pivot('staff_tip',tuple(hand.matrix_world.translation+Vector((0,.025,.13))),hand)
    if bow_parts:
        bow=weapons.get('L');bow.name='bow_pivot'
        points=[obj.matrix_world@Vector(v) for obj in bow_parts for v in obj.bound_box]
        top=max(points,key=lambda p:p.z);bottom=min(points,key=lambda p:p.z)
        pivot('bow_tip_upper',tuple(top),bow);pivot('bow_tip_lower',tuple(bottom),bow)
        pivot('bow_nock',tuple(bpy.context.scene.objects['hand_R'].matrix_world.translation),bpy.context.scene.objects['hand_R'])
        strings=pivot('authored_bowstring',tuple(bow.matrix_world.translation),bow);attach(string_parts,strings)
        pivot('attack_muzzle',tuple((top+bottom)/2),bow)
    elif not staff_parts:
        wrist=bpy.context.scene.objects.get('hand_R')
        if wrist:pivot('attack_muzzle',tuple(wrist.matrix_world.translation),wrist)


def metadata():
    names=[o.name for o in bpy.context.scene.objects if o.type=='EMPTY' and o.get('articulation')]
    return dict(articulationRevision=1,attackJoints=sorted(names))
