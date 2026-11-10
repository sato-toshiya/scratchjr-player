/**
 * ScratchJr Google ドライブ再生用 GAS Web アプリ
 * 
 * 使い方:
 * 1. Google Apps Script のエディタ（https://script.google.com/）に本コードを貼り付けます。
 * 2. 下記の VERCEL_APP_URL を、デプロイした Vercel の URL に書き換えます。
 * 3. 右上の「デプロイ」>「新しいデプロイ」を選択:
 *    - 種類の選択: 「ウェブアプリ」
 *    - 次のユーザーとして実行: 「自分」
 *    - アクセスできるユーザー: 「全員」
 * 4. 発行されたウェブアプリ URL で利用可能になります。
 */

// ★ デプロイしたホスティング先（Netlify 等）のプレイヤーURLを指定してください
// 例: "https://your-scratchjr-player.netlify.app/player.html"
var PLAYER_APP_URL = "https://your-scratchjr-player.netlify.app/player.html";

/**
 * Web アプリのエントリポイント
 * 
 * パターン 1: ビューア画面として直接開く
 *   URL: https://script.google.com/.../exec?id=DRIVE_FILE_ID
 * 
 * パターン 2: JSON / JSONP API として .sjr を取得する
 *   URL: https://script.google.com/.../exec?id=DRIVE_FILE_ID&api=1
 *   または callback パラメータ付き
 */
function doGet(e) {
  var fileId = e.parameter.id;
  var isApi = e.parameter.api === "1" || !!e.parameter.callback;

  // ファイルIDが指定されていない場合
  if (!fileId) {
    if (isApi) {
      return makeJsonResponse({ success: false, error: "Missing 'id' parameter" }, e.parameter.callback);
    }
    return HtmlService.createHtmlOutput(
      "<h3 style='font-family:sans-serif;text-align:center;margin-top:50px;'>" +
      "URL に Google ドライブのファイルIDを指定してください。<br>" +
      "<small style='color:#666;'>例: ?id=1A2B3C4D5E... </small></h3>"
    ).setTitle("ScratchJr Player");
  }

  // API モード: .sjr の Base64 データを返却
  if (isApi) {
    try {
      var file = DriveApp.getFileById(fileId);
      var blob = file.getBlob();
      var base64 = Utilities.base64Encode(blob.getBytes());
      return makeJsonResponse({
        success: true,
        name: file.getName(),
        data: base64
      }, e.parameter.callback);
    } catch (err) {
      return makeJsonResponse({ success: false, error: err.toString() }, e.parameter.callback);
    }
  }

  // ビューア画面モード: Vercel の player.html を iframe で全画面表示し、Drive のデータを postMessage で渡す
  try {
    var file = DriveApp.getFileById(fileId);
    var blob = file.getBlob();
    var base64 = Utilities.base64Encode(blob.getBytes());
    var autoPlay = e.parameter.autoPlay !== "0";

    var htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>${escapeHtml(file.getName())} - ScratchJr Player</title>
        <style>
          html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; }
          iframe { width: 100%; height: 100%; border: none; display: block; }
        </style>
      </head>
      <body>
        <iframe id="playerFrame" src="${PLAYER_APP_URL}" allow="autoplay; fullscreen"></iframe>
        <script>
          var sjrData = {
            type: "LOAD_SJR",
            name: "${escapeHtml(file.getName())}",
            base64: "${base64}",
            autoPlay: ${autoPlay}
          };

          var frame = document.getElementById("playerFrame");
          
          // iframe のロード完了時に postMessage でデータを送信
          frame.onload = function() {
            setTimeout(function() {
              frame.contentWindow.postMessage(sjrData, "*");
            }, 600);
          };
        </script>
      </body>
      </html>
    `;

    return HtmlService.createHtmlOutput(htmlContent)
      .setTitle(file.getName() + " - ScratchJr")
      .addMetaTag("viewport", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  } catch (err) {
    return HtmlService.createHtmlOutput(
      "<h3 style='color:red;font-family:sans-serif;text-align:center;margin-top:50px;'>" +
      "ファイルの取得に失敗しました: " + escapeHtml(err.toString()) + "</h3>"
    ).setTitle("Error");
  }
}

/**
 * JSON / JSONP レスポンスを作成するヘルパー
 */
function makeJsonResponse(data, callback) {
  var jsonStr = JSON.stringify(data);
  if (callback) {
    return ContentService.createTextOutput(callback + "(" + jsonStr + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(jsonStr)
    .setMimeType(ContentService.MimeType.JSON);
}

function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, function(m) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
  });
}
