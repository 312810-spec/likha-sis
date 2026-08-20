# Claude Code SessionStart hook.
# Gives Claude a concise branch + working-tree snapshot at session start
# without dumping full status, diffs, or file contents. Ported from the
# (Cline-only, inactive-under-Claude-Code) TaskStart.ps1 concept, adapted to
# the Claude Code SessionStart contract: plain-text stdout on exit 0 is
# injected as context.

param([string]$ProjectDir)

$ErrorActionPreference = 'SilentlyContinue'
if ($ProjectDir) { Set-Location -LiteralPath $ProjectDir }

try {
    $branch = git rev-parse --abbrev-ref HEAD 2>$null
    if (-not $branch) { exit 0 }  # not a git repo (or git unavailable) -- add no context rather than fail

    $statusLines = @(git status --short 2>$null)
    $count = $statusLines.Count

    if ($count -eq 0) {
        Write-Output "LIKHA-SIS workspace: branch '$branch', working tree clean."
    } else {
        $shown = $statusLines | Select-Object -First 8
        $more = if ($count -gt 8) { "`n...and $($count - 8) more" } else { '' }
        Write-Output "LIKHA-SIS workspace: branch '$branch', $count changed file(s):`n$($shown -join "`n")$more"
    }
} catch {
    # Fail safe: no context is better than a crashed hook blocking session start.
}

exit 0
