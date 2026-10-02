"""Assemble actual Blender GLB review frames into short attack GIF evidence.

Run with a Python environment containing Pillow after the Blender review pass.
No synthetic pose/weapon/effect pixels are introduced. A uniform studio backdrop
composites the transparent render alpha; each frame is a sampled exported rig.
"""
from pathlib import Path
import json,hashlib,struct
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parents[2]
ART=ROOT/'artifacts';REV=ROOT/'blender/renders/defenders-v8-creatures'
patch=ART/'defender-creatures-v8-metadata.json'
entries=json.loads(patch.read_text(encoding='utf-8'))
entries.sort(key=lambda row:row['family'])
audits=[];proof=[]
for row in entries:
    family=row['family'];path=ROOT/'public/assets/models'/row['file'];data=path.read_bytes();sha=hashlib.sha256(data).hexdigest()
    length=struct.unpack_from('<I',data,12)[0];gltf=json.loads(data[20:20+length])
    audit=json.loads((ART/(family+'-v8-roundtrip-audit.json')).read_text(encoding='utf-8'))
    if audit['modelSha256']!=sha:raise RuntimeError(f'Outdated render proof for {family}')
    frames=[]
    for framepath in sorted((ART/(family+'-v8-attack-frames')).glob('*.png')):
        im=Image.open(framepath).convert('RGBA');bg=Image.new('RGBA',im.size,(20,36,33,255));bg.alpha_composite(im)
        frames.append(bg.convert('RGB').quantize(colors=220))
    if len(frames)!=26:raise RuntimeError(f'Incomplete attack sequence for {family}: {len(frames)} frames')
    output=REV/(family+'-attack-glb.gif');frames[0].save(output,save_all=True,append_images=frames[1:],duration=[40]*25+[320],loop=0,disposal=2)
    meshes=len(gltf.get('meshes',[]));materials=len(gltf.get('materials',[]));bones=len(gltf['skins'][0]['joints'])
    row.update(sha256=sha,glbBytes=len(data),materials=materials,skinBatches=meshes)
    contactkeys={key for frame in audit['frames'] for key in frame.get('contacts',{})}
    contacts={key:max(frame.get('contacts',{}).get(key,0) for frame in audit['frames']) for key in sorted(contactkeys)}
    origin=[frame['muzzle'] for frame in audit['frames']]
    travel=max(sum((p[i]-origin[0][i])**2 for i in range(3))**.5 for p in origin)
    proof.append(dict(family=family,sha256=sha,triangles=row['triangles'],bones=bones,materials=materials,skinBatches=meshes,
        animations=row['animationClips'],releaseFraction=.36,muzzleTravelMeters=travel,maxContactDistances=contacts,
        attackGIF=str(output.relative_to(ROOT)).replace('\\','/'),reviewFrameCount=len(frames),
        reviewImages=[str(p.relative_to(ROOT)).replace('\\','/') for p in sorted(REV.glob(family+'-*.png'))],
        contactMeasurement='Rigged contact markers throughout 51 attack frames; visual macro renders inspect actual surfaces' if contacts else 'No mounted rider',
        surfaceFit=[node.get('extras',{}) for node in gltf.get('nodes',[]) if 'shoulderScaleFit' in node.get('extras',{})]))
    audits.append(audit)
    print(f'{family}: {row["triangles"]:,} triangles, {bones} bones, {materials} materials, {meshes} batches; GIF {output.stat().st_size:,} bytes')
patch.write_text(json.dumps(entries,indent=2)+'\n',encoding='utf-8')
(ART/'defender-creatures-v8-roundtrip-audit.json').write_text(json.dumps(audits,indent=2)+'\n',encoding='utf-8')
(ART/'defender-creatures-v8-final-proof.json').write_text(json.dumps(proof,indent=2)+'\n',encoding='utf-8')
# A contact sheet retains actual rendered models for quick whole-roster review.
fontpath=Path('C:/Windows/Fonts/segoeui.ttf')
font=ImageFont.truetype(str(fontpath),20) if fontpath.exists() else ImageFont.load_default()
sheet=Image.new('RGB',(1440,1840),(20,36,33));draw=ImageDraw.Draw(sheet)
for index,row in enumerate(entries):
    col=index%4;r=index//4;im=Image.open(REV/(row['family']+'-three-quarter.png')).convert('RGBA');im.thumbnail((350,420))
    x=col*360+(360-im.width)//2;y=r*460
    sheet.paste(im,(x,y),im);draw.text((col*360+14,y+425),row['name'],font=font,fill=(238,226,193))
sheet.save(REV/'creatures-engines-v8-gallery.png')
freeze_paths=[ROOT/'blender/scripts'/name for name in ['defender_creatures_v8.py','defender_engines_v8.py','author_defender_creatures_v8.py','encode_defender_creatures_v8.py']]
freeze_paths += [patch,ART/'defender-creatures-v8-final-proof.json',ART/'defender-creatures-v8-roundtrip-audit.json']
for row in entries:
    freeze_paths += [ROOT/'public/assets/models'/row['file'],ROOT/row['source'],ROOT/'public/assets/army'/(row['family']+'-t1.png'),REV/(row['family']+'-attack-glb.gif')]
frozen={str(p.relative_to(ROOT)).replace('\\','/'):dict(sha256=hashlib.sha256(p.read_bytes()).hexdigest(),bytes=p.stat().st_size) for p in sorted(freeze_paths)}
(ART/'defender-creatures-v8-freeze.json').write_text(json.dumps(dict(files=frozen,
    verificationScope='Fresh GLB import in Blender 5.2; 51 evaluated attack frames; 26 rendered full-attack frames; front/back/both sides and detail renders; mounted preparation/release/follow contact macros',
    limitations=['Stylized game figures, not photorealistic characters','Fixed modeled finger grips deform with the hand and weapon rig; no independent fingertip animation','Hair and cloth use authored motion, not physical simulation','Contact measurements use rigged markers plus visual surface inspection; not an exhaustive automated triangle collision proof','Atelier and real-game integration review is performed by the parent task']),indent=2)+'\n',encoding='utf-8')
print('All 14 frozen GLB hashes match their final exported-rig review evidence.')
