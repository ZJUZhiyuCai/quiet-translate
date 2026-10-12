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
        assert archive.namelist() == sorted(expected), 'Archive order must be independent of the host OS'
        assert all(info.create_system == 3 for info in archive.infolist()), 'Archive platform metadata must be normalized'
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
installer = ROOT / 'dist' / 'quiet-translate-install.py'
assert installer.read_bytes() == (ROOT / 'scripts' / 'install.py').read_bytes().replace(b'\r\n', b'\n')
checksums = dict(line.split()[::-1] for line in (ROOT / 'dist' / 'SHA256SUMS.txt').read_text().splitlines())
assert checksums[installer.name] == hashlib.sha256(installer.read_bytes()).hexdigest()
print('Agent installer matches its audited source and published checksum.')
