# Dark-background portrait studies · 17 October 2026

Generated with the built-in image_gen tool via the imagegen skill. These are raster adaptations, not editable vector masters. Every call used the approved v13 drawing as edit target and the original supplied Erdős photograph as identity reference. No generated candidate was used as the sole reference for the next call.

## Decision

The owner rejected both the automatic white-on-dark inversion and the subsequent circular backing. The latter is discarded, not an accepted brand rule.

The first three distinct treatments were generated. A and C were compared in Safari on both dark surfaces at 120, 52 and 32 CSS pixels; B was rejected after inspecting its broad lens fills:
- A: large light facial planes. Rejected: the nose/cheek fills substantially change the mark's balance, and dark brows disappear against charcoal.
- B: filled lenses with an open nose. Rejected: lens fills introduce a tinted-glasses impression.
- C: narrow eyelid highlights, open lenses, light upper teeth and dark mouth cavity. The owner liked this direction but found its eyes invisible. It is superseded by the eye correction below. Generated geometry is not pixel-identical to v13.

C is archived without pixel editing as `erdos-dark-v1.png`. Its alpha is preserved. The original `erdos-proof-v13.png` remains the light-mode asset unchanged. Theme selection uses the site's explicit appearance, not only the operating system's preference. No circle, CSS inversion, tint filter or blend mode is applied to the dark asset. Cropping uses CSS only.

The comparison page is `../../brand-dark-preview.html`. The owner accepted v3 and requested publication on 17 October 2026. See [the release record](../../../RELEASE_2026_10_17.md). Earlier verification statements record their status at the time of each study.

## Eye correction and wink

The owner rejected the first eye correction (`erdos-dark-v2.png`): one eye was missing and the other was only partly painted. Adding a bright sclera sliver and pupil did not make a coherent eye. The defect existed in the generated artwork, independently of animation or CSS clipping. The assistant's prior assessment accepted contrast fragments too readily and did not adequately protect the original expression.

The current local candidate is **`erdos-dark-v3.png`**. It returns to C and restores both complete upper-eyelid silhouettes from the approved light drawing in muted warm-gray ink, with their separate lower folds. It introduces no new pupil or isolated eyeball fragment. This is an artistic treatment of the line drawing: it does not claim to preserve every photometric relationship from a photograph. The owner subsequently accepted this revision and requested publication on 17 October 2026.

Assessment criteria: both eyelid silhouettes must be visible as coherent shapes; each must have a meaningful relationship to its lower fold; the uneven angles and laughing squint must agree with the selected drawing and original photograph; the mouth stays open and legible; review the whole expression at 68/52 px and the compact mark at 32 px on both dark palettes. Passing asset loading or contrast checks is not a likeness pass.

The requested wink uses the same raster twice with complementary CSS clipping. Only the viewer-right eye region compresses, so no generated frame swaps move the glasses, nose or mouth. It plays once for 620 ms on hover or keyboard focus. The closed pose retains 32% height to keep a visible mark at small sizes. There is no idle loop. Touch-only input, reduced-motion preferences, unsupported clipping and forced-colors mode use the intact static drawing. Light mode uses the same method on its unchanged original. Preview-only controls can replay or pause the closed pose; they are not added to the course navigation.

## Evidence and limits

Local rendering review of v3: Safari showed both complete eyelid strokes in the four shared theme specimens and the actual warm-dark sidebar. The preview's frozen closed pose retains a visible compressed eye, and replay returns to the resting face. The hover selector is implemented, but a live pointer-triggered animation was not captured by the available browser controls. Chrome's emulated mobile page stayed blank, so the current mobile header was not visually verified. Reduced-motion, forced-colors and unsupported-clipping fallbacks were inspected in source, not exercised in a browser. Asset paths, the unchanged original light file and whitespace checks passed. No publication occurred.

- [Gilad, Meng and Sinha, PNAS 2009](https://web.mit.edu/sinhalab/Papers/Ordinal_Rels2009.pdf): ordinal contrast relationships around the eyes affect recognition of photographic faces. This supports investigating polarity rather than brightness alone. It does not validate our line drawing or prove that C is best.
- [Mailchimp's official brand assets](https://mailchimp.com/about/brand-assets/): a specifically designed reverse face-logo version is provided for dark backgrounds.
- [Chris Mitchell / Epicicons](https://www.epicicons.com/blog/avoid-negative-looking-reversal-icons): illustrative logos may need selectively reworked positive/negative areas rather than mechanical inversion.

Acceptance is visual and contextual: preserve the aged, asymmetric laughing expression against the original photograph, retain the open drawing, avoid eye/mouth reversal, compare actual small sizes on both palettes, and retain the lowercase erdős wordmark. Scientific evidence informs a constraint; it is not an endorsement of the generated artwork.

## Exact prompts

### A · larger facial planes
```text
Use case: precise-object-edit, identity-preserve.
Asset: dedicated dark-background variant of the approved minimalist Paul Erdős portrait logo.
Input 1 is the exact approved drawing to EDIT; input 2 is the original photograph for identity reference only.
Preserve the exact spatial layout, shapes, angle, asymmetry and fine uneven ink contours of input 1: unequal tilted glasses, tired almost-closed laughing eyes (viewer-left narrower), asymmetric lifted brows, long irregular nose, open crooked smile with light upper teeth strip and dark mouth cavity, two thin cheek creases. Do not generate a new caricature or portrait.

TASK: optically adapt this drawing for use on charcoal #20242b and brown-charcoal #2b2724, without simply reversing black and white. Retain dark eye slits and dark open mouth, with pale upper teeth. Make a sophisticated spare two-tone cut-paper/ink reverse mark: introduce a few carefully shaped, connected muted light gray-beige facial planes behind the eyes inside the glasses and across the nose/upper-cheek/mouth region. Those light regions follow the anatomy of the approved drawing, and allow its dark features to retain their natural contrast. Leave broad regions and the outer face contour OPEN to the transparent background. Where needed only, use sparse muted light contours to connect the dark-and-light facial forms. Use a medium-light warm gray #bcb7ae rather than glaring white, dark ink #25272b. No filled oval head, no plate, badge, circle, rounded rectangle, outer silhouette border, neck, hair, ears, extra wrinkles, glow, gradients, drop shadow or texture. This must feel like the same elegant aging laughing man, not a cute mascot, emoji, skull, spectacle lens glare, or photo negative.

Keep the mark roughly in the central 70 percent of a square canvas with comfortable margins. Transparent background (real alpha). One single portrait mark, no text, no wordmark, no mockup, no multiple variations. Do not simplify or symmetrize the expression.
```

### B · filled lenses
```text
Use case: precise-object-edit, identity-preserve.
Create a carefully art-directed DARK MODE counterpart of the exact drawing in image 1. Image 2 is the original Paul Erdős photo, only to check likeness. Do not redraw its geometry. Match image 1's feature proportions and spacing precisely.

Use a genuinely transparent square canvas. The standalone face must occupy the middle 70% with even margins. Two flat solid tones only: muted pale warm gray #bcb7ae and charcoal #20242b. No gradients, texture or shadow.

Specific changes to input 1:
1. Keep its tilted unequal glasses and almost closed tired laughing eyes exactly. Give ONLY the inner lens areas a muted pale gray fill. The black upper eyelids and each single under-eye fold remain DARK on that fill. Spectacle rims remain dark, with an extremely fine pale outside keyline where needed to distinguish them from a dark background.
2. Eyebrows, the exact long hooked nose contour and the two thin outer cheek creases become muted pale gray tapered strokes. NO solid fill on the nose, forehead, cheeks or outer face. Preserve the vast transparent empty spaces around the nose.
3. Keep the smiling mouth opening dark, keep its upper teeth strip pale, and add only a fine pale contour along the lower edge of the dark mouth where needed so it reads as an open laughing mouth, not a white lip or floating moustache.
4. Preserve asymmetric spacing, angle, shapes and understated irregular line quality of the approved drawing. Viewer-left eye slightly more closed; do not make a generic smiling mascot.

No backing shape, circle, badge, rectangle, head silhouette, neck, hair, ears or extra facial details. No wordmark or text. This is a restrained printmaker's selective-reversal logo. The eyes stay DARK on their pale surroundings and the mouth cavity stays DARK with pale teeth, so the face avoids the visual effect of a photographic negative. Keep the construction light, open and minimal.
```

### C · selective highlights
```text
Use case: precise-object-edit, identity-preserve.
Edit target image 1: the APPROVED Paul Erdős minimalist drawing. Reference image 2: original man, likeness authority. Deliver one refined counterpart for a DARK charcoal website background on real transparent alpha. Preserve precisely image 1 geometry, asymmetric aged eyes and glasses, eyebrow placement, long nose, open crooked smile, two cheeks. Thin uneven calligraphic strokes. The drawing must remain almost entirely OPEN LINEWORK, not a filled face.

Render the glasses rims, eyebrows, hooked nose contour, under-eye folds and cheeks in subdued light stone-gray #b8b4ad. Fix only the two features that become disturbing when globally inverted:
- Keep both laughing eyelid slits DARK CHARCOAL (#20242b). Give each eyelid just a slim, anatomically shaped light sliver immediately ABOVE the slit, gently tapered like the lit upper lid. Use that narrow light sliver and its dark edge to convey the squint, NOT a broad glowing white wedge. Leave all of the remaining lens area transparent. No lens fill whatsoever. No tinted spectacles. The viewer-left slit is nearly closed; the viewer-right has a tiny more-open tired gap. Keep their unequal angle.
- Keep the open mouth cavity DARK CHARCOAL, with the exact pale upper teeth strip. A thin subdued pale lower contour encloses the open smile so the cavity stays dark, teeth stay light. Preserve its original crooked crescent shape.

This is a selective optical reversal, not a photographic negative: sparse highlights beside DARK expressive facial features. No filled regions beyond the narrow eyelid highlights and tooth strip. No background, head oval, circular badge, face silhouette, cheek/nose fill, gradient, texture, glow or shadow. No new wrinkles, symmetry, generic emoji, cartoon mascot, simplified smile or typography. Retain the approved drawing's personality and exact spacing. Center one mark in the middle 70% of the square.
```

### D · rejected pupil/sliver eye revision
```text
Use case: precise-object-edit / identity-preserve.
EDIT IMAGE 1, the muted transparent dark-mode Erdős logo. Image 2 is the approved light-mode v13 drawing for eye shape. Image 3 is the original photograph, the authority for the man's aged laughing expression.

User likes image 1's direction but the eyes disappeared on charcoal. CHANGE ONLY the eye treatment INSIDE the two spectacle lenses. Keep every other part of image 1 unchanged: canvas size, exact face position, glasses, eyebrows, nose, cheek contours, mouth, teeth, spacing, colors, stroke weight and background transparency. This must align with the input, not be a new composition.

Make the tired laughing eyes unmistakably visible at 52 and 32 pixels:
- Restore the distinct, asymmetric eyelid shapes from image 2, with viewer-left almost closed and viewer-right a little more open and hooded.
- Keep the actual eye slits dark. Around each dark slit, use a compact tapered muted-light eyelid shape with enough thickness to remain visible when small: a narrow fleshy highlight immediately below the upper lid, and a little lower-lid highlight, rather than a barely visible single hairline arc. Think of two expressive squinting eyes lit against a dark background, not blank lenses.
- The viewer-right eye should show a very small light eye opening beneath the drooping upper lid, with a tiny dark pupil; viewer-left is a narrower laughing slit. No fully open round eyes. No cute mascot. No generic symmetrical closed-eye crescents.
- Keep the lenses otherwise transparent. No broad flat lens fill, goggles, sunglasses or glare.
Use the same subdued warm gray as the existing contours, perhaps a modestly lighter gray for only these tiny eyelid highlights. No glaring white.

One exact aligned version of image 1, only its eyes improved. Real transparent alpha. No background, badge, circle, face fill, gradients, glow, extra wrinkles, texture, typography or other changes.
```

### E · complete original eyelid silhouettes (dark v3)
```text
Use case: precise-object-edit, identity-preserve.
INPUT 1 is dark-mode candidate C, the version the user liked except that its eyes are not visible.
INPUT 2 is the exact APPROVED original black-line v13 portrait. It is the authority for the EYE DRAWING. INPUT 3 is the man's original photograph for overall likeness.

Make an extremely narrow correction to input 1: REPLACE ONLY THE TWO EYELID MARKS with the complete expressive eyelid silhouettes from input 2, rendered in the same muted warm-gray ink as the glasses of input 1.

The previous attempt failed by drawing one blank eye and one half-painted eye with a tiny isolated pupil. DO NOT invent a pupil, a white eyeball, a tiny sclera sliver, or any new anatomy. Look at input 2: each eye is a coherent tapered, slightly uneven dark brushstroke expressing an aged laughing squint, with a separate fine lower-eye fold. Reproduce those exact recognizable shapes in both eyes. In the dark variant those two complete upper-eyelid shapes must be VISIBLE muted-gray strokes, not dark patches that vanish into the charcoal page. Their weight should be close to the brows, with tapered tips and asymmetric angles. Preserve the unequal original shapes. Both must read instantly as smiling eyes at 52px. Not a pair of blank arcs, not chopped pieces, not white glowing eyes, not a half-colored eyeball. The lower-eye folds stay in their same positions.

Change no other pixels intentionally: retain input 1's exact canvas framing, position and proportions, transparent lenses, glasses, brows, nose, cheeks, light upper teeth/dark mouth cavity, color and linework. Do NOT add facial planes, lens fills, badge, circle or background. No texture, gradients, glow or shadow. Real transparency. One aligned output, the approved C drawing with two coherent readable eyelid silhouettes.
```
