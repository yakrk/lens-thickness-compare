/* app-main.js  画面の流れと各画面の動き。何も保存しない（変数の中だけで持つ） */

// ---- 画面の切り替え ----
var CURRENT = '1', RX_FROM = '3', MANUAL_FROM = '1', ABOUT_FROM = '1', LAST = null, PROMPT_TEXT = '';
function go(id) {
  if (id === '5' && !LAST) id = '1';
  CURRENT = id;
  document.querySelectorAll('[data-screen]').forEach(function (s) { s.hidden = s.id !== 's' + id; });
  $('stepper').hidden = id === 'm' || id === 'a';
  document.querySelectorAll('#stepper li').forEach(function (li) {
    var n = +li.dataset.step, c = +id;
    li.className = n === c ? 'on' : (n < c ? 'done' : '');
  });
  var W = {
    '1': ['1/5', 'フレーム', '比べたいフレームを入力します。次の画面で、AIに渡すプロンプトを作ります。'],
    '2': ['2/5', 'AIで調べる', 'プロンプトをコピーして、お使いのAIで実行してください。'],
    '3': ['3/5', '貼り付け', 'AIの回答を貼り付けて内容を確認します。問題がなければ度数の入力に進みます。'],
    '4': ['4/5', '度数', '度数とPDを入力します。次の画面で結果が表示されます。'],
    '5': ['5/5', '結果', '組み合わせを変えたり、度数を修正したりできます。'],
    'a': ['説明', 'このアプリについて', '「戻る」で直前の画面に戻ります。入力した内容はそのまま残っています。'],
    'm': ['任意', '手入力', 'AIを使わずに寸法を入力する画面です。入力後は「4 度数」に進みます。「戻る」で直前の画面に戻ります。']
  }[id];
  $('where').innerHTML = '現在の位置 <b>' + W[0] + '　' + W[1] + '</b><span class="note" style="font-size:14px">' + W[2] + '</span>';
  window.scrollTo(0, 0);
  if (id === '5') enterCompare();
}
document.querySelectorAll('[data-go]').forEach(function (b) {
  b.addEventListener('click', function () {
    var t = b.dataset.go;
    if (t === 'a') { if (CURRENT !== 'a') ABOUT_FROM = CURRENT; }
    if (t === 'm') { MANUAL_FROM = CURRENT; prefillManual(null); }
    go(t);
  });
});

// ---- 1 フレーム ----
var ROWS = 4;
(function () {
  var box = $('rows');
  for (var i = 0; i < ROWS; i++) {
    var d = document.createElement('div'); d.className = 'frow';
    d.innerHTML = '<input class="inp" id="b' + i + '" aria-label="フレーム' + (i + 1) + 'のブランド" placeholder="ブランド（例 JINS）">' +
      '<input class="inp" id="m' + i + '" aria-label="フレーム' + (i + 1) + 'の型番かURL" placeholder="型番か商品ページのURL">';
    box.appendChild(d);
  }
})();
function frameInputs() { var a = []; for (var i = 0; i < ROWS; i++) a.push({ brand: $('b' + i).value, model: $('m' + i).value }); return a; }
$('toPrompt').addEventListener('click', function () {
  var r = PromptBuilder.build(frameInputs(), { withLens: $('withLens').checked });
  if (!r.ok) { $('s1msg').textContent = r.message; return; }
  $('s1msg').textContent = ''; PROMPT_TEXT = r.text; $('prompt').textContent = r.text; $('copiedPrompt').textContent = '';
  go('2');
});
$('copyPrompt').addEventListener('click', function () { copyText(PROMPT_TEXT, $('copiedPrompt'), $('prompt')); });

// ---- 3 貼り付けとチェック ----
var LEVEL_JA = { official: '公式', retailer: '販売店', manual: '手入力', estimate: '推定', not_found: '不明' };
function list(items, cls, tag) {
  if (!items.length) return '';
  return '<ul class="list ' + cls + '">' + items.map(function (x) { return '<li><span class="tag ' + cls + '">' + tag + '</span> ' + esc(x) + '</li>'; }).join('') + '</ul>';
}
function num(v) { return v == null ? '—' : v; }
function renderCheck(r, outEl) {
  var h = '';
  h += r.ok
    ? '<div class="summary ok" role="status">読み込めました。フレーム' + r.frames.filter(function (f) { return f.usable; }).length + '本、レンズ' + r.lensOptions.length + '件。</div>'
    : '<div class="summary ng" role="status">このままでは比較できません。下の内容を修正してください。</div>';
  if (r.errors.length || r.warnings.length) h += '<section class="panel" style="padding:0" aria-label="問題点">' + list(r.errors, 'err', '要修正') + list(r.warnings, 'warn', '要確認') + '</section>';
  if (r.fixPrompt && !r._manual) h += '<div style="display:flex;flex-direction:column;gap:8px"><h2>AIに修正を頼む文</h2><pre id="fix">' + esc(r.fixPrompt) + '</pre><div class="row"><button type="button" class="ghost" id="copyFix">この文をコピーする</button><span class="note" id="copiedFix" role="status"></span></div></div>';
  if (r.frames.length) {
    h += '<h2>フレーム</h2><div class="frames">' + r.frames.map(function (f) {
      var v = f.values, c = f.counts;
      var dims = num(v.lens_width_mm) + '□' + num(v.bridge_mm) + '　縦' + num(v.lens_height_mm) + (v.price_jpy != null ? '　¥' + Number(v.price_jpy).toLocaleString('ja-JP') : '');
      var chips = (c.official ? '<span class="chip c-off">公式 ' + c.official + '</span>' : '') + (c.retailer ? '<span class="chip c-off">販売店 ' + c.retailer + '</span>' : '') + (c.manual ? '<span class="chip c-off">手入力 ' + c.manual + '</span>' : '') + (c.estimate ? '<span class="chip c-est">推定 ' + c.estimate + '</span>' : '') + (c.not_found ? '<span class="chip c-nf">見つからない ' + c.not_found + '</span>' : '') + (f.usable ? '' : '<span class="chip c-bad">計算できない</span>');
      return '<div class="fcard' + (f.usable ? '' : ' bad') + '"><div class="fname">' + esc(f.name) + '</div>' + (f.url ? '<a class="note" href="' + esc(f.url) + '" target="_blank" rel="noopener noreferrer">商品ページを開く</a>' : '') + '<div class="dims">' + esc(dims) + '</div><div class="chips">' + chips + '</div><div class="shape ' + f.shapeNote.kind + '">' + esc(f.shapeNote.text) + '</div></div>';
    }).join('') + '</div>';
  }
  if (r.lensOptions.length) {
    h += '<h2>フレームごとのレンズ</h2><p class="note">選択可否と料金は、AIの回答または入力内容のままです。「開く」から出典ページで確認してください。</p><div class="tbl-wrap"><table><thead><tr><th scope="col">フレーム</th><th scope="col">屈折率</th><th scope="col">設計</th><th scope="col">選べるか</th><th scope="col">追加料金</th><th scope="col">確かさ</th><th scope="col">出典</th></tr></thead><tbody>' + r.lensOptions.map(function (o) {
      var d = DESIGN[o.design] + (o.designEstimated ? '（推定）' : '');
      var av = o.available === false ? '<span class="chip c-bad">選べない</span>' : (o.available === true ? '選べる' : '不明');
      return '<tr><td>' + esc(o.frame) + '</td><td>' + o.index.toFixed(2) + '</td><td>' + esc(d) + '</td><td>' + av + '</td><td>' + (o.extra == null ? '—' : yen(o.extra)) + '</td><td>' + LEVEL_JA[o.level] + '</td><td>' + (o.source ? '<a href="' + esc(o.source) + '" target="_blank" rel="noopener noreferrer">開く</a>' : 'なし') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }
  if (r.infos.length) h += list(r.infos, 'info', '参考');
  outEl.innerHTML = h;
  var cp = $('copyFix'); if (cp) cp.addEventListener('click', function () { copyText(r.fixPrompt, $('copiedFix'), $('fix')); });
}
$('run').addEventListener('click', function () {
  var r = JsonCheck.check($('input').value, new Date());
  renderCheck(r, $('out'));
  LAST = r.ok ? r : null; $('toRx').disabled = !r.ok;
});
$('toRx').addEventListener('click', function () { RX_FROM = '3'; go('4'); });
// 見本のデータ（架空のお店とフレーム）で試す
var SAMPLE_TEXT = /*__SAMPLE_APP__*/'';
$('useSample').addEventListener('click', function () { $('input').value = SAMPLE_TEXT; $('run').click(); });
$('toManualFix').addEventListener('click', function () {
  MANUAL_FROM = '3';
  var r = JsonCheck.check($('input').value, new Date());
  prefillManual(r.frames.length ? r : null); go('m');
});

// ---- 任意 手入力 ----
var MAT = [['metal', 'メタル'], ['titanium', 'チタン'], ['combination', 'コンビ（メタルと樹脂）'], ['plastic', '樹脂']];
var RIM = [['full', 'フルリム'], ['half', 'ハーフリム'], ['rimless', '縁なし']];
var SHAPE = [['wellington', 'ウェリントン'], ['boston', 'ボストン'], ['round', 'ラウンド'], ['square', 'スクエア'], ['oval', 'オーバル'], ['browline', 'ブロー（サーモント）'], ['cat_eye', 'キャットアイ'], ['hexagon', '六角形']];
var CORNER = [['medium', 'ふつう'], ['sharp', '角ばっている'], ['round', '丸い']];
var LIDX = [1.60, 1.67, 1.74, 1.76];
var MCOUNT = 0;
function opts(arr, v) { return arr.map(function (a) { return '<option value="' + a[0] + '"' + (a[0] === v ? ' selected' : '') + '>' + a[1] + '</option>'; }).join(''); }
function mCard(i, p) {
  p = p || {};
  var lens = {}; (p.lenses || []).forEach(function (l) { lens[l.index.toFixed(2)] = l; });
  var d = document.createElement('div'); d.className = 'mcard'; d.dataset.i = i;
  var f = function (id, label, val, req, mode) { return '<label for="' + id + '"><span class="lt">' + label + (req ? '<span class="req">＊</span>' : '') + '</span><input class="inp" id="' + id + '" inputmode="' + (mode || 'decimal') + '" value="' + (val == null ? '' : esc(val)) + '"></label>'; };
  d.innerHTML = '<div class="row" style="justify-content:space-between"><h2>フレーム ' + (i + 1) + '</h2>' + (i >= 2 ? '<button type="button" class="linkbtn" data-del="' + i + '">このフレームを削除</button>' : '') + '</div>' +
    '<div class="mgrid">' + f('mb' + i, 'ブランド', p.brand, false, 'text') + f('mm' + i, '型番', p.model, true, 'text') + f('mpr' + i, '価格 円', p.price) +
    f('mw' + i, '玉型幅 mm', p.w, true) + f('md' + i, 'ブリッジ幅 mm', p.d, true) + f('mh' + i, 'レンズの縦 mm', p.h, true) +
    '<label for="mmat' + i + '"><span class="lt">素材</span><select id="mmat' + i + '">' + opts(MAT, p.material || 'metal') + '</select></label>' +
    '<label for="mrim' + i + '"><span class="lt">リム</span><select id="mrim' + i + '">' + opts(RIM, p.rim || 'full') + '</select></label>' +
    '<label for="mshp' + i + '"><span class="lt">形</span><select id="mshp' + i + '">' + opts(SHAPE, p.shape || 'wellington') + '</select></label>' +
    '<label for="mcor' + i + '"><span class="lt">角の丸さ</span><select id="mcor' + i + '">' + opts(CORNER, p.corner || 'medium') + '</select></label>' +
    f('mrw' + i, 'リムの太さ mm', p.rw) + f('mrd' + i, 'リムの奥行き mm', p.rd) + '</div>' +
    '<div class="mfield">選べるレンズ（選べる屈折率にチェックし、わかる範囲で設計と追加料金を入力）</div>' +
    LIDX.map(function (n) {
      var k = n.toFixed(2), kid = k.replace('.', ''), l = lens[k], on = l ? l.available !== false : (n === 1.60);
      return '<div class="lrow"><label class="row"><input type="checkbox" id="ml' + i + '_' + kid + '"' + (on ? ' checked' : '') + '> ' + k + '</label>' +
        '<select id="mld' + i + '_' + kid + '" aria-label="' + k + 'の設計">' + opts([['aspheric', '片面非球面'], ['double_aspheric', '両面非球面'], ['spherical', '球面']], l ? l.design : (n >= 1.76 ? 'double_aspheric' : 'aspheric')) + '</select>' +
        '<input class="inp" id="mlf' + i + '_' + kid + '" inputmode="numeric" aria-label="' + k + 'の追加料金（円）" placeholder="追加料金 円" value="' + (l && l.extra != null ? l.extra : '') + '"></div>';
    }).join('');
  return d;
}
function prefillManual(r) {
  var box = $('mcards'); box.innerHTML = ''; $('mout').innerHTML = ''; MCOUNT = 0;
  var pre = [];
  if (r && r.frames.length) {
    pre = r.frames.map(function (f) { var v = f.values; return { brand: f.raw.brand, model: f.raw.model || f.raw.input, price: v.price_jpy, w: v.lens_width_mm, d: v.bridge_mm, h: v.lens_height_mm, material: v.material, rim: v.rim_type, shape: v.shape_type, corner: v.corner, rw: v.rim_width_mm, rd: v.rim_depth_mm, lenses: f.lenses }; });
  } else {
    frameInputs().forEach(function (x) { if (x.model.trim()) pre.push({ brand: x.brand, model: x.model }); });
  }
  while (pre.length < 2) pre.push({});
  pre.slice(0, 4).forEach(function (p) { box.appendChild(mCard(MCOUNT++, p)); });
}
$('mcards').addEventListener('click', function (e) { var t = e.target; if (t.dataset && t.dataset.del != null) { t.closest('.mcard').remove(); } });
$('mAdd').addEventListener('click', function () { if ($('mcards').children.length >= 4) return; $('mcards').appendChild(mCard(MCOUNT++, {})); });
$('mBack').addEventListener('click', function () { go(MANUAL_FROM); });
$('aBack').addEventListener('click', function () { go(ABOUT_FROM); });
function val(id) { var el = $(id); if (!el) return null; var s = String(el.value).trim(); if (!s) return null; var n = parseFloat(s.replace(/[,，円¥￥mm]/g, '')); return isFinite(n) ? n : s; }
$('mUse').addEventListener('click', function () {
  var frames = Array.prototype.map.call($('mcards').children, function (card) {
    var i = card.dataset.i, ev = {};
    var o = { _manual: true, brand: $('mb' + i).value.trim() || null, model: $('mm' + i).value.trim() || null,
      lens_width_mm: val('mw' + i), bridge_mm: val('md' + i), lens_height_mm: val('mh' + i), price_jpy: val('mpr' + i),
      material: $('mmat' + i).value, rim_type: $('mrim' + i).value, shape_type: $('mshp' + i).value, corner: $('mcor' + i).value,
      rim_width_mm: val('mrw' + i), rim_depth_mm: val('mrd' + i) };
    ['lens_width_mm', 'bridge_mm', 'lens_height_mm', 'price_jpy', 'rim_width_mm', 'rim_depth_mm'].forEach(function (k) { if (o[k] != null) ev[k] = { level: 'manual', source: null }; });
    o.evidence = ev;
    o.lens_options = LIDX.map(function (n) { var k = n.toFixed(2).replace('.', ''); return { index: n, design: $('mld' + i + '_' + k).value, extra_jpy: val('mlf' + i + '_' + k), available: $('ml' + i + '_' + k).checked, level: 'manual', source: null }; });
    return o;
  });
  var r = JsonCheck.check(JSON.stringify({ checked_on: today(), frames: frames }), new Date());
  r._manual = true;
  if (!r.ok) { renderCheck(r, $('mout')); return; }
  $('mout').innerHTML = ''; LAST = r; RX_FROM = 'm'; go('4');
});

// ---- 4 度数 ----
var pdMode = 'mono';
$('pdMono').addEventListener('click', function () { pdMode = 'mono'; this.setAttribute('aria-pressed', 'true'); $('pdBin').setAttribute('aria-pressed', 'false'); $('pdMonoBox').hidden = false; $('pdBinBox').hidden = true; });
$('pdBin').addEventListener('click', function () { pdMode = 'bin'; this.setAttribute('aria-pressed', 'true'); $('pdMono').setAttribute('aria-pressed', 'false'); $('pdMonoBox').hidden = true; $('pdBinBox').hidden = false; });
$('s4back').addEventListener('click', function () { go(RX_FROM); });
function numIn(id, def) { var v = parseFloat(String($(id).value).replace(/[^\d.\-+]/g, '')); return isFinite(v) ? v : def; }
function readRx() {
  var notes = [];
  function eye(p) {
    var S = numIn(p + 'S', 0), C = numIn(p + 'C', 0), AX = numIn(p + 'A', 180);
    if (C > 0) { S = S + C; C = -C; AX = (AX + 90) % 180; notes.push('乱視がプラス表記だったため、マイナス表記に換算して計算しました。'); }
    if (S > 0 || S + C > 0) notes.push('プラスの度数（遠視など）には対応していないため、マイナスの部分だけで計算しています。');
    return { S: Math.min(0, S), C: Math.min(0, C), AX: ((AX % 180) + 180) % 180 };
  }
  var R = eye('r'), L = eye('l'), rx = { R: R, L: L, notes: notes };
  if (pdMode === 'mono') { rx.PDR = numIn('pdR', 32); rx.PDL = numIn('pdL', 32); rx.PD = rx.PDR + rx.PDL; }
  else { rx.PD = numIn('pdT', 64); }
  if (rx.PD < 50 || rx.PD > 76) { notes.push('両目のPDが' + rx.PD + 'mmになっています。通常は58〜70mm程度なので、値を確認してください。'); }
  ['PDR', 'PDL'].forEach(function (k) { if (rx[k] != null && (rx[k] < 25 || rx[k] > 38)) notes.push((k === 'PDR' ? '右' : '左') + 'のPDが' + rx[k] + 'mmになっています。片目のPDは通常28〜36mm程度です。'); });
  rx.height = Math.max(-10, Math.min(10, numIn('eyeH', 0)));
  return rx;
}

// ---- 5 比較 ----
var DATA = { frames: [], options: [] };
function loadData(r) {
  DATA.frames = r.frames.filter(function (f) { return f.usable; }).map(function (f) {
    var v = f.values;
    var fr = E.frameFromJson({ lens_width_mm: v.lens_width_mm, bridge_mm: v.bridge_mm, lens_height_mm: v.lens_height_mm, material: v.material, rim_type: v.rim_type, shape_type: v.shape_type, corner: v.corner, rim_width_mm: v.rim_width_mm, rim_depth_mm: v.rim_depth_mm });
    fr.name = f.name; fr.price = v.price_jpy; fr.metal = (v.material === 'metal' || v.material === 'titanium'); fr.note = f.shapeNote;
    fr.lenses = f.lenses.filter(function (l) { return l.available !== false; });
    return fr;
  });
  DATA.options = [];
  DATA.frames.forEach(function (fr, fi) {
    var ls = fr.lenses.length ? fr.lenses : LIDX.map(function (n) { return { index: n, design: n >= 1.76 ? 'double_aspheric' : 'aspheric', designEstimated: true, extra: null, available: null }; });
    ls.forEach(function (l) { DATA.options.push({ fi: fi, lens: l }); });
  });
  ['selA', 'selB'].forEach(function (id) { $(id).innerHTML = DATA.options.map(function (o, i) { var fr = DATA.frames[o.fi], l = o.lens; return '<option value="' + i + '">' + esc(fr.name + ' ＋ ' + l.index.toFixed(2) + ' ' + DESIGN[l.design] + (l.available == null ? '（選べるか未確認）' : '')) + '</option>'; }).join(''); });
  function best(fi) { var b = -1; DATA.options.forEach(function (o, i) { if (o.fi === fi && (b < 0 || o.lens.index > DATA.options[b].lens.index)) b = i; }); return b; }
  $('selA').value = String(Math.max(0, best(0))); $('selB').value = String(Math.max(0, best(Math.min(1, DATA.frames.length - 1))));
}
var LOADED = null;
function enterCompare() {
  if (LOADED !== LAST) { loadData(LAST); LOADED = LAST; }
  init3D(); resize(); update();
}
['selA', 'selB'].forEach(function (id) { $(id).addEventListener('change', update); });
var pending = false;
function update() { if (pending) return; pending = true; requestAnimationFrame(function () { pending = false; doUpdate(); }); }
var LASTRESULT = null;
function doUpdate() {
  if (!DATA.options.length) return;
  var rx = readRx(), pick = {};
  ['A', 'B'].forEach(function (k) { var o = DATA.options[+$('sel' + k).value] || DATA.options[0]; pick[k] = { fr: DATA.frames[o.fi], lens: o.lens }; });
  var st = {};
  ['A', 'B'].forEach(function (k) {
    var p = pick[k];
    st[k] = { R: E.edgeStats(p.fr, p.lens.index, p.lens.design, 'R', rx), L: E.edgeStats(p.fr, p.lens.index, p.lens.design, 'L', rx) };
    st[k].max = Math.max(st[k].R.max, st[k].L.max);
  });
  CUR = { A: pick.A, B: pick.B, rx: rx };
  var pr = E.powerRange(rx), mixed = pick.A.lens.index !== pick.B.lens.index;
  var v = E.verdict(st.A.max, st.B.max, { mixed: mixed, outOfRange: pr.noVerdict }), el = $('verdict');
  var detail = 'いちばん厚い部分は A ' + f1(st.A.max) + 'mm、B ' + f1(st.B.max) + 'mm です（左右のうち厚い方の目で比較）';
  var vt;
  if (v.result === 'out_of_range') { el.className = 'verdict v-u'; vt = '度数が強く、計算の精度を確かめた範囲を大きく超えるため、判定は表示しません'; el.innerHTML = vt + '<small>' + detail + '。数値は参考程度にご覧ください。</small>'; }
  else if (v.result === 'undecided') { el.className = 'verdict v-u'; vt = '形のずれの範囲内なので、どちらが薄いかは判断できません'; el.innerHTML = vt + '<small>' + detail + '。差が小さいため、形の近似や計算の誤差で結果が逆になる可能性があります。</small>'; }
  else { el.className = 'verdict ' + (v.result === 'A_thinner' ? 'v-a' : 'v-b'); vt = (v.result === 'A_thinner' ? 'A' : 'B') + 'の方が薄くなる見込みです'; el.innerHTML = vt + '<small>' + detail + '</small>'; }
  // 表
  var rows = [], cols = ['tem', 'nas', 'top', 'bot', 'max', 'pro'];
  [['L', '左目'], ['R', '右目']].forEach(function (e) {
    var pd = E.monoPD(rx, e[0]);
    rows.push('<tr class="grp"><td colspan="7">' + e[1] + '（S ' + rx[e[0]].S.toFixed(2) + ' / C ' + rx[e[0]].C.toFixed(2) + ' / AX ' + rx[e[0]].AX + ' / 片目PD ' + pd.toFixed(1) + '）</td></tr>');
    ['A', 'B'].forEach(function (k) {
      var s = st[k][e[0]], p = pick[k], rimEst = p.fr.estimated.indexOf('rim_depth_mm') >= 0;
      rows.push('<tr><td class="t' + k.toLowerCase() + '"><span class="sw s' + k.toLowerCase() + '" aria-hidden="true"></span>' + k + '</td>' + cols.map(function (c) {
        if (c === 'pro' && s.pro == null) return '<td>対象外</td>';
        var cls = (c === 'pro' && rimEst) || !s.calibrated || pr.extrapolated ? ' class="est"' : '';
        return '<td' + cls + '>' + f1(s[c]) + '</td>';
      }).join('') + '</tr>');
    });
  });
  $('tbody').innerHTML = rows.join('');
  $('price').innerHTML = ['A', 'B'].map(function (k) { var p = pick[k], tot = (p.fr.price != null && p.lens.extra != null) ? p.fr.price + p.lens.extra : null; return '<tr><td>' + k + '</td><td>' + yen(p.fr.price) + '</td><td>' + (p.lens.extra == null ? '未確認' : yen(p.lens.extra)) + '</td><td>' + (tot == null ? '未確定' : yen(tot)) + '</td></tr>'; }).join('');
  // 注意点
  var cs = [];
  ['A', 'B'].forEach(function (k) {
    var p = pick[k], n = p.fr.note;
    cs.push({ strong: n.kind !== 'ok', t: k + '（' + p.fr.name + '）の' + n.text + (n.kind === 'ok' ? '実物の形と違う場合、縁の厚みも変わります。' : '') });
    if (p.fr.estimated.indexOf('rim_depth_mm') >= 0) cs.push({ t: k + ' のリムの奥行きは公表されていないため、素材から' + p.fr.rimD + 'mmと推定しました。はみ出しの値は推定値です。' });
    if (!E.calibration(p.lens.index).calibrated) cs.push({ t: k + ' の屈折率' + p.lens.index.toFixed(2) + 'はメーカーの厚み表で検証していないため、精度が下がります。' });
    if (p.lens.designEstimated) cs.push({ t: k + ' のレンズ設計は不明なため、' + DESIGN[p.lens.design] + 'と仮定して計算しています。' });
    if (p.lens.available == null) cs.push({ t: k + ' のレンズがこのフレームで選べるかは確認できていません。' });
  });
  if (pr.noVerdict) cs.push({ strong: true, t: '度数（' + pr.worst.toFixed(2) + '）が、メーカーの厚み表で精度を確かめた範囲（−6.00まで）を大きく超えています。数値は参考程度にご覧ください。' });
  else if (pr.extrapolated) cs.push({ strong: true, t: '度数（' + pr.worst.toFixed(2) + '）が、メーカーの厚み表で精度を確かめた範囲（−6.00まで）を超えています。誤差が大きくなる可能性があります。' });
  if (mixed && v.result !== 'out_of_range') cs.push({ t: '屈折率が異なる組み合わせのため、判定の基準を少し厳しくしています。' });
  if (rx.height === 0) cs.push({ t: '黒目の位置はレンズの上下中央と仮定しています。お店で測った黒目の高さを度数の画面で入力すると、上下の厚みがより正確になります。' });
  rx.notes.forEach(function (n) { cs.push({ strong: true, t: n }); });
  cs.push({ t: 'レンズ中心の厚みは、1.60と1.67を1.1mm、1.74と1.76を1.0mmとしています。実際の値はお店によって異なる場合があります。' });
  cs.push({ t: '両面非球面の効果は、比べられる厚みの表が見つからなかったため、控えめに見積もった推定値です。' });
  var seen = {};
  cs = cs.filter(function (c) { if (seen[c.t]) return false; seen[c.t] = 1; return true; });
  $('cautions').innerHTML = cs.map(function (c) { return '<li' + (c.strong ? ' class="strong"' : '') + '>' + esc(c.t) + '</li>'; }).join('');
  $('chips').innerHTML = '<span>情報の確かさ</span><span class="chip c-fact">寸法 AIの回答または手入力</span><span class="chip c-cal">厚みの計算 メーカー表で検証済み</span><span class="chip c-est">レンズの形 近似</span><span class="chip c-est">リムの奥行き 推定を含む</span>';
  $('capA').textContent = 'A ' + pick.A.fr.name + ' ＋ ' + pick.A.lens.index.toFixed(2); $('capB').textContent = 'B ' + pick.B.fr.name + ' ＋ ' + pick.B.lens.index.toFixed(2);
  if (gl && VA) {
    setGroup(VA, buildGlasses(pick.A.fr, pick.A.lens, rx)); setGroup(VB, buildGlasses(pick.B.fr, pick.B.lens, rx));
    var g = new THREE.Group(); OVER.A = buildOverlay(pick.A.fr, pick.A.lens, rx, new THREE.Color(css('--a3d')).getHex(), true); OVER.B = buildOverlay(pick.B.fr, pick.B.lens, rx, new THREE.Color(css('--b3d')).getHex(), false); g.add(OVER.A); g.add(OVER.B);
    // 重ねる表示は左目だけを、黒目の位置でそろえて拡大（厚み方向はさらに3倍）
    var SC = 2.4; g.scale.set(SC, SC, SC * 3); g.position.set(-E.monoPD(rx, 'L') * SC, -(rx.height || 0) * SC, 0);
    setGroup(VO, g); applyShow();
  }
  if (mode === 'sec') drawSection();
  LASTRESULT = { pick: pick, st: st, verdict: vt, detail: detail, cautions: cs, rx: rx };
}
['rS', 'rC', 'rA', 'lS', 'lC', 'lA', 'pdR', 'pdL', 'pdT', 'eyeH'].forEach(function (id) { $(id).addEventListener('input', function () { if (CURRENT === '5') update(); }); });

// ---- 結果を画像で保存（端末にダウンロードするだけ。どこにも送らない） ----
$('saveImg').addEventListener('click', function () {
  if (!LASTRESULT) return;
  var R = LASTRESULT, W = 1080, pad = 48, c = document.createElement('canvas'), x = c.getContext('2d');
  drawSection();
  var secC = $('sec'), secH = Math.round((W - pad * 2) * secC.height / secC.width);
  var lines = [];
  c.width = W; c.height = 1500 + secH;
  x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, W, c.height);
  var y = pad + 10;
  function t(s, size, color, bold) { x.font = (bold ? 'bold ' : '') + size + 'px Meiryo, "Hiragino Sans", sans-serif'; x.fillStyle = color || '#1E2733'; x.fillText(s, pad, y); y += Math.round(size * 1.7); }
  function wrap(s, size, color, bold) { x.font = (bold ? 'bold ' : '') + size + 'px Meiryo, "Hiragino Sans", sans-serif'; var line = ''; for (var i = 0; i < s.length; i++) { var tt = line + s[i]; if (x.measureText(tt).width > W - pad * 2) { t(line, size, color, bold); line = s[i]; } else line = tt; } if (line) t(line, size, color, bold); }
  t('レンズ厚みくらべ　' + today(), 26, '#5B6675');
  wrap('A　' + R.pick.A.fr.name + ' ＋ ' + R.pick.A.lens.index.toFixed(2) + ' ' + DESIGN[R.pick.A.lens.design], 30, '#2F6FC4', true);
  wrap('B　' + R.pick.B.fr.name + ' ＋ ' + R.pick.B.lens.index.toFixed(2) + ' ' + DESIGN[R.pick.B.lens.design], 30, '#1E2733', true);
  y += 10; wrap(R.verdict, 36, '#1E2733', true); wrap(R.detail, 24, '#5B6675');
  y += 10;
  [['L', '左目'], ['R', '右目']].forEach(function (e) {
    t(e[1] + '　耳側 / 鼻側 / 最大 / はみ出し（単位 mm）', 24, '#5B6675');
    ['A', 'B'].forEach(function (k) { var s = R.st[k][e[0]]; t(k + '　' + [s.tem, s.nas, s.max].map(f1).join(' / ') + ' / ' + (s.pro == null ? '対象外' : f1(s.pro)), 28, '#1E2733'); });
  });
  y += 10; x.drawImage(secC, pad, y, W - pad * 2, secH); y += secH + 30;
  t('注意点', 26, '#1E2733', true);
  R.cautions.slice(0, 6).forEach(function (cc) { wrap('・' + cc.t, 22, '#1E2733', cc.strong); });
  y += 10; wrap('厚みは計算による目安です。購入前にお店で確認してください。このアプリは入力内容を保存・送信しません。', 20, '#5B6675');
  var out = document.createElement('canvas'); out.width = W; out.height = Math.min(c.height, y + pad); out.getContext('2d').drawImage(c, 0, 0);
  try {
    out.toBlob(function (b) {
      if (!b) { $('saveMsg').textContent = 'この環境では画像を保存できませんでした。'; return; }
      var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'lens-compare-' + today() + '.png'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
      $('saveMsg').textContent = '画像を保存しました。保存されない場合は、ブラウザのダウンロード設定を確認してください。';
    }, 'image/png');
  } catch (e) { $('saveMsg').textContent = 'この環境では画像を保存できませんでした。'; }
});

// ---- 起動 ----
if (window.LENS_DEMO) {
  // デモ表示：見本データと見本の度数を入れて、結果画面から始める
  LAST = JsonCheck.check(SAMPLE_TEXT, new Date());
  $('rS').value = '-5.00'; $('rC').value = '-0.50'; $('rA').value = '180';
  $('lS').value = '-5.50'; $('lC').value = '-0.75'; $('lA').value = '170';
  RX_FROM = '3'; $('input').value = SAMPLE_TEXT; renderCheck(LAST, $('out')); $('toRx').disabled = false;
  var demo = document.createElement('p'); demo.className = 'where'; demo.style.background = 'var(--highlight)';
  demo.textContent = 'デモ表示です。架空のお店とフレームの見本データと、見本の度数で計算しています。';
  $('s5').insertBefore(demo, $('s5').firstChild);
  go('5');
} else {
  go('1');
}
