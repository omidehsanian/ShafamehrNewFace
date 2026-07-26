@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul

if not exist "main_web.py" (
    echo [خطا] فایل main_web.py در این پوشه پیدا نشد.
    pause
    exit /b 1
)

where pythonw >nul 2>&1
if errorlevel 1 (
    where python >nul 2>&1
    if errorlevel 1 (
        echo [خطا] پایتون پیدا نشد یا در PATH ثبت نشده است.
        pause
        exit /b 1
    )
    start "" python "%~dp0main_web.py"
) else (
    start "" pythonw "%~dp0main_web.py"
)
