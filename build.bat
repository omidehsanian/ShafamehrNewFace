@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul
echo ========================================
echo   ساخت فایل اجرایی نسخه وب‌محور
echo ========================================
echo.

if not exist "main_web.py" (
    echo [خطا] فایل main_web.py در این پوشه پیدا نشد.
    pause
    exit /b 1
)

echo [بررسی] چک کردن نصب بودن پایتون...
python --version
if errorlevel 1 (
    echo [خطا] پایتون پیدا نشد یا در PATH ثبت نشده است.
    echo لطفاً از https://www.python.org/downloads/windows/ نصب کنید.
    pause
    exit /b 1
)

echo.
echo [1/3] نصب وابستگی‌ها...
python -m pip install --upgrade pip
python -m pip install pywebview openpyxl Pillow cryptography pyinstaller
if errorlevel 1 (
    echo [خطا] نصب کتابخانه‌ها با مشکل مواجه شد.
    pause
    exit /b 1
)

echo.
echo [2/3] در حال ساخت فایل exe (ممکن است چند دقیقه طول بکشد)...
python -m PyInstaller --onefile --windowed --name PhysioApp --clean ^
    --add-data "web;web" ^
    --paths "backend" ^
    --icon "icon.ico" ^
    main_web.py
if errorlevel 1 (
    echo [خطا] ساخت exe با مشکل مواجه شد.
    pause
    exit /b 1
)

echo.
echo [3/3] کپی فایل‌های جانبی کنار exe...
copy /Y icon.ico dist\icon.ico >nul

echo.
if exist "dist\PhysioApp.exe" (
    echo ========================================
    echo   تمام شد! فایل exe در پوشه dist ساخته شد.
    echo ========================================
) else (
    echo [هشدار] فایل exe پیدا نشد، پیام‌های بالا را بررسی کنید.
)
echo.
pause
