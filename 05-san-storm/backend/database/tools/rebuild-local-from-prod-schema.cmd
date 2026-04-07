@echo off
chcp 65001 >nul
setlocal
REM 从仓库根目录 prod_schema.sql 清空并重建本地库 05_san_storm（仅结构）
REM 优先使用 XAMPP 自带 mysql；默认 root 无密码（与 XAMPP 一致）。若 root 有密码，请在本文件中为 mysql 命令加上 -p

set "TOOLS=%~dp0"
set "REPO_ROOT=%TOOLS%..\..\.."
cd /d "%REPO_ROOT%"
set "SCHEMA=%REPO_ROOT%\prod_schema.sql"
set "PREAMBLE=%TOOLS%rebuild-local-preamble.sql"

if exist "C:\xampp\mysql\bin\mysql.exe" (
  set "MYSQL=C:\xampp\mysql\bin\mysql.exe"
) else (
  set "MYSQL=mysql"
)

if not exist "%SCHEMA%" (
  echo [错误] 找不到 prod_schema.sql: %SCHEMA%
  exit /b 1
)

echo 将删除并重建数据库 05_san_storm ^(无备份^)，按任意键继续...
pause >nul

echo.
echo [1/2] DROP + CREATE DATABASE ...
"%MYSQL%" -h 127.0.0.1 -P 3306 -u root < "%PREAMBLE%"
if errorlevel 1 (
  echo [错误] 建库失败。若 root 有密码，请编辑本脚本在 mysql 后增加 -p
  exit /b 1
)

echo.
echo [2/2] 导入 prod_schema.sql ...
"%MYSQL%" -h 127.0.0.1 -P 3306 -u root 05_san_storm < "%SCHEMA%"
if errorlevel 1 (
  echo [错误] 导入失败。
  exit /b 1
)

echo.
echo 完成。请确认 backend\.env 中 DB_NAME=05_san_storm。
endlocal
