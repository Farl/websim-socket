# Cloudflare Workers Builds

Connect `Farl/websim-socket` using the existing Cloudflare Workers and Pages GitHub App.
Use production branch `main`, root `/`, Node 22, build command `npm run build`,
and deploy command `npx wrangler deploy`. The Worker name must match `wrangler.jsonc`.

Cloudflare owns the deployment credential. Never put it in source code or GitHub Actions.
For the game, set the Cloudflare build variable `PARTYKIT_HOST` to the Worker hostname.

GitHub Actions deploys only the existing Pages frontend. Set repository variable
`PARTYSERVER_HOST` after verifying the backend, then dispatch the Pages workflow.
Keep the existing frontend URL and room names.
