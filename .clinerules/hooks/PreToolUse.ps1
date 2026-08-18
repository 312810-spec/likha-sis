# Read payload from standard input
$inputJson = [Console]::In.ReadToEnd()

if ([string]::IsNullOrWhiteSpace($inputJson)) {
    Write-Output '{"cancel": false}'
    exit 0
}

# Parse JSON payload
$payload = $inputJson | ConvertFrom-Json

# Extract target file path across potential properties
$filePath = ""
if ($payload.parameters -and $payload.parameters.path) {
    $filePath = $payload.parameters.path
} elseif ($payload.path) {
    $filePath = $payload.path
}

# Normalization: Convert backslashes to forward slashes for cross-platform regex
$normalizedPath = $filePath -replace '\\', '/'

# Guardrail 1: Block lockfile edits
if ($normalizedPath -match '(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb)$') {
    $response = @{
        cancel = $true
        errorMessage = "Do not edit lockfiles directly. Run your package manager (e.g., npm install) in the terminal instead."
    } | ConvertTo-Json -Compress
    Write-Output $response
    exit 0
}

# Guardrail 2: Block editing sensitive environment files (excluding .env.example)
if (($normalizedPath -match '\.env(\.[a-zA-Z0-9_-]+)?$') -and -not ($normalizedPath -match '\.env\.example$')) {
    $response = @{
        cancel = $true
        errorMessage = "Direct edits to environment secret files are blocked. Create or modify .env.example instead."
    } | ConvertTo-Json -Compress
    Write-Output $response
    exit 0
}

# Fallthrough: Allow operation
Write-Output '{"cancel": false}'