---
name: job-search
description: Berk Kaldar's job search workflow - scanning job sites, writing CVs and letters, applying, and recording on the dashboard. Use whenever the work is about Berk's job applications, the job-* agents, the job dashboard or the hourly scan.
---

# Berk's job search

1. **Read the rules first:** `C:\Users\berk_\Desktop\FoodieProject\.claude\worktrees\cv-to-latex-7a5459\.playwright-mcp\memory.md`. It holds every standing rule, the security limits, the site table and the fixes log. Where an older file disagrees, memory.md wins. Put every new rule Berk gives there, with the date.
2. **Don't ask Berk** unless something is extreme (10 Nov). Things only he can do go on one grouped list: passwords, CAPTCHAs, codes, TC kimlik, his birth date, abroad knockout wording.

## The loop
1. **Scan.** Run `job-scan-linkedin` (no browser, can run in parallel) and `job-scan-boards` (browser).
   - Backfill: 1 year, then any time (memory.md section 3).
   - Kept postings go to the dashboard through `job-tracker`.
2. **Write.** Run `job-writer` for each kept posting. It produces `cv/<id>/Berk_Kaldar_CV.pdf`, built from the ATS master, and `Berk_Kaldar_Cover_Letter.pdf/.tex`.
   - Check that the letter names no employer.
   - Add the id to `cover-approved.ids`, and the LinkedIn ones to `jobs-meta.txt` (`id|key|place`).
3. **Apply,** one browser agent at a time. Pick the site's applier from memory.md section 7.
   - Test the sink first.
   - LinkedIn:
     - `node build-tailored-runs.cjs`.
     - Run each `li-easy-t<N>.js` with `mcp__playwright__browser_run_code_unsafe` and `filename` set to its full path.
     - Read `apply-log.txt` and `answers-log.txt` after every run.
4. **Record.** Run `job-tracker` with every send, skip and closed result.
5. **Audit.** Follow memory.md section 9, every few hours. Fix broken agents and log each fix.

## Never
- Do anything in memory.md section 2.
- Call a click "sent". Only the site's own success text counts.
