@echo off
setlocal enabledelayedexpansion
echo ==========================================
echo       FlowManga - Native Launcher
echo ==========================================
echo.

:: Detect Cargo/Rust
where cargo >nul 2>&1
if !errorlevel! neq 0 (
    if exist "%USERPROFILE%\.cargo\bin\cargo.exe" (
        set "PATH=%PATH%;%USERPROFILE%\.cargo\bin"
    ) else (
        echo [X] Rust not found. Please install from https://rustup.rs/
        pause
        exit /b
    )
)

echo [1] Launch for Testing (Fast)
echo [2] Create Permanent Program (.exe)
echo.
set /p choice="Choose an option (1-2): "

if "%choice%"=="2" (
    echo.
    echo Building FlowManga.exe... This will take a few minutes.
    call npm run build
    echo.
    echo Done! You can find your program here:
    echo %~dp0src-tauri\target\release\app.exe
    start "" "%~dp0src-tauri\target\release\"
    pause
    exit /b
)

echo.
echo Launching...
call npm run dev
pause
