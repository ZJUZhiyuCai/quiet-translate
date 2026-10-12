#!/usr/bin/env python3
"""Prepare/update Quiet Translate for a desktop agent. Python 3.10+, stdlib only.

Does not edit browser profiles, policies, permissions, or credentials. The agent
must load/reload the reported directory in the user's chosen browser and verify it.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import sys
import tempfile
import urllib.error
import urllib.request
import uuid
import zipfile

REPOSITORY = 'ZJUZhiyuCai/quiet-translate'
HOMEPAGE = 'https://github.com/' + REPOSITORY
RECEIPT = '.quiet-translate-install.json'
LIMIT = 8 * 1024 * 1024
PAGES = {'chrome': 'chrome://extensions', 'chromium': 'chrome://extensions',
         'edge': 'edge://extensions', 'comet': 'chrome://extensions',
         'brave': 'brave://extensions', 'firefox': 'about:debugging#/runtime/this-firefox'}


def version_tuple(version):
    if not isinstance(version, str) or not re.fullmatch(r'\d{1,5}(?:\.\d{1,5}){1,3}', version):
        raise ValueError('Invalid extension version.')
    parts = tuple(int(part) for part in version.split('.'))
    return parts + (0,) * (4 - len(parts))


def identity(manifest):
    if (not isinstance(manifest, dict) or manifest.get('manifest_version') != 3 or manifest.get('short_name') != 'Quiet Translate'
            or manifest.get('homepage_url') != HOMEPAGE):
        raise ValueError('This directory/package is not a recognized Quiet Translate extension.')
    version_tuple(manifest.get('version'))
    return manifest


def assert_plain_path(path):
    # Reject symlinks/junctions before resolving, including any ancestor.
    path = Path(os.path.abspath(path.expanduser()))
    for parent in (path, *path.parents):
        if parent.is_symlink() or getattr(parent, 'is_junction', lambda: False)():
            raise ValueError('Use a real directory, not a symlink or junction.')
        if parent.exists() and getattr(parent.lstat(), 'st_file_attributes', 0) & 0x400:
            raise ValueError('Reparse-point directories are not supported.')
    if path == path.parent or path == Path.home().resolve():
        raise ValueError('Choose a dedicated extension directory.')
    return path


def inspect_directory(path):
    path = assert_plain_path(path)
    if not path.is_dir():
        raise ValueError('The extension directory does not exist.')
    manifest_path = assert_plain_path(path / 'manifest.json')
    manifest = identity(json.loads(manifest_path.read_text(encoding='utf-8')))
    for item in path.rglob('*'):
        assert_plain_path(item)
    return manifest


def default_directory(browser):
    if sys.platform == 'win32':
        base = Path(os.environ.get('LOCALAPPDATA', Path.home() / 'AppData/Local')) / 'QuietTranslate'
    elif sys.platform == 'darwin':
        base = Path.home() / 'Library/Application Support/QuietTranslate'
    else:
        base = Path(os.environ.get('XDG_DATA_HOME', Path.home() / '.local/share')) / 'quiet-translate'
    return base / browser


def download(url, limit=LIMIT):
    if not url.startswith('https://'):
        raise ValueError('Downloads require HTTPS.')
    request = urllib.request.Request(url, headers={'User-Agent': 'QuietTranslate-Agent-Installer', 'Accept': 'application/vnd.github+json' if 'api.github.com/' in url else 'application/octet-stream'})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            if not response.url.startswith('https://'):
                raise ValueError('Refusing a non-HTTPS redirect.')
            data = response.read(limit + 1)
    except urllib.error.HTTPError as error:
        raise ValueError(f'GitHub returned HTTP {error.code}. Retry later, or use --archive and --sha256 from the official release.') from None
    if len(data) > limit:
        raise ValueError('Download exceeds the size limit.')
    return data


def release_package(browser, version=None):
    if version:
        version = version.removeprefix('v')
    else:
        # The public latest-release redirect avoids unauthenticated GitHub API
        # rate limits. No account, token, or scraping of HTML is necessary.
        request = urllib.request.Request(HOMEPAGE + '/releases/latest', method='HEAD', headers={'User-Agent': 'QuietTranslate-Agent-Installer'})
        with urllib.request.urlopen(request, timeout=30) as response:
            prefix = HOMEPAGE + '/releases/tag/v'
            if not response.url.startswith(prefix):
                raise ValueError('No stable release found at the official repository.')
            version = response.url[len(prefix):]
    version_tuple(version)
    tag = 'v' + version
    name = f"quiet-translate-{tag.removeprefix('v')}-{'firefox' if browser == 'firefox' else 'chromium'}.zip"
    assets = {filename: f'{HOMEPAGE}/releases/download/{tag}/{filename}' for filename in (name, 'SHA256SUMS.txt')}
    lines = download(assets['SHA256SUMS.txt'], 32768).decode('utf-8').splitlines()
    hashes = [line.split()[0] for line in lines if len(line.split()) == 2 and line.split()[1] == name]
    if len(hashes) != 1 or not re.fullmatch('[0-9a-fA-F]{64}', hashes[0]):
        raise ValueError('No unique SHA-256 checksum for this package.')
    return download(assets[name]), hashes[0].lower(), assets[name], tag.removeprefix('v')


def unpack(data, expected_hash, destination, browser, expected_version=None):
    import io
    if len(data) > LIMIT or not re.fullmatch('[0-9a-fA-F]{64}', expected_hash):
        raise ValueError('A valid SHA-256 checksum and a bounded ZIP are required.')
    digest = hashlib.sha256(data).hexdigest()
    if digest != expected_hash.lower():
        raise ValueError('SHA-256 mismatch; no installed files were changed.')
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        infos = archive.infolist()
        if len(infos) > 300 or sum(info.file_size for info in infos) > LIMIT:
            raise ValueError('Archive contents exceed the size limit.')
        names = set()
        for info in infos:
            path = PurePosixPath(info.filename)
            parts = info.filename.split('/')
            if (path.is_absolute() or '\\' in info.orig_filename or not parts or any(part in ('', '.', '..') for part in parts)
                    or any(not re.fullmatch(r'[A-Za-z0-9_.-]+', part) or part.endswith(('.', ' '))
                           or re.fullmatch(r'(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?', part, re.I) for part in parts)
                    or stat.S_ISLNK(info.external_attr >> 16) or info.is_dir()
                    or info.filename.casefold() in names or info.filename.casefold() == RECEIPT.casefold()):
                raise ValueError('Unsafe or duplicate archive path.')
            names.add(info.filename.casefold())
        manifest = identity(json.loads(archive.read('manifest.json')))
        if expected_version and manifest['version'] != expected_version:
            raise ValueError('Manifest version differs from the release tag.')
        firefox = 'browser_specific_settings' in manifest
        if firefox != (browser == 'firefox'):
            raise ValueError('This archive targets a different browser family.')
        if json.loads(archive.read('bootstrap.json')) != {}:
            raise ValueError('Public packages must not include configured credentials.')
        for info in infos:
            target = destination.joinpath(*PurePosixPath(info.filename).parts)
            if not target.resolve().is_relative_to(destination.resolve()):
                raise ValueError('Archive path escapes installation directory.')
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.read(info))
    return manifest, digest


def swap_directory(stage, destination):
    # The absolute paths are checked before either move. Backup is a sibling and
    # is retained, including any private bootstrap belonging to the old install.
    destination = assert_plain_path(destination)
    stage = assert_plain_path(stage)
    if not stage.is_relative_to(destination.parent) or stage == destination:
        raise ValueError('Staging must stay inside the intended parent directory.')
    backup = destination.with_name(destination.name + '.backup-' + uuid.uuid4().hex[:12]) if destination.exists() else None
    if backup:
        assert_plain_path(backup)
        destination.rename(backup)
    try:
        stage.rename(destination)
    except OSError:
        if backup:
            backup.rename(destination)
        raise
    return backup


def prepare(destination, browser, data, digest, source, expected_version=None):
    destination = assert_plain_path(destination)
    existing = inspect_directory(destination) if destination.exists() else None
    if existing and ('browser_specific_settings' in existing) != (browser == 'firefox'):
        raise ValueError('The existing installation targets a different browser family. Use a separate directory.')
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.quiet-translate-stage-', dir=destination.parent) as temporary:
        stage = Path(temporary) / 'extension'
        stage.mkdir()
        manifest, digest = unpack(data, digest, stage, browser, expected_version)
        if existing and existing.get('key') != manifest.get('key'):
            raise ValueError('The existing manifest has a different extension identity key. Preserve that identity with a manual update.')
        if existing and version_tuple(manifest['version']) < version_tuple(existing['version']):
            raise ValueError('Refusing a downgrade; use --rollback for an installer backup.')
        public_files = [file for file in stage.rglob('*') if file.is_file()]
        unchanged = existing and all((destination / file.relative_to(stage)).is_file() and
                    (file.relative_to(stage).as_posix() == 'bootstrap.json' or (destination / file.relative_to(stage)).read_bytes() == file.read_bytes()) for file in public_files)
        if unchanged:
            return result(destination, browser, existing, 'unchanged')
        # Older local installations may use a private first-run bootstrap. Never
        # print it or replace it with the public empty file during an update.
        if existing and (destination / 'bootstrap.json').exists():
            shutil.copy2(destination / 'bootstrap.json', stage / 'bootstrap.json')
        record = {'schema': 1, 'version': manifest['version'], 'browser': browser, 'source': source,
                  'sha256': digest, 'prepared_at': datetime.now(timezone.utc).isoformat()}
        (stage / RECEIPT).write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
        backup = swap_directory(stage, destination)
    # A separate pointer permits rollback without mutating the backup itself.
    if backup:
        record['backup'] = str(backup)
        (destination / RECEIPT).write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
    return result(destination, browser, manifest, 'updated' if existing else 'prepared', backup)


def result(destination, browser, manifest, status, backup=None):
    return {'status': status, 'version': manifest['version'], 'browser': browser,
            'directory': str(destination), 'extension_page': PAGES[browser],
            'backup': str(backup) if backup else None, 'browser_verified': False,
            'next_action': 'load_temporary' if browser == 'firefox' else 'reload_existing_or_load_unpacked',
            'note': 'Firefox installation is temporary until restart.' if browser == 'firefox' else 'Keep this folder. Reload the existing extension when updating; do not remove it.'}


def rollback(destination, browser):
    inspect_directory(destination)
    record = json.loads((destination / RECEIPT).read_text(encoding='utf-8'))
    backup = assert_plain_path(Path(record.get('backup', '')))
    if backup.parent != destination.parent or not backup.name.startswith(destination.name + '.backup-'):
        raise ValueError('No valid sibling backup to restore.')
    manifest = inspect_directory(backup)
    replaced = swap_directory(backup, destination)
    return result(destination, browser, manifest, 'rolled_back', replaced)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', choices=PAGES, required=True)
    parser.add_argument('--directory', type=Path, help='Existing loaded folder for updates; default is a fixed per-browser user directory.')
    parser.add_argument('--version', help='Stable release version; default: latest.')
    parser.add_argument('--archive', type=Path, help='An already downloaded official ZIP; requires --sha256.')
    parser.add_argument('--sha256', help='Expected checksum from the official release.')
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--status', action='store_true', help='Inspect files only, without a download.')
    group.add_argument('--rollback', action='store_true', help='Restore the last installer backup at the same path.')
    parser.add_argument('--json', action='store_true', help='Machine-readable result; never includes credentials.')
    args = parser.parse_args(argv)
    try:
        directory = assert_plain_path(args.directory or default_directory(args.browser))
        if args.status:
            report = result(directory, args.browser, inspect_directory(directory), 'files_ready')
        elif args.rollback:
            report = rollback(directory, args.browser)
        else:
            if args.archive:
                if not args.sha256:
                    raise ValueError('--archive requires --sha256 from the official release.')
                if args.archive.stat().st_size > LIMIT:
                    raise ValueError('Archive exceeds the size limit.')
                data, digest, source, version = args.archive.read_bytes(), args.sha256, 'local-verified-archive', args.version.removeprefix('v') if args.version else None
            else:
                data, digest, source, version = release_package(args.browser, args.version)
            report = prepare(directory, args.browser, data, digest, source, version)
        print(json.dumps(report, ensure_ascii=True, indent=2))
        return 0
    except (ValueError, OSError, KeyError, zipfile.BadZipFile) as error:
        print(json.dumps({'status': 'error', 'error': str(error), 'browser_verified': False}, ensure_ascii=True), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
