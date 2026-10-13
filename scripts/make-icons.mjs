// Genera los iconos PNG (una "T" blanca sobre degradado menta, con un punto ámbar) sin dependencias.
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const MENTA = [0x14, 0xb8, 0x85]
const VERDE = [0x06, 0x61, 0x47]
const BLANCO = [0xff, 0xff, 0xff]
const AMBAR = [0xff, 0xb5, 0x47]
const mezcla = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)

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
  // Formas en cuadrícula 0..1; el margen deja la T dentro de la zona segura maskable.
  const bar = { x0: 0.27, x1: 0.73, y0: 0.25, y1: 0.37 }
  const stem = { x0: 0.44, x1: 0.56, y0: 0.25, y1: 0.75 }
  const punto = { cx: 0.7, cy: 0.69, r: 0.065 }
  const inside = (r, x, y) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1
  const color = (x, y) => {
    if (inside(bar, x, y) || inside(stem, x, y)) return BLANCO
    if ((x - punto.cx) ** 2 + (y - punto.cy) ** 2 <= punto.r ** 2) return AMBAR
    return mezcla(MENTA, VERDE, Math.min(1, (x + y) / 2))
  }
  // Supermuestreo 4×4 para suavizar los bordes.
  const S = 4
  const rows = []
  for (let py = 0; py < size; py++) {
    const row = Buffer.alloc(1 + size * 3)
    for (let px = 0; px < size; px++) {
      const suma = [0, 0, 0]
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const c = color((px + (sx + 0.5) / S) / size, (py + (sy + 0.5) / S) / size)
          suma[0] += c[0]
          suma[1] += c[1]
          suma[2] += c[2]
        }
      }
      for (let k = 0; k < 3; k++) row[1 + px * 3 + k] = Math.round(suma[k] / (S * S))
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
