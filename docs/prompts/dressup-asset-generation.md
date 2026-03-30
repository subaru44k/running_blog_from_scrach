# おしゃれゲーム 素材確認用プロンプト

`/games/dressup/` を SVG から透過 PNG 素材ベースへ移行する前に、世界観とレイヤー相性を確認するための画像生成用プロンプトです。

用途
- 人物モデル 1 体
- アイテム 5 種
- すべて透過 PNG 前提

共通ルール
- front view
- full body or isolated item
- transparent background
- centered composition
- clean outline
- soft pastel colors
- cute princess dress-up game style
- paper doll friendly
- no background objects
- no text
- no watermark
- no shadow outside the asset
- consistent line weight

避けたいこと
- photorealistic
- semi-realistic
- mature woman
- dramatic pose
- side view
- 3/4 view
- cropped body
- detailed background
- item attached to character for the item-only prompts
- heavy shading
- dark horror tone
- extra limbs
- extra accessories
- low contrast transparent edges

## 共通スタイルプロンプト

```text
cute princess encyclopedia style, dress-up game asset, for a Japanese children's mini game, front view, soft pastel palette, clean outlines, bright and lovely, gentle facial expression, elegant but simple shapes, easy to layer in a dress-up game, transparent background, centered composition, high readability, polished 2D illustration, no background, no text, no watermark
```

## 共通ネガティブプロンプト

```text
photorealistic, realistic skin texture, mature adult proportions, sexy pose, dark fantasy, horror, side view, 3/4 view, perspective pose, busy background, furniture, room, landscape, text, logo, watermark, item attached to body, extra fingers, extra limbs, cropped head, cropped feet, blurry transparent edges, messy linework
```

## 1. 人物モデル

ファイル想定
- `astro-blog/public/images/games/dressup/model-princess-base.png`

プロンプト

```text
cute princess encyclopedia style, dress-up game base model, young girl mannequin for outfit coordination game, standing straight, front view, full body, arms gently down, soft smile, large sparkling eyes, round cheeks, fluffy brown hair, simple pastel inner dress in pale cream pink, minimal base clothing, elegant and child-friendly proportions, clear separation around neck, torso, skirt area, legs and shoes area for layer overlays, transparent background, centered composition, polished 2D illustration, paper doll friendly
```

補足
- ベース衣装は薄くシンプル
- 髪飾り、ネックレス、トップス、ボトムス、靴を上から重ねやすい余白を確保
- 身体の輪郭は太すぎず細すぎず

## 2. 髪飾りサンプル: ティアラ

ファイル想定
- `astro-blog/public/images/games/dressup/item-hair-tiara.png`

プロンプト

```text
cute princess encyclopedia style, dress-up game item, isolated tiara accessory, front-facing, elegant gold tiara with pink and blue jewel accents, soft pastel gold, clean outline, easy to place on top of a girl's head, transparent background, centered composition, polished 2D illustration
```

## 3. ネックレスサンプル: ハートネックレス

ファイル想定
- `astro-blog/public/images/games/dressup/item-necklace-heart.png`

プロンプト

```text
cute princess encyclopedia style, dress-up game item, isolated heart necklace, front-facing, pink heart pendant with pearl chain, soft pastel colors, clean outline, clear silhouette for layering on a character neck area, transparent background, centered composition, polished 2D illustration
```

## 4. トップスサンプル: フリルブラウス

ファイル想定
- `astro-blog/public/images/games/dressup/item-top-frill-blouse.png`

プロンプト

```text
cute princess encyclopedia style, dress-up game item, isolated frill blouse, front view, pastel pink frilly blouse with puff sleeves and ribbon detail, child-friendly princess fashion, clean outline, shape designed for layering onto a dress-up character torso, transparent background, centered composition, polished 2D illustration
```

## 5. ボトムスサンプル: ふんわりスカート

ファイル想定
- `astro-blog/public/images/games/dressup/item-bottom-fluffy-skirt.png`

プロンプト

```text
cute princess encyclopedia style, dress-up game item, isolated fluffy skirt, front view, pastel lavender pink layered skirt with soft frills and gentle volume, readable silhouette, clean outline, designed for layering onto a dress-up character waist and leg area, transparent background, centered composition, polished 2D illustration
```

## 6. くつサンプル: リボンシューズ

ファイル想定
- `astro-blog/public/images/games/dressup/item-shoes-ribbon.png`

プロンプト

```text
cute princess encyclopedia style, dress-up game item, isolated ribbon shoes, front-facing pair of pastel pink princess shoes with ribbon decoration and small jewel accents, child-friendly and cute, clear silhouette, clean outline, designed for layering onto a dress-up character feet area, transparent background, centered composition, polished 2D illustration
```

## 確認観点

この 6 枚で次を見ます。

- 同じ世界観に見えるか
- 人物モデルがベース素材として使いやすいか
- アイテムの輪郭が一目で分かるか
- PNG の透明部分が汚くないか
- 実際に重ねたとき、位置合わせで無理がなさそうか
- 「おひめさまのずかん」っぽいかわいさがあるか

## 次のステップ

このサンプルがよければ、同じルールで各部位を増やします。

- 髪飾り
- ネックレス
- トップス
- ボトムス
- くつ

各部位は 20 種前後まで展開する想定です。
