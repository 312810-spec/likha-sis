# Claude Code PreToolUse hook (matcher: Edit|Write|MultiEdit).
# Blocks direct edits to generated lockfiles, real .env secret files, and
# credential/private-key files -- a safety net, not an obstacle to normal
# development. Package-manager commands (npm install, etc.) run through the
# Bash tool, which this hook's matcher never sees, so they are unaffected.
# Ported from the (Cline-only, inactive-under-Claude-Code) PreToolUse.ps1
# guardrails, adapted to the current Claude Code deny mechanism
# (hookSpecificOutput.permissionDecision) plus one new guardrail: this repo
# has no service-account/private-key file today, but LIKHA-SIS may add
# Firebase Admin SDK credentials later, so the pattern guards pre-emptively.

$ErrorActionPreference = 'SilentlyContinue'

try {
    $raw = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }
    $payload = $raw | ConvertFrom-Json
    $path = $payload.tool_input.file_path
} catch {
    exit 0  # malformed input must never block a legitimate edit
}

if (-not $path) { exit 0 }
$normalized = $path -replace '\\', '/'

$reason = $null

if ($normalized -match '(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb)$') {
    $reason = "Lockfiles are generated. Run the package manager (e.g. npm install) in the terminal instead of editing this directly."
} elseif (($normalized -match '\.env(\.[a-zA-Z0-9_-]+)?$') -and ($normalized -notmatch '\.env\.example$')) {
    $reason = "Direct edits to environment secret files are blocked. Edit .env.example (placeholder values only) instead."
} elseif ($normalized -match '(serviceAccountKey|firebase-adminsdk[^/]*|[^/]*-private-key)\.json$' -or $normalized -match '\.(pem|p12|pfx|key)$') {
    $reason = "This looks like a credential or private-key file. Edits are blocked as a safety net -- if this is intentional, edit it outside Claude Code."
}

if (-not $reason) { exit 0 }

$response = @{
    hookSpecificOutput = @{
        hookEventName            = 'PreToolUse'
        permissionDecision       = 'deny'
        permissionDecisionReason = $reason
    }
} | ConvertTo-Json -Compress -Depth 5

Write-Output $response
exit 0
