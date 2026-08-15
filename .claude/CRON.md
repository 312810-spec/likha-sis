# Active Autopilot Routine

LIKHA-SIS's DepEd compliance sweep runs weekly as a Claude Code cloud
routine (not a local cron job — it runs in Anthropic's cloud against the
GitHub repo, independent of any local session).

* **Routine:** LIKHA-SIS Weekly Compliance Sweep
* **Routine ID:** `trig_01LZUvEeFpQ6UaqQba5Uf2YR`
* **Schedule:** `7 0 * * 1` (UTC) — every Monday 00:07 UTC = 8:07 AM Asia/Manila
* **Repo:** https://github.com/312810-spec/likha-sis
* **Model:** claude-sonnet-5
* **Mode:** read-only — runs `npm install && npm run lint && npm run test`,
  then the `do15-grading-audit`, `lardo-safety-audit`, `print-safety-audit`,
  and `firestore-schema-sync` skills, and reports findings. It does not
  edit, commit, or push.
* **Manage:** https://claude.ai/code/routines/trig_01LZUvEeFpQ6UaqQba5Uf2YR
  (view runs, disable, or delete — routines can't be deleted via the API)

If the four project skills' behavior changes, this routine's prompt
(embedded in the trigger's `job_config`, not in this repo) does not need to
change — it invokes the skills by name and always gets whatever version is
checked into the repo at run time.
