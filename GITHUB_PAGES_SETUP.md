# GitHub Pages への公開手順

このゲームを GitHub Pages で公開して、誰でも遊べるようにする手順です。

## 1. GitHub でリポジトリを作成する
1. [GitHub](https://github.com/) にログインします。
2. 右上の「+」アイコンから **New repository** を選択します。
3. **Repository name** に好きな名前（例: `dame-stone-break`）を入力します。
4. **Public**（公開）を選択します。
5. その他は変更せず、**Create repository** をクリックします。

## 2. プロジェクトを GitHub にアップロードする
ターミナルで以下のコマンドを順番に実行してください（`YOUR-USERNAME` と `REPOSITORY-NAME` は自分のものに置き換えてください）。

```bash
# 【重要】まずゲームのフォルダに移動します
cd /Users/user/.gemini/antigravity/playground/nodal-nadir

# Gitの初期化（まだしていない場合）
git init

# 全ファイルをステージング
git add .

# コミット作成
git commit -m "Initial release"

# ブランチ名を main に変更
git branch -M main

# リモートリポジトリを登録 (URLは GitHub の作成画面に表示されています)
git remote add origin https://github.com/YOUR-USERNAME/REPOSITORY-NAME.git

# GitHub にプッシュ
git push -u origin main
```

## 3. GitHub Pages を有効にする
1. GitHub のリポジトリページを開きます。
2. 上部のタブから **Settings** をクリックします。
3. 左サイドバーの **Pages** をクリックします。
4. **Build and deployment** セクションの **Source** を `Deploy from a branch` にします。
5. **Branch** を `main` 、フォルダを `/ (root)` に設定し、**Save** をクリックします。

## 4. 公開を確認する
設定後、1〜2分待つとページ上部に公開URL（例: `https://your-username.github.io/repository-name/`）が表示されます。
そのURLにアクセスすれば、ゲームが遊べるようになっています！
