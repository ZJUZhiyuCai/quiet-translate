"""Verify archive contents and reproducibility; never read private local profiles."""
import hashlib
import json
from pathlib import Path
import zipfile
from package import build, ROOT, SOURCE

version = json.loads((SOURCE / 'manifest.json').read_text(encoding='utf-8'))['version']
assert version == json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
expected = {p.relative_to(SOURCE).as_posix() for p in SOURCE.rglob('*') if p.is_file()}
for browser in ['chromium', 'firefox']:
    target = ROOT / 'dist' / f'quiet-translate-{version}-{browser}.zip'
    before = hashlib.sha256(target.read_bytes()).hexdigest()
    build(browser)
    assert hashlib.sha256(target.read_bytes()).hexdigest() == before, 'Non-reproducible package'
    with zipfile.ZipFile(target) as archive:
        assert set(archive.namelist()) == expected, 'Unexpected package file'
        assert json.loads(archive.read('bootstrap.json')) == {}, 'Nonempty public bootstrap'
        manifest = json.loads(archive.read('manifest.json'))
        assert not manifest.get('host_permissions'), 'No provider hosts may be hardcoded'
        assert manifest['version'] == version
        if browser == 'firefox':
            assert 'service_worker' not in manifest['background']
            assert manifest['background']['scripts'] == ['background.js']
        else:
            assert manifest['background']['service_worker'] == 'background.js'
print('Both archives have exact public contents and reproducible SHA-256 hashes.')
