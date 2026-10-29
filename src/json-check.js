/*
 * json-check.js
 * AIが返した文章からJSONを取り出し、形式と値の範囲をチェックする。
 * 何も保存しない。通信しない。
 *
 * 戻り値 { ok, errors[], warnings[], infos[], frames[], lensOptions[], fixPrompt }
 *   errors   … 計算できない問題（貼り直しが必要）
 *   warnings … 計算はできるが、値が怪しい／推定に下げたもの
 *   infos    … 知っておいてほしいこと
 */
(function (root) {
  'use strict';

  var ENUMS = {
    material: ['metal', 'plastic', 'combination', 'titanium'],
    rim_type: ['full', 'half', 'rimless'],
    shape_type: ['wellington', 'boston', 'round', 'square', 'oval', 'browline', 'cat_eye', 'hexagon'],
    corner: ['sharp', 'medium', 'round'],
    design: ['spherical', 'aspheric', 'double_aspheric'],
    level: ['official', 'retailer', 'manual', 'estimate', 'not_found']
  };
  var LABEL = {
    lens_width_mm: '玉型幅', bridge_mm: 'ブリッジ幅', lens_height_mm: 'レンズの縦', temple_mm: 'テンプル',
    rim_width_mm: 'リムの太さ', rim_depth_mm: 'リムの奥行き', price_jpy: '価格', extra_jpy: '追加料金',
    material: '素材', rim_type: 'リムの種類', shape_type: '形の種類', corner: '角の丸さ', design: 'レンズの設計', index: '屈折率'
  };
  var RANGE = {
    lens_width_mm: [40, 62], bridge_mm: [12, 26], lens_height_mm: [25, 60], temple_mm: [120, 160],
    rim_width_mm: [0.5, 6], rim_depth_mm: [1, 8], price_jpy: [1000, 200000], extra_jpy: [0, 50000]
  };
  var REQUIRED = ['lens_width_mm', 'bridge_mm', 'lens_height_mm'];
  var INDEXES = [1.50, 1.55, 1.60, 1.67, 1.70, 1.74, 1.76];
  var CALIBRATED = [1.60, 1.67, 1.74, 1.76];
  var MAX_FRAMES = 4;
  var SHAPE_JA = { wellington: 'ウェリントン', boston: 'ボストン', round: 'ラウンド', square: 'スクエア', oval: 'オーバル', browline: 'ブロー', cat_eye: 'キャットアイ', hexagon: '六角形' };
  // プロンプトの例の値。AIが調べずに写した可能性を見つけるために使う
  var EXAMPLE = { lens_width_mm: 54, bridge_mm: 18, lens_height_mm: 41, temple_mm: 145, price_jpy: 19900 };
  var STALE_DAYS = 90;

  // 文章の中からJSON部分を取り出す（```json の囲みや前後の説明文があっても読む）
  function extractJson(text) {
    var notes = [];
    var t = String(text || '').trim();
    var fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) { if (t.replace(fence[0], '').trim()) notes.push('JSONの前後にある説明文は読み飛ばしました。'); t = fence[1].trim(); }
    var a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b < a) return { json: null, notes: notes };
    if (a > 0 || b < t.length - 1) notes.push('JSONの前後にある説明文は読み飛ばしました。');
    return { json: t.slice(a, b + 1), notes: notes };
  }

  // JSON.parse のエラー位置を「何行目」に直す
  function parseError(src, err) {
    var m = String(err.message).match(/position (\d+)/), line = null;
    if (m) line = src.slice(0, +m[1]).split('\n').length;
    return line ? line + '行目付近で形式が崩れています。' : '書式が崩れているため、JSONとして読み取れません。';
  }

  // "54mm" や "29,900円" のような文字を数値として読む
  function toNumber(v) {
    if (typeof v === 'number' && isFinite(v)) return { value: v, coerced: false };
    if (typeof v === 'string') {
      var s = v.replace(/[,，\s]/g, '').replace(/(mm|ｍｍ|円|¥|￥|yen)/gi, '');
      if (/^-?\d+(\.\d+)?$/.test(s)) return { value: parseFloat(s), coerced: true };
    }
    return null;
  }

  function daysBetween(a, b) { return Math.round((b - a) / 86400000); }

  function check(text, today) {
    today = today || new Date();
    var R = { ok: false, errors: [], warnings: [], infos: [], frames: [], lensOptions: [], fixPrompt: '' };
    var fixes = [];

    var ex = extractJson(text);
    ex.notes.forEach(function (n) { R.infos.push(n); });
    if (!ex.json) {
      R.errors.push('JSONが見つかりません。AIの回答をそのまますべて貼り付けてください。');
      fixes.push('指定の形式のJSONだけをコードブロックで返してください。');
      R.fixPrompt = buildFix(fixes); return R;
    }
    var data;
    try { data = JSON.parse(ex.json); }
    catch (e) {
      R.errors.push(parseError(ex.json, e));
      fixes.push('JSONの書式が崩れています。カッコや引用符、カンマを見直して、正しいJSONだけを返し直してください。');
      R.fixPrompt = buildFix(fixes); return R;
    }

    // 調べた日
    if (data.checked_on) {
      var d = new Date(data.checked_on);
      if (!isNaN(d)) {
        var age = daysBetween(d, today);
        if (age > STALE_DAYS) R.warnings.push('調べた日が' + age + '日前です。価格や在庫が変わっている可能性があります。');
      }
    } else {
      R.infos.push('調べた日（checked_on）がありません。価格は最新でない可能性があります。');
    }

    // フレーム
    var frames = Array.isArray(data.frames) ? data.frames : [];
    if (!frames.length) {
      R.errors.push('フレームの情報（frames）がありません。');
      fixes.push('frames にフレームの情報を入れて返し直してください。');
    }
    if (frames.length > MAX_FRAMES) {
      R.warnings.push('フレームが' + frames.length + '本あります。比較できるのは' + MAX_FRAMES + '本までなので、最初の' + MAX_FRAMES + '本だけ使います。');
      frames = frames.slice(0, MAX_FRAMES);
    }

    // レンズ1件を読む（フレームごと）
    function parseLens(o, frameName, frameBrand) {
      o = o || {};
      var label = frameName + ' の ' + (o.index != null ? o.index : '?');
      var idx = toNumber(o.index);
      if (!idx || INDEXES.indexOf(Math.round(idx.value * 100) / 100) < 0) {
        R.warnings.push('レンズ「' + label + '」の屈折率は対応していない値のため、使用しません。');
        fixes.push(frameName + ' の lens_options の index は ' + INDEXES.map(function (x) { return x.toFixed(2); }).join('、') + ' のどれかにしてください（今は「' + o.index + '」）。');
        return null;
      }
      var n = Math.round(idx.value * 100) / 100;
      var off = o.available === false;
      var design = ENUMS.design.indexOf(o.design) >= 0 ? o.design : null;
      if (!design && !off) R.warnings.push('レンズ「' + label + '」の設計が不明なため、1.76は両面非球面、それ以外は片面非球面と仮定して計算します。');
      var fee = o.extra_jpy == null ? null : toNumber(o.extra_jpy);
      if (!off && fee && (fee.value < 0 || fee.value > 50000)) {
        R.warnings.push('レンズ「' + label + '」の追加料金が ' + fee.value + '円になっています。正しいか確認してください。');
        fixes.push(frameName + ' の ' + n.toFixed(2) + ' の extra_jpy が ' + fee.value + ' になっています。公式サイトの値を確かめ直してください。');
      }
      if (!off && CALIBRATED.indexOf(n) < 0) R.infos.push('屈折率' + n.toFixed(2) + 'はメーカーの厚み表で検証していないため、精度が下がります。');
      var src = /^https?:\/\//.test(o.source || '') ? o.source : null;
      var lvl = ENUMS.level.indexOf(o.level) >= 0 ? o.level : 'estimate';
      if ((lvl === 'official' || lvl === 'retailer') && !src) lvl = 'estimate';
      var avail = o.available === false ? false : (o.available === true ? true : null);
      return { frame: frameName, brand: o.brand || frameBrand || null, index: n, design: design || (n >= 1.76 ? 'double_aspheric' : 'aspheric'), designEstimated: !design, extra: fee ? fee.value : null, available: avail, source: src, level: lvl };
    }
    var topLenses = Array.isArray(data.lens_options) ? data.lens_options : [];

    frames.forEach(function (f, i) {
      f = f || {};
      var name = [f.brand, f.model].filter(Boolean).join(' ') || ('フレーム' + (i + 1));
      var out = { url: /^https?:\/\//.test(f.url || '') ? f.url : null, name: name, raw: f, values: {}, usable: true, problems: [], counts: { official: 0, retailer: 0, manual: 0, estimate: 0, not_found: 0 } };

      // 数値の項目
      Object.keys(RANGE).forEach(function (key) {
        if (key === 'extra_jpy') return;
        var v = f[key];
        if (v === null || v === undefined) {
          if (REQUIRED.indexOf(key) >= 0) {
            out.usable = false;
            out.problems.push(LABEL[key] + 'がありません。');
            R.errors.push(name + ' の' + LABEL[key] + 'がないため、このフレームは計算できません。');
            fixes.push(name + ' の ' + key + '（' + LABEL[key] + '）を公式サイトで探して入れてください。');
          }
          out.values[key] = null; return;
        }
        var num = toNumber(v);
        if (!num) {
          if (REQUIRED.indexOf(key) >= 0) { out.usable = false; R.errors.push(name + ' の' + LABEL[key] + 'を数値として読めないため、このフレームは計算できません。'); }
          out.values[key] = null;
          R.warnings.push(name + ' の' + LABEL[key] + '「' + v + '」を数値として読み取れませんでした。');
          fixes.push(name + ' の ' + key + ' は数字だけで返してください（今は「' + v + '」）。');
          return;
        }
        if (num.coerced) R.infos.push(name + ' の' + LABEL[key] + '「' + v + '」を ' + num.value + ' として読みました。');
        var rg = RANGE[key];
        if (num.value < rg[0] || num.value > rg[1]) {
          var hint = '';
          if (num.value * 10 >= rg[0] && num.value * 10 <= rg[1]) hint = '（' + (num.value * 10) + 'の書き間違いの可能性があります）';
          R.warnings.push(name + ' の' + LABEL[key] + 'が ' + num.value + ' になっています。通常は' + rg[0] + '〜' + rg[1] + '程度です' + hint + '。');
          fixes.push(name + ' の ' + key + ' が ' + num.value + ' になっています。通常は' + rg[0] + '〜' + rg[1] + '程度なので、公式サイトの値を確認し直してください。');
          if (REQUIRED.indexOf(key) >= 0) { out.usable = false; out.problems.push(LABEL[key] + 'が範囲外です。'); R.errors.push(name + ' の' + LABEL[key] + 'が範囲外のため、このフレームは計算できません。'); }
          out.values[key] = REQUIRED.indexOf(key) >= 0 ? null : num.value; return;
        }
        out.values[key] = num.value;
      });

      // サイズ表記（例 54□18-145）と数値の食い違い
      if (typeof f.size_label === 'string' && f.size_label.trim()) {
        var nums = (f.size_label.replace(/[０-９．]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).match(/\d+(\.\d+)?/g) || []).map(Number);
        var pairs = [['lens_width_mm', nums[0]], ['bridge_mm', nums[1]], ['temple_mm', nums[2]]];
        pairs.forEach(function (pr) {
          var v = out.values[pr[0]];
          if (pr[1] != null && v != null && Math.abs(pr[1] - v) > 0.05) {
            R.warnings.push(name + ' のサイズ表記「' + f.size_label + '」と' + LABEL[pr[0]] + '（' + v + '）が食い違っています。');
            fixes.push(name + ' の size_label「' + f.size_label + '」と ' + pr[0] + '（' + v + '）が食い違っています。公式サイトで確かめ直してください。');
          }
        });
      } else if (!f._manual) {
        R.infos.push(name + ' にはサイズ表記がないため、寸法の照合はしていません。');
      }
      // プロンプトの例の値をそのまま写していないか
      var same = Object.keys(EXAMPLE).filter(function (k) { return out.values[k] === EXAMPLE[k]; });
      if (!f._manual && same.length >= 3) {
        R.warnings.push(name + ' の寸法や価格が、プロンプトの例の値（54、18、41、145、19900円）と' + same.length + '項目同じです。AIが調べずに例を写した可能性があります。');
        fixes.push(name + ' の値がプロンプトの例と同じになっています。例ではなく、実際に公式サイトで調べた値を入れてください。');
      }

      // 選択肢の項目
      ['material', 'rim_type', 'shape_type', 'corner'].forEach(function (key) {
        var v = f[key];
        if (v === null || v === undefined) { out.values[key] = null; return; }
        var s = String(v).toLowerCase().replace(/[\s-]+/g, '_');
        if (ENUMS[key].indexOf(s) < 0) {
          R.warnings.push(name + ' の' + LABEL[key] + '「' + v + '」は選択肢にない値のため、不明として扱います。');
          fixes.push(name + ' の ' + key + ' は ' + ENUMS[key].join('、') + ' のどれかで返してください（今は「' + v + '」）。');
          out.values[key] = null; return;
        }
        out.values[key] = s;
      });

      // 出典と確かさ
      var ev = f.evidence && typeof f.evidence === 'object' ? f.evidence : {};
      var levels = {};
      Object.keys(ev).forEach(function (key) {
        var e = ev[key] || {}, lv = ENUMS.level.indexOf(e.level) >= 0 ? e.level : 'estimate';
        if ((lv === 'official' || lv === 'retailer') && !/^https?:\/\//.test(e.source || '')) {
          R.warnings.push(name + ' の' + (LABEL[key] || key) + 'は「公式」とされていますが、出典のURLがないため推定値として扱います。');
          lv = 'estimate';
        }
        levels[key] = lv; out.counts[lv]++;
      });
      if (!Object.keys(ev).length && !f._manual) R.infos.push(name + ' には出典が付いていないため、すべて推定値として扱います。');
      out.levels = levels;

      // 形の近似の伝え方
      var st = out.values.shape_type;
      if (!st) out.shapeNote = { kind: 'unknown', text: 'レンズの形が不明なため、標準的なウェリントン型で近似しています。' };
      else if (st === 'cat_eye') out.shapeNote = { kind: 'partial', text: 'レンズの形はキャットアイ型として近似していますが、目尻の跳ね上がりは再現できていません。' };
      else if (st === 'hexagon') out.shapeNote = { kind: 'partial', text: 'レンズの形は六角形として近似していますが、直線の辺と角は再現できていません。' };
      else out.shapeNote = { kind: 'ok', text: 'レンズの形は「' + (SHAPE_JA[st] || st) + '」型として近似しています。' };

      // そのフレームで選べるレンズ
      var fl = Array.isArray(f.lens_options) ? f.lens_options : null;
      out.lensesPerFrame = !!fl;
      if (!fl && topLenses.length) {
        fl = topLenses.filter(function (o) { return !o || !o.brand || !f.brand || o.brand === f.brand; });
        if (fl.length) R.infos.push(name + ' のレンズは、フレームごとの選択可否が不明なため、お店全体の選択肢を使います。このフレームでは選べない屈折率が含まれている可能性があります。');
      }
      out.lenses = (fl || []).map(function (o) { return parseLens(o, name, f.brand); }).filter(Boolean);
      if (!out.lenses.length) R.infos.push(name + ' のレンズの選択肢が含まれていません。比較画面では標準的な屈折率から選べます。');
      out.lenses.forEach(function (l) { R.lensOptions.push(l); });

      R.frames.push(out);
    });

    var usable = R.frames.filter(function (x) { return x.usable; }).length;
    if (frames.length && usable < 2) {
      R.errors.push('計算できるフレームが' + usable + '本です。比較には2本以上が必要です。');
    }
    ['errors', 'warnings', 'infos'].forEach(function (k) { R[k] = R[k].filter(function (x, i) { return R[k].indexOf(x) === i; }); });
    // 選べないレンズは表の最後にまとめる
    R.lensOptions.sort(function (a, b) { return (a.available === false) - (b.available === false); });
    R.ok = R.errors.length === 0;
    R.fixPrompt = buildFix(fixes);
    return R;
  }

  function buildFix(fixes) {
    if (!fixes.length) return '';
    var uniq = fixes.filter(function (x, i) { return fixes.indexOf(x) === i; });
    return 'さきほどのJSONについて、次の点を直して、同じ形式のJSONだけを返し直してください。\n' +
      uniq.map(function (x) { return '・' + x; }).join('\n');
  }

  var api = { check: check, extractJson: extractJson, ENUMS: ENUMS, RANGE: RANGE, INDEXES: INDEXES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JsonCheck = api;
})(typeof self !== 'undefined' ? self : this);
