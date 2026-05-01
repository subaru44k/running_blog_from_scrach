# Dressup Item Fit V13 Clothing Review

- Base: `style-d-encyclopedia-clean-base`
- Model: `gpt-image-2`
- Body center X: `504`
- Upper body bounds: `{"x":314,"y":330,"width":380,"height":330}`
- Skirt bounds: `{"x":244,"y":545,"width":520,"height":360}`
- Target rects: `{"top":{"x":359,"y":330,"width":290,"height":270},"bottom":{"x":299,"y":535,"width":410,"height":380},"dressOverlay":{"x":299,"y":330,"width":410,"height":585}}`

| Item | Placement | Status | Placement rect |
| --- | --- | --- | --- |
| Top: simple frill blouse fit | top | ok | `{"x":359,"y":332,"width":290,"height":267}` |
| Bottom: fluffy skirt fit | bottom | ok | `{"x":299,"y":535,"width":410,"height":308}` |
| Dress overlay: pastel one-piece fit | dressOverlay | ok | `{"x":306,"y":330,"width":396,"height":585}` |

## Review

- Top shoulder/neck fit: PASS. The blouse center, neckline, and shoulders align with the base torso.
- Top arm interference: PASS with a note. The puff sleeves overlap the upper arms slightly, but they do not hide the arms or hands in a broken way.
- Bottom waist fit: PASS. The waistband lands at the base waist and remains centered.
- Bottom base-skirt coverage: MIXED. The generated skirt fits, but the base dress hem remains visible below the lavender skirt, so bottom-only items may need a base-skirt occlusion mask or longer skirt prompts.
- Dress overlay shoulder/neck fit: PASS. The one-piece overlay aligns cleanly from straps through bodice and waist.
- Dress overlay arm/leg interference: PASS. It avoids covering the arms and leaves the legs visible naturally.
- Background removal: PASS. No visible white boxes; pale clothing details remain readable.
- Verdict: PASS for clothing feasibility. Dress overlay is the strongest first clothing path. Top/bottom split is viable, but bottom-only layers need either fuller coverage or an occlusion strategy for the base dress hem.
