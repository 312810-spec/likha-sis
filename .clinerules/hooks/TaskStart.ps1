# Get active Git branch name safely (fallback to 'main' if not in a git repository)
$branch = git rev-parse --abbrev-ref HEAD 2>$null
if (-not $branch) {
    $branch = "main"
}

# Capture current git status summary
$status = git status --short 2>$null

# Construct response payload
$messageText = "Workspace initialized on branch: $branch.`nCurrent changes:`n$status"

# Return JSON payload to Cline
@{
    message = $messageText
} | ConvertTo-Json -Compress