@echo off
chcp 65001 >nul
title bak7580 Local Server
cd /d "%~dp0"
echo ============================================
echo   Запуск локального сервера сайта bak7580
echo ============================================
node server.js
pause
