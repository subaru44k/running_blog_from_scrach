# ADR 0002: SEO / AdSense 向けポリシー

- Status: Accepted
- Date: 2026-01-05

## Context
AdSense審査においては、サイトの目的・連絡手段・データ取扱いの明確さが重要。

## Decision
- UI文言は日本語に統一
- HTML の言語指定は `ja` に統一
- About/Contact/Privacy に運営者・連絡・データ取扱いを明示
- トップページと About で、PDF圧縮・ペース計算・お絵かきゲーム・ミニゲーム・ブログを主要コンテンツとして明示
- canonical は正規URLのみ
- 404ページは noindex,follow
- AdSense 用 `ads.txt` は `astro-blog/public/ads.txt` から `/ads.txt` として静的配信する

## Consequences
- 英語UIは削除/最小化
- 日本語サイトとしての基本情報と主要価値をトップページと About から確認できる
- 404やエラー系のSEOは明示的に管理
- AdSense 審査前の準備として、サイトルートで publisher ID に対応する `ads.txt` を返す
