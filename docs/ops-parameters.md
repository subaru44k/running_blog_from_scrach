# 運用パラメータ（PDF圧縮のガードレール）

## 概要
PDF圧縮はコスト攻撃・過剰利用のリスクがあるため、**同時実行数・URL有効期限・サイズ上限・削除ポリシー**を明示的に管理します。値の変更はUXとコストに直結するため、ここを起点に確認・更新します。

## PDF圧縮（/pdf-compress）ガードレール一覧

| 項目 | 現在値 | どこで設定するか | 目的 | 変更時の注意 | 確認方法 |
| --- | --- | --- | --- | --- | --- |
| PDF圧縮Lambda Reserved Concurrency | 20 | Lambda設定（Concurrency） | コスト上限化、DoS緩和 | 超過時はスロットリング（429/5xx） | AWS Console → Lambda → 対象関数 → Concurrency |
| Upload URL TTL | 600秒（10分） | sign-upload-v3 の `UPLOAD_URL_TTL` | 署名URLの漏えい影響を限定 | 短すぎるとアップロード失敗が増える | Lambda環境変数 / レスポンスの `expiresIn` |
| Download/Preview URL TTL | 600秒（10分） | pdf-compress-service の `DOWNLOAD_URL_TTL` | 署名URLの漏えい影響を限定 | 短すぎるとダウンロード切れが増える | Lambda環境変数 / レスポンスの `expiresIn` |
| 最大アップロードサイズ | 50MB | S3 presigned POST の `content-length-range` + フロント `MAX_UPLOAD_BYTES` | 大容量攻撃の抑止 | APIとフロントの両方を同時更新 | sign-upload-v3 のポリシー / UIの即時バリデーション |
| Cleanup Lambda | 10分おき / 1時間超を削除 | EventBridge + Lambda | 保存コストの抑制 | TTLを短くしすぎると再DLできない | Lambdaログ / EventBridge Rule |
| S3 Lifecycle | 1日で削除 | S3 Lifecycle rules | 保存コストの抑制（最終保険） | 保存期間が短すぎると再DLできない | S3 Console → Lifecycle rules |
| API Gateway throttle | 要確認 | API Gateway Stage | 連続呼び出しの制御 | 429増加・UX低下の可能性 | API Gateway → Stage → Throttling |

## presigned URL TTL の内訳
- Upload URL TTL: `UPLOAD_URL_TTL`（sign-upload-v3、デフォルト600秒）
- Download/Preview URL TTL: `DOWNLOAD_URL_TTL`（pdf-compress-service、デフォルト600秒）
- 目安: 10分（短縮すると回線が遅い環境で失敗しやすい）

## サイズ制限
- 最大アップロードサイズ: 50MB
- 強制箇所:
  - S3 presigned POST の `content-length-range`（サーバ側）
  - フロントの即時バリデーション（`MAX_UPLOAD_BYTES`）

## API Gateway 保護
- スロットリング値は環境差があり得るため**要確認**。
- 確認方法: API Gateway → 対象API → Stage → Throttling を確認。
- WAFや追加レート制限は**未設定前提**（必要に応じて導入検討）。

## S3 保護
- Cleanup Lambda: uploads/outputs/previews を **1時間超で削除**（10分おき）。
- Lifecycle: uploads/outputs/previews を **1日で削除**（最終保険）。
- CORS（現在値）:
  ```json
  [
    {
      "AllowedOrigins": ["https://subaru-is-running.com", "http://localhost:4321"],
      "AllowedMethods": ["POST", "PUT", "GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
  ```

## 監視 / アラート
- Budgets: **要確認**（しきい値・通知先）。
- CloudWatch 指標（例）:
  - Lambda: `Throttles`, `Errors`, `Duration`
  - API Gateway: `4XXError`, `5XXError`, `Latency`
  - S3: `4xxErrors`, `5xxErrors`

## キルスイッチ（自動遮断）
- 目的: **S3転送アウトの暴走を止める最終手段**（誤爆しにくい条件のみ）
- 自動発火条件: `pdf-compress-lambda` の `Throttles` が
  - 5分 `Sum >= 50` を **2回連続**（10分）で ALARM
- 遮断内容:
  - `pdf-compress-uploads-prod` の `outputs/*` と `previews/*` の `GetObject` を Deny
  - presigned URL も含めて無効化される
- 解除手順（手動）:
  - `pdf-compress-kill-switch` を `{"mode":"disable"}` で実行
- 再遮断（手動）:
  - `pdf-compress-kill-switch` を `{"mode":"enable"}` で実行
- 運用メモ:
  - Reserved Concurrency の値変更は監視条件に影響しない
  - 誤爆時は Lambda 実行のみで復旧できる

## 変更時チェックリスト
- TTL変更時:
  - フロントの文言と動作（リンク有効期限）が一致しているか確認
- Concurrency変更時:
  - スロットリング増減とUX影響の確認
- API Gateway throttle変更時:
  - 429時のUI/リトライ挙動を確認
- サイズ上限変更時:
  - sign-upload-v3 のポリシーとフロントの上限表示を同時更新

## 既知の課題（将来対応メモ）
- PDF圧縮は重いファイルだと 30秒を超える可能性があるため、API Gateway のタイムアウトで 503 が発生しうる。
- 回避策として Lambda Function URL への切り替えがあるが、公開範囲やレート制限の再設計が必要で、Lambda実行コストの増加が懸念されるため現時点では保留。
- 非同期化（ジョブ登録 + ポーリング/SQS/StepFunctions）も回避策だが、フロントとバックエンドの改修コストが高いため将来対応とする。
