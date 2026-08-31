param([Parameter(Mandatory=$true)][string]$AgentBrowser)
$ErrorActionPreference = 'Stop'
$routes = '/', '/ledger', '/ledger/dashboard', '/bills', '/settlement', '/settlement/history', '/calendar', '/stickies', '/stickies/sticky-1', '/settings/categories', '/settings/payment-methods', '/settings/merchants', '/settings/payers', '/settings/backup', '/login'
$results = @()
foreach ($size in @(@(320,740), @(390,844), @(768,1024), @(1440,900))) {
  & $AgentBrowser --session family-ui set viewport $size[0] $size[1] | Out-Null
  foreach ($route in $routes) {
    & $AgentBrowser --session family-ui open "http://127.0.0.1:4179$route" | Out-Null
    & $AgentBrowser --session family-ui wait --load networkidle | Out-Null
    & $AgentBrowser --session family-ui wait main | Out-Null
    $raw = & $AgentBrowser --session family-ui --json eval '({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,main:!!document.querySelector(''main''),errors:window.uiTestErrors,overlay:!!document.querySelector(''vite-error-overlay'')})'
    $payload = $raw | ConvertFrom-Json
    if (!$payload.success) { throw $raw }
    $data = $payload.data.result
    $pass = $data.main -and !$data.overlay -and $data.scroll -le $data.width -and $data.errors.Count -eq 0
    $results += [PSCustomObject]@{route=$route;width=$size[0];scenario='long names / large amounts';pass=$pass;measurement=$data}
    Write-Output "$($size[0]) $route PASS=$pass scroll=$($data.scroll)"
  }
}
& $AgentBrowser --session family-ui set viewport 390 844 | Out-Null
foreach ($route in $routes) {
  & $AgentBrowser --session family-ui open "http://127.0.0.1:4179${route}?empty=1" | Out-Null
  & $AgentBrowser --session family-ui wait --load networkidle | Out-Null
  & $AgentBrowser --session family-ui wait main | Out-Null
  $raw = & $AgentBrowser --session family-ui --json eval '({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,main:!!document.querySelector(''main''),errors:window.uiTestErrors})'
  $payload = $raw | ConvertFrom-Json
  if (!$payload.success) { throw $raw }
  $data = $payload.data.result
  $pass = $data.main -and $data.scroll -le $data.width -and $data.errors.Count -eq 0
  $results += [PSCustomObject]@{route=$route;width=390;scenario='empty';pass=$pass;measurement=$data}
  Write-Output "390 empty $route PASS=$pass"
}
[IO.Directory]::CreateDirectory((Join-Path $PSScriptRoot '../../.local-verification')) | Out-Null
$results | ConvertTo-Json -Depth 6 | Out-File (Join-Path $PSScriptRoot '../../.local-verification/responsive-results.json') -Encoding utf8
if ($results.Where({!$_.pass}).Count) { exit 1 }
