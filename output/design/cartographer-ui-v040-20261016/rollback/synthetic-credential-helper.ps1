param([string]$Operation)
if($Operation -ne 'get'){exit 0}
if($env:GIT_TERMINAL_PROMPT -ne '0' -or $env:GCM_INTERACTIVE -ne 'never'){exit 7}
Add-Content -LiteralPath $env:ROLLBACK_SYNTHETIC_MARKER -Value 'synthetic get'
if($env:ROLLBACK_SYNTHETIC_DENY -eq '1'){exit 1}
Write-Output 'username=synthetic-rollback-account'
Write-Output 'password=synthetic-rollback-test-token'
