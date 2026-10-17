# First-week teaching and lesson workspace review

## Current revision — 17 October 2026

**Status: published and verified, 17 October 2026.** This record supersedes the teaching descriptions in the historical 16 October review below. The revision started from `f8afda9`; the [evaluation standard](docs/week-one-evaluation-standard.html) was written and committed as `e69e467` before lesson edits. Its frozen SHA-256 is `08A1F5B92E51BE114730EAB58DFA4E8AA841EF22B15A3847C619FE394CB7785F`. The evaluated implementation is `26aabaa8d6c019d73091047dd821adfd76a856fa`. Publication does not establish learner effectiveness.

The task was to correct unclear Hebrew, questions without a meaningful mathematical purpose, and solutions or proof routes disclosed before an attempt, while preserving existing progress. All **22 sections of the four first-week lessons** were reviewed and revised against that standard. Direct concept teaching remains available. Practice now asks for a justified mathematical result; optional hints supply progressively more help, and full solutions remain directly available. Summaries do not require another quiz or reconstruction to finish.

### Revised lesson briefs

| Session | Starting knowledge and capability | Current teaching and practice |
| --- | --- | --- |
| 5 October: expectation and variance | Elementary coin probabilities; define indicators, calculate moments and explain the variance of a sum | Explicit descriptions distinguish two independent tosses from counting one toss's indicator twice. The overlapping-event exercise asks for a complete calculation and dependence argument, followed by the changed-event exercise. Neither supplies its intermediate values before help is opened. |
| 7 October: balls and bins | Lesson 1; apply probability bounds and distinguish pairwise from mutual independence | Direct teaching includes a concrete pairwise-but-not-mutually-independent example. One-bin and maximum-load exercises require modeling and justification. Maman 12 Q2 is honestly identified as application after same-model preparation; its collision-counting prohibition remains. |
| 9 October: random permutations | Expectation, covariance and bounds; count joint events and compare justified bounds | Small-case enumeration precedes a separate card-draw example. The general fixed-point derivation is an optional closed example explicitly identified as disclosing Maman 12 Q1(a). All mandatory parts a–d remain; the transposition-variance proof remains optional. Prior assistance is acknowledged instead of requiring artificial reconstruction. |
| 10 October: coupons and runs | Complements, independent trials and union bounds; choose event decompositions and justify limits | The numerical coupon and run exercises allow a full attempt before disclosing event choices. Both Maman 11 questions retain the required union/intersection method, while choosing the specific events remains part of the attempt. Solutions explain logarithm bases, integer rounding, sufficient bounds and asymptotic conclusions. |

Dates, durations, prerequisites, official problem references and the mathematical experiments and final targets remain compatible with existing work. Numerical blanks were broadened into justified calculations of the same quantities. Time estimates remain estimates, not measured completion times.

### Help, previous work and sources

Generated NotebookLM requests distinguish concept teaching, demonstrations, practice, recall and summaries. Both practice help modes use the current section and preserve their chosen behavior. Requests exclude hidden examples, hints, solutions, checking criteria and private drafts. Selecting a mode in the preview and closing it now leaves the main selector correctly selected: each selector has its own native radio group while the transient preference remains shared.

Existing lesson and section IDs, content version `1`, storage keys, settings schema and progress semantics are unchanged. The old public explanations and question text are archived in `docs/lesson-previous-content.js` and available in a closed disclosure beside an existing nonempty draft. This archive contains no private answers. Rewording never awards independent-solution credit, and absence of a recorded help reveal does not establish that an earlier attempt was independent. Synthetic regression fixtures were used; the user's personal progress was not a test fixture.

Actual local source PDFs were checked again on 17 October: lecture 1 pages 2 and 6; lecture 2 pages **3, 4 and 5**; and page 1 of Maman 11 and Maman 12. Lecture 2 page 5 supports the condition check for the taught Chernoff theorem. Source restrictions, mandatory assignment parts and the distinction between authored exercises and official questions remain explicit. Private PDFs and student solutions were not published or used as answer material.

### Verification and remaining limits

| Check | Result on this revision |
| --- | --- |
| Automated suite | **74/74 passed** with `node --test` and the expanded test-file list on Windows. `npm test` failed because the `tests/*.test.js` wildcard was not expanded by this Node 20 Windows invocation; it is not recorded as passing. |
| Mathematical and source review | Independently checked definitions, calculations, proofs, source restrictions, small coin/permutation cases, pairwise-independent placements, thresholds and rounding. |
| Progress compatibility | Synthetic pre-revision records retained drafts, bookmarks, opened-help records, completion and learning evidence, schedules and unrelated fields across save, reload and export/import. Recovery and conflict checks preserve work; no state migration or reset was introduced. |
| Prompt and selector behavior | All section requests and both help modes checked; hidden help and drafts excluded. Focused regression covers preview selection, closing/reopening, changing the main selector and rerendering. |
| Rendered lesson content | All 22 sections inspected with initial content and revealed help in the local browser preview at 320 CSS pixels. Formula overflow was corrected so long equations scroll locally without widening the page. |
| Untested environments and outcomes | No real Safari, screen-reader or 200% browser-zoom check, and no uncoached learner attempt. Responsive inspection and editorial scores do not establish accessibility conformance or learning effectiveness. |
| Publication | [Pages deployment succeeded](https://github.com/lefonde/Courses/actions/runs/39059840826) for `26aabaa`. At 18:52:06 UTC, seven public assets returned HTTP 200 and exactly matched that commit's Git blobs: index, lesson content, old question context, lesson UI, lesson CSS, teaching UI and the frozen standard. The public browser's personal storage was not accessed or changed. |

The independent final evaluation applies all 32 rubric criteria to each lesson and passes all five acceptance gates in the tested scope. Scores are **99.1, 99.1, 99.4 and 98.1 out of 100** (mean 98.9). Remaining deductions concern compressed covariance algebra, modest additional transfer in the balls-and-bins assignment, one shared hint ladder for the permutation assignment, and limited repair of logarithm/exponential algebra. These are material-review scores, not measured learning outcomes. The complete local report records all 22 section findings, every criterion rating and the evidence.

[GitHub CI also passed](https://github.com/lefonde/Courses/actions/runs/39059841497) using the repository's `npm test` command on Ubuntu with Node 22. The separate Windows command limitation above remains accurately recorded. Focused browser verification additionally covered 390×844 and desktop 1280×720, keyboard Enter/Escape, restoration of focus after pause/help dialogs, and survival of a synthetic earlier draft. The browser surface was Codex's in-app browser; its engine version was not exposed. Two intermittent local reloads omitted an unchanged JavaScript asset and succeeded on retry; the cause was not established.

## Historical implementation review — 16 October 2026

The record below describes the earlier implementation and its checks. Phrases such as “copied tosses” and “partially completed” describe that former content, not the revised teaching brief above. Its release status and test results apply only to that earlier version.

Implementation date: 16 October 2026. Baseline: `7dcc1a7f67e37973501fc012f45e1b655ab963b9`.

Status: implemented and checked locally. The owner reviewed the preview and reported that it looks much better. Publication is authorized for the first-week reader and theme-control correction. That visual feedback does not substitute for the learner exercise below. Deployment evidence is recorded in the release notes. The governing document is [DEVELOPMENT_PROTOCOL.md](DEVELOPMENT_PROTOCOL.md).

### Brief and scope

The student opens the next planned meeting to learn. Previously the task dialog prioritized copying an AI prompt, repeated that action, and placed the actual lesson behind a separate “track.” Explanations, questions, progress bookkeeping and scheduling policy competed for attention.

This change makes learning the default first-week experience. The home page has one next-session action. A new lesson directory leads directly to a full reading page with a numbered outline, topic, purpose, approximate time and a clear next section. Explanation, worked example, question, hint and solution have distinct roles. Optional NotebookLM help is beside the lesson, and its preview explains exactly what is copied. Pausing opens the existing explicit meeting-report transaction.

The four existing session IDs, dates, durations, dependencies, topic gates and original problem IDs are preserved. Only their titles, descriptions, steps and completion guidance change. Later weeks retain their existing task guides and are identified as such in the directory. Their duplicated AI-copy action was removed. Adaptive recommendations remain accessible from a disclosure on the home page. Catch-up planning and the unscheduled backlog remain available.

### Lesson briefs

| Session | Starting knowledge | Capability and sequence | Practice and feedback | Time |
| --- | --- | --- | --- | --- |
| 5 October: expectation and variance | Fair-coin outcomes and elementary probability | Indicator → weighted expectation → squared deviations → covariance → variance of a sum | Die indicator, independent versus copied tosses, partially completed overlapping-pair calculation, a changed event with negative covariance | 80 minutes of sections, 5-minute break and 5-minute flexibility within the existing 90 minutes |
| 7 October: balls and bins | First lesson, especially pairwise independence | Markov/Chebyshev/union bound → one-bin variance → all-bin bound → original assignment | Numerical comparison of two bounds, completion of deviation and union steps, full attempt at Maman 12 Q2, hidden worked proof and checks | 30 minutes preparation, 40 assignment, 10 review, 5 break and 5 wrap-up within 90 minutes |
| 9 October: random permutations | Expectation, covariance and tail bounds | Enumerate a small permutation → count a joint event → second moment → compare bounds → transpositions and theorem assumptions | Six permutations, changed thresholds, all required Maman 12 Q1 parts, explicit comparison table and Chernoff applicability explanation | 135 minutes teaching/practice/review, 15 breaks and 30 reserve within 180 minutes |
| 10 October: coupons and runs | Complements, independent trials, union bound | Local failure → product within a local event → union across events → asymptotic conclusion | Numerical coupon/run examples, both original Maman 11 questions, event decompositions, rounding and limit checks | 135 minutes teaching/practice/review, 15 breaks and 30 reserve within 180 minutes |

Times are estimates, not measured completion times. Reading and navigating do not imply understanding. Feedback is available on request. Original assignment solutions are labelled as solutions, and the student still reads the full original question from the PDF. The independent coin exercise changes the dependence structure instead of merely changing a number.

### Source record

The originals were found in the user's Documents course folder and inspected locally. No source PDF, scan, personal progress or answer was copied into this repository. Page numbers below are PDF page numbers.

| Original | Inspected pages | Use and source constraints |
| --- | --- | --- |
| אלגוריתמים אקראיים - שיעור 1.pdf | 2, 6 | Union bound versus multiplication under independence, random variables, expectation and linearity |
| אלגוריתמים אקראיים - שיעור 2.pdf | 3, 4 | Variance, Markov, Chebyshev, covariance and the independent-sum setting for Chernoff |
| מטלה 12 - הערכות זנב.pdf | 1 | Q1: n≥7, fixed points, transpositions, supplied transposition variance, the four requested bounds and Chernoff applicability. Q2: uniform pairwise-independent placements, maximum load at most c√n with probability at least one half, without collision-pair counting |
| מטלה 11 - ניתוח מאורעות, חישוב תוחלות.pdf | 1 | Q1: at least 2n ln n purchases and missing-coupon probability tending to zero. Q2: c log₂ n consecutive successes and a suitable constant. Both require unions of simple events that are intersections of independent smaller events |

The lesson text and preparation exercises were authored for this site. They are not quotations or official marking schemes. The complete assignment wording remains in the source viewer. Student solution files were not needed or used.

Mathematical review checked the coin examples by enumerating all outcomes; fixed-point and transposition moments by enumerating all permutations through n=7; balls-and-bins claims on pairwise-independent affine-function distributions; and coupon/run rounding and bounds. The exposition states where independence is needed and distinguishes an upper bound from an exact probability. The standard independent-indicator Chernoff bound is not applied to dependent permutation indicators. This does not rule out stronger bounds from other analyses.

### Interaction and data model

`lesson-content.js` holds semantic content blocks and stable section IDs. `lesson-ui.js` renders them; `lessons.css` contains the reading layout. `lesson-engine.js` manages only reading location, answer draft and opened-help records.

`settings.lessonWorkspace` is optional, versioned and validated by the existing storage adapter. It does not modify session status, learned-topic flags, problem evidence, scheduling or exam readiness. Legacy scaffold records remain intact. Their old reading position maps to the corresponding new section without converting old activity into learning credit. A mismatched content version fails visibly instead of silently attaching a draft to a changed question.

Draft saves use the existing revision-checked storage queue without rerendering the editor on every keystroke. Navigating flushes pending work. Rapid A → B → A visits preserve the last location. Failed writes retain drafts in memory and show retry/export actions. A recovery export merges pending drafts with the most recent readable saved state. If storage cannot be read, it explicitly warns that the exported snapshot is from the current window. Import retains the existing replacement confirmation and backup behavior. The browser warns before closing while a draft is pending.

The optional AI request includes the current section, question, tables and any explicitly recorded meeting context. It excludes the answer draft and does not send anything automatically. Opening hints or a solution never awards independent-solution credit. Self-reported evidence continues through the existing meeting review and confirmation flow.

### Checks and limitations

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

### Learner check before expanding the pattern

Following protocol section 11, let the student open the variance lesson, explain what they expect to learn, attempt a question, obtain help if needed, and resume after a pause. Observe hesitation without coaching through the controls. Ask for an explanation of why copied tosses change the variance and then an attempt at the changed-event exercise. Check whether the student distinguishes a hint from a solution and a saved position from completed work.

Use those observations to adjust this week before rewriting further weeks. The next development task should not assume that the current section count, prose length or time estimates are already validated.
