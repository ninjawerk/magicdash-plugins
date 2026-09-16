// Validates index.json: shape, unique + non-reserved ids, and for every entry downloads the zip,
// checks the SHA-256 and that the manifest inside matches id / version / sdkVersion.
// Usage: node validate.mjs [--only id1,id2]   (CI runs it for all entries)
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RESERVED = new Set(['clock', 'google-calendar', 'home-assistant', 'quotes', 'random-image', 'weather', 'news', 'word-of-the-day', 'qr-code', 'install', 'installed', 'rebuild', 'upload']);
const index = JSON.parse(readFileSync('index.json', 'utf8'));
const only = process.argv.includes('--only') ? new Set(process.argv[process.argv.indexOf('--only') + 1].split(',')) : null;
const errors = [];
const ids = new Set();
const re = { id: /^[a-z0-9][a-z0-9-]*$/, ver: /^\d+\.\d+\.\d+$/, sha: /^[a-f0-9]{64}$/, repo: /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/ };

for (const p of index.plugins) {
  const tag = `[${p.id ?? '?'}]`;
  for (const k of ['id', 'name', 'description', 'author', 'repo', 'version', 'download', 'sha256', 'sdkVersion']) if (p[k] === undefined) errors.push(`${tag} missing ${k}`);
  if (!re.id.test(p.id ?? '')) errors.push(`${tag} id must be kebab-case`);
  if (RESERVED.has(p.id)) errors.push(`${tag} id is reserved (bundled with MagicDash)`);
  if (ids.has(p.id)) errors.push(`${tag} duplicate id`);
  ids.add(p.id);
  if (!re.ver.test(p.version ?? '')) errors.push(`${tag} version must be x.y.z`);
  if (!re.sha.test(p.sha256 ?? '')) errors.push(`${tag} sha256 must be 64 lowercase hex`);
  if (!re.repo.test(p.repo ?? '')) errors.push(`${tag} repo must be owner/name`);
  if (!/^https:\/\//.test(p.download ?? '')) errors.push(`${tag} download must be https`);
  if (p.description && p.description.length > 300) errors.push(`${tag} description too long`);
}

for (const p of index.plugins) {
  if (only && !only.has(p.id)) continue;
  try {
    const r = await fetch(p.download, { redirect: 'follow', headers: { 'user-agent': 'magicdash-catalog-ci' } });
    if (!r.ok) throw new Error(`download ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const sha = createHash('sha256').update(buf).digest('hex');
    if (sha !== p.sha256) throw new Error(`sha256 mismatch: got ${sha}`);
    const dir = mkdtempSync(join(tmpdir(), 'md-'));
    writeFileSync(join(dir, 'p.zip'), buf);
    const list = execFileSync('unzip', ['-Z1', join(dir, 'p.zip')], { encoding: 'utf8' }).split('\n');
    const manifestPath = list.find((f) => f.endsWith('manifest.ts'));
    if (!manifestPath) throw new Error('zip has no manifest.ts');
    if (!list.some((f) => f.endsWith('client.tsx'))) throw new Error('zip has no client.tsx');
    const manifest = execFileSync('unzip', ['-p', join(dir, 'p.zip'), manifestPath], { encoding: 'utf8' });
    const field = (k) => manifest.match(new RegExp(`\\b${k}\\s*:\\s*['"\`]([^'"\`]+)['"\`]`))?.[1];
    const num = (k) => Number(manifest.match(new RegExp(`\\b${k}\\s*:\\s*(\\d+)`))?.[1]);
    if (field('id') !== p.id) throw new Error(`manifest id "${field('id')}" ≠ entry id`);
    if (field('version') !== p.version) throw new Error(`manifest version "${field('version')}" ≠ entry version`);
    if (num('sdkVersion') !== p.sdkVersion) throw new Error(`manifest sdkVersion ${num('sdkVersion')} ≠ entry ${p.sdkVersion}`);
    console.log(`✔ ${p.id} v${p.version} (${buf.length} bytes, sha ok, manifest ok)`);
  } catch (e) {
    errors.push(`[${p.id}] ${e.message}`);
  }
}

if (errors.length) {
  console.error('\n✖ ' + errors.join('\n✖ '));
  process.exit(1);
}
console.log(`\nAll ${index.plugins.length} entries valid.`);
