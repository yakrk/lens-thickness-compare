/*
 * lens-engine.js
 * レンズ厚みくらべ の計算部分。画面やネットワークには一切触れない純粋な計算だけを置く。
 * 何も保存しない。入力はすべて引数で受け取り、結果は戻り値で返す。
 *
 * 座標系
 *   x は装用者から見て右がプラス、y は上がプラス、単位 mm。
 *   レンズ輪郭は「耳側がプラス」のローカル座標で作り、toWorld で目ごとに左右反転する。
 */
(function (root) {
  'use strict';

  // ---- 較正値 ---------------------------------------------------------------
  // 公開されている厚みの表で較正（出典は README.md と docs/DECISIONS.md）
  // 1.60/1.67/1.74 はアイベリーの厚み比較表の非球面の行から各9点（度数 -4/-5/-6 × 中心から 25/30/35mm）
  //   最大の誤差 1.60 0.10mm、1.67 0.06mm、1.74 0.04mm。中心厚は同じ表の値
  // 1.76 はれんず屋に載っている東海光学 ZX-AS 1.76 のフチ厚 3点（-2/-4/-6、径 75mm）で最大の誤差 0.02mm
  //   1.76 の中心厚は公表値がないため 1.74 と同じ 1.0mm と仮定
  var CAL = {
    '1.60': { ct: 1.1, f: 0.962, calibrated: true },
    '1.67': { ct: 1.1, f: 0.966, calibrated: true },
    '1.74': { ct: 1.0, f: 1.003, calibrated: true },
    '1.76': { ct: 1.0, f: 0.931, calibrated: true }
  };
  var DAS_F = 0.90;          // 両面非球面の上乗せ効果（推定）
  var SETBACK = 0.4;         // レンズ前面がリム前面から奥に入る量（推定）
  var VERDICT_MM = 0.2;      // これ未満の差は「形のずれの範囲内」とする
  var VERDICT_MM_MIXED = 0.3; // 屈折率が違う同士を比べるときは較正誤差も足して広げる
  var CAL_RANGE = { min: -6.0, noVerdict: -8.0 }; // 厚み表で較正した度数の範囲（これより強いと外挿）

  // ---- 形の種類 → 描画用の数値 ---------------------------------------------
  // approx: 'ok' 形の種類として再現できる / 'partial' 再現できない特徴がある
  var SHAPE_PRESETS = {
    wellington: { pTop: 3.6, pBot: 2.8, tap: 0.10, approx: 'ok' },
    boston:     { pTop: 3.0, pBot: 2.2, tap: 0.18, approx: 'ok' },
    round:      { pTop: 2.0, pBot: 2.0, tap: 0.00, approx: 'ok' },
    square:     { pTop: 4.5, pBot: 4.0, tap: 0.03, approx: 'ok' },
    oval:       { pTop: 2.4, pBot: 2.4, tap: 0.04, approx: 'ok' },
    browline:   { pTop: 4.2, pBot: 2.6, tap: 0.12, approx: 'ok' },
    cat_eye:    { pTop: 3.8, pBot: 2.4, tap: 0.22, approx: 'partial', missing: '目尻の跳ね上がり' },
    hexagon:    { pTop: 3.0, pBot: 3.0, tap: 0.05, approx: 'partial', missing: '直線の辺と角' }
  };
  var CORNER_ADJ = { sharp: 0.6, medium: 0, round: -0.6 };

  // 素材ごとの既定値（AIが null を返したとき、推定として使う）
  var RIM_DEFAULTS = {
    metal:       { depth: 2.4, width: 1.8 },
    titanium:    { depth: 2.2, width: 1.5 },
    combination: { depth: 3.4, width: 2.5 },
    plastic:     { depth: 4.5, width: 3.5 }
  };

  function round2(v) { return Math.round(v * 100) / 100; }

  // 形の種類と角の丸さから描画用の数値を返す
  function shapeParams(shapeType, corner) {
    var known = Object.prototype.hasOwnProperty.call(SHAPE_PRESETS, shapeType);
    var base = known ? SHAPE_PRESETS[shapeType] : SHAPE_PRESETS.wellington;
    var adj = Object.prototype.hasOwnProperty.call(CORNER_ADJ, corner) ? CORNER_ADJ[corner] : 0;
    return {
      pTop: Math.max(2, base.pTop + adj),
      pBot: Math.max(2, base.pBot + adj),
      tap: base.tap,
      approx: known ? base.approx : 'unknown',
      missing: known ? (base.missing || null) : null,
      shapeType: known ? shapeType : 'wellington'
    };
  }

  // 屈折率ごとの較正値。較正していない屈折率は最も近い値を借り、係数1.0で「較正なし」とする
  function calibration(n) {
    var key = n.toFixed(2);
    if (CAL[key]) return { ct: CAL[key].ct, f: CAL[key].f, calibrated: true };
    var keys = Object.keys(CAL), best = keys[0];
    keys.forEach(function (k) { if (Math.abs(+k - n) < Math.abs(+best - n)) best = k; });
    return { ct: CAL[best].ct, f: 1.0, calibrated: false };
  }

  // ---- レンズ輪郭 -----------------------------------------------------------
  function rawPt(s, phi) {
    var c = Math.cos(phi), sn = Math.sin(phi);
    var top = sn >= 0, temporal = c >= 0;
    var p = top ? s.pTop : s.pBot; if (top && temporal) p += 0.6;
    var x = Math.sign(c) * Math.pow(Math.abs(c), 2 / p), y = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / p);
    if (temporal) x *= 1 + s.tap * y;
    y += 0.04 * (-x) * (y > 0 ? 1 : 0);
    return [x, y];
  }

  // 360点の輪郭を、玉型幅 A × 縦 B の箱にぴったり合わせて返す
  function outline(frame) {
    var N = 360, raw = [], x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (var j = 0; j < N; j++) {
      var p = rawPt(frame.shape, j / N * 2 * Math.PI); raw.push(p);
      x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
    }
    var sx = frame.A / (x1 - x0), sy = frame.B / (y1 - y0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    return raw.map(function (q) { return [(q[0] - mx) * sx, (q[1] - my) * sy]; });
  }

  // ---- 厚みの計算 -----------------------------------------------------------
  function sag(c, k, r) {
    if (c === 0) return 0;
    var q = 1 - (1 + k) * c * c * r * r;
    return c * r * r / (1 + Math.sqrt(Math.max(q, 1e-9)));
  }

  // frame: {A, DBL, B, shape}, n: 屈折率, design: 'aspheric'|'double_aspheric', eye: 'R'|'L'
  // rx: {R:{S,C,AX}, L:{S,C,AX}, PD, PDR, PDL, height}
  //   PDR/PDL は片眼PD（あれば優先）。height は黒目がレンズの上下中央より何mm上か（既定0）
  function monoPD(rx, eye) {
    var v = eye === 'R' ? rx.PDR : rx.PDL;
    return (typeof v === 'number' && isFinite(v)) ? v : rx.PD / 2;
  }
  function lensModel(frame, n, design, eye, rx) {
    var ns = eye === 'R' ? 1 : -1;
    var cx = -ns * (frame.DBL / 2 + frame.A / 2);
    var dec = (frame.A + frame.DBL) / 2 - monoPD(rx, eye), ocx = cx + ns * dec;
    var ocy = (typeof rx.height === 'number' && isFinite(rx.height)) ? rx.height : 0;
    var p = rx[eye], th = p.AX * Math.PI / 180, se = p.S + p.C / 2;
    var cal = calibration(n);
    var fac = cal.f * (design === 'double_aspheric' ? DAS_F : 1);
    var vogel = Math.max(1, 4 + se / 2) * (n - 1) / 0.53;
    var Bf = Math.max(0.3, vogel - 2.25);
    var kf = 15, kb = 0;
    var cf = Bf / (1000 * (n - 1));
    function thick(x, y) {
      var dx = x - ocx, dy = y - ocy, r = Math.hypot(dx, dy);
      if (r < 1e-6) return cal.ct;
      var phi = Math.atan2(dy, dx);
      var P = p.S + p.C * Math.pow(Math.sin(phi - th), 2);
      var cb = (Bf - P) / (1000 * (n - 1));
      return cal.ct + fac * (sag(cb, kb, r) - sag(cf, kf, r));
    }
    function zf(x, y) { return -sag(cf, kf, Math.hypot(x - ocx, y - ocy)); }
    function toWorld(lx, ly) { return [cx - ns * lx, ly]; }
    return { cx: cx, ns: ns, ocx: ocx, ocy: ocy, thick: thick, zf: zf, toWorld: toWorld, calibrated: cal.calibrated };
  }

  // 縁の厚み（耳側、鼻側、上、下、最大）と、リムの後ろへのはみ出し
  function edgeStats(frame, n, design, eye, rx) {
    var m = lensModel(frame, n, design, eye, rx), t = outline(frame);
    var tem = { k: -1e9 }, nas = { k: -1e9 }, top = { k: -1e9 }, bot = { k: 1e9 }, mx = 0;
    t.forEach(function (q) {
      var w = m.toWorld(q[0], q[1]), th = m.thick(w[0], w[1]);
      if (q[0] > tem.k) tem = { k: q[0], t: th };
      if (-q[0] > nas.k) nas = { k: -q[0], t: th };
      if (q[1] > top.k) top = { k: q[1], t: th };
      if (q[1] < bot.k) bot = { k: q[1], t: th };
      mx = Math.max(mx, th);
    });
    var pro = frame.rimType === 'rimless' ? null : Math.max(0, mx - (frame.rimD - SETBACK));
    return { tem: tem.t, nas: nas.t, top: top.t, bot: bot.t, max: mx, pro: pro, calibrated: m.calibrated };
  }

  // A と B の最大の厚みを比べる。差がしきい値未満なら判断しない
  // opts.mixed: 屈折率が違う組み合わせ、opts.outOfRange: 較正範囲を大きく外れる度数
  function verdict(maxA, maxB, opts) {
    opts = opts || {};
    if (opts.outOfRange) return { result: 'out_of_range' };
    var th = opts.mixed ? VERDICT_MM_MIXED : VERDICT_MM;
    var d = maxA - maxB;
    if (Math.abs(d) < th) return { result: 'undecided' };
    return { result: d > 0 ? 'B_thinner' : 'A_thinner' };
  }

  // 度数が較正範囲に入っているか（各目の強い方の経線の度数で見る）
  function powerRange(rx) {
    var worst = 0;
    ['R', 'L'].forEach(function (e) { var p = rx[e]; worst = Math.min(worst, p.S, p.S + p.C); });
    return { worst: worst, extrapolated: worst < CAL_RANGE.min, noVerdict: worst < CAL_RANGE.noVerdict };
  }

  // AIのJSON（1フレーム分）を計算用の形に変える。補った値は estimated に記録する
  function frameFromJson(f) {
    var estimated = [];
    var mat = RIM_DEFAULTS[f.material] ? f.material : 'metal';
    if (!RIM_DEFAULTS[f.material]) estimated.push('material');
    var rimD = f.rim_depth_mm, rimW = f.rim_width_mm;
    if (rimD == null) { rimD = RIM_DEFAULTS[mat].depth; estimated.push('rim_depth_mm'); }
    if (rimW == null) { rimW = RIM_DEFAULTS[mat].width; estimated.push('rim_width_mm'); }
    if (f.shape_type == null) estimated.push('shape_type');
    var shape = shapeParams(f.shape_type, f.corner);
    return {
      A: f.lens_width_mm, DBL: f.bridge_mm, B: f.lens_height_mm,
      rimD: rimD, rimW: rimW, rimType: f.rim_type || 'full',
      shape: shape, estimated: estimated
    };
  }

  var api = {
    CAL: CAL, DAS_F: DAS_F, SETBACK: SETBACK, VERDICT_MM: VERDICT_MM, VERDICT_MM_MIXED: VERDICT_MM_MIXED, CAL_RANGE: CAL_RANGE, powerRange: powerRange, monoPD: monoPD,
    SHAPE_PRESETS: SHAPE_PRESETS, CORNER_ADJ: CORNER_ADJ, RIM_DEFAULTS: RIM_DEFAULTS,
    shapeParams: shapeParams, calibration: calibration, outline: outline, sag: sag,
    lensModel: lensModel, edgeStats: edgeStats, verdict: verdict, frameFromJson: frameFromJson,
    round2: round2
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LensEngine = api;
})(typeof self !== 'undefined' ? self : this);
