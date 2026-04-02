# 報告書1

```vba
in file: xl/vbaProject.bin - OLE stream: 'VBA/報告書1'
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
Sub copy_plan()




Set ws1 = Worksheets("報告書")

ws1.Unprotect


ws1.Range("B2:E28").Select

Selection.Copy

ws1.Range("H2:K28").PasteSpecial Paste:=xlPasteValues

ws1.Range("H2:K28").PasteSpecial Paste:=xlPasteFormats

Application.CutCopyMode = False

ws1.Protect



End Sub

-------------------------------------------------------------------------------
```
