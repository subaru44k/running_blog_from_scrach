# Dressup Anchor Audit Review

- Base: `style-d-encyclopedia-clean-base`
- Method: alpha row scan over selected-style/model-base.png

## Findings

- Body center X: measured `504`, manual neck center X `512`, delta `-8`.
- Image-left toe X: measured `455`, manual `450`, delta `5`.
- Image-right toe X: measured `548`, manual `572`, delta `-24`.
- V5 necklace rect: `{"x":416,"y":386,"width":176,"height":78}`
- V5 boot rects: `{"leftShoe":{"x":409,"y":1315,"width":92,"height":148},"rightShoe":{"x":502,"y":1315,"width":92,"height":148}}`

## Interpretation

- The manual center anchors are close but not exact for the selected style model.
- The right-side boot placement should use measured foot center instead of the older manual toe value.
- v5 should validate placement using existing v4 assets before spending more image-generation calls.
