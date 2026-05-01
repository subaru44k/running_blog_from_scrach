# Dressup Item Fit V16 Flat Cuff Boots Review

- Base: `style-d-encyclopedia-clean-base`
- Model: `gpt-image-2`
- Goal: remove visible boot interiors by using flat horizontal cuff openings.
- Boot rects: `{"leftShoe":{"x":409,"y":1315,"width":92,"height":148},"rightShoe":{"x":502,"y":1315,"width":92,"height":148}}`

| Item | Status | Placement | Alpha stats | Composite |
| --- | --- | --- | --- | --- |
| Boots: ribbon flat cuff fit | ok | `{"leftShoe":{"x":409,"y":1315,"width":92,"height":148},"rightShoe":{"x":502,"y":1315,"width":92,"height":148}}` | `{"left":{"bounds":{"x":409,"y":1315,"width":92,"height":148},"before":{"semiTransparent":17,"transparentInterior":0,"nonTransparent":11225},"after":{"semiTransparent":15,"transparentInterior":0,"nonTransparent":11225},"alphaRaised":2,"holesFilled":0},"right":{"bounds":{"x":502,"y":1315,"width":92,"height":148},"before":{"semiTransparent":16,"transparentInterior":0,"nonTransparent":11220},"after":{"semiTransparent":14,"transparentInterior":0,"nonTransparent":11220},"alphaRaised":2,"holesFilled":0}}` | [composite](item-fit-v16-flat-cuff-boots/composite/boots-ribbon-flat-cuff-fit-composite.png) |
| Boots: pearl flat cuff fit | ok | `{"leftShoe":{"x":409,"y":1315,"width":92,"height":148},"rightShoe":{"x":502,"y":1315,"width":92,"height":148}}` | `{"left":{"bounds":{"x":409,"y":1315,"width":92,"height":148},"before":{"semiTransparent":2513,"transparentInterior":2,"nonTransparent":10876},"after":{"semiTransparent":43,"transparentInterior":0,"nonTransparent":10878},"alphaRaised":2472,"holesFilled":2},"right":{"bounds":{"x":502,"y":1315,"width":92,"height":148},"before":{"semiTransparent":2594,"transparentInterior":2,"nonTransparent":10873},"after":{"semiTransparent":38,"transparentInterior":0,"nonTransparent":10875},"alphaRaised":2558,"holesFilled":2}}` | [composite](item-fit-v16-flat-cuff-boots/composite/boots-pearl-flat-cuff-fit-composite.png) |

## Review

- Ribbon flat cuff boot interior visibility: PASS. The boot top reads as a flat cuff and no oval interior/hole is visible in the composite.
- Ribbon flat cuff boot fit: PASS. The existing measured placement still fits the ankles and foot width without an oversized look.
- Pearl flat cuff boot interior visibility: PASS. The cream boot no longer exposes a boot-hole shape, and alpha reinforcement removed small interior transparency.
- Pearl flat cuff boot fit: PASS. The pair aligns to the same left/right foot rects and covers the toes cleanly.
- Verdict: Use v16 flat-cuff boots for the game route. This avoids the need for a separate leg/foot occlusion mask.
