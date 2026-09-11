@echo off
chcp 65001 > nul

:: Definir el archivo de salida
set "OUTPUT_FILE=estructura.md"

:: Crear o vaciar el archivo .md con el encabezado
(
echo # Estructura del Directorio
echo.
echo ```text
) > "%OUTPUT_FILE%"

echo ====================================================
echo Listado completo de archivos y subcarpetas:
echo ====================================================
echo.

:: Ejecutar el comando tree, mostrarlo en pantalla y guardarlo en el archivo
tree /f
tree /f >> "%OUTPUT_FILE%"

(
echo ```
echo.
echo _Proceso finalizado con éxito._
) >> "%OUTPUT_FILE%"

echo.
echo ====================================================
echo Proceso finalizado. Archivo '%OUTPUT_FILE%' generado.
echo ====================================================
pause
