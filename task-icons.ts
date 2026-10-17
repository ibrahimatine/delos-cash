// PWA icons (CDC §9.1): PNG renders of web/public/icons/*.svg.
// Run after editing an icon: pnpm icons
import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync } from 'node:fs'

const dir = 'web/public/icons'
const renders: [string, string, number][] = [
  ['icon.svg', 'icon-192.png', 192],
  ['icon.svg', 'icon-512.png', 512],
  ['icon-maskable.svg', 'icon-maskable-512.png', 512],
  // iOS rounds the corners itself: full-bleed source
  ['icon-maskable.svg', 'apple-touch-icon.png', 180],
]

for (const [source, target, size] of renders) {
  const svg = readFileSync(`${dir}/${source}`, 'utf8')
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } })
    .render().asPng()
  writeFileSync(`${dir}/${target}`, png)
  console.log(`${target} ${size}px · ${png.length} o`)
}
