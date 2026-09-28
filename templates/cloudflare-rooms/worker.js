/**
 * Froam rooms on Cloudflare — deploy this, point /api/froam/rooms at it.
 *
 *   npx wrangler deploy
 *   npx wrangler secret put FROAM_REALTIME_SECRET   # any long random string
 *
 * Approving publishes wherever you say: pass createGitHubPublisher(...) hooks
 * here for pull requests, and createFroamNotifier(...) for Slack/Discord/email.
 */
import { createFroamRoomsWorker } from './rooms.js'

const { worker, FroamRoom } = createFroamRoomsWorker(() => ({
  // Rooms end a week after they open.
  roomTtlMs: 7 * 24 * 60 * 60 * 1000,
}))

export default worker
export { FroamRoom }
