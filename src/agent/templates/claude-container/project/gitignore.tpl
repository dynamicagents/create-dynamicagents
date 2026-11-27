node_modules/
dist/
.wrangler/
*.tsbuildinfo
*.log

# Secrets. `.env.example` is the one file here that is committed.
.env
.env.*
!.env.example

# Written by `npm run types` from wrangler.jsonc.
worker-configuration.d.ts

.DS_Store

# The sandbox daemon bundle, built before every deploy: scripts/build-daemon.mjs
/container/
