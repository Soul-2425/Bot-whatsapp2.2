@echo off
title Extractor de Grupos - Whats2
cd /d "%~dp0"
echo ======================================================
echo           HERRAMIENTA DE DIFUSION WHATSAPP
echo              EXTRACTOR DE GRUPOS WHATSAPP
echo ======================================================
echo.
echo Iniciando proceso de extraccion...
echo.
node extraccion_de_grupos/extractor.js
echo.
echo Proceso finalizado.
pause
