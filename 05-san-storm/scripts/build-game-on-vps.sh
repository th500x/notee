#!/usr/bin/env bash
# 在 VPS 上更安全地构建 game 前端：预检内存 → 可选暂停 PM2 → build:vps → 恢复 PM2
# 用法（在 05-san-storm 根目录）：
#   bash scripts/build-game-on-vps.sh
#   bash scripts/build-game-on-vps.sh --no-pm2-stop
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STOP_PM2=1
for arg in "$@"; do
  if [[ "$arg" == "--no-pm2-stop" ]]; then STOP_PM2=0; fi
done

echo "[build-game-on-vps] 工作目录: $ROOT"

if [[ -r /proc/meminfo ]]; then
  avail_kb="$(awk '/MemAvailable:/ {print $2}' /proc/meminfo)"
  avail_mb=$((avail_kb / 1024))
  echo "[build-game-on-vps] MemAvailable: ${avail_mb}MB"
  if (( avail_mb < 700 )); then
    echo "[build-game-on-vps] 可用内存偏低；建议: fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile"
  fi
fi

PM2_WAS=
if [[ "$STOP_PM2" -eq 1 ]] && command -v pm2 >/dev/null 2>&1; then
  if pm2 jlist 2>/dev/null | grep -q '"name"'; then
    echo "[build-game-on-vps] 暂停 pm2 进程以释放内存…"
    PM2_WAS=1
    pm2 stop all || true
  fi
fi

cleanup() {
  if [[ -n "${PM2_WAS:-}" ]]; then
    echo "[build-game-on-vps] 恢复 pm2…"
    pm2 start all || true
  fi
}
trap cleanup EXIT

export VPS_BUILD_PARALLEL="${VPS_BUILD_PARALLEL:-1}"
export UV_THREADPOOL_SIZE="${UV_THREADPOOL_SIZE:-1}"
npm run build:vps

echo "[build-game-on-vps] 构建成功"
