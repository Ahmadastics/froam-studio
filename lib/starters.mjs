/**
 * Starter sites for `froam new`: a real page to edit for someone who has no
 * website yet.
 *
 * Every starter is one plain index.html: semantic markup, one stylesheet in
 * its <head>, no build step and no framework. It can be opened, hosted or
 * handed to a developer as it is. Froam's two shipping tags are already in
 * place, so edits saved in the editor reach visitors with nothing to wire.
 *
 * Two rules keep a starter friendly to the editor:
 *   - Every piece of text is different from every other. Copy write-back
 *     (source-writeback.mjs) only writes an edit into index.html when the
 *     original text appears exactly once, so a repeated placeholder would
 *     stay a runtime override instead of becoming the user's own HTML.
 *   - The look lives in a handful of custom properties, and the page uses
 *     them the way the Library's theme sampler reads a site (a filled
 *     button for the brand colour, cards for the radius, a logo link and a
 *     header nav). Sections added later from the Library match the starter.
 *
 * Nothing here pretends to work when it doesn't: there is no backend, so
 * there are no forms, only mailto: and tel: links a static host can serve.
 */

export const STARTER_KINDS = [
  { id: 'business', label: 'Business or services', hint: 'a shop, a salon, a clinic, a consultant' },
  { id: 'portfolio', label: 'Portfolio', hint: 'your work, your story, a way to reach you' },
  { id: 'product', label: 'Product or startup', hint: 'features, pricing, questions, sign-up' },
  { id: 'event', label: 'Event', hint: 'the date, the schedule, speakers, tickets' },
  { id: 'blank', label: 'Blank page', hint: 'a header, a title and a footer; add sections from the Library' },
]

const THEMES = {
  business: {
    heading: 'Fraunces', headingWeights: '600;700',
    paper: '#fbfaf7', surface: '#ffffff', ink: '#1c1917', muted: '#57534e', tint: '#eef2fb', line: 'rgba(28, 25, 23, 0.12)',
    accent: '#1d4ed8', accentInk: '#ffffff', radius: '16px', buttonRadius: '999px',
  },
  portfolio: {
    heading: 'Space Grotesk', headingWeights: '500;700',
    paper: '#ffffff', surface: '#ffffff', ink: '#111111', muted: '#52525b', tint: '#f6f3ef', line: 'rgba(17, 17, 17, 0.12)',
    accent: '#c2410c', accentInk: '#ffffff', radius: '6px', buttonRadius: '6px',
  },
  product: {
    heading: 'Plus Jakarta Sans', headingWeights: '700;800',
    paper: '#ffffff', surface: '#ffffff', ink: '#0f172a', muted: '#475569', tint: '#f5f3ff', line: 'rgba(15, 23, 42, 0.1)',
    accent: '#6d28d9', accentInk: '#ffffff', radius: '18px', buttonRadius: '12px',
  },
  event: {
    heading: 'Bricolage Grotesque', headingWeights: '600;800',
    paper: '#0c0a09', surface: '#1c1917', ink: '#fafaf9', muted: '#a8a29e', tint: '#1f1712', line: 'rgba(250, 250, 249, 0.14)',
    accent: '#f97316', accentInk: '#111111', radius: '14px', buttonRadius: '999px',
  },
  blank: {
    heading: 'Inter', headingWeights: '700',
    paper: '#ffffff', surface: '#ffffff', ink: '#18181b', muted: '#52525b', tint: '#f0fdfa', line: 'rgba(24, 24, 27, 0.12)',
    accent: '#0f766e', accentInk: '#ffffff', radius: '14px', buttonRadius: '10px',
  },
}

export function isStarterKind(kind) {
  return STARTER_KINDS.some((entry) => entry.id === kind)
}

export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])

/** A folder name for a site name: "Ade's Bakery" → "ades-bakery". */
export function slugify(name) {
  const slug = String(name)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '')
  return slug || 'my-website'
}

/** A site name for a folder name: "ades-bakery" → "Ades Bakery". */
export function titleFromFolder(folder) {
  const words = String(folder).split(/[-_\s]+/).filter(Boolean)
  if (!words.length) return 'My website'
  return words.map((word) => word[0].toUpperCase() + word.slice(1)).join(' ')
}

function fontsHref(theme) {
  const families = [`family=${theme.heading.replace(/ /g, '+')}:wght@${theme.headingWeights}`]
  if (theme.heading !== 'Inter') families.push('family=Inter:wght@400;500;600;700')
  else families[0] = 'family=Inter:wght@400;500;600;700'
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`
}

/** The site's initial in its brand colour: a favicon that needs no file. */
function favicon(name, theme) {
  const initial = escapeHtml((String(name).trim()[0] ?? 'F').toUpperCase())
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='${theme.accent}'/><text x='32' y='44' font-family='Arial,sans-serif' font-size='34' font-weight='700' text-anchor='middle' fill='${theme.accentInk}'>${initial}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function stylesheet(theme) {
  return `
    :root {
      --paper: ${theme.paper};
      --surface: ${theme.surface};
      --ink: ${theme.ink};
      --muted: ${theme.muted};
      --tint: ${theme.tint};
      --line: ${theme.line};
      --accent: ${theme.accent};
      --accent-ink: ${theme.accentInk};
      --radius: ${theme.radius};
      --button-radius: ${theme.buttonRadius};
      --max: 1120px;
      --font-body: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      --font-heading: '${theme.heading}', 'Inter', system-ui, sans-serif;
    }
    *, *::before, *::after { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { margin: 0; background: var(--paper); color: var(--ink); font: 400 1rem/1.65 var(--font-body); -webkit-font-smoothing: antialiased; }
    img { display: block; max-width: 100%; }
    a { color: inherit; }
    h1, h2, h3 { margin: 0; font-family: var(--font-heading); font-weight: 700; line-height: 1.08; letter-spacing: -0.02em; }
    h1 { font-size: clamp(2.6rem, 6.4vw, 4.9rem); }
    h2 { font-size: clamp(2rem, 4vw, 3rem); }
    h3 { font-size: 1.2rem; letter-spacing: -0.01em; }
    p { margin: 0; }
    .wrap { width: min(100% - 40px, var(--max)); margin-inline: auto; }

    .site-header { position: sticky; top: 0; z-index: 20; background: color-mix(in srgb, var(--paper) 90%, transparent); backdrop-filter: blur(12px); border-bottom: 1px solid var(--line); }
    .site-header .wrap { display: flex; align-items: center; justify-content: space-between; gap: 12px 24px; min-height: 68px; flex-wrap: wrap; }
    .logo { font-family: var(--font-heading); font-size: 1.2rem; font-weight: 700; letter-spacing: -0.01em; text-decoration: none; }
    .nav { display: flex; align-items: center; gap: 24px; margin-left: auto; }
    .nav a { color: var(--muted); font-weight: 500; text-decoration: none; white-space: nowrap; }
    .nav a:hover { color: var(--ink); }

    .button { display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 0 22px; white-space: nowrap; border: 1px solid var(--accent); border-radius: var(--button-radius); background: var(--accent); color: var(--accent-ink); font-weight: 600; text-decoration: none; transition: transform 0.15s ease, box-shadow 0.15s ease; }
    .button:hover { transform: translateY(-1px); box-shadow: 0 8px 24px color-mix(in srgb, var(--accent) 30%, transparent); }
    .button.ghost { border-color: var(--line); background: transparent; color: var(--ink); }
    .button.ghost:hover { box-shadow: none; border-color: var(--ink); }
    .header-cta { min-height: 40px; padding: 0 18px; }

    section { padding: clamp(64px, 10vw, 120px) 0; }
    .tinted { background: var(--tint); }
    .eyebrow { display: inline-block; margin-bottom: 18px; color: var(--accent); font-size: 0.78rem; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; }
    .lead { max-width: 58ch; margin-top: 22px; color: var(--muted); font-size: clamp(1.05rem, 1.6vw, 1.25rem); }
    .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 34px; }
    .section-head { max-width: 680px; margin-bottom: 48px; }
    .section-head p { margin-top: 16px; color: var(--muted); }
    .centered { margin-inline: auto; text-align: center; }
    .centered .lead { margin-inline: auto; }
    .centered .actions { justify-content: center; }

    .hero { padding-top: clamp(72px, 12vw, 136px); }
    .split { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: clamp(32px, 6vw, 72px); align-items: center; }
    .photo { aspect-ratio: 4 / 3; border-radius: var(--radius); background: linear-gradient(135deg, var(--tint), color-mix(in srgb, var(--accent) 30%, var(--surface))) center / cover no-repeat; }
    .photo.wide { aspect-ratio: 16 / 9; margin-top: clamp(48px, 8vw, 80px); box-shadow: 0 30px 80px color-mix(in srgb, var(--ink) 14%, transparent); }
    .photo.portrait { aspect-ratio: 4 / 5; }

    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 20px; }
    .grid.two { grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); gap: 32px; }
    .card { padding: 30px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); }
    .card p { margin-top: 10px; color: var(--muted); }
    .card .number { display: inline-grid; place-items: center; width: 40px; height: 40px; margin-bottom: 22px; border-radius: 50%; background: var(--accent); color: var(--accent-ink); font-weight: 700; }
    .work h3 { margin-top: 18px; }
    .work p { margin-top: 4px; color: var(--muted); }

    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 24px; margin-top: 40px; }
    .stats strong { display: block; font-family: var(--font-heading); font-size: 2.4rem; line-height: 1; }
    .stats span { color: var(--muted); }

    .quote { max-width: 30ch; margin: 0; font-family: var(--font-heading); font-size: clamp(1.6rem, 3.4vw, 2.5rem); line-height: 1.25; letter-spacing: -0.01em; }
    .quote-by { margin-top: 24px; color: var(--muted); }

    .price { display: flex; flex-direction: column; gap: 6px; }
    .price strong { font-family: var(--font-heading); font-size: 3rem; line-height: 1.1; }
    .price ul { margin: 18px 0 28px; padding-left: 20px; color: var(--muted); }
    .price ul li + li { margin-top: 6px; }
    .price .button { margin-top: auto; }
    .featured { border: 2px solid var(--accent); }

    .faq { max-width: 760px; }
    .faq details { padding: 22px 0; border-top: 1px solid var(--line); }
    .faq details:last-child { border-bottom: 1px solid var(--line); }
    .faq summary { cursor: pointer; font-weight: 600; font-size: 1.1rem; }
    .faq details p { margin-top: 12px; color: var(--muted); }

    .agenda { display: grid; border-top: 1px solid var(--line); }
    .agenda div { display: grid; grid-template-columns: minmax(80px, 140px) 1fr; gap: 20px; padding: 22px 0; border-bottom: 1px solid var(--line); }
    .agenda time { color: var(--accent); font-weight: 600; font-variant-numeric: tabular-nums; }
    .agenda p { color: var(--muted); }

    .big-link { display: inline-block; margin-top: 28px; font-family: var(--font-heading); font-size: clamp(1.8rem, 5vw, 3.6rem); font-weight: 700; letter-spacing: -0.02em; text-decoration-thickness: 2px; text-underline-offset: 8px; }
    .band { padding: clamp(48px, 8vw, 88px); border-radius: var(--radius); background: var(--accent); color: var(--accent-ink); }
    .band .lead { color: inherit; opacity: 0.86; }
    .band .button { border-color: var(--accent-ink); background: var(--accent-ink); color: var(--accent); }

    .site-footer { padding: 40px 0; border-top: 1px solid var(--line); color: var(--muted); }
    .site-footer .wrap { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; }
    .site-footer nav { display: flex; gap: 20px; }
    .site-footer a { text-decoration: none; }
    .site-footer a:hover { color: var(--ink); }

    @media (max-width: 640px) {
      .site-header .wrap { padding: 12px 0; }
      .header-cta { order: 1; margin-left: auto; }
      .nav { order: 2; width: 100%; gap: 20px; margin-left: 0; overflow-x: auto; }
    }
    @media (prefers-reduced-motion: reduce) {
      html { scroll-behavior: auto; }
      .button { transition: none; }
    }`
}

const photo = (label, extra = '') => `<div class="photo${extra ? ` ${extra}` : ''}" data-froam-image-frame="true" role="img" aria-label="${escapeHtml(label)}" title="Select this and add a picture"></div>`

function header(name, links, cta) {
  const nav = links.map(([href, label]) => `<a href="${href}">${label}</a>`).join('\n          ')
  return `<header class="site-header">
      <div class="wrap">
        <a class="logo" href="#top">${name}</a>
        <nav class="nav" aria-label="Main">
          ${nav}
        </nav>${cta ? `\n        <a class="button header-cta" href="${cta[0]}">${cta[1]}</a>` : ''}
      </div>
    </header>`
}

function footer(name, year, links = []) {
  const nav = links.length
    ? `\n        <nav aria-label="Footer">\n          ${links.map(([href, label]) => `<a href="${href}">${label}</a>`).join('\n          ')}\n        </nav>`
    : ''
  return `<footer class="site-footer">
      <div class="wrap">
        <p>&copy; ${year} ${name}. All rights reserved.</p>${nav}
      </div>
    </footer>`
}

/* ── the pages ─────────────────────────────────────────────── */

function businessPage(name, year) {
  return {
    description: `${name}: what we do, who we do it for, and how to reach us.`,
    body: `${header(name, [['#services', 'Services'], ['#about', 'About'], ['#reviews', 'Reviews']], ['#contact', 'Get in touch'])}

    <main id="top">
      <section class="hero">
        <div class="wrap split">
          <div>
            <span class="eyebrow">Welcome to ${name}</span>
            <h1>Good work, done properly, close to home.</h1>
            <p class="lead">Say in one sentence what you do, who it is for, and why people choose you. Click any text on this page to change it.</p>
            <div class="actions">
              <a class="button" href="#services">See our services</a>
              <a class="button ghost" href="#contact">Contact us</a>
            </div>
          </div>
          ${photo('A photo of your shop, your team or your work')}
        </div>
      </section>

      <section id="services">
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">What we do</span>
            <h2>Services built around your day</h2>
            <p>Three things people come to you for. Keep each one short and specific.</p>
          </div>
          <div class="grid">
            <article class="card">
              <h3>Consultations</h3>
              <p>What happens in a first visit, how long it takes, and what it costs.</p>
            </article>
            <article class="card">
              <h3>Full service</h3>
              <p>Your main offer. Describe the result people get, not just the steps.</p>
            </article>
            <article class="card">
              <h3>Ongoing care</h3>
              <p>For returning customers: plans, repeat visits or maintenance.</p>
            </article>
          </div>
        </div>
      </section>

      <section id="about" class="tinted">
        <div class="wrap split">
          ${photo('A photo of the people behind the business', 'portrait')}
          <div>
            <span class="eyebrow">About us</span>
            <h2>A small team that cares about the details</h2>
            <p class="lead">How you started, what you believe in, and what a customer can always count on from you.</p>
            <div class="stats">
              <div><strong>12+</strong><span>Years in business</span></div>
              <div><strong>1,400</strong><span>Happy customers</span></div>
              <div><strong>4.9&#9733;</strong><span>Average rating</span></div>
            </div>
          </div>
        </div>
      </section>

      <section id="reviews">
        <div class="wrap">
          <span class="eyebrow">Kind words</span>
          <blockquote class="quote">&ldquo;On time, honest about the price, and the result was better than we hoped.&rdquo;</blockquote>
          <p class="quote-by">Customer name, their town</p>
        </div>
      </section>

      <section id="contact" class="tinted">
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">Visit or call</span>
            <h2>Let&rsquo;s talk about what you need</h2>
            <p>The fastest ways to reach you, and when you are open.</p>
          </div>
          <div class="grid">
            <article class="card">
              <h3>Email</h3>
              <p><a href="mailto:hello@example.com">hello@example.com</a></p>
            </article>
            <article class="card">
              <h3>Phone</h3>
              <p><a href="tel:+15550100">+1 555 0100</a></p>
            </article>
            <article class="card">
              <h3>Find us</h3>
              <p>12 Market Street, Your City. Open Monday to Saturday, 9am to 6pm.</p>
            </article>
          </div>
        </div>
      </section>
    </main>

    ${footer(name, year, [['#services', 'Our services'], ['#contact', 'Contact']])}`,
  }
}

function portfolioPage(name, year) {
  return {
    description: `${name}: selected work, a little about me, and how to get in touch.`,
    body: `${header(name, [['#work', 'Work'], ['#about', 'About'], ['#contact', 'Contact']])}

    <main id="top">
      <section class="hero">
        <div class="wrap">
          <span class="eyebrow">Hello, I&rsquo;m ${name}</span>
          <h1>I design things people enjoy using.</h1>
          <p class="lead">One line on what you do, who you do it for, and what you would like to work on next.</p>
          <div class="actions">
            <a class="button" href="#work">See my work</a>
            <a class="button ghost" href="#contact">Get in touch</a>
          </div>
        </div>
      </section>

      <section id="work">
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">Selected work</span>
            <h2>Projects I&rsquo;m proud of</h2>
          </div>
          <div class="grid two">
            <article class="work">
              ${photo('Cover image for the first project')}
              <h3>Northwind rebrand</h3>
              <p>Identity, 2026</p>
            </article>
            <article class="work">
              ${photo('Cover image for the second project')}
              <h3>Harbor mobile app</h3>
              <p>Product design, 2025</p>
            </article>
            <article class="work">
              ${photo('Cover image for the third project')}
              <h3>Field Notes magazine</h3>
              <p>Editorial, 2025</p>
            </article>
            <article class="work">
              ${photo('Cover image for the fourth project')}
              <h3>Kiln &amp; Co. website</h3>
              <p>Web design, 2024</p>
            </article>
          </div>
        </div>
      </section>

      <section id="about" class="tinted">
        <div class="wrap split">
          <div>
            <span class="eyebrow">Behind the work</span>
            <h2>A little about me</h2>
            <p class="lead">Where you are based, how you work, and the kind of people and teams you like working with.</p>
            <div class="stats">
              <div><strong>8</strong><span>Years of practice</span></div>
              <div><strong>60+</strong><span>Projects shipped</span></div>
            </div>
          </div>
          ${photo('A portrait of you', 'portrait')}
        </div>
      </section>

      <section id="contact">
        <div class="wrap">
          <span class="eyebrow">Say hello</span>
          <h2>Have a project in mind?</h2>
          <a class="big-link" href="mailto:hello@example.com">hello@example.com</a>
        </div>
      </section>
    </main>

    ${footer(name, year, [['#', 'Instagram'], ['#', 'LinkedIn']])}`,
  }
}

function productPage(name, year) {
  return {
    description: `${name}: what it does, how it works, and what it costs.`,
    body: `${header(name, [['#features', 'Features'], ['#how', 'How it works'], ['#pricing', 'Pricing'], ['#faq', 'FAQ']], ['#pricing', 'Get started'])}

    <main id="top">
      <section class="hero">
        <div class="wrap">
          <div class="centered" style="max-width: 860px;">
            <span class="eyebrow">Introducing ${name}</span>
            <h1>The simplest way to get your work done.</h1>
            <p class="lead">Explain the problem you solve and the outcome people get, in a sentence a stranger would understand.</p>
            <div class="actions">
              <a class="button" href="#pricing">Start for free</a>
              <a class="button ghost" href="#how">See how it works</a>
            </div>
          </div>
          ${photo('A screenshot of your product', 'wide')}
        </div>
      </section>

      <section id="features">
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">Why people switch</span>
            <h2>Everything you need, nothing you don&rsquo;t</h2>
          </div>
          <div class="grid">
            <article class="card">
              <h3>Set up in minutes</h3>
              <p>No manual, no training. People get value on their first visit.</p>
            </article>
            <article class="card">
              <h3>Works everywhere</h3>
              <p>On a laptop, a tablet or a phone, with the same experience.</p>
            </article>
            <article class="card">
              <h3>Private by default</h3>
              <p>Say plainly what happens to your customers&rsquo; data.</p>
            </article>
          </div>
        </div>
      </section>

      <section id="how" class="tinted">
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">Getting started</span>
            <h2>Three steps to the result</h2>
          </div>
          <div class="grid">
            <article class="card">
              <span class="number">1</span>
              <h3>Create an account</h3>
              <p>Sign up with an email address. It takes under a minute.</p>
            </article>
            <article class="card">
              <span class="number">2</span>
              <h3>Bring your work in</h3>
              <p>Import what you already have, or start from a template.</p>
            </article>
            <article class="card">
              <span class="number">3</span>
              <h3>Share the result</h3>
              <p>Send a link, invite your team, and see what happens next.</p>
            </article>
          </div>
        </div>
      </section>

      <section id="pricing">
        <div class="wrap">
          <div class="section-head centered">
            <span class="eyebrow">Plans</span>
            <h2>Simple plans that grow with you</h2>
          </div>
          <div class="grid" style="max-width: 820px; margin-inline: auto;">
            <article class="card price">
              <h3>Starter</h3>
              <strong>$0</strong>
              <p>For trying it out on your own.</p>
              <ul>
                <li>One project</li>
                <li>Community support</li>
              </ul>
              <a class="button ghost" href="mailto:hello@example.com">Start free</a>
            </article>
            <article class="card price featured">
              <h3>Pro</h3>
              <strong>$12</strong>
              <p>Per month, for people who rely on it.</p>
              <ul>
                <li>Unlimited projects</li>
                <li>Priority email support</li>
              </ul>
              <a class="button" href="mailto:hello@example.com?subject=Pro%20plan">Choose Pro</a>
            </article>
          </div>
        </div>
      </section>

      <section id="faq" class="tinted">
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">Good questions</span>
            <h2>Questions people ask</h2>
          </div>
          <div class="faq">
            <details>
              <summary>Is there a free trial?</summary>
              <p>Answer the question people ask most before they sign up.</p>
            </details>
            <details>
              <summary>Can I cancel at any time?</summary>
              <p>Be direct about contracts, refunds and what happens to their data.</p>
            </details>
            <details>
              <summary>Who is it for?</summary>
              <p>Describe the person who gets the most out of it, in their words.</p>
            </details>
          </div>
        </div>
      </section>

      <section>
        <div class="wrap">
          <div class="band centered">
            <h2>Ready when you are.</h2>
            <p class="lead">Start free today. Upgrade when it earns its place.</p>
            <div class="actions">
              <a class="button" href="#pricing">Get started for free</a>
            </div>
          </div>
        </div>
      </section>
    </main>

    ${footer(name, year, [['#features', 'Product'], ['mailto:hello@example.com', 'Support']])}`,
  }
}

function eventPage(name, year) {
  return {
    description: `${name}: the date, the schedule, the speakers and tickets.`,
    body: `${header(name, [['#schedule', 'Schedule'], ['#speakers', 'Speakers'], ['#venue', 'Venue']], ['#tickets', 'Get tickets'])}

    <main id="top">
      <section class="hero">
        <div class="wrap">
          <span class="eyebrow">Saturday 14 November ${year} &middot; Your City</span>
          <h1>${name} ${year}</h1>
          <p class="lead">One day of talks, workshops and good conversation. Say who it is for and why they should not miss it.</p>
          <div class="actions">
            <a class="button" href="#tickets">Get your ticket</a>
            <a class="button ghost" href="#schedule">See the schedule</a>
          </div>
        </div>
      </section>

      <section id="schedule">
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">The programme</span>
            <h2>How the day runs</h2>
          </div>
          <div class="agenda">
            <div><time>09:00</time><div><h3>Doors open and coffee</h3><p>Pick up your badge and meet the people next to you.</p></div></div>
            <div><time>10:00</time><div><h3>Opening talk</h3><p>The big idea of the day, from your headline speaker.</p></div></div>
            <div><time>11:30</time><div><h3>Workshops</h3><p>Small hands-on groups. Choose one when you arrive.</p></div></div>
            <div><time>13:00</time><div><h3>Lunch</h3><p>Food is included in every ticket.</p></div></div>
            <div><time>14:30</time><div><h3>Panel discussion</h3><p>Questions from the audience, answered on stage.</p></div></div>
            <div><time>17:00</time><div><h3>Closing and drinks</h3><p>Stay for the evening and keep the conversation going.</p></div></div>
          </div>
        </div>
      </section>

      <section id="speakers" class="tinted">
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">On stage</span>
            <h2>Who you will hear from</h2>
          </div>
          <div class="grid">
            <article class="work">
              ${photo('A photo of the first speaker', 'portrait')}
              <h3>First speaker</h3>
              <p>Founder, Studio One</p>
            </article>
            <article class="work">
              ${photo('A photo of the second speaker', 'portrait')}
              <h3>Second speaker</h3>
              <p>Engineer, Company Two</p>
            </article>
            <article class="work">
              ${photo('A photo of the third speaker', 'portrait')}
              <h3>Third speaker</h3>
              <p>Writer, Publication Three</p>
            </article>
          </div>
        </div>
      </section>

      <section id="venue">
        <div class="wrap split">
          <div>
            <span class="eyebrow">Getting there</span>
            <h2>Where it happens</h2>
            <p class="lead">Venue name, 1 Example Road, Your City. Say how to get there and whether the venue is step-free.</p>
          </div>
          ${photo('A photo of the venue')}
        </div>
      </section>

      <section id="tickets" class="tinted">
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">Tickets</span>
            <h2>Save your seat</h2>
          </div>
          <div class="grid" style="max-width: 820px;">
            <article class="card price">
              <h3>Early bird</h3>
              <strong>$49</strong>
              <p>Until the end of September, while they last.</p>
              <a class="button" href="mailto:tickets@example.com?subject=Early%20bird%20ticket">Book early bird</a>
            </article>
            <article class="card price">
              <h3>General admission</h3>
              <strong>$79</strong>
              <p>Talks, workshops, lunch and the evening.</p>
              <a class="button ghost" href="mailto:tickets@example.com?subject=General%20admission">Book a ticket</a>
            </article>
          </div>
        </div>
      </section>
    </main>

    ${footer(name, year, [['mailto:hello@example.com', 'Contact the organisers']])}`,
  }
}

function blankPage(name, year) {
  return {
    description: `${name}.`,
    body: `${header(name, [['#top', 'Home']])}

    <main id="top">
      <section class="hero">
        <div class="wrap">
          <h1>Welcome to ${name}</h1>
          <p class="lead">Click this text to change it. Add sections from the Library, then save.</p>
        </div>
      </section>
    </main>

    ${footer(name, year)}`,
  }
}

const PAGES = { business: businessPage, portfolio: portfolioPage, product: productPage, event: eventPage, blank: blankPage }

/**
 * index.html for a new site.
 *
 * @param {{ name: string, kind?: string, year?: number, froamDir?: string }} options
 *   froamDir is the workspace folder relative to the page, where the two
 *   shipping files live.
 */
export function renderStarter({ name, kind = 'business', year = new Date().getFullYear(), froamDir = 'froam' }) {
  const page = PAGES[kind] ?? PAGES.business
  const theme = THEMES[kind] ?? THEMES.business
  const safeName = escapeHtml(String(name).trim() || 'My website')
  const { description, body } = page(safeName, year)
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${safeName}</title>
    <meta name="description" content="${description}">
    <link rel="icon" href="${favicon(name, theme)}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="${fontsHref(theme)}">
    <style>${stylesheet(theme)}
    </style>
    <link rel="stylesheet" href="${froamDir}/froam.generated.css">
    <script src="${froamDir}/froam.runtime.js" defer></script>
  </head>
  <body>
    ${body}
  </body>
</html>
`
}

/** README.md for a new site: what the files are, how to edit, how to put it online. */
export function starterReadme({ name, folder }) {
  return `# ${name}

Made with [Froam](https://froam.vercel.app). It is a plain website: open
\`index.html\` in any browser, host it anywhere, change it in any editor.

## Edit it

From this folder:

\`\`\`bash
npx @ahmadastic/froam .
\`\`\`

Your site opens with the editor on top. Click any text to change it, add
sections from the Library, then press **Save to Repo** (Ctrl+Shift+S).
Text changes and new sections go straight into \`index.html\`. Style changes
are saved in \`froam/\`, and the two tags in \`index.html\` load them for visitors.

## Put it online

From this folder:

\`\`\`bash
npx @ahmadastic/froam publish
\`\`\`

The first time, Froam asks where: Cloudflare Pages (free, and fine for a
business), Netlify, Vercel, or just a folder you upload yourself. It
remembers the answer, so after that publishing is that one command. Save in
Froam, run it again, and the changes are live.

It uploads a clean copy made in \`.froam/publish/\`: your pages and the two
files visitors need, never Froam's edit history. The \`${folder}\` folder
itself also works on any static host as it is.

## Files

| File | What it is |
| --- | --- |
| \`index.html\` | Your page. Real HTML, yours to keep. |
| \`froam/froam.design.json\` | Your Froam edits: the source of truth for what you changed. |
| \`froam/froam.generated.css\`, \`froam/froam.runtime.js\` | Built from your edits. Visitors' browsers load these. |
| \`froam.config.json\` | Tells Froam where its files are. |
`
}
