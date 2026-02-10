@echo off
echo ========================================
echo ComfyUI Windows AMD GPU 安装脚本
echo 使用 DirectML 后端
echo ========================================
echo.

cd C:\StableDiffusion\ComfyUI

echo 正在安装 PyTorch (DirectML 版本 - Windows AMD GPU)...
python -m pip install torch torchvision torchaudio

echo.
echo 正在安装 torch-directml (AMD GPU 支持)...
python -m pip install torch-directml

echo.
echo 正在安装 ComfyUI 依赖...
python -m pip install -r requirements.txt

echo.
echo ========================================
echo 安装完成！
echo ========================================
echo.
echo 启动命令:
echo python main.py --directml
echo.
pause
