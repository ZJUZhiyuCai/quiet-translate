"""Exercise the real filesystem updater with isolated, credential-free fixtures."""
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

spec = importlib.util.spec_from_file_location('installer', Path(__file__).resolve().parents[1] / 'scripts/install.py')
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


def package(version='1.3.0', extra=None, bootstrap=None, firefox=False):
    stream = io.BytesIO()
    manifest = {'manifest_version': 3, 'short_name': 'Quiet Translate', 'homepage_url': installer.HOMEPAGE, 'version': version}
    if firefox:
        manifest['browser_specific_settings'] = {'gecko': {'id': 'test'}}
    files = {'manifest.json': json.dumps(manifest), 'bootstrap.json': json.dumps(bootstrap or {}), 'background.js': '/* public fixture */'}
    files.update(extra or {})
    with zipfile.ZipFile(stream, 'w') as archive:
        for name, data in files.items():
            info = zipfile.ZipInfo('fixture')
            info.filename = name
            archive.writestr(info, data)
    data = stream.getvalue()
    return data, hashlib.sha256(data).hexdigest()


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='quiet-translate-test-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.directory = self.root / 'space 中文' / 'comet'

    def install(self, version='1.3.0', **kwargs):
        data, digest = package(version, **kwargs)
        return installer.prepare(self.directory, 'comet', data, digest, 'test fixture', version)

    def test_first_install_and_repeat_do_not_claim_browser_success(self):
        report = self.install()
        self.assertEqual(report['status'], 'prepared')
        self.assertFalse(report['browser_verified'])
        self.assertEqual(installer.inspect_directory(self.directory)['version'], '1.3.0')
        self.assertEqual(self.install()['status'], 'unchanged')
        self.assertEqual(list(self.directory.parent.glob('*.backup-*')), [])

    def test_update_retains_private_bootstrap_stable_path_and_rollback(self):
        self.install('1.2.0')
        private = b'{"apiKey":"dummy-private-bootstrap"}\n'
        (self.directory / 'bootstrap.json').write_bytes(private)
        (self.directory / 'old-code.js').write_text('old code')
        report = self.install()
        self.assertEqual(report['status'], 'updated')
        self.assertEqual((self.directory / 'bootstrap.json').read_bytes(), private)
        self.assertTrue((Path(report['backup']) / 'old-code.js').is_file())
        self.assertFalse((self.directory / 'old-code.js').exists())
        self.assertNotIn('dummy-private-bootstrap', json.dumps(report))
        restored = installer.rollback(self.directory, 'comet')
        self.assertEqual(restored['version'], '1.2.0')
        self.assertEqual((self.directory / 'bootstrap.json').read_bytes(), private)

    def test_failed_second_rename_restores_original(self):
        self.install('1.2.0')
        original = Path.rename
        def rename(path, target):
            if path.name == 'extension':
                raise PermissionError('Simulated file lock')
            return original(path, target)
        with patch.object(Path, 'rename', rename), self.assertRaises(PermissionError):
            self.install()
        self.assertEqual(installer.inspect_directory(self.directory)['version'], '1.2.0')

    def test_bad_checksum_does_not_modify_existing_files(self):
        self.install('1.2.0')
        before = (self.directory / 'manifest.json').read_bytes()
        with self.assertRaisesRegex(ValueError, 'SHA-256'):
            installer.prepare(self.directory, 'comet', package()[0], '0' * 64, 'fixture')
        self.assertEqual((self.directory / 'manifest.json').read_bytes(), before)

    def test_unrelated_directory_is_untouched(self):
        self.directory.mkdir(parents=True)
        note = self.directory / 'personal.txt'
        note.write_text('keep')
        with self.assertRaises((ValueError, FileNotFoundError)):
            self.install()
        self.assertEqual(note.read_text(), 'keep')

    def test_unsafe_archives_and_private_public_bootstrap_rejected(self):
        for name in ['../escape', '/absolute', 'shared/../../escape', 'C:/escape', 'con.txt', 'shared\\escape', 'icons//empty', 'MANIFEST.JSON']:
            with self.subTest(name=name), self.assertRaises(ValueError):
                self.install(extra={name: 'bad'})
            self.assertFalse(self.directory.exists())
        with self.assertRaisesRegex(ValueError, 'credentials'):
            self.install(bootstrap={'apiKey': 'must-not-ship'})

    def test_wrong_browser_version_and_downgrade_rejected(self):
        with self.assertRaisesRegex(ValueError, 'browser'):
            self.install(firefox=True)
        data, digest = package()
        with self.assertRaisesRegex(ValueError, 'version'):
            installer.prepare(self.directory, 'comet', data, digest, 'fixture', '9.0.0')
        self.install()
        with self.assertRaisesRegex(ValueError, 'downgrade'):
            self.install('1.2.0')
        manifest_path = self.directory / 'manifest.json'
        manifest = json.loads(manifest_path.read_text())
        manifest['key'] = 'custom-extension-identity'
        manifest_path.write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError, 'identity key'):
            self.install()

    def test_rollback_cannot_move_an_unrelated_directory(self):
        self.install()
        record = self.directory / installer.RECEIPT
        record.write_text(json.dumps({'backup': str(self.root)}))
        with self.assertRaisesRegex(ValueError, 'sibling'):
            installer.rollback(self.directory, 'comet')
        self.assertTrue(self.directory.is_dir())

    def test_symlink_destination_is_rejected(self):
        real = self.root / 'real'
        real.mkdir()
        link = self.root / 'link'
        try:
            link.symlink_to(real, target_is_directory=True)
        except OSError:
            self.skipTest('This host does not allow creating symlinks.')
        with self.assertRaisesRegex(ValueError, 'symlink'):
            installer.assert_plain_path(link / 'extension')


if __name__ == '__main__':
    unittest.main()
