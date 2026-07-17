# Cushion Catch Asset Generation Prompts

/games/cushion-catch/ 用の生成画像を再作成するためのプロンプト記録。
2026-07-16 に built-in imagegen で生成し、キャラクターとクッションは
#00ff00 背景を remove_chroma_key.py で透過した。

## Assets

- troublemaker.png: 怖くない、コミカルな「わるいひと」
- cushion-normal.png: 通常クッション
- cushion-sparkle.png: キラキラクッション
- room-background.png: 16:9 の室内背景

## Shared style

    Use case: illustration-story
    Style/medium: ゆめかわ絵本風, pastel children's picture-book illustration,
    fluffy rounded shapes, soft clean outlines, dreamy gentle lighting,
    high readability at small size.
    Constraints: no text, no logo, no watermark, no violence, no horror.

## Troublemaker

    Asset type: 2D mobile game character sprite
    Primary request: Create a child-safe comic "bad person" who playfully throws a cushion.
    Subject: One mischievous adult cartoon character with dark round sunglasses,
    a playful smug grin, rounded face, pastel striped top and trousers, and one arm
    extended in a clear gentle cushion-throwing pose. Silly, never scary.
    Composition: Centered full-body side-facing throwing pose with generous padding.
    Background: perfectly flat solid #00ff00 chroma key.
    Constraints: no cushion in hand, weapon, violence, intimidating expression,
    cast shadow, reflection, or #00ff00 in the subject.

## Normal cushion

    Asset type: 2D mobile game item sprite
    Primary request: One plump rounded square cushion in pastel pink and pale lavender,
    with visible seams, one small center tuft, soft fabric, and a clean silhouette.
    Composition: Centered, slightly three-quarter view, generous padding.
    Background: perfectly flat solid #00ff00 chroma key.
    Constraints: no character, hands, cast shadow, floor, reflection, or #00ff00 in the subject.

## Sparkling cushion

    Asset type: 2D mobile game rare item sprite
    Primary request: One plump rounded square cushion in pastel gold, peach and cream,
    with a small stitched star in the center and a few close soft sparkles.
    Composition: Centered, slightly three-quarter view, generous padding.
    Background: perfectly flat solid #00ff00 chroma key.
    Constraints: no character, hands, letters, cast shadow, floor, reflection,
    or #00ff00 in the subject.

## Room background

    Asset type: 16:9 2D mobile game background
    Primary request: A cozy pastel living room with a soft wooden floor, pale mint and
    cream walls, rounded window, low sofa, and tidy shelves near the far edges.
    Composition: Straight-on side view with a large uncluttered center and foreground,
    plus a readable floor line for bouncing objects.
    Constraints: background only; no people, animals, loose cushions, balls, or text.
