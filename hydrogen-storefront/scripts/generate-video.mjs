#!/usr/bin/env node
// Image-to-video through OpenRouter's video API, with a hard spend cap.
//
// Dry run (free, default): prints the request without calling the paid API.
//   node scripts/generate-video.mjs --image public/images/sample-hoodie.webp \
//     --prompt "Slow 360 turn of the hoodie on a soft studio backdrop" --name hoodie-turn
// Paid run (owner-approved only): add --confirm --max-cost 1.50
//
// Needs OPENROUTER_API_KEY in the environment (never committed or logged).
// Writes public/videos/<name>.mp4, a poster frame reference, a no-dialogue
// caption track and an entry in verification/video-generation-log.json.
import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://openrouter.ai/api/v1';
const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith('--')) {
      const next = all[i + 1];
      pairs.push([arg.slice(2), next && !next.startsWith('--') ? next : true]);
    }
    return pairs;
  }, []),
);
const fail = (message) => {
  console.error(`✖ ${message}`);
  process.exit(1);
};

const model = args.model || 'google/veo-3.1-lite';
const seconds = Number(args.seconds || 6);
const aspect = args.aspect || '9:16';
const resolution = args.resolution || '720p';
const name = String(args.name || '').replace(/[^a-z0-9-]/gi, '');
const confirm = args.confirm === true;
const maxCost = Number(args['max-cost'] || 0);
if (!args.image || !args.prompt || !name)
  fail('Use --image <public path> --prompt "<what moves>" --name <file-name>.');
if (!Number.isFinite(seconds) || seconds < 2 || seconds > 15)
  fail('Use --seconds between 2 and 15.');

const imagePath = path.resolve(String(args.image));
const image = await fs.readFile(imagePath).catch(() => fail(`Image not found: ${imagePath}`));
const ext = path.extname(imagePath).slice(1).toLowerCase().replace('jpg', 'jpeg');
const dataUrl = `data:image/${ext};base64,${image.toString('base64')}`;

const body = {
  model,
  prompt: String(args.prompt),
  duration: seconds,
  resolution,
  aspect_ratio: aspect,
  generate_audio: false,
  frame_images: [
    {type: 'image_url', image_url: {url: dataUrl}, frame_type: 'first_frame'},
  ],
};

// Price per second from the public model list (no key needed).
async function pricePerSecond() {
  try {
    const res = await fetch(`${API}/videos/models`);
    if (!res.ok) return null;
    const json = await res.json();
    const entry = (json.data || json.models || []).find((item) => item.id === model);
    const pricing = entry?.pricing || {};
    const value = Number(
      pricing['per-video-second'] ?? pricing.per_second ?? pricing.video_second ?? NaN,
    );
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}
const rate = (await pricePerSecond()) ?? Number(args.rate || NaN);
const estimate = Number.isFinite(rate) ? rate * seconds : null;

console.log(`Model ${model} · ${seconds}s · ${aspect} · ${resolution} · no audio`);
console.log(`Source image ${path.relative(process.cwd(), imagePath)} (${Math.round(image.length / 1024)} KB)`);
console.log(
  estimate === null
    ? 'Estimated cost: unknown (pass --rate <USD per second> to cap spend).'
    : `Estimated cost: $${estimate.toFixed(2)} at $${rate}/s`,
);
if (!confirm) {
  console.log('\nDry run only. Nothing was sent. Request body (image truncated):');
  console.log(JSON.stringify({...body, frame_images: [{...body.frame_images[0], image_url: {url: dataUrl.slice(0, 48) + '…'}}]}, null, 2));
  console.log('\nTo generate, the owner approves the spend, then run again with --confirm --max-cost <USD>.');
  process.exit(0);
}
const key = process.env.OPENROUTER_API_KEY;
if (!key) fail('OPENROUTER_API_KEY is not set in this shell.');
if (!(maxCost > 0)) fail('A paid run needs --max-cost <USD>.');
if (estimate === null) fail('Cost could not be estimated; pass --rate so the cap can be enforced.');
if (estimate > maxCost) fail(`Estimate $${estimate.toFixed(2)} exceeds --max-cost $${maxCost.toFixed(2)}.`);

const headers = {Authorization: `Bearer ${key}`, 'Content-Type': 'application/json'};
const submit = await fetch(`${API}/videos`, {method: 'POST', headers, body: JSON.stringify(body)});
if (!submit.ok) fail(`Submit failed (${submit.status}): ${(await submit.text()).slice(0, 400)}`);
const job = await submit.json();
console.log(`Job ${job.id} submitted; polling…`);
let result;
for (let attempt = 0; attempt < 90; attempt++) {
  await new Promise((resolve) => setTimeout(resolve, 10_000));
  const poll = await fetch(`${API}/videos/${job.id}`, {headers});
  result = await poll.json();
  process.stdout.write(`  ${result.status}\r`);
  if (['completed', 'failed', 'cancelled', 'expired'].includes(result.status)) break;
}
if (result?.status !== 'completed') fail(`Job ended as ${result?.status || 'unknown'}.`);
const download = await fetch(`${API}/videos/${job.id}/content?index=0`, {headers});
if (!download.ok) fail(`Download failed (${download.status}).`);
const outDir = path.resolve('public/videos');
await fs.mkdir(outDir, {recursive: true});
const videoFile = path.join(outDir, `${name}.mp4`);
await fs.writeFile(videoFile, Buffer.from(await download.arrayBuffer()));
await fs.writeFile(
  path.join(outDir, `${name}.vtt`),
  'WEBVTT\n\n00:00.000 --> 00:59.000\n[No dialogue. AI-generated product motion.]\n',
);
const logFile = path.resolve('verification/video-generation-log.json');
const log = JSON.parse(await fs.readFile(logFile, 'utf8').catch(() => '[]'));
log.push({
  name,
  file: `public/videos/${name}.mp4`,
  model,
  prompt: body.prompt,
  sourceImage: path.relative(process.cwd(), imagePath).replaceAll('\\', '/'),
  seconds,
  aspect,
  resolution,
  cost: result.usage?.cost ?? null,
  jobId: job.id,
  createdAt: new Date().toISOString(),
  label: 'AI-generated from a product image; not real footage',
});
await fs.writeFile(logFile, JSON.stringify(log, null, 2) + '\n');
console.log(`\n✔ Saved ${path.relative(process.cwd(), videoFile)} · cost $${result.usage?.cost ?? '?'}`);
console.log('Add it to the packet under demonstrations.items with generated details, then review it before publishing.');
