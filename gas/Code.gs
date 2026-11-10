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

// ★ デプロイしたホスティング先（Netlify）のプレイヤーURL
var PLAYER_APP_URL = "https://scratchjr-player.netlify.app/player.html";

/**
 * Web アプリのエントリポイント
 * 
 * パターン 1: ファイルIDまたはドライブ共有URLを指定して直接開く
 *   例: ?id=DRIVE_FILE_ID
 * 
 * パターン 2: パラメータなしで開く
 *   -> 共有リンク貼り付けフォーム（ランチャー画面）を表示
 * 
 * パターン 3: JSON / JSONP API として .sjr を取得する
 *   例: ?id=DRIVE_FILE_ID&api=1 (または callback=...)
 */
function doGet(e) {
  var rawId = e.parameter.id;
  var fileId = extractFileId(rawId);
  var isApi = e.parameter.api === "1" || !!e.parameter.callback;

  // ファイルIDが指定されていない場合 -> ランチャー（URL貼り付け再生）画面を表示
  if (!fileId) {
    if (isApi) {
      return makeJsonResponse({ success: false, error: "Missing 'id' parameter" }, e.parameter.callback);
    }
    return renderLauncherPage();
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

  // ビューア画面モード: Netlify の player.html を iframe で全画面表示し、Drive のデータを postMessage で渡す
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
      "<h3 style='color:#e74c3c;font-family:sans-serif;text-align:center;margin-top:50px;'>" +
      "ファイルの取得に失敗しました。<br><br>" +
      "<small style='color:#666;font-weight:normal;'>エラー詳細: " + escapeHtml(err.toString()) + "</small><br><br>" +
      "<a href='" + ScriptApp.getService().getUrl() + "' style='color:#3498db;text-decoration:none;'>← ランチャー画面に戻る</a></h3>"
    ).setTitle("Error - ScratchJr Player");
  }
}

/**
 * パラメータなしで開いた場合のランチャー（入力・選択）画面
 */
function renderLauncherPage() {
  var currentUrl = ScriptApp.getService().getUrl();
  var html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ScratchJr Web Player ランチャー</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background: #f4f7f9;
          margin: 0;
          padding: 40px 20px;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 80vh;
        }
        .card {
          background: #ffffff;
          max-width: 540px;
          width: 100%;
          padding: 32px;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }
        h2 { margin-top: 0; color: #2c3e50; font-size: 24px; text-align: center; }
        p { color: #666; line-height: 1.6; font-size: 14px; }
        .input-group { margin-top: 24px; }
        label { display: block; font-weight: bold; margin-bottom: 8px; color: #34495e; font-size: 14px; }
        input[type="text"] {
          width: 100%;
          padding: 12px;
          border: 1px solid #ccc;
          border-radius: 6px;
          font-size: 15px;
          box-sizing: border-box;
          transition: border-color 0.2s;
        }
        input[type="text"]:focus {
          border-color: #f7a827;
          outline: none;
        }
        .checkbox-group {
          margin-top: 16px;
          display: flex;
          align-items: center;
          font-size: 14px;
          color: #555;
        }
        .checkbox-group input { margin-right: 8px; }
        button {
          width: 100%;
          margin-top: 24px;
          padding: 14px;
          background: #f7a827;
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: background 0.2s;
        }
        button:hover { background: #e09419; }
        .hint {
          margin-top: 20px;
          padding: 12px;
          background: #f8f9fa;
          border-left: 4px solid #f7a827;
          font-size: 13px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>🐱 ScratchJr Web Player</h2>
        <p>Google ドライブ内の <code>.sjr</code> ファイルをブラウザ上で全画面再生します。<br>
        ドライブの共有リンク、またはファイル ID を入力してください。</p>

        <form action="${currentUrl}" method="get">
          <div class="input-group">
            <label for="idInput">Google ドライブのリンク または ファイル ID</label>
            <input type="text" id="idInput" name="id" placeholder="例: https://drive.google.com/file/d/1A2B3C.../view" required>
          </div>

          <div class="checkbox-group">
            <label>
              <input type="checkbox" name="autoPlay" value="1" checked> 起動時に緑の旗で自動再生する
            </label>
          </div>

          <button type="submit">プロジェクトを再生する ▶</button>
        </form>

        <div class="hint">
          <strong>ヒント:</strong><br>
          Google ドライブで <code>.sjr</code> ファイルを右クリック ＞「リンクを取得」した URL をそのまま貼り付けるだけで再生できます。
        </div>
      </div>
    </body>
    </html>
  `;

  return HtmlService.createHtmlOutput(html)
    .setTitle("ScratchJr Web Player ランチャー")
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0");
}

/**
 * 共有URLまたはID文字列からファイルIDを抽出するヘルパー
 */
function extractFileId(input) {
  if (!input) return "";
  input = input.trim();
  // 共有リンク形式: /file/d/【FILE_ID】/...
  var match = input.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // パラメータ形式: ?id=【FILE_ID】
  var matchParam = input.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchParam) return matchParam[1];
  // 直接IDが入力されている場合
  return input;
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

