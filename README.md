# jigsaw-party

メンバーみんなで、同じ盤面を同時に組み立てるジグソーパズルです。

- 画面は `index.html` / `app.js`、設定は `config.js`
- ピースの位置や参加者の共有には Firebase Realtime Database を使います
- GitHub Pages で公開すると、アカウントなしで誰でもURLから遊べます

## パズルの絵を増やす

1. 画像を `images/` フォルダに入れます(例: `images/member01.jpg`)。横長3:2がきれいです。
2. `config.js` の `puzzles` に1行足します。

```js
{ id: "member01", title: "○○さんの作品", src: "images/member01.jpg" },
```

`id` は一度決めたら変えないでください(すでにある部屋が、その絵を探せなくなります)。

## Firebase のルール

`database.rules.json` の内容を Firebase コンソールの Realtime Database →「ルール」に貼って公開します。
部屋の一覧は誰も取得できず、招待リンク(部屋コード)を知っている人だけが入れます。

## BGM

- 曲は `bgm/` フォルダ、曲の一覧は `config.js` の `bgm` です。
- 曲は長さに関係なく、ファイル全体をくり返し再生します。
- BGMは各自の画面だけで流れ、曲・音量・ミュートはそれぞれのブラウザに記憶されます。

## 背景

- 背景の絵は `images/bg.jpg`、瞬き用の「目を閉じた顔」は `images/blink.png` です。
