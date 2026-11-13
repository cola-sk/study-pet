"""Compress device frames through TinyPNG. Key stays in a Git-ignored local file.

python3 apps/pet-device/tools/compress_tinypng.py
Uses TINYPNG_API_KEY (or TINIFY_API_KEY), or .env.tinypng.local in the repo root.
Completed outputs are cached by hash and skipped on subsequent runs.
"""
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import urllib.error
import urllib.parse
import urllib.request
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
DEVICE = ROOT / 'apps/pet-device'
FRAMES = DEVICE / 'preview/frames'
MANIFEST = DEVICE / 'assets/tinypng-manifest.json'
BACKUP = DEVICE / 'backups/tinypng-originals.local'
NAMES = [f'{action}_{n:02}.png' for action in ('idle','eat','happy','sleep','hungry','thirsty','drink','sleepy','lonely','pet') for n in range(1,5)]
def digest(data): return hashlib.sha256(data).hexdigest()
def key():
    value = os.environ.get('TINYPNG_API_KEY') or os.environ.get('TINIFY_API_KEY')
    if not value:
        path = ROOT / '.env.tinypng.local'
        if path.exists():
            for line in path.read_text().splitlines():
                name, sep, content = line.strip().partition('=')
                if sep and name in ('TINYPNG_API_KEY','TINIFY_API_KEY'):
                    value = content.strip().strip('"\'')
    if not value: raise RuntimeError('TinyPNG API key is missing; fill .env.tinypng.local locally.')
    return value

def save_manifest(records):
    temporary = MANIFEST.with_suffix('.tmp')
    temporary.write_text(json.dumps({'provider':'TinyPNG / Tinify API','frames':records}, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(MANIFEST)

def main():
    credential = key()
    auth = 'Basic ' + base64.b64encode(('api:' + credential).encode()).decode()
    records = json.loads(MANIFEST.read_text()).get('frames',{}) if MANIFEST.exists() else {}
    BACKUP.mkdir(parents=True,exist_ok=True); BACKUP.chmod(0o700)
    total_before = total_after = calls = 0
    for index, name in enumerate(NAMES,1):
        path = FRAMES / name; original = path.read_bytes(); hashed = digest(original)
        record = records.get(name)
        if record and hashed == record['output_sha256']:
            total_before += record['input_bytes']; total_after += len(original)
            print(f'[{index}/40] {name}: cached', flush=True); continue
        if record and hashed == record['input_sha256']:
            cached = BACKUP / (record['output_sha256'] + '.optimized.png')
            if cached.exists() and digest(cached.read_bytes()) == record['output_sha256']:
                path.write_bytes(cached.read_bytes())
                total_before += record['input_bytes']; total_after += record['output_bytes']
                print(f'[{index}/40] {name}: restored cached output', flush=True); continue
        backup = BACKUP / (hashed + '.png')
        if not backup.exists():
            backup.write_bytes(original); backup.chmod(0o600)
        req = urllib.request.Request('https://api.tinify.com/shrink',data=original,headers={'Authorization':auth,'Content-Type':'image/png'},method='POST')
        try:
            with urllib.request.urlopen(req,timeout=60) as response:
                info=json.load(response)
            calls += 1
            output_url=info['output']['url']; parsed=urllib.parse.urlparse(output_url)
            if parsed.scheme!='https' or parsed.hostname!='api.tinify.com' or not parsed.path.startswith('/output/'):
                raise RuntimeError('TinyPNG returned an unexpected output URL')
            with urllib.request.urlopen(urllib.request.Request(output_url,headers={'Authorization':auth}),timeout=60) as response:
                optimized=response.read()
        except urllib.error.HTTPError as error:
            raise RuntimeError(f'TinyPNG API HTTP {error.code}; credentials and response body were omitted. Re-run after resolving account/quota/network issues.') from None
        except urllib.error.URLError:
            raise RuntimeError('TinyPNG connection failed; successful frames are cached. Re-run to continue.') from None
        with Image.open(io.BytesIO(original)) as before, Image.open(io.BytesIO(optimized)) as after:
            if before.size != after.size or after.format != 'PNG': raise RuntimeError(f'Unexpected TinyPNG dimensions/format for {name}')
            after.load()
        # Do not replace a frame if the service happens to return a larger file.
        result = optimized if len(optimized)<len(original) else original
        cached = BACKUP / (digest(result) + '.optimized.png')
        cached.write_bytes(result); cached.chmod(0o600)
        records[name]={'input_sha256':hashed,'output_sha256':digest(result),'input_bytes':len(original),'output_bytes':len(result),'width':140,'height':132}
        # Save the record first: a process interruption before replacement is recoverable from backup.
        save_manifest(records)
        temporary=path.with_suffix('.tmp'); temporary.write_bytes(result); temporary.replace(path)
        total_before+=len(original); total_after+=len(result)
        print(f'[{index}/40] {name}: {len(original)} -> {len(result)} bytes',flush=True)
    print(f'TinyPNG API calls this run: {calls}; total {total_before} -> {total_after} bytes ({(1-total_after/total_before)*100:.1f}% smaller)',flush=True)
if __name__=='__main__':
    try: main()
    except Exception as error:
        print(f'Compression stopped: {error}',file=sys.stderr)
        sys.exit(1)
