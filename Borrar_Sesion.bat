@echo off
title Cerrar / Borrar Sesion - Whats2
cd /d "%~dp0"

echo ======================================================
echo           HERRAMIENTA DE DIFUSION WHATSAPP (WHATS2)
echo            ELIMINAR SESION ACTIVA (LOCALAUTH)
echo ======================================================
echo.
echo !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
echo ADVERTENCIA:
echo Esta accion borrara por completo la sesion guardada
echo en la carpeta Seccion/.
echo.
echo Tendras que volver a escanear el codigo QR con tu
echo telefono celular la proxima vez que inicies el bot.
echo !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
echo.
echo Asegurate de que Iniciar.bat o Extractor.bat esten
echo CERRADOS antes de continuar para evitar bloqueos.
echo.

set /p confirmar="Estas seguro de eliminar la sesion? (S/N): "
if /i not "%confirmar%"=="S" (
    echo.
    echo Operacion cancelada. La sesion sigue activa.
    echo.
    pause
    exit /b 0
)

echo.
echo Eliminando datos de sesion en Seccion/...
if exist "Seccion" (
    rd /s /q "Seccion"
)
mkdir "Seccion"
echo. > "Seccion\.gitkeep"

echo.
echo ======================================================
echo           SESION ELIMINADA EXITOSAMENTE
echo   Al iniciar el bot se generara un nuevo codigo QR
echo ======================================================
echo.
pause
