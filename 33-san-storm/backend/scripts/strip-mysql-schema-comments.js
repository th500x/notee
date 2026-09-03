/**
 * Strip table / column COMMENT on a MySQL or MariaDB schema (e.g. legacy latin1 comments = mojibake).
 *
 * Usage (cwd: 33-san-storm/backend):
 *   node scripts/strip-mysql-schema-comments.js           # dry-run: print SQL only
 *   node scripts/strip-mysql-schema-comments.js --apply   # execute (transaction per table optional — here sequential)
 *
 * Env: same as server — .env DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME (default 05_san_storm).
 *
 * Skips: views, generated columns (VIRTUAL/ST STORED in EXTRA), and columns where SHOW FULL COLUMNS
 * cannot be interpreted safely (logged).
 *
 * Does NOT modify migration files or prod_schema.sql — only the connected database.
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

const APPLY = process.argv.includes('--apply');

function charsetFromCollation(collation) {
  if (!collation) return null;
  const s = String(collation);
  const i = s.indexOf('_');
  return i > 0 ? s.slice(0, i) : null;
}

function escapeSqlString(s) {
  return `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

function quoteIdent(name) {
  return `\`${String(name).replace(/`/g, '``')}\``;
}

function buildDefaultClause(type, def, extra) {
  const ex = String(extra || '').toUpperCase();
  if (ex.includes('GENERATED')) return '';
  if (ex.includes('AUTO_INCREMENT')) return '';
  if (def === undefined || def === null) return '';
  const t = String(type || '').toLowerCase();
  const ds = def;
  if (ds === null) return '';
  if (typeof ds === 'number' && Number.isFinite(ds)) {
    if (/^(tinyint|smallint|mediumint|int|bigint|decimal|numeric|float|double)/.test(t)) {
      return ` DEFAULT ${ds}`;
    }
  }
  const dstr = String(ds);
  if (dstr.toUpperCase() === 'NULL') return '';
  if (/^CURRENT_TIMESTAMP/i.test(dstr) || dstr.includes('CURRENT_TIMESTAMP')) {
    return ` DEFAULT ${dstr}`;
  }
  if (/^bit\b/i.test(t)) {
    return ` DEFAULT ${dstr}`;
  }
  if (/^(tinyint|smallint|mediumint|int|integer|bigint|decimal|numeric|float|double)/.test(t)) {
    return ` DEFAULT ${dstr}`;
  }
  if (/^(json|geometry)/.test(t)) {
    return ` DEFAULT (${dstr})`;
  }
  return ` DEFAULT ${escapeSqlString(dstr)}`;
}

function buildModifyFromShowFullRow(table, row) {
  const field = row.Field;
  const type = row.Type;
  const extra = String(row.Extra || '');
  if (/\bGENERATED\b/i.test(extra)) {
    return { skip: true, reason: 'generated column' };
  }

  const parts = [type];
  if (row.Collation) {
    const cs = charsetFromCollation(row.Collation);
    if (cs) {
      parts.push(`CHARACTER SET ${cs}`);
      parts.push(`COLLATE ${row.Collation}`);
    }
  }
  parts.push(row.Null === 'YES' ? 'NULL' : 'NOT NULL');
  if (!/DEFAULT_GENERATED/i.test(extra)) {
    const defPart = buildDefaultClause(type, row.Default, extra);
    if (defPart) parts.push(defPart.trim());
  }
  if (extra) parts.push(extra);
  parts.push("COMMENT ''");
  const defSql = parts.filter(Boolean).join(' ');
  return {
    skip: false,
    sql: `ALTER TABLE ${quoteIdent(table)} MODIFY COLUMN ${quoteIdent(field)} ${defSql};`,
  };
}

(async () => {
  const database = process.env.DB_NAME || '05_san_storm';
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database,
    multipleStatements: false,
  });

  try {
    const [tables] = await conn.query(
      `SELECT TABLE_NAME AS name, TABLE_COMMENT AS tblComment
         FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = ?
          AND TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME`,
      [database],
    );

    const statements = [];

    for (const t of tables) {
      const table = t.name;
      const tc = t.tblComment != null ? String(t.tblComment) : '';
      if (tc.length > 0) {
        statements.push(`ALTER TABLE ${quoteIdent(table)} COMMENT '';`);
      }

      const [cols] = await conn.query(`SHOW FULL COLUMNS FROM ${quoteIdent(table)}`);
      for (const row of cols) {
        const comment = row.Comment != null ? String(row.Comment) : '';
        if (!comment) continue;
        const built = buildModifyFromShowFullRow(table, row);
        if (built.skip) {
          console.error(`SKIP ${table}.${row.Field}: ${built.reason}`);
          continue;
        }
        statements.push(built.sql);
      }
    }

    if (!statements.length) {
      console.log('No table or column comments to strip.');
      process.exit(0);
    }

    console.log(`-- database=${database} statements=${statements.length} apply=${APPLY}`);
    for (const s of statements) {
      console.log(s);
    }

    if (!APPLY) {
      console.error('\nDry-run only. Re-run with --apply to execute.');
      process.exit(0);
    }

    for (const s of statements) {
      await conn.query(s);
    }
    console.error('OK: applied', statements.length, 'statements');
    process.exit(0);
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  } finally {
    await conn.end();
  }
})();
