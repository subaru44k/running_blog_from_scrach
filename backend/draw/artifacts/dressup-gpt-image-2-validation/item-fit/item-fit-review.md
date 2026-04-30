# Dressup Item Fit Review

- Model: `gpt-image-2`
- Size: `1024x1536`
- Quality: `medium`
- Base: `style-d-encyclopedia-clean-base`
- Base cutout: `selected-style/model-base.png`

| Item | Raw | Cutout | Normalized | Composite | Status |
| --- | --- | --- | --- | --- | --- |
| Necklace: tiny heart pearl fit | [raw](item-fit/raw/necklace-heart-pearl-fit.png) | [cutout](item-fit/cutout/necklace-heart-pearl-fit.png) | [Normalized](item-fit/normalized/necklace-heart-pearl-fit.png) | [composite](item-fit/composite/necklace-heart-pearl-fit-composite.png) | ok |
| Shoes: ribbon ballet fit | [raw](item-fit/raw/shoes-ribbon-ballet-fit.png) | [cutout](item-fit/cutout/shoes-ribbon-ballet-fit.png) | [Left normalized](item-fit/normalized/shoes-ribbon-ballet-fit-left.png)<br>[Right normalized](item-fit/normalized/shoes-ribbon-ballet-fit-right.png) | [composite](item-fit/composite/shoes-ribbon-ballet-fit-composite.png) | ok |

### Necklace: tiny heart pearl fit

- Type: `necklace`
- Slot check:
  - Fit:
  - Size:
  - Layering:
  - Alpha edge:
  - Production risk:
- Source bounds: `{"x":316,"y":544,"width":401,"height":256}`
- Placed rects: `{"necklace":{"x":418,"y":360,"width":188,"height":120}}`
- Prompt: single small delicate princess necklace layer for a children dress-up game, original pastel storybook encyclopedia illustration, soft watercolor-like coloring, clean fine linework, tiny pearl chain with one very small heart charm, front view, centered on a pure white 1024 by 1536 canvas, draw only the necklace and no body, no neck, no dress, no mannequin, place the necklace near canvas center x 512 y 405, keep the whole necklace inside x 400 to 624 and y 360 to 480, total width no more than 224 pixels, small enough to fit inside the model shoulders and around the neckline, no earrings, no tiara, no text, no watermark

### Shoes: ribbon ballet fit

- Type: `shoes`
- Slot check:
  - Fit:
  - Size:
  - Layering:
  - Alpha edge:
  - Production risk:
- Source bounds: `{"x":330,"y":1009,"width":364,"height":399}`
- Placed rects: `{"leftShoe":{"x":425,"y":1308,"width":71,"height":170},"rightShoe":{"x":539,"y":1308,"width":71,"height":170}}`
- Prompt: pair of simple ribbon ballet shoes layer for a children princess dress-up game, original pastel storybook encyclopedia illustration, soft watercolor-like coloring, clean fine linework, front view, draw only two shoes and no legs, no socks, no body, no mannequin, pure white 1024 by 1536 canvas, place the left shoe near canvas area x 394 to 526 and y 1308 to 1478 with toe near x 450 y 1436, place the right shoe near canvas area x 508 to 640 and y 1308 to 1478 with toe near x 572 y 1436, keep the shoes small and aligned as a matched pair for a front-facing paper doll, no text, no watermark
