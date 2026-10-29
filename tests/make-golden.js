// make-golden.js  架空のフレームで計算した正解値を作る。計算を意図して変えたときだけ実行する
const E=require('../src/lens-engine.js');const fs=require('fs');
const frames=[
 {lens_width_mm:52,bridge_mm:19,lens_height_mm:41,material:'metal',rim_type:'full',shape_type:'wellington',corner:'medium'},
 {lens_width_mm:49,bridge_mm:21,lens_height_mm:42,material:'combination',rim_type:'full',shape_type:'boston',corner:'round'},
 {lens_width_mm:55,bridge_mm:17,lens_height_mm:44,material:'plastic',rim_type:'full',shape_type:'square',corner:'sharp',rim_depth_mm:4.5},
 {lens_width_mm:50,bridge_mm:20,lens_height_mm:38,material:'titanium',rim_type:'rimless',shape_type:'oval',corner:'round'}];
const rxs=[[-1,0,0],[-2.5,-0.5,90],[-4,-1.25,180],[-5,-1.25,170],[-6,-2,45],[-8,-0.75,135]];
const out=[];
frames.forEach((f,fi)=>{const fr=E.frameFromJson(f);
 for(const n of [1.60,1.67,1.74,1.76])for(const d of ['aspheric','double_aspheric'])for(const [S,C,AX] of rxs)for(const pd of [[32,32],[31,35],[30,30]])for(const h of [0,3])for(const eye of ['R','L']){
  const rx={R:{S,C,AX},L:{S:S-0.25,C,AX:(AX+90)%180},PDR:pd[0],PDL:pd[1],PD:pd[0]+pd[1],height:h};
  const r=E.edgeStats(fr,n,d,eye,rx);out.push({fi,n,d,S,C,AX,pd,h,eye,r:['tem','nas','top','bot','max','pro'].map(k=>r[k]==null?null:+r[k].toFixed(6))});}});
fs.writeFileSync(__dirname+'/golden.json',JSON.stringify({frames,cases:out}));console.log('cases',out.length);
