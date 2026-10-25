param(
  [Parameter(Mandatory=$true)][string[]]$WorkspaceRoots,
  [string]$VerifiedArchiveProof,
  [string]$Output,
  [switch]$Apply
)
$ErrorActionPreference='Stop'
function Inside([string]$Target,[string]$Parent) {
  $resolvedTarget=[IO.Path]::GetFullPath($Target)
  $resolvedParent=[IO.Path]::GetFullPath($Parent).TrimEnd('\','/')
  if(-not $resolvedTarget.StartsWith($resolvedParent+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw "Target escapes intended directory: $resolvedTarget"}
  $cursor=$resolvedTarget
  while($cursor){
    if((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw "Linked cleanup target or ancestor: $cursor"}
    $cursor=Split-Path -Parent $cursor
  }
  return $resolvedTarget
}
if($Apply){
  if(-not $VerifiedArchiveProof){throw 'A successful new archive verification receipt is required.'}
  $proof=Get-Content -LiteralPath $VerifiedArchiveProof -Raw | ConvertFrom-Json
  if($proof.status -ne 'passed' -or $proof.version -ne '0.5.0' -or -not $proof.archiveVerified){throw 'The 0.5.0 archive has not passed verification.'}
  foreach($archive in $proof.archives){
    if((Get-FileHash -LiteralPath $archive.path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $archive.sha256){throw 'Verified archive bytes changed.'}
  }
}
$candidates=@();$skipped=@()
foreach($workspace in $WorkspaceRoots){
  $root=(Resolve-Path -LiteralPath $workspace).Path
  $temporary=Join-Path $root 'tmp'
  if(Test-Path -LiteralPath $temporary){
    foreach($folder in Get-ChildItem -LiteralPath $temporary -Directory -Force){
      if($folder.Name -notmatch '^(?:v\d+-(?:local-dist|pages-dist|default-dist|final-default-dist|committed-check-dist)|main-dist-before-v\d+|.+-dist-before-\d+|zip-v[456]-(?:rebuild|independent-rebuild))$'){continue}
      $target=Inside $folder.FullName $temporary
      if($folder.Attributes -band [IO.FileAttributes]::ReparsePoint){$skipped+=@{path=$target;reason='Link retained'};continue}
      $entries=@(Get-ChildItem -LiteralPath $target -Force -Recurse)
      if($entries | Where-Object {($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $_.Name -eq '.git'}){$skipped+=@{path=$target;reason='Linked or embedded repository retained'};continue}
      $release=Join-Path $target 'release.json';if(-not(Test-Path -LiteralPath $release)){$release=Join-Path $target 'public/release.json'}
      if(-not(Test-Path -LiteralPath (Join-Path $target 'index.html')) -or -not(Test-Path -LiteralPath $release)){continue}
      $version=(Get-Content -LiteralPath $release -Raw | ConvertFrom-Json).version
      if($version -notmatch '^0\.[0-4]\.\d+$'){continue}
      $relative=[IO.Path]::GetRelativePath($root,$target).Replace('\','/')
      $tracked=@(& git -C $root ls-files -- $relative)
      if($LASTEXITCODE -ne 0 -or $tracked.Count){throw "Tracked temporary directory cannot be removed: $target"}
      $bytes=($entries | Where-Object {-not $_.PSIsContainer} | Measure-Object -Property Length -Sum).Sum
      $candidates+=@{path=$target;parent=$temporary;kind='old-generated-build';version=$version;bytes=[long]$bytes}
    }
  }
  $old=Join-Path $root 'backups/releases/v0.3.31'
  if(Test-Path -LiteralPath $old){
    $parent=Join-Path $root 'backups/releases';$target=Inside $old $parent
    $entries=@(Get-ChildItem -LiteralPath $target -Force -Recurse)
    $expected=@('README.md','bastions-v0.3.31-production.zip','bastions-v0.3.31-source.zip','production-backup-proof.json','rollback-identity.json','source-backup-proof.json')
    if($entries.Count -ne 6 -or ($entries | Where-Object {$_.PSIsContainer -or ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $_.Name -notin $expected})){throw 'Unexpected content in previous release archive; retained.'}
    $candidates+=@{path=$target;parent=$parent;kind='retired-offline-release';version='0.3.31';bytes=[long](($entries | Measure-Object -Property Length -Sum).Sum)}
  }
}
$receipt=@{schema='v050-old-build-cleanup-v1';status=($(if($Apply){'removed'}else{'preview'}));checkedAt=[DateTime]::UtcNow.ToString('o');paths=$candidates;skipped=$skipped;bytes=[long](($candidates | Measure-Object -Property bytes -Sum).Sum)}
if($Apply){
  foreach($row in $candidates){
    $checked=Inside ((Resolve-Path -LiteralPath $row.path).Path) $row.parent
    if($checked -ne $row.path){throw 'Resolved cleanup target changed.'}
    Remove-Item -LiteralPath $checked -Recurse -Force
    if(Test-Path -LiteralPath $checked){throw "Cleanup incomplete: $checked"}
  }
}
if($Output){$parent=Split-Path -Parent $Output;if($parent){New-Item -ItemType Directory -Path $parent -Force | Out-Null};$receipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Output -Encoding utf8}
@{status=$receipt.status;paths=$candidates.Count;bytes=$receipt.bytes;skipped=$skipped.Count} | ConvertTo-Json -Compress
