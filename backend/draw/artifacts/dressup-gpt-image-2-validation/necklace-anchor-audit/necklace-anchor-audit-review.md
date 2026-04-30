# Dressup Necklace Anchor Audit Review

- Base: `style-d-encyclopedia-clean-base`
- Method: base alpha top-boundary plus necklace cutout alpha start anchors
- Target anchors: `{"leftStart":{"x":452,"y":340},"rightStart":{"x":556,"y":340}}`
- v7 normalized anchors: `{"leftStart":{"x":453,"y":361},"rightStart":{"x":555,"y":360}}`
- v7 deltas from target: `{"leftStartY":21,"rightStartY":20}`

## Interpretation

- The manual shoulder anchors are not suitable for necklace start placement because they describe the lower outside shoulder area.
- v8 should align the generated necklace start pixels to the measured upper neck/shoulder boundary, not to a fixed fit rect.
