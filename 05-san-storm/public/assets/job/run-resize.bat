@echo off
chcp 65001 >nul
echo ========================================
echo PNG图片批量缩放到64x64
echo ========================================
echo.

REM 检查Python是否安装
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误：未找到Python！
    echo 请先安装Python: https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)

REM 检查Pillow是否安装
python -c "import PIL" >nul 2>&1
if %errorlevel% neq 0 (
    echo 正在安装Pillow库...
    pip install Pillow
    echo.
)

REM 运行脚本
python "%~dp0resize-png.py"

pause
