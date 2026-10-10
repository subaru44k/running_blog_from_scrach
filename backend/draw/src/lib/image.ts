import decode, { init } from '@jsquash/webp/decode.js';
import decoderWasm from '@jsquash/webp/codec/dec/webp_dec.wasm';
import { PNG } from 'pngjs';

let ready: Promise<void> | undefined;

// Preserve the existing PNG gate and AI inputs, including historical PNGs.
export async function asPng(bytes: Buffer): Promise<Buffer> {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return bytes;
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') throw new Error('Expected PNG or WebP');
  ready ||= init({ wasmBinary: decoderWasm, locateFile: () => 'embedded-webp-decoder.wasm' });
  await ready;
  const { data, width, height } = await decode(Uint8Array.from(bytes).buffer);
  return PNG.sync.write({ width, height, data: Buffer.from(data) } as PNG);
}
