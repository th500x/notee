/**
 * 配置型 JSON → MySQL 导入：删除 JSON 中已不存在的库内行（与 CSV 单源一致）
 *
 * 策略：
 * - 有 season 列：仅清理 JSON 出现过的 season 范围内、且 id 不在 JSON 的行
 * - 无 season（称号/成就等）：按 JSON id 推导 san_* 前缀族（如 san_1_achi_%）限定范围
 */

/** @param {string} id */
function extractSeasonFromId(id) {
  const m = String(id || '').match(/^(san_\d+)/);
  return m ? m[1] : null;
}

/**
 * @param {object[]} items
 * @param {{ idKey?: string, seasonKey?: string, idGetter?: (row: object) => string|null }} [opts]
 * @returns {string[]}
 */
function collectSeasonScopesFromItems(items, opts = {}) {
  const idKey = opts.idKey || 'id';
  const seasonKey = opts.seasonKey || 'season';
  const seasons = new Set();
  for (const row of items || []) {
    const id = opts.idGetter ? opts.idGetter(row) : row[idKey];
    const season =
      (row[seasonKey] != null && String(row[seasonKey]).trim()) || extractSeasonFromId(id);
    if (season) seasons.add(String(season).trim());
  }
  return [...seasons];
}

/**
 * @param {string[]} jsonIds
 * @returns {string[]} SQL LIKE 模式，如 san_1_achi_%
 */
function deriveIdLikePatternsFromIds(jsonIds) {
  const prefixes = new Set();
  for (const raw of jsonIds || []) {
    const id = String(raw || '').trim();
    if (!id) continue;
    const m = id.match(/^(san_\d+_[a-z_]+?)_/i);
    if (m) {
      prefixes.add(`${m[1]}_%`);
      continue;
    }
    const head = id.replace(/_\d+$/, '');
    if (head && head !== id) prefixes.add(`${head}_%`);
  }
  return [...prefixes];
}

/**
 * san_* 族匹配不到时，用 JSON id 最长公共前缀（至最后一个 _）推导 LIKE，如 item_%
 * @param {string[]} jsonIds
 * @returns {string[]}
 */
function deriveCatalogLikePattern(jsonIds) {
  const ids = (jsonIds || []).map((x) => String(x || '').trim()).filter(Boolean);
  if (!ids.length) return [];
  const first = ids[0];
  let prefix = '';
  for (let i = 0; i < first.length; i++) {
    const ch = first[i];
    if (!ids.every((id) => id[i] === ch)) break;
    prefix += ch;
  }
  const lastUnderscore = prefix.lastIndexOf('_');
  if (lastUnderscore > 0) {
    return [`${prefix.slice(0, lastUnderscore + 1)}%`];
  }
  return [];
}

function resolveIdLikePatterns(jsonIds) {
  const fromSan = deriveIdLikePatternsFromIds(jsonIds);
  if (fromSan.length) return fromSan;
  return deriveCatalogLikePattern(jsonIds);
}

/**
 * @param {import('mysql2/promise').Connection} connection
 * @param {{
 *   table: string,
 *   idColumn: string,
 *   jsonIds: string[],
 *   label?: string,
 *   scopeColumn?: string|null,
 *   scopeValues?: string[]|null,
 *   idLikePatterns?: string[]|null,
 * }} options
 * @returns {Promise<number>}
 */
async function purgeStaleConfigRows(connection, options) {
  const {
    table,
    idColumn,
    jsonIds,
    label = table,
    scopeColumn = null,
    scopeValues = null,
    idLikePatterns = null,
  } = options;

  const ids = (jsonIds || []).map((x) => String(x || '').trim()).filter(Boolean);
  if (!ids.length) {
    console.warn(`[purge] ${label}: JSON 无有效 id，跳过过期行清理`);
    return 0;
  }

  const jsonIdSet = new Set(ids);
  const conditions = [];
  const params = [];

  if (scopeColumn && scopeValues?.length) {
    conditions.push(`${scopeColumn} IN (${scopeValues.map(() => '?').join(', ')})`);
    params.push(...scopeValues);
  }

  const patterns = idLikePatterns?.length ? idLikePatterns : null;
  if (patterns?.length) {
    conditions.push(`(${patterns.map(() => `${idColumn} LIKE ?`).join(' OR ')})`);
    params.push(...patterns);
  }

  if (!scopeColumn && !patterns?.length) {
    console.warn(`[purge] ${label}: 无 season / id 前缀范围，跳过删除（防误伤）`);
    return 0;
  }

  let sql = `SELECT ${idColumn} AS rid FROM ${table}`;
  if (conditions.length) sql += ` WHERE ${conditions.join(' AND ')}`;

  const [rows] = await connection.query(sql, params);
  const stale = rows.map((r) => r.rid).filter((id) => !jsonIdSet.has(id));
  if (!stale.length) return 0;

  const ph = stale.map(() => '?').join(', ');
  const [del] = await connection.query(
    `DELETE FROM ${table} WHERE ${idColumn} IN (${ph})`,
    stale,
  );
  console.log(`🗑️ ${label}: 移除 JSON 中已不存在的配置 ${del.affectedRows} 条`);
  return del.affectedRows;
}

/**
 * @param {import('mysql2/promise').Connection} connection
 * @param {{
 *   table: string,
 *   idColumn: string,
 *   jsonIds: string[],
 *   label?: string,
 *   scopeColumn?: string,
 *   scopeValues?: string[],
 *   extraWhere?: string,
 * }} options extraWhere 追加 AND（不含 WHERE），如 `lord_player_id IS NULL`
 */
async function purgeStaleConfigRowsWithExtraWhere(connection, options) {
  const {
    table,
    idColumn,
    jsonIds,
    label = table,
    scopeColumn,
    scopeValues,
    extraWhere = '',
  } = options;

  const ids = (jsonIds || []).map((x) => String(x || '').trim()).filter(Boolean);
  if (!ids.length || !scopeColumn || !scopeValues?.length) {
    return purgeStaleConfigRows(connection, options);
  }

  const jsonIdSet = new Set(ids);
  const params = [...scopeValues];
  let sql = `SELECT ${idColumn} AS rid FROM ${table} WHERE ${scopeColumn} IN (${scopeValues.map(() => '?').join(', ')})`;
  if (extraWhere) sql += ` AND (${extraWhere})`;

  const [rows] = await connection.query(sql, params);
  const stale = rows.map((r) => r.rid).filter((id) => !jsonIdSet.has(id));
  if (!stale.length) return 0;

  const ph = stale.map(() => '?').join(', ');
  const [del] = await connection.query(
    `DELETE FROM ${table} WHERE ${idColumn} IN (${ph})`,
    stale,
  );
  console.log(`🗑️ ${label}: 移除 JSON 中已不存在的配置 ${del.affectedRows} 条`);
  return del.affectedRows;
}

/**
 * @param {import('mysql2/promise').Connection} connection
 * @param {object[]} items
 * @param {string} idKey
 * @param {{
 *   table: string,
 *   idColumn: string,
 *   label?: string,
 *   scopeColumn?: string|null,
 *   seasonKey?: string,
 *   idGetter?: (row: object) => string|null,
 *   useIdLikeWhenNoSeason?: boolean,
 * }} spec
 */
async function purgeAfterConfigImport(connection, items, idKey, spec) {
  const jsonIds = (items || [])
    .map((row) => (spec.idGetter ? spec.idGetter(row) : row[idKey]))
    .filter(Boolean);
  const scopeValues = spec.scopeColumn
    ? collectSeasonScopesFromItems(items, {
        idKey,
        seasonKey: spec.seasonKey || 'season',
        idGetter: spec.idGetter,
      })
    : null;

  let idLikePatterns = spec.idLikePatterns ?? null;
  if (!idLikePatterns && spec.scopeColumn && scopeValues?.length) {
    idLikePatterns = null;
  } else if (!idLikePatterns && spec.useIdLikeWhenNoSeason !== false) {
    idLikePatterns = resolveIdLikePatterns(jsonIds);
  }

  return purgeStaleConfigRows(connection, {
    table: spec.table,
    idColumn: spec.idColumn,
    jsonIds,
    label: spec.label || spec.table,
    scopeColumn: scopeValues?.length ? spec.scopeColumn : null,
    scopeValues: scopeValues?.length ? scopeValues : null,
    idLikePatterns,
  });
}

module.exports = {
  extractSeasonFromId,
  collectSeasonScopesFromItems,
  deriveIdLikePatternsFromIds,
  deriveCatalogLikePattern,
  resolveIdLikePatterns,
  purgeStaleConfigRows,
  purgeStaleConfigRowsWithExtraWhere,
  purgeAfterConfigImport,
};
