/**
 * V13 Phase 2D.1: 拼接多个 PCM 16-bit WAV 文件为一个 WAV（同 sampleRate/channels）。
 * 用法: node scripts/wav-concat.mjs <out.wav> <in1.wav> <in2.wav> [...]
 * 输出: JSON {durationSec, sizeBytes, sampleRate, channels}
 */
import fs from "node:fs";

const [, , output, ...inputs] = process.argv;
if (!output || inputs.length < 1) {
  console.error("usage: node scripts/wav-concat.mjs <out.wav> <in1.wav> [in2.wav ...]");
  process.exit(1);
}

const dataOffset = 44;
let sampleRate = 0, channels = 0, bitsPerSample = 0;
const pcmChunks = [];
let totalDataBytes = 0;

for (const input of inputs) {
  const buf = fs.readFileSync(input);
  const ch = buf.readUInt16LE(22);
  const sr = buf.readUInt32LE(24);
  const bps = buf.readUInt16LE(34);
  if (sampleRate === 0) { sampleRate = sr; channels = ch; bitsPerSample = bps; }
  if (sr !== sampleRate || ch !== channels || bps !== bitsPerSample) {
    console.error(`mismatch in ${input}: sr=${sr} ch=${ch} bps=${bps}, expected sr=${sampleRate} ch=${channels} bps=${bitsPerSample}`);
    process.exit(1);
  }
  const dataBytes = buf.length - dataOffset;
  pcmChunks.push(buf.subarray(dataOffset));
  totalDataBytes += dataBytes;
}

const bytesPerSample = bitsPerSample / 8;
const totalSamples = Math.floor(totalDataBytes / bytesPerSample / channels);
const durationSec = totalSamples / sampleRate;

// 构造 WAV 文件
const outBuf = Buffer.alloc(dataOffset + totalDataBytes);
// RIFF header
outBuf.write("RIFF", 0);
outBuf.writeUInt32LE(36 + totalDataBytes, 4);
outBuf.write("WAVE", 8);
// fmt chunk
outBuf.write("fmt ", 12);
outBuf.writeUInt32LE(16, 16); // PCM chunk size
outBuf.writeUInt16LE(1, 20); // PCM format
outBuf.writeUInt16LE(channels, 22);
outBuf.writeUInt32LE(sampleRate, 24);
outBuf.writeUInt32LE(sampleRate * channels * bytesPerSample, 28); // byte rate
outBuf.writeUInt16LE(channels * bytesPerSample, 32); // block align
outBuf.writeUInt16LE(bitsPerSample, 34);
// data chunk
outBuf.write("data", 36);
outBuf.writeUInt32LE(totalDataBytes, 40);
let offset = dataOffset;
for (const chunk of pcmChunks) {
  chunk.copy(outBuf, offset);
  offset += chunk.length;
}
fs.writeFileSync(output, outBuf);
console.log(JSON.stringify({ durationSec: Number(durationSec.toFixed(2)), sizeBytes: outBuf.length, sampleRate, channels, totalSamples }));
