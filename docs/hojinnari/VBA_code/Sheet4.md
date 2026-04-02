# Sheet4

```vba
in file: xl/vbaProject.bin - OLE stream: 'VBA/Sheet4'
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
(empty macro)
+----------+--------------------+---------------------------------------------+
|Type      |Keyword             |Description                                  |
+----------+--------------------+---------------------------------------------+
|AutoExec  |CheckBox5_Click     |Runs when the file is opened and ActiveX     |
|          |                    |objects trigger events                       |
|AutoExec  |Worksheet_Change    |Runs when the file is opened and ActiveX     |
|          |                    |objects trigger events                       |
|Suspicious|FileCopy            |May copy a file                              |
|Suspicious|CopyFile            |May copy a file                              |
|Suspicious|Call                |May call a DLL using Excel 4 Macros (XLM/XLF)|
|Suspicious|ActiveWorkbook.SaveA|May save the current workbook                |
|          |s                   |                                             |
|Suspicious|CreateObject        |May create an OLE object                     |
|Suspicious|Hex Strings         |Hex-encoded strings were detected, may be    |
|          |                    |used to obfuscate strings (option --decode to|
|          |                    |see all)                                     |
|Suspicious|Base64 Strings      |Base64-encoded strings were detected, may be |
|          |                    |used to obfuscate strings (option --decode to|
|          |                    |see all)                                     |
|Base64    |K]4                 |S100                                         |
|String    |                    |                                             |
|Base64    |G]4                 |R100                                         |
|String    |                    |                                             |
+----------+--------------------+---------------------------------------------+
```
