# Dressup Item Fit V10 Boots Alpha Review

- Base: `style-d-encyclopedia-clean-base`
- Source: existing v9 boots; no image generation.
- Boot rects: `{"leftShoe":{"x":409,"y":1315,"width":92,"height":148},"rightShoe":{"x":502,"y":1315,"width":92,"height":148}}`

| Item | Alpha stats | Composite |
| --- | --- | --- |
| Boots: ribbon ankle stability fit | `{"left":{"bounds":{"x":409,"y":1315,"width":92,"height":148},"before":{"semiTransparent":325,"transparentInterior":6,"nonTransparent":10550},"after":{"semiTransparent":25,"transparentInterior":0,"nonTransparent":10556},"alphaRaised":306,"holesFilled":6},"right":{"bounds":{"x":502,"y":1315,"width":92,"height":148},"before":{"semiTransparent":313,"transparentInterior":6,"nonTransparent":10510},"after":{"semiTransparent":28,"transparentInterior":0,"nonTransparent":10516},"alphaRaised":291,"holesFilled":6}}` | [composite](item-fit-v10-boots-alpha/composite/boots-ribbon-ankle-stability-fit-opaque-composite.png) |
| Boots: pearl button stability fit | `{"left":{"bounds":{"x":409,"y":1315,"width":92,"height":148},"before":{"semiTransparent":2134,"transparentInterior":7,"nonTransparent":11063},"after":{"semiTransparent":26,"transparentInterior":0,"nonTransparent":11070},"alphaRaised":2115,"holesFilled":7},"right":{"bounds":{"x":502,"y":1315,"width":92,"height":148},"before":{"semiTransparent":2039,"transparentInterior":2,"nonTransparent":11058},"after":{"semiTransparent":27,"transparentInterior":0,"nonTransparent":11060},"alphaRaised":2014,"holesFilled":2}}` | [composite](item-fit-v10-boots-alpha/composite/boots-pearl-button-stability-fit-opaque-composite.png) |

## Review

- Ribbon ankle boots alpha: PASS. The opaque reinforcement reduced semi-transparent interior pixels without changing the measured placement.
- Ribbon ankle boots visual result: PASS. No obvious edge damage or scale regression is visible compared with v9.
- Pearl button boots alpha: PASS. Semi-transparent interior pixels dropped from roughly 2k per side to under 30 per side.
- Pearl button boots visual result: PASS. The toe-through effect is substantially reduced; the cream boot now reads as an opaque boot surface instead of exposed foot/toes.
- Verdict: Use the v10 opaque-interior boots normalization for pale/cream boots. The placement remains v9-compatible and no new image generation was needed.
