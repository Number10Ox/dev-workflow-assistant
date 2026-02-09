# Snapshot — Write Back All Context to Docs

The user is at risk of context compaction or ending a session. **Immediately write back all in-session state to planning docs.**

Do NOT ask questions. Do NOT do any other work first. Write back now.

## Write-Back Checklist

For each file, compare what's in the doc vs what's true in the current conversation. Update anything that's stale.

### 1. `.planning/STATE.md` (HIGHEST PRIORITY)
- Current Position — phase, plan, status, last activity
- Progress percentage and plan count
- Performance Metrics — if any plans were completed this session, update velocity
- Session Continuity — last session date, stopped position, resume file, next action
- Accumulated Context — any new decisions made this session?
- Pending Todos — any new blockers or concerns?

### 2. `.planning/PROJECT.md`
- Key Decisions table — were any architectural or design decisions made?
- Core architecture description — did anything fundamental change?

### 3. `.planning/ROADMAP.md`
- Phase status — did any phases complete or change scope?
- New phases added or removed?

### 4. Phase-specific docs (`.planning/phases/[current-phase]/`)
- PLAN.md — did the current plan change?
- SUMMARY.md — was a plan completed that needs a summary?
- CONTEXT.md — did phase context change?

### 5. `.planning/REQUIREMENTS.md`
- Were any requirements completed or changed?
- (Usually stable — only update if requirement scope shifted)

## Output

After updating, print a short summary:
```
Snapshot complete. Updated:
- STATE.md: [what changed]
- PROJECT.md: [decisions added / no changes]
- ROADMAP.md: [what changed / no changes]
- etc.

Safe to compact or end session.
```

## Rules

- Be fast. The user is running out of context.
- Don't add speculative content — only write back what was actually decided or built.
- If nothing changed for a file, skip it and note "no changes needed."
- Commit nothing — just update the docs. The user will commit when ready.
