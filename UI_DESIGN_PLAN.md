# A clearer visual identity for the course website

Colors and name accepted, portrait study implemented locally · 16 October 2026 · Governed by [DEVELOPMENT_PROTOCOL.md](DEVELOPMENT_PROTOCOL.md), especially sections 2, 3, 7, 9, 11 and 12.

The proposed direction is a quiet, adult study environment: a clearly typeset lesson, useful practice, and an obvious way to continue. Use neutral surfaces, an ink-blue action color, consistent icons, and a Hebrew wordmark. The site should feel like a carefully edited course, with enough interface to support the work.

The first-week reader is the foundation for this direction. The owner's feedback was that it looks much better. That is useful visual feedback, not evidence yet of learning effectiveness. Preserve the reader's content structure and saving behavior while improving its presentation.

The immediate release publishes the rebuilt first week and all four requested appearances through a persistent top-bar selector. The owner selected both dark palettes and requested two light options. The owner has selected **erdős**, in lowercase, and requested a reduced portrait icon based on the supplied photograph of Paul Erdős. This supersedes the rejected alef identity. The name and a current portrait study are implemented locally. The owner selected v25 for integration, corrected the spelling to **erdős** and requested a stacked composition. The owner rejected the v8 trial and supplied a screenshot selecting v13, which is now used locally. The compact mobile menu and consistent navigation icons are now implemented locally. Other screen proposals remain subject to review. [Open the visual comparison](https://lefonde.github.io/Courses/design-preview.html).

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

Keep a small, consistent top bar for the page location, appearance and settings. The appearance selector names all four choices, has a 44-pixel minimum height, and remains reachable while scrolling. On narrow screens, the appearance selector and backup settings are available inside the mobile menu, one action from the sticky header. This replaces the separate mobile toolbar so it does not crowd the lesson. The 44-pixel target is this project's comfortable default, above the 24-pixel WCAG AA minimum with its exceptions. [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

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

The mobile header is a single 64-pixel row with compact erdős branding and an icon-only menu button. All seven destinations appear in a modal drawer, followed by appearance and backup settings. The page heading and lesson outline provide context in the content. Desktop keeps its visible sidebar. Do not pack seven destinations into a bottom navigation bar. Keep keyboard, focus and return behavior part of navigation review.

## Name and identity

The brand's role is to make the place recognizable. The course title must still tell the student what they are studying. Keep the name readable in a tab and usable beyond this one exam. The identity must not imply an accredited institution, automatic mastery or a human tutor.

The chosen name is **erdős**, always in lowercase. Use the Hungarian double acute in **ő** (U+0151) in the header, page titles, accessible labels and footer. Keep ASCII asset filenames and identifiers stable. Use the name with direction isolation where it appears inside Hebrew HTML. The owner rejected the alef wordmark. The owner requested removal of the course name and number from the sidebar. Keep course context in the relevant learning views rather than adding it back to the brand block.

The name does not introduce a new metaphor into instructional copy. Keep topics and actions direct. Preserve the repository, deployment origin, IDs, routes, source databases and storage keys.

## Logo and icon system

The portrait is derived from the owner's supplied photograph of Paul Erdős. The intended method is selective reduction, inspired by the progression in Picasso's Le Taureau. The icon must preserve the person's character before pursuing fewer marks.

**Required reference discipline:** compare every new candidate against the original photograph. A previous generated drawing may guide an edit, but cannot become the sole authority for likeness. Otherwise small distortions accumulate across generations.

Preserve the distinct features with at least one or two expressive lines where necessary: the open, lopsided laughing mouth, tired laughing eyes, uneven raised eyebrows, distinctive glasses, and wrinkles around the eyes and face. Preserve their proportions and relationships. Reduce repeated strokes within a feature before removing the feature itself. Facial folds carry age and expression. A smooth generic wink-and-smile avatar fails this brief even if it is simpler.

The owner preferred the first portrait over the aggressively reduced emoji-like version. Subsequent studies restored the facial folds and open mouth while consolidating the drawing. The [generation record](docs/assets/brand/GENERATION.md) preserves the references, prompts and decisions. These are raster assets produced with the built-in image generator, not vector masters.

The owner subsequently confirmed v6's spirit, supported the v11 reduction direction, and requested further minimalism. The owner then clarified two requirements: preserve the shallow lower-lip curve from v14 because it defines the lower face, and preserve the original photograph's distinctly unequal eye openings. Viewer-left is nearly shut; viewer-right is more open but still tired and hooded. These instructions supersede earlier assessments that treated the lower-lip line as redundant. Minimalism must not turn the face into disconnected graffiti-like marks.

The owner selected [v19](docs/assets/brand/erdos-proof-v19.png) as the best version after judging the v20–v23 reduction round to have lost the person's character. Preserve its separate nose contour, both cheek folds, unequal eye openings, open mouth and shallow lower-lip curve. Future proposals must be compared to the original photograph and v19. Fewer strokes alone do not establish improvement.

The owner further specified that age should be conveyed through the length, direction and unevenness of the existing strokes, without adding wrinkle marks. Favor anatomically meaningful sag, unequal taper and changes of direction over random roughness or decorative flourishes. The owner selected [v25](docs/assets/brand/erdos-proof-v25.png), with flatter under-eye folds and longer, unequal cheek strokes, for site integration on 17 October 2026.

Center the portrait above a quiet lowercase **erdős** text wordmark as one home link, with direction isolation inside the Hebrew navigation. The owner rejected the horizontal serif composition and subsequently judged the stacked Avenir Next wordmark worse. The current local revision uses regular-weight Baskerville, with Baskerville Old Face and Times New Roman/serif fallbacks, slightly open tracking and enough line height for the double acute. The portrait is 68 CSS pixels wide above a 32-pixel wordmark. In desktop windows up to 800 pixels tall these become 52 and 26 pixels. In the mobile site header the portrait is 32 pixels wide beside a 26-pixel name. This compact horizontal arrangement leaves room for content; desktop and brand specimens retain the stack. No font download is required. The sidebar contains no course caption or number. Keep the regular Hebrew interface and lesson fonts. Use a dedicated transparent dark-background portrait rather than a global CSS inversion. The owner rejected the circular backing. Preserve readable, coherent eye shapes and the open laughing mouth; contrast research alone cannot validate the result. Keep the home link's accessible name. The portrait is decorative when paired with the visible name.

The shared [brand stylesheet](docs/brand.css) is used by the actual header, [four-theme comparison](docs/brand-preview.html), and [lesson-page proposal](docs/design-preview.html). It currently frames the unchanged v13 proof (CSS viewport x=250, y=290, width=750, height=630) to frame the face without scaling the whole sheet of paper. The runtime shell adjusts the width to 52 pixels on shorter desktop windows and 32 pixels in the compact mobile header. Multiply blending keeps the original dark strokes. Light themes retain the open crop. Dark themes use a separately generated transparent counterpart with selective highlights. Its design trials and current status are recorded in [the dark portrait studies](docs/assets/brand/DARK_MODE_STUDIES.md). Small favicon artwork remains a separate optical reduction: do not destroy the expression just to fit the complete portrait into 16 pixels.

### V25 integration brief and review · 17 October 2026

The problem was the loose relationship between the portrait, name and course caption. The intended outcome is one recognizable home link with readable course context, without taking space away from learning. Scope is the shared brand block, its responsive behavior and the previews. Lesson content, saved state, routes and source storage are unchanged.

Acceptance criteria: retain the approved face without redrawing it, keep the lowercase name readable, give the course caption its own hierarchy, retain the home link's accessible name/focus indication, avoid clipping at 320 pixels, and render on all four surfaces. On mobile the brand/navigation scrolls with the page while the reading toolbar remains sticky, avoiding stacked sticky headers.

Verification: desktop Chrome and Safari render checks, all four theme specimens in Safari, and a Chrome 320-pixel viewport check passed. The existing 50 tests passed, local asset references resolved, and the diff has no whitespace errors. A later 390-pixel/scroll check could not be completed because computer-use reported no available Chrome windows. Real touch, screen-reader interaction, zoom and favicon-size checks remain unperformed. Changes are local and have not been deployed.

### Spelling and stacked wordmark revision · 17 October 2026

The owner identified the missing double acute and the weak relationship between the face and serif name. This revision uses **erdős** consistently in visible branding, document titles and accessible labels. The approved v25 artwork is unchanged. This pass introduced a centered vertical composition and a sans-serif name, with the course caption separate. The owner subsequently rejected the font; the typography correction below supersedes that choice. The brand remains one keyboard-accessible home link, and the mobile brand/navigation continues to scroll away above the sticky reading toolbar.

Verification: desktop Chrome and Safari, all four theme specimens in Safari, Chrome at 805 × 681 (the reported viewport), and 390- and 320-pixel widths. The mobile brand scrolls away while the reading toolbar remains available. Keyboard traversal visibly focuses the complete home link, whose accessible name includes erdős and its destination. All 50 existing tests and the whitespace check passed. The v25 image remains byte-for-byte identical to the approved generated asset. These are local browser checks, not real-device or screen-reader certification. This revision has not been deployed.

### Wordmark weight and character · 17 October 2026

The owner found Avenir Next worse. The next local revision uses regular Baskerville with slightly open spacing beneath the same portrait. Its finer strokes and serif forms aim to relate more closely to the drawing. This is a revision for review, not an approved final typeface. Safari desktop and the shared four-theme specimens were visually checked, including the double acute. No behavior changed, so the existing test suite was not rerun for this typography-only edit. The mobile sizes were adjusted proportionally; this pass has not repeated mobile or assistive-technology checks. No deployment occurred.

### Earlier portrait trial · 17 October 2026

The owner asked to try the portrait in a supplied screenshot. It matches the preserved v8 original. The site and shared previews now use that exact asset, framed to retain all its strokes at the existing logo size. The stacked Baskerville name and corrected **erdős** spelling remain. v25 is preserved as the previous selection. This trial supersedes the current artwork choice, not the general requirement to preserve likeness and compare future generated revisions against the original photograph. No new image generation, content change or deployment is involved. Chrome desktop review verified the actual sidebar and all four theme specimens. A mild grayscale/contrast CSS filter removes the proof’s paper tint before blending; the source asset remains byte-for-byte unchanged. The whitespace check passed. This asset/style-only trial did not rerun behavior tests or mobile interaction checks.

### Sidebar simplification · 17 October 2026

The owner rejected v8 and requested another portrait, but no replacement image arrived with the message. Leave the portrait pending rather than guess the intended version. The separate requested change removes the course name and number from the sidebar and matching brand previews, including unused caption styles. Keep the portrait/name stack centered on mobile. Preserve course context elsewhere and leave learning state untouched. Source checks confirm the caption is absent from both sidebar templates and shared brand specimens, with other course context preserved. The whitespace check passes. Rendered review could not run because the computer-use connection closed; localhost HTTP verification was blocked by the sandbox. This change is local and not deployed.

### Selected portrait replacement · 17 October 2026

The replacement screenshot matches the archived v13 original. Apply that exact asset to the site and shared previews, keeping the stacked Baskerville wordmark and the removed sidebar caption. The CSS viewport retains all facial strokes at the existing 68-pixel desktop and 48-pixel mobile widths. No raster editing or new image generation is involved. The previous pending-image note is resolved. Chrome desktop review confirmed the updated sidebar and all four theme specimens, including the removed course caption. Asset equality, shared references and the whitespace check passed. Behavior tests and mobile interaction checks were not repeated for this artwork-only replacement. This change is local and not deployed.

### Sidebar fit · 17 October 2026

The owner requested removal of ״ההכנה שלך״ and a sidebar that needs no scrolling. Remove that label from both runtime templates. Use a dedicated `sidebar.css` after the shared styles to compact navigation spacing and the exam card, with a smaller portrait/name on shorter desktop windows. Preserve all seven destinations, the full exam details, the save-status hook and the selected portrait. Keep the exam-score weights together on one line. On mobile, use two rows of links with no horizontal scrolling. At extreme window heights or enlarged text, allow overflow so content remains accessible rather than clipping it.

Chrome rendered review confirms the full sidebar, exam link and saving status are visible at desktop size, 805 × 681 and 805 × 600. A 320 × 800 check confirms all seven mobile links fit without sideways scrolling. Static checks cover both templates, retained IDs and stylesheet order. This revision changes HTML and CSS only, so behavior tests were not repeated. Safari, real touch and assistive-technology checks were not repeated in this pass. Changes remain local and have not been deployed.

### Rejected circular dark portrait trial · 17 October 2026

The owner reported that the reversed portrait felt like a photographic negative and contrasted too strongly with the dark surface. Inspection confirmed that `invert(1)` plus screen blending turned black eyes and mouth into white marks. Preserve those facial shadows instead of treating the portrait as a reversible interface glyph. [MDN documents the inversion behavior](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/filter-function/invert); [Apple's dark-mode web guidance](https://developer.apple.com/videos/play/wwdc2019/511/) supports adapting imagery deliberately for its appearance.

This trial was rejected by the owner and removed. It removed inversion and screen blending while keeping the selected v13 pixels unchanged, using dark ink on a subdued round backing in dark mode. The backing blends 84% of the theme's secondary text color with 16% of its surface, producing cool gray for ink and warm stone for clay. The image is multiplied at 90% opacity. A wider square crop retains the eyebrows, glasses and smile inside the circle. Light-mode composition, wordmark and navigation remain unchanged. This specific treatment is a project design judgment, not a prescription from the reference sources.

Verification: Safari rendered all four theme specimens and the actual warm-dark sidebar. Chrome's 320 × 800 emulation rendered the small mobile mark without clipping. Original-asset equality, shared stylesheet references and the whitespace check passed. No behavior changed, so regression tests were not rerun. Real-device and forced-colors rendering were not repeated. Prepared and verified locally; not published.

### Dedicated reverse portrait studies · 17 October 2026

The owner requested deeper face-specific research after rejecting the circular backing. Research on photographic face recognition supports examining local eye contrast; it does not establish the best treatment for this line portrait. Mailchimp supplies a dedicated reverse face-logo version, and illustrative-logo practitioner guidance recommends selective changes instead of automatic inversion. Three artwork studies compared broader facial planes, filled lenses, and sparse highlights. The owner preferred the sparse direction (C) but found its eyes invisible. A subsequent pupil/sliver treatment was also rejected as broken and incomplete. Do not mistake brighter fragments for a coherent eye or claim a likeness pass based solely on contrast. The correction therefore restores complete original eyelid silhouettes while retaining the asymmetric laughing expression.

The selected revision, `erdos-dark-v3.png`, replaces the pupil/sliver treatment with two complete, muted eyelid strokes based on the approved light drawing. On 17 October 2026 the owner accepted the result and requested publication. The original light asset is unchanged. See `RELEASE_2026_10_17.md` for release scope and checks.

The owner also requested a subtle hover wink. One eye region from the same raster compresses for 620 ms, leaving the face and glasses still. It plays once on hover or keyboard focus, with no idle loop. Reduced-motion preferences, touch-only input and unsupported clipping retain the intact static drawing. The home link and focus indication remain. Eye artwork takes priority over the animation. See [the generation and decision record](docs/assets/brand/DARK_MODE_STUDIES.md) and [the local comparison](docs/brand-dark-preview.html).

Verification of this revision: Safari rendered the four theme specimens, the closed wink pose and the resting face after replay, plus the actual warm-dark sidebar. Both eye silhouettes are now visible in those checks. Chrome mobile verification could not be completed because its emulated page surface remained blank. Reduced-motion and forced-colors fallbacks were inspected in source but not exercised in the browser. These checks establish rendering, not owner acceptance or photographic likeness. The changes remain local and unpublished.

### Compact mobile navigation and saving feedback · 17 October 2026

The expanded logo, seven links and separate toolbar occupied most of the phone's first screen. The intended result is immediate access to the learning content, with navigation and settings one action away. The replacement is a 64-pixel sticky header and a native dialog drawer. The owner explicitly requested the familiar three-line icon without the visible word ״תפריט״. Keep its accessible name and a minimum 44 × 44-pixel target. Retain visible text labels inside the drawer.

The existing navigation, theme selector and settings button move between desktop and mobile containers. There is one instance of each control, preserving IDs, routes and handlers. Close, Escape and backdrop clicks dismiss the drawer. Choosing a destination closes it and focuses the content. Opening backup settings closes the drawer first; closing settings returns to the menu trigger. Resizing to desktop restores the sidebar and toolbar. The expanded mobile navigation remains a fallback if the shell script fails.

This uses the hamburger icon's familiarity described in [NN/g's 2025 review](https://www.nngroup.com/articles/hamburger-menu-icon-recognizability/), with the owner's explicit preference overriding that article's visible-label recommendation. Hiding navigation has a discovery cost; this layout prioritizes reading space while retaining a conventional control and labeled destinations. Native modal behavior follows the [W3C dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

Remove permanent browser-storage and local-environment notices from the header and sidebar. Keep the storage explanation in backup settings, where it informs an actual decision. A failed save still displays a persistent alert, and retrying does not clear it prematurely. A successful save or import clears the error. No storage schema, learning data, scheduling or course content changes.

Verification: JavaScript syntax checks and all 52 tests passed, including two regressions covering silent successful saves and failure/retry feedback. Chrome mobile emulation at 320 × 800 verified the compact header, icon-only trigger and modal navigation. Escape and backup-dialog return focus were checked. Safari desktop rendered the new icons and quiet toolbar in the warm light theme. Physical touch, screen-reader interaction, complete keyboard traversal and 200% zoom have not been verified in this pass. Changes remain local and are not deployed.

Reference: [Atlassian's logo guidance](https://atlassian.design/components/logo/usage) supports pairing an identifying mark with its name and giving a header link a destination-oriented accessible name. The exact typography, proportions and course separation here are project-specific design choices, checked in this interface.

The seven runtime navigation symbols now use locally authored SVGs on a 24-unit grid, with 1.7-unit strokes, rounded joins and a 22-pixel display size. Visible destination labels remain. The menu, close and settings controls use the same stroke treatment. No icon library or new dependency was added. Extend this vocabulary to other controls only when their meaning is clear. The portrait remains distinct from the navigation symbols; the design preview contains separate studies for future screen work.

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
2. **Review this visual direction.** The four color options are accepted. Review their use on complete study screens with the selected erdős name and current portrait study. The palette should still work if the final name changes.
3. **Build the shared visual foundation.** The release introduces the four semantic palettes and removes hard-coded green surfaces. Continue with type and spacing scales, buttons, inputs, disclosures, focus and status styles. Start with the home, directory and reader as a complete slice, then apply the same system to the remaining screens.
4. **Develop and integrate the identity.** The selected name and portrait study update the local header, footer and titles. Continue checking likeness against the original, then verify the icon in context and develop its small favicon variant and any vector master. Do not rename IDs, routes, storage keys, the repository or the deployment origin as part of a visual change.
5. **Review the entire study flow.** Check desktop Chrome and Safari, 320/390/768-pixel layouts, 200% zoom, keyboard order, focus after navigation, screen-reader names, both themes and state transitions. Test a long formula, a long Hebrew heading, an open hint, a failed save, and a rescheduled lesson. Record real touch and assistive-technology checks separately from emulation.
6. **Release and refine.** Preserve exports and saved drafts, run the existing regression suite, compare live assets with the release commit, and use observed learner hesitation to prioritize the next change.

A visual revision is complete when the student can find the next lesson, distinguish explanation from a question, request help, locate appearance settings and return to saved work without coaching. A good-looking mockup is a proposal, not evidence that all these behaviors work. Teaching effectiveness still requires the separate learner exercise described in the protocol.

## Boundaries

### Identity verification · 16 October 2026

The erdős identity is prepared locally and has not been deployed. The current portrait was reviewed against the supplied original for its open mouth, narrowed eyes, brows, glasses and facial folds. Artwork remains under refinement with the owner.

Rendered checks for this portrait: the transparent v6 asset was inspected on all four backgrounds in local Chrome. The desktop header and a 320 CSS-pixel emulated viewport display the portrait, lowercase name and course subtitle without overlap. These checks do not establish physical-device or assistive-technology behavior. JavaScript syntax checks, all 50 existing tests and `git diff --check` passed. No learner progress was changed during the browser inspection.

Theme choices add an optional `settings.themePalette` field (`ink` or `clay`), alongside the existing `dark`/`light` mode. It is validated on import, included in exports and preserved when starting the study plan. Old preferences keep their mode. The source viewer reads the same preference without modifying progress. A failed save restores the selector to the saved choice.

This work does not change the mathematics, task dates, assessment policy, saved answers or external AI permissions. It does not add analytics, account sync, gamification or a backend. Those would require their own learner outcome and data design. The protocol remains the authority for product commitments; this document records accepted identity decisions and remaining visual proposals, not a replacement protocol.
