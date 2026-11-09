$ErrorActionPreference = 'Stop'

$mongoUri = $env:BACKUP_MONGODB_URI
if ([string]::IsNullOrWhiteSpace($mongoUri)) {
    throw 'BACKUP_MONGODB_URI is required.'
}

$retentionCount = 7
if (-not [string]::IsNullOrWhiteSpace($env:BACKUP_RETENTION_COUNT)) {
    if ($env:BACKUP_RETENTION_COUNT -notmatch '^[1-9][0-9]*$') {
        throw 'BACKUP_RETENTION_COUNT must be a positive integer.'
    }
    $retentionCount = [int]$env:BACKUP_RETENTION_COUNT
}

$uriPath = [regex]::Match(
    $mongoUri,
    '^[a-zA-Z][a-zA-Z0-9+.-]*://(?:[^/]+@)?[^/]+/([^?]+)'
)
if (-not $uriPath.Success -or [Uri]::UnescapeDataString($uriPath.Groups[1].Value) -ne 'asoudeh') {
    throw 'BACKUP_MONGODB_URI must select the asoudeh database.'
}

if (-not (Get-Command mongodump -ErrorAction SilentlyContinue)) {
    throw 'mongodump is required (MongoDB Database Tools).'
}

$backupDirectory = if ([string]::IsNullOrWhiteSpace($env:BACKUP_DIR)) {
    Join-Path (Get-Location) 'backups'
} else {
    $env:BACKUP_DIR
}
New-Item -ItemType Directory -Force -Path $backupDirectory | Out-Null
$backupDirectory = (Resolve-Path -LiteralPath $backupDirectory).Path
$timestamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')
$archive = Join-Path $backupDirectory "asoudeh-$timestamp.archive.gz"
$temporary = "$archive.partial"

try {
    $null = & mongodump "--uri=$mongoUri" --gzip "--archive=$temporary" 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "mongodump failed with exit code $LASTEXITCODE; output suppressed to protect connection details."
    }
    Move-Item -LiteralPath $temporary -Destination $archive
    $hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    $sidecar = "$archive.sha256"
    [IO.File]::WriteAllText(
        $sidecar,
        "$hash  $([IO.Path]::GetFileName($archive))`n",
        [Text.Encoding]::ASCII
    )
    Write-Output "Backup created: $([IO.Path]::GetFileName($archive))"
} catch {
    Remove-Item -LiteralPath $temporary -Force -ErrorAction SilentlyContinue
    throw
}

$oldBackups = @(
    Get-ChildItem -LiteralPath $backupDirectory -Filter 'asoudeh-*.archive.gz' -File |
        Sort-Object Name -Descending |
        Select-Object -Skip $retentionCount
)
foreach ($oldBackup in $oldBackups) {
    Remove-Item -LiteralPath $oldBackup.FullName -Force
    Remove-Item -LiteralPath "$($oldBackup.FullName).sha256" -Force -ErrorAction SilentlyContinue
}
