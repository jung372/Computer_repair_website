[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$EncryptedBackupPath,
    [Parameter(Mandatory = $true)]
    [string]$OutputSqlPath,
    [string]$ConfigPath = "$env:ProgramData\ComputerRepairBackup\config.json",
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$resolvedInput = (Resolve-Path -LiteralPath $EncryptedBackupPath).Path
$resolvedOutput = [IO.Path]::GetFullPath($OutputSqlPath)
if ((Test-Path -LiteralPath $resolvedOutput) -and -not $Force) {
    throw "Output already exists. Use -Force to replace it: $resolvedOutput"
}
if (-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) {
    throw "Backup configuration does not exist: $ConfigPath"
}

$config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding utf8 | ConvertFrom-Json
$certificatePath = "Cert:\CurrentUser\My\$($config.certificateThumbprint)"
$certificate = Get-Item -LiteralPath $certificatePath -ErrorAction SilentlyContinue
if (-not $certificate -or -not $certificate.HasPrivateKey) {
    throw (
        "The decryption certificate is unavailable: $certificatePath. " +
        'Import the offline PFX recovery copy before restoring.'
    )
}

$cmsText = [IO.File]::ReadAllText($resolvedInput, [Text.UTF8Encoding]::new($false))
$plainText = @(
    Unprotect-CmsMessage -Content $cmsText
) -join [Environment]::NewLine

$outputParent = Split-Path -Parent $resolvedOutput
New-Item -ItemType Directory -Force -Path $outputParent | Out-Null
[IO.File]::WriteAllText(
    $resolvedOutput,
    $plainText,
    [Text.UTF8Encoding]::new($false)
)

$manifestPath = $resolvedInput -replace '\.sql\.p7m$', '.json'
if (Test-Path -LiteralPath $manifestPath -PathType Leaf) {
    $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding utf8 | ConvertFrom-Json
    $actualHash = (Get-FileHash -LiteralPath $resolvedOutput -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne ([string]$manifest.sha256).ToLowerInvariant()) {
        Remove-Item -LiteralPath $resolvedOutput -Force
        throw 'The decrypted SQL does not match the backup manifest SHA-256.'
    }
    Write-Host "[RESTORE] SHA-256 verified: $actualHash"
}
else {
    Write-Warning "No manifest was found beside the encrypted backup: $manifestPath"
}

Write-Host "[RESTORE] Decrypted SQL created: $resolvedOutput"
Write-Host '[RESTORE] The production D1 database was not modified.'
