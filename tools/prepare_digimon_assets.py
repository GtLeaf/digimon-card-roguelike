"""下载并整理已固定版本的数码兽素材；保留原图与逐帧时长。"""
from pathlib import Path
from urllib.request import urlopen, Request
from zipfile import ZipFile
from io import BytesIO
from PIL import Image
import json, hashlib

ROOT = Path(__file__).resolve().parents[1]
REV = '4b2273e163f023b9562cc69e4642f97a0684cb87'
REPO = 'E-M-B-E-R/digimon-world-ds-dawn-dusk-animated-sprites'
VENDOR = ROOT / 'assets/vendor/digimon-ds'
VENDOR.mkdir(parents=True, exist_ok=True)
archive = VENDOR / f'{REV}.zip'
if not archive.exists():
    req = Request(f'https://codeload.github.com/{REPO}/zip/{REV}', headers={'User-Agent':'Digimon-asset-research'})
    with urlopen(req, timeout=60) as response:
        archive.write_bytes(response.read())
source = VENDOR / 'original'
source.mkdir(exist_ok=True)
with ZipFile(archive) as z:
    for item in z.infolist():
        parts = Path(item.filename).parts[1:]
        if item.is_dir() or not parts or '..' in parts:
            continue
        dest = source.joinpath(*parts)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(z.read(item))

inventory = []
for path in sorted(source.rglob('*.gif')):
    with Image.open(path) as im:
        inventory.append({'path':path.relative_to(source).as_posix(), 'width':im.width,
                          'height':im.height,'frameCount':im.n_frames})
(VENDOR/'inventory.json').write_text(json.dumps(inventory,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'archiveBytes':archive.stat().st_size,'gifCount':len(inventory),
                  'archiveSHA256':hashlib.sha256(archive.read_bytes()).hexdigest()}))
