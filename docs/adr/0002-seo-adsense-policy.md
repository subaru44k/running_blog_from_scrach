# ADR 0002: SEO / AdSense 向けポリシー

- Status: Accepted
- Date: 2026-01-05

## Context
AdSense審査においては、サイトの目的・連絡手段・データ取扱いの明確さが重要。

## Decision
- UI文言は日本語に統一
- About/Contact/Privacy に運営者・連絡・データ取扱いを明示
- canonical は正規URLのみ
- 404ページは noindex,follow

## Consequences
- 英語UIは削除/最小化
- 404やエラー系のSEOは明示的に管理
