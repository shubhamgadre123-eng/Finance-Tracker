@echo off
setlocal enabledelayedexpansion

echo.
echo ==================================================
echo    Finance Tracker - Startup Script
echo ==================================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if errorlevel 1 (
    echo ❌ Error: Node.js is not installed!
    echo.
    echo Please download and install Node.js from:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo ✅ Node.js found: %NODEJS_PATH%

REM Get current directory
set PROJECT_DIR=%~dp0

echo ✅ Project directory: %PROJECT_DIR%
echo.

REM Check if node_modules exists
if not exist "%PROJECT_DIR%node_modules" (
    echo 📦 Installing dependencies...
    echo.
    cd /d "%PROJECT_DIR%"
    call npm install
    if errorlevel 1 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
    echo ✅ Dependencies installed successfully
    echo.
) else (
    echo ✅ Dependencies already installed
    echo.
)

REM Check if backend.js exists
if not exist "%PROJECT_DIR%backend.js" (
    echo ❌ Error: backend.js not found!
    echo Expected location: %PROJECT_DIR%backend.js
    pause
    exit /b 1
)

echo ✅ backend.js found
echo.
echo 🚀 Starting Finance Tracker Backend...
echo.
echo ==================================================

REM Start the backend server
cd /d "%PROJECT_DIR%"
node backend.js

if errorlevel 1 (
    echo ❌ Backend server failed to start
    pause
    exit /b 1
)

pause
