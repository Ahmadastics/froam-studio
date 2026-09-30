/**
 * Styles' living looks, signature materials, photo treatments and showpiece
 * type: each recipe writes CSS the site can carry, anything that moves on
 * hover glides there, ::before/::after layers have content, Reset takes it all
 * off — and the generated stylesheet the live site loads has every part of
 * every one of them, :hover and ::after rules included.
 */
import assert from 'node:assert/strict'

const { LOOKS, LOOK_GROUPS } = await import('../dist/editor/floating-bar-looks.js')
const { generateCss } = await import('../lib/codegen.mjs')

const tests = []
const test = (name, fn) => tests.push([name, fn])
const ACCENT = '#6366f1'
const STATE = /^__froamState:(hover|focus|active|before|after):(.+)$/
const PROPERTY = /^(?:--[a-z][a-z0-9-]*|[A-Za-z][A-Za-z0-9]*)$/
const kebab = (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
const TYPE = new Set(['3D type', 'Long shadow', 'Riso', 'Knockout', 'Speed', 'Fat underline', 'Live dot', 'Sparkle', 'Rule kicker', 'Two-tone'])
const fresh = LOOKS.filter((look) => ['Alive', 'Signature', 'Photo'].includes(look.group) || TYPE.has(look.name))
const recipes = (look) => [['styles', look.styles(ACCENT)], ...(look.text ? [['text', look.text(ACCENT)]] : [])]
const parts = (recipe) => {
  const out = { base: {} }
  for (const [key, value] of Object.entries(recipe)) {
    const match = key.match(STATE)
    if (match) (out[match[1]] ??= {})[match[2]] = value
    else out.base[key] = value
  }
  return out
}

test('three new tabs lead Styles: Alive, Signature, Photo', () => {
  assert.deepEqual(LOOK_GROUPS.slice(0, 3), ['Alive', 'Signature', 'Photo'])
  const count = (group) => LOOKS.filter((look) => look.group === group).length
  assert.equal(count('Alive'), 15)
  assert.equal(count('Signature'), 13)
  assert.equal(count('Photo'), 10)
  assert.equal(fresh.length, 48)
  assert.equal(LOOKS.length, 253)
  assert.deepEqual(LOOKS.slice(0, 3).map((look) => look.name), ['Shine sweep', 'Levitate', 'Clicky'], 'the new looks come first in All')
})

test('every recipe writes only CSS a stylesheet can carry', () => {
  for (const look of LOOKS) {
    for (const [kind, recipe] of recipes(look)) {
      for (const [key, value] of Object.entries(recipe)) {
        const property = key.match(STATE)?.[2] ?? key
        assert.match(property, PROPERTY, `${look.name} (${kind}): "${key}" is not a CSS property`)
        assert.equal(typeof value, 'string', `${look.name}: ${key} is not a string`)
        assert.doesNotMatch(value, /[{};]|<\/style/i, `${look.name}: ${key} could break out of its rule`)
      }
    }
  }
  for (const look of fresh) for (const [, recipe] of recipes(look)) for (const value of Object.values(recipe)) assert.doesNotMatch(value, /url\(/, `${look.name} loads a file`)
})

test('everything that changes on hover, press or focus glides there', () => {
  for (const look of fresh) {
    for (const [kind, recipe] of recipes(look)) {
      const { base, hover = {}, active = {}, focus = {}, before = {}, after = {} } = parts(recipe)
      for (const [state, styles] of [['hover', hover], ['active', active], ['focus', focus]]) {
        for (const property of Object.keys(styles)) {
          if (property.startsWith('--')) {
            // A custom property drives a ::before/::after, which carries the transition.
            const layer = Object.values({ ...before, ...after }).join(' ')
            assert.ok(layer.includes(`var(${property}`), `${look.name}: ${property} on ${state} drives nothing`)
            assert.ok(before.transition || after.transition, `${look.name}: the layer ${property} moves has no transition`)
            continue
          }
          const transition = base.transition ?? ''
          assert.ok(transition.includes('all') || transition.includes(kebab(property)), `${look.name} (${kind}): ${property} jumps on ${state} — no transition for it`)
        }
      }
    }
  }
})

test('every Alive look answers the pointer', () => {
  for (const look of LOOKS.filter((candidate) => candidate.group === 'Alive')) {
    const { hover, active, focus } = parts(look.styles(ACCENT))
    assert.ok(hover || active || focus, `${look.name} does nothing on hover, press or focus`)
  }
})

test('::before and ::after layers always have content, and custom properties they read have defaults', () => {
  for (const look of fresh) {
    for (const [, recipe] of recipes(look)) {
      const { before, after } = parts(recipe)
      for (const [name, layer] of [['before', before], ['after', after]]) {
        if (!layer) continue
        assert.ok(layer.content, `${look.name}: ::${name} has no content, so it never shows`)
        for (const use of Object.values(layer).join(' ').matchAll(/var\((--[a-z-]+)(,)?/g)) assert.ok(use[2], `${look.name}: var(${use[1]}) has no fallback`)
      }
    }
  }
})

test('recipes written for words fill their letters properly', () => {
  for (const look of LOOKS.filter((candidate) => candidate.text)) {
    const { base } = parts(look.text(ACCENT))
    if (base.backgroundClip === 'text' || base.WebkitBackgroundClip === 'text') {
      assert.equal(base.WebkitBackgroundClip, 'text', `${look.name}: Safari needs -webkit-background-clip`)
      assert.equal(base.WebkitTextFillColor, 'transparent', `${look.name}: the letters would cover their own gradient`)
    }
  }
  // Box-only looks are hidden when words are selected, rather than mistranslated.
  for (const name of ['Clicky', 'Brutal press', 'Liquid glass', 'Bento', 'Polaroid', 'Cinemascope']) assert.equal(LOOKS.find((look) => look.name === name).text, null, `${name} should be box-only`)
})

test('Reset look takes every living part off', () => {
  const reset = LOOKS.find((look) => look.name === 'Reset look').styles(ACCENT)
  for (const look of fresh) {
    for (const [, recipe] of recipes(look)) {
      for (const key of Object.keys(recipe)) if (STATE.test(key)) assert.equal(reset[key], '', `Reset look leaves ${look.name}'s ${key} behind`)
    }
  }
  for (const property of ['transition', 'transform', 'maskImage', 'WebkitMaskImage', 'WebkitTextStroke', 'outline']) assert.ok(property in reset, `Reset look leaves ${property}`)
})

test('the live site gets every part of every new look: base, :hover, :active, :focus, ::before, ::after', () => {
  for (const look of fresh) {
    const styles = look.styles(ACCENT)
    const css = generateCss({ version: 3, updatedAt: '2026-09-30T00:00:00.000Z', routes: { '/': { desktop: { 'section:1/div:1': { styles } } } } })
    const { base, ...states } = parts(styles)
    for (const [property, value] of Object.entries(base)) {
      if (!value) continue
      assert.ok(css.includes(`${kebab(property)}: ${value} !important;`), `${look.name}: ${property} is missing from the site's stylesheet`)
    }
    for (const [state, declarations] of Object.entries(states)) {
      const rule = css.split('\n\n').find((block) => block.includes(state === 'before' || state === 'after' ? `::${state} {` : `:${state} {`))
      assert.ok(rule, `${look.name}: no ${state} rule on the site`)
      for (const [property, value] of Object.entries(declarations)) assert.ok(rule.includes(`${kebab(property)}: ${value} !important;`), `${look.name}: ${state} ${property} is missing on the site`)
    }
  }
})

test('Arrow nudge, end to end in CSS: an arrow after the label that slides on hover', () => {
  const styles = LOOKS.find((look) => look.name === 'Arrow nudge').styles(ACCENT)
  const css = generateCss({ version: 3, routes: { '/': { desktop: { 'section:1/a:1': { styles } } } } })
  assert.match(css, /::after \{[^}]*content: "→" !important;[^}]*transform: translateX\(var\(--fx-nudge, 0px\)\) !important;/s)
  assert.match(css, /:hover \{[^}]*--fx-nudge: 5px !important;/s)
})

let passed = 0
for (const [name, fn] of tests) {
  try { await fn(); passed += 1; console.log(`✓ ${name}`) } catch (error) { console.error(`✗ ${name}\n  ${error.message}`) }
}
console.log(`living looks: ${passed}/${tests.length} passed`)
if (passed !== tests.length) process.exit(1)
