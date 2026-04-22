@echo off
chcp 65001 >nul
echo ========================================
echo 初始化 06-rental-tracking 数据库
echo ========================================
echo.

echo [1] 连接到MySQL...
echo 请输入MySQL root密码（XAMPP默认为空，直接回车）
echo.

C:\xampp\mysql\bin\mysql -u root -p < schema.sql

if %errorlevel% == 0 (
    echo.
    echo ========================================
    echo ✅ 数据库初始化成功！
    echo ========================================
    echo.
    echo 数据库名: 06_rental_tracking
    echo 表名: projects
    echo.
    echo 下一步：
    echo 1. 安装依赖: cd .. ^&^& npm install mysql2
    echo 2. 配置 .env 文件
    echo 3. 运行迁移脚本
    echo.
) else (
    echo.
    echo ========================================
    echo ❌ 数据库初始化失败
    echo ========================================
    echo.
    echo 可能的原因：
    echo 1. MySQL未启动
    echo 2. 密码错误
    echo 3. 权限不足
    echo.
    echo 请检查后重试。
    echo.
)

pause
