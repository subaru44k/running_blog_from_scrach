# 一次採点プロンプト（Bedrock Claude 3 Haiku）

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
  "oneLiner": "日本語1-2文、90文字以内",
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
- 平均的な作品に安易に 7 や 8 を付けない
- rubric の6項目のうち、少なくとも3項目は同じ値にしない
- 弱点が見えたら 4 以下を使い、明確な強みがある場合のみ 9 以上を使う
- tips は2〜3個
- oneLiner / tips は日本語のみ（英語・ローマ字は禁止）

## フォールバック
- JSONパース失敗 / 例外時は scoreStub にフォールバック
- サーバ側で rubric を clamp し、まず latent score を算出した上で、単調変換して visible score(0..100) を返す
  - latent score:
    - `12 + avg*8.8`
    - 強い項目数（8以上）に応じた加点
    - `promptMatch >= 8 && shapeClarity >= 7` の相乗加点
    - `creativity >= 7` の加点
    - 弱い項目数（4以下）に応じた減点
    - `promptMatch <= 4` / `completeness <= 4` の追加減点
  - visible score:
    - `normalized = clamp((latent - 25) / 48, 0..1)`
    - `score = round(20 + normalized * 80)`
  - 目的は、順位を大きく崩さずに20〜100へ見た目の点差を広げること
- legacy互換のため breakdown(likeness/composition/originality) に集約して返却
