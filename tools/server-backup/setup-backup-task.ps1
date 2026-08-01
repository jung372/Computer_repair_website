[CmdletBinding()]
param(
    [string]$GoogleDriveRoot = '',
    [string]$LocalFallbackRoot = 'D:\SecureBackups\ComputerRepair',
    [string]$RuntimeRoot = "$env:ProgramData\ComputerRepairBackup",
    [string]$TaskName = 'Computer Repair D1 Backup Sync',
    [Security.SecureString]$CloudflareApiToken,
    [string]$CertificateBackupPath = '',
    [Security.SecureString]$CertificateBackupPassword,
    [switch]$SkipNpmInstall,
    [switch]$SkipInitialRun
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Test-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-WritableDirectory {
    param([Parameter(Mandatory = $true)][string]$Path)

    try {
        New-Item -ItemType Directory -Force -Path $Path | Out-Null
        $probe = Join-Path $Path ('.write-test-' + [IO.Path]::GetRandomFileName())
        [IO.File]::WriteAllText($probe, 'ok')
        Remove-Item -LiteralPath $probe -Force
        return $true
    }
    catch {
        return $false
    }
}

function Protect-LocalRuntimeDirectory {
    param([Parameter(Mandatory = $true)][string]$Path)

    $inheritance = (
        [Security.AccessControl.InheritanceFlags]::ContainerInherit -bor
        [Security.AccessControl.InheritanceFlags]::ObjectInherit
    )
    $acl = [Security.AccessControl.DirectorySecurity]::new()
    $acl.SetAccessRuleProtection($true, $false)
    $identities = @(
        [Security.Principal.WindowsIdentity]::GetCurrent().User,
        [Security.Principal.SecurityIdentifier]::new('S-1-5-18'),
        [Security.Principal.SecurityIdentifier]::new('S-1-5-32-544')
    )
    foreach ($identity in $identities) {
        $rule = [Security.AccessControl.FileSystemAccessRule]::new(
            $identity,
            [Security.AccessControl.FileSystemRights]::FullControl,
            $inheritance,
            [Security.AccessControl.PropagationFlags]::None,
            [Security.AccessControl.AccessControlType]::Allow
        )
        $acl.AddAccessRule($rule)
    }
    Set-Acl -LiteralPath $Path -AclObject $acl
}

function Find-GoogleDriveRoot {
    if (-not [string]::IsNullOrWhiteSpace($GoogleDriveRoot)) {
        $explicit = [IO.Path]::GetFullPath($GoogleDriveRoot)
        if (Test-WritableDirectory -Path $explicit) {
            return $explicit
        }
        Write-Warning "Google Drive path is not writable; using the local fallback: $explicit"
        return $null
    }

    $candidates = [Collections.Generic.List[string]]::new()
    foreach ($drive in Get-PSDrive -PSProvider FileSystem) {
        foreach ($name in @('My Drive', '내 드라이브', 'Google Drive')) {
            $candidate = Join-Path $drive.Root $name
            if (Test-Path -LiteralPath $candidate -PathType Container) {
                $candidates.Add($candidate)
            }
        }
    }
    foreach ($candidate in $candidates) {
        if (Test-WritableDirectory -Path $candidate) {
            return [IO.Path]::GetFullPath($candidate)
        }
    }
    return $null
}

if (-not (Test-Administrator)) {
    throw 'Run this setup script from an elevated PowerShell window.'
}

$scriptDirectory = Split-Path -Parent $PSCommandPath
$projectRoot = Split-Path -Parent (Split-Path -Parent $scriptDirectory)
$syncScript = Join-Path $scriptDirectory 'sync-r2-backups.ps1'
if (-not (Test-Path -LiteralPath $syncScript -PathType Leaf)) {
    throw "Backup sync script does not exist: $syncScript"
}

$resolvedRuntimeRoot = [IO.Path]::GetFullPath($RuntimeRoot)
$stagingRoot = Join-Path $resolvedRuntimeRoot 'staging'
$credentialPath = Join-Path $resolvedRuntimeRoot 'cloudflare-token.xml'
$configPath = Join-Path $resolvedRuntimeRoot 'config.json'
New-Item -ItemType Directory -Force -Path $resolvedRuntimeRoot, $stagingRoot | Out-Null
Protect-LocalRuntimeDirectory -Path $resolvedRuntimeRoot

$detectedGoogleDrive = Find-GoogleDriveRoot
if ($detectedGoogleDrive) {
    $destinationRoot = Join-Path $detectedGoogleDrive 'ComputerRepairBackups'
    $destinationType = 'google-drive'
}
else {
    $destinationRoot = [IO.Path]::GetFullPath($LocalFallbackRoot)
    $destinationType = 'local-fallback'
}
if (-not (Test-WritableDirectory -Path $destinationRoot)) {
    throw "The selected backup destination is not writable: $destinationRoot"
}

if (-not $CloudflareApiToken) {
    $CloudflareApiToken = Read-Host `
        'Enter a Cloudflare API token with read-only R2 access' `
        -AsSecureString
}
$credential = [Management.Automation.PSCredential]::new(
    'CloudflareR2ReadOnly',
    $CloudflareApiToken
)
$credential | Export-Clixml -LiteralPath $credentialPath -Force

$certificate = Get-ChildItem Cert:\CurrentUser\My |
    Where-Object {
        $_.Subject -eq 'CN=Computer Repair Backup' -and $_.HasPrivateKey
    } |
    Sort-Object NotAfter -Descending |
    Select-Object -First 1
if (-not $certificate) {
    $certificate = New-SelfSignedCertificate `
        -Type DocumentEncryptionCert `
        -Subject 'CN=Computer Repair Backup' `
        -CertStoreLocation 'Cert:\CurrentUser\My' `
        -KeyExportPolicy Exportable `
        -KeyLength 2048 `
        -NotAfter (Get-Date).AddYears(10)
}

if (-not [string]::IsNullOrWhiteSpace($CertificateBackupPath)) {
    if (-not $CertificateBackupPassword) {
        $CertificateBackupPassword = Read-Host `
            'Enter a password for the offline PFX recovery copy' `
            -AsSecureString
    }
    $resolvedPfxPath = [IO.Path]::GetFullPath($CertificateBackupPath)
    $pfxParent = Split-Path -Parent $resolvedPfxPath
    New-Item -ItemType Directory -Force -Path $pfxParent | Out-Null
    Export-PfxCertificate `
        -Cert $certificate `
        -FilePath $resolvedPfxPath `
        -Password $CertificateBackupPassword `
        -Force |
        Out-Null
}
else {
    Write-Warning (
        'No offline PFX recovery copy was exported. Rerun setup with ' +
        '-CertificateBackupPath pointing to removable or separately protected storage.'
    )
}

$config = [ordered]@{
    bucketName = 'combaksa-computer-repair-backups'
    backupPrefix = 'backups'
    destinationRoot = [IO.Path]::GetFullPath($destinationRoot)
    destinationType = $destinationType
    stagingRoot = $stagingRoot
    credentialPath = $credentialPath
    certificateThumbprint = $certificate.Thumbprint
    retentionDays = 365
    maxBackupAgeHours = 30
    projectRoot = [IO.Path]::GetFullPath($projectRoot)
    configuredAt = (Get-Date).ToUniversalTime().ToString('o')
} | ConvertTo-Json
[IO.File]::WriteAllText($configPath, $config, [Text.UTF8Encoding]::new($false))

$wranglerPath = Join-Path $projectRoot 'node_modules\.bin\wrangler.cmd'
if (-not (Test-Path -LiteralPath $wranglerPath -PathType Leaf)) {
    if ($SkipNpmInstall) {
        throw "Wrangler is missing and -SkipNpmInstall was supplied: $wranglerPath"
    }
    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (-not $npm) {
        throw 'npm was not found. Install Node.js 22 or later, then rerun setup.'
    }
    Push-Location -LiteralPath $projectRoot
    try {
        & $npm.Source ci
        if ($LASTEXITCODE -ne 0) {
            throw "npm ci failed (exit $LASTEXITCODE)."
        }
    }
    finally {
        Pop-Location
    }
}

$arguments = (
    '-NoProfile -ExecutionPolicy Bypass ' +
    "-File `"$syncScript`" -ConfigPath `"$configPath`""
)
$action = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument $arguments `
    -WorkingDirectory $projectRoot
$dailyTrigger = New-ScheduledTaskTrigger -Daily -At '03:20'
$logonTrigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$principal = New-ScheduledTaskPrincipal `
    -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -LogonType Interactive `
    -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 6 `
    -RestartInterval (New-TimeSpan -Minutes 30) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger @($dailyTrigger, $logonTrigger) `
    -Principal $principal `
    -Settings $settings `
    -Description 'Downloads, verifies, encrypts, and retains D1 backups for 365 days.' `
    -Force |
    Out-Null

if (-not $SkipInitialRun) {
    & $syncScript -ConfigPath $configPath
}

Write-Host '[BACKUP] Server backup setup completed.'
Write-Host "[BACKUP] Destination type: $destinationType"
Write-Host "[BACKUP] Destination: $destinationRoot"
Write-Host "[BACKUP] Retention: 365 days"
Write-Host "[BACKUP] Certificate thumbprint: $($certificate.Thumbprint)"
