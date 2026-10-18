param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$OutputPath
)
# Read-only XLSX extraction for the website import. No workbook is edited.
# Keep the intermediate JSON outside the repository: it may contain private notes.
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $InputPath).Path)
function Read-EntryXml([string]$Name) {
  $entry = $archive.GetEntry($Name)
  if ($null -eq $entry) { return $null }
  $reader = [System.IO.StreamReader]::new($entry.Open())
  try { return [xml]$reader.ReadToEnd() } finally { $reader.Dispose() }
}
try {
  $strings = @()
  $shared = Read-EntryXml 'xl/sharedStrings.xml'
  if ($shared) {
    $strings = @($shared.SelectNodes('//*[local-name()="si"]') | ForEach-Object {
      ($_.SelectNodes('.//*[local-name()="t"]') | ForEach-Object InnerText) -join ''
    })
  }
  $book = Read-EntryXml 'xl/workbook.xml'
  $rels = Read-EntryXml 'xl/_rels/workbook.xml.rels'
  $result = @()
  foreach ($sheet in $book.workbook.sheets.sheet) {
    $relation = $rels.Relationships.Relationship | Where-Object Id -EQ $sheet.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
    $target = $relation.Target
    $entryPath = if ($target.StartsWith('/')) { $target.TrimStart('/') } else { 'xl/' + $target }
    $xml = Read-EntryXml $entryPath
    $rows = @()
    foreach ($row in $xml.SelectNodes('//*[local-name()="sheetData"]/*[local-name()="row"]')) {
      $cells = [ordered]@{}
      foreach ($cell in $row.SelectNodes('./*[local-name()="c"]')) {
        $valueNode = $cell.SelectSingleNode('./*[local-name()="v"]')
        $value = if ($valueNode) { $valueNode.InnerText } else { '' }
        if ($cell.t -eq 's') { $value = $strings[[int]$value] }
        elseif ($cell.t -eq 'inlineStr') { $value = ($cell.SelectNodes('.//*[local-name()="t"]') | ForEach-Object InnerText) -join '' }
        if ($value -ne '') { $cells[$cell.r] = $value }
      }
      if ($cells.Count) { $rows += [ordered]@{ row = [int]$row.r; cells = $cells } }
    }
    $result += [ordered]@{ sheet = $sheet.name; rows = $rows }
  }
  $result | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $OutputPath -Encoding utf8
  $result | ForEach-Object {
    [ordered]@{ sheet = $_.sheet; nonempty_rows = $_.rows.Count; first_rows = @($_.rows | Select-Object -First 3) } | ConvertTo-Json -Depth 8 -Compress
  }
} finally { $archive.Dispose() }
