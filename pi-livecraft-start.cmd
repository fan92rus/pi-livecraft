@echo off
setlocal
title Pi Livecraft (dev, LAN)
cd /d "%~dp0"
set PI_LIVECRAFT_HOST=0.0.0.0
set PI_LIVECRAFT_BACKEND_HOST=0.0.0.0
call npm run dev
endlocal
