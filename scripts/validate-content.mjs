#!/usr/bin/env node
// validate-content.mjs — validates every content file against its JSON Schema.
// Dependency-free: implements the JSON Schema subset this repo uses (type, required,
// properties, additionalProperties, items, enum, const, pattern, minItems). No npm install.

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT = join(__dirname, '..', 'content');
const SCHEMA_DIR = join(CONTENT, 'schema');

// content file (relative to content/) -> schema filename
const MAP = {
  'league.json': 'league.schema.json',
  'managers.json': 'managers.schema.json',
  'links.json': 'links.schema.json',
  'dues.json': 'dues.schema.json',
  'x-champion-log.json': 'x-champion-log.schema.json',
  'rules.meta.json': 'rules-meta.schema.json',
};

const typeOf = (v) => Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v === 'number' ? 'number' : typeof v;

function validate(data, schema, path, errors) {
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const t = typeOf(data);
    const ok = types.some(x => x === t || (x === 'number' && t === 'number'));
    if (!ok) { errors.push(`${path}: expected type ${types.join('|')}, got ${t}`); return; }
  }
  if (schema.enum) {
    const found = schema.enum.some(e => e === data);
    if (!found) errors.push(`${path}: value ${JSON.stringify(data)} not in enum ${JSON.stringify(schema.enum)}`);
  }
  if (schema.const !== undefined && data !== schema.const) {
    errors.push(`${path}: expected const ${JSON.stringify(schema.const)}`);
  }
  if (schema.pattern && typeof data === 'string') {
    if (!new RegExp(schema.pattern).test(data)) errors.push(`${path}: does not match /${schema.pattern}/`);
  }
  if (typeOf(data) === 'object') {
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!(key in data)) errors.push(`${path}: missing required "${key}"`);
      }
    }
    const props = schema.properties || {};
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(data)) {
        if (!(key in props)) errors.push(`${path}: additional property "${key}" not allowed`);
      }
    }
    for (const [key, sub] of Object.entries(props)) {
      if (key in data) validate(data[key], sub, `${path}.${key}`, errors);
    }
    // additionalProperties as schema (used by x-champion-log seasons map)
    if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      for (const [key, val] of Object.entries(data)) {
        if (!(key in props)) validate(val, schema.additionalProperties, `${path}.${key}`, errors);
      }
    }
  }
  if (typeOf(data) === 'array') {
    if (typeof schema.minItems === 'number' && data.length < schema.minItems) {
      errors.push(`${path}: expected at least ${schema.minItems} items, got ${data.length}`);
    }
    if (schema.items) {
      data.forEach((item, i) => validate(item, schema.items, `${path}[${i}]`, errors));
    }
  }
}

async function loadSchema(name) {
  return JSON.parse(await readFile(join(SCHEMA_DIR, name), 'utf8'));
}

async function checkFrontmatter(relPath, errors) {
  const text = await readFile(join(CONTENT, relPath), 'utf8');
  if (!text.startsWith('---\n')) errors.push(`${relPath}: missing YAML frontmatter`);
}

async function main() {
  let failures = 0;
  let checked = 0;

  // JSON files against schemas
  for (const [rel, schemaName] of Object.entries(MAP)) {
    const p = join(CONTENT, rel);
    if (!existsSync(p)) { console.error(`✗ ${rel}: file missing`); failures++; continue; }
    const data = JSON.parse(await readFile(p, 'utf8'));
    const schema = await loadSchema(schemaName);
    const errors = [];
    validate(data, schema, rel, errors);
    checked++;
    if (errors.length) { failures++; console.error(`✗ ${rel}`); errors.forEach(e => console.error('   ' + e)); }
    else console.log(`✓ ${rel}`);
  }

  // seasons/*.json against season.schema.json
  const seasonSchema = await loadSchema('season.schema.json');
  const seasonsDir = join(CONTENT, 'seasons');
  if (existsSync(seasonsDir)) {
    for (const f of (await readdir(seasonsDir)).filter(f => f.endsWith('.json'))) {
      const rel = `seasons/${f}`;
      const data = JSON.parse(await readFile(join(seasonsDir, f), 'utf8'));
      const errors = [];
      validate(data, seasonSchema, rel, errors);
      checked++;
      if (errors.length) { failures++; console.error(`✗ ${rel}`); errors.forEach(e => console.error('   ' + e)); }
      else console.log(`✓ ${rel}`);
    }
  }

  // Markdown frontmatter presence
  for (const dir of ['chat-templates', 'commissioner']) {
    const d = join(CONTENT, dir);
    if (!existsSync(d)) continue;
    for (const f of (await readdir(d)).filter(f => f.endsWith('.md'))) {
      const rel = `${dir}/${f}`;
      const errors = [];
      await checkFrontmatter(rel, errors);
      checked++;
      if (errors.length) { failures++; console.error(`✗ ${rel}`); errors.forEach(e => console.error('   ' + e)); }
      else console.log(`✓ ${rel}`);
    }
  }

  // rules.md must exist and declare a known status
  if (existsSync(join(CONTENT, 'rules.md'))) {
    const rules = await readFile(join(CONTENT, 'rules.md'), 'utf8');
    checked++;
    if (!/status:\s*(draft|work_in_progress|locked)/.test(rules)) { failures++; console.error('✗ rules.md: expected a status: draft|work_in_progress|locked in frontmatter'); }
    else console.log('✓ rules.md');
  } else { failures++; console.error('✗ rules.md: missing (run import-icloud.mjs)'); }

  console.log(`\n${checked - failures}/${checked} checks passed.`);
  if (failures) { console.error(`\nFAILED: ${failures} file(s) invalid.`); process.exit(1); }
  console.log('All content valid. ✅');
}

main().catch(err => { console.error('validate-content FAILED', err); process.exit(1); });
