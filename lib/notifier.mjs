/**
 * Froam notifications — telling people what happened while they weren't in
 * the editor.
 *
 * A contributor's request is only useful if the owner finds out about it, and
 * the owner is rarely sitting in the editor waiting. This turns room events
 * into messages where people already are: a Slack or Discord channel, any
 * webhook, or an email — each with a link that opens the editor on exactly
 * the request or message it's about.
 *
 *   import { createFroamRoomApi, createFroamNotifier } from '@ahmadastic/froam/server'
 *
 *   const notify = createFroamNotifier({
 *     siteUrl: 'https://your-site.com',
 *     webhooks: [process.env.SLACK_WEBHOOK_URL],
 *     email: { resendApiKey: process.env.RESEND_API_KEY, from: 'Froam <froam@your-site.com>', to: ['you@your-site.com'] },
 *   })
 *   createFroamRoomApi({ storage, notify })
 *
 * Links carry the room and the request, never a token: they open the editor
 * for whoever already holds the room in that browser (the owner), and are
 * useless to anyone else who sees the channel.
 */
const RESEND_API = 'https://api.resend.com/emails'

const DEFAULT_EVENTS = ['request.submitted', 'request.decided', 'request.reverted', 'chat.mention']

function formatFor(url) {
  if (/hooks\.slack\.com\//.test(url)) return 'slack'
  if (/discord(?:app)?\.com\/api\/webhooks\//.test(url)) return 'discord'
  return 'json'
}

/** Where a link should land: the room, and the request or message it's about. */
export function openLink(siteUrl, event) {
  if (!siteUrl) return null
  const url = new URL(siteUrl)
  url.searchParams.set('froam-room-id', event.room.id)
  if (event.request) url.searchParams.set('froam-open', `request:${event.request.id}`)
  else if (event.message) url.searchParams.set('froam-open', `message:${event.message.id}`)
  return url.toString()
}

const pages = (request) => {
  const scopes = Array.isArray(request.scopes) && request.scopes.length ? request.scopes : [{ routeKey: request.routeKey, viewport: request.viewport }]
  return [...new Set(scopes.map((scope) => (scope.routeKey === '/' ? 'home page' : scope.routeKey)))].join(', ')
}

/** One event → a subject line, a paragraph, and the action a person would take. */
export function describe(event) {
  const who = event.actor?.name ?? 'Someone'
  const request = event.request
  switch (event.type) {
    case 'request.submitted': {
      const count = request.changes?.length ?? 0
      return {
        subject: `${who} sent “${request.title}” for approval`,
        text: `${who}${event.actor?.title ? ` (${event.actor.title})` : ''} changed ${count} thing${count === 1 ? '' : 's'} on the ${pages(request)}${request.note ? ` — “${request.note}”` : ''}.`,
        changes: (request.changes ?? []).slice(0, 5),
        action: 'Review',
      }
    }
    case 'request.decided': {
      const approved = request.status === 'approved'
      return {
        subject: approved ? `“${request.title}” is live` : `Changes requested on “${request.title}”`,
        text: approved
          ? `${who} approved ${request.createdBy}’s change. ${request.published?.detail ?? ''}`.trim()
          : `${who} sent it back to ${request.createdBy}${request.decisionNote ? `: “${request.decisionNote}”` : '.'}`,
        link: request.published?.link ?? null,
        action: approved && request.published?.link ? 'See the pull request' : 'Open',
      }
    }
    case 'request.reverted':
      return {
        subject: `“${request.title}” was reverted`,
        text: `${who} took back ${request.createdBy}’s change. ${request.reverted?.detail ?? ''}`.trim(),
        link: request.reverted?.link ?? null,
        action: 'Open',
      }
    case 'chat.mention':
      return {
        subject: `${who} mentioned ${event.mentioned?.map((m) => m.name).join(', ') || 'you'} in Froam`,
        text: `“${event.message.body.length > 280 ? `${event.message.body.slice(0, 279)}…` : event.message.body}”`,
        action: 'Reply',
      }
    default:
      return null
  }
}

function slackPayload(summary, link) {
  const lines = summary.changes?.map((change) => `• *${change.label}*${change.before || change.after ? `: ~${change.before ?? ''}~ → ${change.after ?? ''}` : ''}`) ?? []
  return {
    text: summary.subject,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `*${summary.subject}*\n${summary.text}${lines.length ? `\n${lines.join('\n')}` : ''}` } },
      ...(link ? [{ type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: summary.action }, url: link, style: 'primary' }] }] : []),
    ],
  }
}

function discordPayload(summary, link) {
  return {
    content: summary.subject,
    embeds: [{
      title: summary.subject.slice(0, 256),
      description: `${summary.text}${summary.changes?.length ? `\n${summary.changes.map((c) => `• **${c.label}**${c.after ? ` → ${c.after}` : ''}`).join('\n')}` : ''}`.slice(0, 4000),
      ...(link ? { url: link } : {}),
      color: 0x5eead4,
    }],
  }
}

const escapeHtml = (text) => String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function emailHtml(summary, link) {
  const rows = (summary.changes ?? []).map((change) => `<li><strong>${escapeHtml(change.label)}</strong>${change.before ? ` <s style="color:#b91c1c">${escapeHtml(change.before)}</s>` : ''}${change.after ? ` → <span style="color:#15803d">${escapeHtml(change.after)}</span>` : ''}</li>`).join('')
  return `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#0f172a">
<h2 style="font-size:18px;margin:0 0 8px">${escapeHtml(summary.subject)}</h2>
<p style="margin:0 0 12px">${escapeHtml(summary.text)}</p>
${rows ? `<ul style="padding-left:18px;margin:0 0 16px">${rows}</ul>` : ''}
${link ? `<a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#0f172a;color:#fff;text-decoration:none;font-weight:600">${escapeHtml(summary.action)}</a>` : ''}
<p style="margin:20px 0 0;color:#64748b;font-size:12px">Sent by Froam</p></div>`
}

/**
 * @param {{
 *   siteUrl?: string,
 *   webhooks?: Array<string | { url: string, format?: 'slack' | 'discord' | 'json' }>,
 *   email?: { resendApiKey: string, from: string, to: string[] },
 *   events?: string[],
 *   fetchImpl?: typeof fetch,
 * }} options
 */
export function createFroamNotifier(options = {}) {
  const { siteUrl = null, email = null, events = DEFAULT_EVENTS, fetchImpl = globalThis.fetch } = options
  const hooks = (options.webhooks ?? [])
    .filter(Boolean)
    .map((hook) => (typeof hook === 'string' ? { url: hook, format: formatFor(hook) } : { format: formatFor(hook.url), ...hook }))
  const wanted = new Set(events)

  return async function notify(event) {
    if (!wanted.has(event?.type)) return []
    const summary = describe(event)
    if (!summary) return []
    const open = openLink(siteUrl, event)
    const link = summary.link ?? open
    const sends = hooks.map(async (hook) => {
      const body = hook.format === 'slack'
        ? slackPayload(summary, link)
        : hook.format === 'discord'
          ? discordPayload(summary, link)
          : { type: event.type, subject: summary.subject, text: summary.text, link, open, roomId: event.room.id, requestId: event.request?.id ?? null, messageId: event.message?.id ?? null }
      const response = await fetchImpl(hook.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!response.ok) throw new Error(`webhook answered ${response.status}`)
      return { to: hook.format, ok: true }
    })
    if (email?.resendApiKey && email.from && email.to?.length) {
      sends.push((async () => {
        const response = await fetchImpl(RESEND_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${email.resendApiKey}` },
          body: JSON.stringify({ from: email.from, to: email.to, subject: summary.subject, html: emailHtml(summary, link), text: `${summary.text}${link ? `\n\n${summary.action}: ${link}` : ''}` }),
        })
        if (!response.ok) throw new Error(`email answered ${response.status}`)
        return { to: 'email', ok: true }
      })())
    }
    const settled = await Promise.allSettled(sends)
    const failed = settled.filter((result) => result.status === 'rejected')
    if (failed.length === settled.length && failed.length) throw failed[0].reason
    return settled.map((result) => (result.status === 'fulfilled' ? result.value : { ok: false, error: String(result.reason?.message ?? result.reason) }))
  }
}
