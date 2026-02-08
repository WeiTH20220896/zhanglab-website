#!/bin/bash
echo "========================================"
echo "更新 Zhang Lab 网站"
echo "========================================"
echo ""

# 检查是否有修改
if [[ -z $(git status -s) ]]; then
    echo "✓ 没有需要更新的内容"
    exit 0
fi

# 显示修改的文件
echo "修改的文件："
git status --short
echo ""

# 询问提交信息
read -p "请输入更新说明 (直接回车使用默认): " commit_msg
if [ -z "$commit_msg" ]; then
    commit_msg="Update website content"
fi

# 提交并推送
echo ""
echo "正在提交更改..."
git add .
git commit -m "$commit_msg"

echo ""
echo "正在推送到GitHub..."
git push

echo ""
echo "========================================"
echo "✓ 更新完成！"
echo "等待1-2分钟后访问："
echo "https://weith20220896.github.io/zhanglab-website/"
echo "========================================"
