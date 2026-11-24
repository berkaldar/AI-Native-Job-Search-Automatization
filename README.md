# AI Native Job Search Automatization

A job search run by AI agents. [Claude Code](https://claude.com/claude-code) sub-agents scan job boards, tailor CVs and cover letters, apply, and record every step on a live dashboard. Scheduled tasks keep it running without a human at the keyboard; the human only steps in for passwords, CAPTCHAs and real decisions.

There are two separate flows:

```mermaid
flowchart LR
  subgraph F1["Flow 1: QA, QA Automation & SDET jobs"]
    S1[job-scan-linkedin<br/>job-scan-boards] --> W1[job-writer<br/>CV + cover letter] --> A1[job-apply-*<br/>LinkedIn, Indeed, Kariyer, ATS forms] --> T1[job-tracker]
  end
  subgraph F2["Flow 2: US universities, remote contractor outreach"]
    S2[job-scan-universities<br/>University HR Scanner] --> W2[writer<br/>batch N e-mails] --> G2[build-us-outreach.cjs<br/>checks = the gate] --> P2[us-outreach-step.cjs<br/>pacing] --> O2[job-outreach-us<br/>Yahoo Mail via Playwright] --> T2[job-tracker]
  end
  T1 --> D[(Live dashboard)]
  T2 --> D
```

## What's in here

| Folder | Contents |
|---|---|
| `.claude/agents/` | 14 Claude Code sub-agents: scanners, the writer, one applier per job site, the US outreach sender and the tracker |
| `.claude/skills/job-search/` | The skill that holds the shared rules every agent follows |
| `scheduled-tasks/` | Prompts for the scheduled runs: the hourly LinkedIn scan, the weekday outreach sender, and the weekly university scanner + writer |
| `work/` | Private runtime data (CVs, letters, answers, queue, logs, driver scripts). Git-ignored, never committed; CI fails if anything in it is tracked |
| `scripts/us-outreach/` | The outreach builder (one copy; it works on `work/` by default, env `US_WORK_DIR` / `US_OUTREACH_DIR` override) (validates every e-mail and builds the send queue) and the step script (all pacing rules, with a self-test) |
| `dashboard/` | The dashboard page: both flows as separate pipelines, dark theme |
| `tests/` | Builder tests on made-up fixtures, plus checks that every agent, skill and task definition loads |

## Guardrails

The rules live in code, so a scheduled run can't get them wrong:

- **Pacing:** one e-mail at a time, at least 25 minutes apart, at most 10 a day. Sends only on weekdays, 16:00–21:00 Ankara time.
- **Per university:** one e-mail a day, and the HR e-mail only on a later day than the student support e-mail.
- **Pre-send checks:** the address must still be on its official source page. The recipient, body and attachment are checked before the send button is pressed.
- **After sending:** the e-mail must show up in the Sent folder. Anything unexpected writes a STOP that blocks sending for the rest of the day.
- **No double sends:** rebuilding the queue never resets a status, so nothing is sent twice.
- **Off-limits for agents:** they never type passwords, verification codes or government IDs, and never solve CAPTCHAs.

## CI

Every push runs `.github/workflows/ci.yml`:

1. a syntax check of every script;
2. **nothing under `work/` is tracked** (`git ls-files work` must be empty) and the **personal-data guard** (`node sync.cjs --check`): it fails on phone numbers, personal e-mail addresses, salary figures or ID numbers;
3. checks that every agent, skill and task definition loads;
4. the pacing self-test;
5. the builder tests: a valid batch builds, and broken batches are refused (formal greeting, wrong spelling of Turkey, non-.edu address, duplicate address, missing metadata, false residency claims).

## Syncing

The project is this one folder. Agents and the skill load from `.claude/` when Claude Code runs here; private data sits in `work/`. Only the three scheduled-task prompts must live in `~/.claude/scheduled-tasks`, so `sync.cjs` copies those in and runs the personal-data check:

```powershell
node sync.cjs
git add -A
git commit -m "Sync"
git push
```
