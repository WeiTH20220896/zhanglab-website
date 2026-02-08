#!/bin/bash

# Zhang Lab Website 启动脚本

echo "========================================="
echo "  Zhang Lab Website"
echo "  GPCR Neuropharmacology Research"
echo "========================================="
echo ""

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# 检查index.html是否存在
if [ ! -f "$SCRIPT_DIR/index.html" ]; then
    echo "错误: 找不到 index.html 文件"
    exit 1
fi

echo "选择启动方式:"
echo ""
echo "1. 使用默认浏览器直接打开"
echo "2. 启动本地服务器 (http://localhost:8000)"
echo ""
read -p "请输入选项 (1 或 2): " choice

case $choice in
    1)
        echo ""
        echo "正在使用默认浏览器打开网站..."
        xdg-open "$SCRIPT_DIR/index.html" 2>/dev/null || open "$SCRIPT_DIR/index.html" 2>/dev/null || start "$SCRIPT_DIR/index.html" 2>/dev/null
        echo "完成!"
        ;;
    2)
        echo ""
        echo "正在启动本地服务器..."
        echo "网站地址: http://localhost:8000"
        echo ""
        echo "按 Ctrl+C 停止服务器"
        echo ""
        cd "$SCRIPT_DIR"
        python3 -m http.server 8000
        ;;
    *)
        echo "无效的选项"
        exit 1
        ;;
esac
