># Agent Instructions

## Operating Style (Claude Code Paradigm)
1. **Be Terse & Direct**: Avoid conversational preambles, greetings, post-summaries, or re-printing untouched code blocks. Show git diffs or file edits directly.
2. **Targeted File Reading**: Never read entire files over 200 lines if searching for a specific function. Use `grep`, `ast-grep`, or specific line ranges (`start_line`-`end_line`).
3. **Concise Tool Usage**: Run compact shell commands. Pipe output to head/tail when running tests or logs (e.g., `npm test -- --bail | head -n 30`).
4. **Plan Before Refactoring**: For multi-file changes, state a 3-bullet plan before invoking file-writing tools.

## Token Economy Rules
- Do not repeat file contents back in markdown if you already modified them using file edit tools.
- Summarize long error traces into a single line error description + relevant stack frame.