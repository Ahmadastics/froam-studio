# Froam realtime relay (Cloudflare)

Instant rooms on a serverless host. Your room server keeps the durable state;
this relay makes it live: a wake-up the moment something changes, and
cursors, selections and "is typing" passed straight between people — never
stored.

## Deploy

```bash
npx wrangler login
npx wrangler deploy
npx wrangler secret put FROAM_REALTIME_SECRET   # any long random string
```

Wrangler prints the worker's URL, e.g. `https://froam-realtime.you.workers.dev`.

## Connect your room server

```js
import { createFroamRoomApi, createRealtimeRelayClient } from '@ahmadastic/froam/server'

createFroamRoomApi({
  storage,
  realtime: createRealtimeRelayClient({
    url: process.env.FROAM_REALTIME_URL,        // the worker URL
    secret: process.env.FROAM_REALTIME_SECRET,  // the same secret
  }),
  // Cursors now travel over the relay, so heartbeats rarely need storing.
  presenceWriteMs: 60_000,
})
```

Members get a signed ticket for their room from the room server; the relay
checks it and never sees a room token. Without the relay, rooms still work —
they just poll.
