@echo off
title Prospector de Sites - Instalar Publicador Automatico
echo.
echo  Este instalador cria uma tarefa do Windows que verifica a cada 1 minuto
echo  se ha sites na fila e publica sozinho na HostGator. Sem janelas, sem cliques.
echo.
schtasks /Create /F /TN "ProspectorPublicador" /SC MINUTE /MO 1 /TR "wscript.exe \"%~dp0publicador-oculto.vbs\""
if %errorlevel%==0 (
  echo.
  echo  [OK] Publicador automatico instalado! Pode fechar esta janela.
  echo  Para desinstalar: schtasks /Delete /TN ProspectorPublicador /F
) else (
  echo.
  echo  [ERRO] Nao consegui criar a tarefa. Execute como administrador.
)
echo.
pause
