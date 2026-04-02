Option Explicit


Sub tenki()


Dim ws1 As Worksheet


Dim i As Long

Dim j As Long

Dim arr As Variant

Set ws1 = Worksheets("シミュレーション")

ws1.Unprotect



 ws1.Range("D38:M43").Value = ws1.Range("D8:M13").Value
 

 
 ws1.Range("D45:M46").Value = ws1.Range("D15:M16").Value
 
 ws1.Range("D48:M48").Value = ws1.Range("D18:M18").Value
 
 ws1.Range("D53:M53").Value = ws1.Range("D23:M23").Value
 
 
 






ws1.Protect


End Sub


Sub 健康保険ON()


Dim i As Long

Dim j As Long

Dim arr As Variant

Dim arr2 As Variant

Dim arr3 As Variant

Dim 結果 As Long
    
    結果 = MsgBox("政管健保の保険料を入力します。", vbYesNo)
    
    If 結果 = vbYes Then




ActiveSheet.Unprotect

With ActiveSheet



 




arr = .Range("D27:M27")


 
  
    For i = 1 To 10
  
  
    arr(1, i) = .Cells(26, i + 26).Formula
    
    
    
    Next
  
  

  
  
 .Range("D27:M27") = arr
 
 
 
 '比較
 
 
 arr2 = .Range("D54:M54")


 
  
    For i = 1 To 10
  
  
    arr2(1, i) = .Cells(55, i + 26).Formula
    
    
    
    Next
  
  

  
  
 .Range("D57:M57") = arr2
 
 
     

 
 
     
    Range("D27:M27").Select
    Selection.Locked = True
    Selection.FormulaHidden = False
    
    Range("D57:M57").Select
    Selection.Locked = True
    Selection.FormulaHidden = False
 
 

   .Range("D126") = 1


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


.Range("D27:M27").Select

Selection.Copy

.Range("D27:M27").PasteSpecial xlPasteValues



.Range("D57:M57").Select

Selection.Copy

.Range("D57:M57").PasteSpecial xlPasteValues

.Range("D126") = 0
  
End With


Range("D27:M27").Select
    Selection.Locked = False
    Selection.FormulaHidden = False
    
   
Range("D57:M57").Select
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

Sub 全シートの保護()
  
  Dim sh As Object

  On Error Resume Next

  For Each sh In Sheets
    sh.Protect
  Next sh

End Sub

Sub 全シートの保護解除()
  
  Dim sh As Object
  
  Application.ScreenUpdating = False



  On Error Resume Next

  For Each sh In Sheets
    sh.Unprotect
  Next sh

Worksheets("HOME").Select

End Sub


Sub シミュレーションデータ削除()

Dim ws1 As Worksheet



Application.ScreenUpdating = False




Set ws1 = Worksheets("シミュレーション")


'法人
ws1.Range("P3:P5").ClearContents


'現状

ws1.Range("D6:M13").ClearContents

ws1.Range("D15:M16").ClearContents

ws1.Range("D18:M18").ClearContents

ws1.Range("D23:M23").ClearContents


'比較

ws1.Range("D38:M43").ClearContents

ws1.Range("D45:M46").ClearContents

ws1.Range("D48:M48").ClearContents

ws1.Range("D53:M53").ClearContents






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


Function cellcolor(セル)

    cellcolor = セル.Interior.ColorIndex


End Function