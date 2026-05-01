# Dressup Item Fit V15 Layer Stack Review

- Base: `style-d-encyclopedia-clean-base`
- Model: no image generation; existing normalized layers only

| Stack | Bottom | Layer order | Composite |
| --- | --- | --- | --- |
| Long skirt A: top then bottom | bottomLong | `top -> bottomLong -> bootsLeft -> bootsRight -> necklace -> hairAccessory` | `item-fit-v15-layer-stack/composite/long-a-composite.png` |
| Long skirt B: bottom then top | bottomLong | `bottomLong -> top -> bootsLeft -> bootsRight -> necklace -> hairAccessory` | `item-fit-v15-layer-stack/composite/long-b-composite.png` |
| Long skirt C: necklace before boots | bottomLong | `bottomLong -> top -> necklace -> bootsLeft -> bootsRight -> hairAccessory` | `item-fit-v15-layer-stack/composite/long-c-composite.png` |
| A-line A: top then bottom | bottomAline | `top -> bottomAline -> bootsLeft -> bootsRight -> necklace -> hairAccessory` | `item-fit-v15-layer-stack/composite/aline-a-composite.png` |
| A-line B: bottom then top | bottomAline | `bottomAline -> top -> bootsLeft -> bootsRight -> necklace -> hairAccessory` | `item-fit-v15-layer-stack/composite/aline-b-composite.png` |
| A-line C: necklace before boots | bottomAline | `bottomAline -> top -> necklace -> bootsLeft -> bootsRight -> hairAccessory` | `item-fit-v15-layer-stack/composite/aline-c-composite.png` |

## Review

- Top/bottom waist connection: PASS for the B/C variants. Rendering bottom first and top second matches normal clothing order, with the blouse sitting over the skirt waistband.
- Bottom over/under top preference: Prefer top over bottom. The B/C variants have a slightly soft overlap from the blouse's lower frill, but it is acceptable and more natural than putting the skirt waistband over the blouse.
- Necklace/top collar relationship: PASS with current assets. Necklace above top is readable and not hidden, though future high-collar tops may need `necklace-under-collar` or top-specific handling.
- Boots/bottom/leg relationship: PASS. Boots over base and independent of bottom look natural; the bottom hem does not collide with the boots.
- Hair accessory face/hair relationship: PASS. The side ribbon remains outside the eye and reads as clipped to the hair.
- Best layer order: `base -> bottom -> top -> boots -> necklace -> hairAccessory`. This is represented by `long-b` and `aline-b`; `long-c` and `aline-c` are equivalent for the current boots/necklace relationship.
- Verdict: PASS for a first full PNG outfit stack. The next implementation should use top above bottom as the default z-index baseline, with necklace and hairAccessory above clothing.
