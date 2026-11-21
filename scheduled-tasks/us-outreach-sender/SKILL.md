---
name: us-outreach-sender
description: Sends one approved US university outreach e-mail from Berk's Yahoo every 30 minutes, 16:00-21:00 on weekdays, max 10 a day, then updates the dashboard.
---

One run of Berk Kaldar's US university outreach sender (Flow 2 of his job search). Each run sends at most ONE e-mail.

Do everything yourself in this session, in the foreground. Do not spawn subagents and do not use run_in_background: a scheduled session ends when your turn ends, and that kills background work.

Work folder: C:\Users\berk_\Desktop\job-search-work
Read and follow C:\Users\berk_\.claude\agents\job-outreach-us.md (the sender). Then follow the "US university outreach" part of C:\Users\berk_\.claude\agents\job-tracker.md (the dashboard).

1. Send step (job-outreach-us.md):
   - Run: node --use-system-ca "C:\Users\berk_\Desktop\job-search-work\us-outreach-step.cjs" next
   - If the action is "skip" or "done": stop. Reply with one line giving the reason. Write nothing to the dashboard.
   - If the action is "send": do what job-outreach-us.md says. Run the runFile with mcp__playwright__browser_run_code_unsafe (the filename parameter set to the full path). Then pass the returned JSON to "us-outreach-step.cjs mark <id> '<json>'". Then call mcp__playwright__browser_close.
2. Dashboard step (job-tracker.md). Load ArtifactData with ToolSearch. The dashboard is https://claude.ai/artifact/CSGfpQnaFocneQF8rqE2EL. Read each doc first and pass its version as if_version.
   - If mark printed a patch: apply it to jobs/<row>. noteAdd means append that sentence to the row's existing note; pipe {"__delete__": true} removes the field.
   - Update agents/outreach-us:
     - lastRun: now
     - lastResult: "Sent <id> to <to>. Today <sentToday>/10. Student support <unitSent>/<unitAll>, HR <hrSent>/<hrAll>."
     - status: "scheduled", with nextRun at the next :00 or :30 slot inside 16:00-21:00 on a weekday; or "idle" if nothing is pending.
   - Update agents/outreach-us-tracker: lastRun and lastResult.
   - If the run did not send (a STOP was written, LOGIN-NEEDED, STOPPED-before-send, an error, or check-sent-folder):
     - set agents/outreach-us to status "blocked", with the reason in lastResult;
     - add an open todo with lane "us": group "account" for LOGIN-NEEDED (url https://mail.yahoo.com/), group "answer" for anything else. The text says exactly what happened.
3. Reply with one line: sent <id> to <address>, or skipped/stopped with the reason.

Never:
- type a password or a verification code;
- edit e-mail text, or hand-edit us-outreach-queue.json;
- run a run file twice for the same item;
- send anything that "next" did not hand you.
If the Playwright browser is in use by another session, stop. The next slot tries again.