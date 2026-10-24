# Working on Courses

Read `COURSE_CONTENT_POLICY.md` first for every course-content task, including research, chat explanations, drafting, reviewing, glossary entries, hints, generated exercises, and publication. It records the user's mandatory instruction of 24 October 2026: course sources only; current class terminology and focus take precedence; resolve handwritten-note errors against the guide and then the supplied book without importing outside concepts. This policy overrides earlier local guidance that would permit unsourced enrichment or terminology. Pass it explicitly to subagents.

Do not treat a source about the same topic as evidence for a particular term, formal definition, notation, theorem, or proof method. General model knowledge and other agents' answers are not source evidence. Every substantive content element must have specific provenance and an independent course-alignment review. Existing generated pages and their glossary cannot certify themselves.

Before any release, run `npm run check:release`. Do not bypass a failing content check, mark unreviewed content approved, weaken the source catalog, or publish through another tool to evade the gate. The initial review manifest intentionally rejects the existing unreviewed content. Installing the rules does not authorize rewriting or publishing the learning pages; respect the user's phase decisions.

The subsequent explicit user request to upload the revised three pages for online review is recorded in the policy and `course-content/online-review-authorization.json`. It authorizes that exact snapshot while preserving unreviewed legacy statuses. `check:publication`, the release command, and the pre-push hook validate this limited authorization; the strict `check:course-content` remains unchanged. Never refresh the authorization hashes to permit later edits without a new explicit user instruction. This exception does not approve legacy course content or permit new unsourced teaching.

Read `DEVELOPMENT_PROTOCOL.md` before planning or implementing a task. It defines the product commitments, course-writing standards, development recipes, and verification requirements. Apply the sections relevant to the change and keep the work proportional to its consequences.

For scheduling, catch-up planning, or related progress changes, also read `PLANNING.md`. Use `README.md` for the current runtime, local data, source-file, and publishing setup.

Preserve the user's current task scope and existing authorization. The protocol does not authorize unrelated redesigns, installations, data sharing, or publishing. Distinguish local implementation, verification, deployment, and live verification in completion reports.
