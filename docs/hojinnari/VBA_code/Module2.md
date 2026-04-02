# Module2

```vba
in file: xl/vbaProject.bin - OLE stream: 'VBA/Module2'
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
Option Explicit


Sub tenki()


Dim ws1 As Worksheet


Dim i As Long

Dim j As Long

Dim arr As Variant

Set ws1 = Worksheets("シミュレーション")

ws1.Unprotect



arr = ws1.Range("D28:M29")

 
 For i = 1 To 2
 
  For j = 1 To 10
 
 
   arr(i, j) = ws1.Cells(i + 6, j + 3)


 Next j

Next i



ws1.Range("D28:M29") = arr



arr = ws1.Range("D33:M33")



  For j = 1 To 10
 
 
   arr(1, j) = ws1.Cells(9, j + 3)


 Next j


ws1.Range("D33:M33") = arr





arr = ws1.Range("D35:M35")



  For j = 1 To 10
 
 
   arr(1, j) = ws1.Cells(11, j + 3)


 Next j


ws1.Range("D35:M35") = arr




arr = ws1.Range("D37:M37")



  For j = 1 To 10
 
 
   arr(1, j) = ws1.Cells(13, j + 3)


 Next j


ws1.Range("D37:M37") = arr

ws1.Protect


End Sub




Sub 健康保険ON()


Dim i As Long

Dim j As Long

Dim arr As Variant

Dim arr2 As Variant


Dim 結果 As Long
    
    結果 = MsgBox("政管健保の保険料を入力します。", vbYesNo)
    
    If 結果 = vbYes Then




ActiveSheet.Unprotect

With ActiveSheet



 
 '比較
 
 
 arr2 = .Range("D49:M49")


 
  
    For i = 1 To 10
  
  
    arr2(1, i) = .Cells(49, i + 26).Formula
    
    
    
    Next
  
  

  
  
 .Range("D49:M49") = arr2
 
 
     
  
    Range("D49:M49").Select
    Selection.Locked = True
    Selection.FormulaHidden = False
    
   
    .Range("D76") = 1

End With

ActiveSheet.Protect


 
    Else
    
    
    
        MsgBox "処理を中断します。"
    
    
    End If


End Sub



Sub 健康保険OFF()


Dim i As Long

Dim j As Long


Application.ScreenUpdating = False


ActiveSheet.Unprotect

With ActiveSheet






.Range("D49:M49").Select

Selection.Copy

.Range("D49:M49").PasteSpecial xlPasteValues
'

  .Range("D76") = 0

  
  
End With


   
Range("D49:M49").Select
    Selection.Locked = False
    Selection.FormulaHidden = False
  

ActiveSheet.Protect

End Sub


Sub 画面更新()

Application.ScreenUpdating = False


Worksheets("シミュレーション").Range("O7").Copy


Worksheets("シミュレーション").Range("O7").PasteSpecial


Application.CutCopyMode = False



End Sub



Sub sim_tenki()


Dim ws1 As Worksheet


Dim i As Long

Dim j As Long

Dim arr As Variant

Set ws1 = Worksheets("シミュレーション")

ws1.Unprotect

Application.ScreenUpdating = False

'社長給料

ws1.Range("D8").Copy


ws1.Range("D38").PasteSpecial Paste:=xlPasteValues


'専従者

ws1.Range("E8:G8").Copy


ws1.Range("E34:G34").PasteSpecial Paste:=xlPasteValues



ws1.Range("D10:G10").Copy


ws1.Range("D41:G41").PasteSpecial Paste:=xlPasteValues




ws1.Range("D12:G12").Copy


ws1.Range("D43:G43").PasteSpecial Paste:=xlPasteValues




ws1.Range("D15:G15").Copy


ws1.Range("D45:G45").PasteSpecial Paste:=xlPasteValues



ws1.Range("D19:G19").Copy


ws1.Range("D49:G49").PasteSpecial Paste:=xlPasteValues


'青色申告特別控除

ws1.Range("P19").Copy


ws1.Range("P47").PasteSpecial Paste:=xlPasteValues


'配偶者

ws1.Range("U19").Copy


ws1.Range("U47").PasteSpecial Paste:=xlPasteValues




'事業税

ws1.Range("R19:S19").Copy


ws1.Range("R47").PasteSpecial Paste:=xlPasteValues

Application.CutCopyMode = False


'配偶者

ws1.Range("W19:X19").Copy


ws1.Range("W47").PasteSpecial Paste:=xlPasteValues

Application.CutCopyMode = False




ws1.Protect


End Sub


Sub FileBackup()



Dim res As VbMsgBoxResult
  Dim folder_path As Variant
  Dim filename_backup As String
  Dim backup_fullpath As String
  Dim fso As Object
  Dim str_now As String

  Set fso = CreateObject("Scripting.FileSystemObject")

  res = MsgBox("現在のファイルのコピーを作成しますか？" & vbCrLf & "(保存先フォルダを指定してください。)", vbYesNoCancel + vbInformation, "バックアップファイルの作成")

On Error GoTo myError

  If (res = vbYes) Then
    '現在のファイル保存
    ThisWorkbook.Save
    
    '保存先フォルダの選択
    With Application.FileDialog(msoFileDialogFolderPicker)
      .Show
      folder_path = .SelectedItems(1)
    End With
    
    '保存先フォルダが選択されているならば
    If (folder_path <> "false") Then
      '保存予定のファイル名
      str_now = Format(Now, "yyyymmdd_hhnnss")
      filename_backup = fso.GetBaseName(ThisWorkbook.Name) & str_now & "." & fso.GetExtensionName(ThisWorkbook.Name)
      backup_fullpath = folder_path & "\" & filename_backup
      
      '同名ファイルが存在しないならば
      If Dir(backup_fullpath) = "" Then
        'バックアップファイルを保存
        'FileCopy ThisWorkbook.FullName, backup_fullpath
        Call fso.CopyFile(ThisWorkbook.FullName, backup_fullpath, True)
        MsgBox "バックアップファイルを保存しました", vbOKOnly, "確認"
      End If
      
    End If
    
  End If


Exit Sub

myError:

MsgBox "フォルダー選択を中止しますか？", vbExclamation

End Sub


Sub 名前をつけて保存()

    Dim fname As String
    
    '名前を付けて保存ダイアログ
    fname = Application.GetSaveAsFilename(filefilter:="Excelファイル,*.xlsm")
    If fname = "False" Then
        'キャンセルの場合
        Exit Sub
    Else
        'ブックを保存する
        ActiveWorkbook.SaveAs Filename:=fname
    End If
End Sub

Sub シミュレーションデータ削除()

Dim ws1 As Worksheet



Application.ScreenUpdating = False




Set ws1 = Worksheets("シミュレーション")



ws1.Range("D7").ClearContents

ws1.Range("P19").ClearContents

ws1.Range("P47").ClearContents

ws1.Range("D8:G8").ClearContents

ws1.Range("D10:G10").ClearContents

ws1.Range("D13:G13").ClearContents

ws1.Range("D17:G17").ClearContents

ws1.Range("D21:G22").ClearContents

ws1.Range("D30:G30").ClearContents

ws1.Range("D31").ClearContents

ws1.Range("D32:G36").ClearContents

ws1.Range("D39:G39").ClearContents

ws1.Range("D41:G41").ClearContents

ws1.Range("D45:G45").ClearContents


ws1.Range("S19").ClearContents

ws1.Range("S47").ClearContents



ws1.Range("C62:C66").ClearContents


ws1.Range("D58:G66").ClearContents


End Sub



Sub 法人成データ削除()

Dim ws1 As Worksheet



Application.ScreenUpdating = False




Set ws1 = Worksheets("法人成り")



ws1.Range("B23:C23").ClearContents

ws1.Range("B26:B27").ClearContents

ws1.Range("B37:B38").ClearContents




End Sub

-------------------------------------------------------------------------------
```
