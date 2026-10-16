<#
.SYNOPSIS
Preflight the preserved 0.3.31 release, or explicitly request its Pages deployment.
.DESCRIPTION
The default invocation is read-only. -Deploy is the only path that dispatches
the main-branch workflow with release_ref=v0.3.31-stable. It never changes a
local branch, resets history, rewrites a tag, or changes statistics/backend data.
#>
[CmdletBinding()]
param([switch]$Deploy)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$rollbackProjectRoot = Split-Path -Parent $PSScriptRoot
$rollbackRepository = 'sinaglr-eng/bastions-of-the-last-kingdom'
$rollbackTag = 'v0.3.31-stable'
$rollbackCommit = 'c01ac5a2ab1ef62e77d2ce545f24234b80b5c847'
$rollbackGit = (Get-Command git -ErrorAction Stop).Source

function Invoke-RollbackReadGit {
    param([string[]]$GitArguments)
    $rollbackResult = & $rollbackGit -C $rollbackProjectRoot @GitArguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Git preflight failed: $($rollbackResult -join [Environment]::NewLine)" }
    return $rollbackResult
}

function Invoke-RollbackCredentialDispatch {
    param([string]$GitExecutable,[string]$ProjectRoot,[string]$Repository,[string]$StableTag)
    $credentialProcess = [Diagnostics.Process]::new()
    $credentialOutput = $null
    $credentialPassword = $null
    $credentialHeaders = $null
    $credentialStarted = $false
    $credentialStdout = $null
    $credentialStderr = $null
    try {
        $credentialInfo = [Diagnostics.ProcessStartInfo]::new()
        $credentialInfo.FileName = $GitExecutable
        $credentialInfo.UseShellExecute = $false
        $credentialInfo.CreateNoWindow = $true
        $credentialInfo.RedirectStandardInput = $true
        $credentialInfo.RedirectStandardOutput = $true
        $credentialInfo.RedirectStandardError = $true
        foreach ($credentialArgument in @('-C',$ProjectRoot,'credential','fill')) { $credentialInfo.ArgumentList.Add($credentialArgument) }
        $credentialInfo.Environment['GIT_TERMINAL_PROMPT'] = '0'
        $credentialInfo.Environment['GCM_INTERACTIVE'] = 'never'
        $credentialProcess.StartInfo = $credentialInfo
        $credentialStarted = $credentialProcess.Start()
        if (-not $credentialStarted) { throw 'Stored GitHub credential lookup could not start.' }
        $credentialStdout = $credentialProcess.StandardOutput.ReadToEndAsync()
        $credentialStderr = $credentialProcess.StandardError.ReadToEndAsync()
        $credentialProcess.StandardInput.Write("protocol=https`nhost=github.com`npath=$Repository.git`n`n")
        $credentialProcess.StandardInput.Close()
        if (-not $credentialProcess.WaitForExit(15000)) { throw 'Stored GitHub credential lookup timed out without opening an interactive prompt.' }
        if ($credentialProcess.ExitCode -ne 0) { throw 'No stored GitHub credential was available. Sign in through Git Credential Manager or GitHub CLI before retrying -Deploy.' }
        # Credential stdout stays in memory inside this function. Never print
        # it, put it in an argument, or write it to a file or proof receipt.
        $credentialOutput = $credentialStdout.GetAwaiter().GetResult()
        $credentialProtocol = $null
        $credentialHost = $null
        foreach ($credentialLine in ($credentialOutput -split '\r?\n')) {
            if ($credentialLine -match '^protocol=(.*)$') { $credentialProtocol = $Matches[1] }
            elseif ($credentialLine -match '^host=(.*)$') { $credentialHost = $Matches[1] }
            elseif ($credentialLine -match '^password=(.*)$') { $credentialPassword = $Matches[1] }
        }
        if ($credentialProtocol -ne 'https' -or $credentialHost -ne 'github.com' -or -not $credentialPassword) { throw 'Stored credential lookup did not return a usable HTTPS GitHub credential.' }
        $credentialHeaders = @{Authorization="Bearer $credentialPassword";Accept='application/vnd.github+json';'User-Agent'='Bastions-rollback';'X-GitHub-Api-Version'='2022-11-28'}
        $credentialBody = @{ref='main';inputs=@{release_ref=$StableTag}} | ConvertTo-Json -Depth 3 -Compress
        try {
            Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/$Repository/actions/workflows/pages.yml/dispatches" -Headers $credentialHeaders -ContentType 'application/json' -Body $credentialBody -ErrorAction Stop | Out-Null
        } catch {
            # Do not reproduce a request/error object that could contain its
            # Authorization header. Deployment is unconfirmed after an error.
            throw 'GitHub rejected the rollback REST request; deployment success is not confirmed. Check workflow permissions and repository access.'
        }
        return 'Git Credential Manager / GitHub REST'
    } finally {
        if ($credentialStarted -and -not $credentialProcess.HasExited) { $credentialProcess.Kill($true) }
        $credentialProcess.Dispose()
        if ($credentialHeaders) { $credentialHeaders.Clear() }
        $credentialPassword = $null
        $credentialOutput = $null
        $credentialStdout = $null
        $credentialStderr = $null
        $credentialLine = $null
        $Matches = $null
    }
}

$rollbackLocal = (Invoke-RollbackReadGit -GitArguments @('rev-parse','--verify',"$rollbackTag^{commit}") | Out-String).Trim()
if ($rollbackLocal -ne $rollbackCommit) { throw "Local $rollbackTag must resolve to $rollbackCommit; found $rollbackLocal." }
$rollbackRemoteUrl = (Invoke-RollbackReadGit -GitArguments @('remote','get-url','origin') | Out-String).Trim()
if ($rollbackRemoteUrl -notmatch '^https://github\.com/sinaglr-eng/bastions-of-the-last-kingdom(?:\.git)?/?$|^git@github\.com:sinaglr-eng/bastions-of-the-last-kingdom(?:\.git)?$') {
    throw 'The checkout origin is not the expected Bastions repository.'
}
$rollbackRemoteLines = @(Invoke-RollbackReadGit -GitArguments @('-c','credential.helper=','-c','credential.interactive=false','ls-remote','--tags',"https://github.com/$rollbackRepository.git","refs/tags/$rollbackTag","refs/tags/$rollbackTag^{}"))
$rollbackPeeled = @($rollbackRemoteLines | Where-Object { $_ -match '\^\{\}$' })
$rollbackTagLines = @($rollbackRemoteLines | Where-Object { $_ -match "\srefs/tags/$([regex]::Escape($rollbackTag))$" })
if ($rollbackPeeled.Count -eq 1) { $rollbackRemote = ($rollbackPeeled[0] -split '\s+')[0] }
elseif ($rollbackTagLines.Count -eq 1) { $rollbackRemote = ($rollbackTagLines[0] -split '\s+')[0] }
else { throw 'The expected stable remote tag is missing or ambiguous.' }
if ($rollbackRemote -ne $rollbackCommit) { throw "Remote $rollbackTag must resolve to $rollbackCommit; found $rollbackRemote." }

$rollbackWorkflowReady = $false
$rollbackWorkflowNote = 'Not checked'
try {
    $rollbackWorkflow = Invoke-RestMethod -Uri "https://api.github.com/repos/$rollbackRepository/contents/.github/workflows/pages.yml?ref=main" -Headers @{Accept='application/vnd.github+json';'User-Agent'='Bastions-rollback-preflight'}
    $rollbackWorkflowText = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($rollbackWorkflow.content))
    $rollbackWorkflowReady = $rollbackWorkflowText -match '(?m)^\s+release_ref:\s*$' -and $rollbackWorkflowText -match '(?m)^\s+ref:\s*.*(?:inputs\.release_ref|github\.event\.inputs\.release_ref)'
    $rollbackWorkflowNote = if ($rollbackWorkflowReady) { 'main exposes release_ref and uses it for checkout' } else { 'main does not yet expose the required release_ref checkout; publication gate remains pending' }
} catch {
    try {
        $rollbackRawNonce = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        $rollbackWorkflowText = [string](Invoke-RestMethod -Uri "https://raw.githubusercontent.com/$rollbackRepository/refs/heads/main/.github/workflows/pages.yml?verify=$rollbackRawNonce" -Headers @{'User-Agent'='Bastions-rollback-preflight';'Cache-Control'='no-cache'})
        $rollbackWorkflowReady = $rollbackWorkflowText -match '(?m)^\s+release_ref:\s*$' -and $rollbackWorkflowText -match '(?m)^\s+ref:\s*.*(?:inputs\.release_ref|github\.event\.inputs\.release_ref)'
        $rollbackWorkflowNote = if ($rollbackWorkflowReady) { 'main exposes release_ref and uses it for checkout (public raw-file fallback)' } else { 'main raw workflow does not expose the required release_ref checkout' }
    } catch { $rollbackWorkflowNote = "Cannot verify main workflow: $($_.Exception.Message)" }
}

$rollbackGhCommand = Get-Command gh -ErrorAction SilentlyContinue
$rollbackGhPath = if ($rollbackGhCommand) { $rollbackGhCommand.Source } else { $null }
if (-not $rollbackGhPath) {
    $rollbackGhCandidates = @()
    if ($env:ProgramFiles) { $rollbackGhCandidates += Join-Path $env:ProgramFiles 'GitHub CLI/gh.exe' }
    if ($env:LOCALAPPDATA) { $rollbackGhCandidates += Join-Path $env:LOCALAPPDATA 'Programs/GitHub CLI/gh.exe' }
    $rollbackGhPath = $rollbackGhCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
}
[pscustomobject]@{
    Version = '0.3.31'
    StableTag = $rollbackTag
    VerifiedLocalAndRemoteCommit = $rollbackCommit
    MainWorkflow = $rollbackWorkflowNote
    GitHubCliAvailable = [bool]$rollbackGhPath
    CredentialsAccessed = $false
    Authentication = 'Checked only after explicit -Deploy and successful workflow preflight'
    CredentialManagerFallback = 'Available through git credential fill; prompts disabled; not accessed by preflight'
    DeployRequested = [bool]$Deploy
    WorkflowReady = $rollbackWorkflowReady
}
if (-not $Deploy) {
    Write-Output 'Read-only preflight complete. No workflow was dispatched. Add -Deploy only when rollback publication is intended.'
    return
}
if (-not $rollbackWorkflowReady) { throw 'Rollback was not dispatched: the published main workflow has not passed the release_ref preflight.' }
$rollbackGhAuthenticated = $false
if ($rollbackGhPath) {
    & $rollbackGhPath auth status --hostname github.com *> $null
    $rollbackGhAuthenticated = $LASTEXITCODE -eq 0
}
if ($rollbackGhAuthenticated) {
    & $rollbackGhPath workflow run pages.yml --repo $rollbackRepository --ref main -f "release_ref=$rollbackTag"
    if ($LASTEXITCODE -ne 0) { throw 'GitHub rejected the rollback workflow request; deployment success is not confirmed.' }
    $rollbackProvider = 'GitHub CLI'
} else {
    $rollbackProvider = Invoke-RollbackCredentialDispatch -GitExecutable $rollbackGit -ProjectRoot $rollbackProjectRoot -Repository $rollbackRepository -StableTag $rollbackTag
}
Write-Output "Authentication provider: $rollbackProvider"
Write-Output "Requested Pages deployment of $rollbackTag ($rollbackCommit). This is a dispatch receipt, not deployment confirmation."
Write-Output "Follow the run and verify the served game at https://github.com/$rollbackRepository/actions/workflows/pages.yml"
