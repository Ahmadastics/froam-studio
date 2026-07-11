export type FroamComponentCategory =
  | 'Navigation'
  | 'Hero'
  | 'Features'
  | 'Content'
  | 'Social proof'
  | 'Pricing'
  | 'CTA'
  | 'FAQ'
  | 'Footer'
  | 'Contact'
  | 'Team'
  | 'Blog'

export type FroamComponentDefinition = {
  id: string
  category: FroamComponentCategory
  title: string
  summary: string
  anatomy: string[]
  keywords: string[]
}

const define = (
  category: FroamComponentCategory,
  id: string,
  title: string,
  summary: string,
  anatomy: string[],
  keywords: string[] = [],
): FroamComponentDefinition => ({
  id,
  category,
  title,
  summary,
  anatomy,
  keywords: [category.toLowerCase(), title.toLowerCase(), ...keywords],
})

export const FROAM_COMPONENTS: FroamComponentDefinition[] = [
  define('Navigation', 'navigation-01', 'Compact navbar', 'Brand, links, and one action.', ['brand', 'links', 'action'], ['header']),
  define('Navigation', 'navigation-02', 'Centered navbar', 'Balanced navigation with a centered brand.', ['links', 'brand', 'actions'], ['header']),
  define('Navigation', 'navigation-03', 'Product navbar', 'Product switcher, navigation, and account actions.', ['brand', 'menu', 'account'], ['header', 'app']),
  define('Hero', 'hero-01', 'Centered launch hero', 'Focused headline, supporting copy, and two actions.', ['eyebrow', 'headline', 'copy', 'actions'], ['landing']),
  define('Hero', 'hero-02', 'Split media hero', 'Copy and a large media frame in two columns.', ['copy', 'actions', 'media'], ['landing', 'image']),
  define('Hero', 'hero-03', 'Editorial hero', 'Large display headline with an offset proof note.', ['headline', 'copy', 'proof'], ['landing', 'bold']),
  define('Features', 'features-01', 'Feature card grid', 'Three scannable value cards.', ['heading', 'card', 'card', 'card'], ['services']),
  define('Features', 'features-02', 'Bento features', 'A varied grid for product capabilities.', ['heading', 'wide card', 'card', 'card'], ['services', 'bento']),
  define('Features', 'features-03', 'Numbered feature list', 'A calm, editorial list of benefits.', ['heading', '01 row', '02 row', '03 row'], ['services', 'steps']),
  define('Content', 'content-01', 'Image and copy', 'A media frame paired with long-form copy.', ['media', 'heading', 'copy', 'action'], ['about']),
  define('Content', 'content-02', 'Story statement', 'A large statement with supporting details.', ['statement', 'detail', 'detail'], ['about', 'editorial']),
  define('Content', 'content-03', 'Process timeline', 'Four clear steps for explaining a workflow.', ['01', '02', '03', '04'], ['process', 'steps']),
  define('Social proof', 'social-proof-01', 'Logo cloud', 'A simple strip of customer or partner names.', ['heading', 'logo', 'logo', 'logo'], ['trust', 'logos']),
  define('Social proof', 'social-proof-02', 'Testimonial spotlight', 'One strong customer quote and attribution.', ['quote', 'avatar', 'person'], ['trust', 'quote']),
  define('Social proof', 'social-proof-03', 'Metrics and proof', 'Three metrics paired with a trust statement.', ['metric', 'metric', 'metric', 'copy'], ['trust', 'stats']),
  define('Pricing', 'pricing-01', 'Three-tier pricing', 'Side-by-side plans with a featured option.', ['plan', 'featured plan', 'plan'], ['plans']),
  define('Pricing', 'pricing-02', 'Simple price card', 'One decisive offer with included features.', ['offer', 'price', 'features', 'action'], ['plans']),
  define('Pricing', 'pricing-03', 'Plan comparison', 'A compact comparison-table layout.', ['plans', 'feature row', 'feature row'], ['plans', 'table']),
  define('CTA', 'cta-01', 'Action band', 'A concise conversion section with two actions.', ['heading', 'copy', 'actions'], ['conversion']),
  define('CTA', 'cta-02', 'Split call to action', 'Copy, action, and a supporting proof panel.', ['copy', 'action', 'proof'], ['conversion']),
  define('CTA', 'cta-03', 'Newsletter signup', 'Email capture with a compact promise.', ['heading', 'email', 'submit'], ['conversion', 'form']),
  define('FAQ', 'faq-01', 'Accordion FAQ', 'A single-column list of common questions.', ['question', 'question', 'question'], ['support']),
  define('FAQ', 'faq-02', 'FAQ columns', 'Questions split into two easy-to-scan columns.', ['heading', 'column', 'column'], ['support']),
  define('FAQ', 'faq-03', 'FAQ with contact', 'Questions plus a clear escalation path.', ['questions', 'help card'], ['support', 'contact']),
  define('Footer', 'footer-01', 'Compact footer', 'Brand, utility links, and copyright.', ['brand', 'links', 'legal'], ['navigation']),
  define('Footer', 'footer-02', 'Mega footer', 'Multiple link groups with a closing legal row.', ['brand', 'link group', 'link group', 'legal'], ['navigation']),
  define('Footer', 'footer-03', 'Newsletter footer', 'Subscription form above the utility links.', ['signup', 'links', 'legal'], ['navigation', 'form']),
  define('Contact', 'contact-01', 'Contact form', 'A practical two-column contact section.', ['details', 'form'], ['form']),
  define('Contact', 'contact-02', 'Contact cards', 'Three direct routes for getting help.', ['card', 'card', 'card'], ['support']),
  define('Contact', 'contact-03', 'Location panel', 'Address, hours, and a large map placeholder.', ['details', 'map'], ['map']),
  define('Team', 'team-01', 'Team grid', 'A clean grid of people and roles.', ['person', 'person', 'person'], ['about']),
  define('Team', 'team-02', 'Founder spotlight', 'A large portrait area with founder copy.', ['portrait', 'story'], ['about']),
  define('Team', 'team-03', 'Hiring team block', 'Team proof plus an open-role action.', ['people', 'copy', 'action'], ['about', 'careers']),
  define('Blog', 'blog-01', 'Article grid', 'Three editorial cards for recent writing.', ['article', 'article', 'article'], ['content']),
  define('Blog', 'blog-02', 'Featured article', 'One lead story with two supporting stories.', ['featured', 'story', 'story'], ['content']),
  define('Blog', 'blog-03', 'Resource list', 'A compact list for guides, reports, or updates.', ['resource', 'resource', 'resource'], ['content']),
]

export const FROAM_CATEGORIES = ['All', ...Array.from(new Set(FROAM_COMPONENTS.map((item) => item.category)))] as const

const editable = 'contenteditable="true"'

function variantFromId(id: string) {
  const value = Number(id.split('-').at(-1))
  return Number.isFinite(value) ? value : 1
}

function makeShell(definition: FroamComponentDefinition) {
  const tag = definition.category === 'Navigation' ? 'header' : definition.category === 'Footer' ? 'footer' : 'section'
  const element = document.createElement(tag)
  const variant = variantFromId(definition.id)
  element.dataset.froamInjected = 'true'
  element.dataset.froamBlock = 'true'
  element.dataset.froamComponentId = definition.id
  element.dataset.froamComponentCategory = definition.category
  Object.assign(element.style, {
    boxSizing: 'border-box',
    width: '100%',
    minHeight: definition.category === 'Navigation' ? '76px' : definition.category === 'Footer' ? '240px' : '360px',
    padding: definition.category === 'Navigation' ? '20px 28px' : 'clamp(28px, 6vw, 72px)',
    border: '1px solid rgba(15, 23, 42, 0.12)',
    borderRadius: variant === 3 ? '8px' : '24px',
    background: variant === 2 ? '#f0fdf4' : variant === 3 ? '#0f172a' : '#ffffff',
    color: variant === 3 ? '#f8fafc' : '#0f172a',
    overflow: 'hidden',
    position: 'relative',
  })
  return element
}

function action(label: string, dark = true) {
  return `<button type="button" ${editable} style="min-height:44px;padding:0 16px;border:1px solid ${dark ? '#0f172a' : 'rgba(15,23,42,.16)'};border-radius:8px;background:${dark ? '#0f172a' : '#fff'};color:${dark ? '#fff' : '#0f172a'};font-weight:800;">${label}</button>`
}

function media(label = 'Media') {
  return `<div data-froam-media-slot="true" style="min-height:240px;display:grid;place-items:center;border:1px solid rgba(15,23,42,.14);border-radius:8px;background:repeating-linear-gradient(135deg,#f1f5f9,#f1f5f9 10px,#e2e8f0 10px,#e2e8f0 20px);color:#64748b;font-size:.78rem;font-weight:800;text-transform:uppercase;">${label}</div>`
}

function card(index: number, dark = false) {
  return `<article style="min-height:160px;padding:22px;border:1px solid ${dark ? 'rgba(255,255,255,.15)' : 'rgba(15,23,42,.1)'};border-radius:8px;background:${dark ? 'rgba(255,255,255,.06)' : '#fff'};"><span style="font-size:.72rem;font-weight:900;color:#10b981;">0${index}</span><h3 ${editable} style="margin:32px 0 8px;font-size:1.2rem;">Editable feature</h3><p ${editable} style="margin:0;opacity:.68;line-height:1.6;">Short supporting copy for this component.</p></article>`
}

function sectionHeading(label: string, centered = false) {
  return `<div style="max-width:720px;${centered ? 'margin:0 auto;text-align:center;' : ''}"><span ${editable} style="font-size:.72rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#10b981;">${label}</span><h2 ${editable} style="margin:12px 0 0;font-size:clamp(2rem,5vw,4rem);line-height:1;">Build the message around what matters.</h2></div>`
}

export function createFroamLibraryComponent(componentId: string): HTMLElement | null {
  const definition = FROAM_COMPONENTS.find((item) => item.id === componentId)
  if (!definition) return null

  const root = makeShell(definition)
  const variant = variantFromId(definition.id)
  const dark = variant === 3

  switch (definition.category) {
    case 'Navigation':
      root.style.display = 'flex'
      root.style.alignItems = 'center'
      root.style.justifyContent = 'space-between'
      root.style.gap = '20px'
      root.innerHTML = variant === 2
        ? `<nav style="display:flex;align-items:center;gap:18px;"><a ${editable}>Work</a><a ${editable}>Services</a></nav><strong ${editable} style="font-size:1.1rem;">Your brand</strong><div style="display:flex;gap:8px;">${action('Contact', false)}${action('Start')}</div>`
        : variant === 3
          ? `<strong ${editable}>Your product</strong><nav style="display:flex;gap:18px;opacity:.76;"><a ${editable}>Overview</a><a ${editable}>Features</a><a ${editable}>Pricing</a></nav>${action('Sign in', false)}`
          : `<strong ${editable} style="font-size:1.1rem;">Your brand</strong><nav style="display:flex;gap:18px;"><a ${editable}>About</a><a ${editable}>Work</a><a ${editable}>Contact</a></nav>${action('Get started')}`
      break

    case 'Hero':
      if (variant === 2) {
        root.style.display = 'grid'
        root.style.gridTemplateColumns = 'repeat(auto-fit, minmax(260px, 1fr))'
        root.style.alignItems = 'center'
        root.style.gap = '36px'
        root.innerHTML = `<div><span ${editable} style="font-weight:900;color:#10b981;">New release</span><h1 ${editable} style="margin:16px 0;font-size:clamp(3rem,7vw,6rem);line-height:.92;">Make the first screen count.</h1><p ${editable} style="max-width:580px;line-height:1.7;color:#475569;">Clear positioning, useful proof, and an obvious next step.</p><div style="display:flex;gap:10px;margin-top:24px;">${action('Start now')}${action('Learn more', false)}</div></div>${media('Hero media')}`
      } else if (variant === 3) {
        root.style.display = 'grid'
        root.style.alignContent = 'center'
        root.style.gap = '28px'
        root.innerHTML = `<h1 ${editable} style="max-width:1100px;margin:0;font-size:clamp(4rem,10vw,8rem);line-height:.84;">A bold idea, stated without clutter.</h1><div style="display:grid;grid-template-columns:1fr minmax(220px,.45fr);gap:24px;align-items:end;"><p ${editable} style="max-width:620px;margin:0;opacity:.72;line-height:1.7;">Use this space for the sharpest version of the product story.</p><aside style="padding:18px;border-left:2px solid #10b981;"><strong ${editable}>Trusted proof</strong><p ${editable} style="margin:6px 0 0;opacity:.68;">Add one useful credibility signal.</p></aside></div>`
      } else {
        root.style.display = 'grid'
        root.style.placeItems = 'center'
        root.style.textAlign = 'center'
        root.innerHTML = `<div style="max-width:900px;"><span ${editable} style="font-weight:900;color:#10b981;">A focused promise</span><h1 ${editable} style="margin:18px 0;font-size:clamp(3.5rem,8vw,7rem);line-height:.9;">Design the page people remember.</h1><p ${editable} style="max-width:660px;margin:0 auto;color:#475569;line-height:1.7;">Shape a useful message, then turn the wireframe into a real editable page.</p><div style="display:flex;justify-content:center;gap:10px;margin-top:28px;">${action('Primary action')}${action('Secondary', false)}</div></div>`
      }
      break

    case 'Features':
      root.style.display = 'grid'
      root.style.gap = '32px'
      root.innerHTML = variant === 2
        ? `${sectionHeading('Capabilities')}<div style="display:grid;grid-template-columns:1.4fr .8fr;grid-template-rows:repeat(2,minmax(150px,1fr));gap:12px;">${card(1)}${card(2)}${card(3)}</div>`
        : variant === 3
          ? `${sectionHeading('Why it works')}<div style="display:grid;gap:0;">${[1, 2, 3].map((item) => `<article style="display:grid;grid-template-columns:64px 1fr auto;gap:18px;align-items:center;padding:20px 0;border-top:1px solid rgba(255,255,255,.14);"><strong>0${item}</strong><h3 ${editable}>A clear product benefit</h3><span>+</span></article>`).join('')}</div>`
          : `${sectionHeading('Everything you need', true)}<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;">${card(1)}${card(2)}${card(3)}</div>`
      break

    case 'Content':
      root.style.display = 'grid'
      root.style.gap = '32px'
      root.innerHTML = variant === 1
        ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:36px;align-items:center;">${media('Story image')}<div>${sectionHeading('Our story')}<p ${editable} style="margin:22px 0;color:#475569;line-height:1.8;">Use a longer passage here to explain the idea with enough room to breathe.</p>${action('Read the story', false)}</div></div>`
        : variant === 2
          ? `<blockquote ${editable} style="max-width:1050px;margin:0;font-size:clamp(3rem,7vw,6rem);line-height:.95;">We make complicated work feel direct, calm, and useful.</blockquote><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:24px;max-width:760px;margin-left:auto;"><p ${editable} style="opacity:.72;line-height:1.7;">Supporting detail for the first part of the story.</p><p ${editable} style="opacity:.72;line-height:1.7;">Supporting detail for the second part of the story.</p></div>`
          : `${sectionHeading('How it works')}<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">${[1, 2, 3, 4].map((item) => card(item, dark)).join('')}</div>`
      break

    case 'Social proof':
      root.style.display = 'grid'
      root.style.alignContent = 'center'
      root.style.gap = '28px'
      root.innerHTML = variant === 1
        ? `${sectionHeading('Trusted by practical teams', true)}<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;">${['North', 'Aster', 'Union', 'Form', 'Motive'].map((name) => `<div ${editable} style="padding:24px 10px;border:1px solid rgba(15,23,42,.1);text-align:center;font-weight:900;">${name}</div>`).join('')}</div>`
        : variant === 2
          ? `<blockquote ${editable} style="max-width:950px;margin:0 auto;text-align:center;font-size:clamp(2.4rem,5vw,4.6rem);line-height:1.05;">"The page finally says what the product actually does."</blockquote><div style="display:grid;place-items:center;gap:6px;"><div style="width:46px;height:46px;border-radius:50%;background:#10b981;"></div><strong ${editable}>Customer name</strong><span ${editable} style="opacity:.62;">Role, Company</span></div>`
          : `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">${['24k', '98%', '4.9'].map((metric) => `<article style="padding:28px;border:1px solid rgba(255,255,255,.14);"><strong ${editable} style="font-size:3rem;">${metric}</strong><p ${editable} style="opacity:.64;">Useful proof point</p></article>`).join('')}</div><p ${editable} style="max-width:720px;font-size:1.3rem;line-height:1.6;">Pair the numbers with one sentence that explains why they matter.</p>`
      break

    case 'Pricing':
      root.style.display = 'grid'
      root.style.gap = '28px'
      root.innerHTML = variant === 1
        ? `${sectionHeading('Simple pricing', true)}<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">${['Starter', 'Pro', 'Scale'].map((name, index) => `<article style="padding:24px;border:${index === 1 ? '2px solid #10b981' : '1px solid rgba(15,23,42,.12)'};border-radius:8px;background:#fff;color:#0f172a;"><span ${editable}>${name}</span><strong ${editable} style="display:block;margin:18px 0;font-size:2.8rem;">$${index === 0 ? '0' : index === 1 ? '29' : '79'}</strong><p ${editable} style="color:#64748b;line-height:1.7;">Feature one<br/>Feature two<br/>Feature three</p>${action('Choose plan', index === 1)}</article>`).join('')}</div>`
        : variant === 2
          ? `<article style="max-width:620px;margin:auto;padding:36px;border:1px solid rgba(15,23,42,.12);border-radius:8px;background:#fff;color:#0f172a;"><span ${editable} style="font-weight:900;color:#10b981;">One clear offer</span><h2 ${editable} style="margin:12px 0;font-size:3.5rem;">$49 <small style="font-size:1rem;color:#64748b;">/ month</small></h2><p ${editable} style="line-height:1.8;color:#475569;">Everything needed to move from plan to editable page.</p>${action('Start building')}</article>`
          : `${sectionHeading('Compare plans')}<div style="display:grid;gap:0;border:1px solid rgba(255,255,255,.14);">${['Core features', 'Collaboration', 'Exports', 'Support'].map((label) => `<div style="display:grid;grid-template-columns:1.5fr repeat(3,1fr);padding:16px;border-bottom:1px solid rgba(255,255,255,.12);"><strong ${editable}>${label}</strong><span>Yes</span><span>Yes</span><span>Yes</span></div>`).join('')}</div>`
      break

    case 'CTA':
      root.style.display = 'grid'
      root.style.alignItems = 'center'
      root.style.gap = '24px'
      root.innerHTML = variant === 1
        ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;">${sectionHeading('Ready to make it real?')}<div style="display:flex;gap:10px;">${action('Start now')}${action('Talk to us', false)}</div></div>`
        : variant === 2
          ? `<div style="display:grid;grid-template-columns:1.2fr .8fr;gap:28px;align-items:center;"><div>${sectionHeading('Turn the plan into a page')}<div style="margin-top:22px;">${action('Build this page')}</div></div><aside style="padding:28px;border:1px solid rgba(15,23,42,.12);background:#fff;color:#0f172a;"><strong ${editable}>A useful proof point</strong><p ${editable} style="color:#64748b;line-height:1.7;">Use this panel for reassurance near the decision.</p></aside></div>`
          : `<div style="max-width:780px;margin:auto;text-align:center;">${sectionHeading('Useful ideas, occasionally', true)}<form style="display:flex;gap:8px;margin-top:26px;"><input aria-label="Email address" placeholder="you@example.com" style="flex:1;min-height:48px;padding:0 14px;border:1px solid rgba(255,255,255,.18);border-radius:8px;background:rgba(255,255,255,.08);color:inherit;"/>${action('Subscribe')}</form></div>`
      break

    case 'FAQ':
      root.style.display = 'grid'
      root.style.gap = '28px'
      {
        const questions = ['What happens after I build the wireframe?', 'Can I edit every component?', 'Are mobile layouts separate?']
        const list = questions.map((question) => `<details style="padding:18px 0;border-top:1px solid ${dark ? 'rgba(255,255,255,.14)' : 'rgba(15,23,42,.12)'};"><summary ${editable} style="font-weight:800;cursor:pointer;">${question}</summary><p ${editable} style="opacity:.66;line-height:1.7;">Add a short, direct answer here.</p></details>`).join('')
        root.innerHTML = variant === 1
          ? `${sectionHeading('Frequently asked questions')}<div>${list}</div>`
          : variant === 2
            ? `${sectionHeading('Questions, answered', true)}<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:0 28px;">${list}${list}</div>`
            : `<div style="display:grid;grid-template-columns:1.3fr .7fr;gap:32px;"><div>${sectionHeading('Need to know')} ${list}</div><aside style="padding:26px;border:1px solid rgba(255,255,255,.14);align-self:start;"><strong ${editable}>Still unsure?</strong><p ${editable} style="opacity:.68;line-height:1.7;">Give people a direct path to a human.</p>${action('Contact us')}</aside></div>`
      }
      break

    case 'Footer':
      root.style.display = 'grid'
      root.style.alignContent = 'space-between'
      root.style.gap = '40px'
      root.innerHTML = variant === 1
        ? `<div style="display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;"><strong ${editable} style="font-size:1.4rem;">Your brand</strong><nav style="display:flex;gap:18px;"><a ${editable}>About</a><a ${editable}>Work</a><a ${editable}>Contact</a></nav></div><small ${editable} style="opacity:.56;">2026 Your brand. All rights reserved.</small>`
        : variant === 2
          ? `<div style="display:grid;grid-template-columns:1.5fr repeat(3,1fr);gap:28px;"><strong ${editable} style="font-size:1.4rem;">Your brand</strong>${['Product', 'Company', 'Resources'].map((group) => `<div><strong ${editable}>${group}</strong><p ${editable} style="opacity:.62;line-height:2;">Overview<br/>Page link<br/>Page link</p></div>`).join('')}</div><small ${editable} style="opacity:.56;">Privacy  Terms  Copyright</small>`
          : `<div style="display:grid;grid-template-columns:1fr 1fr;gap:30px;align-items:end;"><div>${sectionHeading('Stay in the loop')}</div><form style="display:flex;gap:8px;"><input placeholder="Email address" style="flex:1;min-height:46px;padding:0 14px;border:1px solid rgba(255,255,255,.18);background:transparent;color:inherit;"/>${action('Join')}</form></div><small ${editable} style="opacity:.56;">Your brand  Privacy  Terms</small>`
      break

    case 'Contact':
      root.style.display = 'grid'
      root.style.gap = '28px'
      root.innerHTML = variant === 1
        ? `<div style="display:grid;grid-template-columns:.8fr 1.2fr;gap:34px;"><div>${sectionHeading('Let us talk')}<p ${editable} style="opacity:.68;line-height:1.8;">hello@example.com<br/>+1 555 0100</p></div><form style="display:grid;grid-template-columns:1fr 1fr;gap:10px;"><input placeholder="Name" style="min-height:46px;padding:0 12px;"/><input placeholder="Email" style="min-height:46px;padding:0 12px;"/><textarea placeholder="Message" style="grid-column:1/-1;min-height:130px;padding:12px;"></textarea><div>${action('Send message')}</div></form></div>`
        : variant === 2
          ? `${sectionHeading('Choose the right route', true)}<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">${['Sales', 'Support', 'Partnerships'].map((label, index) => `<article style="min-height:160px;padding:22px;border:1px solid rgba(15,23,42,.1);border-radius:8px;background:#fff;color:#0f172a;"><span style="font-size:.72rem;font-weight:900;color:#10b981;">0${index + 1}</span><h3 ${editable} style="margin:32px 0 8px;font-size:1.2rem;">${label}</h3><p ${editable} style="margin:0;color:#64748b;line-height:1.6;">Give people a direct next step.</p></article>`).join('')}</div>`
          : `<div style="display:grid;grid-template-columns:.7fr 1.3fr;gap:28px;"><div>${sectionHeading('Visit us')}<p ${editable} style="opacity:.68;line-height:1.8;">123 Example Street<br/>Monday-Friday, 9-5</p></div>${media('Map')}</div>`
      break

    case 'Team':
      root.style.display = 'grid'
      root.style.gap = '28px'
      root.innerHTML = variant === 1
        ? `${sectionHeading('People behind the work')}<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">${['Founder', 'Design lead', 'Engineering lead'].map((role) => `<article>${media('Portrait')}<strong ${editable} style="display:block;margin-top:12px;">Person name</strong><span ${editable} style="opacity:.6;">${role}</span></article>`).join('')}</div>`
        : variant === 2
          ? `<div style="display:grid;grid-template-columns:.9fr 1.1fr;gap:34px;align-items:center;">${media('Founder portrait')}<div>${sectionHeading('A note from the founder')}<p ${editable} style="opacity:.68;line-height:1.8;">Explain the conviction behind the company in a human voice.</p></div></div>`
          : `<div style="display:grid;grid-template-columns:1.2fr .8fr;gap:34px;align-items:center;"><div>${media('Team collage')}</div><div>${sectionHeading('Join the team')}<p ${editable} style="opacity:.68;line-height:1.8;">Pair the team story with one clear hiring action.</p>${action('See open roles')}</div></div>`
      break

    case 'Blog':
      root.style.display = 'grid'
      root.style.gap = '28px'
      root.innerHTML = variant === 1
        ? `${sectionHeading('Latest thinking')}<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">${[1, 2, 3].map((item) => `<article>${media(`Article ${item}`)}<span ${editable} style="display:block;margin-top:12px;font-size:.72rem;font-weight:900;color:#10b981;">Category</span><h3 ${editable}>A useful article title</h3></article>`).join('')}</div>`
        : variant === 2
          ? `<div style="display:grid;grid-template-columns:1.4fr .6fr;gap:16px;"><article>${media('Featured story')}<h2 ${editable} style="font-size:2.3rem;">The lead story deserves more room.</h2></article><div style="display:grid;gap:16px;">${card(1)}${card(2)}</div></div>`
          : `${sectionHeading('Resources')}<div style="display:grid;gap:0;">${['Guide', 'Report', 'Update'].map((label) => `<article style="display:grid;grid-template-columns:100px 1fr auto;gap:18px;align-items:center;padding:18px 0;border-top:1px solid rgba(255,255,255,.14);"><span ${editable}>${label}</span><strong ${editable}>Resource title</strong><span>Open</span></article>`).join('')}</div>`
      break
  }

  return root
}
