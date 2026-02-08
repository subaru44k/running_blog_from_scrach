# Bedrock採点導入メモ

## モデル
- 一次採点: Claude 3 Haiku（PRIMARY_MODEL_ID）
- 二次講評: Claude Haiku 4.5（SECONDARY_MODEL_ID）

## 必要IAM
- `bedrock:InvokeModel`

## 失敗時の挙動
- 一次: スタブ採点へフォールバック（サービス継続）
- 二次: 1回リトライ後に failed（pendingのまま残るケースあり）

## 運用メモ
- モデルIDを変更した場合は環境変数で切替
- レイテンシ/コストが増える場合は一次を小さいモデルに寄せる
