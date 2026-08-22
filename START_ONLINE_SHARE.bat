@echo off
title EcoTrash-AR Online Tunnel Server
cd /d "%~dp0"
echo ====================================================
echo Starting EcoTrash-AR Local Server + Cloudflare Tunnel...
echo ====================================================
echo.

:: Start python server in a separate background window
start "EcoTrash-Python-Server" /B python server.py

echo Local Server started at http://localhost:3000
echo Creating secure Public HTTPS Tunnel for Mobile / AR...
echo ====================================================
echo.

:: Run Cloudflare Tunnel
"C:\Users\Student\.gemini\antigravity\scratch\bin\cloudflared.exe" tunnel --protocol http2 --url http://localhost:3000

pause
