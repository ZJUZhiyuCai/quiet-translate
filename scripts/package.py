"""Build reproducible, credential-free Chromium and Firefox distributions."""
import hashlib
import json
import pathlib
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'extension'

def build(browser):
    assert json.loads((SOURCE / 'bootstrap.json').read_text(encoding='utf-8')) == {}, 'Public bootstrap must be empty.'
    manifest = json.loads((SOURCE / 'manifest.json').read_text(encoding='utf-8'))
    version = manifest['version']
    if browser == 'firefox':
        manifest.pop('minimum_chrome_version', None)
        manifest['background'] = {'scripts': ['background.js'], 'type': 'module'}
        manifest['browser_specific_settings'] = {'gecko': {
            'id': 'quiet-translate@zjuzhiyucai.github.io',
            'strict_min_version': '142.0',
            'data_collection_permissions': {'required': ['authenticationInfo', 'websiteContent']},
        }}
    destination = ROOT / 'dist' / browser
    destination.mkdir(parents=True, exist_ok=True)
    archive_path = ROOT / 'dist' / f'quiet-translate-{version}-{browser}.zip'
    with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(SOURCE.rglob('*'), key=lambda p: p.relative_to(SOURCE).as_posix()):
            if not path.is_file():
                continue
            relative = path.relative_to(SOURCE)
            data = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode() if relative.name == 'manifest.json' else path.read_bytes()
            if path.suffix in ['.js', '.html', '.css', '.json'] or relative.name == 'LICENSE':
                data = data.replace(b'\r\n', b'\n')
            target = destination / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            info = zipfile.ZipInfo(relative.as_posix(), date_time=(2026, 1, 1, 0, 0, 0))
            info.create_system = 3  # Normalize the ZIP platform flag on Windows and Unix.
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)
    print(f'{browser}: {archive_path.name} ({archive_path.stat().st_size:,} bytes)')
    return f'{hashlib.sha256(archive_path.read_bytes()).hexdigest()}  {archive_path.name}'

if __name__ == '__main__':
    checksums = [build(browser) for browser in ['chromium', 'firefox']]
    (ROOT / 'dist' / 'SHA256SUMS.txt').write_text('\n'.join(checksums) + '\n', encoding='utf-8')
