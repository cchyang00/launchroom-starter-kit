// Bring the image maker's finished pictures into the store's slots.
//
//   node scripts/import-images.mjs <from-folder> <slot-folder-under-public/images> [--dry]
//   node scripts/import-images.mjs ../products/drafts/L105-bath-pillow/assets l105
//
// For each slot name (hero-1 … hero-7, section-who, section-box, wind-down-set,
// addon-eye-mask, addon-spare-cap) a matching
// .png, .jpg, .jpeg or .webp in <from-folder> becomes public/images/<slot-folder>/<name>.webp,
// fitted inside 1200 x 1600 px (a 1:1 slide is 1200 px, a 3:4 section picture
// about 1200 x 1600: sharp on a 3x phone, light to load), quality 82, at its own
// shape (never cropped). Slots with no file keep their
// placeholder. Needs ffmpeg on PATH (or FFMPEG=<path to ffmpeg>). Only
// delivered files belong here: drafts, truth photos and supplier photos never do.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [from, slotFolder, flag] = process.argv.slice(2);
if (!from || !slotFolder || !/^[a-z0-9-]+$/.test(slotFolder))
  throw new Error('Usage: import-images.mjs <from-folder> <slot-folder> [--dry]');
const SLOTS = [
  'hero-1', 'hero-2', 'hero-3', 'hero-4', 'hero-5', 'hero-6', 'hero-7', 'section-who', 'section-box',
  // "Make it a set": the step-up bundle card and the one-tap add-ons (blueprint section 10).
  'wind-down-set', 'addon-eye-mask', 'addon-spare-cap',
];
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const dest = path.resolve('public/images', slotFolder);
fs.mkdirSync(dest, {recursive: true});
const files = fs.readdirSync(from);
const report = [];
for (const slot of SLOTS) {
  const source = files.find((file) => new RegExp(`^${slot}\\.(png|jpe?g|webp)$`, 'i').test(file));
  if (!source) {
    report.push(`${slot}: no file yet, placeholder kept`);
    continue;
  }
  const target = path.join(dest, `${slot}.webp`);
  if (flag === '--dry') {
    report.push(`${slot}: would import ${source}`);
    continue;
  }
  execFileSync(ffmpeg, [
    '-loglevel', 'error', '-y',
    '-i', path.join(from, source),
    '-vf', "scale=w='min(1200,iw)':h='min(1600,ih)':force_original_aspect_ratio=decrease:flags=lanczos",
    '-c:v', 'libwebp', '-quality', '82',
    target,
  ]);
  const kb = Math.round(fs.statSync(target).size / 1024);
  report.push(`${slot}: imported ${source} -> ${path.relative(process.cwd(), target)} (${kb} KB${kb > 300 ? ', over 300 KB: lower the quality' : ''})`);
}
console.warn(report.join('\n'));
