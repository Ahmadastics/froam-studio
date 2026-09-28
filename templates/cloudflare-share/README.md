# Froam share (Cloudflare)

The service behind **Make it reachable from anywhere** and `froam dev --share`:
a site running on someone's own computer, opened from any other.

`froam dev` connects out to this Worker over one WebSocket (so it works behind
any router, with no port forwarding). A share link sets a cookie for that share
and opens the site at its root; every request after that travels down the
socket to `froam dev`, which answers from the local site and sends the answer
back. One Durable Object per share holds the owner's socket; the first
computer to connect with a key claims the share, and only that key can
reconnect. Requests that come through are marked remote, and the bridge only
lets them view, join the room, talk and suggest — never write files.

## Deploy your own

```bash
npx wrangler login
npx wrangler deploy
```

Then point `froam dev` at it:

```bash
FROAM_SHARE_URL=https://froam-share.<you>.workers.dev npx @ahmadastic/froam dev --serve . --share
```
