param([Parameter(Mandatory=$true)][string]$AgentBrowser)
$ErrorActionPreference='Stop'
function Run-Eval([string]$Code) {
  $payload = (& $AgentBrowser --session family-inspect --json eval $Code) | ConvertFrom-Json
  if (!$payload.success) { throw ($payload | ConvertTo-Json) }
  return $payload.data.result
}
function Assert-UI([string]$Name, [string]$Code) {
  if (!(Run-Eval $Code)) { throw "FAILED: $Name" }
  Write-Output "PASS: $Name"
}
function Open-Page([string]$Route) {
  & $AgentBrowser --session family-inspect open "http://127.0.0.1:4179$Route" | Out-Null
  & $AgentBrowser --session family-inspect wait --load networkidle | Out-Null
}
function Open-Button([string]$Text) {
  # Focus then dispatch the existing button handler; the harness rejects every write request.
  Run-Eval "(() => { const b=Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()==='$Text' && e.getBoundingClientRect().width>0); if(!b) throw Error('button missing'); b.focus(); b.click(); return true; })()" | Out-Null
}
Open-Page '/bills'
& $AgentBrowser --session family-inspect set viewport 390 844 | Out-Null
Open-Page '/bills'
Assert-UI 'bill month card omits duplicate date range' "!Array.from(document.querySelectorAll('span,div')).some(e=>/^\d{4}-\d{2}-\d{2}\s*~\s*\d{4}-\d{2}-\d{2}$/.test(e.textContent.trim()) && e.children.length===0)"
Open-Button '付款'
Assert-UI 'payment dialog open and focused' "document.activeElement?.getAttribute('role') === 'dialog'"
Assert-UI 'bill payment offers company merchant choices' "Array.from(document.querySelectorAll('[role=dialog] button')).some(e=>e.textContent.includes('測試用超長名稱'))"
Assert-UI 'payment dialog within viewport' "(()=>{const r=document.querySelector('[role=dialog]').getBoundingClientRect();return r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight})()"
& $AgentBrowser --session family-inspect press Shift+Tab | Out-Null
Assert-UI 'reverse Tab stays inside modal' "!!document.activeElement.closest('[role=dialog]')"

Open-Page '/settings/merchants'
Assert-UI 'merchant management exposes ordering handle' "!!document.querySelector('button[aria-label^=調整店家]')"
& $AgentBrowser --session family-inspect press Tab | Out-Null
Assert-UI 'Tab wraps inside modal' "!!document.activeElement.closest('[role=dialog]')"
& $AgentBrowser --session family-inspect press Escape | Out-Null
Assert-UI 'Escape closes and restores focus' "!document.querySelector('[role=dialog]') && document.activeElement.textContent.trim()==='付款'"
Open-Button '修改金額'
& $AgentBrowser --session family-inspect set viewport 390 420 | Out-Null
Assert-UI 'short viewport keeps edit modal accessible' "(()=>{const r=document.querySelector('[role=dialog]').getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight})()"
& $AgentBrowser --session family-inspect press Escape | Out-Null
& $AgentBrowser --session family-inspect set viewport 768 1024 | Out-Null
Open-Page '/calendar'
Assert-UI 'tablet calendar clears bottom navigation' "document.querySelector('.family-calendar').getBoundingClientRect().bottom <= document.querySelector('.family-bottom-nav').getBoundingClientRect().top+1"
Run-Eval "(()=>{const b=Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()==='+1' && e.getBoundingClientRect().width>0);if(!b)throw Error('calendar overflow button missing');b.focus();b.click();return true})()" | Out-Null
Assert-UI 'calendar +1 opens hidden event editor' "!!document.querySelector('[role=dialog]') && Array.from(document.querySelectorAll('[role=dialog] input')).some(e=>e.value==='可由加一開啟的行程')"
& $AgentBrowser --session family-inspect press Escape | Out-Null
Run-Eval "(()=>{const b=Array.from(document.querySelectorAll('button')).find(e=>e.getAttribute('aria-label')==='新增行程' && e.getBoundingClientRect().width>0);b.focus();b.click();return true})()" | Out-Null
Assert-UI 'calendar modal opens' "!!document.querySelector('[role=dialog]')"
& $AgentBrowser --session family-inspect press Escape | Out-Null
& $AgentBrowser --session family-inspect set viewport 1440 900 | Out-Null
Open-Page '/stickies'
Assert-UI 'desktop create sticky remains visible' "Array.from(document.querySelectorAll('button')).some(e=>e.textContent.trim()==='新增便條' && e.getBoundingClientRect().width>0)"
Open-Page '/stickies/sticky-1'
Assert-UI 'desktop sticky save delete and return visible' "['儲存','刪除','返回'].every(t=>Array.from(document.querySelectorAll('button')).some(e=>e.textContent.trim()===t && e.getBoundingClientRect().width>0))"
Open-Page '/ledger'
Run-Eval "(()=>{const b=Array.from(document.querySelectorAll('button')).find(e=>e.getAttribute('aria-label')==='編輯' && e.getBoundingClientRect().width>0);b.focus();b.click();return true})()" | Out-Null
Assert-UI 'ledger editor opens' "!!document.querySelector('[role=dialog]')"
& $AgentBrowser --session family-inspect press Escape | Out-Null
Assert-UI 'no interaction script errors' "window.uiTestErrors.length===0"
