import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to write a valid uncompressed PNG file of a solid color with an inner square
function createPng(size, bgColor, fgColor) {
  const width = size;
  const height = size;

  const rawData = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;

  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      // Draw rounded margin
      const margin = Math.floor(size * 0.15);
      const isInner = x >= margin && x < (width - margin) && y >= margin && y < (height - margin);
      const col = isInner ? fgColor : bgColor;

      rawData[offset++] = col[0]; // R
      rawData[offset++] = col[1]; // G
      rawData[offset++] = col[2]; // B
      rawData[offset++] = col[3]; // A
    }
  }

  const compressedData = zlib.deflateSync(rawData);

  function crc32(buf) {
    let c = 0xffffffff;
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let code = n;
      for (let k = 0; k < 8; k++) {
        code = (code & 1) ? (0xedb88320 ^ (code >>> 1)) : (code >>> 1);
      }
      table[n] = code;
    }
    for (let i = 0; i < buf.length; i++) {
      c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function createChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const body = Buffer.concat([typeBuf, data]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(body), 0);
    return Buffer.concat([len, body, crcBuf]);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);  // Bit depth
  ihdr.writeUInt8(6, 9);  // Color type 6 (RGBA)
  ihdr.writeUInt8(0, 10); // Compression
  ihdr.writeUInt8(0, 11); // Filter
  ihdr.writeUInt8(0, 12); // Interlace

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const outDir = path.join(__dirname, '..', 'frontend', 'kitchen', 'public');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const bg = [130, 26, 29, 255];   // #821a1d maroon
const fg = [255, 255, 255, 255]; // white

fs.writeFileSync(path.join(outDir, 'icon-192.png'), createPng(192, bg, fg));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), createPng(512, bg, fg));
console.log('✅ PWA PNG Icons generated successfully');
