# Dressup Item Fit V8 Necklace Review

- Base: `style-d-encyclopedia-clean-base`
- Source: existing v7 necklace cutout; no image generation.
- Target anchors: `{"leftStart":{"x":452,"y":340},"rightStart":{"x":556,"y":340}}`
- Placed anchors: `{"leftStart":{"x":452,"y":340},"rightStart":{"x":556,"y":340}}`
- Placement: `{"x":450,"y":340,"width":109,"height":94}`
- Scale: `0.327`

## Review

- Start-point alignment: PASS. The detected necklace start pixels are placed at the measured target anchors exactly.
- Width: PASS. Width remains close to v7 and does not spread toward the outside shoulders.
- Pendant height: PASS. Raising the start points did not push the pendant into the neck; it still reads as a necklace.
- Shoulder/collarbone fit: PASS for local placement. The chain now starts at the upper neck/shoulder boundary instead of below it, although the chain shape is still inherited from the v7 generated asset.
- Verdict: Use v8 as the current necklace baseline. No additional image-generation call is needed for this correction.
