# Dressup Item Fit V9 Accessory Stability Review

- Base: `style-d-encyclopedia-clean-base`
- Model: `gpt-image-2`
- Source: 2 necklace candidates + 2 boots candidates.
- Necklace target anchors: `{"leftStart":{"x":452,"y":340},"rightStart":{"x":556,"y":340}}`
- Boot rects: `{"leftShoe":{"x":409,"y":1315,"width":92,"height":148},"rightShoe":{"x":502,"y":1315,"width":92,"height":148}}`

| Item | Type | Status | Placement |
| --- | --- | --- | --- |
| Necklace: tiny ribbon stability fit | necklace | ok | `{"necklace":{"x":451,"y":340,"width":106,"height":84}}` |
| Necklace: moon pearl stability fit | necklace | ok | `{"necklace":{"x":450,"y":340,"width":108,"height":92}}` |
| Boots: ribbon ankle stability fit | boots | ok | `{"leftShoe":{"x":409,"y":1315,"width":92,"height":148},"rightShoe":{"x":502,"y":1315,"width":92,"height":148}}` |
| Boots: pearl button stability fit | boots | ok | `{"leftShoe":{"x":409,"y":1315,"width":92,"height":148},"rightShoe":{"x":502,"y":1315,"width":92,"height":148}}` |

## Necklace Stability

- Tiny ribbon necklace start alignment: PASS. The chain starts at the upper shoulder/neck boundary and does not hang from the dress neckline.
- Tiny ribbon necklace width/center/style: PASS. Width is compact, pendant stays centered, and the pink ribbon reads in the selected storybook style.
- Moon pearl necklace start alignment: PASS. The start anchors land at the same shoulder/neck boundary as v8.
- Moon pearl necklace width/center/style: PASS. The chain is slightly brighter but still within the style; pendant center is stable.
- Verdict: PASS. v8 necklace start-anchor placement appears stable across two new designs.

## Boots Stability

- Ribbon ankle boots left/right placement: PASS. Both boots align to the measured foot positions.
- Ribbon ankle boots scale and toe coverage: PASS. The boots cover the toes and do not look substantially oversized.
- Pearl button boots left/right placement: PASS. Both boots align to the measured foot positions.
- Pearl button boots scale and toe coverage: PARTIAL PASS. Placement and coverage work, but the cream design includes toe-like markings that can read as visible toes rather than boot detail.
- Verdict: PASS for placement stability, PARTIAL for generation style constraints. Future boot prompts should explicitly forbid toe lines, foot outlines, and skin-colored toe details on the boot surface.
