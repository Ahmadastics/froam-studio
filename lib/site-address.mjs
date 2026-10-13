/**
 * Where a site lives, read from the project itself — so Go Live can check
 * "is it live yet?" without asking.
 *
 * Projects usually already say it somewhere, for their own reasons: a CNAME
 * file for GitHub Pages, `homepage` in package.json, `site` in Astro's config,
 * `url` in Jekyll's or Docusaurus's, the canonical link or og:url a page
 * gives search engines and link previews, the Sitemap line in robots.txt.
 * Each is read as text (never run), and an address that's plainly not the
 * public site (localhost, an example domain) is passed over.
 */
import fs from 'node:fs'
import path from 'node:path'

const read = (file) => { try { return fs.readFileSync(file, 'utf8') } catch { return null } }

/** A public https/http origin+path, or null for localhost, examples and placeholders. */
export function publicAddress(value) {
  let url
  try { url = new URL(String(value ?? '').trim()) } catch { return null }
  if (!/^https?:$/.test(url.protocol)) return null
  const host = url.hostname.toLowerCase()
  if (!host.includes('.') || /^(localhost|127\.|0\.0\.0\.0|\[?::1)/.test(host) || /(^|\.)example\.(com|org|net)$/.test(host) || /your-?(site|domain)|placeholder/.test(host)) return null
  return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, '')}`
}

const inFirst = (dirs, names) => {
  for (const dir of dirs) {
    for (const name of names) {
      const text = read(path.join(dir, name))
      if (text !== null) return { text, file: path.join(dir, name) }
    }
  }
  return null
}

/**
 * @param {{ top: string, siteDir?: string }} where  the repo root, and the site's own folder (they can differ in a monorepo)
 * @returns {{ url: string, source: string } | null}
 */
export function findSiteAddress({ top, siteDir = top }) {
  const roots = [...new Set([siteDir, top].filter(Boolean))]
  const publicDirs = roots.flatMap((dir) => [dir, path.join(dir, 'public'), path.join(dir, 'static'), path.join(dir, 'docs')])
  const say = (url, source) => (url ? { url, source } : null)

  // GitHub Pages: the custom domain, verbatim.
  const cname = inFirst(publicDirs, ['CNAME'])
  const domain = cname?.text.split(/\r?\n/)[0]?.trim()
  if (domain && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    const found = say(publicAddress(`https://${domain}`), 'the CNAME file')
    if (found) return found
  }

  for (const dir of roots) {
    const pkg = read(path.join(dir, 'package.json'))
    try {
      const found = say(publicAddress(JSON.parse(pkg ?? 'null')?.homepage), 'homepage in package.json')
      if (found) return found
    } catch { /* not JSON */ }
  }

  // Framework configs that name the site, read as text.
  const configs = [
    [['astro.config.mjs', 'astro.config.ts', 'astro.config.js'], /\bsite\s*:\s*['"`]([^'"`]+)['"`]/, "Astro's config"],
    [['docusaurus.config.js', 'docusaurus.config.ts'], /\burl\s*:\s*['"`]([^'"`]+)['"`]/, "Docusaurus's config"],
    [['_config.yml'], /^url\s*:\s*['"]?([^'"\s#]+)/m, "Jekyll's config"],
    [['hugo.toml', 'config.toml'], /^baseURL\s*=\s*['"]([^'"]+)['"]/m, "Hugo's config"],
    [['next-sitemap.config.js', 'next-sitemap.config.cjs'], /\bsiteUrl\s*:\s*['"`]([^'"`]+)['"`]/, 'next-sitemap'],
  ]
  for (const [names, pattern, source] of configs) {
    const hit = inFirst(roots, names)
    const found = hit && say(publicAddress(pattern.exec(hit.text)?.[1]), source)
    if (found) return found
  }

  // What the page tells search engines and link previews.
  const page = inFirst(roots.flatMap((dir) => [dir, path.join(dir, 'public'), path.join(dir, 'src')]), ['index.html'])
  if (page) {
    const canonical = /<link\b[^>]*\brel=["']canonical["'][^>]*>/i.exec(page.text)?.[0]
    const ogUrl = /<meta\b[^>]*\bproperty=["']og:url["'][^>]*>/i.exec(page.text)?.[0]
    for (const [tag, attr, source] of [[canonical, 'href', 'the page\'s canonical link'], [ogUrl, 'content', 'the page\'s og:url']]) {
      const value = tag && new RegExp(`\\b${attr}=["']([^"']+)["']`, 'i').exec(tag)?.[1]
      const found = value && say(publicAddress(new URL(value, 'https://x.invalid').href.includes('x.invalid') ? null : value), source)
      if (found) {
        // A canonical link names a page; the site is its origin.
        const { protocol, host } = new URL(found.url)
        return { url: `${protocol}//${host}`, source }
      }
    }
  }

  const robots = inFirst(publicDirs, ['robots.txt'])
  const sitemap = robots && /^sitemap\s*:\s*(\S+)/im.exec(robots.text)?.[1]
  if (sitemap) {
    try {
      const { protocol, host } = new URL(sitemap)
      const found = say(publicAddress(`${protocol}//${host}`), 'robots.txt')
      if (found) return found
    } catch { /* not a URL */ }
  }

  // Cloudflare Pages: the project's name is its address.
  const wrangler = inFirst(roots, ['wrangler.toml'])
  if (wrangler && /pages_build_output_dir/.test(wrangler.text)) {
    const name = /^name\s*=\s*["']([a-z0-9-]+)["']/m.exec(wrangler.text)?.[1]
    if (name) return { url: `https://${name}.pages.dev`, source: 'wrangler.toml' }
  }
  return null
}
