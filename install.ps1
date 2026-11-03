param(
    [string]$SillyTavernPath = "D:\SillyTavern",
    [string]$User = "default-user",
    [switch]$ForceWorkflow
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$stPath = $SillyTavernPath.TrimEnd('\')

if (-not (Test-Path (Join-Path $stPath "config.yaml"))) {
    throw "SillyTavern was not found at '$stPath'. Pass -SillyTavernPath <path>."
}

$extensionSource = Join-Path $repo "extension"
$extensionTarget = Join-Path $stPath "public\scripts\extensions\third-party\k2-auto-image"
$workflowSource = Join-Path $repo "comfyui\Krea2_Turbo_T2I.json"
$characterWorkflowSource = Join-Path $repo "comfyui\characters"
$workflowTargetDir = Join-Path $stPath ("data\{0}\user\workflows" -f $User)

if (-not (Test-Path (Join-Path $extensionSource "manifest.json"))) {
    throw "Extension source is incomplete: $extensionSource"
}
if (-not (Test-Path $workflowSource)) {
    throw "Workflow source is missing: $workflowSource"
}

$extensionExisted = Test-Path $extensionTarget
New-Item -ItemType Directory -Force -Path $extensionTarget | Out-Null
New-Item -ItemType Directory -Force -Path $workflowTargetDir | Out-Null

if ($extensionExisted) {
    # Keep backups outside third-party so SillyTavern does not load them as extensions.
    $backupDir = Join-Path $stPath "backups"
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    $backup = Join-Path $backupDir ("k2-auto-image-{0}" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
    Copy-Item $extensionTarget $backup -Recurse -Force
    Write-Host "[OK] Previous extension backed up to: $backup"
}

Copy-Item (Join-Path $extensionSource "*") $extensionTarget -Recurse -Force
Write-Host "[OK] Extension installed to: $extensionTarget"

$workflowSources = @($workflowSource)
if (Test-Path $characterWorkflowSource) {
    $workflowSources += Get-ChildItem $characterWorkflowSource -Filter "*.json" -File | ForEach-Object { $_.FullName }
}

foreach ($source in $workflowSources) {
    $name = Split-Path -Leaf $source
    $target = Join-Path $workflowTargetDir $name
    if ((Test-Path $target) -and -not $ForceWorkflow) {
        Write-Host "[SKIP] Workflow already exists: $target"
        continue
    }
    Copy-Item $source $target -Force
    Write-Host "[OK] Workflow installed to: $target"
}
if (-not $ForceWorkflow) {
    Write-Host "     Existing workflows were kept. Use -ForceWorkflow to overwrite them."
}

Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Start ComfyUI (default http://127.0.0.1:8188)."
Write-Host "2. Start Ollama and make sure the model exists."
Write-Host "3. Restart SillyTavern and refresh the page."
Write-Host "4. Open Extensions -> K2 Auto Image and click Test connections."
Write-Host "5. Enable auto generation and send a test message."
