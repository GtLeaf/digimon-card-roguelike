"""将十二个主角形态的 GIF 无损拆帧，统一画布，生成清单及预览。"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, hashlib, shutil, html
ROOT=Path(__file__).resolve().parents[1]
REV='4b2273e163f023b9562cc69e4642f97a0684cb87'
REPO='E-M-B-E-R/digimon-world-ds-dawn-dusk-animated-sprites'
SRC=ROOT/'assets/vendor/digimon-ds/original'
OUT=ROOT/'assets/characters'
PREVIEW=ROOT/'previews'
OUT.mkdir(parents=True,exist_ok=True)
PREVIEW.mkdir(exist_ok=True)
ROUTES=[
 ('guilmon','基尔兽路线',[('rookie','Guilmon','基尔兽'),('champion','Growlmon','古拉兽'),('ultimate','WarGrowlmon','大古拉兽'),('mega','Dukemon','红莲骑士兽')]),
 ('terriermon','大耳兽路线',[('rookie','Terriermon','大耳兽'),('champion','Galgomon','加鲁哥兽'),('ultimate','Rapidmon','拉比兽'),('mega','SaintGalgomon','撒多格杜兽')]),
 ('renamon','妖狐兽路线',[('rookie','Renamon','妖狐兽'),('champion','Kyubimon','九尾狐兽'),('ultimate','Taomon','祭师兽'),('mega','Sakuyamon','沙古牙兽')])]
STAGES=['成长期','成熟期','完全体','究极体']
manifest={'version':1,'sourceRepository':f'https://github.com/{REPO}','sourceRevision':REV,
 'rights':'Original game assets; rights remain with original rights holders. No commercial license granted by this collection.',
 'cellSize':{'width':256,'height':256},'anchor':{'x':128,'y':224},
 'animationCoverage':'One four-frame loop per character; no separate attack/hit/death animations supplied.',
 'characters':[]}
checks=[]
for route,label,forms in ROUTES:
 for stage_index,(folder,name,zh) in enumerate(forms):
  source=SRC/folder/(name+'.gif')
  char_id=name.lower()
  dest=OUT/char_id
  (dest/'frames').mkdir(parents=True,exist_ok=True)
  frames=[]; durations=[]; boxes=[]
  with Image.open(source) as im:
   original_size=list(im.size)
   for i in range(im.n_frames):
    im.seek(i)
    frame=im.convert('RGBA').copy()
    frames.append(frame)
    durations.append(im.info.get('duration',100))
    boxes.append(frame.getbbox())
  bounds=(min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes))
  w,h=bounds[2]-bounds[0],bounds[3]-bounds[1]
  assert w<=256 and h<=224
  x=128-w//2; y=224-h
  sheet=Image.new('RGBA',(256*len(frames),256))
  normalized=[]
  for i,frame in enumerate(frames):
   cropped=frame.crop(bounds)
   canvas=Image.new('RGBA',(256,256))
   canvas.paste(cropped,(x,y))
   assert canvas.crop((x,y,x+w,y+h)).tobytes()==cropped.tobytes()
   canvas.save(dest/'frames'/f'{i:02}.png')
   sheet.paste(canvas,(i*256,0))
   normalized.append(canvas)
  sheet.save(dest/'idle-sheet.png')
  normalized[0].save(dest/'portrait.png')
  shutil.copy2(source,dest/'source.gif')
  prefix=f'assets/characters/{char_id}'
  entry={'id':char_id,'name':zh,'sourceName':name,'route':route,'routeName':label,'stage':STAGES[stage_index],
   'source':source.relative_to(ROOT).as_posix(),'sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),
   'sourceSize':original_size,'sourceUnionBounds':list(bounds),'contentSize':[w,h],
   'sheet':f'{prefix}/idle-sheet.png','portrait':f'{prefix}/portrait.png','gif':f'{prefix}/source.gif',
   'frameCount':len(frames),'frameWidth':256,'frameHeight':256,'frameDurationMs':durations,'loopDurationMs':sum(durations),
   'frames':[f'{prefix}/frames/{i:02}.png' for i in range(len(frames))]}
  manifest['characters'].append(entry)
  checks.append(f"{zh} ({name}): {len(frames)} 帧 / {sum(durations)}ms / 内容 {w}×{h}px / 透明 / 像素保真通过")
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')

font=ImageFont.truetype('/System/Library/Fonts/STHeiti Light.ttc',20)
small=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',15)
contact=Image.new('RGB',(1120,1050),'#0b1220'); d=ImageDraw.Draw(contact)
d.text((24,14),'三条搭档路线 · 12 个进化形态',font=font,fill='#f0f7ff')
for i,c in enumerate(manifest['characters']):
 x=(i%4)*280; y=(i//4)*330+50
 d.rounded_rectangle((x+8,y,x+272,y+314),radius=12,fill='#182438',outline='#32425c')
 with Image.open(ROOT/c['portrait']) as im: contact.paste(im,(x+12,y+2),im)
 d.text((x+20,y+258),c['name']+' · '+c['stage'],font=font,fill='#f0f7ff')
 d.text((x+20,y+287),c['sourceName']+f"  /  {c['loopDurationMs']}ms",font=small,fill='#9ab0ca')
contact.save(PREVIEW/'characters-contact-sheet.png')

cards=[]
for c in manifest['characters']:
 duration=c['loopDurationMs']/1000
 assert len(set(c['frameDurationMs']))==1, 'CSS preview requires equal-duration frames'
 cards.append(f'''<article><div class="stage"><div class="sprite" role="img" aria-label="{c['name']}循环动画" style="background-image:url('../{c['sheet']}');animation-duration:{duration}s"></div></div><div class="info"><small>{c['routeName']} / {c['stage']}</small><h2>{c['name']}</h2><p>{c['sourceName']} · 4 帧 · {c['loopDurationMs']}ms</p><a href="../{c['portrait']}">透明 PNG</a><a href="../{c['sheet']}">精灵图</a><a href="../{c['gif']}">原始 GIF</a></div></article>''')
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>数码兽素材预览</title><style>
*{box-sizing:border-box}body{margin:0;background:#0b1220;color:#eef5ff;font-family:system-ui,-apple-system,sans-serif}main{max-width:1200px;margin:auto;padding:24px 18px 48px}header{padding:16px 0 24px}.eyebrow{color:#61decc;font-size:13px;letter-spacing:2px}h1{font-size:32px;margin:12px 0}header p{color:#aebbd1;line-height:1.7;max-width:700px}.controls{display:flex;gap:12px;flex-wrap:wrap}button{min-height:44px;background:#23354e;border:1px solid #48607c;color:#fff;border-radius:8px;padding:8px 16px;font-size:15px;cursor:pointer}button:focus-visible,a:focus-visible{outline:3px solid #61decc;outline-offset:4px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}article{border:1px solid #30435d;border-radius:14px;overflow:hidden;background:#142136}.stage{height:256px;display:flex;justify-content:center;background:repeating-conic-gradient(#182a40 0% 25%,#1d3047 0% 50%) 0/24px 24px}.light .stage{background:repeating-conic-gradient(#fff 0% 25%,#e5e9ef 0% 50%) 0/24px 24px}.sprite{width:256px;height:256px;flex-shrink:0;background-repeat:no-repeat;image-rendering:pixelated;animation:idle .8s steps(4) infinite}.paused .sprite{animation-play-state:paused}@keyframes idle{to{background-position:-1024px 0}}.info{padding:16px}.info small{color:#61decc}.info h2{font-size:21px;margin:9px 0}.info p{color:#aebbd1;font-size:13px}a{display:inline-block;color:#b9d7ff;margin-right:14px;padding:8px 0;min-height:44px;font-size:14px}footer{color:#aebbd1;line-height:1.7;margin-top:24px;font-size:13px}@media(prefers-reduced-motion:reduce){.sprite{animation-play-state:paused}}@media(max-width:400px){h1{font-size:27px}}
</style><main><header><div class="eyebrow">DIGIMON · ASSET PREVIEW</div><h1>搭档与进化形态</h1><p>3 条路线，12 个形态。保留原始像素比例，统一脚底位置。每个角色包含透明立绘、4 帧循环精灵图和原始 GIF。</p><div class="controls"><button id="pause" aria-pressed="false">暂停动画</button><button id="background" aria-pressed="false">切换浅色背景</button></div></header><section class="grid">'''+''.join(cards)+'''</section><footer>这里展示素材循环动画；攻击、受击与技能特效尚未制作。素材归原权利人所有，本地整理不附带官方商业授权。<br><a href="../assets/characters/manifest.json">素材清单</a><a href="../assets/vendor/digimon-ds/original/README.md">原仓库说明</a><a href="characters-contact-sheet.png">总览图</a></footer></main><script>
const pause=document.querySelector('#pause');const background=document.querySelector('#background');
if(matchMedia('(prefers-reduced-motion: reduce)').matches){document.body.classList.add('paused');pause.textContent='播放动画';pause.setAttribute('aria-pressed','true');}
pause.onclick=()=>{let p=document.body.classList.toggle('paused');document.querySelectorAll('.sprite').forEach(e=>e.style.animationPlayState=p?'paused':'running');pause.textContent=p?'播放动画':'暂停动画';pause.setAttribute('aria-pressed',String(p));};
background.onclick=()=>{let light=document.body.classList.toggle('light');background.textContent=light?'切换深色背景':'切换浅色背景';background.setAttribute('aria-pressed',String(light));};
</script></html>'''
(PREVIEW/'index.html').write_text(page)
(PREVIEW/'素材检查记录.md').write_text('# 素材检查记录\n\n固定来源版本：`'+REV+'`\n\n'+'\n'.join('- '+x for x in checks)+'\n\n共 12 个形态、48 帧；帧时长保留。以所有帧联合边界裁切后统一置入 256×256 画布，不缩放、不逐帧重新居中，避免抖动。\n')
print('\n'.join(checks))
print('Generated manifest, 12 sprite sheets, 48 frames, 12 portraits, contact sheet and HTML preview.')
