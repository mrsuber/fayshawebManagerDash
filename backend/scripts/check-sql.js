/**
 * Checks every SQL statement in the backend against the database schema.
 *
 * Extracts the SQL strings from routes/, middleware/, services/ and server.js, and asks PostgreSQL to
 * PREPARE each one (parse and plan, nothing runs). A missing table or column, a wrong type or a typo
 * fails here instead of as a 500 in production.
 *
 *   node scripts/check-sql.js            # against the database in .env
 *   node scripts/check-sql.js --verbose  # also list statements it could not check (built at run time)
 *
 * Interpolated pieces (`${...}`) are blanked; when that leaves invalid SQL the statement is reported as
 * "dynamic" rather than failed. Exit code 1 when any statement fails.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');

const ROOT = path.join(__dirname, '..');
const SOURCES = ['routes', 'middleware', 'services', 'utils', 'server.js'];
const SQL_START = /^\s*(SELECT|INSERT|UPDATE|DELETE|WITH)\b/i;

function files(p) {
  const full = path.join(ROOT, p);
  if (!fs.existsSync(full)) return [];
  if (fs.statSync(full).isFile()) return [full];
  return fs.readdirSync(full).flatMap((f) => files(path.join(p, f))).filter((f) => f.endsWith('.js'));
}

/** String and template literals in a JS file, with `${...}` replaced by a marker. */
function literals(src) {
  const out = [];
  let i = 0;
  const line = (pos) => src.slice(0, pos).split('\n').length;
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 2; if (i < 2) break; continue; }
    if (c === "'" || c === '"') {
      const start = i;
      let s = '';
      i++;
      while (i < src.length && src[i] !== c) { if (src[i] === '\\') { s += src[i + 1]; i += 2; } else s += src[i++]; }
      i++;
      out.push({ text: s, line: line(start), dynamic: false });
      continue;
    }
    if (c === '`') {
      const start = i;
      let s = '';
      let dynamic = false;
      i++;
      while (i < src.length && src[i] !== '`') {
        if (src[i] === '\\') { s += src[i + 1]; i += 2; continue; }
        if (src[i] === '$' && src[i + 1] === '{') {
          let depth = 1;
          let j = i + 2;
          while (j < src.length && depth) {
            if (src[j] === '{') depth++;
            else if (src[j] === '}') depth--;
            else if (src[j] === '`') { j++; while (j < src.length && src[j] !== '`') j++; }
            j++;
          }
          const expr = src.slice(i + 2, j - 1);
          // `$${n}` is a numbered parameter; anything else is a piece of SQL built at run time.
          if (s.endsWith('$')) s += '1';
          else { s += `\u0000${expr}\u0000`; dynamic = true; }
          i = j;
          continue;
        }
        s += src[i++];
      }
      i++;
      out.push({ text: s, line: line(start), dynamic });
      continue;
    }
    i++;
  }
  return out;
}

const blank = (sql) => sql.replace(/\u0000[^\u0000]*\u0000/g, ' ');
const nullParams = (sql) => sql.replace(/\$\d+/g, 'NULL');
const TYPE_ERRORS = /could not determine|operator does not exist|is of type|cannot cast|inconsistent types|function .* does not exist|argument of|could not identify/i;

async function main() {
  const verbose = process.argv.includes('--verbose');
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'fayshaa',
    user: process.env.DB_USER || 'fayshaauser',
    password: process.env.DB_PASSWORD,
  });
  await client.connect();

  const failures = [];
  const dynamicSkipped = [];
  let checked = 0;

  const prepare = async (sql) => {
    await client.query('BEGIN');
    try {
      await client.query(`PREPARE chk AS ${sql}`);
      await client.query('DEALLOCATE chk');
      return null;
    } catch (e) {
      return e;
    } finally {
      await client.query('ROLLBACK');
    }
  };

  for (const file of SOURCES.flatMap(files)) {
    const rel = path.relative(ROOT, file);
    for (const lit of literals(fs.readFileSync(file, 'utf8'))) {
      if (!SQL_START.test(lit.text) || !/\b(FROM|INTO|SET|VALUES|SELECT\s+\S)/i.test(lit.text)) continue;
      // English sentences that happen to start with "Update" / "Select".
      if (!/\b(FROM|INTO|SET|RETURNING|VALUES|WHERE)\b/.test(lit.text) && !/^\s*SELECT\s+\d/i.test(lit.text)) continue;
      const sql = blank(lit.text).trim().replace(/;\s*$/, '');
      let err = await prepare(sql);
      // node-pg sends parameters untyped, exactly like this PREPARE, so a type error here happens in production
      // too. Only SQL built at run time gets a second try, since blanking its pieces can lose type context.
      if (err && lit.dynamic && TYPE_ERRORS.test(err.message)) err = await prepare(nullParams(sql));
      if (!err) { checked++; continue; }
      const schemaError = /does not exist|violates|ambiguous|inconsistent types|could not determine/i.test(err.message) && !/syntax error/i.test(err.message);
      // The first piece of a query completed later in code (`query += ' GROUP BY ...'`).
      const fragment = /must appear in the GROUP BY|syntax error at end of input/i.test(err.message);
      if ((lit.dynamic && !schemaError) || fragment) { dynamicSkipped.push({ rel, line: lit.line, msg: err.message }); continue; }
      failures.push({ rel, line: lit.line, msg: err.message, sql: sql.replace(/\s+/g, ' ').slice(0, 160) });
    }
  }
  await client.end();

  for (const f of failures) console.log(`FAIL ${f.rel}:${f.line}  ${f.msg}\n     ${f.sql}`);
  if (verbose) for (const d of dynamicSkipped) console.log(`DYN  ${d.rel}:${d.line}  ${d.msg}`);
  console.log(`\n${checked} statements OK, ${failures.length} failed, ${dynamicSkipped.length} built at run time (not checked)`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
