@echo off
chcp 65001 >nul
echo ========================================
echo 真三风云 - 数据库初始化
echo ========================================
echo.

REM 从.env文件读取配置
for /f "tokens=1,2 delims==" %%a in ('type .env ^| findstr /v "^#"') do (
    if "%%a"=="DB_HOST" set DB_HOST=%%b
    if "%%a"=="DB_PORT" set DB_PORT=%%b
    if "%%a"=="DB_USER" set DB_USER=%%b
    if "%%a"=="DB_PASSWORD" set DB_PASSWORD=%%b
    if "%%a"=="DB_NAME" set DB_NAME=%%b
)

REM 设置默认值
if not defined DB_HOST set DB_HOST=localhost
if not defined DB_PORT set DB_PORT=3306
if not defined DB_USER set DB_USER=root
if not defined DB_NAME set DB_NAME=san_storm_game

echo 📍 数据库配置:
echo    主机: %DB_HOST%:%DB_PORT%
echo    用户: %DB_USER%
echo    数据库: %DB_NAME%
echo.

REM 执行SQL脚本
echo 🔧 正在执行数据库初始化脚本...
mysql -h %DB_HOST% -P %DB_PORT% -u %DB_USER% -p%DB_PASSWORD% < database\schema.sql

if %errorlevel% equ 0 (
    echo.
    echo ✅ 数据库初始化成功！
    echo.
    echo 已创建的表:
    echo   - accounts  ^(账号表^)
    echo   - players   ^(玩家角色表^)
    echo.
) else (
    echo.
    echo ❌ 数据库初始化失败！
    echo 请检查:
    echo   1. MySQL服务是否启动
    echo   2. .env配置是否正确
    echo   3. 用户权限是否足够
    echo.
)

pause
