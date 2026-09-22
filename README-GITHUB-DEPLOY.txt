PIKOL PICKLEBALL - GITHUB PAGES FRONTEND

This entire folder is the GitHub Pages/PWA frontend.

FILES
- index.html          Player / PIKOL booking site
- admin.html          Admin console
- scoring.html        Live Tournament scoring console
- styles.css          Shared styling
- cards.js            Existing shared UI logic
- config.js           API target: https://pikol.mdmsportal.uk
- manifest.json       Player PWA
- admin-manifest.json Admin PWA
- service-worker.js   Player PWA shell
- admin-service-worker.js Admin PWA shell
- icons/              Installable app icons

RECOMMENDED GITHUB PAGES
Repository example: Pikol_Client
Public player URL:
  https://codegeass25.github.io/Pikol_Client/
Admin URL:
  https://codegeass25.github.io/Pikol_Client/admin.html

The frontend talks only to:
  https://pikol.mdmsportal.uk

If you use a different backend hostname, edit config.js only.

IMPORTANT:
- Do NOT upload BACKEND-LOCAL-CLOUDFLARE to GitHub.
- Do NOT upload .env, SQLite database, backend secrets or tunnel tokens.
- If replacing an older frontend, hard refresh once (Ctrl+Shift+R) so the new service worker/config is loaded.
