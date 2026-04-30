# おしゃれゲーム PNG 化 gpt-image-2 再検証メモ

このメモは、SVG 描画ベースの `/games/dressup/` を PNG レイヤー素材ベースへ再検証する前に、過去の `feature/dressup-next-png-spike` で起きた問題を整理し、`gpt-image-2` による再生成でどこまで解決できるかを判断するための調査メモです。

今回の範囲は調査のみです。新規アセット生成、ゲーム実装、既存素材の差し替えは行いません。

## 参照した現状

- 本番の `/games/dressup/` は `astro-blog/src/pages/games/dressup.astro` にある静的 Astro ページで、衣装候補は SVG 風のコード描画プレビューとして定義されています。
- 現行ゲーム仕様は、テーマに合わせてプレイヤーが `hairAccessory` / `necklace` / `top` / `bottom` / `shoes` を選び、Chat-san も同じスロットを選んだあと、どちらのコーデが好きかを選ぶ構成です。
- `feature/dressup-next-png-spike` には `/games/dressup-next/` の直接URL専用試作ルート、PNG アセット、noindex / sitemap 除外 / offline cache 除外の設計メモが含まれていました。
- PNG 試作アセットは `astro-blog/public/images/games/dressup-next/` に `model`、`raw`、`normalized`、`split` として整理されていました。
- `backend/draw/scripts/*dressup*` には、生成、正規化、靴の左右分割、位置合わせビューアー生成の試行錯誤が残っています。
- `docs/prompts/dressup-asset-generation.md` には、当初の「人物1体 + アイテム5種」確認用プロンプトが残っています。

## 既存スパイクの失敗要因

### 生成モデルだけではなく、レイヤー仕様が未確定だった

過去の素材は単体画像としては良くても、着せ替え用の共通規格が弱く、各画像を重ねると破綻しやすい状態でした。特に、人物モデルの首、肩、腰、足先に対して、各アイテムがどの座標・寸法・前後関係を守るべきかが画像生成前に十分固定されていませんでした。

### ネックレスは「サイズ」と「前後関係」の両方が難しい

ネックレスは首回りに収まる必要がありますが、試作では横幅が肩幅に近づいたり、首元より下に広がりすぎたりするリスクがありました。また、トップスの襟より上に出すのか、襟やケープの下に隠れるのかが衣装ごとに変わります。単一の `necklace` レイヤー z-index だけでは、すべてのトップスと自然に合うとは限りません。

### 靴は左右の足位置に強く依存する

靴は単体で一足として生成すると、人物の左右足の間隔、つま先の角度、足首の高さに合わないことがあります。過去スパイクでは靴を左右に分割する `split` 工程が追加されていますが、これは生成画像だけで解決しきれず、後処理と配置仕様が必要だったことを示しています。

### 服は人物の腕・髪・ベース衣装と干渉する

トップスとボトムスは、人物モデルの内側ドレス、腕、肩、髪の輪郭と重なります。トップスが腕の上に出るべきか、腕を前景に残すべきか、長い髪が服より前に落ちるべきかが未定義だと、良い素材でも「貼っただけ」に見えます。

### 正規化が画質と意味を変える

過去スパイクでは、raw 画像からアルファ bbox を取り、部位ごとの固定矩形へリサイズして `normalized` レイヤーを作っていました。この方法は配置を安定させますが、モデルが描いた本来の比率を強制的に変えるため、ネックレスや靴の見た目が小さすぎる、細すぎる、または位置だけ合って意味が不自然になる可能性があります。

### 透明背景前提は再検証が必要

OpenAI 公式ドキュメント上では `gpt-image-2` は state-of-the-art image generation / editing model として提供され、画像入力を高忠実度に扱える一方、透明背景出力は現在サポートされていません。したがって、PNG レイヤー素材として使うには、白背景などで生成したあと背景除去を行い、アルファ境界の汚れを評価する工程が必要です。

参照:

- `gpt-image-2`: https://developers.openai.com/api/docs/models/gpt-image-2
- Image generation guide: https://developers.openai.com/api/docs/guides/image-generation

## gpt-image-2 で解決しやすいこと

- 人物モデル画像を参照入力として渡し、同じ画風・線幅・塗りのアイテムを生成すること。
- 「首幅以内」「肩を超えない」「左右の靴を足先位置に合わせる」など、過去より具体的な制約をプロンプトへ入れて追従性を検証すること。
- 1回で完成品を狙うのではなく、同じ人物モデルを参照しながら各部位を反復生成・編集すること。
- 単体アイテムではなく、最初から `1024x1024` の人物キャンバス座標上に置かれたレイヤー素材として生成させること。

## gpt-image-2 だけでは解決しにくいこと

- 透明PNG素材の直接生成。背景除去とアルファ品質チェックは別工程として必要です。
- ピクセル単位の完全な座標一致。プロンプトだけで足首や首回りの座標を固定するより、アンカー仕様と後処理で保証するべきです。
- すべてのトップスとネックレスの自然な前後関係。必要なら `necklace-under-collar` / `necklace-over-collar` のようにレイヤー種別を分ける判断が必要です。
- 腕・髪・服の遮蔽関係。人物を単一ベース画像にすると、服が腕や髪を自然に挟み込めません。
- 量産時の一貫性。各部位20点規模へ増やすなら、1枚ずつ良い画像を作るだけでなく、bbox、中心線、アンカー、許容サイズを機械的に検査する必要があります。

## 再挑戦する場合の最小評価設計

生成スパイクへ進む前に、まず人物モデル1体に対するアンカー仕様を決めます。

- キャンバス: `1024x1024`
- 人物基準点: head top、neck center、shoulder left/right、waist center、hem line、left/right ankle、left/right toe center
- 部位ごとの許容矩形:
  - hairAccessory: 頭部上部または髪の前面に収まる
  - necklace: 首幅から肩内側までに収まり、トップス襟と干渉しすぎない
  - top: 肩、胴体、腰の基準線に合う
  - bottom: 腰から脚上部に合い、トップスと自然に接続する
  - shoes: 左右足を別レイヤーとして扱い、足首とつま先に合う

最小スパイクは、人物1体、髪飾り2点、ネックレス2点、トップス2点、ボトムス2点、靴2点で行います。各アセットは raw、background-removed、normalized、composite preview を保存し、既存本番ページには接続しません。

## 合否基準

各アセットを 0 / 1 / 2 点で採点し、部位ごとに平均 1.5 点以上を最低ラインにします。

- フィット: 首、肩、腰、足の位置に自然に合う
- サイズ: 人物の体格を超えず、ゲーム画面上で読める
- 重なり: 服、髪、アクセサリの前後関係が不自然でない
- 透明化: アルファ境界が汚くなく、背景の残りが目立たない
- 量産性: 同じ制約で別デザインを作っても破綻しにくい
- UI適性: 小さな選択カードでも何のアイテムか分かる

次のいずれかに該当する場合は、PNG 化を本実装へ進めず、SVG/Canvas ベース継続またはレイヤー仕様の再設計を優先します。

- 靴またはネックレスがプロンプト改善後も安定しない
- 透明化後の縁が本番UIで目立つ
- トップスと髪・腕の遮蔽問題が複数組み合わせで起きる
- 1アイテムごとの手動調整量が多く、20点規模へ増やせない

## 推奨する次ステップ

1. 人物モデルのアンカー仕様を画像上で定義する。
2. `gpt-image-2` 用に、人物モデルを参照入力として使う生成プロンプトと、白背景からの背景除去手順を分けて書く。
3. 小規模スパイク用の成果物ディレクトリを `backend/draw/artifacts/dressup-gpt-image-2-validation/` のように本番から切り離す。
4. composite preview と採点表を生成し、ゲームページへ接続する前に視覚評価する。
5. 合格した場合のみ、`/games/dressup-next/` の復活や本番導入方針を設計判断として `docs/architecture.yaml` へ反映する。

## v2 検証ハーネス

`backend/draw/scripts/generate-dressup-gpt-image-2-validation.mjs` は、旧スパイクを流用せずに新しい人物モデル候補を作るための検証スクリプトです。

実行:

```bash
npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
```

出力:

- `backend/draw/artifacts/dressup-gpt-image-2-validation/model-candidates/raw/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/model-candidates/cutout/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/manifest.json`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/model-preview.html`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/scorecard.md`

この段階では人物候補3案だけを生成します。アイテム生成は、候補を1体選び、アンカー JSON を固定してから別フェーズで実行します。

2026-04-30 の実行では、`model-princess-base-b-validation-a` を次フェーズの基準モデルに選定しました。理由と初期アンカーは以下に保存しています。

- `backend/draw/artifacts/dressup-gpt-image-2-validation/model-review.md`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/selected-model.json`

次の生成は、全アイテムではなく、失敗リスクが高い `necklace` 1点と `shoes` 1点だけで開始します。

## style validation: おひめさまのずかん寄せ

`STYLE_BATCH=storybook-encyclopedia` で、特定書籍や作家の模倣ではなく、一般的な視覚特徴として「淡い絵本図鑑風」「細い線」「水彩風のやわらかい塗り」「プリンセス小物図鑑らしさ」に寄せた人物候補を生成します。

実行:

```bash
STYLE_BATCH=storybook-encyclopedia npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
```

2026-04-30 の実行では、追加で `style-d-encyclopedia-clean-base` を生成し、style validation の基準モデルに選定しました。理由と初期アンカーは以下に保存しています。

- `backend/draw/artifacts/dressup-gpt-image-2-validation/style-review.md`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/selected-style-model.json`

次の生成は、`style-d-encyclopedia-clean-base` に対して、`necklace` 1点と `shoes` 1点だけで開始します。

## high-risk fit validation: necklace と shoes

`ITEM_BATCH=high-risk-fit` で、選定済みの `style-d-encyclopedia-clean-base` に対して、失敗リスクが高い `necklace` 1点と `shoes` 1点だけを生成します。

実行:

```bash
ITEM_BATCH=high-risk-fit npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
```

特定アイテムだけ再生成する場合:

```bash
ITEM_BATCH=high-risk-fit ITEM_IDS=necklace-heart-pearl-fit npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
ITEM_BATCH=high-risk-fit ITEM_IDS=shoes-ribbon-ballet-fit npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
```

生成後は、`selected-style-model.json` の slot rect に合わせて後処理します。`necklace` は単体で正規化し、`shoes` は左右ペアを生成したあと `leftShoe` / `rightShoe` に分割して正規化します。プロンプトの座標追従性だけでなく、ゲーム用素材として後処理で安定させられるかを同時に見ます。

出力:

- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit/raw/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit/cutout/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit/normalized/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit/split/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit/composite/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit/item-fit-preview.html`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit/item-fit-review.md`

コストを抑えるため、初回は画像生成 API を 2 call に限定します。失敗した場合は該当アイテムだけを `ITEM_IDS` で再実行します。

2026-04-30 の初回実行では、`necklace-heart-pearl-fit` と `shoes-ribbon-ballet-fit` を生成しました。ネックレスは slot 正規化後に首元へ自然に収まりました。靴は左右分割と正規化で足位置には合いましたが、リボン付きバレエシューズとして生成した結果、足首方向にやや高く出たため、次回は低めのメリージェーンまたはフラットシューズ指定で再検証する価値があります。

## high-risk fit v2: 足込み footwear patch

`ITEM_BATCH=high-risk-fit-v2` では、靴を単純な上乗せレイヤーとして扱わず、足先を含む `footwearPatch` として検証します。base の足元矩形を白で隠してから、靴と足首を含む差替えパッチを合成します。

実行:

```bash
ITEM_BATCH=high-risk-fit-v2 npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
```

特定アイテムだけ再生成する場合:

```bash
ITEM_BATCH=high-risk-fit-v2 ITEM_IDS=necklace-symmetric-heart-pearl-fit npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
ITEM_BATCH=high-risk-fit-v2 ITEM_IDS=footwear-patch-mary-jane-fit npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
```

v2 の初期 mask rect:

```json
{ "x": 382, "y": 1298, "width": 280, "height": 205 }
```

出力:

- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v2/raw/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v2/cutout/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v2/normalized/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v2/masked-composite/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v2/item-fit-v2-preview.html`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v2/item-fit-v2-generated-review.md`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v2/item-fit-v2-review.md`

v2 では、生成サマリーと人間の目視レビューを分けます。`item-fit-v2-generated-review.md` は再生成されますが、`item-fit-v2-review.md` は既存ファイルがある場合は上書きしません。

2026-04-30 の v2 実行では、`necklace-symmetric-heart-pearl-fit` と `footwear-patch-mary-jane-fit` を生成しました。ネックレスは v1 より中心線に合いました。`footwearPatch` は元の足指が靴の下から見える問題を解消できましたが、生成物が足首より上の筒状の脚まで含み、base の脚と自然につながらない問題が出ました。この結果から、次の候補は「足込み patch」ではなく、靴本体を生成し、足指・足先だけを別 mask で隠す `shoeBody + footOcclusionMask` 方式です。量産性を優先する場合は、ブーツなど足が完全に隠れる靴だけに限定する案も残ります。

## high-risk fit v3: shoulder-aligned necklace と boots overlay

`ITEM_BATCH=high-risk-fit-v3` では、ネックレスをモデル中心と肩・襟ラインに寄せ直し、靴は足込み patch ではなく高カバー率のブーツ overlay として検証します。

実行:

```bash
ITEM_BATCH=high-risk-fit-v3 npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
```

特定アイテムだけ再生成する場合:

```bash
ITEM_BATCH=high-risk-fit-v3 ITEM_IDS=necklace-shoulder-aligned-fit npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
ITEM_BATCH=high-risk-fit-v3 ITEM_IDS=boots-high-coverage-fit npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
```

v3 の方針:

- `necklace-shoulder-aligned-fit`: pendant を `x=512` 付近に置き、左右端を肩より内側かつ襟ぐり付近へ揃える。
- `boots-high-coverage-fit`: 足や脚を含めず、足指・足先を覆う short boots だけを生成する。
- boots は左右分割後、既存の `leftShoe` / `rightShoe` slot に overlay する。base の足は消さず、靴の不透明部分で自然に覆えるかを見る。

出力:

- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v3/raw/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v3/cutout/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v3/normalized/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v3/split/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v3/composite/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v3/item-fit-v3-preview.html`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v3/item-fit-v3-generated-review.md`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v3/item-fit-v3-review.md`

コストを抑えるため、初回は画像生成 API を 2 call に限定します。`item-fit-v3-generated-review.md` は再生成されますが、`item-fit-v3-review.md` は既存ファイルがある場合は上書きしません。

2026-04-30 の v3 実行では、`necklace-shoulder-aligned-fit` と `boots-high-coverage-fit` を生成しました。ネックレスは v1/v2 より中心線と左右対称性が改善しましたが、チェーン端が肩紐の上に乗るため、最終候補としては襟ぐり内に収まる短い collarbone necklace の方がよさそうです。ブーツは足や脚を含まない overlay として生成でき、横方向の正規化で足指をほぼ覆えました。少し幅広で左右が近いものの、靴カテゴリは高カバー率のブーツ中心にすれば、足込み patch よりゲーム素材として成立しやすい見込みです。

## high-risk fit v4: short collarbone necklace と ankle-scale boots

`ITEM_BATCH=high-risk-fit-v4` では、ネックレスを肩紐まで伸ばさない短い collarbone necklace として検証し、ブーツは足首幅・足幅に近い小さい固定 rect へ正規化します。

実行:

```bash
ITEM_BATCH=high-risk-fit-v4 npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
```

特定アイテムだけ再生成する場合:

```bash
ITEM_BATCH=high-risk-fit-v4 ITEM_IDS=necklace-short-collarbone-fit npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
ITEM_BATCH=high-risk-fit-v4 ITEM_IDS=boots-ankle-scale-fit npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
```

v4 の方針:

- `necklace-short-collarbone-fit`: target rect は `{ "x": 424, "y": 370, "width": 176, "height": 86 }`。襟ぐり内に収め、肩紐へ乗せない。
- `boots-ankle-scale-fit`: target rect は左 `{ "x": 410, "y": 1330, "width": 92, "height": 148 }`、右 `{ "x": 522, "y": 1330, "width": 92, "height": 148 }`。v3 より幅と高さを絞り、足首幅・足幅に近づける。
- boots は引き続き overlay のみで検証し、base の足は消さない。

出力:

- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v4/raw/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v4/cutout/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v4/normalized/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v4/split/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v4/composite/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v4/item-fit-v4-preview.html`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v4/item-fit-v4-generated-review.md`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v4/item-fit-v4-review.md`

コストを抑えるため、初回は画像生成 API を 2 call に限定します。`item-fit-v4-generated-review.md` は再生成されますが、`item-fit-v4-review.md` は既存ファイルがある場合は上書きしません。

2026-04-30 の v4 実行では、`necklace-short-collarbone-fit` と `boots-ankle-scale-fit` を生成しました。ネックレスは中心と肩紐回避が改善し、v1-v3 より実用に近づきました。ただし、襟ぐりの曲線に完全に沿うには、単体生成ではなく base 画像を参照した編集生成の方がよさそうです。ブーツは固定の小さめ fit rect により、v3 の「足より大幅に大きい」問題が大きく改善し、足首幅・足幅に近い overlay として成立しました。現時点では、靴カテゴリは高カバー率ブーツ + 固定 ankle-scale placement を基準にするのが最も安定しています。

## anchor audit: 手入力 anchor の再検査

`selected-style-model.json` の anchor は手入力の初期推定であり、`style-d-encyclopedia-clean-base` の実際の体中心や足中心とずれている可能性があります。`ITEM_BATCH=anchor-audit` では画像生成 API を使わず、`selected-style/model-base.png` を alpha scan して anchor を再計測します。

実行:

```bash
ITEM_BATCH=anchor-audit npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
```

出力:

- `backend/draw/artifacts/dressup-gpt-image-2-validation/anchor-audit/measured-style-model.json`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/anchor-audit/anchor-audit-preview.html`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/anchor-audit/anchor-audit-review.md`

`ITEM_BATCH=high-risk-fit-v5-measured` では、v4 の生成済み necklace / boots cutout を使い、計測済み anchor で再配置します。新規画像生成は行いません。

実行:

```bash
RENDER_ONLY=1 ITEM_BATCH=high-risk-fit-v5-measured npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
```

出力:

- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v5-measured/normalized/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v5-measured/split/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v5-measured/composite/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v5-measured/item-fit-v5-preview.html`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v5-measured/item-fit-v5-review.md`

この段階では追加生成コストをかけず、配置仕様の信頼性だけを確認します。

2026-04-30 の anchor audit では、手入力 anchor のずれが確認できました。体中心 X は手入力 `512` に対して実測 `504`、画像右側のつま先 X は手入力 `572` に対して実測 `548` でした。`high-risk-fit-v5-measured` では v4 の既存 necklace / boots を再配置し、右 boot の位置合わせは改善しました。ネックレスも中心は改善しましたが、襟ぐりに沿わない問題は残り、これは配置ではなくアセット形状の問題として扱うべきです。

## shoulder-line audit / v6: ネックレスの肩ライン配置

v5 の short collarbone necklace は中心 X は改善したものの、服の襟ぐりにくっついたように見えました。実際の着用感としては、チェーン端は服の襟ではなく人物の肩・首まわりの身体ラインから始まり、ペンダントが身体中心に落ちる必要があります。

`ITEM_BATCH=shoulder-line-audit` では画像生成 API を使わず、`selected-style/model-base.png` の alpha top-boundary を読み、肩・身体ライン用の基準を再計測します。

実行:

```bash
RENDER_ONLY=1 ITEM_BATCH=shoulder-line-audit npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
```

出力:

- `backend/draw/artifacts/dressup-gpt-image-2-validation/shoulder-line-audit/measured-shoulder-line.json`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/shoulder-line-audit/shoulder-line-audit-preview.html`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/shoulder-line-audit/shoulder-line-audit-review.md`

`ITEM_BATCH=high-risk-fit-v6-shoulder-necklace` では、追加生成コストをかけず、既存の v3 `necklace-shoulder-aligned-fit.png` を肩ライン基準の rect へ再配置します。v5 の boot はすでに改善しているため、この batch では靴を触らず、ネックレスだけを検証します。

実行:

```bash
RENDER_ONLY=1 ITEM_BATCH=high-risk-fit-v6-shoulder-necklace npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
```

出力:

- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v6-shoulder-necklace/normalized/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v6-shoulder-necklace/composite/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v6-shoulder-necklace/item-fit-v6-preview.html`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v6-shoulder-necklace/item-fit-v6-review.md`

この段階で視覚的に近づくなら、次の有料生成は 1 call だけに絞り、base 参照付きで「肩ラインから始まり、服の襟に貼り付かないネックレス」を新規生成します。v6 の local placement でも違和感が強い場合は、ネックレスを単体アイテムではなく `top` ごとの一体レイヤーまたは `necklace-under/over-collar` の種別に分ける必要があります。

## high-risk fit v7: narrow inner shoulder-line necklace

v6 は肩ラインを意識したものの、合成結果では幅が広く、肩外側に引っ張られたアクセサリに見えました。`ITEM_BATCH=high-risk-fit-v7-necklace` では、追加生成コストを necklace 1点に限定し、最初から短い内側の肩・鎖骨ラインに収まる素材を生成します。

実行:

```bash
ITEM_BATCH=high-risk-fit-v7-necklace npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
```

v7 の target rect:

```json
{ "x": 434, "y": 360, "width": 140, "height": 92 }
```

生成プロンプトの主要制約:

- pendant center は `x=504 y=424`。
- chain end は左 `x=444 y=376`、右 `x=564 y=376`。
- necklace 全幅は `120-140px`、全高は `60-85px`。
- 肩紐や外肩まで伸ばさず、服の襟ぐりにも沿わせない。
- 服、首、肌、人物、影、文字は生成しない。

出力:

- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v7-necklace/raw/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v7-necklace/cutout/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v7-necklace/normalized/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v7-necklace/composite/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v7-necklace/item-fit-v7-preview.html`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v7-necklace/item-fit-v7-review.md`

v7 でまだ広い場合のみ、2 call 目として全幅 `100-120px`、chain end `x=452` / `x=556` に締めた候補を試します。これ以上の反復は、ネックレス単体レイヤーではなく `top` 側との一体化や z-index 種別分割の検討に戻します。

2026-04-30 の v7 実行では、`necklace-inner-shoulder-line-fit` を 1 call だけ生成しました。正規化後の placement は `{"x":451,"y":360,"width":107,"height":92}` で、v6 より幅が大きく改善しました。ただし、後続レビューでネックレスの実開始点が肩位置より下にあることが分かったため、v7 は「幅の改善候補」であり、最終 baseline ではありません。

## necklace anchor audit / v8: ネックレス開始点の再計測と再配置

`ITEM_BATCH=necklace-anchor-audit` では、手入力 shoulder anchor ではなく、base 画像の alpha top-boundary とネックレス画像自体の alpha 開始点を測ります。v7 の固定 rect 合成では、base 側の首付け根・肩上端が `y=338-339` 付近なのに対し、ネックレス開始点は `y=361-362` 付近で、約 23px 下から始まっていました。

実行:

```bash
RENDER_ONLY=1 ITEM_BATCH=necklace-anchor-audit npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
```

出力:

- `backend/draw/artifacts/dressup-gpt-image-2-validation/necklace-anchor-audit/measured-necklace-anchors.json`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/necklace-anchor-audit/necklace-anchor-audit-preview.html`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/necklace-anchor-audit/necklace-anchor-audit-review.md`

`ITEM_BATCH=high-risk-fit-v8-necklace-reanchor` では、追加生成を行わず、既存 v7 cutout の左右開始点を検出して、base 側の target anchors に直接合わせます。固定 rect ではなく、ネックレス画像内の開始点から配置を逆算するため、開始位置のずれを検証しやすくなります。

実行:

```bash
RENDER_ONLY=1 ITEM_BATCH=high-risk-fit-v8-necklace-reanchor npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
```

出力:

- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v8-necklace-reanchor/normalized/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v8-necklace-reanchor/composite/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v8-necklace-reanchor/item-fit-v8-preview.html`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v8-necklace-reanchor/item-fit-v8-review.md`

v8 local re-anchor でもペンダント位置や肩ライン追従が不自然な場合だけ、次に `gpt-image-2` を 1 call 使い、開始点 `x=452/556 y=340` を明示した新規 necklace を生成します。

2026-04-30 の v8 実行では、`necklace-inner-shoulder-line-fit` の既存 v7 cutout を追加生成なしで再配置しました。v7 normalized の開始点は target より左 `+21px`、右 `+20px` 下でしたが、v8 では placed anchors が target anchors `{"leftStart":{"x":452,"y":340},"rightStart":{"x":556,"y":340}}` と一致しました。幅は v7 相当を維持しつつ、肩・首付け根の上端から始まる見え方に改善したため、現時点では v8 を necklace baseline とします。

## stability fit v9: necklace / boots の量産安定性検証

`ITEM_BATCH=stability-fit-v9-accessories` では、他スロットへ広げる前に、既に難所として扱ってきた necklace と boots が複数デザインでも同じ後処理で安定するかを確認します。生成対象は necklace 2点、boots 2点の合計 4 call に限定します。

実行:

```bash
ITEM_BATCH=stability-fit-v9-accessories npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
```

特定アイテムだけ再生成する場合:

```bash
ITEM_BATCH=stability-fit-v9-accessories ITEM_IDS=necklace-tiny-ribbon-stability-fit npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
ITEM_BATCH=stability-fit-v9-accessories ITEM_IDS=necklace-moon-pearl-stability-fit npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
ITEM_BATCH=stability-fit-v9-accessories ITEM_IDS=boots-ribbon-ankle-stability-fit npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
ITEM_BATCH=stability-fit-v9-accessories ITEM_IDS=boots-pearl-button-stability-fit npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
```

v9 の配置方針:

- necklace は v8 の `measured-necklace-anchors.json` を使い、画像内の左右開始点を検出して target anchors へ合わせる。
- boots は v5 の `measured-style-model.json` を使い、左右分割後に実測 boot rect へ stretch 配置する。
- どちらも生成プロンプト単体ではなく、生成後の機械的な後処理が安定するかを見る。

出力:

- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v9-accessory-stability/raw/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v9-accessory-stability/cutout/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v9-accessory-stability/normalized/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v9-accessory-stability/split/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v9-accessory-stability/composite/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v9-accessory-stability/item-fit-v9-preview.html`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v9-accessory-stability/item-fit-v9-review.md`

v9 で necklace 2点と boots 2点がともに合格すれば、次は `hairAccessory` の検証に進みます。どちらかが崩れる場合は、他スロットへ広げる前にそのスロットの anchor 仕様を補正します。

2026-04-30 の v9 実行では、necklace 2点と boots 2点を生成しました。necklace は 2点とも v8 の start-anchor 方式で安定し、肩・首付け根から始まる見え方を保てました。boots は 2点とも v5 の measured placement で左右位置と足幅への収まりは安定しましたが、cream boots は足指のように見える線が生成されました。次回以降の boots prompt では、toe lines、foot outlines、skin-colored toe details を明示的に禁止する必要があります。配置方式としては、necklace / boots ともに次スロットへ進める程度の安定性があります。

## stability fit v10: boots alpha 補正

v9 の cream boots は、素材そのものに足指が描かれたというより、白からクリーム色のブーツ内部が背景除去で半透明化し、base の足指が透けて見えている可能性があります。`ITEM_BATCH=stability-fit-v10-boots-alpha` では新規生成を行わず、v9 boots の cutout を再利用して、normalized layer の内部 alpha を不透明寄りに補正します。

実行:

```bash
RENDER_ONLY=1 ITEM_BATCH=stability-fit-v10-boots-alpha npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
```

v10 の方針:

- measured boot rect は v9 / v5 と同じものを使う。
- 左右分割後、boot 本体内部の半透明 pixel を `alpha >= 245` へ引き上げる。
- 外縁の antialias は残し、内部の小さな透明穴だけを近傍色で埋める。
- 生成 call は 0。

出力:

- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v10-boots-alpha/split/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v10-boots-alpha/normalized/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v10-boots-alpha/composite/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v10-boots-alpha/item-fit-v10-preview.html`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v10-boots-alpha/item-fit-v10-review.md`

2026-04-30 の v10 実行では、cream boots の半透明 interior pixel が片足あたり約 2k から 30 未満まで減りました。目視でも足指が透ける問題は大きく改善し、ribbon boots 側にも目立つ副作用はありませんでした。淡色 boots には、通常の背景除去後に v10 の opaque-interior normalization を使うのが妥当です。

## high-risk fit v11: hairAccessory

`ITEM_BATCH=high-risk-fit-v11-hair-accessory` では、necklace / boots から次のスロットへ進めるため、髪まわりの小物が顔や目を邪魔せずに重ねられるかを検証します。生成対象は headband 1点、hairpin 1点の合計 2 call に限定します。

実行:

```bash
ITEM_BATCH=high-risk-fit-v11-hair-accessory npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
```

特定アイテムだけ再生成する場合:

```bash
ITEM_BATCH=high-risk-fit-v11-hair-accessory ITEM_IDS=hairband-tiny-ribbon-fit npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
ITEM_BATCH=high-risk-fit-v11-hair-accessory ITEM_IDS=hairpin-small-flower-fit npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
```

v11 の配置方針:

- base cutout の頭部 alpha bounds を測定し、head center と accessory target rect を機械的に決める。
- headband は頭頂寄りの横長 rect に収め、顔・目を覆わないかを見る。
- hairpin は画像右側の髪の外縁寄り rect に収め、髪に留まって見えるかを見る。
- 生成プロンプトだけに依存せず、生成後の cutout を target rect へ normalize する。

出力:

- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v11-hair-accessory/raw/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v11-hair-accessory/cutout/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v11-hair-accessory/normalized/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v11-hair-accessory/composite/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v11-hair-accessory/item-fit-v11-preview.html`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v11-hair-accessory/item-fit-v11-review.md`

v11 で headband と hairpin がともに合格すれば、次は hairAccessory を 2-3 点追加して配置安定性を確認します。顔や目への干渉、髪から浮いて見える問題、背景除去の破綻が出る場合は、他パーツに進む前に hair accessory 用 anchor を補正します。

2026-04-30 の v11 実行では、headband 1点と hairpin 1点を生成しました。headband は頭部 center から求めた横長 target rect で顔・目に干渉せず、上髪に沿う見え方になりました。hairpin は初回 rect だと画像右側の目に干渉したため、新規生成はせず、target rect を小さくして髪の外縁へ寄せる再配置を行いました。最終的には flower hairpin も顔・目への干渉がなく、髪に留まって見えるため、hairAccessory も機械的な head bounds 測定と slot-specific rect で成立しそうです。次は hairAccessory の候補を 2-3 点増やし、同じ anchor で安定するかを確認します。

## stability fit v12: hairAccessory の量産安定性検証

`ITEM_BATCH=stability-fit-v12-hair-accessories` では、v11 で成立した head bounds + slot-specific target rect が別デザインの hairAccessory でも安定するかを確認します。生成対象は hairpin 2点、headband 1点の合計 3 call に限定します。

実行:

```bash
ITEM_BATCH=stability-fit-v12-hair-accessories npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
```

特定アイテムだけ再生成する場合:

```bash
ITEM_BATCH=stability-fit-v12-hair-accessories ITEM_IDS=hairpin-side-ribbon-stability-fit npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
ITEM_BATCH=stability-fit-v12-hair-accessories ITEM_IDS=hairpin-pearl-clips-stability-fit npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
ITEM_BATCH=stability-fit-v12-hair-accessories ITEM_IDS=headband-slim-lace-stability-fit npm --prefix backend/draw run generate-dressup-gpt-image-2-validation
```

v12 の配置方針:

- hairpin は v11 で補正した小さめの `hairpinRight` target rect を使い、顔・目への干渉を避ける。
- headband は v11 と同じ `headband` target rect を使い、頭頂から浮かず、眉や目を覆わないかを見る。
- 生成後の cutout を normalize し、追加生成よりも `RENDER_ONLY=1` の再配置を優先する。

出力:

- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v12-hair-accessory-stability/raw/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v12-hair-accessory-stability/cutout/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v12-hair-accessory-stability/normalized/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v12-hair-accessory-stability/composite/`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v12-hair-accessory-stability/item-fit-v12-preview.html`
- `backend/draw/artifacts/dressup-gpt-image-2-validation/item-fit-v12-hair-accessory-stability/item-fit-v12-review.md`

v12 で 3点とも合格すれば、hairAccessory は現行 anchor 方針で次カテゴリへ進めます。headband が浮く、hairpin が顔側へ入る、淡色 pearl の alpha が欠ける場合は、hairAccessory の target rect または background removal 後処理を調整します。

2026-04-30 の v12 実行では、hairpin 2点と headband 1点を生成しました。初回の v11-sized hairpin target では pearl clips が顔側に入りすぎたため、新規生成はせず、v12 専用に `hairpinRight` target rect を小さく外側へ寄せて再配置しました。最終的には side ribbon hairpin、pearl clips、slim lace headband の3点とも顔・目への干渉はなく、髪に留まって見えました。pearl clips は配置としては合格ですが、生成デザインは丸い pearl というより横線状の clip が重なった見え方なので、今後の pearl 系 prompt では fewer round pearl beads、no stacked horizontal bars を強める必要があります。anchor 方針としては v12 の小さめ外側 hairpin rect を採用し、次カテゴリへ進めます。

## AGENTS.md 判定

このメモの追加自体は調査ドキュメントの追加であり、URL ルーティング、SEO、外部連携、データフロー、インフラ、ビルド・実行時前提を変更しません。

Design decision affected: NO
