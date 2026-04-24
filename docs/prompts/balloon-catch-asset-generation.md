# Balloon Catch Asset Generation Prompts

This document preserves the prompts used to generate the original `balloon-catch`
asset set and the follow-up `gpt-image-2` regeneration set. The purpose is
repeatability: re-run generation without rewriting the prompt wording and compare
new outputs against the current production assets without overwriting them.

## Asset Set

Generated files:

- `dog-sprite-sheet-original-prompt.png`
- `cpu-man-throwing-balloon.png`
- `balloon-normal.png`
- `balloon-rare-sparkling.png`
- `balloon-dangerous.png`
- `park-background.png`

## Prompts

### Dog Sprite Sheet

```text
Use case: illustration-story
Asset type: 2D side-scrolling game sprite sheet, transparent PNG
Primary request: Generate a cute small dog character sprite sheet in a single horizontal row.

Style:
ゆめかわ絵本風, pastel color palette, soft lighting, dreamy atmosphere, fluffy and cute style, children's picture book illustration, simple shapes, rounded design, soft outlines, no harsh shadows, high readability.

Character:
cute small dog character, round body, short legs, big sparkling eyes, fluffy ears, light cream or pastel brown fur, gentle smile.

Sprite sheet layout:
All animation frames arranged horizontally in a single row.
Animations included in order from left to right:
1. idle: 2 frames, subtle breathing and slight tail movement
2. running: 4 frames, smooth loop with legs moving
3. catching: 3 frames, small jump and happy expression
Total: 9 frames in one row.

IMPORTANT CONSISTENCY RULES:
- fixed camera, no perspective change
- same character size and proportions across all frames
- same position in each frame, no shifting
- same ground level alignment, feet aligned perfectly
- equal spacing between frames
- character centered in each frame
- clean outline, minimal detail, high readability for children
- transparent background, no background elements
- no text, no watermark, no extra objects
```

### CPU Character

```text
Use case: illustration-story
Asset type: 2D mobile game character sprite, transparent PNG
Primary request: CPU character, a lightly bad-boy style man wearing sunglasses and throwing a balloon.
Subject: A child-safe cartoon man with dark sunglasses, a playful smug grin, a slightly naughty vibe, rounded face, soft hair, simple pastel street-fashion outfit, and one arm extended in a gentle balloon-throwing motion. He should read as a mischievous troublemaker, not a scary villain.
Style/medium: ゆめかわ絵本風, pastel color palette, soft lighting, dreamy atmosphere, fluffy and cute style, children's picture book illustration, simple shapes, rounded design, soft outlines, clean outlines, no harsh shadows, high readability.
Composition/framing: Centered full-body or near full-body sprite, throwing pose readable at small size, enough transparent padding around arm and balloon, no crop.
Lighting/mood: playful, cheeky, dreamy park-game mood.
Constraints: plain pure white background, no text, no watermark, no logo, no hard shadows, no realism, no intimidating villain look, no violence, no weapon, no horror, consistent style with the dog and balloon assets.
```

### Normal Balloon

```text
Use case: illustration-story
Asset type: 2D mobile game item sprite, transparent PNG
Primary request: Normal balloon item.
Subject: A simple round pastel balloon with a tiny tied knot and short soft string, cheerful and easy to recognize, clean silhouette.
Style/medium: ゆめかわ絵本風, pastel color palette, soft lighting, dreamy atmosphere, fluffy and cute style, children's picture book illustration, simple shapes, rounded design, soft outlines, clean outlines, no harsh shadows, high readability.
Composition/framing: Centered item sprite, large readable shape, transparent padding, no crop.
Lighting/mood: gentle dreamy lighting, cute and calm.
Constraints: transparent background, no text, no watermark, no logo, no letters or symbols on the balloon, consistent style with all assets.
```

### Rare Balloon

```text
Use case: illustration-story
Asset type: 2D mobile game item sprite, transparent PNG
Primary request: Sparkling rare balloon item.
Subject: A special pastel balloon with small soft sparkles and a subtle magical glow, clearly rarer than a normal balloon but still simple and readable, tiny tied knot and short soft string.
Style/medium: ゆめかわ絵本風, pastel color palette, soft lighting, dreamy atmosphere, fluffy and cute style, children's picture book illustration, simple shapes, rounded design, soft outlines, clean outlines, no harsh shadows, high readability.
Composition/framing: Centered item sprite, large readable balloon shape, sparkles close to the balloon, transparent padding, no crop.
Lighting/mood: dreamy, magical, cheerful.
Constraints: transparent background, no text, no watermark, no logo, no letters or symbols, no busy sparkle field, consistent style with all assets.
```

### Dangerous Balloon

```text
Use case: illustration-story
Asset type: 2D mobile game item sprite, transparent PNG
Primary request: Slightly dangerous balloon item.
Subject: A pastel balloon that reads as a gentle hazard in a children's game, slightly darker warm pastel color, tiny soft thorn-like nubs or taped patches, cute but clearly different from the normal balloon, rounded and not scary, tiny tied knot and short soft string.
Style/medium: ゆめかわ絵本風, pastel color palette, soft lighting, dreamy atmosphere, fluffy and cute style, children's picture book illustration, simple shapes, rounded design, soft outlines, clean outlines, no harsh shadows, high readability.
Composition/framing: Centered item sprite, readable hazard silhouette, transparent padding, no crop.
Lighting/mood: playful caution, child-friendly, not frightening.
Constraints: transparent background, no text, no watermark, no logo, no skulls, no warning signs, no letters or symbols, no sharp realistic spikes, consistent style with all assets.
```

### Park Background

```text
Use case: illustration-story
Asset type: 2D mobile game background image
Primary request: Simple park scene background for a balloon catching game.
Scene/backdrop: A simple dreamy pastel park with soft green grass, rounded trees, a small path, gentle blue sky, tiny fluffy clouds, and open playable space in the center and foreground.
Subject: Background only, no characters, no balloons, no text.
Style/medium: ゆめかわ絵本風, pastel color palette, soft lighting, dreamy atmosphere, fluffy and cute style, children's picture book illustration, simple shapes, rounded design, soft outlines, clean outlines, no harsh shadows, high readability.
Composition/framing: Wide horizontal game background, uncluttered center area for gameplay, soft horizon, readable on mobile, no crop-sensitive details near edges.
Lighting/mood: calm sunny park, dreamy and cheerful.
Constraints: no text, no watermark, no logo, no characters, no balloons, no signs with writing, consistent style with the sprite assets.
```

## Generation Notes

- Current production assets stay in `astro-blog/public/images/games/balloon-catch/`.
- Regenerated comparison assets should be written to:
  - `backend/draw/artifacts/balloon-catch-gpt-image-2/`
  - `astro-blog/public/images/games/balloon-catch-gpt-image-2/`
- `gpt-image-2` does not accept transparent background output for these calls, so non-background assets should be generated against a plain white background and then background-removed locally before comparison.
- `ASSET_IDS=cpu-man-throwing-balloon` can be used to regenerate only the CPU character while preserving the last manifest entries for the other assets.
- The game page should not be pointed at the regenerated assets until visual review is complete.
