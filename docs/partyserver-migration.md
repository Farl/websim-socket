# PartyServer preparation (2026-10-20)

This is a local migration candidate, not a production migration. Keep the original checkout and both original archives until production behavior and data needs are verified.

## Entries and local commands

- `src/server/index.ts` and `websim-socket/server` remain the original PartyKit implementation.
- `src/partyserver/index.ts` exports `WebsimServer` from `websim-socket/partyserver`.
- `src/partyserver/worker.ts` routes `/parties/main/:room` using the `Main` binding.
- `wrangler.jsonc` targets a NEW Worker named `websim-socket-migration`. Its SQLite migration is for a new namespace only. Do not apply this configuration over an existing Cloudflare Worker without first auditing its name, bindings, classes and migration history.
- This version is `0.1.2-partyserver.0` for local packaging only; nothing has been published.

Use Node >=22 for Wrangler. From this directory:

```sh
npm ci
npm run build
npm test
npm run check:worker
npm run dev:partyserver
```

`check:worker` performs `wrangler deploy --dry-run`. The local server listens on port 1999. Existing `npm run dev` remains the legacy example workflow and may read its original `.env.local`; use `dev:partyserver` for migration testing. Cloudflare Workers Builds owns automatic backend deployment; see [build settings](cloudflare-builds.md). GitHub Actions deploys only the demo frontend.

## State and data

The checked-out old server keeps peers, presence and roomState only in JavaScript memory. The new server deliberately preserves that behavior and disables hibernation. These values are not durable across process eviction, restart or deployment. The local old `.partykit` SQLite database contains zero KV entries; it is included with WAL/SHM in the original archive. This does not establish anything about remote room storage.

There is no export or import endpoint in this candidate or in the checked-out legacy server. Do not add a public data endpoint. No remote room storage has been exported, imported, verified or declared lost. The official deployment/export deadline has passed; do not assume a new legacy export endpoint can still be deployed.

Room identity is the page pathname trimmed of leading/trailing slashes, or `default`. Known page-derived candidates are `websim-socket` for the demo and `beat_party_3d___multiplayer` for the game; these are not an inventory of all historical rooms. Check original URLs, logs and any separately held backups before deciding recovery scope. A protocol init snapshot, if later authorized and captured from a live room, would only represent its exposed in-memory state, not an authoritative Durable Object export.

## Production rollout

Use the existing Cloudflare account and GitHub integration requested by the user. Do not introduce paid services, new accounts, or broader permissions without approval. Repository access changes require review at the GitHub App configuration screen.

Deploy to a new Worker first, record the returned host, test two real game clients and all room paths, verify required state/recovery decisions, then update the existing frontend host setting and deploy the frontend. Keep old deployments. A host switch disconnects old rooms; live in-memory sessions do not automatically transfer. Record the previous host for frontend rollback, but the old PartyKit host is not a viable long-term fallback after shutdown.

If durable remote data is required and no usable backup/export exists, obtain user approval before contacting PartyKit support. Ask about remaining retention and recovery; do not promise an extension or recovery. No third party was contacted.

Official references: https://docs.partykit.io/guides/migrate-to-partyserver/ and https://blog.partykit.io/posts/hosted-platform-shutdown

## Production smoke test

Run `PARTYSERVER_TEST_ORIGIN=https://<worker-host> npm test` against the deployed backend.
For a Worker that also serves SPA assets, add `PARTYSERVER_TEST_ASSETS=true` to skip
the non-route HTTP assertion, since the assets fallback may legitimately serve HTML.
Each run uses unique rooms and closes its clients; it never connects to existing game rooms.
This protocol test supplements browser checks of all seven sites.
