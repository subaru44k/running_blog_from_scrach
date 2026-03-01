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
- 5/10 の多用は禁止（必要時のみ例外）
- 同点を減らすため、近い評価帯でも1〜3点差を積極的に付ける
- rubricの6項目のうち、少なくとも2項目は他作品との差が出るように評価する
- 曖昧な場合は 6/7/8/9 を優先
- tips は2〜3個
- oneLiner / tips は日本語のみ（英語・ローマ字は禁止）

## フォールバック
- JSONパース失敗 / 例外時は scoreStub にフォールバック
- サーバ側で rubric を clamp し、重み付きで score(0..100) を算出
- legacy互換のため breakdown(likeness/composition/originality) に集約して返却
