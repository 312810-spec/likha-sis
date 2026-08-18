# Read user prompt payload from standard input
$inputJson = [Console]::In.ReadToEnd()

if ([string]::IsNullOrWhiteSpace($inputJson)) {
    Write-Output '{"cancel": false}'
    exit 0
}

# Regex pattern for OpenAI keys (sk-...), GitHub PATs (ghp_...), Anthropic (sk-ant-...), AWS, and generic API keys
$secretPattern = '(sk-[a-zA-Z0-9]{32,}|ghp_[a-zA-Z0-9]{36}|sk-ant-[a-zA-Z0-9]{32,}|AKIA[0-9A-Z]{16})'

# Check prompt against secret pattern using native PowerShell regex matching
if ($inputJson -match $secretPattern) {
    $response = @{
        cancel = $true
        errorMessage = "API key or secret token detected in prompt. Please remove sensitive credentials before submitting."
    } | ConvertTo-Json -Compress

    Write-Output $response
    exit 0
}

# Allow prompt submission to proceed
Write-Output '{"cancel": false}'