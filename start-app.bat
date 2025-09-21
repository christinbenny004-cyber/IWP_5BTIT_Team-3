@echo off
echo Starting Project Evaluation System...
echo.
echo 1. Starting XAMPP MySQL (if not running)...
net start mysql >nul 2>&1
if %errorlevel% neq 0 (
    echo    MySQL might already be running or XAMPP needs manual start
) else (
    echo    MySQL started successfully
)

echo.
echo 2. Starting Node.js server...
echo    This will automatically open your browser
echo.
npm start

pause
