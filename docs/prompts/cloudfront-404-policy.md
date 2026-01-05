# CloudFront 404 ポリシー変更プロンプト

## 目的
- 存在しないURLで `HTTP 404` を返す（soft 404回避）
- 404/403 ともに `/404.html` を返す

## 前提
- 対象ドメイン: `subaru-is-running.com`
- オリジン: S3
- AWS CLI は使わない。AWS MCP を使う

## 変更範囲
- CloudFront Distribution の Custom Error Responses

## 実行手順
1) MCPで Distribution を特定（CNAME が `subaru-is-running.com`）
2) 既存の設定（behaviors/origin/custom errors）を要約
3) Custom Error Responses を以下に更新
   - 404 → `/404.html`, ResponseCode=404, TTL短め
   - 403 → `/404.html`, ResponseCode=404, TTL短め
4) 反映後の差分と検証手順を提示

## 検証
- `curl -I /not-found` → 404
- 実在ファイル → 200

## 想定リスク
- `/404.html` がS3に存在しない場合、エラー応答が失敗する

## ロールバック
- Custom Error Responses を更新前の状態に戻す
