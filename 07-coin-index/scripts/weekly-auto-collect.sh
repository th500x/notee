#!/usr/bin/env bash
# 曼谷机 systemd 定时器 notee-07-weekly.timer 每周一 UTC 00:05 调用。
# 拉主干 → 补采所有缺数据的周 → 数据有变化就构建、提交并推送到 GitHub。
# 采集失败也会先把已采到的周提交，最后仍以失败退出，让 systemd 记为失败并按小时重试。
set -uo pipefail

REPO=/www/wwwroot/notee
APP="$REPO/07-coin-index"
DEPLOY_KEY=/root/.ssh/notee_deploy
PUSH_URL=git@github.com:th500x/notee.git
DATA_FILES=(
  public/weeklyData.json
  public/weeklyData.meta.json
  src/data/weeklyData.json
  src/data/weeklyData.meta.json
)

cd "$REPO" || exit 1
if ! git pull --ff-only origin main; then
  echo "git pull 失败，本轮未采集" >&2
  exit 1
fi

cd "$APP" || exit 1
node scripts/collectMissingWeeks.js
collect_status=$?

if git diff --quiet -- "${DATA_FILES[@]}"; then
  echo "周数据无变化"
  exit "$collect_status"
fi

npm run build || exit 1

git add -- "${DATA_FILES[@]}" || exit 1
git -c user.name="notee-bkk" -c user.email="notee-bkk@users.noreply.github.com" \
  commit -m "data(07): weekly auto-collect $(date -u +%Y-%m-%d)" || exit 1

if ! GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" \
  git push "$PUSH_URL" HEAD:main; then
  echo "git push 失败，数据已提交在服务器本地，下次运行前须先处理" >&2
  exit 1
fi
git fetch -q origin main

exit "$collect_status"
