# Install Quiet Translate with your agent

Give your desktop agent the repository link and the browser you use. The agent prepares the official package, loads it in your browser, helps connect your own API, and verifies a translation. **No store account, project account, or subscription is required.** Your model provider may charge for API use.

复制给你的 Agent（也可以把 Comet 改成 Chrome、Edge 或 Brave）：

```text
帮我在 Comet 安装并配置 Quiet Translate：
https://github.com/ZJUZhiyuCai/quiet-translate
先读取仓库的 INSTALL.md，按照 Agent 流程操作。若已安装，沿用原目录更新，保留设置。
自动完成下载、校验、安装准备和浏览器中可操作的步骤；需要我确认浏览器权限或填写自己的 API 时再提示。
最后验证扩展版本、连接测试和一次实际翻译。不要把文件解压成功当成安装完成。
```

```text
Install and configure Quiet Translate in my browser:
https://github.com/ZJUZhiyuCai/quiet-translate
Read INSTALL.md first. Update an existing installation in its original folder and preserve its settings.
Handle download, verification, preparation, and browser steps you can operate. Ask me only for required browser confirmations or my own API details.
Verify the loaded version, connection test, and one translation before reporting success.
```

## Agent workflow

These instructions apply when the user asks you to install or update this extension. They do not grant permission to read unrelated files or other apps' credentials. Use your own tools and approval rules; never change browser security policies to make installation work.

### 1. Identify the target and any existing installation

- Use the browser and profile requested by the user. If unspecified, use a clearly identified active browser; resolve ambiguity before modifying a different profile.
- Inspect its Extensions page for **Quiet Translate / 轻译**. Record the loaded version, extension ID, and unpacked directory if present. A folder on disk alone does not establish that the browser loaded it.
- For an update, pass that exact existing directory to `--directory`. **Do not uninstall the old extension, move its folder, or create a second copy.** The same browser profile, extension identity, and path retain the extension's saved settings.
- For a new installation, use the installer's fixed user directory. Do not load from Downloads, a temporary folder, or a disposable test profile.

### 2. Get a verified installer and package

Use the latest stable release of **ZJUZhiyuCai/quiet-translate**:

- Resolve the public latest-release redirect below to its exact version tag. No GitHub login/API token is required. The installer uses this redirect to avoid unauthenticated API rate limits.
- Human-readable release: <https://github.com/ZJUZhiyuCai/quiet-translate/releases/latest>
- Download `quiet-translate-install.py` and `SHA256SUMS.txt` from **that same release**, verify the installer's SHA-256 against its exact filename, then inspect the script before running it. Checksums detect corruption; they are not an independent publisher signature.
- The installer requires an existing **Python 3.10+** interpreter, has no third-party dependencies, and works without cloning the repository or running npm. It downloads and verifies the matching browser ZIP itself.
- Alternatively, use a trusted checkout of the release tag and run `scripts/install.py`. If Python is unavailable, the agent may download/verify/extract the official ZIP using its existing tools and follow the same browser steps. Do not install a runtime without the user's authorization.

Examples, after obtaining and checking the installer:

```sh
python quiet-translate-install.py --browser comet --json
python quiet-translate-install.py --browser chrome --json
python quiet-translate-install.py --browser edge --json
python quiet-translate-install.py --browser brave --json
```

Update an existing installation (replace the example with its **observed** real path):

```sh
python quiet-translate-install.py --browser comet --directory "PATH/TO/EXISTING/EXTENSION" --json
```

The script emits JSON containing `status`, `version`, `directory`, `extension_page`, `backup`, and `next_action`. `browser_verified` is always `false`: this script only prepares files. `prepared`, `updated`, `unchanged`, or `files_ready` are **not** claims that the browser has installed or enabled anything. An error returns exit code 1 with JSON on stderr. Default output is also JSON; `--json` makes the caller's intent explicit.

The default folders are `%LOCALAPPDATA%/QuietTranslate/<browser>` on Windows, `~/Library/Application Support/QuietTranslate/<browser>` on macOS, and `${XDG_DATA_HOME:-~/.local/share}/quiet-translate/<browser>` on Linux. macOS browser interaction has not yet been independently verified.

Offline preparation and status:

```sh
python quiet-translate-install.py --browser edge --archive "quiet-translate-VERSION-chromium.zip" --sha256 "EXPECTED_SHA256" --json
python quiet-translate-install.py --browser edge --status --json
```

### 3. Load or reload in the actual browser

Use desktop/browser UI tools if available. Open the returned `extension_page` in the **requested browser**, not whichever browser happens to handle a link.

- **Existing Chromium installation:** click **Reload** on its existing card. Check that its ID and path stay the same and its version changes to the prepared version.
- **New Chromium installation:** enable Developer mode, click **Load unpacked**, and select the returned directory containing `manifest.json`. Check that the extension is enabled and has no load error.
- If your agent cannot operate browser-internal pages or a native file chooser, give the user the exact directory and the remaining action. Report `needs_browser_action`, not success. A generic shell command cannot guarantee silent installation in every browser.
- Do not modify browser profile databases, install force-install policies, bypass signature checks, or launch a new debugging profile as a substitute for the user's actual browser.
- Keep the installation folder. Browser restarts retain an unpacked Chromium installation, but developer-mode reminders may still appear. Updates are initiated by an agent; there is no background self-updater.

**Firefox:** use `--browser firefox` for the Firefox package, then `about:debugging` → This Firefox → Load Temporary Add-on → `manifest.json`. This is unsigned and lasts **only until Firefox restarts**. Agent distribution does not remove that limitation. Explain it before offering Firefox as a persistent installation. Safari and mobile are not supported.

### 4. Connect the user's API

The first installation opens Preferences. Choose the provider preset and enter the user's API key. Models load automatically after typing pauses if host access is already granted; otherwise click **Allow & get models**. Open the arrow in the model field, type to search, and choose a model, or enter its ID manually. Then click **Save & test connection**. Keyless mode is available only for a compatible localhost service the user already runs; click **Get models** to list its installed models.

- Presets supply endpoint and compatibility defaults; the exact model comes from the user's provider. Never invent a working model or provide the maintainer's API key.
- Listing models does not save the key or select a model automatically. If discovery is unsupported, unavailable or denied, preserve the existing model and use manual entry. A listed model may still require account access or different compatibility parameters; verify with the connection test. Do not obtain extra cloud administration credentials merely to enumerate models.
- Prefer entering the key in the extension's password field. Do not put it in shell arguments, URLs, screenshots, issue reports, or public files.
- Read another local app's configuration only when the user specifically authorizes that source and provider. Do not scan the machine for credentials.
- Agents can prepare a **key-free** JSON profile following [the example](examples/preferences.json), then import it in Preferences → Backup & migration. Importing fills a draft; review and save to apply it. Plaintext profiles containing keys are refused.
- If the user has no API details yet, finish the browser installation and report `installed_needs_api`. Do not claim the connection is working.

### 5. Verify completion

1. Confirm the extension is **enabled in the intended browser/profile**, with the version returned by the installer.
2. Confirm Save & test connection succeeds. Saved settings alone are not a successful connection.
3. Open the text workspace and translate a short, non-sensitive English passage. Confirm output arrives and the original stays intact.
4. Refresh an ordinary article page and verify selection translation if the agent can operate it. Internal browser pages and extension stores cannot host ordinary content scripts.
5. Report the actual browser/version, loaded directory, connection result, and any remaining user action. Distinguish file preparation, browser installation, and API verification. Do not reveal the key.

## Updates and recovery

Run the installer again using the **original loaded directory**, reload the same extension card, and refresh existing web pages. It verifies hashes before replacement, retains an older local `bootstrap.json` if present, and keeps a sibling backup. Installation settings and caches live in the browser; the script does not read or rewrite them.

If a replacement fails, the installer attempts to put the previous directory back. For a completed update that needs reverting:

```sh
python quiet-translate-install.py --browser comet --directory "PATH/TO/EXISTING/EXTENSION" --rollback --json
```

Reload that same extension card after rollback. Code rollback does not roll back browser settings. Backups can contain private bootstrap configuration from early local versions; keep them local and do not attach them to issues. Backups are retained until the user chooses to remove them.

## Move to another folder or browser

1. **Older than 1.3.0?** Update the existing installation in place first so Backup & migration becomes available.
2. In the old installation, save pending edits and open Preferences → Backup & migration.
3. Export preferences without a key, or enable **Include API key** and set a passphrase of at least 10 characters to export an encrypted backup. The passphrase is not stored or recoverable.
4. Install into the new location/browser. Read the profile or encrypted backup, review the endpoint and model, and **Save & test connection**. A key-free import requires entering the user's key again and clears any old key when saved.
5. Verify a translation before removing the old installation. Only preferences and an optionally encrypted key move; caches, drafts, site permissions, and browser shortcuts do not.

All export/import and encryption happen locally inside the extension. There is no migration server or transfer link.
