# Discord Bot TypeScript

TypeScriptで書かれたDiscordボットのテンプレートプロジェクトです。

## セットアップ

1. 依存関係をインストール:
```bash
npm install
```

2. 環境変数の設定:
- `.env.example`を`.env`にコピー
- Discord Developer Portalで取得したトークンとクライアントIDを設定

3. ボットの実行:
開発モード:
```bash
npm run dev
```

本番モード:
```bash
npm run build
npm start
```

## 機能
- 基本的なコマンド処理
- TypeScriptによる型安全な開発環境
- 環境変数による設定管理