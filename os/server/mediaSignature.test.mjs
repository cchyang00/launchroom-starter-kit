import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesMediaSignature } from './mediaSignature.mjs';

const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64');
const box = brand => {
  const value = Buffer.alloc(24);
  value.writeUInt32BE(24, 0); value.write('ftyp', 4); value.write(brand, 8);
  value.write(brand, 16); value.write('mif1', 20);
  return value;
};
const envelopes = [
  ['.png', tinyPng],
  ['.jpg', Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)])],
  ['.jpeg', Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)])],
  ['.webp', Buffer.concat([Buffer.from('RIFF\x14\x00\x00\x00WEBPVP8 ', 'binary'), Buffer.alloc(4)])],
  ['.gif', Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0, 0, 0])],
  ['.avif', box('avif')],
  ['.mp4', box('isom')],
  ['.webm', Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from('webm'), Buffer.alloc(8)])],
];

test('the final-asset extension contract recognizes each supported media container signature', () => {
  for (const [extension, bytes] of envelopes) assert.equal(matchesMediaSignature(extension, bytes, bytes.length), true, extension);
});

test('renaming text or the wrong media format cannot satisfy a final asset slot', () => {
  const fake = Buffer.from('Plain text renamed as a product image or video.');
  for (const [extension] of envelopes) assert.equal(matchesMediaSignature(extension, fake, fake.length), false, extension);
  assert.equal(matchesMediaSignature('.webp', tinyPng, tinyPng.length), false);
  assert.equal(matchesMediaSignature('.png', tinyPng.subarray(0, 8), 8), false);
  assert.equal(matchesMediaSignature('.avif', box('isom'), 24), false);
});
