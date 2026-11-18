Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "F:\Mart-System\COMPLETE-HMS-main"
WshShell.Run "cmd.exe /c START-MART-ELECTRON.bat", 0, False

