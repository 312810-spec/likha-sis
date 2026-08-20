# Claude Code UserPromptSubmit hook.
# Blocks a submitted prompt that appears to contain an actual credential
# value. Deliberately narrow: matches credential-SHAPED strings only, never
# bare mentions of the words "api key" / "token" / "secret" / "environment
# variable", so ordinary technical discussion is never blocked.
# Ported from the (Cline-only, inactive-under-Claude-Code) UserPromptSubmit.ps1
# regex, adapted to the Claude Code contract: exit 2 blocks the prompt,
# stderr is shown to Claude, and the secret value itself is never echoed.

$ErrorActionPreference = 'SilentlyContinue'

try {
    $raw = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }
    $payload = $raw | ConvertFrom-Json
    $text = $payload.prompt_text
} catch {
    exit 0  # malformed input must never block a legitimate prompt
}

if (-not $text) { exit 0 }

# OpenAI (sk-...), GitHub PAT (ghp_...), Anthropic (sk-ant-...), AWS access key (AKIA...).
$secretPattern = '(sk-[a-zA-Z0-9]{32,}|ghp_[a-zA-Z0-9]{36}|sk-ant-[a-zA-Z0-9]{32,}|AKIA[0-9A-Z]{16})'

if ($text -match $secretPattern) {
    [Console]::Error.WriteLine("Blocked: this prompt appears to contain an API key or credential value. Remove the secret and resubmit -- the value itself was not logged.")
    exit 2
}

exit 0
