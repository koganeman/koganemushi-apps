# Module1

```vba
in file: xl/vbaProject.bin - OLE stream: 'VBA/Module1'
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
Option Explicit


'月額給与から控除する社会保険料の計算
'（健康保険（介護も考慮）＋厚生年金）
'Income=所得,Age=年齢
Function SocialInsTS(Income, Age)

Application.Volatile


    Dim Hins As Single    '健康保険料率
    Dim Pins As Single    '厚生年金保険料率
    Dim Cins As Single    '介護保険料率
    Dim P As Variant
    
    '料率設定
    Hins = Worksheets("シミュレーション").Range("O7")     '全国平均の保険料率
    Pins = Worksheets("シミュレーション").Range("O9")
    Cins = Worksheets("シミュレーション").Range("O8")
    
    Income = Int(Income)
    
    Select Case Age
    
    Case 0 To 39    '介護保険なし
        If Income <= 0 Then
            P = 0
        ElseIf Income < 63000 Then
            P = (58000 * Hins / 2) + (98000 * Pins / 2)
        ElseIf Income < 73000 Then
            P = (68000 * Hins / 2) + (98000 * Pins / 2)
        ElseIf Income < 83000 Then
            P = (78000 * Hins / 2) + (98000 * Pins / 2)
        ElseIf Income < 93000 Then
            P = (88000 * Hins / 2) + (98000 * Pins / 2)
        
        ElseIf Income < 101000 Then
            P = 98000 * (Hins + Pins) / 2
        ElseIf Income < 107000 Then
            P = 104000 * (Hins + Pins) / 2
        ElseIf Income < 114000 Then
            P = 110000 * (Hins + Pins) / 2
        ElseIf Income < 122000 Then
            P = 118000 * (Hins + Pins) / 2
        ElseIf Income < 130000 Then
            P = 126000 * (Hins + Pins) / 2
        ElseIf Income < 138000 Then
            P = 134000 * (Hins + Pins) / 2
        ElseIf Income < 146000 Then
            P = 142000 * (Hins + Pins) / 2
        ElseIf Income < 155000 Then
            P = 150000 * (Hins + Pins) / 2
        ElseIf Income < 165000 Then
            P = 160000 * (Hins + Pins) / 2
        
        ElseIf Income < 175000 Then
            P = 170000 * (Hins + Pins) / 2
        ElseIf Income < 185000 Then
            P = 180000 * (Hins + Pins) / 2
        ElseIf Income < 195000 Then
            P = 190000 * (Hins + Pins) / 2
        ElseIf Income < 210000 Then
            P = 200000 * (Hins + Pins) / 2
        ElseIf Income < 230000 Then
            P = 220000 * (Hins + Pins) / 2
        ElseIf Income < 250000 Then
            P = 240000 * (Hins + Pins) / 2
        ElseIf Income < 270000 Then
            P = 260000 * (Hins + Pins) / 2
        ElseIf Income < 290000 Then
            P = 280000 * (Hins + Pins) / 2
        ElseIf Income < 310000 Then
            P = 300000 * (Hins + Pins) / 2
        ElseIf Income < 330000 Then
            P = 320000 * (Hins + Pins) / 2
        
        ElseIf Income < 350000 Then
            P = 340000 * (Hins + Pins) / 2
        ElseIf Income < 370000 Then
            P = 360000 * (Hins + Pins) / 2
        ElseIf Income < 395000 Then
            P = 380000 * (Hins + Pins) / 2
        ElseIf Income < 425000 Then
            P = 410000 * (Hins + Pins) / 2
        ElseIf Income < 455000 Then
            P = 440000 * (Hins + Pins) / 2
        ElseIf Income < 485000 Then
            P = 470000 * (Hins + Pins) / 2
        ElseIf Income < 515000 Then
            P = 500000 * (Hins + Pins) / 2
        ElseIf Income < 545000 Then
            P = 530000 * (Hins + Pins) / 2
        ElseIf Income < 575000 Then
            P = 560000 * (Hins + Pins) / 2
        ElseIf Income < 605000 Then
            P = 590000 * (Hins + Pins) / 2
        
        ElseIf Income < 635000 Then
            P = (620000 * Pins / 2) + (620000 * Hins / 2)
        ElseIf Income < 665000 Then
            P = (620000 * Pins / 2) + (650000 * Hins / 2)
        ElseIf Income < 695000 Then
            P = (620000 * Pins / 2) + (680000 * Hins / 2)
        ElseIf Income < 730000 Then
            P = (620000 * Pins / 2) + (710000 * Hins / 2)
        ElseIf Income < 770000 Then
            P = (620000 * Pins / 2) + (750000 * Hins / 2)
        ElseIf Income < 810000 Then
            P = (620000 * Pins / 2) + (790000 * Hins / 2)
        ElseIf Income < 855000 Then
            P = (620000 * Pins / 2) + (830000 * Hins / 2)
        ElseIf Income < 905000 Then
            P = (620000 * Pins / 2) + (880000 * Hins / 2)
        ElseIf Income < 955000 Then
            P = (620000 * Pins / 2) + (930000 * Hins / 2)
        
        ElseIf Income < 1005000 Then
            P = (620000 * Pins / 2) + (980000 * Hins / 2)
        ElseIf Income < 1055000 Then
            P = (620000 * Pins / 2) + (1030000 * Hins / 2)
        ElseIf Income < 1115000 Then
            P = (620000 * Pins / 2) + (1090000 * Hins / 2)
        ElseIf Income < 1175000 Then
            P = (620000 * Pins / 2) + (1150000 * Hins / 2)
        
        ElseIf Income >= 1175000 Then
            P = (620000 * Pins / 2) + (1210000 * Hins / 2)
        Else
        End If
    
    Case 40 To 70   '介護保険あり
        If Income <= 0 Then
            P = 0
        ElseIf Income < 63000 Then
            P = (58000 * (Hins + Cins) / 2) + (98000 * Pins / 2)
        ElseIf Income < 73000 Then
            P = (68000 * (Hins + Cins) / 2) + (98000 * Pins / 2)
        ElseIf Income < 83000 Then
            P = (78000 * (Hins + Cins) / 2) + (98000 * Pins / 2)
        ElseIf Income < 93000 Then
            P = (88000 * (Hins + Cins) / 2) + (98000 * Pins / 2)
        
        ElseIf Income < 101000 Then
            P = 98000 * (Hins + Pins + Cins) / 2
        ElseIf Income < 107000 Then
            P = 104000 * (Hins + Pins + Cins) / 2
        ElseIf Income < 114000 Then
            P = 110000 * (Hins + Pins + Cins) / 2
        ElseIf Income < 122000 Then
            P = 118000 * (Hins + Pins + Cins) / 2
        ElseIf Income < 130000 Then
            P = 126000 * (Hins + Pins + Cins) / 2
        ElseIf Income < 138000 Then
            P = 134000 * (Hins + Pins + Cins) / 2
        ElseIf Income < 146000 Then
            P = 142000 * (Hins + Pins + Cins) / 2
        ElseIf Income < 155000 Then
            P = 150000 * (Hins + Pins + Cins) / 2
        ElseIf Income < 165000 Then
            P = 160000 * (Hins + Pins + Cins) / 2
        
        ElseIf Income < 175000 Then
            P = 170000 * (Hins + Pins + Cins) / 2
        ElseIf Income < 185000 Then
            P = 180000 * (Hins + Pins + Cins) / 2
        ElseIf Income < 195000 Then
            P = 190000 * (Hins + Pins + Cins) / 2
        ElseIf Income < 210000 Then
            P = 200000 * (Hins + Pins + Cins) / 2
        ElseIf Income < 230000 Then
            P = 220000 * (Hins + Pins + Cins) / 2
        ElseIf Income < 250000 Then
            P = 240000 * (Hins + Pins + Cins) / 2
        ElseIf Income < 270000 Then
            P = 260000 * (Hins + Pins + Cins) / 2
        ElseIf Income < 290000 Then
            P = 280000 * (Hins + Pins + Cins) / 2
        ElseIf Income < 310000 Then
            P = 300000 * (Hins + Pins + Cins) / 2
        ElseIf Income < 330000 Then
            P = 320000 * (Hins + Pins + Cins) / 2
        
        ElseIf Income < 350000 Then
            P = 340000 * (Hins + Pins + Cins) / 2
        ElseIf Income < 370000 Then
            P = 360000 * (Hins + Pins + Cins) / 2
        ElseIf Income < 395000 Then
            P = 380000 * (Hins + Pins + Cins) / 2
        ElseIf Income < 425000 Then
            P = 410000 * (Hins + Pins + Cins) / 2
        ElseIf Income < 455000 Then
            P = 440000 * (Hins + Pins + Cins) / 2
        ElseIf Income < 485000 Then
            P = 470000 * (Hins + Pins + Cins) / 2
        ElseIf Income < 515000 Then
            P = 500000 * (Hins + Pins + Cins) / 2
        ElseIf Income < 545000 Then
            P = 530000 * (Hins + Pins + Cins) / 2
        ElseIf Income < 575000 Then
            P = 560000 * (Hins + Pins + Cins) / 2
        ElseIf Income < 605000 Then
            P = 590000 * (Hins + Pins + Cins) / 2
        
        ElseIf Income < 635000 Then
            P = (620000 * Pins / 2) + (620000 * (Hins + Cins) / 2)
        ElseIf Income < 665000 Then
            P = (620000 * Pins / 2) + (650000 * (Hins + Cins) / 2)
        ElseIf Income < 695000 Then
            P = (620000 * Pins / 2) + (680000 * (Hins + Cins) / 2)
        ElseIf Income < 730000 Then
            P = (620000 * Pins / 2) + (710000 * (Hins + Cins) / 2)
        ElseIf Income < 770000 Then
            P = (620000 * Pins / 2) + (750000 * (Hins + Cins) / 2)
        ElseIf Income < 810000 Then
            P = (620000 * Pins / 2) + (790000 * (Hins + Cins) / 2)
        ElseIf Income < 855000 Then
            P = (620000 * Pins / 2) + (830000 * (Hins + Cins) / 2)
        ElseIf Income < 905000 Then
            P = (620000 * Pins / 2) + (880000 * (Hins + Cins) / 2)
        ElseIf Income < 955000 Then
            P = (620000 * Pins / 2) + (930000 * (Hins + Cins) / 2)
        
        ElseIf Income < 1005000 Then
            P = (620000 * Pins / 2) + (980000 * (Hins + Cins) / 2)
        ElseIf Income < 1055000 Then
            P = (620000 * Pins / 2) + (1030000 * (Hins + Cins) / 2)
        ElseIf Income < 1115000 Then
            P = (620000 * Pins / 2) + (1090000 * (Hins + Cins) / 2)
        ElseIf Income < 1175000 Then
            P = (620000 * Pins / 2) + (1150000 * (Hins + Cins) / 2)
        
        ElseIf Income >= 1175000 Then
            P = (620000 * Pins / 2) + (1210000 * (Hins + Cins) / 2)
        Else
        
        
        End If
        
        
        
        Case 71 To 74   '健康保険だけ
        If Income <= 0 Then
            P = 0
        ElseIf Income < 63000 Then
            P = (58000 * (Hins + Cins) / 2)
        ElseIf Income < 73000 Then
            P = (68000 * (Hins + Cins) / 2)
        ElseIf Income < 83000 Then
            P = (78000 * (Hins + Cins) / 2)
        ElseIf Income < 93000 Then
            P = (88000 * (Hins + Cins) / 2)
        
        ElseIf Income < 101000 Then
            P = 98000 * (Hins + Cins) / 2
        ElseIf Income < 107000 Then
            P = 104000 * (Hins + Cins) / 2
        ElseIf Income < 114000 Then
            P = 110000 * (Hins + Cins) / 2
        ElseIf Income < 122000 Then
            P = 118000 * (Hins + Cins) / 2
        ElseIf Income < 130000 Then
            P = 126000 * (Hins + Cins) / 2
        ElseIf Income < 138000 Then
            P = 134000 * (Hins + Cins) / 2
        ElseIf Income < 146000 Then
            P = 142000 * (Hins + Cins) / 2
        ElseIf Income < 155000 Then
            P = 150000 * (Hins + Cins) / 2
        ElseIf Income < 165000 Then
            P = 160000 * (Hins + Cins) / 2
        
        ElseIf Income < 175000 Then
            P = 170000 * (Hins + Cins) / 2
        ElseIf Income < 185000 Then
            P = 180000 * (Hins + Cins) / 2
        ElseIf Income < 195000 Then
            P = 190000 * (Hins + Cins) / 2
        ElseIf Income < 210000 Then
            P = 200000 * (Hins + Cins) / 2
        ElseIf Income < 230000 Then
            P = 220000 * (Hins + Cins) / 2
        ElseIf Income < 250000 Then
            P = 240000 * (Hins + Cins) / 2
        ElseIf Income < 270000 Then
            P = 260000 * (Hins + Cins) / 2
        ElseIf Income < 290000 Then
            P = 280000 * (Hins + Cins) / 2
        ElseIf Income < 310000 Then
            P = 300000 * (Hins + Cins) / 2
        ElseIf Income < 330000 Then
            P = 320000 * (Hins + Cins) / 2
        
        ElseIf Income < 350000 Then
            P = 340000 * (Hins + Cins) / 2
        ElseIf Income < 370000 Then
            P = 360000 * (Hins + Cins) / 2
        ElseIf Income < 395000 Then
            P = 380000 * (Hins + Cins) / 2
        ElseIf Income < 425000 Then
            P = 410000 * (Hins + Cins) / 2
        ElseIf Income < 455000 Then
            P = 440000 * (Hins + Cins) / 2
        ElseIf Income < 485000 Then
            P = 470000 * (Hins + Cins) / 2
        ElseIf Income < 515000 Then
            P = 500000 * (Hins + Cins) / 2
        ElseIf Income < 545000 Then
            P = 530000 * (Hins + Cins) / 2
        ElseIf Income < 575000 Then
            P = 560000 * (Hins + Cins) / 2
        ElseIf Income < 605000 Then
            P = 590000 * (Hins + Cins) / 2
        
        ElseIf Income < 635000 Then
            P = (620000 * (Hins + Cins) / 2)
        ElseIf Income < 665000 Then
            P = (650000 * (Hins + Cins) / 2)
        ElseIf Income < 695000 Then
            P = (680000 * (Hins + Cins) / 2)
        ElseIf Income < 730000 Then
            P = (710000 * (Hins + Cins) / 2)
        ElseIf Income < 770000 Then
            P = (750000 * (Hins + Cins) / 2)
        ElseIf Income < 810000 Then
            P = (790000 * (Hins + Cins) / 2)
        ElseIf Income < 855000 Then
            P = (830000 * (Hins + Cins) / 2)
        ElseIf Income < 905000 Then
            P = (880000 * (Hins + Cins) / 2)
        ElseIf Income < 955000 Then
            P = (930000 * (Hins + Cins) / 2)
        
        ElseIf Income < 1005000 Then
            P = (980000 * (Hins + Cins) / 2)
        ElseIf Income < 1055000 Then
            P = (1030000 * (Hins + Cins) / 2)
        ElseIf Income < 1115000 Then
            P = (1090000 * (Hins + Cins) / 2)
        ElseIf Income < 1175000 Then
            P = (1150000 * (Hins + Cins) / 2)
        
        ElseIf Income >= 1175000 Then
            P = (1210000 * (Hins + Cins) / 2)
        Else
        
        
        End If
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
    
    End Select
    
    SocialInsTS = P
    
    
    

End Function


'●賞与から控除する社会保険料の計算
'（健康保険（介護も考慮）＋厚生年金）
'Income=所得,Age=年齢
Function SocialInsBTS(Income, Age)

Application.Volatile

    Dim Hins As Single    '健康保険料率
    Dim Pins As Single    '厚生年金保険料率
    Dim Cins As Single    '介護保険料率
    Dim P As Variant, H As Variant
    Dim Hmax As Long
    Dim Pmax As Long
    
    
    '料率設定
'    Hins = 10      '全国平均の保険料率
'    Pins = 17.12
'    Cins = 1.72
    
    Hins = Worksheets("シミュレーション").Range("O7")    '健康保険
    Pins = Worksheets("シミュレーション").Range("O9")    '厚生年金
    Cins = Worksheets("シミュレーション").Range("O8")    '介護

    Hmax = Worksheets("シミュレーション").Range("O11")    '社保上限
    Pmax = Worksheets("シミュレーション").Range("O12")    '厚生年金上限
    
    Income = Int(Income / 1000) * 1000
    
    
    Select Case Age
    Case 0 To 39    '介護保険なし
        '健康保険
        If Income > Hmax Then
            H = Hmax * Hins / 2
        Else
            H = Income * Hins / 2
        End If

    
    Case 40 To 64   '介護保険あり
        '健康保険
        If Income > Hmax Then
            H = Hmax * (Hins + Cins) / 2
        Else
            H = Income * (Hins + Cins) / 2
        End If

   
    Case 65 To 74   '健康保険だけ
    
    
    If Income > Hmax Then
            H = Hmax * Hins / 2
        Else
            H = Income * Hins / 2
        End If



    End Select
    
     
     
     SocialInsBTS = H
    

End Function

Function SocialInsBPTS(Income, Age)

Application.Volatile

    Dim Hins As Single    '健康保険料率
    Dim Pins As Single    '厚生年金保険料率
    Dim Cins As Single    '介護保険料率
    Dim P As Variant, H As Variant
    Dim Hmax As Long
    Dim Pmax As Long
    
    
    '料率設定
'    Hins = 10      '全国平均の保険料率
'    Pins = 17.12
'    Cins = 1.72
    
    Hins = Worksheets("シミュレーション").Range("O7")    '健康保険
    Pins = Worksheets("シミュレーション").Range("O9")    '厚生年金
    Cins = Worksheets("シミュレーション").Range("O8")    '介護

    Hmax = Worksheets("シミュレーション").Range("O11")    '社保上限
    Pmax = Worksheets("シミュレーション").Range("O12")    '厚生年金上限
    
    Income = Int(Income / 1000) * 1000
    
    Select Case Age
    
    Case 0 To 39    '介護保険なし
        
        '厚生年金
        If Income > Pmax Then
            P = Pmax * Pins / 2
        Else
            P = Income * Pins / 2
        End If
    
    Case 40 To 70   '介護保険あり
        '健康保険
      
        '厚生年金
        If Income > Pmax Then
            P = Pmax * Pins / 2
        Else
            P = Income * Pins / 2
        End If
        
        
        
        
        
        
        
    End Select
    
    SocialInsBPTS = P
    

End Function


'給与所得控除額控除後の給与
'引数：給与収入（円）
'　　　計算モード（1:現状, 2:改正後(29年以後)）
Function KoujyogoTS(Num) As Double

Application.Volatile
 
   Dim SNum As Double     '給与所得
'


If Num < 650000 Then
        SNum = 0
        
    ElseIf Num <= 1900000 Then
        SNum = Num - 650000
        
        
    ElseIf Num < 3600000 Then
        SNum = Num * 0.7 - 80000
        
    ElseIf Num < 6600000 Then
        SNum = Num * 0.8 - 440000
        
        
    ElseIf Num < 8500000 Then
        SNum = Num * 0.9 - 1100000
        
    Else
    
        SNum = Num - 1950000

    End If
    
    KoujyogoTS = SNum

End Function

Function Koujyogo_ch(Num) As Double

'子育て介護世帯の場合

Application.Volatile
 
   Dim SNum As Double     '給与所得
'



If Num < 650000 Then
        SNum = 0
        
    ElseIf Num <= 1900000 Then
        SNum = Num - 650000
        
        
    ElseIf Num < 3600000 Then
        SNum = Num * 0.7 - 80000
        
    ElseIf Num < 6600000 Then
        SNum = Num * 0.8 - 440000
        
        
    ElseIf Num < 10000000 Then
        SNum = Num * 0.9 - 1100000
        
    Else
    
        SNum = Num - 2100000

    End If
    
    Koujyogo_ch = SNum

End Function




'
'　　　計算モード（1:現状, 2:改正後(25年以後)）
Function incometaxTS(Num) As Double

Application.Volatile
 
   Dim SNum As Double
    
    If Num <= 1950000 Then
    
        SNum = Num * 0.05
        
    ElseIf Num <= 3300000 Then
    
        SNum = Num * 0.1 - 97500
        
    ElseIf Num <= 6950000 Then
    
        SNum = Num * 0.2 - 427500
        
    ElseIf Num <= 9000000 Then
    
        SNum = Num * 0.23 - 636000
        
        
    ElseIf Num <= 18000000 Then
    
        SNum = Num * 0.33 - 1536000
        
        
    ElseIf Num <= 40000000 Then
    
        SNum = Num * 0.4 - 2796000
        
        
    ElseIf Num > 40000000 Then
    
        SNum = Num * 0.45 - 4796000

    End If
    
    incometaxTS = SNum

End Function

'法人税


Function ctax(Num) As Double

Application.Volatile

    Dim h1 As Single    'houjizeiritu 1
    Dim h2 As Single    'houjinzeiritu2
    Dim ch As Single   'chihouhoujinzeritu

    Dim zei As Double
    
  ch = Worksheets("法人成り").Range("B7") + 1

  h1 = Worksheets("法人成り").Range("B5") * ch
  
  h2 = Worksheets("法人成り").Range("B6") * ch
  
  


If Num <= 8000000 Then

   zei = Num * h1

   

  
ElseIf Num > 8000000 Then

 zei = Num * h2 - 8000000 * (h2 - h1)
 
End If


 ctax = zei
 
 


End Function

'
'法人事業税


Function biztax(Num) As Double

Application.Volatile

Dim B1 As Single 'jigyouzeiritu1
Dim B2 As Single  'jigyouzeiritu2
Dim B3 As Single  'jigyouzeiritu3
Dim cht As Single 'chihouhoujinntokubetuzei


Dim zei As Double


  cht = Worksheets("法人成り").Range("B14") + 1

  B1 = Worksheets("法人成り").Range("B11") * cht
  
  B2 = Worksheets("法人成り").Range("B12") * cht
  
  B3 = Worksheets("法人成り").Range("B13") * cht


If Num <= 4000000 Then

   zei = Num * B1
   
ElseIf Num <= 8000000 Then

  zei = Num * B2 - 4000000 * (B2 - B1)
  
ElseIf Num > 8000000 Then

 zei = Num * B3 - 4000000 * (B3 - B2) - 4000000 * (B3 - B1)
 
End If


 biztax = zei
 
 


End Function


'法人事業税医療法人

Function Mbiztax(Num) As Double

Application.Volatile

Dim B1 As Single 'jigyouzeiritu1
Dim B2 As Single  'jigyouzeiritu2

Dim cht As Single 'chihouhoujinntokubetuzei


Dim zei As Double


  cht = Worksheets("法人成り").Range("B14") + 1

  B1 = Worksheets("法人成り").Range("C11") * cht
  
  B2 = Worksheets("法人成り").Range("C12") * cht
  
  


If Num <= 4000000 Then

   zei = Num * B1
   

  
ElseIf Num > 4000000 Then

 zei = Num * B2 - 4000000 * (B2 - B1)
 
End If


 Mbiztax = zei
 
 


End Function

'月額給与から控除する社会保険料の計算
'（健康保険（介護も考慮）＋厚生年金）
'Income=所得,Age=年齢
Function Pension(Income, Age)

Application.Volatile
    
    Dim Pins As Single    '厚生年金保険料率
   
    Dim P As Variant
    
    '料率設定
      '全国平均の保険料率
    Pins = Worksheets("シミュレーション").Range("O9")
    
    
    Income = Int(Income)
    
     Select Case Age
    
      Case 0 To 70
    
    
        If Income <= 0 Then
            P = 0
       
        ElseIf Income < 93000 Then
            P = (88000 * Pins / 2)
        
        ElseIf Income < 101000 Then
            P = 98000 * Pins / 2
        ElseIf Income < 107000 Then
            P = 104000 * Pins / 2
        ElseIf Income < 114000 Then
            P = 110000 * Pins / 2
        ElseIf Income < 122000 Then
            P = 118000 * Pins / 2
        ElseIf Income < 130000 Then
            P = 126000 * Pins / 2
        ElseIf Income < 138000 Then
            P = 134000 * Pins / 2
        ElseIf Income < 146000 Then
            P = 142000 * Pins / 2
        ElseIf Income < 155000 Then
            P = 150000 * Pins / 2
        ElseIf Income < 165000 Then
            P = 160000 * Pins / 2
        
        ElseIf Income < 175000 Then
            P = 170000 * Pins / 2
        ElseIf Income < 185000 Then
            P = 180000 * Pins / 2
        ElseIf Income < 195000 Then
            P = 190000 * Pins / 2
        ElseIf Income < 210000 Then
            P = 200000 * Pins / 2
        ElseIf Income < 230000 Then
            P = 220000 * Pins / 2
        ElseIf Income < 250000 Then
            P = 240000 * Pins / 2
        ElseIf Income < 270000 Then
            P = 260000 * Pins / 2
        ElseIf Income < 290000 Then
            P = 280000 * Pins / 2
        ElseIf Income < 310000 Then
            P = 300000 * Pins / 2
        ElseIf Income < 330000 Then
            P = 320000 * Pins / 2
        
        ElseIf Income < 350000 Then
            P = 340000 * Pins / 2
        ElseIf Income < 370000 Then
            P = 360000 * Pins / 2
        ElseIf Income < 395000 Then
            P = 380000 * Pins / 2
        ElseIf Income < 425000 Then
            P = 410000 * Pins / 2
        ElseIf Income < 455000 Then
            P = 440000 * Pins / 2
        ElseIf Income < 485000 Then
            P = 470000 * Pins / 2
        ElseIf Income < 515000 Then
            P = 500000 * Pins / 2
        ElseIf Income < 545000 Then
            P = 530000 * Pins / 2
        ElseIf Income < 575000 Then
            P = 560000 * Pins / 2
        ElseIf Income < 605000 Then
            P = 590000 * Pins / 2
            
        ElseIf Income < 635000 Then
            P = 620000 * Pins / 2
            
        
        ElseIf Income >= 635000 Then
        
            P = 650000 * Pins / 2
       
        End If
        
        
        
        
  End Select
        
        
   
    
    Pension = P
    
    
    

End Function




'月額給与から控除する社会保険料の計算
'（健康保険（介護も考慮）＋厚生年金）
'Income=所得,Age=年齢
Function health(Income, Age)

Application.Volatile

    Dim Hins As Single    '健康保険料率
   
    Dim Cins As Single    '介護保険料率
    Dim P As Variant
    
    '料率設定
    Hins = Worksheets("シミュレーション").Range("O7")     '全国平均の保険料率
    
    Cins = Worksheets("シミュレーション").Range("O8")
    
    Income = Int(Income)
    
    Select Case Age
    
    Case 0 To 39    '介護保険なし
        If Income <= 0 Then
            P = 0
        ElseIf Income < 63000 Then
            P = (58000 * Hins / 2)
        ElseIf Income < 73000 Then
            P = (68000 * Hins / 2)
        ElseIf Income < 83000 Then
            P = (78000 * Hins / 2)
        ElseIf Income < 93000 Then
            P = (88000 * Hins / 2)
        
        ElseIf Income < 101000 Then
            P = 98000 * (Hins) / 2
        ElseIf Income < 107000 Then
            P = 104000 * (Hins) / 2
        ElseIf Income < 114000 Then
            P = 110000 * (Hins) / 2
        ElseIf Income < 122000 Then
            P = 118000 * (Hins) / 2
        ElseIf Income < 130000 Then
            P = 126000 * (Hins) / 2
        ElseIf Income < 138000 Then
            P = 134000 * (Hins) / 2
        ElseIf Income < 146000 Then
            P = 142000 * (Hins) / 2
        ElseIf Income < 155000 Then
            P = 150000 * (Hins) / 2
        ElseIf Income < 165000 Then
            P = 160000 * (Hins) / 2
        
        ElseIf Income < 175000 Then
            P = 170000 * (Hins) / 2
        ElseIf Income < 185000 Then
            P = 180000 * (Hins) / 2
        ElseIf Income < 195000 Then
            P = 190000 * (Hins) / 2
        ElseIf Income < 210000 Then
            P = 200000 * (Hins) / 2
        ElseIf Income < 230000 Then
            P = 220000 * (Hins) / 2
        ElseIf Income < 250000 Then
            P = 240000 * (Hins) / 2
        ElseIf Income < 270000 Then
            P = 260000 * (Hins) / 2
        ElseIf Income < 290000 Then
            P = 280000 * (Hins) / 2
        ElseIf Income < 310000 Then
            P = 300000 * (Hins) / 2
        ElseIf Income < 330000 Then
            P = 320000 * (Hins) / 2
        
        ElseIf Income < 350000 Then
            P = 340000 * (Hins) / 2
        ElseIf Income < 370000 Then
            P = 360000 * (Hins) / 2
        ElseIf Income < 395000 Then
            P = 380000 * (Hins) / 2
        ElseIf Income < 425000 Then
            P = 410000 * (Hins) / 2
        ElseIf Income < 455000 Then
            P = 440000 * (Hins) / 2
        ElseIf Income < 485000 Then
            P = 470000 * (Hins) / 2
        ElseIf Income < 515000 Then
            P = 500000 * (Hins) / 2
        ElseIf Income < 545000 Then
            P = 530000 * (Hins) / 2
        ElseIf Income < 575000 Then
            P = 560000 * (Hins) / 2
        ElseIf Income < 605000 Then
            P = 590000 * (Hins) / 2
        
        ElseIf Income < 635000 Then
            P = (620000 * Hins / 2)
        ElseIf Income < 665000 Then
            P = (650000 * Hins / 2)
        ElseIf Income < 695000 Then
            P = (680000 * Hins / 2)
        ElseIf Income < 730000 Then
            P = (710000 * Hins / 2)
        ElseIf Income < 770000 Then
            P = (750000 * Hins / 2)
        ElseIf Income < 810000 Then
            P = (790000 * Hins / 2)
        ElseIf Income < 855000 Then
            P = (830000 * Hins / 2)
        ElseIf Income < 905000 Then
            P = (880000 * Hins / 2)
        ElseIf Income < 955000 Then
            P = (930000 * Hins / 2)
        
        ElseIf Income < 1005000 Then
            P = (980000 * Hins / 2)
        ElseIf Income < 1055000 Then
            P = (1030000 * Hins / 2)
        ElseIf Income < 1115000 Then
            P = (1090000 * Hins / 2)
        ElseIf Income < 1175000 Then
            P = (1150000 * Hins / 2)
            
            
         ElseIf Income < 1235000 Then
            P = (1210000 * Hins / 2)
            
        ElseIf Income < 1295000 Then
            P = (1270000 * Hins / 2)
            
        ElseIf Income < 1355000 Then
            P = (1330000 * Hins / 2)
            
        ElseIf Income >= 1355000 Then
            P = (1390000 * Hins / 2)
            
            
          
            
            
        Else
        End If
    
    Case 40 To 64  '介護保険あり
    
        If Income <= 0 Then
            P = 0
        ElseIf Income < 63000 Then
            P = (58000 * (Hins + Cins) / 2)
        ElseIf Income < 73000 Then
            P = (68000 * (Hins + Cins) / 2)
        ElseIf Income < 83000 Then
            P = (78000 * (Hins + Cins) / 2)
        ElseIf Income < 93000 Then
            P = (88000 * (Hins + Cins) / 2)
        
        ElseIf Income < 101000 Then
            P = 98000 * (Hins + Cins) / 2
        ElseIf Income < 107000 Then
            P = 104000 * (Hins + Cins) / 2
        ElseIf Income < 114000 Then
            P = 110000 * (Hins + Cins) / 2
        ElseIf Income < 122000 Then
            P = 118000 * (Hins + Cins) / 2
        ElseIf Income < 130000 Then
            P = 126000 * (Hins + Cins) / 2
        ElseIf Income < 138000 Then
            P = 134000 * (Hins + Cins) / 2
        ElseIf Income < 146000 Then
            P = 142000 * (Hins + Cins) / 2
        ElseIf Income < 155000 Then
            P = 150000 * (Hins + Cins) / 2
        ElseIf Income < 165000 Then
            P = 160000 * (Hins + Cins) / 2
        
        ElseIf Income < 175000 Then
            P = 170000 * (Hins + Cins) / 2
        ElseIf Income < 185000 Then
            P = 180000 * (Hins + Cins) / 2
        ElseIf Income < 195000 Then
            P = 190000 * (Hins + Cins) / 2
        ElseIf Income < 210000 Then
            P = 200000 * (Hins + Cins) / 2
        ElseIf Income < 230000 Then
            P = 220000 * (Hins + Cins) / 2
        ElseIf Income < 250000 Then
            P = 240000 * (Hins + Cins) / 2
        ElseIf Income < 270000 Then
            P = 260000 * (Hins + Cins) / 2
        ElseIf Income < 290000 Then
            P = 280000 * (Hins + Cins) / 2
        ElseIf Income < 310000 Then
            P = 300000 * (Hins + Cins) / 2
        ElseIf Income < 330000 Then
            P = 320000 * (Hins + Cins) / 2
        
        ElseIf Income < 350000 Then
            P = 340000 * (Hins + Cins) / 2
        ElseIf Income < 370000 Then
            P = 360000 * (Hins + Cins) / 2
        ElseIf Income < 395000 Then
            P = 380000 * (Hins + Cins) / 2
        ElseIf Income < 425000 Then
            P = 410000 * (Hins + Cins) / 2
        ElseIf Income < 455000 Then
            P = 440000 * (Hins + Cins) / 2
        ElseIf Income < 485000 Then
            P = 470000 * (Hins + Cins) / 2
        ElseIf Income < 515000 Then
            P = 500000 * (Hins + Cins) / 2
        ElseIf Income < 545000 Then
            P = 530000 * (Hins + Cins) / 2
        ElseIf Income < 575000 Then
            P = 560000 * (Hins + Cins) / 2
        ElseIf Income < 605000 Then
            P = 590000 * (Hins + Cins) / 2
        
        ElseIf Income < 635000 Then
            P = (620000 * (Hins + Cins) / 2)
        ElseIf Income < 665000 Then
            P = (650000 * (Hins + Cins) / 2)
        ElseIf Income < 695000 Then
            P = (680000 * (Hins + Cins) / 2)
        ElseIf Income < 730000 Then
            P = (710000 * (Hins + Cins) / 2)
        ElseIf Income < 770000 Then
            P = (750000 * (Hins + Cins) / 2)
        ElseIf Income < 810000 Then
            P = (790000 * (Hins + Cins) / 2)
        ElseIf Income < 855000 Then
            P = (830000 * (Hins + Cins) / 2)
        ElseIf Income < 905000 Then
            P = (880000 * (Hins + Cins) / 2)
        ElseIf Income < 955000 Then
            P = (930000 * (Hins + Cins) / 2)
        
        ElseIf Income < 1005000 Then
            P = (980000 * (Hins + Cins) / 2)
        ElseIf Income < 1055000 Then
            P = (1030000 * (Hins + Cins) / 2)
        ElseIf Income < 1115000 Then
            P = (1090000 * (Hins + Cins) / 2)
        ElseIf Income < 1175000 Then
            P = (1150000 * (Hins + Cins) / 2)
            
            
         ElseIf Income < 1235000 Then
            P = (1210000 * (Hins + Cins) / 2)
            
        ElseIf Income < 1295000 Then
            P = (1270000 * (Hins + Cins) / 2)
            
        ElseIf Income < 1355000 Then
            P = (1330000 * (Hins + Cins) / 2)
                  
        
        ElseIf Income >= 1355000 Then
            P = (1390000 * (Hins + Cins) / 2)
            
            
            
            
      
        Else
        
        
        End If
        
        
        
        Case 65 To 74   '健康保険だけ
        
        If Income <= 0 Then
            P = 0
        ElseIf Income < 63000 Then
            P = (58000 * (Hins + Cins) / 2)
        ElseIf Income < 73000 Then
            P = (68000 * (Hins + Cins) / 2)
        ElseIf Income < 83000 Then
            P = (78000 * (Hins + Cins) / 2)
        ElseIf Income < 93000 Then
            P = (88000 * (Hins + Cins) / 2)
        
        ElseIf Income < 101000 Then
            P = 98000 * (Hins + Cins) / 2
        ElseIf Income < 107000 Then
            P = 104000 * (Hins + Cins) / 2
        ElseIf Income < 114000 Then
            P = 110000 * (Hins + Cins) / 2
        ElseIf Income < 122000 Then
            P = 118000 * (Hins + Cins) / 2
        ElseIf Income < 130000 Then
            P = 126000 * (Hins + Cins) / 2
        ElseIf Income < 138000 Then
            P = 134000 * (Hins + Cins) / 2
        ElseIf Income < 146000 Then
            P = 142000 * (Hins + Cins) / 2
        ElseIf Income < 155000 Then
            P = 150000 * (Hins + Cins) / 2
        ElseIf Income < 165000 Then
            P = 160000 * (Hins + Cins) / 2
        
        ElseIf Income < 175000 Then
            P = 170000 * (Hins + Cins) / 2
        ElseIf Income < 185000 Then
            P = 180000 * (Hins + Cins) / 2
        ElseIf Income < 195000 Then
            P = 190000 * (Hins + Cins) / 2
        ElseIf Income < 210000 Then
            P = 200000 * (Hins + Cins) / 2
        ElseIf Income < 230000 Then
            P = 220000 * (Hins + Cins) / 2
        ElseIf Income < 250000 Then
            P = 240000 * (Hins + Cins) / 2
        ElseIf Income < 270000 Then
            P = 260000 * (Hins + Cins) / 2
        ElseIf Income < 290000 Then
            P = 280000 * (Hins + Cins) / 2
        ElseIf Income < 310000 Then
            P = 300000 * (Hins + Cins) / 2
        ElseIf Income < 330000 Then
            P = 320000 * (Hins + Cins) / 2
        
        ElseIf Income < 350000 Then
            P = 340000 * (Hins + Cins) / 2
        ElseIf Income < 370000 Then
            P = 360000 * (Hins + Cins) / 2
        ElseIf Income < 395000 Then
            P = 380000 * (Hins + Cins) / 2
        ElseIf Income < 425000 Then
            P = 410000 * (Hins + Cins) / 2
        ElseIf Income < 455000 Then
            P = 440000 * (Hins + Cins) / 2
        ElseIf Income < 485000 Then
            P = 470000 * (Hins + Cins) / 2
        ElseIf Income < 515000 Then
            P = 500000 * (Hins + Cins) / 2
        ElseIf Income < 545000 Then
            P = 530000 * (Hins + Cins) / 2
        ElseIf Income < 575000 Then
            P = 560000 * (Hins + Cins) / 2
        ElseIf Income < 605000 Then
            P = 590000 * (Hins + Cins) / 2
        
        ElseIf Income < 635000 Then
            P = (620000 * (Hins + Cins) / 2)
        ElseIf Income < 665000 Then
            P = (650000 * (Hins + Cins) / 2)
        ElseIf Income < 695000 Then
            P = (680000 * (Hins + Cins) / 2)
        ElseIf Income < 730000 Then
            P = (710000 * (Hins + Cins) / 2)
        ElseIf Income < 770000 Then
            P = (750000 * (Hins + Cins) / 2)
        ElseIf Income < 810000 Then
            P = (790000 * (Hins + Cins) / 2)
        ElseIf Income < 855000 Then
            P = (830000 * (Hins + Cins) / 2)
        ElseIf Income < 905000 Then
            P = (880000 * (Hins + Cins) / 2)
        ElseIf Income < 955000 Then
            P = (930000 * (Hins + Cins) / 2)
        
        ElseIf Income < 1005000 Then
            P = (980000 * (Hins + Cins) / 2)
        ElseIf Income < 1055000 Then
            P = (1030000 * (Hins + Cins) / 2)
        ElseIf Income < 1115000 Then
            P = (1090000 * (Hins + Cins) / 2)
        ElseIf Income < 1175000 Then
            P = (1150000 * (Hins + Cins) / 2)
        
        
        ElseIf Income < 1235000 Then
            P = (1210000 * Hins / 2)
            
        ElseIf Income < 1295000 Then
            P = (1270000 * Hins / 2)
            
        ElseIf Income < 1355000 Then
            P = (1330000 * Hins / 2)
            
        ElseIf Income >= 1355000 Then
            P = (1390000 * Hins / 2)
            
           
            
            
        Else
        
        
        End If
        
        
      
        
        
    
    End Select
    
    health = P
    
    
    

End Function



Function PensionIncome(Num As Double, Age As Integer, OtherIncome As Double) As Double

    Dim result As Double
    Dim is65orOver As Boolean

    is65orOver = (Age >= 65)

    '--- 控除テーブルの分岐（その他所得による3区分）---
    If OtherIncome <= 10000000 Then
        '【表1】公的年金等以外の合計所得金額が1,000万円以下

        If is65orOver Then
            '65歳以上
            If Num <= 1100000 Then
                result = 0
            ElseIf Num < 3300000 Then
                result = Num - 1100000
            ElseIf Num < 4100000 Then
                result = Num * 0.75 - 275000
            ElseIf Num < 7700000 Then
                result = Num * 0.85 - 685000
            ElseIf Num < 10000000 Then
                result = Num * 0.95 - 1455000
            Else
                result = Num - 1955000
            End If
        Else
            '65歳未満
            If Num <= 600000 Then
                result = 0
            ElseIf Num < 1300000 Then
                result = Num - 600000
            ElseIf Num < 4100000 Then
                result = Num * 0.75 - 275000
            ElseIf Num < 7700000 Then
                result = Num * 0.85 - 685000
            ElseIf Num < 10000000 Then
                result = Num * 0.95 - 1455000
            Else
                result = Num - 1955000
            End If
        End If

    ElseIf OtherIncome <= 20000000 Then
        '【表2】公的年金等以外の合計所得金額が1,000万円超2,000万円以下

        If is65orOver Then
            '65歳以上
            If Num <= 1000000 Then
                result = 0
            ElseIf Num < 3300000 Then
                result = Num - 1000000
            ElseIf Num < 4100000 Then
                result = Num * 0.75 - 175000
            ElseIf Num < 7700000 Then
                result = Num * 0.85 - 585000
            ElseIf Num < 10000000 Then
                result = Num * 0.95 - 1355000
            Else
                result = Num - 1855000
            End If
        Else
            '65歳未満
            If Num <= 500000 Then
                result = 0
            ElseIf Num < 1300000 Then
                result = Num - 500000
            ElseIf Num < 4100000 Then
                result = Num * 0.75 - 175000
            ElseIf Num < 7700000 Then
                result = Num * 0.85 - 585000
            ElseIf Num < 10000000 Then
                result = Num * 0.95 - 1355000
            Else
                result = Num - 1855000
            End If
        End If

    Else
        '【表3】公的年金等以外の合計所得金額が2,000万円超

        If is65orOver Then
            '65歳以上
            If Num <= 900000 Then
                result = 0
            ElseIf Num < 3300000 Then
                result = Num - 900000
            ElseIf Num < 4100000 Then
                result = Num * 0.75 - 75000
            ElseIf Num < 7700000 Then
                result = Num * 0.85 - 485000
            ElseIf Num < 10000000 Then
                result = Num * 0.95 - 1255000
            Else
                result = Num - 1755000
            End If
        Else
            '65歳未満
            If Num <= 400000 Then
                result = 0
            ElseIf Num < 1300000 Then
                result = Num - 400000
            ElseIf Num < 4100000 Then
                result = Num * 0.75 - 75000
            ElseIf Num < 7700000 Then
                result = Num * 0.85 - 485000
            ElseIf Num < 10000000 Then
                result = Num * 0.95 - 1255000
            Else
                result = Num - 1755000
            End If
        End If

    End If

    '雑所得はマイナスにならない
    PensionIncome = IIf(result < 0, 0, result)

End Function



-------------------------------------------------------------------------------
```
