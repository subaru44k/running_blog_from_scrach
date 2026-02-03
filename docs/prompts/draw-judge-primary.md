# 一次採点プロンプト（Bedrock Claude 3 Haiku）

目的: 画像とお題から一次採点（スコア/内訳/短評/チップ）をJSONで返す。

## 出力スキーマ（JSONのみ）
```
{
  "score": 0-100,
  "breakdown": {
    "likeness": 0-100,
    "composition": 0-100,
    "originality": 0-100
  },
  "oneLiner": "日本語1-2文、90文字以内",
  "tips": ["短い名詞句", "短い名詞句", "短い名詞句"]
}
```

## 制約
- JSON以外は返さない
- 数値は整数
- score は breakdown 平均に近づける
- tips は2〜3個

## フォールバック
- JSONパース失敗 / 例外時は scoreStub にフォールバック
- サーバ側で 0..100 に clamp、score は breakdown 平均±10に補正

