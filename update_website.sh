#!/usr/bin/env bash

# Zhang Lab website — safe one-command publisher
# Usage:
#   bash update_website.sh
#   bash update_website.sh "Describe this update"

set -Eeuo pipefail

trap 'echo ""; echo "✗ 操作在第 ${LINENO} 行失败；提交或推送可能尚未完成。" >&2' ERR

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================"
echo "安全更新 Zhang Lab 网站"
echo "========================================"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "✗ 当前目录不是 Git 仓库：$SCRIPT_DIR" >&2
    exit 1
fi

branch="$(git branch --show-current)"
if [[ "$branch" != "main" ]]; then
    echo "✗ 当前分支是 '$branch'，安全脚本只允许从 main 分支发布。" >&2
    exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
    echo "✗ 未找到 origin 远程仓库。" >&2
    exit 1
fi

remote_url="$(git remote get-url origin)"
if [[ "$remote_url" != *"WeiTH20220896/zhanglab-website"* ]]; then
    echo "✗ origin 不是预期的网站仓库：$remote_url" >&2
    exit 1
fi

# Refuse to mix unknown pre-staged changes into this website deployment.
if ! git diff --cached --quiet; then
    echo "✗ 暂存区已有内容。为避免混入未知文件，本次发布已停止。" >&2
    echo "请先检查：git diff --cached --name-status" >&2
    exit 1
fi

required_files=(
    "index.html"
    "cn/index.html"
    "css/style.css"
    "js/script.js"
    "js/gpcr-animation.js"
    "images/Structure.png"
    "images/dreadd.png"
    "images/VS.jpg"
    "images/graduation-2026.jpg"
    "Zhang/Photo.jpg"
)

for file in "${required_files[@]}"; do
    if [[ ! -f "$file" ]]; then
        echo "✗ 网站必需文件缺失：$file" >&2
        exit 1
    fi
done

# Explicit allowlist. Source-data folders, personal documents, tokens and
# unrelated raw images are intentionally excluded.
shopt -s nullglob
allowlist=(
    ".gitignore"
    "index.html"
    "cn/index.html"
    "css/style.css"
    "js/script.js"
    "js/gpcr-animation.js"
    "update_website.sh"
    "images/Structure.png"
    "images/dreadd.png"
    "images/VS.jpg"
    "images/gpcr.png"
    "images/graduation-2026.jpg"
    "images/年终聚餐2.3.jpg"
    pages/*.html
    cn/pages/*.html
    Members/*-Photo.*
    "Zhang/Photo.jpg"
)
shopt -u nullglob

git add -- "${allowlist[@]}"

if git diff --cached --quiet; then
    echo "✓ 白名单内没有需要发布的新改动。"
    exit 0
fi

mapfile -d '' staged_files < <(git diff --cached --name-only -z)

abort_after_stage() {
    local message="$1"
    echo "✗ $message" >&2
    git restore --staged -- "${staged_files[@]}" >/dev/null 2>&1 || true
    echo "本次脚本添加的暂存内容已自动撤销。" >&2
    exit 1
}

echo ""
echo "即将提交以下文件："
git diff --cached --name-status
echo ""

# Filename audit: reject common credential and private-document patterns even
# if one is accidentally added to the allowlist in the future.
for file in "${staged_files[@]}"; do
    lower_file="$(printf '%s' "$file" | tr '[:upper:]' '[:lower:]')"
    case "$lower_file" in
        *token*|*secret*|*.env|*.env.*|*.pem|*.key|github*|members/*.txt|members/*.docx)
            abort_after_stage "检测到疑似敏感文件，停止发布：$file"
            ;;
    esac

    if [[ -f "$file" ]]; then
        file_size="$(wc -c < "$file" | tr -d ' ')"
        if (( file_size > 50 * 1024 * 1024 )); then
            abort_after_stage "文件超过安全上限 50 MB，停止发布：$file"
        fi
    fi
done

# Content audit for common GitHub credential formats.
if git diff --cached --no-ext-diff -- . | grep -Eiq \
    'github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}'; then
    abort_after_stage "暂存内容中检测到疑似 GitHub Token，停止发布。"
fi

if ! git diff --cached --check; then
    abort_after_stage "暂存内容未通过 Git 差异检查，停止发布。"
fi

commit_msg="${*:-Update Zhang Lab website}"

echo "安全检查通过，正在提交……"
git commit -m "$commit_msg"

echo ""
echo "正在推送到 origin/main……"
git push origin main

echo ""
echo "========================================"
echo "✓ 发布完成"
echo "GitHub Pages 通常会在 1–3 分钟内更新："
echo "https://weith20220896.github.io/zhanglab-website/"
echo "========================================"

if [[ -n "$(git status --short)" ]]; then
    echo ""
    echo "以下本地文件未被发布（这是安全白名单的预期行为）："
    git status --short
fi
