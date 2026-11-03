param(
    [string]$SillyTavernPath = "D:\SillyTavern",
    [string]$User = "default-user",
    [switch]$RemoveWorkflow
)

$ErrorActionPreference = "Stop"
$stPath = $SillyTavernPath.TrimEnd('\')
$extensionTarget = Join-Path $stPath "public\scripts\extensions\third-party\k2-auto-image"
$workflowTargetDir = Join-Path $stPath ("data\{0}\user\workflows" -f $User)

if (Test-Path $extensionTarget) {
    Remove-Item $extensionTarget -Recurse -Force
    Write-Host "[OK] Removed extension: $extensionTarget"
} else {
    Write-Host "[SKIP] Extension not found: $extensionTarget"
}

if ($RemoveWorkflow) {
    $workflows = @(Join-Path $workflowTargetDir "Krea2_Turbo_T2I.json")
    if (Test-Path $workflowTargetDir) {
        $workflows += Get-ChildItem $workflowTargetDir -Filter "K2_IG_*.json" -File | ForEach-Object { $_.FullName }
    }
    foreach ($workflow in $workflows) {
        if (Test-Path $workflow) {
            Remove-Item $workflow -Force
            Write-Host "[OK] Removed workflow: $workflow"
        }
    }
}

Write-Host "Settings are kept in SillyTavern settings.json (extension_settings.k2auto)."
Write-Host "Backups, if any, are under: $(Join-Path $stPath 'backups')"
