# Dressup GPT-Image-2 Style Candidate Review

Generated: 2026-04-30

## Decision

Use `style-d-encyclopedia-clean-base` as the style validation base model.

## Candidate Notes

### Style A: encyclopedia page

- Target style: 2
- Front view: 2
- Full body: 2
- Neck/shoulders visible: 2
- Hair clear of torso: 2
- Background removal: 2
- Dress-up suitability: 1

This is close to the desired encyclopedia princess mood, but the generated tiara and earrings are already attached to the base model. That contaminates the hair accessory and necklace slots.

### Style B: princess paper doll

- Target style: 1
- Front view: 2
- Full body: 2
- Neck/shoulders visible: 2
- Hair clear of torso: 2
- Background removal: 1
- Dress-up suitability: 2

This is usable as a paper-doll base, but the face and rendering are closer to a modern doll illustration than the softer encyclopedia look.

### Style C: dress catalog

- Target style: 1
- Front view: 2
- Full body: 2
- Neck/shoulders visible: 2
- Hair clear of torso: 2
- Background removal: 2
- Dress-up suitability: 2

This is technically clean and usable, but it has a slightly older fashion catalog feeling and does not improve enough over the previous base.

### Style D: clean encyclopedia base

- Target style: 2
- Front view: 2
- Full body: 2
- Neck/shoulders visible: 2
- Hair clear of torso: 2
- Background removal: 2
- Dress-up suitability: 2

This is the strongest candidate. It keeps the soft watercolor-like encyclopedia feeling while avoiding baked-in jewelry or hair accessories. The short bob, round neckline, visible feet, and separated arms make it suitable for the next necklace and shoes validation.

## Next Gate

Generate only one necklace and one pair of shoes against `style-d-encyclopedia-clean-base` next. Do not expand to the full wardrobe until those high-risk slots fit.
