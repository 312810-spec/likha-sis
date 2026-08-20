# Claude Code Stop hook.
# Proportional final validation, scaled to how much actually changed:
#   - nothing changed          -> silent, no-op
#   - <=3 files, no design-system file touched -> targeted eslint on those files
#   - otherwise (bigger change, or tailwind.config.js/index.css/App.css touched)
#     -> full lint + test + build, output truncated to pass/fail + a short excerpt
# Also names any changed print-sensitive component (ReportCard, SF1/SF2/SF4/SF10,
# CertificateGenerator, IDGenerator, SF1PrintView) as a one-line reminder to
# verify @media print stays light-mode-only -- never auto-edits print CSS.
#
# Deliberately informational only (always exits 0, never blocks the stop):
# this repo has a real, pre-existing, unrelated test failure
# (src/importers/realSamples.test.js, 2 tests) that a hard test gate would
# make permanently unpassable. Report the numbers; don't force a fix loop
# on failures the current task didn't cause.

param([string]$ProjectDir)

$ErrorActionPreference = 'SilentlyContinue'
if ($ProjectDir) { Set-Location -LiteralPath $ProjectDir }

$statusLines = @(git status --porcelain 2>$null)
if ($statusLines.Count -eq 0) { exit 0 }

$files = $statusLines | ForEach-Object {
    if ($_.Length -gt 3) { $_.Substring(3).Trim().Trim('"') }
} | Where-Object { $_ }

$count = $files.Count
if ($count -eq 0) { exit 0 }

$printSensitive = $files | Where-Object {
    $_ -match '(ReportCard|CertificateGenerator|IDGenerator|SF1PrintView|SF1|SF2|SF4|SF10Generator)\.jsx?$'
}
$designSystemTouched = $files | Where-Object {
    $_ -match '(tailwind\.config\.js|src[\\/]index\.css|src[\\/]App\.css)$'
}

$report = @()

if ($count -le 3 -and -not $designSystemTouched) {
    $jsFiles = $files | Where-Object { $_ -match '\.jsx?$' -and (Test-Path -LiteralPath $_ -PathType Leaf) }
    if ($jsFiles.Count -gt 0) {
        $out = & npx eslint $jsFiles 2>&1
        $ok = ($LASTEXITCODE -eq 0)
        $report += "Lint (targeted, $($jsFiles.Count) file(s)): $(if ($ok) { 'pass' } else { 'FAIL' })"
        if (-not $ok) { $report += ($out | Select-Object -First 20) }
    }
} else {
    $lintOut = & npx eslint . 2>&1
    $lintOk = ($LASTEXITCODE -eq 0)
    $report += "Lint: $(if ($lintOk) { 'pass' } else { 'FAIL' })"
    if (-not $lintOk) { $report += ($lintOut | Select-Object -First 20) }

    $testOut = & npx vitest run 2>&1
    $testOk = ($LASTEXITCODE -eq 0)
    $testSummaryLine = ($testOut | Select-String -Pattern '^\s*Tests\s' | Select-Object -Last 1)
    $report += "Tests: $(if ($testOk) { 'pass' } else { 'FAIL' })$(if ($testSummaryLine) { " -- $testSummaryLine" })"
    if (-not $testOk) { $report += ($testOut | Select-Object -Last 20) }

    $buildOut = & npx vite build 2>&1
    $buildOk = ($LASTEXITCODE -eq 0)
    $report += "Build: $(if ($buildOk) { 'pass' } else { 'FAIL' })"
    if (-not $buildOk) { $report += ($buildOut | Select-Object -Last 15) }
}

if ($printSensitive.Count -gt 0) {
    $report += "Print-safety-sensitive file(s) changed: $($printSensitive -join ', ') -- verify @media print stays light-mode-only (npx vitest run src/__tests__/sf1PrintView.test.js)."
}

if ($report.Count -gt 0) {
    Write-Output ($report -join "`n")
}

exit 0
