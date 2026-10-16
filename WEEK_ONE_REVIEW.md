# First-week teaching and lesson workspace review

Implementation date: 16 October 2026. Baseline: `7dcc1a7f67e37973501fc012f45e1b655ab963b9`.

Status: implemented and checked locally. The owner reviewed the preview and reported that it looks much better. Publication is authorized for the first-week reader and theme-control correction. That visual feedback does not substitute for the learner exercise below. Deployment evidence is recorded in the release notes. The governing document is [DEVELOPMENT_PROTOCOL.md](DEVELOPMENT_PROTOCOL.md).

## Brief and scope

The student opens the next planned meeting to learn. Previously the task dialog prioritized copying an AI prompt, repeated that action, and placed the actual lesson behind a separate “track.” Explanations, questions, progress bookkeeping and scheduling policy competed for attention.

This change makes learning the default first-week experience. The home page has one next-session action. A new lesson directory leads directly to a full reading page with a numbered outline, topic, purpose, approximate time and a clear next section. Explanation, worked example, question, hint and solution have distinct roles. Optional NotebookLM help is beside the lesson, and its preview explains exactly what is copied. Pausing opens the existing explicit meeting-report transaction.

The four existing session IDs, dates, durations, dependencies, topic gates and original problem IDs are preserved. Only their titles, descriptions, steps and completion guidance change. Later weeks retain their existing task guides and are identified as such in the directory. Their duplicated AI-copy action was removed. Adaptive recommendations remain accessible from a disclosure on the home page. Catch-up planning and the unscheduled backlog remain available.

## Lesson briefs

| Session | Starting knowledge | Capability and sequence | Practice and feedback | Time |
| --- | --- | --- | --- | --- |
| 5 October: expectation and variance | Fair-coin outcomes and elementary probability | Indicator → weighted expectation → squared deviations → covariance → variance of a sum | Die indicator, independent versus copied tosses, partially completed overlapping-pair calculation, a changed event with negative covariance | 80 minutes of sections, 5-minute break and 5-minute flexibility within the existing 90 minutes |
| 7 October: balls and bins | First lesson, especially pairwise independence | Markov/Chebyshev/union bound → one-bin variance → all-bin bound → original assignment | Numerical comparison of two bounds, completion of deviation and union steps, full attempt at Maman 12 Q2, hidden worked proof and checks | 30 minutes preparation, 40 assignment, 10 review, 5 break and 5 wrap-up within 90 minutes |
| 9 October: random permutations | Expectation, covariance and tail bounds | Enumerate a small permutation → count a joint event → second moment → compare bounds → transpositions and theorem assumptions | Six permutations, changed thresholds, all required Maman 12 Q1 parts, explicit comparison table and Chernoff applicability explanation | 135 minutes teaching/practice/review, 15 breaks and 30 reserve within 180 minutes |
| 10 October: coupons and runs | Complements, independent trials, union bound | Local failure → product within a local event → union across events → asymptotic conclusion | Numerical coupon/run examples, both original Maman 11 questions, event decompositions, rounding and limit checks | 135 minutes teaching/practice/review, 15 breaks and 30 reserve within 180 minutes |

Times are estimates, not measured completion times. Reading and navigating do not imply understanding. Feedback is available on request. Original assignment solutions are labelled as solutions, and the student still reads the full original question from the PDF. The independent coin exercise changes the dependence structure instead of merely changing a number.

## Source record

The originals were found in the user's Documents course folder and inspected locally. No source PDF, scan, personal progress or answer was copied into this repository. Page numbers below are PDF page numbers.

| Original | Inspected pages | Use and source constraints |
| --- | --- | --- |
| אלגוריתמים אקראיים - שיעור 1.pdf | 2, 6 | Union bound versus multiplication under independence, random variables, expectation and linearity |
| אלגוריתמים אקראיים - שיעור 2.pdf | 3, 4 | Variance, Markov, Chebyshev, covariance and the independent-sum setting for Chernoff |
| מטלה 12 - הערכות זנב.pdf | 1 | Q1: n≥7, fixed points, transpositions, supplied transposition variance, the four requested bounds and Chernoff applicability. Q2: uniform pairwise-independent placements, maximum load at most c√n with probability at least one half, without collision-pair counting |
| מטלה 11 - ניתוח מאורעות, חישוב תוחלות.pdf | 1 | Q1: at least 2n ln n purchases and missing-coupon probability tending to zero. Q2: c log₂ n consecutive successes and a suitable constant. Both require unions of simple events that are intersections of independent smaller events |

The lesson text and preparation exercises were authored for this site. They are not quotations or official marking schemes. The complete assignment wording remains in the source viewer. Student solution files were not needed or used.

Mathematical review checked the coin examples by enumerating all outcomes; fixed-point and transposition moments by enumerating all permutations through n=7; balls-and-bins claims on pairwise-independent affine-function distributions; and coupon/run rounding and bounds. The exposition states where independence is needed and distinguishes an upper bound from an exact probability. The standard independent-indicator Chernoff bound is not applied to dependent permutation indicators. This does not rule out stronger bounds from other analyses.

## Interaction and data model

`lesson-content.js` holds semantic content blocks and stable section IDs. `lesson-ui.js` renders them; `lessons.css` contains the reading layout. `lesson-engine.js` manages only reading location, answer draft and opened-help records.

`settings.lessonWorkspace` is optional, versioned and validated by the existing storage adapter. It does not modify session status, learned-topic flags, problem evidence, scheduling or exam readiness. Legacy scaffold records remain intact. Their old reading position maps to the corresponding new section without converting old activity into learning credit. A mismatched content version fails visibly instead of silently attaching a draft to a changed question.

Draft saves use the existing revision-checked storage queue without rerendering the editor on every keystroke. Navigating flushes pending work. Rapid A → B → A visits preserve the last location. Failed writes retain drafts in memory and show retry/export actions. A recovery export merges pending drafts with the most recent readable saved state. If storage cannot be read, it explicitly warns that the exported snapshot is from the current window. Import retains the existing replacement confirmation and backup behavior. The browser warns before closing while a draft is pending.

The optional AI request includes the current section, question, tables and any explicitly recorded meeting context. It excludes the answer draft and does not send anything automatically. Opening hints or a solution never awards independent-solution credit. Self-reported evidence continues through the existing meeting review and confirmation flow.

## Checks and limitations

| Check | Result and evidence |
| --- | --- |
| Existing scheduling and catch-up behavior | Pass: existing 29 automated tests remain green |
| Persistence, recovery, migration and content integration | Pass: automated tests cover export/import, invalid data, stale revisions, quota failure, mid-save editing, rapid navigation, monotonic help exposure, old reading-position mapping, all host entrypoints, all lesson sections and escaped draft text |
| Mathematical examples and assignment scope | Pass: independent enumerations and bound checks described above, original-question coverage and time-allocation checks |
| Explanation/question/help/answer separation | Pass in local Chrome interaction and rendered inspection |
| Pause and return | Pass: typed draft → another section → reload → return restored the draft. The saved section reopened from the directory. Hints and solution disclosures worked independently |
| Keyboard | Pass for Tab to pause, Enter opening the report, and Escape restoring focus to the originating control. Section navigation focuses the new heading. This is a focused check, not a full accessibility audit |
| Layout and RTL | Inspected locally in Chrome at desktop width and responsive widths of 400 and 320 CSS pixels. Narrow layouts collapse the outline and keep long equations scrollable. Dark and light themes inspected. Forward/back arrows follow RTL reading direction |
| Sources and privacy | Pass for inspected source mappings and code/data inspection. Copy-prompt test confirms the answer draft is excluded. No automatic external messages or uploads added |
| 200% browser zoom, real mobile Safari and screen reader | Not checked. Chrome responsive emulation is not a substitute for these checks |
| Learner understanding and naturalness of Hebrew | Editorial and mathematical review completed. An uncoached learner attempt has not yet happened. No claim of demonstrated learning effectiveness |
| Deployment | See `RELEASE_2026_10_16.md` for the release and verification record |

## Learner check before expanding the pattern

Following protocol section 11, let the student open the variance lesson, explain what they expect to learn, attempt a question, obtain help if needed, and resume after a pause. Observe hesitation without coaching through the controls. Ask for an explanation of why copied tosses change the variance and then an attempt at the changed-event exercise. Check whether the student distinguishes a hint from a solution and a saved position from completed work.

Use those observations to adjust this week before rewriting further weeks. The next development task should not assume that the current section count, prose length or time estimates are already validated.
