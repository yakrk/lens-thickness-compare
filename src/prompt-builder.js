/*
 * prompt-builder.js
 * フレームの入力から、ユーザーが自分のAIに貼る依頼文（プロンプト）を作る。
 * 度数とPDは受け取らない。何も保存しない。通信しない。
 */
(function (root) {
  'use strict';

  var MAX_FRAMES = 4;

  // 1行の入力をきれいにする（改行や制御文字を消し、長すぎる入力を切る）
  function clean(s) {
    return String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
  }

  function today() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  var SCHEMA = [
    '{',
    '  "checked_on": "調べた日 YYYY-MM-DD",',
    '  "frames": [',
    '    {',
    '      "input": "入力された型番かURL",',
    '      "brand": "ブランド名",',
    '      "model": "型番",',
    '      "name": "商品名",',
    '      "url": "商品ページのURL",',
    '      "size_label": "サイトに書かれたサイズ表記そのまま（例 54□18-145）",',
    '      "lens_width_mm": 54,',
    '      "bridge_mm": 18,',
    '      "lens_height_mm": 41,',
    '      "temple_mm": 145,',
    '      "material": "metal",',
    '      "rim_type": "full",',
    '      "price_jpy": 19900,',
    '      "shape_type": "wellington",',
    '      "corner": "medium",',
    '      "rim_width_mm": 2.0,',
    '      "rim_depth_mm": null,',
    '      "evidence": {',
    '        "lens_width_mm": {"level": "official", "source": "出典URL"},',
    '        "bridge_mm": {"level": "official", "source": "出典URL"},',
    '        "lens_height_mm": {"level": "official", "source": "出典URL"},',
    '        "price_jpy": {"level": "official", "source": "出典URL"},',
    '        "shape_type": {"level": "estimate", "source": "判断に使った写真のページURL"},',
    '        "rim_width_mm": {"level": "estimate", "source": "判断に使った写真のページURL"},',
    '        "rim_depth_mm": {"level": "not_found", "source": null}',
    '      },',
    '      "lens_options": [',
    '        {"index": 1.60, "design": "aspheric", "extra_jpy": 0, "available": true, "level": "official", "source": "出典URL"},',
    '        {"index": 1.74, "design": "aspheric", "extra_jpy": null, "available": false, "level": "official", "source": "出典URL"}',
    '      ]',
    '    }',
    '  ]',
    '}'
  ].join('\n');

  var CHOICES = [
    'material は metal、plastic、combination、titanium のどれか（メタルとプラスチックの組み合わせは combination）',
    'rim_type は full（フルリム）、half（ハーフリム）、rimless（縁なし）のどれか',
    'shape_type は wellington、boston、round、square、oval、browline、cat_eye、hexagon のどれか',
    'corner は sharp（角ばっている）、medium、round（丸い）のどれか',
    'design は spherical（球面）、aspheric（片面非球面）、double_aspheric（両面非球面）のどれか',
    'level は official（公式サイト）、retailer（販売店）、estimate（推定）、not_found（見つからない）のどれか',
    'index は 1.50、1.55、1.60、1.67、1.70、1.74、1.76 のどれか',
    'available はそのフレームで選べるなら true、選べないなら false'
  ];

  // frames: [{brand, model}], opts: {withLens: true}
  function build(frames, opts) {
    opts = opts || {};
    var list = (frames || [])
      .map(function (f) { return { brand: clean(f.brand), model: clean(f.model) }; })
      .filter(function (f) { return f.model; })
      .slice(0, MAX_FRAMES);
    if (list.length < 2) return { ok: false, message: '比べるには、型番かURLを2本以上入れてください。', text: '' };

    var lines = [];
    lines.push('あなたはメガネの商品情報を調べるアシスタントです。');
    lines.push('ウェブ検索を使って、次のメガネフレーム' + (opts.withLens ? 'とレンズ' : '') + 'の情報を調べてください。');
    lines.push('');
    lines.push('調べるフレーム');
    list.forEach(function (f) { lines.push('・' + (f.brand ? f.brand + ' ' : '') + f.model); });
    lines.push('');
    lines.push('調べる内容');
    lines.push('1 フレームの玉型幅、ブリッジ幅、レンズの縦の長さ、テンプルの長さ、素材、リムの種類、税込価格。サイトに書かれたサイズ表記は size_label にそのまま写す');
    lines.push('2 正面写真から見たレンズの形の種類と角の丸さ、正面から見たリムの太さ（mm）');
    lines.push('3 リムの奥行き（mm）。公表値がなければ推定し、推定であることを示す');
    if (opts.withLens) lines.push('4 そのフレームで選べる度付きクリアレンズの、屈折率ごとの設計と追加料金。フレームによって選べない屈折率があるので、フレームごとの商品ページやレンズ選択画面で確かめ、選べないものは available を false にする');
    lines.push('');
    lines.push('守ってほしいこと');
    lines.push('・日本の公式サイトの情報を最優先にする。なければ販売店の情報を使い、そのことを示す');
    lines.push('・項目ごとに出典URLを付ける');
    lines.push('・見つからない項目は推測で埋めず、nullにしてlevelをnot_foundにする');
    lines.push('・推定した値はlevelをestimateにする');
    lines.push('・選択肢が決まっている項目は、下の値の中から選ぶ');
    lines.push('・数値はmmや円の単位を付けず、数字だけにする');
    lines.push('・checked_on には今日の日付（' + today() + '）を入れる');
    if (!opts.withLens) lines.push('・各フレームの lens_options は空の配列 [] にする');
    lines.push('・回答は下の形式のJSONだけをコードブロックで返し、説明文は付けない');
    lines.push('');
    lines.push('選択肢');
    CHOICES.forEach(function (c) { lines.push('・' + c); });
    lines.push('');
    lines.push('返す形式（数値は例です。実際に調べた値に置き換えてください）');
    lines.push('```json');
    lines.push(SCHEMA);
    lines.push('```');
    return { ok: true, message: '', text: lines.join('\n'), count: list.length };
  }

  var api = { build: build, clean: clean, MAX_FRAMES: MAX_FRAMES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PromptBuilder = api;
})(typeof self !== 'undefined' ? self : this);
