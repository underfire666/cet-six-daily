/**
 * V13 Phase 2D.1: WAV (PCM 16-bit) → MP3 转码工具（纯 Node + @breezystack/lamejs，无需 ffmpeg）。
 * 用法: node scripts/wav-to-mp3.mjs <input.wav> <output.mp3> [kbps=128]
 * 输出: JSON {durationSec, sizeBytes, sampleRate, channels}
 */
import fs from "node:fs";
import { Mp3Encoder } from "@breezystack/lamejs";

const [, , input, output, kbpsArg] = process.argv;
if (!input || !output) {
  console.error("usage: node scripts/wav-to-mp3.mjs <input.wav> <output.mp3> [kbps]");
  process.exit(1);
}
const kbps = kbpsArg ? Number(kbpsArg) : 128;

const buf = fs.readFileSync(input);
// 标准 PCM WAV: 跳过 44 字节头；手动解析（little-endian）
const dataOffset = 44;
const channels = buf.readUInt16LE(22);
const sampleRate = buf.readUInt32LE(24);
const bitsPerSample = buf.readUInt16LE(34);
if (bitsPerSample !== 16) {
  console.error(`only 16-bit PCM WAV supported, got ${bitsPerSample}`);
  process.exit(1);
}
const bytesPerSample = bitsPerSample / 8;
const totalSamples = Math.floor((buf.length - dataOffset) / bytesPerSample / channels);
const durationSec = totalSamples / sampleRate;

// 分离左右声道
const left = new Int16Array(totalSamples);
const right = channels === 2 ? new Int16Array(totalSamples) : null;
for (let i = 0; i < totalSamples; i++) {
  left[i] = buf.readInt16LE(dataOffset + i * channels * bytesPerSample);
  if (right) right[i] = buf.readInt16LE(dataOffset + i * channels * bytesPerSample + bytesPerSample);
}

const encoder = new Mp3Encoder(channels, sampleRate, kbps);
const mp3Chunks = [];
const blockSize = 1152;
for (let i = 0; i < totalSamples; i += blockSize) {
  const end = Math.min(i + blockSize, totalSamples);
  const lChunk = left.subarray(i, end);
  let encoded;
  if (right) {
    const rChunk = right.subarray(i, end);
    encoded = encoder.encodeBuffer(lChunk, rChunk);
  } else {
    encoded = encoder.encodeBuffer(lChunk);
  }
  if (encoded.length > 0) mp3Chunks.push(Buffer.from(encoded));
}
const endBuf = encoder.flush();
if (endBuf.length > 0) mp3Chunks.push(Buffer.from(endBuf));
const mp3Buf = Buffer.concat(mp3Chunks);
fs.writeFileSync(output, mp3Buf);
console.log(JSON.stringify({ durationSec: Number(durationSec.toFixed(2)), sizeBytes: mp3Buf.length, sampleRate, channels, kbps }));
