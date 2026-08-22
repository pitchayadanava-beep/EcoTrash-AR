@echo off
title EcoTrash-AR Server (Local)
cd /d "%~dp0"
echo ====================================================
echo Starting EcoTrash-AR Local Server...
echo ====================================================
echo.
echo Opening browser at http://localhost:3000 ...
start http://localhost:3000
echo.
echo Server is running! Keep this window OPEN while playing.
echo To stop the server, simply close this window.
echo ====================================================
echo.
python server.py
pause
