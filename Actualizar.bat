@echo off
title Actualizador - Whats2
cd /d "%~dp0"

echo ======================================================
echo           HERRAMIENTA DE DIFUSION WHATSAPP (WHATS2)
echo            ACTUALIZADOR A LA ULTIMA VERSION
echo ======================================================
echo.

echo [1/3] Descargando ultimos cambios desde GitHub...
echo ------------------------------------------------------
git pull origin main
if %errorlevel% neq 0 (
    echo.
    echo [AVISO] No se pudo descargar desde Git o no hay conexion a internet.
    echo Continuando con la verificacion local...
)
echo.

echo [2/3] Verificando dependencias de Node.js...
echo ------------------------------------------------------
call npm install --no-audit --no-fund
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Hubo un problema al actualizar los paquetes de npm.
    pause
    exit /b %errorlevel%
)
echo.

echo [3/3] Aplicando parches de estabilidad a whatsapp-web.js...
echo ------------------------------------------------------
if exist "parches_libreria\whatsapp-web.js" (
    xcopy /Y /E /I "parches_libreria\whatsapp-web.js\*" "node_modules\whatsapp-web.js\" >nul
    echo [OK] Parches criticos restaurados con exito en node_modules.
) else (
    echo [INFO] No se encontro la carpeta de parches personalizados.
)
echo.

echo ======================================================
echo     SISTEMA ACTUALIZADO CON EXITO A LA ULTIMA VERSION
echo ======================================================
echo.
pause
