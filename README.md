# Stockpile - Download Organizer

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/dghocnhifhkndkmolgkhcibnkapikjil)](https://chromewebstore.google.com/detail/stockpile-download-organi/dghocnhifhkndkmolgkhcibnkapikjil)

MotionElements、Audiio、DOVA-SYNDROME、魔王魂などのストックサイトからダウンロードしたアセットを自動的に整理する Chrome 拡張機能です。

**[Chrome Web Store からインストール](https://chromewebstore.google.com/detail/stockpile-download-organi/dghocnhifhkndkmolgkhcibnkapikjil)**

## スクリーンショット

![Stockpile ポップアップ](screenshots/screenshot-1-promo.png)

![フォルダ構造](screenshots/screenshot-2-folders.png)

## 機能

- **自動フォルダ振り分け**: ダウンロードしたファイルをサイト・カテゴリ別に自動で整理
- **メタデータ抽出**: ページからタイトル、タグ、カテゴリ、長さなどの情報を自動取得
- **ダウンロード履歴**: 過去のダウンロードを検索・フィルタリング可能
- **エクスポート機能**: JSON/CSV 形式でダウンロード履歴をエクスポート

## 対応サイト

以下のサイトに対応しています。各サイトのダウンロード項目を自動で整理します。

- [MotionElements](https://www.motionelements.com/ja/?ref=8581ETCWG)
- [Audiio](https://audiio.com/)
- [DOVA-SYNDROME](https://dova-s.jp/)
- [BGMer](https://bgmer.net/)
- [魔王魂](https://maou.audio/)
- [BGMusic](https://bgmusic.jp/)
- [RYU ITO MUSIC](https://ryu110.com/)
- [フキダシデザイン](https://fukidesign.com/)

## フォルダ構造

ダウンロードしたファイルは以下の構造で保存されます:

```
Downloads/
└── Stockpile/
    ├── MotionElements/
    │   ├── Video/
    │   ├── BGM/
    │   ├── SE/
    │   ├── Mogrt/
    │   ├── Preset/
    │   └── AE_Template/
    ├── Audiio/
    │   ├── BGM/
    │   └── SE/
    ├── DOVA-SYNDROME/
    │   ├── BGM/
    │   └── SE/
    ├── BGMer/
    │   └── BGM/
    ├── MaouDamashii/
    │   ├── BGM/
    │   ├── SE/
    │   └── Vocal/
    ├── BGMusic/
    │   ├── BGM/
    │   └── Jingle/
    ├── RyuItoMusic/
    │   └── BGM/
    └── FukiDesign/
        └── Fukidashi/
```

## インストール

[Chrome Web Store](https://chromewebstore.google.com/detail/stockpile-download-organi/dghocnhifhkndkmolgkhcibnkapikjil) からインストールしてください。

### 開発者向け

1. このリポジトリをクローン
2. Chrome で `chrome://extensions` を開く
3. 右上の「デベロッパーモード」を有効化
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. クローンしたフォルダを選択

## 使い方

1. 拡張機能アイコンをクリックしてポップアップを開く
2. トグルスイッチで自動整理の有効/無効を切り替え
3. 対応サイトでファイルをダウンロードすると自動的に振り分けられる
4. ポップアップから過去のダウンロードを検索・確認可能

## 設定

拡張機能のオプションページから以下の設定が可能:

- **ベースフォルダ名**: デフォルトは `Stockpile`
- **サイト別の有効/無効**: 各サイトの自動整理を個別に設定
- **カテゴリマッピング**: サイトのカテゴリをフォルダ名にマッピング

## ファイル構成

```
stockpile-extension/
├── manifest.json          # 拡張機能マニフェスト
├── background/
│   └── service-worker.js  # バックグラウンド処理
├── content/
│   ├── motionelements.js  # MotionElements 用コンテンツスクリプト
│   ├── audiio.js          # Audiio 用コンテンツスクリプト
│   ├── dova.js            # DOVA-SYNDROME 用コンテンツスクリプト
│   ├── bgmer.js           # BGMer 用コンテンツスクリプト
│   ├── maoudamashii.js    # 魔王魂 用コンテンツスクリプト
│   ├── bgmusic.js         # BGMusic 用コンテンツスクリプト
│   ├── ryuitomusic.js     # RYU ITO MUSIC 用コンテンツスクリプト
│   └── fukidesign.js      # フキダシデザイン 用コンテンツスクリプト
├── lib/
│   ├── storage.js         # 設定管理
│   └── database.js        # ダウンロード履歴管理
├── popup/
│   ├── popup.html         # ポップアップ UI
│   ├── popup.css          # スタイル
│   └── popup.js           # ポップアップロジック
└── options/
    ├── options.html       # 設定ページ
    └── options.js         # 設定ロジック
```

## 必要な権限

- `downloads`: ダウンロードのファイル名変更
- `storage`: 設定と履歴の保存
- `activeTab`: アクティブタブの情報取得

## ライセンス

MIT
