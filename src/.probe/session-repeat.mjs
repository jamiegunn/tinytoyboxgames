// Runs .probe/session.mjs N times per arm and reports mean +- sd.
//
// This exists because of a specific near-miss earlier in this project: a single
// run of the on-screen probe read 8.22 and a second run of the identical arm
// read 5.37, and I very nearly shipped a conclusion off the first draw. The
// shipped ambient module and the shipped surprise module both seed from
// unseeded Math.random -- creature speeds and phases, surprise intervals, types
// and durations -- so every run is a different session and a single number is a
// sample, not a measurement.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const N = Number(process.env.N || 8);
const SECS = Number(process.env.SECS || 300);
const ARMS = (process.env.ARMS || '0.38,0.55,0.75').split(',');
const KEYS = [
  'phaseZ',
  'phaseZFlatAmbient',
  'burstZ',
  'burstZAmbient',
  'burstZPlayer',
  'phaseRatio',
  'playerCausedFrac',
  'agencyMonotonousFrac',
  'agencyLongestRun',
  'agencyMeanPerplexity',
  'arcDivergence',
  'rateFirstThird',
  'rateLastThird',
  'monotonousFrac',
  'longestMonotonousRun',
  'meanTrailingPerplexity',
  'distinctFrac',
  'meanTrailingDistinct',
  'perplexity',
  'typesRealised',
  'events',
  'noveltyPerMin',
];

const stat = (xs) => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1));
  return `${m.toFixed(3)} +- ${sd.toFixed(3)}`;
};

const out = [];
for (const catchP of ARMS) {
  const rows = [];
  for (let i = 0; i < N; i += 1) {
    const env = { ...process.env, CATCHP: catchP, SECS: String(SECS), SEED: String(20260726 + i * 7919) };
    if (process.env.AMB) env.AMB = process.env.AMB;
    if (process.env.SURP) env.SURP = process.env.SURP;
    const { stdout } = await run('node', ['.probe/session.mjs'], { env, maxBuffer: 1 << 24 });
    rows.push(JSON.parse(stdout.slice(stdout.indexOf('{'))));
  }
  const summary = { catchP: Number(catchP), n: N };
  for (const k of KEYS) summary[k] = stat(rows.map((r) => r[k]));
  // Union of realised types across the N runs: which of the game's event kinds
  // ever actually happen, as opposed to which ones exist in the source.
  const types = new Set();
  for (const r of rows) for (const k of Object.keys(r.counts)) types.add(k);
  summary.typesEverSeen = [...types].sort();
  out.push(summary);
}

console.log(JSON.stringify({ tag: process.env.TAG || 'arm', seconds: SECS, arms: out }, null, 1));
