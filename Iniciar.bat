@echo off
title Herramienta Whats2 - Difusion Masiva en Grupos
cd /d "%~dp0"
echo ======================================================
echo           HERRAMIENTA DE DIFUSION WHATSAPP (WHATS2)
echo                 CICLOS DE ENVIO A GRUPOS
echo ======================================================
echo.
echo Iniciando sistema de envio en segundo plano...
echo.
node Envio/Arranque/index.js
echo.
echo ======================================================
echo Ejecucion finalizada o interrumpida.
echo ======================================================
pause
