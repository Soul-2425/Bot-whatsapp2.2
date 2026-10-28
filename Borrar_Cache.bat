@echo off
title Limpiador de Cache - Whats2
cd /d "%~dp0"

echo ======================================================
echo           HERRAMIENTA DE DIFUSION WHATSAPP (WHATS2)
echo                  LIMPIEZA DE CACHE Y ESTADO
echo ======================================================
echo.
echo Esta accion borrara los archivos temporales de ejecucion:
echo  - Registro de ciclos y estadisticas (cache/estado.json)
echo  - Cache interna de WhatsApp Web (.wwebjs_cache)
echo.
echo NOTA: Tu sesion iniciada en WhatsApp NO se borrara.
echo.

set /p confirmar="Deseas proceder con la limpieza? (S/N): "
if /i not "%confirmar%"=="S" (
    echo.
    echo Operacion cancelada por el usuario.
    echo.
    pause
    exit /b 0
)

echo.
echo Limpiando carpeta cache/...
if exist "cache" (
    rd /s /q "cache"
)
mkdir "cache"
echo. > "cache\.gitkeep"

if exist ".wwebjs_cache" (
    echo Limpiando .wwebjs_cache/...
    rd /s /q ".wwebjs_cache"
)

echo.
echo ======================================================
echo           CACHE REINICIADA CORRECTAMENTE
echo   El proximo inicio arrancara desde el Ciclo 1 limpio
echo ======================================================
echo.
pause
