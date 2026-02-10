# 修复 Stable Diffusion 安装问题

## 问题诊断

1. ❌ Python 3.14.2 版本过新（需要 3.11.x）
2. ❌ Torch 安装失败（AMD GPU 支持问题）

---

## 解决方案

### 方法1：使用 Python 3.11（推荐）

#### 步骤1：下载并安装 Python 3.11.9

1. 访问: https://www.python.org/downloads/release/python-3119/
2. 下载 "Windows installer (64-bit)"
3. 安装时：
   - ✅ 勾选 "Add Python 3.11 to PATH"
   - ✅ 选择 "Customize installation"
   - ✅ 勾选 "Install for all users"
   - 安装路径建议: `C:\Python311`

#### 步骤2：修改 webui-user.bat

在 `C:\StableDiffusion\stable-diffusion-webui-amdgpu\` 目录下：

1. 右键编辑 `webui-user.bat`
2. 在文件开头添加：

```batch
@echo off
set PYTHON=C:\Python311\python.exe
set COMMANDLINE_ARGS=--skip-python-version-check --precision full --no-half
set PYTORCH_HIP_ALLOC_CONF=garbage_collection_threshold:0.8,max_split_size_mb:512
```

3. 保存文件

#### 步骤3：清理并重新运行

```cmd
cd C:\StableDiffusion\stable-diffusion-webui-amdgpu
rmdir /s /q venv
webui-user.bat
```

---

### 方法2：跳过版本检查（快速测试）

如果不想重装Python，可以尝试：

#### 修改 webui-user.bat

```batch
@echo off
set COMMANDLINE_ARGS=--skip-python-version-check --skip-torch-cuda-test --precision full --no-half
set PYTORCH_HIP_ALLOC_CONF=garbage_collection_threshold:0.8,max_split_size_mb:512
```

然后重新运行：
```cmd
webui-user.bat
```

---

### 方法3：使用 ComfyUI（更简单的替代方案）

ComfyUI 对 AMD GPU 支持更好，安装更简单：

```cmd
cd C:\StableDiffusion
git clone https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/rocm6.0
python -m pip install -r requirements.txt
python main.py
```

---

## 推荐方案

**我建议先尝试方法2（跳过版本检查）**，因为：
- 最快速
- Python 3.14 可能也能工作
- 如果失败，再用方法1

---

## 执行步骤

1. 关闭当前的命令提示符窗口
2. 找到 `C:\StableDiffusion\stable-diffusion-webui-amdgpu\webui-user.bat`
3. 右键 → 编辑
4. 添加我提供的配置
5. 保存并重新运行

需要我帮你创建修改后的 bat 文件吗？
