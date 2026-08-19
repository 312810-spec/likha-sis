# Read payload from standard input
$inputJson = [Console]::In.ReadToEnd()

if ([string]::IsNullOrWhiteSpace($inputJson)) {
    Write-Output '{"success": true}'
    exit 0
}

# Parse JSON payload
$payload = $inputJson | ConvertFrom-Json

# Extract target file path from tool parameters
$filePath = ""
if ($payload.parameters -and $payload.parameters.path) {
    $filePath = $payload.parameters.path
} elseif ($payload.path) {
    $filePath = $payload.path
}

# Normalization: Convert backslashes for path matching
$normalizedPath = $filePath -replace '\\', '/'

# Check if file matches supported extensions (.js, .ts, .jsx, .tsx, .json, .md) and exists on disk
if (($normalizedPath -match '\.(js|ts|jsx|tsx|json|md)$') -and (Test-Path -Path $filePath -PathType Leaf)) {
    # Run Prettier formatting silently
    npx prettier --write "$filePath" *>$null
}

# Return completion status
Write-Output '{"success": true}'