// run-tests.js  変更のたびに実行する自動テスト。node run-tests.js
const assert=require('assert');const fs=require('fs');const path=require('path');
const E=require('../src/lens-engine.js'),C=require('../src/json-check.js'),P=require('../src/prompt-builder.js'),S=require('./samples.js');
let pass=0,fail=0;function t(name,fn){try{fn();pass++;console.log('OK  ',name)}catch(e){fail++;console.log('NG  ',name,'\n     ',e.message)}}
const fr=E.frameFromJson({lens_width_mm:54,bridge_mm:18,lens_height_mm:41,material:'metal',rim_type:'full',shape_type:'wellington',corner:'medium'});
const base={R:{S:-4,C:-1.25,AX:180},L:{S:-5,C:-1.25,AX:180}};
// 1 計算：正解値（tests/golden.json）と一致する
t('計算が正解値と一致する（2,304通り）',()=>{
  const G=require('./golden.json');let maxd=0;
  for(const c of G.cases){const fr=E.frameFromJson(G.frames[c.fi]);const rx={R:{S:c.S,C:c.C,AX:c.AX},L:{S:c.S-0.25,C:c.C,AX:(c.AX+90)%180},PDR:c.pd[0],PDL:c.pd[1],PD:c.pd[0]+c.pd[1],height:c.h};
    const r=E.edgeStats(fr,c.n,c.d,c.eye,rx);['tem','nas','top','bot','max','pro'].forEach((k,i)=>{if(c.r[i]==null){assert.strictEqual(r[k],null);return}maxd=Math.max(maxd,Math.abs(r[k]-c.r[i]))});}
  assert.ok(maxd<1e-5,'最大の差 '+maxd);});
t('片眼PDが左右で違うと、各目の厚みが変わる',()=>{const s=E.edgeStats(fr,1.74,'aspheric','L',{...base,PD:66}).tem,a=E.edgeStats(fr,1.74,'aspheric','L',{...base,PD:66,PDR:31,PDL:35}).tem;assert.ok(Math.abs(s-4.42)<0.01&&Math.abs(a-4.02)<0.01,s+' '+a);});
t('片眼PDが同じなら、合計PDと同じ結果',()=>{assert.strictEqual(E.edgeStats(fr,1.74,'aspheric','L',{...base,PD:66}).max,E.edgeStats(fr,1.74,'aspheric','L',{...base,PD:66,PDR:33,PDL:33}).max);});
t('黒目の高さを上げると下の縁が厚くなる',()=>{const a=E.edgeStats(fr,1.74,'aspheric','L',{...base,PD:66}).bot,b=E.edgeStats(fr,1.74,'aspheric','L',{...base,PD:66,height:3}).bot;assert.ok(b>a+0.3,a+' '+b);});
t('較正範囲の判定（-6.5は外挿、-8.5は判定しない）',()=>{assert.ok(E.powerRange({R:{S:-6,C:-0.5},L:{S:-3,C:0}}).extrapolated);assert.ok(!E.powerRange({R:{S:-6,C:0},L:{S:-3,C:0}}).extrapolated);assert.ok(E.powerRange({R:{S:-8,C:-0.5},L:{S:-3,C:0}}).noVerdict);});
t('判定のしきい値（同じ屈折率0.2、違う屈折率0.3、範囲外は判定しない）',()=>{assert.strictEqual(E.verdict(3.6,3.35).result,'B_thinner');assert.strictEqual(E.verdict(3.6,3.35,{mixed:true}).result,'undecided');assert.strictEqual(E.verdict(3.6,3.45).result,'undecided');assert.strictEqual(E.verdict(3,4,{outOfRange:true}).result,'out_of_range');});
t('縁なしははみ出しを出さない',()=>{const r=E.frameFromJson({lens_width_mm:54,bridge_mm:18,lens_height_mm:41,material:'titanium',rim_type:'rimless'});assert.strictEqual(E.edgeStats(r,1.74,'aspheric','L',{...base,PD:66}).pro,null);});
t('外部計算機（Chadwick Optical）と同じ条件で、球面レンズの縁の厚みが0.01mm以内で一致する（8ケース）',()=>{
  const cs=require('./chadwick.json');let maxd=0;
  for(const c of cs){const n=parseFloat(c.mat);const P=c.S+c.C*Math.pow(Math.sin((0-c.AX)*Math.PI/180),2);
    const dec=(c.A+c.DBL)/2-c.mpd;const cf=c.BC/(1000*(n-1)),cb=(c.BC-P)/(1000*(n-1));const th=r=>c.CT+E.sag(cb,0,r)-E.sag(cf,0,r);
    maxd=Math.max(maxd,Math.abs(th(c.ED/2-dec)-c.near),Math.abs(th(c.ED/2+dec)-c.far));}
  assert.ok(maxd<0.01,'最大の差 '+maxd);});
// 2 チェック
const today=new Date('2026-10-27');
t('見本：正しい回答は読める',()=>assert.ok(C.check(S.good,today).ok));
t('見本：壊れたJSONは読めず行番号を出す',()=>{const r=C.check(S.broken,today);assert.ok(!r.ok&&/行目/.test(r.errors[0]));});
t('見本：範囲外の縦は計算しない',()=>{const r=C.check(S.odd,today);assert.ok(!r.ok&&r.warnings.some(w=>/4.1/.test(w)));});
t('見本：JSONなしは読めない',()=>assert.ok(!C.check(S.empty,today).ok));
t('サイズ表記と数値の食い違いを見つける',()=>{const f=o=>Object.assign({brand:'X',model:'M',lens_width_mm:51,bridge_mm:19,lens_height_mm:42,evidence:{}},o);const r=C.check(JSON.stringify({frames:[f({size_label:'51□21-145'}),f({model:'N'})]}),today);assert.ok(r.warnings.some(w=>/食い違/.test(w)));});
t('プロンプトの例の値の写しを見つける',()=>{const f=o=>Object.assign({brand:'X',model:'M',lens_width_mm:54,bridge_mm:18,lens_height_mm:41,price_jpy:19900,evidence:{}},o);const r=C.check(JSON.stringify({frames:[f({}),f({model:'N',lens_width_mm:50})]}),today);assert.ok(r.warnings.some(w=>/例の値/.test(w)));});
t('出典URLのない「公式」は推定に下げる',()=>{const f=o=>Object.assign({brand:'X',model:'M',lens_width_mm:51,bridge_mm:19,lens_height_mm:42,evidence:{lens_width_mm:{level:'official',source:'出典URL'}}},o);const r=C.check(JSON.stringify({frames:[f({}),f({model:'N'})]}),today);assert.strictEqual(r.frames[0].counts.official,0);});
t('リンクは https/http だけ（javascript: は使わない）',()=>{const f=o=>Object.assign({brand:'X',model:'M',url:'javascript:alert(1)',lens_width_mm:51,bridge_mm:19,lens_height_mm:42,evidence:{}},o);const r=C.check(JSON.stringify({frames:[f({}),f({model:'N'})]}),today);assert.strictEqual(r.frames[0].url,null);});
t('手入力は「手入力」として数える',()=>{const f=o=>Object.assign({_manual:true,brand:'X',model:'M',lens_width_mm:51,bridge_mm:19,lens_height_mm:42,evidence:{lens_width_mm:{level:'manual',source:null}}},o);const r=C.check(JSON.stringify({frames:[f({}),f({model:'N'})]}),today);assert.ok(r.ok&&r.frames[0].counts.manual===1);});
// 3 プロンプト
t('プロンプトに度数やPDを入れない',()=>{const r=P.build([{brand:'A',model:'X1'},{brand:'B',model:'Y2'}],{withLens:true});assert.ok(r.ok&&!/PD|球面度数|乱視|S -/.test(r.text.replace('spherical（球面）','')));});
t('プロンプトにサイズ表記と、フレームごとのレンズ可否を含める',()=>{const r=P.build([{brand:'A',model:'X1'},{brand:'B',model:'Y2'}],{withLens:true});assert.ok(/size_label/.test(r.text)&&/available/.test(r.text));});
t('2本未満ではプロンプトを作らない',()=>assert.ok(!P.build([{brand:'A',model:'X1'}]).ok));
t('入力の改行や制御文字を消す',()=>{const r=P.build([{brand:'A\nB',model:'X1\u0007'},{brand:'B',model:'Y2'}]);assert.ok(/・A B X1/.test(r.text));});
console.log(`\n${pass}件成功、${fail}件失敗`);process.exit(fail?1:0);
