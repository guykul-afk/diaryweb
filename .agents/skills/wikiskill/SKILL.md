---
name: wikiskill
description: Implements the WikiSkill framework for continuous learning and proactive failure reflection. Use this skill to enable the agent to document experiences, learn from mistakes, and maintain a persistent knowledge base across sessions in the current project.
---

# WikiSkill Continuous Learning Protocol

You are acting as a WikiSkill-enabled agent. Your goal is to accumulate experience and refine your behavior based on past successes and failures, ensuring you do not repeat mistakes and continuously improve.

## Architecture
The WikiSkill system in this project relies on a `.wikiskill/` directory at the root of the user's workspace, containing:
1. `.wikiskill/logs/` - Raw execution experiences and post-mortems (`log_<timestamp>.md`).
2. `.wikiskill/wiki.md` - The persistent knowledge base (lessons learned, rules, patterns).
3. `.wikiskill/skills/` - Executable guidelines/prompts refined from the wiki.
4. `scripts/record-lesson.js` - Automated CLI helper for single-command logging and synchronization across workspace Wiki and global QA skill.

---

## 4 Proactive Trigger Conditions (חובת תיעוד אוטונומית)
You must NOT wait for the user to ask "did you log this?". You MUST autonomously record an entry whenever any of the following 4 conditions occur:

1. **Rework Trigger (ביצוע חוזר):** Any time a task required re-running, a command failed, a syntax/runtime error occurred, or a rollback was performed before success was achieved.
2. **Silent Failure Trigger (כשל סמוי):** A case where exit code was 0 or a test appeared to pass, but manual/browser verification revealed broken behavior (e.g. race conditions, uninitialized auth tokens, UI mismatch).
3. **User Correction Trigger (תיקון משתמש):** Whenever the user intervenes with a correction, points out a bug/regression, or clarifies that an assumption was wrong.
4. **Architectural Reality Trigger (פער ארכיטקטורה מול מציאות):** Discovering discrepancies between codebase claims / documentation and actual runtime code (e.g., backend functions not actually wired to the frontend).

---

## Workflow Instructions

### Phase 1: Context Retrieval (Pre-Execution)
1. Check if the `.wikiskill/wiki.md` file exists in the current project.
2. Read `.wikiskill/wiki.md` and any relevant skill files in `.wikiskill/skills/` using the `view_file` tool.
3. Verify that the planned implementation does not repeat any known failures documented in the Wiki.

### Phase 2: Execution & Observation
1. Perform the task requested by the user.
2. Actively monitor for any of the 4 Proactive Trigger Conditions.

### Phase 3: Autonomous Recording (Post-Execution)
If any of the 4 triggers occurred during the session:
1. Run the automated script:
   ```bash
   node scripts/record-lesson.js --title="Short Descriptive Title" --category="Auth|Firestore|UI|Engine|Build" --failure="Description of what went wrong or required rework" --solution="How the issue was resolved" --lesson="Clear rule/guideline to prevent recurrence"
   ```
2. Alternatively, manually create `.wikiskill/logs/log_<timestamp>.md` and append the new bullet to `.wikiskill/wiki.md` and `continuous-qa-learning/SKILL.md`.
3. Ensure all changes to `.wikiskill/` and project files are committed to Git.

### Phase 4: Walkthrough Documentation
In the completion summary or `walkthrough.md`, always include a **Wiki Learning** section:
- State whether any error/rework occurred.
- If yes, cite the recorded lesson and confirm it was saved to the Wiki.
