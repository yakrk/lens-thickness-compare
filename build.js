// build.js  src と vendor をつないで、1つのHTMLファイルを作る（node build.js）
// 出力 dist/index.html（本番）と dist/demo.html（見本データで結果画面から始まるデモ）
// 同じ入力からは毎回同じファイルができるので、SHA-256 で公開中のファイルと照合できる
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const R = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
function build(demo) {
  let t = R('src/index.tpl.html');
  const three = '<script>\n' + R('vendor/three/three.min.js') + '\n</script>\n<script>\n' + R('vendor/three/OrbitControls.js') + '\n</script>';
  const sample = JSON.stringify(R('samples/01_正常_3本.txt')).replace(/<\//g, '<\\/');
  t = t.replace('/*__CSS__*/', () => R('src/style.css')).replace('<!--__THREE__-->', () => three)
    .replace('/*__ENGINE__*/', () => R('src/lens-engine.js')).replace('/*__CHECK__*/', () => R('src/json-check.js')).replace('/*__PROMPT__*/', () => R('src/prompt-builder.js'))
    .replace('/*__APP__*/', () => R('src/app-core.js') + '\n' + R('src/app-3d.js') + '\n' + R('src/app-main.js').replace("/*__SAMPLE_APP__*/''", () => sample));
  if (demo) t = t.replace('<title>レンズ厚みくらべ</title>', '<title>レンズ厚みくらべ デモ</title>').replace(/<script>\nwindow\.addEventListener\('error'/, () => "<script>window.LENS_DEMO=true;</script>\n<script>\nwindow.addEventListener('error'");
  const title = (t.match(/<title>[\s\S]*?<\/title>/) || [''])[0];
  const style = (t.match(/<style>[\s\S]*?<\/style>/) || [''])[0];
  const body = t.replace(title, '').replace(style, '').replace(/<meta name="claude:viewport-fit-sides"[^>]*>\n?/, '');
  // CSP（ブラウザに守らせる約束）。この中に書かれたスクリプトだけを動かし、外部との通信はすべて止める
  const hashes = [];
  body.replace(/<script>([\s\S]*?)<\/script>/g, (m, code) => { hashes.push("'sha256-" + crypto.createHash('sha256').update(code).digest('base64') + "'"); return m; });
  const csp = "default-src 'none'; script-src " + hashes.join(' ') + "; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  return '<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="' + csp + '">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="referrer" content="no-referrer">\n' + title + '\n' + style + '\n<style>[hidden]{display:none!important}img{max-width:100%}</style>\n</head>\n<body>\n' + body + '\n</body>\n</html>\n';
}
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
const sums = [];
for (const [name, demo] of [['index.html', false], ['demo.html', true]]) {
  const html = build(demo); fs.writeFileSync(path.join(__dirname, 'dist', name), html);
  sums.push(crypto.createHash('sha256').update(html).digest('hex') + '  ' + name);
}
fs.writeFileSync(path.join(__dirname, 'dist', 'SHA256SUMS.txt'), sums.join('\n') + '\n');
fs.copyFileSync(path.join(__dirname, 'server', '.htaccess'), path.join(__dirname, 'dist', '.htaccess'));
console.log(sums.join('\n'));
