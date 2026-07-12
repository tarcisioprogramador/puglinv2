@echo off
title Prospector de Sites - Publicar Agora
echo.
echo  Publicando sites na fila para a HostGator...
echo.
if not exist "%~dp0..\..\backend\data\fila-publicacao.txt" (
  echo  Nenhum site na fila de publicacao.
  goto :fim
)
type "%~dp0..\..\backend\data\fila-publicacao.txt"
echo.
echo  [OK] Publicacao concluida (simulado).
echo.
:fim
echo.
pause
