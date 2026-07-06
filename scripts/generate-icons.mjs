// One-shot PWA icon generation: renders the robot glyph SVG to the PNG set
// the manifest needs. Rerun after editing the glyph: `node scripts/generate-icons.mjs`
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

const BG = '#14161f';
const ACCENT = '#4cc9f0';

/**
 * Robot head with antenna and side rotors (it's a drone), on a 512 canvas.
 * `scale` shrinks the glyph toward the center — maskable icons need the
 * artwork inside the central 80% safe zone.
 */
function svg(scale = 1) {
  const s = 512;
  const c = s / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" fill="${BG}"/>
  <g transform="translate(${c} ${c}) scale(${scale}) translate(${-c} ${-c})">
    <!-- antenna -->
    <rect x="248" y="118" width="16" height="70" rx="8" fill="${ACCENT}"/>
    <circle cx="256" cy="106" r="24" fill="${ACCENT}"/>
    <!-- rotor arms -->
    <rect x="72" y="252" width="72" height="16" rx="8" fill="${ACCENT}"/>
    <rect x="368" y="252" width="72" height="16" rx="8" fill="${ACCENT}"/>
    <circle cx="84" cy="260" r="30" fill="none" stroke="${ACCENT}" stroke-width="14"/>
    <circle cx="428" cy="260" r="30" fill="none" stroke="${ACCENT}" stroke-width="14"/>
    <!-- head -->
    <rect x="140" y="180" width="232" height="196" rx="36" fill="${ACCENT}"/>
    <!-- eyes + mouth -->
    <circle cx="204" cy="258" r="26" fill="${BG}"/>
    <circle cx="308" cy="258" r="26" fill="${BG}"/>
    <rect x="196" y="316" width="120" height="18" rx="9" fill="${BG}"/>
  </g>
</svg>`;
}

await mkdir(outDir, { recursive: true });

const jobs = [
  { file: 'pwa-192.png', size: 192, scale: 1 },
  { file: 'pwa-512.png', size: 512, scale: 1 },
  { file: 'pwa-maskable-512.png', size: 512, scale: 0.72 },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.85 },
];
for (const { file, size, scale } of jobs) {
  await sharp(Buffer.from(svg(scale))).resize(size, size).png().toFile(path.join(outDir, file));
  console.log(`wrote public/${file}`);
}
await writeFile(path.join(outDir, 'favicon.svg'), svg(1));
console.log('wrote public/favicon.svg');
