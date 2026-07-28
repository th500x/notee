/**
 * 章节节点图布局：左→右主链 + 上方支线（对齐策划草图）
 */

/**
 * @typedef {{
 *   nodeId: string,
 *   sortOrder?: number,
 *   nextNodeId?: string|null,
 *   nextNodeIds?: string[],
 * }} ChapterNodeLike
 */

/**
 * @param {ChapterNodeLike[]} nodes
 * @returns {{
 *   positions: Map<string, { col: number, row: number }>,
 *   edges: Array<{ from: string, to: string, branch: boolean }>,
 *   cols: number,
 *   rows: number,
 * }}
 */
export function layoutChapterNodeGraph(nodes) {
  const list = Array.isArray(nodes) ? nodes : [];
  const byId = new Map(list.map((n) => [n.nodeId, n]));
  const edges = [];

  for (const n of list) {
    const primary = n.nextNodeId ? String(n.nextNodeId).trim() : '';
    if (primary && byId.has(primary)) {
      edges.push({ from: n.nodeId, to: primary, branch: false });
    }
    const extras = Array.isArray(n.nextNodeIds) ? n.nextNodeIds : [];
    for (const raw of extras) {
      const to = String(raw || '').trim();
      if (!to || !byId.has(to) || to === primary) continue;
      edges.push({ from: n.nodeId, to, branch: true });
    }
  }

  /** 主链：沿 nextNodeId 走；支线节点抬到 row=0 */
  const onMain = new Set();
  const roots = list
    .filter((n) => {
      const preds = edges.filter((e) => e.to === n.nodeId);
      return preds.length === 0;
    })
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const start = roots[0] || list.slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))[0];
  if (start) {
    let cur = start.nodeId;
    const guard = new Set();
    while (cur && !guard.has(cur)) {
      guard.add(cur);
      onMain.add(cur);
      const n = byId.get(cur);
      const next = n?.nextNodeId ? String(n.nextNodeId).trim() : '';
      cur = next && byId.has(next) ? next : '';
    }
  }
  for (const n of list) {
    if (!onMain.has(n.nodeId)) {
      // 无显式支线边、仅线性时仍算主链
      const onlyLinear = edges.every((e) => !e.branch);
      if (onlyLinear) onMain.add(n.nodeId);
    }
  }

  /** 列：拓扑深度，同深按 sortOrder */
  const depth = new Map();
  const indeg = new Map(list.map((n) => [n.nodeId, 0]));
  for (const e of edges) indeg.set(e.to, (indeg.get(e.to) || 0) + 1);
  const q = list
    .filter((n) => (indeg.get(n.nodeId) || 0) === 0)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map((n) => n.nodeId);
  for (const id of q) depth.set(id, 0);
  const queue = [...q];
  while (queue.length) {
    const id = queue.shift();
    const d = depth.get(id) || 0;
    for (const e of edges.filter((x) => x.from === id)) {
      const nd = Math.max(depth.get(e.to) || 0, d + 1);
      depth.set(e.to, nd);
      indeg.set(e.to, (indeg.get(e.to) || 1) - 1);
      if (indeg.get(e.to) === 0) queue.push(e.to);
    }
  }
  for (const n of list) {
    if (!depth.has(n.nodeId)) depth.set(n.nodeId, Math.max(0, (n.sortOrder || 1) - 1));
  }

  const positions = new Map();
  let maxCol = 0;
  for (const n of list) {
    const col = depth.get(n.nodeId) || 0;
    const row = onMain.has(n.nodeId) ? 1 : 0;
    positions.set(n.nodeId, { col, row });
    if (col > maxCol) maxCol = col;
  }

  return {
    positions,
    edges,
    cols: maxCol + 1,
    rows: list.some((n) => !onMain.has(n.nodeId)) ? 2 : 1,
  };
}

/** 节点盒短标题：notes 首段或 nodeId */
export function chapterNodeShortLabel(node) {
  const notes = String(node?.notes || '').trim();
  if (notes) {
    const head = notes.split(/[；;·]/)[0].trim();
    if (head) return head.length > 8 ? `${head.slice(0, 8)}…` : head;
  }
  const type = node?.nodeType === 'battle' ? '战' : '剧';
  return `${type}${node?.sortOrder ?? ''}`;
}
