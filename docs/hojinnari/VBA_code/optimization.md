# 最適化1

```vba
in file: xl/vbaProject.bin - OLE stream: 'VBA/最適化1'
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
Sub 最適化()


Dim ws1 As Worksheet

Dim ws2 As Worksheet

Dim ws3 As Worksheet

Dim ws4 As Worksheet

Dim i As Long

Dim g As Long



Application.ScreenUpdating = False




Set ws1 = Worksheets("シミュレーション")

Set ws2 = Worksheets("法人成り")

Set ws3 = Worksheets("最適化")

Set ws4 = Worksheets("報告書")


ws3.Unprotect


ws3.Range("E3") = ws1.Range("N27")

g = ws1.Range("D34")


For i = 5 To 45


ws1.Range("D34") = ws3.Cells(i, 3)


ws3.Cells(i, 4) = ws4.Range("D24")

ws3.Cells(i, 5) = ws4.Range("D23")

Next


ws1.Range("D34") = g



'
ws3.Protect

' MsgBox "最大値：" & maxVal

End Sub



Sub 事業所得最適化()


Dim ws1 As Worksheet

Dim ws2 As Worksheet

Dim ws3 As Worksheet

Dim ws4 As Worksheet

Dim i As Long

Dim g As Long



Application.ScreenUpdating = False




Set ws1 = Worksheets("シミュレーション")

Set ws2 = Worksheets("法人成り")

Set ws3 = Worksheets("最適化")

Set ws4 = Worksheets("報告書")


ws3.Unprotect


g = ws3.Range("L2").Value

ws3.Range("I5").Value = ws3.Range("L2").Value

'ws3.Range("L3").Value = ws1.Range("D25").Value


'手取りから定期同額を逆算

Call 欲しい手取り



'ws1.Range("D32").Value = ws3.Range("J3").Value



For i = 5 To 45


ws1.Range("D7").Value = ws3.Cells(i, 9).Value


ws3.Cells(i, 10) = ws4.Range("D24")

ws3.Cells(i, 11) = ws3.Range("J3")


Next



' ws3.Range("K3").Value = g


 ws1.Range("D7").Value = g



Call 欲しい手取り





ws3.Protect


End Sub

Sub 欲しい手取り()


Dim ws1 As Worksheet

Dim ws2 As Worksheet

Dim ws3 As Worksheet

Dim ws4 As Worksheet


Set ws1 = Worksheets("シミュレーション")

Set ws2 = Worksheets("法人成り")

Set ws3 = Worksheets("最適化")

Set ws4 = Worksheets("報告書")

Application.ScreenUpdating = False

On Error GoTo myError

'
    ws1.Range("D53").GoalSeek Goal:=ws3.Range("J3"), ChangingCell:=ws1.Range("D32")

myError:

Exit Sub

End Sub


Sub 法人ゼロ()


Dim ws1 As Worksheet

Dim ws2 As Worksheet

Dim ws3 As Worksheet

Dim ws4 As Worksheet


Set ws1 = Worksheets("シミュレーション")

Set ws2 = Worksheets("法人成り")

Set ws3 = Worksheets("最適化")

Set ws4 = Worksheets("報告書")

Application.ScreenUpdating = False



'
    ws2.Range("I38").GoalSeek Goal:=ws3.Range("H50"), ChangingCell:=ws1.Range("D7")

    
'      ws1.Range("D25").GoalSeek Goal:=ws3.Range("H6"), ChangingCell:=ws1.Range("D7")


End Sub

Sub マイクロ法人最適化()


Dim ws1 As Worksheet

Dim ws2 As Worksheet

Dim ws3 As Worksheet

Dim ws4 As Worksheet

Dim i As Long

Dim g As Long



Application.ScreenUpdating = False




Set ws1 = Worksheets("シミュレーション")

Set ws2 = Worksheets("法人成り")

Set ws3 = Worksheets("最適化")

Set ws4 = Worksheets("報告書")



ws3.Unprotect


ws3.Range("Q3").Value = ws1.Range("N27").Value

ws1.Range("D33") = ws3.Range("U10")




For i = 5 To 45


ws1.Range("D34") = ws3.Cells(i, 15)


ws3.Cells(i, 16) = ws4.Range("D24")

ws3.Cells(i, 17) = ws1.Range("N57")


Next



Max = ws3.Range("S100")


For m = 5 To 45


   If ws3.Cells(m, 19) = Max Then


   ws3.Range("R100") = ws3.Cells(m, 15).Value




   End If

Next


   ws1.Range("D34").Value = ws3.Range("R100")








'
ws3.Protect

' MsgBox "最大値：" & maxVal

End Sub
-------------------------------------------------------------------------------
```
