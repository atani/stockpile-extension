# Design

## Architecture Overview
MV3 構成の Chrome 拡張。サイトごとの content script がメタデータを抽出し、background service worker がダウンロード経路と履歴保存を担当。UI は popup/options の 2 面で設定と履歴を操作する。有料化は ExtensionPay によるライセンス判定を採用し、実行ゲートは service worker で強制、UI は無効化で誘導する。将来的な同期は Google Drive 連携で実現する。

## Data Flow
1) ユーザーがストックサイトでダウンロード  
2) content script がメタ情報を取得し `REGISTER_DOWNLOAD` を送信  
3) service worker が `pendingDownloads` に保存  
4) `downloads.onDeterminingFilename` で整理先フォルダを決定  
5) 履歴を `downloadHistory` に保存し、ダウンロード先を `suggest`  
6) 有料機能（Site Pack / Drive Sync）は service worker で `paid` を判定  
7) popup/options は `paid` 状態に応じて Pro UI を無効化表示

## Storage Model
保存は `chrome.storage.local` を利用。

- `settings`
  - `baseFolder`: string
  - `enabled`: boolean
  - `pro`
    - `driveSyncEnabled`: boolean
    - `driveSyncSettings`: boolean
    - `driveSyncHistory`: boolean
    - `driveSyncExports`: boolean
  - `sites[siteKey]`: `{ enabled, name, categoryMap }`
- `pendingDownloads`
  - `{ [url]: { title, tags, category, site, sourceUrl, storedAt } }`
- `downloadHistory`
  - `[{ id, title, fileName, filePath, category, site, sourceUrl, tags, duration, downloadedAt, ... }]`

## APIs and Integrations
- **ExtensionPay**: 有料判定と決済導線（popup/options から `openPaymentPage()`）
- **Google Drive**（計画）:
  - `chrome.identity` で OAuth2 トークン取得
  - Drive API で設定/履歴/エクスポートを保存
  - 保存形式は JSON/CSV を基本、メタは `stockpile/` 配下に格納

## Permissions and Security
- 既存: `downloads`, `storage`, `alarms`, 各ストックサイトの host permissions
- 追加予定:
  - ExtensionPay: 通信先追加（必要なら CSP `connect-src` に `https://extensionpay.com`）
  - Google Drive: `identity` 権限 + `oauth2` 設定 + `https://www.googleapis.com/*`
- 有料判定は service worker 側で必ず実行し、UI 側は補助的に表示制御のみ。

## Error Handling
- ExtensionPay 取得失敗時は `paid=false` 扱い（安全側）
- Drive 同期失敗時はローカル保存を継続し、次回リトライ
- `downloads.onDeterminingFilename` の失敗は `suggest()` のデフォルト挙動にフォールバック

## Testing Strategy
手動テスト前提（現状自動テストなし）。
- 無料時の通常整理・履歴保存
- paid=false のとき Pro UI が無効化される
- paid=true で Site Pack / Drive Sync が有効
- Drive 同期の認可・保存・再取得

## Rollout and Release Plan
- ExtensionPay 連携を先に導入（有料判定と導線のみ）
- Site Pack（Artlist/Epidemic/Envato）対応を追加
- Drive 同期を後段でリリース（OAuth/権限が増えるため段階的に）
