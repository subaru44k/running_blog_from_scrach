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

## AGENTS.md 判定

このメモの追加自体は調査ドキュメントの追加であり、URL ルーティング、SEO、外部連携、データフロー、インフラ、ビルド・実行時前提を変更しません。

Design decision affected: NO
