# Dressup Item Fit V3 Manual Review

- Base: `style-d-encyclopedia-clean-base`
- Preview: `item-fit-v3-preview.html`

## Necklace

- Center alignment: PASS. Pendant is close to the model center line and improves on v1/v2.
- Shoulder/neckline fit: PARTIAL PASS. Chain follows the shoulder direction better, but the endpoints still sit on top of the straps rather than naturally around the neck opening.
- Symmetry: PASS. The chain is visually balanced left/right after normalization.
- Alpha edge: PASS. No obvious white halo at full-body preview scale.
- Verdict: Best necklace candidate so far, but not final. The next improvement should constrain the chain to a shorter neckline arc inside the dress straps instead of using a shoulder-spanning chain.

## Boots overlay

- Left boot fit: PASS. The boot aligns with the left foot after horizontal stretch normalization.
- Right boot fit: PASS. The right foot is covered better than v1 and no longer has the obvious right-side mismatch.
- Base toes hidden by overlay: PASS. Toe lines are mostly covered without masking the base.
- No leg/skin contamination: PASS. The generated asset is boots-only and does not include replacement legs or skin.
- Overlay-only viability: PARTIAL PASS. The boots are slightly wide and the pair nearly touches at the center, but this is much more viable than low shoes or foot-included patches.
- Verdict: High-coverage boots are the strongest shoe strategy so far. For production, keep shoe assets to boots/high-coverage footwear unless a separate foot-occlusion mask system is introduced.

## Next action

- Necklace: shoulder aligned fit: keep as the current best reference, but test a shorter collarbone necklace if continuing.
- Boots: high coverage overlay fit: keep as acceptable validation baseline for overlay-only footwear.
