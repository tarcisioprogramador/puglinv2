' Prospector de Sites - Publicador Oculto
' Executa em segundo plano sem janelas visiveis
' Chamado pelo Windows Task Scheduler a cada 1 minuto

Dim fso, shell, pasta, fila, comando
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

' Caminho base (mesma pasta do script)
pasta = fso.GetParentFolderName(WScript.ScriptFullName)

' Verifica se ha fila de publicacao
fila = fso.BuildPath(pasta, "..\..\backend\data\fila-publicacao.txt")

If fso.FileExists(fila) Then
  ' Le a fila e publica cada site
  Dim arquivo, linha
  Set arquivo = fso.OpenTextFile(fila, 1)
  Do While Not arquivo.AtEndOfStream
    linha = arquivo.ReadLine
    If Len(Trim(linha)) > 0 Then
      ' Executa publicacao (simulado)
      comando = "echo Publicando: " & linha & " >> " & fso.BuildPath(pasta, "publicacao-log.txt")
      shell.Run comando, 0, True
    End If
  Loop
  arquivo.Close

  ' Remove arquivo de fila apos processar
  fso.DeleteFile fila
End If

Set fso = Nothing
Set shell = Nothing
