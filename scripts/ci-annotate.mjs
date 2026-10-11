#!/usr/bin/env node
/**
 * CI only: turn the end of a failed step's log into a GitHub error annotation,
 * so the reason a job failed shows on the run's summary page (and through the
 * public API) without opening — or having permission to download — the logs.
 *
 *   node scripts/ci-annotate.mjs "<title>" <logfile>
 */
import fs from 'node:fs'

const [title = 'Failed', file] = process.argv.slice(2)
let text = ''
try { text = fs.readFileSync(file, 'utf8') } catch { process.exit(0) }

// Colour codes and progress noise make the annotation unreadable.
const lines = text.replace(/\x1b\[[0-9;]*m/g, '').split(/\r?\n/).filter((line) => line.trim())
const tail = lines.slice(-60).join('\n').slice(-6000)
const escape = (value) => value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
console.log(`::error title=${escape(title).replace(/[:,]/g, ' ')}::${escape(tail)}`)
