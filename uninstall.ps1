param(
    [string]$SillyTavernPath = "D:\SillyTavern",
    [string]$User = "default-user",
    [switch]$RemoveWorkflow
)

$ErrorActionPreference = "Stop"
$stPath = $SillyTavernPath.TrimEnd('\')
$extensionTarget = Join-Path $stPath "public\scripts\extensions\third-party\k2-auto-image"
$workflowTarget = Join-Path $stPath ("data\{0}\user\workflows\Krea2_Turbo_T2I.json" -f $User)

if (Test-Path $extensionTarget) {
    Remove-Item $extensionTarget -Recurse -Force
    Write-Host "[OK] Removed extension: $extensionTarget"
} else {
    Write-Host "[SKIP] Extension not found: $extensionTarget"
}

if ($RemoveWorkflow -and (Test-Path $workflowTarget)) {
    Remove-Item $workflowTarget -Force
    Write-Host "[OK] Removed workflow: $workflowTarget"
}

Write-Host "Settings are kept in SillyTavern settings.json (extension_settings.k2auto)."
Write-Host "Backups, if any, are under: $(Join-Path $stPath 'backups')"
