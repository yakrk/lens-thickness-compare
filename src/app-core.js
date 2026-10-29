/* app-core.js  画面全体で使う小さな道具 */
var $ = function (id) { return document.getElementById(id); };
var E = LensEngine;
function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
var DESIGN = { spherical: '球面', aspheric: '片面非球面', double_aspheric: '両面非球面' };
function f1(v) { return v == null ? '—' : v.toFixed(1); }
function yen(v) { return v == null ? '—' : '¥' + Number(v).toLocaleString('ja-JP'); }
function today() { var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
// 3D が使えないときの表示
function show3DFallback() {
  ['stSide', 'stOver'].forEach(function (id) {
    var st = $(id); if (!st || st.querySelector('.nogl')) return;
    Array.prototype.forEach.call(st.querySelectorAll('canvas'), function (c) { c.hidden = true; });
    var n = document.createElement('p'); n.className = 'note nogl'; n.style.padding = '40px 16px 16px';
    n.textContent = glWhy === 'load' ? '3D表示の部品を読み込めませんでした。インターネットにつながった状態で開き直してください。数字と断面は使えます。' : 'この端末では3D表示が使えません。数字と断面は使えます。';
    st.appendChild(n);
  });
}
// コピー（クリップボードが使えないときは選択だけする）
function copyText(text, msgEl, preEl) {
  function sel() { var r = document.createRange(); r.selectNodeContents(preEl); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); msgEl.textContent = '選択しました。長押しかCtrl+Cでコピーしてください'; }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { msgEl.textContent = 'コピーしました'; }, sel); else sel();
}
