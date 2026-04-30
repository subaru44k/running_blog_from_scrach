# Dressup Item Fit V6 Shoulder Necklace Review

- Base: `style-d-encyclopedia-clean-base`
- Source: existing v3 shoulder-aligned necklace cutout; no image generation.
- Body center X: `504`
- Shoulder line: `{"left":{"x":400,"y":376},"center":{"x":504,"y":410},"right":{"x":608,"y":376},"sourceTopY":{"left":352,"right":351},"width":208}`
- Necklace rect: `{"x":384,"y":364,"width":240,"height":118}`
- Placement: `{"x":399,"y":364,"width":210,"height":118}`

## Review

- Centering: PASS. Pendant area is placed on the measured body center X, not the older hand-entered X.
- Shoulder-line intent: PARTIAL PASS. The necklace is wider and higher than v5, so it no longer reads as a short chain glued to the dress neckline. The exact chain curve still comes from the existing v3 asset, so a final production pass should generate a fresh necklace against the base reference if this local placement is visually close but not final.
- Shoes: unchanged from v5. The measured boot placement remains the current baseline.
