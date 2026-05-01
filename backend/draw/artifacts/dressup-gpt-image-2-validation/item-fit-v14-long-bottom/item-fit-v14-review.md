# Dressup Item Fit V14 Long Bottom Review

- Base: `style-d-encyclopedia-clean-base`
- Model: `gpt-image-2`
- Body center X: `504`
- Skirt bounds: `{"x":244,"y":545,"width":520,"height":360}`
- Target rects: `{"bottomLong":{"x":314,"y":520,"width":380,"height":500}}`

| Item | Placement | Status | Placement rect |
| --- | --- | --- | --- |
| Bottom: knee-length A-line skirt fit | bottomLong | ok | `{"x":314,"y":520,"width":380,"height":444}` |
| Bottom: long frill skirt fit | bottomLong | ok | `{"x":327,"y":520,"width":354,"height":500}` |

## Review

- A-line skirt waist fit: PASS. The waistband lands on the base waist and remains centered.
- A-line skirt length/base hem coverage: PASS with a note. It reaches around knee height and covers the base dress hem better than v13, though its hem is still relatively wide.
- A-line skirt opacity/independence: PASS. The skirt is opaque enough and does not include legs, feet, or torso.
- Long frill skirt waist fit: PASS. The waistband aligns with the base waist and the narrower placement feels natural.
- Long frill skirt length/base hem coverage: PASS. It reaches near the knees and hides the base dress hem cleanly without an occlusion mask.
- Long frill skirt opacity/independence: PASS. The generated asset is a bottom-only layer with opaque fabric and no body parts.
- Background removal: PASS. No visible white box or obvious alpha holes remain.
- Verdict: PASS. Prompting for opaque waist-to-knee skirts plus the v14 bottomLong rect is enough to keep top/bottom split viable. Prefer the long frill prompt pattern for child-friendly bottom assets.
