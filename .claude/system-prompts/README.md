# Kindred Appended System Prompt Profiles

Temporary **session modes** that augment Claude Code's system prompt. They layer focused behavior on top of [`CLAUDE.md`](../../CLAUDE.md) — they **never replace** it, the Constitution, or Cursor rules.

---

## What appended system prompts are

Claude Code loads a base system prompt (coding agent behavior, tools, safety). **Appended profiles** add Kindred-specific session constraints via:

```bash
claude --append-system-prompt-file .claude/system-prompts/release-mode.md
```

| Mechanism | Layer | Persists |
|-----------|-------|----------|
| **Appended profile** (this directory) | System prompt tail — session mode | Current session only |
| [`CLAUDE.md`](../../CLAUDE.md) | Project context (user message) | Every session in repo |
| [Output styles](../output-styles/) | Response format | Until `/clear` or style change |
| [Hooks](../hooks/) | Event-driven injection / commit gates | While settings.json loaded |
| [Skills](../skills/) | Task procedures | When invoked |
| [Subagents](../agents/) | Domain specialists | When delegated |

Profiles tell Claude **how to behave this session**. Skills tell Claude **what procedure to run**. Hooks **automate routing** at events. Output styles **shape report format**.

---

## How profiles differ from CLAUDE.md

| | CLAUDE.md | Appended profile |
|---|-----------|------------------|
| **Purpose** | Permanent operating guide | Temporary focus mode |
| **Injection** | First user message / project context | End of system prompt |
| **Duration** | Every session | One session (until restart without flag) |
| **Overrides** | Instruction hierarchy anchor | Augments only — cannot override Constitution |
| **Commit** | Yes (foundation doc) | Yes (`.claude/system-prompts/`) |

Use **CLAUDE.md** for always-on workflow. Use a **profile** when the entire session should stay in one lane (release sprint, perf investigation, news fix).

---

## Profile index

| Profile | File | Use when |
|---------|------|----------|
| **Release Mode** | `release-mode.md` | Pre-ship bug fixes, regression prevention |
| **Performance Mode** | `performance-mode.md` | Startup, cache, render, hydration optimization |
| **News Mode** | `news-mode.md` | Local/National News pipeline work |
| **UI Polish Mode** | `ui-polish-mode.md` | Typography, spacing, loading, visual consistency |
| **Security Mode** | `security-mode.md` | Secrets, logging, production hardening |
| **Edition Mode** | `edition-mode.md` | Build, completeness, cache, city QA |
| **Discovery Mode** | `discovery-mode.md` | Events, Activities, Food, History Around Town |

Each file includes YAML frontmatter (`name`, `description`, `scope`, `augments`) and references Skills, Subagents, Hooks, and Output Styles by path — **no duplicated procedures or editorial law**.

---

## Activate / deactivate

### Activate (new session)

```bash
# From repo root
claude --append-system-prompt-file .claude/system-prompts/release-mode.md
```

Shell helper (optional, add to `~/.zshrc`):

```bash
kindred-claude() {
  local mode="${1:?Usage: kindred-claude <mode> [claude args...]}"
  shift
  command claude --append-system-prompt-file ".claude/system-prompts/${mode}.md" "$@"
}
# Usage: kindred-claude release-mode
#        kindred-claude performance-mode --continue
```

Combine with output style in `.claude/settings.local.json`:

```json
{
  "outputStyle": "performance-report"
}
```

Pair with hooks (already in [`.claude/settings.json`](../settings.json)) — profiles and hooks complement each other.

### Deactivate

Profiles are **session-scoped**. To exit a mode:

1. Start a **new** Claude Code session **without** `--append-system-prompt-file`, or
2. Run `/clear` and restart CLI without the flag

There is no persistent “mode lock” in repo settings — deactivation is simply not passing the flag.

---

## Best practices

1. **One profile per session** — do not stack multiple `--append-system-prompt-file` calls
2. **Match output style** — e.g. release-mode + `release-report`, performance-mode + `performance-report`
3. **Let hooks route** — news/edition/security path hooks still fire; profiles align Claude with the same Skills
4. **Run Skills explicitly** — profiles reference Skills; Claude should still read `SKILL.md` before audits
5. **Delegate to Subagents** — use `@news-agent`, `@performance-agent`, etc. for heavy investigation
6. **Exit mode for out-of-scope work** — restart without profile before feature work
7. **Never edit** `CLAUDE.md` or Constitution to simulate a mode — use profiles instead

---

## Examples

### Pre-release bug fix week

```bash
claude --append-system-prompt-file .claude/system-prompts/release-mode.md
```

Prompt: *Fix National News cache hydration. Run regression-guard after.*

→ Profile enforces bug-fix scope · Hook injects news context on edit · Output `bug-report`

### Cold launch regression

```bash
claude --append-system-prompt-file .claude/system-prompts/performance-mode.md
```

Set `outputStyle: performance-report`. Prompt: *Diagnose repeat launch TTFMC regression — no code yet.*

→ `@performance-agent` · `performance-diagnostics` skill · measure before fix

### Gilbert news desk

```bash
claude --append-system-prompt-file .claude/system-prompts/news-mode.md
```

Prompt: *Use news-agent. National News blank after cache sync.*

→ News skills · `route-file-edit` hook on news paths

### Security review before commit

```bash
claude --append-system-prompt-file .claude/system-prompts/security-mode.md
```

Prompt: *Review my staged diff.*

→ `security-review` skill · `before-commit` hook on `git commit`

---

## Related documentation

| Layer | Path |
|-------|------|
| Subagents | [`.claude/SUBAGENTS.md`](../SUBAGENTS.md) |
| Hooks | [`.claude/hooks/README.md`](../hooks/README.md) |
| Output styles | [`.claude/output-styles/README.md`](../output-styles/README.md) |
| Skills | [`.claude/skills/`](../skills/) |
| Operating guide | [`CLAUDE.md`](../../CLAUDE.md) |

---

## Directory layout

```
.claude/
├── system-prompts/          ← this directory
│   ├── README.md
│   ├── release-mode.md
│   ├── performance-mode.md
│   ├── news-mode.md
│   ├── ui-polish-mode.md
│   ├── security-mode.md
│   ├── edition-mode.md
│   └── discovery-mode.md
├── settings.json            # Hooks
├── skills/
├── agents/
└── output-styles/
```

Each profile ≤500 lines. Frontmatter is for documentation and tooling; Claude Code reads the full file body when appended.
