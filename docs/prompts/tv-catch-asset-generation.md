# TV Catch Asset Generation Prompts

`/games/tv-catch/` 用の生成画像を再作成するためのプロンプト記録。
キャラクターとテレビは built-in imagegen で `#00ff00` 背景に生成し、
`remove_chroma_key.py` で透過PNG化する。

## Assets

- `troublemaker-walking.png`: 怖くない、横向きに歩く「わるいひと」
- `television.png`: 棚から跳ね落ちるブラウン管風テレビ
- `room-with-shelf.png`: 16:9の室内背景。右側にテレビを置く空の棚を持つ

## Shared style

    Use case: illustration-story
    Style/medium: ゆめかわ絵本風, pastel children's picture-book illustration,
    fluffy rounded shapes, soft clean outlines, dreamy gentle lighting,
    high readability at small size.
    Constraints: no text, no logo, no watermark, no violence, no horror,
    no broken objects.

## Troublemaker walking

    Asset type: 2D mobile game character sprite
    Primary request: Create a child-safe comic "bad person" walking sideways toward a television.
    Subject: One mischievous adult cartoon character with dark round sunglasses,
    a playful smug grin, rounded face, pastel striped top and trousers, shown in a
    clear full-body side-facing walking pose. Silly and playful, never scary.
    Composition: Centered full body with generous padding; feet aligned to one ground line.
    Background: perfectly flat solid #00ff00 chroma key.
    Constraints: no television, shelf, weapon, threatening gesture, cast shadow,
    reflection, text, or #00ff00 in the subject.

## Television

    Asset type: 2D mobile game item sprite
    Primary request: One cute compact retro CRT television suitable for bouncing through the air.
    Subject: A rounded pastel cream and lavender television with a dark blue blank screen,
    two small knobs, tiny feet, and a sturdy readable silhouette.
    Composition: Centered three-quarter front view with generous padding and no crop.
    Background: perfectly flat solid #00ff00 chroma key.
    Constraints: no picture, text, logo, brand, crack, broken glass, cable, cast shadow,
    reflection, or #00ff00 in the television.

## Room with shelf

    Asset type: 16:9 2D mobile game background
    Primary request: A cozy pastel living room for a side-view television catching game.
    Scene: Soft wooden floor, pale mint and cream walls, rounded window and a low sturdy
    television shelf on the right side. The shelf top must be empty so a separate television
    sprite can be placed there. Keep the center and foreground uncluttered for gameplay.
    Composition: Straight-on wide side view with a readable floor line and open horizontal space.
    Constraints: background only; no people, animals, television, readable text, logos,
    cushions, balls, or breakable clutter in the play area.

## Transparency processing

    python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" \
      --input <source.png> \
      --out <final.png> \
      --auto-key border \
      --soft-matte \
      --transparent-threshold 12 \
      --opaque-threshold 220 \
      --despill
