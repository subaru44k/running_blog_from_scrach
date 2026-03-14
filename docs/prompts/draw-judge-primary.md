# 一次採点プロンプト（OpenAI GPT-4.1 mini）

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
  - 5-6: 平均的
  - 7: やや良い
  - 8: 明確に良い
  - 9: かなり良い
  - 10: ごく少数の例外的に強い作品のみ
- 各項目は自然に評価し、同じ値が複数あってもよい
- お題と違うものを描いている場合は `promptMatch` を低くしてよい
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
- サーバ側で rubric を clamp し、重み付き平均ベースで visible score(0..100) を算出する
  - `score = round(max(20, weighted * 14 - 10))`
  - `weighted = promptMatch*0.30 + shapeClarity*0.22 + completeness*0.16 + composition*0.14 + creativity*0.10 + lineStability*0.08`
  - モデルの rubric を尊重しつつ、可視スコアだけを 20〜100 に広げる
- legacy互換のため breakdown(likeness/composition/originality) に集約して返却
