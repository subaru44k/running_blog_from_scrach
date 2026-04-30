# Dressup Item Fit V12 Hair Accessory Stability Review

- Base: `style-d-encyclopedia-clean-base`
- Model: `gpt-image-2`
- Head bounds: `{"x":367,"y":49,"width":275,"height":321}`
- Target rects: `{"headband":{"x":383,"y":77,"width":244,"height":118},"hairpinRight":{"x":594,"y":191,"width":48,"height":52}}`

| Item | Placement | Status | Placement rect |
| --- | --- | --- | --- |
| Hair accessory: side ribbon hairpin stability fit | hairpinRight | ok | `{"x":594,"y":203,"width":48,"height":28}` |
| Hair accessory: pearl clips stability fit | hairpinRight | ok | `{"x":594,"y":197,"width":48,"height":40}` |
| Hair accessory: slim lace headband stability fit | headband | ok | `{"x":386,"y":77,"width":239,"height":118}` |

## Review

- Side ribbon hairpin face/eye overlap: PASS after v12 target refinement. The accessory stays outside the image-right eye and cheek.
- Side ribbon hairpin hair fit: PASS. It is slightly small, but it reads as clipped to the outer hair edge rather than floating over the face.
- Pearl clips face/eye overlap: PASS after v12 target refinement. The first v11-sized target placed the clip too close to the face; the smaller outward target keeps it clear of the eye.
- Pearl clips hair fit: PASS for placement, MIXED for generated design. The asset fits the side hair, but the generated shape reads more like stacked line clips than distinct tiny pearl clips.
- Slim lace headband face/eye overlap: PASS. It stays above the eyebrows and does not cover facial features.
- Slim lace headband hair fit: PASS. The arc follows the upper hair silhouette and remains centered.
- Background removal: PASS. No visible white box remains; the pale lace and pearl-like details survive the cutout.
- Verdict: PASS for hairAccessory anchor stability. Use the v12 smaller outward hairpinRight target for mixed hairpin designs. For future pearl items, strengthen the prompt toward fewer, rounder pearls and avoid stacked horizontal clip lines.
