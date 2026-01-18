# ADR 0001: Monetization via ExtensionPay + Pro Feature Gating

- Status: Proposed
- Date: 2026-01-18

## Context
Chrome Web Store の標準決済は新規課金に使えず、拡張機能内課金は外部決済が前提となる。  
本拡張はフリーミアム方針で「追加サイト対応」「Google Drive 同期」を有料機能として提供したい。  
自前サーバ運用は避け、実装コストと運用負荷を最小化したい。

## Decision
有料プランの課金/ライセンス管理に ExtensionPay を採用する。  
有料機能の実行可否は background service worker で必ず判定し、UI（popup/options）でも無効化表示を行う。

## Consequences
### Pros
- サーバ不要で課金/ライセンス管理を実現できる
- 実装と運用の負荷が小さい
- フリーミアムの導線をUIに組み込みやすい

### Cons
- 外部サービス依存（ExtensionPayの稼働/仕様変更）
- 決済情報の扱いは外部に委託（プライバシー表記が必要）

### Follow-ups
- ExtensionPay の extension id を取得
- popup/options に Pro UI 導線を追加
- paid 判定ロジックを service worker に実装
- Google Drive 同期の設計（OAuth/スコープ/保存構造）を定義
