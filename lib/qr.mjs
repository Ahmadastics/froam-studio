/**
 * Froam — a QR code for the terminal.
 *
 * `froam dev --host` prints a link your own phone opens to pair with this
 * computer. Typing sixty characters on a phone is miserable; pointing its
 * camera at the terminal isn't. This is a small, dependency-free encoder for
 * exactly that: byte mode, error correction level M, versions 1–10 (up to
 * 213 bytes), drawn with half-block characters so a code is half as tall as
 * it is wide in text.
 *
 * The structure follows the QR specification (ISO/IEC 18004) as laid out in
 * Project Nayuki's reference implementation: data codewords, Reed–Solomon
 * error correction per block, interleaving, function patterns, zigzag
 * placement, a mask chosen by the standard penalty rules, and format bits.
 */

// Error correction level M: codewords per block and number of blocks, by version (index 0 unused).
const ECC_PER_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]
const NUM_BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5]
const FORMAT_BITS_M = 0
const MAX_VERSION = 10

function rawDataModules(version) {
  let result = (16 * version + 128) * version + 64
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2
    result -= (25 * align - 10) * align - 55
    if (version >= 7) result -= 36
  }
  return result
}

const dataCodewords = (version) => Math.floor(rawDataModules(version) / 8) - ECC_PER_BLOCK[version] * NUM_BLOCKS[version]

/* ── Reed–Solomon over GF(2^8), polynomial 0x11D ── */

function gfMultiply(x, y) {
  let z = 0
  for (let i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z & 0xff
}

function rsDivisor(degree) {
  const result = new Array(degree).fill(0)
  result[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < result.length; j += 1) {
      result[j] = gfMultiply(result[j], root)
      if (j + 1 < result.length) result[j] ^= result[j + 1]
    }
    root = gfMultiply(root, 0x02)
  }
  return result
}

function rsRemainder(data, divisor) {
  const result = divisor.map(() => 0)
  for (const byte of data) {
    const factor = byte ^ result.shift()
    result.push(0)
    divisor.forEach((coefficient, i) => { result[i] ^= gfMultiply(coefficient, factor) })
  }
  return result
}

/* ── codewords ── */

function encodeData(bytes, version) {
  const bits = []
  const push = (value, length) => { for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1) }
  push(0b0100, 4) // byte mode
  push(bytes.length, version <= 9 ? 8 : 16)
  for (const byte of bytes) push(byte, 8)
  const capacity = dataCodewords(version) * 8
  push(0, Math.min(4, capacity - bits.length)) // terminator
  push(0, (8 - (bits.length % 8)) % 8)
  const codewords = []
  for (let i = 0; i < bits.length; i += 8) codewords.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0))
  for (let pad = 0xec; codewords.length < dataCodewords(version); pad ^= 0xec ^ 0x11) codewords.push(pad)
  return codewords
}

function addEccAndInterleave(data, version) {
  const numBlocks = NUM_BLOCKS[version]
  const eccLength = ECC_PER_BLOCK[version]
  const rawCodewords = Math.floor(rawDataModules(version) / 8)
  const numShort = numBlocks - (rawCodewords % numBlocks)
  const shortLength = Math.floor(rawCodewords / numBlocks)
  const divisor = rsDivisor(eccLength)
  const blocks = []
  for (let i = 0, k = 0; i < numBlocks; i += 1) {
    const block = data.slice(k, k + shortLength - eccLength + (i < numShort ? 0 : 1))
    k += block.length
    const ecc = rsRemainder(block, divisor)
    if (i < numShort) block.push(0)
    blocks.push(block.concat(ecc))
  }
  const result = []
  for (let i = 0; i < blocks[0].length; i += 1) {
    blocks.forEach((block, j) => { if (i !== shortLength - eccLength || j >= numShort) result.push(block[i]) })
  }
  return result
}

/* ── the matrix ── */

function alignmentPositions(version, size) {
  if (version === 1) return []
  const count = Math.floor(version / 7) + 2
  const step = Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2
  const result = [6]
  for (let pos = size - 7; result.length < count; pos -= step) result.splice(1, 0, pos)
  return result
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
]

function buildMatrix(codewords, version, mask) {
  const size = version * 4 + 17
  const modules = Array.from({ length: size }, () => new Array(size).fill(false))
  const isFunction = Array.from({ length: size }, () => new Array(size).fill(false))
  const set = (x, y, dark) => { modules[y][x] = dark; isFunction[y][x] = true }

  // Timing patterns.
  for (let i = 0; i < size; i += 1) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0) }
  // Finder patterns with separators.
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const x = cx + dx
        const y = cy + dy
        if (x < 0 || y < 0 || x >= size || y >= size) continue
        const distance = Math.max(Math.abs(dx), Math.abs(dy))
        set(x, y, distance !== 2 && distance !== 4)
      }
    }
  }
  // Alignment patterns, skipping the finder corners.
  const positions = alignmentPositions(version, size)
  for (let i = 0; i < positions.length; i += 1) {
    for (let j = 0; j < positions.length; j += 1) {
      if ((i === 0 && j === 0) || (i === 0 && j === positions.length - 1) || (i === positions.length - 1 && j === 0)) continue
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) set(positions[i] + dx, positions[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
      }
    }
  }
  // Reserve the format areas (drawn for real below) and, from version 7, the version areas.
  drawFormat(set, size, 0)
  if (version >= 7) {
    let rem = version
    for (let i = 0; i < 12; i += 1) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const bits = (version << 12) | rem
    for (let i = 0; i < 18; i += 1) {
      const dark = ((bits >>> i) & 1) === 1
      const a = size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      set(a, b, dark)
      set(b, a, dark)
    }
  }

  // Data, in the zigzag.
  let bit = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vertical = 0; vertical < size; vertical += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j
        const upward = ((right + 1) & 2) === 0
        const y = upward ? size - 1 - vertical : vertical
        if (!isFunction[y][x] && bit < codewords.length * 8) {
          modules[y][x] = ((codewords[bit >>> 3] >>> (7 - (bit & 7))) & 1) === 1
          bit += 1
        }
      }
    }
  }
  // Mask the data, then write the real format bits for that mask.
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) if (!isFunction[y][x] && MASKS[mask](x, y)) modules[y][x] = !modules[y][x]
  }
  drawFormat(set, size, mask)
  return modules
}

function drawFormat(set, size, mask) {
  const data = (FORMAT_BITS_M << 3) | mask
  let rem = data
  for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
  const bits = ((data << 10) | rem) ^ 0x5412
  const at = (i) => ((bits >>> i) & 1) === 1
  for (let i = 0; i <= 5; i += 1) set(8, i, at(i))
  set(8, 7, at(6))
  set(8, 8, at(7))
  set(7, 8, at(8))
  for (let i = 9; i < 15; i += 1) set(14 - i, 8, at(i))
  for (let i = 0; i < 8; i += 1) set(size - 1 - i, 8, at(i))
  for (let i = 8; i < 15; i += 1) set(8, size - 15 + i, at(i))
  set(8, size - 8, true) // the dark module
}

/** The standard penalty score: lower reads more reliably. */
function penalty(modules) {
  const size = modules.length
  let score = 0
  const runs = (line) => {
    let total = 0
    let run = 1
    for (let i = 1; i <= line.length; i += 1) {
      if (i < line.length && line[i] === line[i - 1]) run += 1
      else { if (run >= 5) total += 3 + (run - 5); run = 1 }
    }
    return total
  }
  const finderLike = (line) => {
    let total = 0
    const s = line.map((dark) => (dark ? '1' : '0')).join('')
    for (const pattern of ['10111010000', '00001011101']) for (let i = s.indexOf(pattern); i >= 0; i = s.indexOf(pattern, i + 1)) total += 40
    return total
  }
  for (let y = 0; y < size; y += 1) { score += runs(modules[y]) + finderLike(modules[y]) }
  for (let x = 0; x < size; x += 1) { const column = modules.map((row) => row[x]); score += runs(column) + finderLike(column) }
  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const c = modules[y][x]
      if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) score += 3
    }
  }
  const dark = modules.flat().filter(Boolean).length
  score += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10
  return score
}

/** The QR code for `text`, as rows of booleans (true = dark), without the quiet zone. */
export function qrMatrix(text) {
  const bytes = [...new TextEncoder().encode(String(text))]
  let version = 1
  while (version <= MAX_VERSION && dataCodewords(version) < bytes.length + (version <= 9 ? 2 : 3)) version += 1
  if (version > MAX_VERSION) throw new Error(`qr: ${bytes.length} bytes is too long for a terminal code`)
  const codewords = addEccAndInterleave(encodeData(bytes, version), version)
  let best = null
  for (let mask = 0; mask < 8; mask += 1) {
    const modules = buildMatrix(codewords, version, mask)
    const score = penalty(modules)
    if (!best || score < best.score) best = { modules, score }
  }
  return best.modules
}

/**
 * The code as terminal text: two rows of modules per line, with a quiet zone,
 * drawn black on white with ANSI colours so it reads in light and dark
 * terminals alike. `indent` is prefixed to every line.
 */
export function qrTerminal(text, { indent = '  ' } = {}) {
  const modules = qrMatrix(text)
  const quiet = 2
  const size = modules.length + quiet * 2
  const dark = (x, y) => {
    const mx = x - quiet
    const my = y - quiet
    return mx >= 0 && my >= 0 && mx < modules.length && my < modules.length && modules[my][mx]
  }
  const lines = []
  for (let y = 0; y < size; y += 2) {
    let line = ''
    for (let x = 0; x < size; x += 1) {
      const top = dark(x, y)
      const bottom = y + 1 < size ? dark(x, y + 1) : false
      // Foreground draws the top half (▀); the background shows the bottom half.
      line += `\x1b[${top ? 30 : 97};${bottom ? 40 : 107}m▀`
    }
    lines.push(`${indent}${line}\x1b[0m`)
  }
  return lines.join('\n')
}
