# Exercises the production credential fallback with synthetic credentials and
# an in-process REST mock. No real credential manager or REST POST is used.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$testProjectRoot=Split-Path -Parent $PSScriptRoot
$testSource=Join-Path $PSScriptRoot 'rollback-v0331.ps1'
$testEvidence=Join-Path $testProjectRoot 'output/design/cartographer-ui-v040-20261016/rollback'
New-Item -ItemType Directory -Path $testEvidence -Force | Out-Null
$testMarker=Join-Path $testEvidence ('synthetic-credential-'+[guid]::NewGuid().ToString('N')+'.txt')
$testHelper=Join-Path $testEvidence 'synthetic-credential-helper.ps1'
@'
param([string]$Operation)
if($Operation -ne 'get'){exit 0}
if($env:GIT_TERMINAL_PROMPT -ne '0' -or $env:GCM_INTERACTIVE -ne 'never'){exit 7}
Add-Content -LiteralPath $env:ROLLBACK_SYNTHETIC_MARKER -Value 'synthetic get'
if($env:ROLLBACK_SYNTHETIC_DENY -eq '1'){exit 1}
Write-Output 'username=synthetic-rollback-account'
Write-Output 'password=synthetic-rollback-test-token'
'@ | Set-Content -LiteralPath $testHelper -Encoding utf8
$testEnvironmentNames=@('GIT_CONFIG_COUNT','GIT_CONFIG_KEY_0','GIT_CONFIG_VALUE_0','GIT_CONFIG_KEY_1','GIT_CONFIG_VALUE_1','ROLLBACK_SYNTHETIC_MARKER','ROLLBACK_SYNTHETIC_DENY')
$testPrevious=@{}
foreach($testName in $testEnvironmentNames){$testPrevious[$testName]=[Environment]::GetEnvironmentVariable($testName,'Process')}
$script:testPostCount=0
$script:testRejectRest=$false
$script:testPublicApiDenied=$false
function Invoke-RestMethod {
    param($Method,$Uri,$Headers,$ContentType,$Body,$ErrorAction)
    if($Method -ne 'Post'){
        $testWorkflow="on:`n  workflow_dispatch:`n    inputs:`n      release_ref:`n        type: string`nsteps:`n  - uses: actions/checkout`n    with:`n      ref: `$`{{ inputs.release_ref }}`n"
        if($Uri -like 'https://raw.githubusercontent.com/*'){return $testWorkflow}
        if($script:testPublicApiDenied){throw 'Synthetic public API rate limit'}
        return @{content=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($testWorkflow))}
    }
    $script:testPostCount++
    if($Uri -ne 'https://api.github.com/repos/sinaglr-eng/bastions-of-the-last-kingdom/actions/workflows/pages.yml/dispatches'){throw 'Incorrect synthetic REST endpoint'}
    if($Headers.Authorization -ne 'Bearer synthetic-rollback-test-token'){throw 'Incorrect synthetic authorization'}
    $testBody=$Body | ConvertFrom-Json
    if($testBody.ref -ne 'main' -or $testBody.inputs.release_ref -ne 'v0.3.31-stable'){throw 'Incorrect synthetic workflow inputs'}
    if($script:testRejectRest){throw 'Synthetic upstream error containing synthetic-rollback-test-token'}
    return $null
}
try {
    # Empty helper first resets any configured manager; only the synthetic
    # helper can supply credentials in this isolated test process.
    $env:GIT_CONFIG_COUNT='2'
    $env:GIT_CONFIG_KEY_0='credential.helper'
    $env:GIT_CONFIG_VALUE_0=''
    $env:GIT_CONFIG_KEY_1='credential.helper'
    $testPwsh=(Get-Command pwsh -ErrorAction Stop).Source.Replace('\','/')
    $env:GIT_CONFIG_VALUE_1='!"'+$testPwsh+'" -NoProfile -File "'+$testHelper.Replace('\','/')+'"'
    $env:ROLLBACK_SYNTHETIC_MARKER=$testMarker
    $env:ROLLBACK_SYNTHETIC_DENY='0'
    $testDefault=@(& $testSource)
    if(Test-Path -LiteralPath $testMarker){throw 'Default preflight accessed a credential helper'}
    if($script:testPostCount -ne 0){throw 'Default preflight attempted POST'}
    $testDefaultState=$testDefault | Where-Object {$_.PSObject.Properties.Name -contains 'CredentialsAccessed'} | Select-Object -First 1
    if(-not $testDefaultState -or $testDefaultState.CredentialsAccessed -or $testDefaultState.DeployRequested){throw 'Incorrect default preflight state'}
    $script:testPublicApiDenied=$true
    $testRaw=@(& $testSource)
    $testRawState=$testRaw|Where-Object {$_.PSObject.Properties.Name -contains 'WorkflowReady'}|Select-Object -First 1
    if(-not $testRawState.WorkflowReady -or $testRawState.CredentialsAccessed -or $script:testPostCount -ne 0 -or (Test-Path -LiteralPath $testMarker)){throw 'Public raw-file fallback failed the read-only preflight contract'}
    $script:testPublicApiDenied=$false
    $testTokens=$null
    $testErrors=$null
    $testAst=[Management.Automation.Language.Parser]::ParseFile($testSource,[ref]$testTokens,[ref]$testErrors)
    if($testErrors.Count){throw 'Production rollback script has syntax errors'}
    $testFunction=$testAst.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Invoke-RollbackCredentialDispatch'},$true) | Select-Object -First 1
    . ([scriptblock]::Create($testFunction.Extent.Text))
    $testParameters=@{GitExecutable=(Get-Command git).Source;ProjectRoot=$testProjectRoot;Repository='sinaglr-eng/bastions-of-the-last-kingdom';StableTag='v0.3.31-stable'}
    $testResult=Invoke-RollbackCredentialDispatch @testParameters
    if($testResult -ne 'Git Credential Manager / GitHub REST' -or $script:testPostCount -ne 1){throw 'Synthetic fallback did not make exactly one mocked request'}
    $env:ROLLBACK_SYNTHETIC_DENY='1'
    $testCredentialFailure=$null
    try{Invoke-RollbackCredentialDispatch @testParameters | Out-Null}catch{$testCredentialFailure=$_.Exception.Message}
    if(-not $testCredentialFailure -or $script:testPostCount -ne 1){throw 'Unavailable credentials did not stop before the REST request'}
    $env:ROLLBACK_SYNTHETIC_DENY='0'
    $script:testRejectRest=$true
    $testRestFailure=$null
    try{Invoke-RollbackCredentialDispatch @testParameters | Out-Null}catch{$testRestFailure=$_.Exception.Message}
    if(-not $testRestFailure -or $testRestFailure -match 'synthetic-rollback-test-token'){throw 'REST failure exposed credential content'}
    if($script:testPostCount -ne 2){throw 'Unexpected synthetic POST count'}
    $testProof=[ordered]@{status='passed';checks=5;defaultPreflightReadsCredentials=$false;defaultPreflightPosts=0;publicApiRateLimitUsesReadOnlyRawFallback=$true;syntheticFallbackUsesMainAndStableTag=$true;missingCredentialStopsBeforePost=$true;restErrorSanitized=$true;realCredentialsRead=$false;realWorkflowDispatches=0}
    $testProof|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $testEvidence 'credential-fallback-tests.json') -Encoding utf8
    $testProof|ConvertTo-Json
} finally {
    foreach($testName in $testEnvironmentNames){[Environment]::SetEnvironmentVariable($testName,$testPrevious[$testName],'Process')}
}
