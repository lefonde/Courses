# Shared courses and Advanced Algorithms setup

17 November 2026 · Prepared for authorized publication; deployment not yet verified

The first implementation slice adds a shared course registry and an Advanced Algorithms exam-preparation setup. Random Algorithms continues to use its existing content and storage. The scope is the foundation and preparation inventory from phases 1–2 of [the expansion plan](MULTI_COURSE_PLAN.md), plus the bounded legacy importer and local development commands needed to verify it.

**What is available**

- Course selection in the desktop sidebar and mobile menu. Switching waits for pending saves, retains each course's last route in the current browser session, and stops on a save failure.
- An Advanced Algorithms preparation list with 30 archived research titles, topic/search filters, pagination, explicit reversible studied reports, and a separate study-record screen. Historical scores, predictions, prompts, discussions, and solutions are excluded.
- A catalog of 31 byte-distinct PDFs from 34 files, using neutral identifiers. Both folder and individual-file selection are supported. Advanced files match by SHA-256; duplicate copies do not create duplicate sources. Private source filenames remain in local browser records and private onboarding evidence.
- Course-specific backup validation and PDF viewer links. A backup from the wrong course is rejected before confirmation or mutation. Invalid course URLs offer explicit recovery choices without opening a course's progress/source store.
- A literal-data importer with a dry-run default. It never evaluates the old HTML's JavaScript. Its private output includes the reference map and 23 historical studied marks from the saved snapshot; those marks are not automatically applied to current progress.

**Compatibility and recovery**

The Random Algorithms key remains `matzpen:22902:2026-s3:progress:v1`, and its PDF database remains `study-compass-course-sources-v1`. No physical migration or reset runs. Old URLs without course parameters still select Random Algorithms, including direct lesson and source links. Existing plain-state exports remain supported.

Advanced Algorithms uses `erdos:advanced-algorithms:exam-prep:progress:v1` and `study-erdos-advanced-algorithms-exam-prep-sources-v1`. Its exports include `courseId` and `offeringId`. The `exam-prep` offering is a setup namespace, not a declaration of the teaching cohort. A future move to a confirmed offering must explicitly preserve or migrate these records; renaming the namespace is not a safe migration.

Planner-free validation accepts valid dates outside the old November preparation window and rejects unsupported scheduling records rather than discarding them. Existing revision checks, local backups, snapshotting, and storage-failure behavior remain active. New source matching never falls back to a filename when hash verification fails. Random Algorithms' folder matching remains unchanged; its new individual-file picker accepts only unambiguous basenames.

The original development checkout had 32 Random Algorithms data/problem files. All 32 remained byte-identical during platform implementation, including two files from unrelated uncommitted lesson work. The focused publication copy preserves all 30 corresponding files from the published baseline, checked with the repository's canonical hash rules; it retains ten published problem pages and excludes those two local coin-long-runs artifacts. Existing unrelated work remains in the original checkout. Browser verification used a separate loopback origin; it did not modify the user's published-site progress.

**Developer workflow**

Run these commands from the repository:

```text
npm test
npm run preview
```

The preview opens at `http://127.0.0.1:8768/`. Advanced Algorithms is at `/?course=advanced-algorithms&offering=exam-prep#exam-map`. Stop the server with Ctrl+C. An optional `--port=8769` selects another port. The server serves only `docs/`, supports GET/HEAD, prevents path escape and directory listings, and provides explicit module/font/decoder MIME types. This avoids Windows Python MIME mappings that can prevent PDF.js from loading.

Course metadata belongs in `docs/course-manifests.js`; runtime context and URL validation live in `docs/course-context.js`. Course data belongs under `docs/courses/<id>/`. A course's supported pages and optional data files determine its navigation. The existing lesson renderer and content files remain available through the legacy course adapter.

The research importer supports:

```text
node scripts/import-advanced-research.cjs --legacy-html <original-index.html> --corpus <course-folder> --saved-html <saved-browser-copy.html>
```

This reports counts without writing. To regenerate the setup, add `--write --public-out docs/courses/advanced-algorithms --private-out <private-folder-outside-git>`. The private destination must be outside every Git checkout, including parent repositories. Inspect the proposed source mapping and curriculum before reusing generated files. Regeneration does not grant content approval and must not reset learner data.

**Verification**

The development snapshot passed all 219 automated tests. The focused release is tested separately after removing the unrelated lesson dependencies. The suites cover old-state compatibility, wrong-course imports, state/schema isolation, concurrent saves, failed writes, source hashes and duplicates, invalid contexts, literal import parsing, UI save/switch behavior, and preview-server path/MIME handling. The focused release manifest contains 113 protected files, four unchanged approvals, and 109 `needs-review` records. File identities and registration are checked separately from publication authorization.

The in-app browser walkthrough verified course switching with independent marks; mark persistence after reload; restored filters; search and pagination; focus recovery at the last page; mobile course selection; light/dark appearance; the existing Random Algorithms question map and lesson reader; an old unscoped deep link; invalid-course recovery; and a real Advanced Algorithms backup export with course identity. The source walkthrough linked the supplied guide, rendered its 126-page PDF, advanced from page 1 to 2, and returned to the Advanced Algorithms source library.

Desktop layout was inspected at 1280 × 900 and narrow layout at 320 × 780, with no document-level horizontal overflow in the narrow view. This is not Safari, physical touch-device, screen-reader, or full accessibility certification. Import atomicity, corrupt backups, multi-tab conflicts, and quota failures are covered by automated tests; a complete browser import round trip was not performed.

**Content and publication boundaries**

No Advanced Algorithms teaching unit, glossary definition, theorem explanation, or solution was authored or academically certified. The imported titles are clearly identified as unreviewed archival candidates. The intended teaching cohort, current exam scope, and exact source-page mappings remain to be established before drafting the first complete unit. The preparation screen consequently reports zero available teaching pages.

The review manifest registers the new files as `needs-review` and preserves existing approvals. Technical checks do not approve educational content. The user explicitly instructed publication on 17 November 2026. Publication is being prepared through a new exact-snapshot authorization and the required `npm run check:release` gate; earlier dated authorizations remain unchanged. The strict course-content review statuses are preserved, and publication does not grant academic approval. Deployment and live verification have not yet been performed.


**Focused release preparation**

The 17 November multi-course release copy starts from published baseline `6b44238d15769129fbb67bb8449a1aa416409115`. It retains the ten published Random Algorithms problem pages and their data, glossary content, and existing tests. The unrelated local `coin-long-runs` lesson, definitions, registrations, and UI changes remain only in the development checkout. The release removes those dependencies from its course manifest and glossary loader. No prior course-content approval is expanded by this separation.

The final authorized release gate passed with all 228 tests, including nine checks for the new dated authorization. Independent technical review confirmed 18 changed or added public files, no deletions, and preservation of all 30 baseline Random Algorithms data and problem files. The focused release preview also loaded the Advanced setup, switched courses, and rendered the existing SAT lesson with its glossary links. Deployment verification is recorded separately after publication.
