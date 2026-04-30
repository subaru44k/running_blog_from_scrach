# Dressup Shoulder Line Audit Review

- Base: `style-d-encyclopedia-clean-base`
- Method: alpha top-boundary scan on selected-style/model-base.png; necklace endpoints target the shoulder/body surface, not the dress neckline
- Body center X: `504`
- Shoulder line: `{"left":{"x":400,"y":376},"center":{"x":504,"y":410},"right":{"x":608,"y":376},"sourceTopY":{"left":352,"right":351},"width":208}`
- Necklace shoulder rect: `{"x":384,"y":364,"width":240,"height":118}`

## Interpretation

- v5 used a short collarbone necklace and visually read as attached to the dress neckline.
- This audit places necklace endpoints from the model shoulder/body surface and keeps the pendant on the measured body center.
- The first v6 pass should reuse the existing wider v3 necklace cutout before spending another image-generation call.
