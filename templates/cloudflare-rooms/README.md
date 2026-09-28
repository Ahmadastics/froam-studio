# Froam rooms on Cloudflare

The whole room server — invites, presence, chat, change requests, approval
and revert — on Cloudflare's free tier, realtime included.

Each room is a Durable Object: its state lives in the object's own storage,
requests for a room run inside it one at a time (no write races), and it holds
the room's WebSockets, so changes and presence reach everyone at once. Rooms
delete themselves when their time is up.

## Deploy

```bash
npx wrangler login
npx wrangler deploy
npx wrangler secret put FROAM_REALTIME_SECRET   # any long random string
```

## Point your site at it

The editor calls `/api/froam/rooms/*` on your own origin. Rewrite that to the
Worker — on Vercel, in `vercel.json`:

```json
{
  "rewrites": [
    { "source": "/api/froam/rooms", "destination": "https://froam-rooms.<you>.workers.dev/api/froam/rooms" },
    { "source": "/api/froam/rooms/:path(.*)", "destination": "https://froam-rooms.<you>.workers.dev/api/froam/rooms/:path" }
  ]
}
```

The realtime socket connects to the Worker directly, with a ticket the room
signs; set `FROAM_PUBLIC_URL` if the Worker sits behind a custom domain.

## Publishing and notifications

Edit `worker.js`:

```js
import { createGitHubPublisher, createFroamNotifier } from '@ahmadastic/froam/server'

const { worker, FroamRoom } = createFroamRoomsWorker((env) => ({
  roomTtlMs: null, // keep rooms
  ...createGitHubPublisher({ token: env.GITHUB_TOKEN, repo: 'you/your-site', dir: 'src/froam', siteUrl: 'https://your-site.com' }),
  notify: createFroamNotifier({ siteUrl: 'https://your-site.com', webhooks: [env.SLACK_WEBHOOK_URL] }),
}))
```

Check a deployment with:

```bash
FROAM_ROOMS_URL=https://froam-rooms.<you>.workers.dev node scripts/test-cloudflare-rooms.mjs
```
