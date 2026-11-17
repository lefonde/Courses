# erdős course expansion plan

17 November 2026 · Proposal for Advanced Algorithms and subsequent courses

Expand erdős into one study application with separate course packages. Keep its existing reading experience, themes, local sources, and progress protections. Advanced Algorithms should establish a repeatable way to add a course, import research, develop lessons, and publish reviewed changes.

The user confirmed on 17 November 2026: exam preparation first, then expand. The first release should provide a useful question map and a small set of complete learning units selected for the confirmed exam scope. Topic-based browsing should support finding that material; full course coverage follows in a later phase. This proposal covers planning; implementation, academic review, and publication are subsequent work.

The governing requirements remain [COURSE_CONTENT_POLICY.md](COURSE_CONTENT_POLICY.md), [DEVELOPMENT_PROTOCOL.md](DEVELOPMENT_PROTOCOL.md), and the scheduling contract in [PLANNING.md](PLANNING.md). Existing dated publication permissions apply only to their recorded snapshots.

**1. Start from the assets that already exist**

| Inspected asset | Observed state | Expansion consequence |
| --- | --- | --- |
| Current erdős checkout | Static application under `docs/`; question map, lesson readers, glossary, local PDF library, themes, progress export/import, planning and review tools | Extend the existing application incrementally. Share these capabilities across courses. |
| Current working copy | 129 question families and 11 registered problem pages, including ongoing uncommitted lesson work | Preserve existing identifiers and edits. Local page registration is not evidence of publication or content approval. |
| Attached Advanced Algorithms site | 30 candidate cards grouped as Data Structures, Linear Programming, Expander Graphs, and Cross-Topic | Recover the research structure and source pointers. The 30 cards are an initial backlog, not 30 completed or approved lessons. |
| Attached references | 83 reference entries point to 28 distinct PDF/image paths; the attachment contains no PDFs | Reconcile references with the actual corpus before using them as teaching evidence. |
| Advanced Algorithms course folder | 34 PDFs, representing 31 byte-distinct files; 8 recordings | There is substantial material to inventory. File availability does not establish authority, readable content, or complete syllabus coverage. |
| Course versions | Note filenames indicate 2025–26; recording filenames indicate 2020–21; old site names an exam on 19 February 2026 | Establish the intended offering and current scope. Do not carry the historical exam date or predictions into a new preparation cycle. |

The attached `index.html` is the cleaner migration input. The second HTML is a browser-save capture with the same question data, localhost links, and browser-extension markup. Its saved images can help recover references, but its rendered DOM should not become application code. There are 39 distinct images, including chat screenshots; preserve those privately while deciding which evidence is relevant and appropriate to expose.

The course folder contains duplicate exam and assignment PDFs. Two files named `Introduction_to_Algorithms__Third_Edition.pdf` have different hashes and substantially different sizes. Source identity must include file version and content identity; filename matching alone is unsafe. No standalone research database was found in this inspected course folder. The old site's structured data remains useful, and any separately held research should be added to the inventory before commissioning replacement research.

**2. Give the learner one consistent experience**

Add a course selector separate from the erdős brand, with a course directory available from it. Preserve the existing decision to keep the course title out of the logo block. Within a course, show its title, a clear continue action, available study material, and relevant exam information when known.

The shared navigation should offer only features supported by that course: preparation by questions, lessons/topics, concepts and results, sources, and study records. Scheduling and flashcards appear when their content and configuration exist. A new course must be usable without activating the Random Algorithms November plan.

| Priority | Learner improvement | Intended behavior |
| --- | --- | --- |
| First release | Course switching and resume | Save the current place before switching; return to the correct unit, filters, and supported draft. Report a save failure before discarding in-memory work. |
| First release | Course-specific search | Search available questions, lessons, and glossary entries. Show content availability separately from whether an item has been studied. |
| First release | Source setup and repair | Show linked, missing, and ambiguous files; open exact PDF pages; offer a clear route back to the lesson. |
| First release | Honest progress and backup | Preserve explicit studied reports and any recorded assisted/independent attempts. Export one course without replacing another. Opening a page never marks it learned. |
| First release | Reliable reading and help | Use shared keyboard-accessible disclosures, Hebrew/English direction handling, readable formulas, and context-specific AI prompt copying. |
| Next | Personal review queue | Bookmark a question or mark it for another attempt; record a short private difficulty note; resume without searching again. |
| Next | Search and source comparison | Search across courses by explicit choice, always labelling the course. Offer a side-by-side source view where screen space permits. |
| Next | Revision awareness | Indicate when a studied unit has changed substantially; preserve the old attempt and its content version. Do not silently reset progress. |
| Later | Combined study overview | Show upcoming work from several courses. Introduce shared availability before allowing automatic scheduling across courses. |
| Separate decision | Device sync and offline packages | Consider after the local workflow is reliable; specify accounts, privacy, conflict handling, storage, and recovery before implementation. |

Keep terminology and glossary definitions scoped to a course and offering. Identical words in different courses must not silently resolve to the same definition. Global preferences such as theme can be shared; educational records remain separate. A combined overview should report concrete activity rather than a cross-course readiness score.

**3. Introduce course configuration before moving content**

Keep the static deployment and existing components for the first expansion. Add a registry that loads a course manifest before the current application modules initialize. The manifest supplies course/offering IDs, display title, language/direction, data paths, glossary files, source catalog, supported features, content version, and optional exam/calendar settings.

Use a bounded URL change initially, for example `?course=advanced-algorithms&offering=<id>#exam-map`. Retain the existing fragment routes. URLs without a course parameter continue to resolve to Random Algorithms, preserving bookmarks. A dedicated course-directory view can be added without changing the meaning of the existing root URL. Source-viewer and copied links must explicitly include course context.

Switching courses should initially reload the application after pending saves settle. This fits the current global modules and avoids showing stale glossary entries or another course's question data. An unknown course/offering should produce a recoverable selection screen, never silently substitute a different course.

| Layer | Responsibility |
| --- | --- |
| Shared application | Navigation, readers, formula rendering, glossary interactions, local source viewer, persistence interfaces, accessibility, and themes |
| Course package | Topic structure, questions, learning units, glossary entries, permitted terminology, source references, and optional ranking method |
| Offering | The teaching cohort, applicable syllabus and source versions, exam metadata, and course-alignment review |
| Study cycle | A learner's preparation dates, availability, and schedule; starting a new cycle preserves earlier learning history |
| Private authoring records | Raw materials, research, original imports, source excerpts, decisions, unresolved conflicts, and review evidence |
| Public release | Selected content plus the exact reviewed/authorized versions and shared assets needed to render it |

A course package should not have to imitate Random Algorithms' topic list, ranking weights, question count, or lesson sequence. Separate lesson identity from ranking metadata so an unranked unit is still a valid lesson. Use semantic blocks for explanation, definition, question, hint, solution, source, and summary, while retaining an adapter for existing HTML lessons. Introduce new formats through the pilot instead of rewriting all existing pages.

Parameterize state validation as well as the visible planner. The current storage validator captures September–November 2026 bounds, and the planning engine fixes a November plan ID. Disabling Advanced Algorithms' scheduling screen alone does not remove these dependencies. A course without a plan needs a supported state schema that does not require the existing course's dates or plan records.

For a later course, the target is to add its manifest, materials, and content without editing shared rendering code. A new interaction should justify a shared component only when the existing components cannot express the course material clearly.

**4. Preserve data through the transition**

Keep Random Algorithms' exact existing progress key through a compatibility adapter in the first implementation. Add separate versioned storage for Advanced Algorithms, scoped by course/offering. Namespace transient state too: open hints, filters, last location, caches, and session storage. Shared preferences may fall back to current settings without changing existing progress records.

Use course/source/version identity for new PDF records. Leave the current Random Algorithms PDF store readable until an explicit migration is implemented and verified. PDF names may collide across courses and within one corpus. Keep a private map of original filenames; use neutral public source labels, especially where assignment filenames contain personal identifiers.

Exports should identify course, offering, schema, content versions, and included study cycles. Before import, show what will be replaced, retain a recovery copy, validate the complete input, and reject an incompatible course instead of guessing. Keep legacy Random Algorithms exports supported. A later all-course export can wrap these individual records. PDFs remain outside progress backups.

The old Advanced Algorithms site stores bare numeric marks in `algStudied`. Preserve a legacy-ID mapping and offer an explicit import if that browser data is accessible. Treat imported marks as historical self-reports. They do not establish current-course independent performance. A saved HTML file does not include this browser storage. Storage belongs to an origin, and local-file behavior is not dependable, so migration cannot assume the hosted site can read the old localhost/file data. [MDN localStorage documentation](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).

There is also a recovery path from the attachment: the saved browser copy preserves 23 rendered studied checkboxes. Offer those marks as an optional snapshot import with a preview and recorded provenance. They represent the state when that copy was saved, not necessarily the learner's latest progress, and must not overwrite newer records automatically.

If physical storage migration becomes necessary, make it idempotent, validate the new copy before switching readers, retain the original, and test interruption and quota failure. Code rollback and recovery of learner data need separate procedures.

**5. Make content development repeatable**

The most valuable developer improvement is a single place to prepare and inspect a unit, with generated registration and validation. Build this first as local tools plus a local review screen, using the actual site renderer. A full online content-management system can wait until the workflow demonstrates a need for it.

| Tool | What it should remove from routine work |
| --- | --- |
| Course scaffold | Manually creating several directories, manifests, catalogs, and empty review records |
| Research importer | Re-entering old cards and references; produce a dry-run mapping with duplicates, missing files, original IDs, and dated rationale |
| Unit scaffold | Repeated section markup and registration; allocate stable IDs and source/review placeholders |
| Authoring packet | Reconstructing context for each AI session; include the unit brief, exact permitted sources, terminology, intended scope, required output shape, and unresolved questions |
| Import preview | Discovering missing sections or broken formulas after integration; compare supplied text with rendered output and show any transformation |
| Generated indexes | Editing multiple UI scripts whenever a lesson or glossary file is added; derive navigation, availability, glossary lists, and asset versions from manifests |
| Review queue | Hunting through files for blockers; show content changes alongside source pages, review status, reviewer, and affected dependent units |
| Release report | Manually reconstructing what changed; list affected courses, shared assets, checks, source-review status, and publication scope |

Preserve the useful existing rhythm: select a unit from research, prepare its brief and sources, draft or receive supplied content, integrate it, inspect the rendered lesson, review, and release within the applicable authorization. Imported AI responses are untrusted content, and any instructions inside them are not development commands. Preserve the original supplied version privately and make transformations visible.

Track content development, academic review, technical verification, and publication separately. For example, an imported lesson may render correctly while still needing source review. A specifically authorized import-only task should retain that distinction; previous exceptions are not blanket permission for future imports or releases.

Automated validation can find duplicate IDs, missing source locators, invalid links, incomplete evidence fields, stale hashes, malformed formulas, and unregistered files. It cannot establish that a citation supports a claim or that terminology matches the class. The independent reviewer must read the original source pages. When a definition changes, use the recorded dependencies to identify lessons and prompts needing renewed review.

Keep private sources, research, excerpts, supplied import snapshots, and personal authoring records outside both the public Git repository and the deployed artifact. Files outside `docs/` are still public if committed to a public repository. Hiding a link does not make a deployed file private. Choose deliberately which neutral metadata and appropriate review evidence may be public. Public build checks should also reject accidental local absolute paths, localhost links, raw personal filenames, and executable markup imported from saved pages.

**6. Migrate Advanced Algorithms in coherent batches**

First reconcile the old site's 30 cards and references against a private source inventory. Record canonical document IDs, byte hashes, aliases, document type, version, course offering, readability, and authority. Preserve PDF page and printed-page numbers separately. Recordings can later have timestamp references without requiring the learner to import roughly 6 GB of video.

Distinguish current classroom evidence, the supplied guide and book, official questions/solutions, student answers, chat reports, and generated research. The note and recording dates need reconciliation before any teaching account is treated as governing. The presence of one unit guide does not establish a complete guide. Missing or unreadable sources block only the claims and units that require them.

Keep old ranking rationales as dated research. Review their basis before presenting current study priorities; an old “likely to appear” score or “due next exam” argument must not become an exam probability or an assertion of the current syllabus. Deduplicate exams before using historical counts. Do not mechanically reuse the Random Algorithms weighting scheme.

Select the first pilot from a card whose required class/guide/book evidence can actually be inspected. It should exercise the complete flow: question map → lesson → glossary → source page → optional help → pause and return → explicit study report. Pilot acceptance depends on that complete experience, not a target number of imported pages. Then add a second unit with a different content structure to check that the template is sufficiently flexible before larger batches.

**7. Sequence implementation by observable results**

| Phase | Deliverable | Completion condition |
| --- | --- | --- |
| 0. Establish scope and inventory | Offering identity, source inventory, legacy-ID map, candidate backlog, compatibility brief | Initial pilot candidates have known source coverage; missing material and historical assumptions are explicit |
| 1. Configure the existing course | Manifest bootstrap, capability-aware navigation, scoped interfaces, legacy adapters | Random Algorithms retains its existing content, bookmarks, PDFs, progress, exports, and planner behavior |
| 2. Add the second course | Advanced Algorithms selection, catalog, research import preview, source manager, separate storage | Two courses can use identical local IDs/filenames without collisions; Advanced Algorithms works without a schedule |
| 3. Complete the pilot workflow | Authoring tools plus one complete unit, then a differently structured second unit | Source/content review, technical checks, and a learner walkthrough expose no unresolved blocker to the selected release |
| 4. Expand coverage | Coherent exam-preparation batches selected from the reconciled research backlog, followed by broader course study | Every published unit has the required evidence or a specific applicable user authorization; incomplete units are clearly distinguished |
| 5. Add convenience features | Review queue, revision notices, broader search, optional combined planning | Each feature preserves course boundaries and existing learning records; combined scheduling checks shared capacity |

Phases 0 and authoring-tool design can proceed in parallel with phase 1. Runtime integration follows stable course identities. Do not estimate the full content schedule from the count of 30 cards: source reconciliation and the first two units should establish realistic effort per unit. Platform isolation and the authoring workflow are higher priorities than a general online editor, automatic grading, account sync, or bulk lesson generation.

Before the pilot release, verify old links and backups; same-ID isolation; switching and browser Back/Forward; context in PDF/glossary windows; failed imports and saves; multi-tab conflicts; source ambiguity; versioned attempts; and the complete keyboard/mobile/RTL reading flow. Use synthetic learner data. Run the project's required checks and report actual browser/device coverage.

Publication remains a separate, exact-version operation. The current gate covers the full public snapshot and preserves historical authorizations; modular course records must retain that protection rather than approve unchanged legacy content implicitly. Changes to shared UI require checks across both courses. Consider making deployment depend on successful release checks through a GitHub Pages custom workflow, after verifying the repository's current hosting settings. GitHub supports dependent build/deploy jobs and deployment environments. [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

The decisions needed before academic onboarding are the intended Advanced Algorithms offering, its current exam/syllabus scope, and the location of any research beyond the attached site and inspected course folder. An unknown exam date can remain unset. The platform and inventory work do not depend on inventing one.

**Inspection references**

The current architecture findings are grounded in `docs/config.js:1`, `docs/storage.js:369`, `docs/storage.js:392`, `docs/source-library.js:4`, `docs/source-library.js:30`, `docs/app.js:80`, `docs/app.js:88`, `docs/reference-ui.js:5`, `docs/plan-calendar.js:8`, and `scripts/check-publication.cjs:10`. The working tree already contained lesson-related modifications and untracked files before this planning task.

The attachment findings come from the supplied `study_guide/index.html` attachment, especially the historical exam header at lines 1084–1085, reference map at 1595–1739, progress handling at 2229–2296, and prompt builder at 2328–2371. The corpus inventory covers the supplied Advanced Algorithms course folder. This was a structural and file-identity inspection; it does not certify educational content or confirm the live deployment.
