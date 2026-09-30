// 設定ファイル。パズルの絵を増やすときは puzzles に1行足します。
// 画像は images/ フォルダに入れます(横長3:2がきれいです。違う比率は中央を切り抜きます)。
window.APP_CONFIG = {
  firebase: {
    apiKey: "AIzaSyBPuxY3dK0Kir0XtugbSkKMRJwM71b69ZA",
    authDomain: "ika-puzzle.firebaseapp.com",
    databaseURL: "https://ika-puzzle-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "ika-puzzle",
    storageBucket: "ika-puzzle.firebasestorage.app",
    messagingSenderId: "917981358209",
    appId: "1:917981358209:web:71ccc374ac2ea784e50580"
  },
  puzzles: [
    { id: "moonboat", title: "ほしふる夜のこぶね", src: "images/puzzle-moonboat.jpg" }
    // { id: "member01", title: "○○さんの作品", src: "images/member01.jpg" },
  ],
  // BGM。曲を増やすときは bgm/ フォルダにmp3を入れて1行足します。いちばん上の曲が最初に流れます。
  bgm: [
    { id: "moonlit", title: "Moonlit Puzzle", src: "bgm/moonlit-puzzle.mp3" },
    { id: "sorou", title: "ピースが揃う時", src: "bgm/piece-ga-sorou-toki.mp3" },
    { id: "window", title: "Window Seat Puzzle", src: "bgm/window-seat-puzzle.mp3" },
    { id: "jikan", title: "ピースパズルの時間", src: "bgm/piece-puzzle-no-jikan.mp3" }
    // { id: "mysong", title: "好きな曲", src: "bgm/mysong.mp3" },
  ]
};
