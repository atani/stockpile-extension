# Privacy Policy / プライバシーポリシー

Last updated: 2024-12-31

## English

### Overview

Stockpile - Download Organizer ("the Extension") is committed to protecting your privacy. This privacy policy explains how the Extension handles your data.

### Data Collection

The Extension collects and stores the following data **locally on your device only**:

1. **Download History**: Information about files downloaded from supported stock sites, including:
   - File names
   - Download timestamps
   - Source URLs
   - Metadata (title, category, tags) extracted from download pages

2. **User Preferences**: Your settings and configuration for the Extension.

### Data Storage

- All data is stored locally using Chrome's `chrome.storage` API
- **No data is transmitted to external servers**
- **No data is shared with third parties**
- Data remains on your device and is not accessible to the Extension developer

### Data Usage

The collected data is used solely for:
- Organizing downloaded files into appropriate folders
- Displaying download history within the Extension
- Providing search and filter functionality
- Exporting history data (JSON/CSV) at your request

### Permissions

The Extension requires the following permissions:
- `downloads`: To rename and organize downloaded files
- `storage`: To save settings and history locally
- `activeTab`: To extract metadata from the current page
- `alarms`: To perform periodic cleanup tasks

### Data Deletion

You can delete all stored data at any time by:
1. Removing the Extension from Chrome
2. Using the "Clear History" function in the Extension options

### Contact

For questions about this privacy policy, please open an issue at:
https://github.com/atani/stockpile-extension/issues

---

## 日本語

### 概要

Stockpile - Download Organizer（以下「本拡張機能」）は、ユーザーのプライバシー保護に取り組んでいます。このプライバシーポリシーは、本拡張機能がデータをどのように扱うかを説明します。

### データ収集

本拡張機能は、以下のデータを **ユーザーのデバイス上にのみ** 収集・保存します：

1. **ダウンロード履歴**: 対応するストックサイトからダウンロードしたファイルの情報
   - ファイル名
   - ダウンロード日時
   - ダウンロード元URL
   - ページから抽出したメタデータ（タイトル、カテゴリ、タグ）

2. **ユーザー設定**: 拡張機能の設定情報

### データ保存

- すべてのデータはChromeの `chrome.storage` APIを使用してローカルに保存されます
- **外部サーバーへのデータ送信は行いません**
- **第三者へのデータ共有は行いません**
- データはユーザーのデバイス上にのみ存在し、開発者はアクセスできません

### データの使用目的

収集したデータは以下の目的にのみ使用されます：
- ダウンロードファイルの適切なフォルダへの振り分け
- 拡張機能内でのダウンロード履歴の表示
- 検索・フィルタリング機能の提供
- ユーザーの要求に応じた履歴データのエクスポート（JSON/CSV）

### 権限

本拡張機能は以下の権限を必要とします：
- `downloads`: ダウンロードファイルのリネームと整理
- `storage`: 設定と履歴のローカル保存
- `activeTab`: 現在のページからメタデータを抽出
- `alarms`: 定期的なクリーンアップタスクの実行

### データの削除

保存されたデータはいつでも削除できます：
1. Chromeから拡張機能を削除する
2. 拡張機能のオプションページで「履歴をクリア」機能を使用する

### お問い合わせ

このプライバシーポリシーに関するご質問は、以下のGitHub Issueにてお問い合わせください：
https://github.com/atani/stockpile-extension/issues
