@echo off

REM 跳过Python版本检查，使用当前的Python 3.14
set PYTHON=
set GIT=
set VENV_DIR=

REM AMD GPU 优化参数
set COMMANDLINE_ARGS=--skip-python-version-check --skip-torch-cuda-test --precision full --no-half --opt-sub-quad-attention

REM AMD GPU 内存优化
set PYTORCH_HIP_ALLOC_CONF=garbage_collection_threshold:0.8,max_split_size_mb:512

REM 调用原始启动脚本
call webui.bat
