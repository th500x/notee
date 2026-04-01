#!/usr/bin/env bash
# 在「只部署、不提交」的服务器上拉代码：先丢弃对 lock 文件的本地改动，再 pull。
# 用法（在仓库根目录 notee/ 下）: bash 05-san-storm/scripts/safe-git-pull.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "[safe-git-pull] repo: $ROOT"

# 服务器上不应手改 lock；若曾运行过会改 lock 的 npm 命令，先还原再 pull
for f in \
  "05-san-storm/backend/package-lock.json" \
  "05-san-storm/game/package-lock.json"
do
  if git rev-parse --git-dir >/dev/null 2>&1; then
    git checkout -- "$f" 2>/dev/null || true
  fi
done

git pull --ff-only

echo "[safe-git-pull] done. 安装依赖请用: (backend) npm ci   (game) npm ci"
echo "  cd 05-san-storm/backend && npm ci"
echo "  cd 05-san-storm/game && npm ci"
