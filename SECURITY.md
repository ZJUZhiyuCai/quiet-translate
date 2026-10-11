# Security

Security fixes target the latest release. Please update before reporting a problem.

Use [GitHub private vulnerability reporting](https://github.com/ZJUZhiyuCai/quiet-translate/security/advisories/new) for credential exposure, executable model output, cross-origin access, or similar issues. Do not put real API keys or private page content into an issue, screenshot, log, or pull request. Revoke an exposed key at its provider immediately.

Include the extension/browser version, minimal reproduction, expected versus actual behavior, and a dummy-key example. The maintainer will assess reports as availability allows; this project does not promise a paid support SLA.

## Boundaries

Only bundled code runs. The extension does not execute model-generated HTML or remote scripts. Text is rendered through `textContent`; overlay markup is static. Credential-bearing settings live in the extension origin and are accessible only to trusted extension pages/background code. Content scripts receive a credential-free projection. Settings writes, cache management, and draft reads validate the sender. Network requests refuse redirects and omit cookies.

A malicious configured provider can see submitted text and the credential supplied for that provider. A compromised OS account or another sufficiently privileged extension is outside this isolation boundary. See [PRIVACY.md](PRIVACY.md) for exactly what is stored and transmitted.
