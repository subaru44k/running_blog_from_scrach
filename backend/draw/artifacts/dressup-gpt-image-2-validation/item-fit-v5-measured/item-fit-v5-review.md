# Dressup Item Fit V5 Measured Review

- Base: `style-d-encyclopedia-clean-base`
- Source: existing v4 cutouts; no image generation.
- Measured body center X: `504`
- Necklace rect: `{"x":416,"y":386,"width":176,"height":78}`
- Boot rects: `{"leftShoe":{"x":409,"y":1315,"width":92,"height":148},"rightShoe":{"x":502,"y":1315,"width":92,"height":148}}`

## Placement Results

- Necklace: v4 cutout measured placement: `{"necklace":{"x":456,"y":386,"width":97,"height":78}}`
- Boots: v4 cutout measured placement: `{"leftShoe":{"x":409,"y":1315,"width":92,"height":148},"rightShoe":{"x":502,"y":1315,"width":92,"height":148}}`

## Review

- Necklace center: PASS. The necklace is now centered around measured body center X `504` instead of the old manual `512`.
- Necklace neckline fit: PARTIAL PASS. The measured placement is better centered, but the chain shape still does not truly follow the neckline curve; this is now an asset-shape problem more than an anchor problem.
- Image-right boot fit: PASS. The measured right foot toe center is `548`, while the manual anchor had `572`; shifting the right boot left improves the visible foot alignment.
- Overall improvement from v4: PASS for anchor confidence and boot placement. The audit confirms the manual anchors were not accurate enough for final placement work.

## Conclusion

- Treat `selected-style-model.json` anchors as legacy/manual estimates.
- Use `anchor-audit/measured-style-model.json` as the placement baseline for further validation.
- Do not spend more image-generation calls on necklace placement until the asset is generated or edited against the base neckline shape.
