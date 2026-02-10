@echo off
echo ========================================
echo ComfyUI AMD GPU 安装脚本
echo ========================================
echo.

REM 创建ComfyUI目录
cd C:\StableDiffusion
if not exist ComfyUI (
    echo 正在克隆 ComfyUI...
    git clone https://github.com/comfyanonymous/ComfyUI.git
)

cd ComfyUI

echo.
echo 正在安装 PyTorch (AMD ROCm版本)...
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/rocm6.2

echo.
echo 正在安装 ComfyUI 依赖...
python -m pip install -r requirements.txt

echo.
echo ========================================
echo 安装完成！
echo ========================================
echo.
echo 启动 ComfyUI:
echo python main.py
echo.
echo 然后在浏览器打开: http://127.0.0.1:8188
echo.
pause
