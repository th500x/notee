@echo off
echo ========================================
echo 租赁追踪系统 - 启动脚本
echo ========================================
echo.

echo [1/2] 启动后端服务...
cd backend
start "租赁追踪-后端" cmd /k "npm start"
echo 后端服务启动中... (端口: 3002)
echo.

timeout /t 3 /nobreak >nul

echo [2/2] 启动前端服务...
cd ..\06-rental-tracking
start "租赁追踪-前端" cmd /k "npm run dev"
echo 前端服务启动中... (端口: 5176)
echo.

echo ========================================
echo 启动完成！
echo ========================================
echo.
echo 后端服务: http://localhost:3002
echo 前端服务: http://localhost:5176
echo.
echo 管理员密码: notee.vip.2026
echo.
echo 按任意键关闭此窗口...
pause >nul
