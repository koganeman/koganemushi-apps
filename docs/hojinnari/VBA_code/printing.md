# printing

```vba
in file: xl/vbaProject.bin - OLE stream: 'VBA/printing'
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
Option Explicit

Sub 印刷シミュレーション()
     
  
     
    Worksheets("シミュレーション").Activate
    
    Range("A1").Select
    
    Application.PrintCommunication = False
    
    ActiveSheet.PageSetup.PrintArea = Range("C4:N54").Address
    
    
    With Worksheets("シミュレーション").PageSetup
'         .Orientation = xlLandscape
'
         .Orientation = xlPortrait
    
        .Zoom = False
        .FitToPagesTall = 1
        .FitToPagesWide = 1
         .LeftMargin = Application.InchesToPoints(0.5)   '左余白（25.2mmに対する％）※５
        .RightMargin = Application.InchesToPoints(0.5)  '右 〃
        .TopMargin = Application.InchesToPoints(0.5)    '上 〃
        .BottomMargin = Application.InchesToPoints(0.5) '下 〃
        .PaperSize = xlPaperA4
        
        
         '.PrintTitleColumns = "$A:$B"            '列タイトル
        
        
        .CenterFooter = ""
        
        .RightFooter = ""
        
        .LeftHeader = ""
        
       
      
       
       
   
        
        
        
    End With
    
    
      Application.PrintCommunication = True
    
      ActiveSheet.PrintPreview
    
  
End Sub


Sub 印刷法人成り()


Worksheets("法人成り").Activate
    
    Range("A1").Select
    
    Application.PrintCommunication = False
    
    ActiveSheet.PageSetup.PrintArea = Range("E3:M39").Address
    
    
    With Worksheets("法人成り").PageSetup
    
         .Orientation = xlLandscape
'
'         .Orientation = xlPortrait
    
        .Zoom = False
        .FitToPagesTall = 1
        .FitToPagesWide = 1
         .LeftMargin = Application.InchesToPoints(0.5)   '左余白（25.2mmに対する％）※５
        .RightMargin = Application.InchesToPoints(0.5)  '右 〃
        .TopMargin = Application.InchesToPoints(0.5)    '上 〃
        .BottomMargin = Application.InchesToPoints(0.5) '下 〃
        .PaperSize = xlPaperA4
        
        
         '.PrintTitleColumns = "$A:$B"            '列タイトル
        
        
        .CenterFooter = ""
        
        .RightFooter = ""
        
        .LeftHeader = ""
        
       
      
       
       
   
        
        
        
    End With
    
    
      Application.PrintCommunication = True
    
     ActiveSheet.PrintPreview



End Sub



Sub 印刷報告書()


Worksheets("報告書").Activate
    
    Range("A1").Select
    
    Application.PrintCommunication = False
    
    ActiveSheet.PageSetup.PrintArea = Range("A1:L33").Address
    
    
    With Worksheets("報告書").PageSetup
         .Orientation = xlLandscape
'
'         .Orientation = xlPortrait
    
        .Zoom = False
        .FitToPagesTall = 1
        .FitToPagesWide = 1
         .LeftMargin = Application.InchesToPoints(0.5)   '左余白（25.2mmに対する％）※５
        .RightMargin = Application.InchesToPoints(0.5)  '右 〃
        .TopMargin = Application.InchesToPoints(0.2)    '上 〃
        .BottomMargin = Application.InchesToPoints(0.2) '下 〃
        .PaperSize = xlPaperA4
        
        
         '.PrintTitleColumns = "$A:$B"            '列タイトル
        
        
        .CenterFooter = ""
        
        .RightFooter = ""
        
        .LeftHeader = ""
        
       
      
       
       
   
        
        
        
    End With
    
     Application.PrintCommunication = True
    
     ActiveSheet.PrintPreview



End Sub

-------------------------------------------------------------------------------
```
