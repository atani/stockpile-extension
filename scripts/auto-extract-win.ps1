# Stockpile Auto-Extract Script for Windows
# Automatically extracts ZIP files and removes __MACOSX folders
#
# Usage:
#   1. Edit $WatchDir below to your Stockpile download folder
#   2. Right-click this file and select "Run with PowerShell"
#
# For automatic execution, set up as a Scheduled Task (see README)

# === CONFIGURATION ===
# Change this to your Stockpile download folder
$WatchDir = "$env:USERPROFILE\Downloads\Stockpile"

# === SCRIPT ===
if (-not (Test-Path $WatchDir)) {
    Write-Host "Error: Directory not found: $WatchDir" -ForegroundColor Red
    Write-Host "Please edit `$WatchDir in this script to match your Stockpile folder."
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Stockpile Auto-Extract" -ForegroundColor Green
Write-Host "======================"
Write-Host "Watching: $WatchDir"
Write-Host ""

# Find all ZIP files
$zipFiles = Get-ChildItem -Path $WatchDir -Filter "*.zip" -Recurse -File

if ($zipFiles.Count -eq 0) {
    Write-Host "No ZIP files found."
} else {
    foreach ($zipFile in $zipFiles) {
        $destDir = $zipFile.DirectoryName
        $fileName = $zipFile.BaseName

        Write-Host "Extracting: $fileName"

        # Extract ZIP file
        try {
            Expand-Archive -Path $zipFile.FullName -DestinationPath $destDir -Force

            # Remove __MACOSX folder if exists
            $macosxPath = Join-Path $destDir "__MACOSX"
            if (Test-Path $macosxPath) {
                Remove-Item -Path $macosxPath -Recurse -Force
                Write-Host "  Removed __MACOSX folder"
            }

            # Remove the ZIP file
            Remove-Item -Path $zipFile.FullName -Force

            Write-Host "  Done!"
        } catch {
            Write-Host "  Error: $_" -ForegroundColor Red
        }
    }
}

# Clean up any remaining __MACOSX folders
Get-ChildItem -Path $WatchDir -Filter "__MACOSX" -Recurse -Directory | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "All ZIP files extracted!" -ForegroundColor Green
Read-Host "Press Enter to exit"
