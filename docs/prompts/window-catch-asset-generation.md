# Window Catch Asset Generation Prompts

`/games/window-catch/` の生成画像を再作成するためのプロンプト記録。
両素材とも built-in imagegen で透過 PNG として生成した。マンション、窓、地面はゲーム座標と当たり判定を一致させるため Canvas で描画する。

## Elephant sprite sheet

    Use case: illustration-story
    Asset type: transparent 2D browser-game sprite sheet
    Primary request: Create one consistent cute baby elephant character for a preschool-friendly catching game, shown in exactly three separate full-body poses arranged left-to-right in one horizontal row: (1) calm standing idle, (2) running sideways with playful energy, (3) catching something overhead by stretching and curling its trunk upward.
    Scene/backdrop: genuinely transparent background with generous clear spacing between poses
    Subject: the same small light-blue elephant in every pose, rounded body, large friendly ears, warm smile, short legs; side-facing enough to suggest horizontal movement while keeping the face readable
    Style/medium: polished soft-edged 2D children's mobile-game illustration, clean silhouette, gentle shading, consistent proportions and colors
    Composition/framing: exactly three non-overlapping equal-scale sprites in a single horizontal row, every ear/trunk/foot fully visible, ample transparent padding around each sprite
    Lighting/mood: bright cheerful daytime feeling
    Color palette: light blue elephant, soft pink inner ears, subtle navy outlines
    Constraints: actual alpha transparency; no ground, no shadow, no props, no text, no panel borders, no extra characters, no watermark; identical character identity and scale across all three poses; trunk clearly rises above the head only in the third pose
    Avoid: realism, scary expression, cropped body parts, overlapping sprites, white or checkerboard background

## Cloud troublemaker

    Use case: illustration-story
    Asset type: transparent 2D browser-game character sprite
    Primary request: Create a single child-friendly comic troublemaker riding on a fluffy white cloud, for a game where the character flies past apartment windows and makes them wobble.
    Scene/backdrop: genuinely transparent background
    Subject: one whimsical mischievous adult person seated safely on a small fluffy cloud, full body visible, striped purple shirt, dark knit cap, playful sly smile, one hand reaching downward as if tapping a window; looks mildly naughty but funny and harmless, never frightening
    Style/medium: polished soft-edged 2D children's mobile-game illustration matching a cute light-blue cartoon elephant, clean strong silhouette, gentle shading
    Composition/framing: single isolated character-and-cloud group, horizontal side view facing right, centered with generous transparent padding, no cropped parts
    Lighting/mood: bright cheerful daytime
    Color palette: white and pale-blue cloud, purple/navy clothing, warm skin tones
    Constraints: actual alpha transparency; exactly one person and one cloud; no background, no ground, no text, no weapons, no sack, no mask covering the face, no logos, no watermark
    Avoid: photorealism, menace, violence, dark lighting, scary facial features, police/crime symbols
