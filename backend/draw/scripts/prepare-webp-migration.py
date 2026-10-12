"""Back up saved draw images and prepare original-resolution Canvas WebP q90.
Requires Python Playwright and an installed Chromium/Chrome executable.
No production writes. Usage: python prepare-webp-migration.py /absolute/backup --chromium /path/to/chrome
"""
import argparse, asyncio, base64, concurrent.futures, json, pathlib, subprocess
from playwright.async_api import async_playwright

parser = argparse.ArgumentParser()
parser.add_argument('directory', type=pathlib.Path)
parser.add_argument('--chromium', required=True)
args = parser.parse_args()
if not args.directory.is_absolute():
    parser.error('directory must be absolute')
out = args.directory
out.mkdir(parents=True, exist_ok=True, mode=0o700)
for folder in ['originals', 'compressed']:
    (out / folder).mkdir(exist_ok=True, mode=0o700)
objects = json.loads(subprocess.check_output([
    'aws', 's3api', 'list-objects-v2', '--profile', 'codex-prod',
    '--region', 'ap-northeast-1', '--bucket', 'draw-uploads-20260124-58904f87',
    '--prefix', 'draw/', '--query', 'Contents[].{Key:Key,Size:Size}',
])) or []
(out / 'inventory.json').write_text(json.dumps(objects, indent=2))

def download(row):
    target = out / 'originals' / row['Key'].split('/')[-1]
    if not target.exists():
        subprocess.check_call([
            'aws', 's3api', 'get-object', '--profile', 'codex-prod',
            '--region', 'ap-northeast-1', '--bucket', 'draw-uploads-20260124-58904f87',
            '--key', row['Key'], str(target),
        ], stdout=subprocess.DEVNULL)
    if target.stat().st_size != row['Size']:
        raise ValueError('Backup size mismatch: ' + row['Key'])

# Download each object to a distinct file; no AWS writes.
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    list(pool.map(download, objects))

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=args.chromium)
        page = await browser.new_page()
        manifest = []
        for row in objects:
            name = row['Key'].split('/')[-1]
            raw = (out / 'originals' / name).read_bytes()
            if name.endswith('.webp'):
                result = {'changed': False, 'bytes': len(raw), 'width': None, 'height': None}
                body = raw
            elif name.endswith('.png'):
                result = await page.evaluate('''async src => {
                    const image = new Image(); image.src = src; await image.decode();
                    const canvas = document.createElement('canvas');
                    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
                    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
                    const original = await (await fetch(src)).blob();
                    const blob = await new Promise(r => canvas.toBlob(r, 'image/webp', 0.9));
                    const changed = !!blob && blob.type === 'image/webp' && blob.size < original.size;
                    let data = null;
                    if (changed) data = await new Promise(r => {
                        const reader = new FileReader(); reader.onload = () => r(reader.result);
                        reader.readAsDataURL(blob);
                    });
                    return {changed, bytes: changed ? blob.size : original.size,
                        width: canvas.width, height: canvas.height, data};
                }''', 'data:image/png;base64,' + base64.b64encode(raw).decode())
                encoded = result.pop('data')
                body = base64.b64decode(encoded.split(',')[1]) if result['changed'] else raw
            else:
                raise ValueError('Unsupported image key: ' + row['Key'])
            output_name = name.rsplit('.', 1)[0] + '.webp' if result['changed'] else name
            (out / 'compressed' / output_name).write_bytes(body)
            manifest.append({**row, **result, 'outputName': output_name})
        (out / 'manifest.json').write_text(json.dumps(manifest, indent=2))
        print(json.dumps({'images': len(manifest), 'changed': sum(r['changed'] for r in manifest),
                          'oldBytes': sum(r['Size'] for r in manifest),
                          'newBytes': sum(r['bytes'] for r in manifest)}))
        await browser.close()

asyncio.run(main())
