[CmdletBinding()]
param(
    [string]$ConfigPath = "$env:ProgramData\ComputerRepairBackup\config.json"
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Get-TextSha256 {
    param([Parameter(Mandatory = $true)][string]$Text)

    $algorithm = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [Text.UTF8Encoding]::new($false).GetBytes($Text)
        $hash = $algorithm.ComputeHash($bytes)
        return ([BitConverter]::ToString($hash) -replace '-', '').ToLowerInvariant()
    }
    finally {
        $algorithm.Dispose()
    }
}

function Write-BackupLog {
    param(
        [Parameter(Mandatory = $true)][string]$Status,
        [Parameter(Mandatory = $true)][string]$Message,
        [string]$BackupDate = ''
    )

    $entry = [ordered]@{
        timestamp = (Get-Date).ToUniversalTime().ToString('o')
        status = $Status
        backupDate = $BackupDate
        message = $Message
    } | ConvertTo-Json -Compress
    Add-Content -LiteralPath $script:LogPath -Value $entry -Encoding utf8
}

function Invoke-WranglerObjectGet {
    param(
        [Parameter(Mandatory = $true)][string]$ObjectKey,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    Remove-Item -LiteralPath $Destination -Force -ErrorAction SilentlyContinue
    & $script:WranglerPath r2 object get `
        "$($script:Config.bucketName)/$ObjectKey" `
        --remote `
        --file $Destination
    if ($LASTEXITCODE -ne 0) {
        throw "Wrangler could not download R2 object '$ObjectKey' (exit $LASTEXITCODE)."
    }
    if (-not (Test-Path -LiteralPath $Destination -PathType Leaf)) {
        throw "Wrangler reported success but did not create '$Destination'."
    }
}

function Remove-ExpiredBackups {
    $cutoff = (Get-Date).Date.AddDays(-[int]$script:Config.retentionDays)
    Get-ChildItem -LiteralPath $script:DestinationRoot -Filter 'd1-*.sql.p7m' -File -Recurse |
        ForEach-Object {
            if ($_.Name -notmatch '^d1-(?<date>\d{4}-\d{2}-\d{2})\.sql\.p7m$') {
                return
            }

            $backupDate = [DateTime]::ParseExact(
                $Matches.date,
                'yyyy-MM-dd',
                [Globalization.CultureInfo]::InvariantCulture
            )
            if ($backupDate -ge $cutoff) {
                return
            }

            $manifestPath = $_.FullName -replace '\.sql\.p7m$', '.json'
            Remove-Item -LiteralPath $_.FullName -Force
            Remove-Item -LiteralPath $manifestPath -Force -ErrorAction SilentlyContinue
            Write-BackupLog `
                -Status 'retention-delete' `
                -BackupDate $Matches.date `
                -Message "Deleted a backup older than $($script:Config.retentionDays) days."
        }
}

if (-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) {
    throw "Backup configuration does not exist: $ConfigPath"
}

$script:Config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding utf8 | ConvertFrom-Json
$requiredSettings = @(
    'bucketName',
    'backupPrefix',
    'destinationRoot',
    'stagingRoot',
    'credentialPath',
    'certificateThumbprint',
    'retentionDays',
    'maxBackupAgeHours',
    'projectRoot'
)
foreach ($setting in $requiredSettings) {
    if (-not $script:Config.PSObject.Properties.Name.Contains($setting)) {
        throw "Backup configuration is missing '$setting'."
    }
}
if ([int]$script:Config.retentionDays -ne 365) {
    throw 'The approved backup retention period is 365 days.'
}

$script:DestinationRoot = [IO.Path]::GetFullPath([string]$script:Config.destinationRoot)
$stagingRoot = [IO.Path]::GetFullPath([string]$script:Config.stagingRoot)
$logRoot = Join-Path $script:DestinationRoot 'logs'
$script:LogPath = Join-Path $logRoot 'backup-sync.jsonl'
New-Item -ItemType Directory -Force -Path `
    $script:DestinationRoot, $stagingRoot, $logRoot |
    Out-Null

$script:WranglerPath = Join-Path `
    ([string]$script:Config.projectRoot) `
    'node_modules\.bin\wrangler.cmd'
if (-not (Test-Path -LiteralPath $script:WranglerPath -PathType Leaf)) {
    throw "Wrangler is not installed. Run npm ci in '$($script:Config.projectRoot)'."
}

$credential = Import-Clixml -LiteralPath ([string]$script:Config.credentialPath)
if ($credential -isnot [Management.Automation.PSCredential]) {
    throw 'The stored Cloudflare credential is invalid.'
}
$certificatePath = "Cert:\CurrentUser\My\$($script:Config.certificateThumbprint)"
$certificate = Get-Item -LiteralPath $certificatePath -ErrorAction SilentlyContinue
if (-not $certificate -or -not $certificate.HasPrivateKey) {
    throw "The backup encryption certificate is unavailable: $certificatePath"
}

$tempManifest = Join-Path $stagingRoot 'latest.json.partial'
$tempSql = Join-Path $stagingRoot 'latest.sql.partial'
$tempEncrypted = Join-Path $stagingRoot 'latest.sql.p7m.partial'
$backupDateForLog = ''

# Retention must still run when Cloudflare or the network is unavailable.
Remove-ExpiredBackups

try {
    $env:CLOUDFLARE_API_TOKEN = $credential.GetNetworkCredential().Password
    $latestKey = "$($script:Config.backupPrefix)/latest.json"
    Invoke-WranglerObjectGet -ObjectKey $latestKey -Destination $tempManifest

    $manifest = Get-Content -LiteralPath $tempManifest -Raw -Encoding utf8 | ConvertFrom-Json
    foreach ($property in @('key', 'bytes', 'sha256', 'generatedAt', 'totalRows', 'tables')) {
        if (-not $manifest.PSObject.Properties.Name.Contains($property)) {
            throw "The R2 manifest is missing '$property'."
        }
    }
    if ([string]$manifest.key -notmatch '^backups/(?<date>\d{4}-\d{2}-\d{2})\.sql$') {
        throw "The R2 manifest contains an unexpected key: $($manifest.key)"
    }
    $backupDateForLog = $Matches.date
    $kstToday = [DateTimeOffset]::UtcNow.ToOffset([TimeSpan]::FromHours(9)).ToString('yyyy-MM-dd')
    if ($backupDateForLog -ne $kstToday) {
        throw "The newest R2 backup is for $backupDateForLog; expected $kstToday KST."
    }
    if ([string]$manifest.sha256 -notmatch '^[a-fA-F0-9]{64}$') {
        throw 'The R2 manifest contains an invalid SHA-256 value.'
    }
    if ([long]$manifest.bytes -le 0 -or @($manifest.tables).Count -eq 0) {
        throw 'The R2 manifest describes an empty or structurally invalid backup.'
    }
    $generatedAt = [DateTimeOffset]::Parse(
        [string]$manifest.generatedAt,
        [Globalization.CultureInfo]::InvariantCulture
    )
    $backupAge = [DateTimeOffset]::UtcNow - $generatedAt.ToUniversalTime()
    if ($backupAge.TotalHours -gt [double]$script:Config.maxBackupAgeHours) {
        throw (
            "The newest R2 backup is $([Math]::Round($backupAge.TotalHours, 1)) hours old; " +
            "the limit is $($script:Config.maxBackupAgeHours) hours."
        )
    }

    $date = [DateTime]::ParseExact(
        $backupDateForLog,
        'yyyy-MM-dd',
        [Globalization.CultureInfo]::InvariantCulture
    )
    $monthRoot = Join-Path $script:DestinationRoot $date.ToString('yyyy\MM')
    New-Item -ItemType Directory -Force -Path $monthRoot | Out-Null
    $baseName = "d1-$backupDateForLog"
    $finalEncrypted = Join-Path $monthRoot "$baseName.sql.p7m"
    $finalManifest = Join-Path $monthRoot "$baseName.json"

    if (
        (Test-Path -LiteralPath $finalEncrypted -PathType Leaf) -and
        (Test-Path -LiteralPath $finalManifest -PathType Leaf)
    ) {
        $existing = Get-Content -LiteralPath $finalManifest -Raw -Encoding utf8 | ConvertFrom-Json
        if ([string]$existing.sha256 -eq ([string]$manifest.sha256).ToLowerInvariant()) {
            Remove-ExpiredBackups
            Write-BackupLog `
                -Status 'unchanged' `
                -BackupDate $backupDateForLog `
                -Message 'The newest verified backup is already stored.'
            return
        }
        throw "A local backup exists for $backupDateForLog with a different checksum."
    }

    Invoke-WranglerObjectGet -ObjectKey ([string]$manifest.key) -Destination $tempSql
    $download = Get-Item -LiteralPath $tempSql
    if ($download.Length -ne [long]$manifest.bytes) {
        throw "Backup size mismatch: expected $($manifest.bytes), got $($download.Length)."
    }
    $downloadHash = (Get-FileHash -LiteralPath $tempSql -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($downloadHash -ne ([string]$manifest.sha256).ToLowerInvariant()) {
        throw "Backup SHA-256 mismatch for $($manifest.key)."
    }

    $plainText = [IO.File]::ReadAllText($tempSql, [Text.UTF8Encoding]::new($false))
    $cmsText = @(
        Protect-CmsMessage -To $certificate -Content $plainText
    ) -join [Environment]::NewLine
    [IO.File]::WriteAllText(
        $tempEncrypted,
        $cmsText,
        [Text.UTF8Encoding]::new($false)
    )

    # Decrypt once before accepting the file. This catches a missing or unusable
    # private key while the verified plaintext is still in staging.
    $roundTrip = @(
        Unprotect-CmsMessage -Content $cmsText
    ) -join [Environment]::NewLine
    if ((Get-TextSha256 -Text $roundTrip) -ne $downloadHash) {
        throw 'The encrypted backup failed its decrypt-and-hash verification.'
    }

    Move-Item -LiteralPath $tempEncrypted -Destination $finalEncrypted
    $normalizedManifest = [ordered]@{
        key = [string]$manifest.key
        generatedAt = [string]$manifest.generatedAt
        downloadedAt = (Get-Date).ToUniversalTime().ToString('o')
        bytes = [long]$manifest.bytes
        sha256 = ([string]$manifest.sha256).ToLowerInvariant()
        totalRows = [long]$manifest.totalRows
        tables = $manifest.tables
        encryptedFile = [IO.Path]::GetFileName($finalEncrypted)
    } | ConvertTo-Json -Depth 6
    [IO.File]::WriteAllText(
        $finalManifest,
        $normalizedManifest,
        [Text.UTF8Encoding]::new($false)
    )

    $latestSuccess = Join-Path $script:DestinationRoot 'latest-success.json'
    [IO.File]::WriteAllText(
        $latestSuccess,
        $normalizedManifest,
        [Text.UTF8Encoding]::new($false)
    )
    Remove-ExpiredBackups
    Write-BackupLog `
        -Status 'success' `
        -BackupDate $backupDateForLog `
        -Message "Stored and verified '$finalEncrypted'."
}
catch {
    Write-BackupLog `
        -Status 'failure' `
        -BackupDate $backupDateForLog `
        -Message $_.Exception.Message
    throw
}
finally {
    Remove-Item Env:\CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath `
        $tempManifest, $tempSql, $tempEncrypted `
        -Force `
        -ErrorAction SilentlyContinue
}
