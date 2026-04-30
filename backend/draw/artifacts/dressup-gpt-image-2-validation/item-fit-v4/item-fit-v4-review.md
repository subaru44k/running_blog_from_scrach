# Dressup Item Fit V4 Manual Review

- Base: `style-d-encyclopedia-clean-base`
- Preview: `item-fit-v4-preview.html`

## Necklace

- Center alignment: PASS. Pendant is centered on the model and reads better than v1-v3.
- Neckline-only fit: PARTIAL PASS. The chain is shorter and no longer spans the shoulders, but it still sits like a floating accessory rather than hugging the neckline.
- Shoulder strap avoidance: PASS. The endpoints stay inside the straps and do not land on top of the shoulder straps like v3.
- Symmetry: PASS. The chain is balanced left/right.
- Verdict: Best necklace so far for center and size. For a final production asset, generate or edit against the base image reference so the chain arc follows the exact neckline curve.

## Boots overlay

- Left boot scale: PASS. The fixed smaller fit rect keeps the boot close to the model foot size.
- Right boot scale: PASS. The right boot no longer looks oversized relative to the right foot.
- Ankle width fit: PASS. The boot openings are much closer to ankle width than v3.
- Toe coverage: PASS. The overlay hides the toes without a base-foot mask.
- Overlay-only viability: PASS. This is the strongest footwear result so far and does not need foot-included patches.
- Verdict: Use high-coverage boots with fixed ankle-scale placement as the default footwear strategy. Avoid low shoes unless a separate foot occlusion mask is introduced.

## Next action

- Necklace: short collarbone fit: keep as current baseline; next improvement should use image-edit/reference generation to follow the neckline exactly.
- Boots: ankle scale overlay fit: keep as current baseline for overlay-only footwear.
