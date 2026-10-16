# A clearer visual identity for the course website

Colors accepted, identity proposed · 16 October 2026 · Governed by [DEVELOPMENT_PROTOCOL.md](DEVELOPMENT_PROTOCOL.md), especially sections 2, 3, 7, 9, 11 and 12.

The proposed direction is a quiet, adult study environment: a clearly typeset lesson, useful practice, and an obvious way to continue. Use neutral surfaces, an ink-blue action color, consistent icons, and a Hebrew wordmark. The site should feel like a carefully edited course, with enough interface to support the work.

The first-week reader is the foundation for this direction. The owner's feedback was that it looks much better. That is useful visual feedback, not evidence yet of learning effectiveness. Preserve the reader's content structure and saving behavior while improving its presentation.

The immediate release publishes the rebuilt first week and all four requested appearances through a persistent top-bar selector. The owner selected both dark palettes and requested two light options. The name, logo and wider navigation changes remain a proposal. [Open the visual comparison](https://lefonde.github.io/Courses/design-preview.html).

## What is causing the current visual problem

Green is present in the page background, panels, borders, text and actions. As a result, the accent stops directing attention and becomes an atmosphere. The near-black base and pale green controls also resemble a technical console. Many boxed regions compete with the lesson, and the navigation uses unrelated Unicode symbols with inconsistent weight and meaning.

The compass name describes getting somewhere. The core activity has become learning and practicing within the site. Continuing to extend the navigation metaphor would require students to interpret a brand story during ordinary work. The interface can simply name the subject and the action.

## Recommended appearance

Use **paper and ink** as a visual reference, without paper textures, ornamental rules or simulated stationery. Light mode has a warm off-white surround and a clean reading surface. Dark mode uses neutral charcoal with slightly lighter panels and soft white text. Blue identifies actions and the current location. Green is reserved for an actual successful result, paired with text.

Dark mode remains a first-class choice. The design should not make a claim that one mode improves learning. Keep existing saved preferences. In a later theme-settings change, a new visitor can follow the device appearance with an explicit override. That requires a small compatibility decision because the current preference is only light or dark.

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| Page surround | `#F4F2ED` | `#181B20` | Quiet area outside the lesson |
| Reading surface | `#FFFEFA` | `#20242B` | Main content and dialogs |
| Supporting surface | `#ECEFF4` | `#292E37` | Hints, inputs and selected navigation |
| Main text | `#202632` | `#ECEFF3` | Titles, prose, questions and equations |
| Secondary text | `#5D6571` | `#AEB7C4` | Time, sources and supporting labels |
| Action | `#3657A6` | `#A6BCFF` | Primary button, link, current section |
| Text on action | `#FFFFFF` | `#15213E` | Filled primary controls |
| Quiet separator | `#D8DCE3` | `#424A58` | Nonessential divisions |
| Control boundary | `#7D8797` | `#7D899B` | Inputs and controls that need a visible outline |

Both visual directions are available: ink blue and warm clay, each in dark and light mode. The owner chose to keep both dark flavors and two light options. The default for an existing light/dark preference is the ink version of that mode. No direction assigns a different color to every topic.

The specified main, secondary and primary-button text pairs are checked for at least 4.5:1 contrast. That verifies these pairs, not the whole site's accessibility. Hover, focus, disabled, error and selected states must be checked when the theme is implemented. Decorative separators need not pretend to be control boundaries. [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

## Layout and typography

Keep a small, consistent top bar for the page location, appearance and settings. The appearance selector names all four choices, has a 44-pixel minimum height, and remains reachable while scrolling. On narrow screens, it must not be hidden with the desktop sidebar. The 44-pixel target is this project's comfortable default, above the 24-pixel WCAG AA minimum with its exceptions. [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

Use one Hebrew sans-serif family for interface and teaching, starting with the existing system fonts while the design is tested. Compare a locally hosted, appropriately licensed Hebrew font only if it clearly improves extended reading. Do not make a font download or external service a prerequisite for studying. Use approximately 18-pixel lesson prose, 1.8–1.9 line height and a bounded reading column. Headings should distinguish subject, section and exercise without oversizing the page header. Keep equations in their own left-to-right context with local overflow when needed.

Use space and headings before boxes. The article is the main surface. A question gets an explicit title and response area. A hint and a solution are labelled disclosures. A source is a quiet reference near the relevant material. Preserve these distinctions in both themes and without relying on hue.

| Screen | Intended improvement | Acceptance example |
| --- | --- | --- |
| Home | One next lesson, useful upcoming meetings, a separate planning notice | The student can start without interpreting a score dashboard |
| Lesson directory | Topics, meaningful outcomes, duration and a real continue action | Saved position is distinguished from a finished lesson |
| Reader | Quiet article, compact outline, clear question/help/solution roles | Read, attempt, seek help and continue without leaving the page |
| Calendar and catch-up | Shared typography, surfaces and status colors | Unscheduled work and blocked choices remain explicit |
| Practice, cards and study records | Consistent evidence labels and fewer decorative cards | Reading, assisted work and independent work cannot be mistaken for one another |
| Source viewer and settings | Matching controls and clear return paths | PDFs remain local and the route back to the lesson is obvious |

On mobile, evaluate a compact menu for the full site navigation instead of the long horizontal strip. Keep the course title and current lesson available. Do not introduce a bottom navigation bar with seven items. This navigation change is a separate interaction slice, with keyboard, focus and return-state checks.

## Name and identity

The brand's role is to make the place recognizable. The course title must still tell the student what they are studying. Prefer a short Hebrew name that is easy to read in a tab and pronounce, works beyond this one exam, and does not imply an accredited institution, automatic mastery or a human tutor.

| Candidate | What it suggests | Main tradeoff |
| --- | --- | --- |
| **עיון** — recommended starting point | Careful study and understanding | Academic and somewhat formal; pair with a plain description to make practice explicit |
| **מחברת** | A familiar personal place for study and attempts | May sound like a notes tool and overlap conceptually with NotebookLM |
| **לומדים** | Directly names the activity | Friendly and clear, but generic and harder to distinguish |

For the first direction, use **עיון** with **לימוד ותרגול לקורס** as the descriptor. Inside the application, show the actual course name beneath it. Avoid a motivational slogan in the navigation. The preview lets these names be compared in the same header so the decision is about the product, not a list of isolated words.

These are creative candidates. Recognition, competing uses, domain availability and any registration needs are not yet checked. Confirm the name before adopting it. Keep the existing GitHub repository and URL during the first visual rollout so bookmarks and browser-local progress retain their origin.

## Logo and icon system

Start with a wordmark. Its typography, spacing and proportions should do most of the work. The preview includes a small, provisional page-spread mark to test the relationship between word and symbol. It is not a finished logo. It should not resemble a sparkle, compass, AI badge or completion checkmark.

After a name is chosen, draw two or three original vector studies, then compare them in the real header, a browser tab and a single-color print sample. Select for legibility and recognition at 16, 24 and 40 pixels. Produce an SVG master, a small-size optical variant, favicon assets and light/dark specifications. Use text for the name in the interface rather than baking it into a bitmap. Document clear space and minimum size without imposing a large brand presence on the lesson.

Replace the assorted Unicode symbols with one locally bundled SVG family. Use a consistent 24-unit grid, roughly 1.75-pixel stroke, rounded joins and 18–20-pixel display size. Keep visible text labels. A library can supply the navigation icons once its license is recorded; the logo should remain distinct from a stock navigation icon. The preview's simple SVG studies illustrate meaning and stroke consistency, not a final asset library.

| Meaning | Proposed icon | Visible label |
| --- | --- | --- |
| Home | Simple house | הבית |
| Lessons | Open book | שיעורים |
| Calendar | Calendar | לוח הזמנים |
| Practice | Pencil on a page | תרגול |
| Review | Two cards | כרטיסיות חזרה |
| Study record | List with explicit statuses | מצב הלימוד |
| Sources | Folder | חומרי הקורס |
| Appearance | Sun or moon for the destination mode | תצוגה בהירה / תצוגה כהה |

Hide decorative SVGs from assistive technology. Icon-only controls need an accessible name. Mirror directional navigation arrows for RTL, but do not mirror books, calendars or mathematical symbols mechanically. Do not use a checkmark for a page that was merely visited.

## Implementation order and verification

1. **Publish the useful correction.** Ship the first-week reader, four appearances and accessible selector placement, retaining the current name and logo. Verify the intended commit reached Pages, then exercise the deployed reader. This is the current release.
2. **Review this visual direction.** The four color options are accepted. Review their use on complete study screens, and choose the name direction separately. The palette should still work if the final name changes.
3. **Build the shared visual foundation.** The release introduces the four semantic palettes and removes hard-coded green surfaces. Continue with type and spacing scales, buttons, inputs, disclosures, focus and status styles. Start with the home, directory and reader as a complete slice, then apply the same system to the remaining screens.
4. **Develop and integrate the identity.** Finalize the chosen wordmark and vector mark, then update header, footer, titles and favicons. Do not rename IDs, routes, storage keys, the repository or the deployment origin as part of a visual change.
5. **Review the entire study flow.** Check desktop Chrome and Safari, 320/390/768-pixel layouts, 200% zoom, keyboard order, focus after navigation, screen-reader names, both themes and state transitions. Test a long formula, a long Hebrew heading, an open hint, a failed save, and a rescheduled lesson. Record real touch and assistive-technology checks separately from emulation.
6. **Release and refine.** Preserve exports and saved drafts, run the existing regression suite, compare live assets with the release commit, and use observed learner hesitation to prioritize the next change.

A visual revision is complete when the student can find the next lesson, distinguish explanation from a question, request help, locate appearance settings and return to saved work without coaching. A good-looking mockup is a proposal, not evidence that all these behaviors work. Teaching effectiveness still requires the separate learner exercise described in the protocol.

## Boundaries

Theme choices add an optional `settings.themePalette` field (`ink` or `clay`), alongside the existing `dark`/`light` mode. It is validated on import, included in exports and preserved when starting the study plan. Old preferences keep their mode. The source viewer reads the same preference without modifying progress. A failed save restores the selector to the saved choice.

This work does not change the mathematics, task dates, assessment policy, saved answers or external AI permissions. It does not add analytics, account sync, gamification or a backend. Those would require their own learner outcome and data design. The protocol remains the authority for product commitments; this document records a proposed visual direction, not a replacement protocol.
