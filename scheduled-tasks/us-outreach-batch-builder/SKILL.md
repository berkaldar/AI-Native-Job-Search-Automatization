---
name: us-outreach-batch-builder
description: Weekly: the University HR Scanner finds up to 10 new US universities, the writer drafts their casual-tone e-mails, the builder validates them and queues them for the scheduled sender, and the dashboard rows are added.
---

Weekly batch builder for Berk Kaldar's US university outreach (Flow 2 of his job search). Berk asked on 20 Nov 2026 for this flow to run fully automatically and approved this task. Whatever passes the checks below is queued for sending without asking him. The scheduled task us-outreach-sender then sends it with its own pacing rules.

Do everything yourself in this session, in the foreground. Do not spawn subagents and do not use run_in_background: a scheduled session ends when your turn ends, and that kills background work.

Folders:
- Outreach files: C:\Users\berk_\Desktop\Berk CV\US_Outreach
- Work folder: C:\Users\berk_\Desktop\AI-Native-Job-Search-Automatization\work

Step 0: queue check. Read the work folder's us-outreach-queue.json. If 15 or more items are still "pending", stop and reply "queue still full". There is no need to add more.

Step 1: University HR Scanner. Read and follow C:\Users\berk_\Desktop\AI-Native-Job-Search-Automatization\.claude\agents\job-scan-universities.md.
- Find up to 10 NEW US universities. Skip every university and address already in batch*-targets.md or batch*-emails.md in the outreach folder.
- Prefer online student success, coaching or advising teams, and international student offices.
- Every address must be read on an official .edu page; never guess one. Give the source URL for each.
- Skip universities whose careers pages require US-state residency or SOFA status.
- Write batch<N>-targets.md, where N is the next number.

Step 2: writer. Write batch<N>-emails.md with exactly the same structure as batch1-emails.md: the same COMMON BLOCK copied word for word, the same HR template and table columns, the same "Check:" lines and section headings.
- Each unit section also gets a line "**Row:** us-<short-slug>" right after its Subject line. The slug is unique, lowercase, letters, digits and dashes.
- Tone (Berk, 20 Nov): casual and friendly, American style, not formal.
  - Greeting: "Hi <first name>," for a named person, or "Hi <team name> team," for an office inbox.
  - Then one or two sentences built on one true detail from that unit's own page.
  - Never start with "Dear" or "I am writing to".
- Use only facts that are in batch1-emails.md. Never invent experience, numbers or names.
- Write "Turkey", never "Türkiye". Never suggest Berk lives in the US or is authorized to work there. No SSN, no US address, and never mention a friend.

Step 3: checks. Run node C:/Users/berk_/Desktop/AI-Native-Job-Search-Automatization/scripts/us-outreach/build-us-outreach.cjs
- It validates every e-mail (greeting, forbidden words, .edu addresses, no address e-mailed twice) and appends the new items to the queue, keeping all earlier statuses.
- If it fails, fix batch<N>-emails.md (never the script) and run it again.
- If it still fails after 3 tries, rename the file to batch<N>-emails.REJECTED.md, run the script once more so the queue is clean, and add a todo (step 4).

Step 4: dashboard (follow the US part of C:\Users\berk_\Desktop\AI-Native-Job-Search-Automatization\.claude\agents\job-tracker.md). Load ArtifactData with ToolSearch. The dashboard is https://claude.ai/artifact/CSGfpQnaFocneQF8rqE2EL. Read each doc first and pass its version as if_version.
- For each new row, create jobs/us-<slug>:
  - company (the university), title (the unit and contact), location "Remote from Turkey · contractor";
  - group "us", kind "outreach", fit "unchecked", applied false, pipe "apply", url (the unit's source page), hrTo (if any);
  - rank after the current highest;
  - note "Batch <N>, queued <date>: student support e-mail to <to>, then HR e-mail to <hr> on a later day."
- Update agents/outreach-us-scanner, agents/outreach-us-writer and agents/outreach-us-approval: lastRun, plus a lastResult with real counts. For approval, write "Batch <N> auto-checked and queued (Berk: fully automatic since 20 Nov)".
- On failure, add an open todo with lane "us" and group "answer" that says what failed.

Step 5: reply with one line: batch number, universities added, e-mails queued (or the reason nothing was added).

Never send e-mail in this task.