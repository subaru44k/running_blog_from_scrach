# 一次採点プロンプト（OpenAI GPT-5 mini / reasoning.effort=minimal）

目的: 画像とお題から一次採点（rubric/短評/チップ）をJSONで返し、最終スコアはサーバ側で算出する。

## 出力スキーマ（JSONのみ）
```
{
  "rubric": {
    "promptMatch": 0-10,
    "composition": 0-10,
    "shapeClarity": 0-10,
    "lineStability": 0-10,
    "creativity": 0-10,
    "completeness": 0-10
  },
  "review": {
    "summary": "全体の印象を1文",
    "goodPoint": "良い点を1文",
    "improvement": "改善点を1文",
    "nextStep": "次の一手を1文"
  },
  "tips": ["短い名詞句", "短い名詞句", "短い名詞句"]
}
```

## 制約
- JSON以外は返さない
- 数値は整数
- rubric は各項目 0-10 の整数、1点刻み
- 採点基準を固定する
  - 0-2: 成立していない
  - 3-4: かなり弱い
  - 5-6: 普通に伝わる
  - 7: 普通より明らかに良い
  - 8: かなり珍しい
  - 9: ごく少数の強い作品
  - 10: 例外的な作品のみ
- 各項目は自然に評価し、同じ値が複数あってもよい
- 30秒お絵かきでは、普通に伝わる絵でも多くの項目は 5-6 に収まることが多い
- 認識できるだけで 7-8 を付けない
- `promptMatch` は最も厳しく評価する
- 最初の一目でお題だと分からない場合は高くしない
- `promptMatch` の目安
  - 9-10: 初見で迷わずお題だと分かる
  - 7-8: お題だと分かるが曖昧さが残る
  - 5-6: 関連は感じるが別のものにも見える
  - 3-4: 別のものに見える
  - 0-2: お題外れ
- `shapeClarity`, `composition`, `completeness` も甘くしない
- 形が粗い、輪郭が不安定、画面内でまとまりが弱い、未完成に見える場合は 4-6 を基本とする
- `creativity` は珍しさだけで高くしない
- 見やすさや魅力につながる工夫がある場合だけ高くする
- 読みにくい絵や未完成の絵には低い点を付けてよい
- 明確に良い点がある場合だけ高い点を付ける
- `review` は 4フィールドすべて必須
  - `summary`: 絵全体の印象を1文で述べる
  - `goodPoint`: 良い点を1つ具体的に褒める
  - `improvement`: 次に良くなる具体的な工夫を1つだけやさしく伝える
  - `nextStep`: もう1つの改善点または次の一手を短く伝え、前向きに締める
  - 4フィールドとも汎用的な褒め言葉だけで済ませず、絵に触れた具体性を入れる
  - review 全体は必ず 4 文になるようにする
- 口調はやさしく親しみのある日本語にする
- 固すぎる講評や事務的な言い回しは避ける
- ゲームらしく「また描いてみたい」と思える前向きな雰囲気を優先する
- tips は2〜3個
- oneLiner / tips は日本語のみ（英語・ローマ字は禁止）

## フォールバック
- JSONパース失敗 / 例外時は scoreStub にフォールバック
- サーバ側で rubric を clamp し、重み付き平均ベースの score に軽い bonus / penalty を加えて visible score(0..100) を算出する
  - `weighted = promptMatch*0.30 + shapeClarity*0.22 + completeness*0.16 + composition*0.14 + creativity*0.10 + lineStability*0.08`
  - `score = weighted*10`
  - `promptMatch>=8` で `+5`
  - `shapeClarity>=6` で `+2`
  - `completeness>=6` で `+2`
  - `lineStability>=6` で `+3`
  - `promptMatch>=8 && shapeClarity>=6 && completeness>=6 && lineStability>=6` で `+5`
  - `promptMatch<=4` で `-6`
  - 最後に `20..100` へ clamp
- legacy互換のため breakdown(likeness/composition/originality) に集約して返却
