from pathlib import Path
from PIL import Image,ImageDraw
import json
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets/vendor/digimon-ds/original';OUT=ROOT/'public/sprites';OUT.mkdir(parents=True,exist_ok=True)
names=['Gotsumon','Betamon','Monodramon','Clockmon','Seadramon','Gekomon','Devimon','SkullGreymon','Machinedramon','Terriermon','Galgomon','Rapidmon','BlackRapidmon','SaintGalgomon','BlackSaintGalgomon','BlackWarGrowlmon','ChaosDukemon','Guilmon','Growlmon','WarGrowlmon','Dukemon','Megidramon','Renamon','Kyubimon','Taomon','Sakuyamon','Kuzuhamon','Goblimon','Mushmon','Hagurumon','PicoDevimon','Bakemon','Impmon','Devidramon','Dokugumon','Sinduramon','Ogremon','Leomon','Andromon','IceDevimon','Vajramon','Beelzebumon','Lopmon','Knightmon','Phantomon','Kuramon','Diaboromon','PawnChessmonBlack','PawnChessmonWhite','KnightChessmonBlack','KnightChessmonWhite','RookChessmon','BishopChessmon','Keramon','Chrysalimon','Infermon','Armageddemon','Lilithmon','Barbamon','Belphemon','Daemon','GranDracmon','Leviamon','Sorcerymon','Matadormon','Vamdemon','VenomMyotismon','BelialVamdemon','BeelzebumonBlaster']
meta={}
for name in names:
 p=next(SOURCE.rglob(name+'.gif'));frames=[];dur=[]
 with Image.open(p) as im:
  for i in range(im.n_frames):
   im.seek(i);frames.append(im.convert('RGBA').copy());dur.append(im.info.get('duration',200))
 boxes=[f.getbbox() for f in frames];box=(min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes))
 w,h=box[2]-box[0],box[3]-box[1];factor=2 if max(w,h)<=80 else 1
 while w*factor>240 or h*factor>220:factor*=.9
 fw,fh=round(w*factor),round(h*factor);sheet=Image.new('RGBA',(256*len(frames),256))
 for i,f in enumerate(frames):
  crop=f.crop(box).resize((fw,fh),Image.Resampling.NEAREST);canvas=Image.new('RGBA',(256,256));canvas.paste(crop,((256-fw)//2,224-fh));sheet.paste(canvas,(i*256,0))
  if i==0:crop.save(OUT/(name.lower()+'.png'))
 sheet.save(OUT/(name.lower()+'-sheet.png'));meta[name.lower()]={'frames':len(frames),'duration':sum(dur),'source':p.relative_to(ROOT).as_posix()}
for index,name in enumerate(['scout','replica','corrupt','sentinel','devourer','core']):
 frames=[]
 for i in range(4):
  img=Image.new('RGBA',(256,256));d=ImageDraw.Draw(img);cy=134+(i%2)*2;cx=128;r=44+index*4
  for j in range(6):
   x=cx-r-28+j*22;y=cy-60+(j%2)*18;d.rectangle((x,y,x+8,cy+r+24),fill='#8f3c3f')
  d.polygon([(cx,cy-r-22),(cx+r+12,cy),(cx+r//2,cy+r),(cx-r//2,cy+r),(cx-r-12,cy)],fill='#c85e57',outline='#efaa77',width=4)
  d.rectangle((cx-r+16,cy-14,cx+r-16,cy+16),fill='#201f28');d.rectangle((cx-16,cy-7,cx+16,cy+9),fill='#f4dfa2');d.rectangle((cx-5,cy-5,cx+5,cy+7),fill='#fff9de');frames.append(img)
 sheet=Image.new('RGBA',(1024,256))
 for i,f in enumerate(frames):sheet.paste(f,(i*256,0))
 sheet.save(OUT/(name+'-sheet.png'));frames[0].crop(frames[0].getbbox()).save(OUT/(name+'.png'));meta[name]={'frames':4,'duration':1000,'source':'original-procedural-art'}
(ROOT/'src/game/sprites.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n');print('Game sprites prepared:',len(meta))
