# ADR 0003: PDF圧縮アーキテクチャ

- Status: Accepted
- Date: 2026-01-05

## Context
ブラウザでPDFを圧縮し、画質/容量の選択をしやすくする必要がある。

## Decision
- S3への署名付きPUTでアップロード
- Lambda(Docker + Ghostscript)で圧縮
- 3候補（高画質/標準/高圧縮）を並列生成
- 1ページ目プレビューPNGは best-effort

## Consequences
- S3に一時ファイルが残るためライフサイクルが前提
- keepSource=true で並列処理の競合を回避
