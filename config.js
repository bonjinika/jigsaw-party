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
    { id: "sample", title: "うみの見えるすなはま(サンプル)", src: null }
    // { id: "member01", title: "○○さんの作品", src: "images/member01.jpg" },
  ],
  // BGM。曲を増やすときは bgm/ フォルダにmp3を入れて1行足します。
  // loopStart / loopEnd(秒)は、つなぎ目なくループさせたいときだけ書きます(書かなければ曲全体をループ)。
  bgm: [
    { id: "bgm1", title: "うみの見えるへや", src: "bgm/bgm1.mp3", loopStart: 1.0, loopEnd: 74.8461 },
    { id: "bgm2", title: "なみとおひるね", src: "bgm/bgm2.mp3", loopStart: 1.0, loopEnd: 62.9355 },
    { id: "bgm3", title: "ぱずるタイム", src: "bgm/bgm3.mp3", loopStart: 1.0, loopEnd: 77.8 }
    // { id: "mysong", title: "好きな曲", src: "bgm/mysong.mp3" },
  ]
};
