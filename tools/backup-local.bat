@echo off
setlocal enabledelayedexpansion

REM Offsite D1 backup onto this PC.
REM
REM The R2 backup (daily, automatic) lives in the same Cloudflare account as the
REM database, so it cannot survive losing that account. This script is the copy
REM that can. Run it weekly, or register it in Windows Task Scheduler.
REM
REM The dump contains customer names, phone numbers and addresses in plain text.
REM Keep the output folder out of any cloud-synced directory.

set DB_NAME=baroon-computer-repair-db
if "%BACKUP_DIR%"=="" set BACKUP_DIR=%USERPROFILE%\Documents\combaksa-backups

cd /d "%~dp0.."

for /f "usebackq delims=" %%d in (`powershell -NoProfile -Command "(Get-Date).ToString('yyyy-MM-dd_HHmm')"`) do set STAMP=%%d
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

set OUTFILE=%BACKUP_DIR%\d1-%STAMP%.sql

echo Exporting %DB_NAME% to "%OUTFILE%" ...
call npx wrangler d1 export %DB_NAME% --remote --output "%OUTFILE%"
if errorlevel 1 (
  echo.
  echo FAILED. Common causes:
  echo   - not logged in: run "npx wrangler login"
  echo   - unattended run: set CLOUDFLARE_API_TOKEN with D1 read permission
  exit /b 1
)

for %%f in ("%OUTFILE%") do echo Done: %%~zf bytes
echo.
echo Restore procedure:
echo   npx wrangler d1 execute %DB_NAME% --remote --file "%OUTFILE%"
exit /b 0
