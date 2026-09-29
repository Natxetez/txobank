// Genera los iconos PNG (una "T" latón sobre verde botella) sin dependencias.
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const GREEN = [0x2f, 0x6b, 0x4f]
const BRASS = [0xc4, 0x9a, 0x3a]

function crc32(buf) {
  let c, crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function png(size) {
  // T en cuadrícula 0..1; el margen deja la T dentro de la zona segura maskable.
  const bar = { x0: 0.26, x1: 0.74, y0: 0.24, y1: 0.36 }
  const stem = { x0: 0.44, x1: 0.56, y0: 0.24, y1: 0.76 }
  const inside = (r, x, y) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1
  const rows = []
  for (let py = 0; py < size; py++) {
    const row = Buffer.alloc(1 + size * 3)
    for (let px = 0; px < size; px++) {
      const x = (px + 0.5) / size
      const y = (py + 0.5) / size
      const c = inside(bar, x, y) || inside(stem, x, y) ? BRASS : GREEN
      row[1 + px * 3] = c[0]
      row[2 + px * 3] = c[1]
      row[3 + px * 3] = c[2]
    }
    rows.push(row)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // 8 bits
  ihdr[9] = 2 // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

writeFileSync('public/apple-touch-icon.png', png(180))
writeFileSync('public/icon-192.png', png(192))
writeFileSync('public/icon-512.png', png(512))
console.log('Iconos generados en public/')
