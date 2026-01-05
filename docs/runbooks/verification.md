# 検証手順

## 1) 404ポリシー
### 期待値
- 存在しないパスは **HTTP 404**
- 404ページは `noindex,follow`
- 404ページは canonical を出さない

### 確認（curl）
```
curl -I https://subaru-is-running.com/this-page-does-not-exist
```
期待:
- `HTTP/2 404`
- `content-type: text/html`

### 404ページのSEOタグ確認
```
curl -s https://subaru-is-running.com/404.html | head -n 60
```
期待:
- `<meta name="robots" content="noindex,follow">`
- `<link rel="canonical" ...>` が **出力されない**

## 2) 正常ページのcanonical
```
curl -s https://subaru-is-running.com/running-pace/ | head -n 60
```
期待:
- `<link rel="canonical" href="https://subaru-is-running.com/running-pace/">`

## 3) PDF圧縮 E2E
TODO: 公開APIのエンドポイント/認証経路を確定後に追記。

## 4) Fitbit連携
TODO: OAuthコールバックURLとトークン保存先の実値を確定後に追記。
