Sub 最適化()


Dim ws1 As Worksheet

Dim ws2 As Worksheet

Dim ws3 As Worksheet

Dim i As Long

Dim p As Long

Dim max As Single

Dim m As Long


Application.ScreenUpdating = False




Set ws1 = Worksheets("シミュレーション")

Set ws2 = Worksheets("法人税")

Set ws3 = Worksheets("最適化")

Set ws4 = Worksheets("報告書")


ws3.Unprotect


p = ws1.Range("D38")

For i = 5 To 45


ws1.Range("D38") = ws3.Cells(i, 5)


ws3.Cells(i, 6) = ws4.Range("E24")



Next



'max = ws3.Range("F100")
'
'
'For m = 5 To 45
'
'
'   If ws3.Cells(m, 6) = max Then
'
'
'   ws3.Range("E100") = ws3.Cells(m, 5).Value
'
'
'
'
'   End If
'
'Next




ws1.Range("D38").Value = p


ws3.Protect



End Sub

Sub 配当金最適化()


Dim ws1 As Worksheet

Dim ws2 As Worksheet

Dim ws3 As Worksheet

Dim i As Long

Dim max As Single

Dim m As Long


Application.ScreenUpdating = False




Set ws1 = Worksheets("シミュレーション")

Set ws2 = Worksheets("法人税")

Set ws3 = Worksheets("最適化")

Set ws4 = Worksheets("報告書")


ws3.Unprotect


For i = 5 To 44


ws1.Range("D45") = ws3.Cells(i, 10)

ws1.Range("D38") = ws1.Range("D8") - ws3.Cells(i, 10)



ws3.Cells(i, 11) = ws4.Range("E24")



Next


max = ws3.Range("K100")


For m = 5 To 45


   If ws3.Cells(m, 11) = max Then


   ws3.Range("J100") = ws3.Cells(m, 10).Value




   End If

Next





ws1.Range("D38") = ws1.Range("D8") - ws3.Range("J100")


ws1.Range("D45") = ws3.Range("J100")






ws3.Protect



End Sub


Sub 配当金最適化2()


Dim ws1 As Worksheet

Dim ws2 As Worksheet

Dim ws3 As Worksheet

Dim i As Long

Dim max As Single

Dim m As Long


Application.ScreenUpdating = False




Set ws1 = Worksheets("シミュレーション")

Set ws2 = Worksheets("法人税")

Set ws3 = Worksheets("最適化")

Set ws4 = Worksheets("報告書")


ws3.Unprotect


For i = 5 To 44


ws1.Range("D38") = ws1.Range("D8")

ws1.Range("D45") = ws3.Cells(i, 10)

'ws1.Range("D33") = ws1.Range("D8") - ws3.Cells(i, 10)



ws3.Cells(i, 11) = ws4.Range("E24")



Next







'ws1.Range("D36") = ws3.Cells(25, 5)

ws1.Range("D45").ClearContents

ws3.Protect



End Sub


Sub 事前確定最適化()


Dim ws1 As Worksheet

Dim ws2 As Worksheet

Dim ws3 As Worksheet

Dim i As Long

Dim max As Single



Application.ScreenUpdating = False




Set ws1 = Worksheets("シミュレーション")

Set ws2 = Worksheets("法人税")

Set ws3 = Worksheets("最適化")

Set ws4 = Worksheets("報告書")


ws3.Unprotect


ws3.Range("N45").ClearContents


For i = 5 To 44



ws1.Range("D39") = ws3.Cells(i, 13)



ws3.Cells(i, 14) = ws4.Range("E24")



Next


max = ws3.Range("N100")


For m = 5 To 45


   If ws3.Cells(m, 14) = max Then


   ws3.Range("M100") = ws3.Cells(m, 13).Value




   End If

Next


   ws1.Range("D39").Value = ws3.Range("M100")






ws3.Protect



End Sub

Sub 事前確定引き算()

Dim ws1 As Worksheet



Dim i As Long

Application.ScreenUpdating = False


Set ws1 = Worksheets("シミュレーション")

ws1.Range("D39") = ws1.Range("D8") - ws1.Range("D38")






End Sub
