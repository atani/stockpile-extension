# Task List

## Milestone 0 (Now)
- [x] ExtensionPay の extension id を取得
- [x] `lib/extpay.vendor.js` を公式 ExtPay スクリプトに置き換え
- [x] popup/options に Pro UI と Upgrade 導線を追加
- [x] service worker に有料判定ゲートを実装

## Milestone 1 (Drive Sync)
- [x] Drive API 有効化
- [x] Chrome 拡張用 OAuth クライアント ID を設定（manifest）
- [x] Drive 同期の基本フロー実装（保存先: Stockpile/stockpile-sync.json）
- [x] 同期完了/失敗の通知表示（OS通知 + 画面内ステータス）
- [x] Brave 対応の Web OAuth クライアント ID を作成・入力
- [x] Brave での実機認可テスト

## Milestone 2 (Site Pack)
- [x] Artlist の content script 追加と抽出強化
- [x] Artlist の実測調整（タイトル/タグ/カテゴリ）
- [x] Pro 設定でサイトごとのON/OFFの確認（Artlist）
- [ ] Epidemic Sound / Envato の content script 追加
- [ ] Epidemic Sound / Envato の実測調整（タイトル/タグ/カテゴリ）
- [ ] Pro 設定でサイトごとのON/OFFの確認（Epidemic/Envato）
- [ ] Videezy の content script 追加と実測調整
- [ ] Motion Array の content script 追加と実測調整
- [ ] Mixkit の content script 追加と実測調整
- [ ] Adobe Stock の content script 追加と実測調整

## Milestone 3 (Release Hygiene)
- [ ] Dev: Pro Override を削除 or 非表示
- [ ] `driveWebClientId` 設定欄の公開方針を決定（非表示/管理者のみ）
- [ ] 課金導線の文言・スクショの最終調整
- [ ] 追加権限の説明（notifications / identity）を記載
- [x] E2EテストとCIの動作確認

## Post-Release
- [ ] Drive 同期の差分/履歴管理（オプション）
- [ ] エラー解析ログの軽量化（必要なら）
