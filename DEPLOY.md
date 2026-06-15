# ROLLIN THREEご注文リスト サーバー公開手順書 (Deployment Guide)

本システム（Pythonサーバー + HTML/JS/CSSフロントエンド + SQLiteデータベース）を、インターネット上で公開して、お客様に共有し、かつ注文データを永続的に管理するための手順書です。

本ガイドでは、簡単かつ無料で使い始められる **Render.com** へのデプロイ方法を解説します。

---

## 💻 必要要件
- **GitHub アカウント**（ソースコードの管理・連携用）
- **Render.com アカウント**（サーバーホスティング用）
- 本プロジェクトのファイル一式（`database.db` などのローカル一時ファイルを除く）

---

## 🚀 デプロイ手順 (Render.com の場合)

### 1. Git リポジトリの準備
1. **GitHub** (https://github.com/) にサインインし、新しいプライベートリポジトリ（例：`rollin-order-list`）を作成します。
2. ローカルプロジェクト内に `.gitignore` ファイルを作成し、ローカルのデータベースファイルをコミット対象から除外します。
   ```text
   # .gitignore
   database.db
   __pycache__/
   ```
3. プロジェクトのファイル群を GitHub リポジトリにプッシュ（アップロード）します。
   - `server.py`
   - `index.html`
   - `style.css`
   - `app.js`
   - `admin.html`
   - `admin.js`
   - `注文リスト.csv`
   - `注文リスト管理/` (商品画像のフォルダ一式)
   - `.gitignore`

---

### 2. Render.com での Web Service 作成
1. **Render.com** (https://render.com/) にログインします。
2. ダッシュボードで **「New +」** ボタンをクリックし、**「Web Service」** を選択します。
3. 作成した GitHub リポジトリ（例：`rollin-order-list`）を連携・選択します。
4. 設定画面で以下のように入力します。
   - **Name**: `rollin-three-order` (任意のサービス名)
   - **Language**: `Python`
   - **Branch**: `main` (または `master`)
   - **Region**: 日本に近い場所（例：`Singapore`）を推奨
   - **Build Command**: `pip install --upgrade pip` (外部ライブラリは使用しないため、デフォルトのままで問題ありません)
   - **Start Command**: `python server.py`
   - **Instance Type**: `Free` (無料プランで動作可能です)

---

### 3. データベース永続化用のディスク（Persistent Disk）設定
> [!IMPORTANT]
> 無料プランや通常設定のままでは、Render.com のサーバーが定期的に再起動する際、SQLite データベース（`database.db`）が初期化され、お客様からの注文データが消えてしまいます。以下の手順で**永続化ディスク**をマウントしてください。

1. Web Service の設定ページの下部にある **「Advanced」** ボタンをクリックします。
2. **「Add Disk」** をクリックします。
   - **Name**: `sqlite-data`
   - **Mount Path**: `/data`
   - **Size**: `1 GiB` (無料枠で十分な容量です)
3. ディスク追加後、すぐ下にある **「Environment Variables」** (環境変数) に以下を設定します。
   - **Key**: `DATABASE_PATH`
   - **Value**: `/data/database.db`
   - **Key**: `PORT`
   - **Value**: `8000` (Renderが自動でポート指定を行いますが、明示しておくと安心です)

---

### 4. デプロイの実行と公開
1. 設定が完了したら、最下部の **「Create Web Service」** をクリックします。
2. ログ画面が表示され、ビルドとデプロイが開始されます。数分でステータスが **「Live」** になります。
3. 画面左上に表示されているURL（例：`https://rollin-three-order.onrender.com`）にアクセスし、システムが正しく表示されることを確認します。

---

## 🔑 管理者画面へのアクセス
- 顧客発注の一覧・詳細・印刷ができる管理画面は、公開URLの末尾に `/admin.html` を付けたページです。
  - 例：`https://xxxxxx.onrender.com/admin.html`
- **ログイン用パスワード**: `rollin-admin`
  - ※パスワードを変更したい場合は、`server.py` の `ADMIN_PASSWORD = "rollin-admin"` (248行目、286行目付近) を変更して GitHub にプッシュしてください。

---

## 📝 今後の運用方法
- **商品リストの更新**:
  - ローカルで `注文リスト.csv` や `注文リスト管理/` 内の画像ファイルを編集後、GitHubにプッシュ（Git commit & push）するだけで、Render.com が自動的に最新状態にビルド・更新してくれます。
  - マウントされたデータベース（`/data/database.db`）は、アプリが更新されてもデータが引き継がれ、過去の注文履歴はそのまま残ります。
