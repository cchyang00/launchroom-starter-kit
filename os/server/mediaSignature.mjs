import { open } from 'node:fs/promises';
import path from 'node:path';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ebml = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
const isTextBrand = value => /^[\x20-\x7e]{4}$/.test(value);

function ftyp(header, fileSize) {
  for (let offset = 0; offset + 16 <= header.length;) {
    const boxSize = header.readUInt32BE(offset);
    const boxType = header.toString('ascii', offset + 4, offset + 8);
    if (boxSize < (boxType === 'ftyp' ? 16 : 8) || boxSize > fileSize - offset) return null;
    if (boxType === 'ftyp') return header.subarray(offset, Math.min(header.length, offset + boxSize));
    if (!['free', 'skip', 'wide'].includes(boxType)) return null;
    offset += boxSize;
  }
  return null;
}

export function matchesMediaSignature(extension, header, fileSize) {
  if (!Buffer.isBuffer(header) || !Number.isSafeInteger(fileSize) || fileSize <= 0) return false;
  switch (extension.toLowerCase()) {
    case '.png':
      return fileSize >= 33 && header.length >= 24 && header.subarray(0, 8).equals(png)
        && header.readUInt32BE(8) === 13 && header.toString('ascii', 12, 16) === 'IHDR'
        && header.readUInt32BE(16) > 0 && header.readUInt32BE(20) > 0;
    case '.jpg': case '.jpeg':
      return fileSize >= 32 && header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    case '.webp':
      return fileSize >= 20 && header.length >= 16 && header.toString('ascii', 0, 4) === 'RIFF'
        && header.toString('ascii', 8, 12) === 'WEBP' && ['VP8 ', 'VP8L', 'VP8X'].includes(header.toString('ascii', 12, 16));
    case '.gif':
      return fileSize >= 13 && header.length >= 10 && ['GIF87a', 'GIF89a'].includes(header.toString('ascii', 0, 6))
        && header.readUInt16LE(6) > 0 && header.readUInt16LE(8) > 0;
    case '.avif': {
      const box = ftyp(header, fileSize);
      if (!box || box.length < 16) return false;
      for (let offset = 8; offset + 4 <= box.length; offset += 4) {
        if (offset === 12) continue; // minor version, not a brand
        if (['avif', 'avis'].includes(box.toString('ascii', offset, offset + 4))) return true;
      }
      return false;
    }
    case '.mp4': {
      const box = ftyp(header, fileSize);
      return Boolean(box && box.length >= 16 && isTextBrand(box.toString('ascii', 8, 12)));
    }
    case '.webm':
      return fileSize >= 16 && header.length >= 16 && header.subarray(0, 4).equals(ebml)
        && header.indexOf(Buffer.from('webm'), 4) >= 0;
    default:
      return false;
  }
}

export async function mediaFileMatchesExtension(file) {
  const handle = await open(file, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) return false;
    const header = Buffer.alloc(Math.min(512, stat.size));
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    return matchesMediaSignature(path.extname(file), header.subarray(0, bytesRead), stat.size);
  } finally {
    await handle.close();
  }
}
