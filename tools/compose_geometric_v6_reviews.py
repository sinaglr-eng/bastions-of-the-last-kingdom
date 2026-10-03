"""Manifest-resolved fresh/inherited six actual views, without editing pixels."""
import json,hashlib,argparse
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageOps
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'output/design/geometric-game-v6'
VIEWS=['front','back','left','right','three-quarter-front','three-quarter-back']
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
font=lambda s:ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',s)
def contain(im,size,alpha=False):
 im=im.convert('RGBA')
 if alpha:
  box=im.getchannel('A').getbbox()
  if box:im=im.crop(box)
 im=ImageOps.contain(im,size,Image.Resampling.LANCZOS);out=Image.new('RGB',size,'#f6f1e7');out.paste(im,((size[0]-im.width)//2,(size[1]-im.height)//2),im);return out
def run(stages):
 index_path=OUT/'review-index.json';old=json.loads(index_path.read_text(encoding='utf8'))if index_path.exists()else{'entries':[]};entries={r['id']:r for r in old['entries']}
 for stage in stages:
  cat='enemies';manifest_path=ROOT/stage;mf=json.loads(manifest_path.read_text(encoding='utf8'))
  for row in mf.get('assets',mf.get('entries',[])):
   aid=row['id'];q=row.get('metrics',row.get('qa'));fresh=row.get('sourceRepairRevision')=='geometric-game-v6'or bool(row.get('sourceRepairV6'))or row.get('anatomyRevision')=='geometric-source-specific-enemy-v6';views=row.get('views',q.get('views',[]));assert len(views)==6,(aid,'missing final6views')
   sourcefile=row.get('sourceFile',row.get('source'));source=ROOT/'output/design/geometric-turnarounds-v1'/sourcefile;assert sha(source)==row['sourceSha256'],aid
   src=Image.open(source).convert('RGB');image=Image.new('RGB',(1060,2358),'#f6f1e7');draw=ImageDraw.Draw(image);draw.text((30,16),aid+' / '+('V6 actual geometry'if fresh else'V5 unchanged geometry')+(' - intermediate mount preview'if row.get('sourceRepairV6',{}).get('intermediateMountOnlyPreview')else''),font=font(23),fill='#36403d');draw.text((30,60),'ORIGINAL SOURCE',font=font(16),fill='#36403d');draw.text((552,60),'ACTUAL MODEL / SIX CAMERAS',font=font(16),fill='#36403d');renderrows=[]
   for j,name in enumerate(VIEWS):
    v=next(v for v in views if v['view']==name);p=ROOT/v.get('path',v.get('file'));assert p.exists(),p
    assert v['geometrySha256']==q['geometrySha256'],(aid,name,'stale rendergeometry')
    y=93+j*367;draw.text((30,y),name,font=font(19),fill='#36403d');col=j%3;r=j//3;w,h=src.size;crop=src.crop((col*w//3,r*h//2,(col+1)*w//3,(r+1)*h//2));image.paste(contain(crop,(492,328)),(25,y+28));image.paste(contain(Image.open(p),(492,328),True),(543,y+28));draw.line((25,y+360,1035,y+360),fill='#d6d2c9');renderrows.append({'view':name,'path':p.relative_to(ROOT).as_posix(),'sha256':sha(p),'geometrySha256':q['geometrySha256'],'freshV6Render':fresh})
   draw.text((30,2310),'Source-specific shapes; physical scale/depth are authored estimates. Preview requires actual inspection.',font=font(15),fill='#36403d');dest=OUT/'paired-six-views'/cat/(aid+'.jpg');dest.parent.mkdir(parents=True,exist_ok=True);image.save(dest,quality=94,subsampling=0)
   glb=ROOT/'public/assets/geometric'/row['file'];native=ROOT/row.get('nativeFile',row.get('native'));portrait=ROOT/'public/assets/geometric'/row['portrait'];assert sha(glb)==q['fileSha256'],aid
   entries[aid]={'id':aid,'category':cat,'source':source.relative_to(ROOT).as_posix(),'sourceSha256':sha(source),'actualGlbSha256':sha(glb),'actualNativeSha256':sha(native),'actualPortraitSha256':sha(portrait),'geometrySha256':q['geometrySha256'],'contactSheet':dest.relative_to(ROOT).as_posix(),'contactSheetSha256':sha(dest),'actualSixViews':renderrows,'freshV6':fresh,'humanInspectionRecorded':False}
 report={'revision':'geometric-game-v6','method':'Original untouched source and manifest-resolved actual mesh renders; output does not itself certify human inspection.','entries':list(entries.values())};OUT.mkdir(parents=True,exist_ok=True);index_path.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8',newline='\n');print('V6_REVIEW_INDEX '+str(len(entries)))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--stages',default='output/design/geometric-game-v6/stage-humanoid-enemies.json');run(p.parse_args().stages.split(','))
