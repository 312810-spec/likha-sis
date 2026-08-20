# Claude Code PostToolUse hook (matcher: Edit|Write|MultiEdit).
# Lightweight, TARGETED validation of the one file that was just changed --
# never the full suite. Runs `eslint` on that file only, and `vitest run`
# on its sibling __tests__/<name>.test.js(x) if one exists. This is the
# manual "eslint the file, run its test" loop CLAUDE.md's token-efficiency
# section already asks for, just automated instead of remembered per edit.
# PostToolUse cannot block (the tool already ran); on a finding it writes to
# stderr and exits 2 so Claude sees it as non-blocking feedback. Silent on
# success -- this hook should not add noise to a clean edit.

param([string]$ProjectDir)

$ErrorActionPreference = 'SilentlyContinue'
if ($ProjectDir) { Set-Location -LiteralPath $ProjectDir }

try {
    $raw = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }
    $payload = $raw | ConvertFrom-Json
    $path = $payload.tool_input.file_path
} catch {
    exit 0
}

if (-not $path -or -not (Test-Path -LiteralPath $path -PathType Leaf)) { exit 0 }
if ($path -notmatch '\.jsx?$') { exit 0 }

$findings = @()

$lintOut = & npx eslint $path 2>&1
if ($LASTEXITCODE -ne 0) {
    $findings += "ESLint issues in $(Split-Path -Leaf $path):"
    $findings += ($lintOut | Select-Object -First 15)
}

$dir = Split-Path -Parent $path
$base = [System.IO.Path]::GetFileNameWithoutExtension($path)
$candidates = @(
    (Join-Path $dir "__tests__/$base.test.js"),
    (Join-Path $dir "__tests__/$base.test.jsx")
)
$testFile = $candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1

if ($testFile) {
    $testOut = & npx vitest run $testFile 2>&1
    if ($LASTEXITCODE -ne 0) {
        $findings += "Tests failing in $($testFile):"
        $findings += ($testOut | Select-Object -Last 20)
    }
}

if ($findings.Count -gt 0) {
    [Console]::Error.WriteLine(($findings -join "`n"))
    exit 2
}

exit 0
