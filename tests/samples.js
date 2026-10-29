const good={checked_on:"2026-10-20",frames:[
 {input:"ABC-0001",brand:"ブランドA",model:"ABC-0001",url:"https://example.com/abc-0001",lens_width_mm:54,bridge_mm:18,lens_height_mm:41,temple_mm:149,material:"metal",rim_type:"full",price_jpy:29900,shape_type:"wellington",corner:"medium",rim_width_mm:2.0,rim_depth_mm:null,
  evidence:{lens_width_mm:{level:"official",source:"https://example.com/abc-0001"},bridge_mm:{level:"official",source:"https://example.com/abc-0001"},lens_height_mm:{level:"official",source:"https://example.com/abc-0001"},rim_width_mm:{level:"estimate",source:"https://example.com/abc-0001"},rim_depth_mm:{level:"not_found",source:null}}},
 {input:"DEF-0002",brand:"ブランドB",model:"DEF-0002",url:"https://example.com/def-0002",lens_width_mm:52,bridge_mm:19,lens_height_mm:41.4,temple_mm:140,material:"combination",rim_type:"full",price_jpy:13800,shape_type:"boston",corner:"round",rim_width_mm:2.5,rim_depth_mm:null,
  evidence:{lens_width_mm:{level:"official",source:"https://example.com/def-0002"},bridge_mm:{level:"official",source:"https://example.com/def-0002"},lens_height_mm:{level:"official",source:"https://example.com/def-0002"},rim_depth_mm:{level:"not_found",source:null}}}],
 lens_options:[]};
good.frames[0].lens_options=[{index:1.60,design:"aspheric",extra_jpy:0,available:true,level:"official",source:"https://example.com/abc-0001"},{index:1.74,design:"aspheric",extra_jpy:null,available:false,level:"official",source:"https://example.com/abc-0001"},{index:1.76,design:"double_aspheric",extra_jpy:11000,available:true,level:"official",source:"https://example.com/abc-0001"}];
good.frames[1].lens_options=[{index:1.60,design:"aspheric",extra_jpy:0,available:true,level:"official",source:"https://example.com/def-0002"},{index:1.74,design:"aspheric",extra_jpy:0,available:true,level:"official",source:"https://example.com/def-0002"}];
const s=JSON.stringify;
const odd=JSON.parse(s(good));odd.frames[0].lens_height_mm=4.1;odd.frames[1].material="stainless";odd.frames[1].shape_type="cat-eye";odd.frames[1].evidence.bridge_mm.source=null;odd.frames[1].lens_options.push({index:1.80,design:"aspheric",extra_jpy:0,available:true});
const odd2=JSON.parse(s(good));odd2.frames.push({brand:"ブランドC",model:"GHI-0003",lens_width_mm:50,bridge_mm:20,lens_height_mm:38,shape_type:"hexagon"});
const missing=JSON.parse(s(good));delete missing.frames[1].bridge_mm;
const units=JSON.parse(s(good));units.frames[0].lens_width_mm="54mm";units.frames[0].price_jpy="¥29,900";units.checked_on="2026-03-01";
module.exports={
 good:"調べた結果です。\n```json\n"+JSON.stringify(good,null,2)+"\n```\n以上です。",
 broken:JSON.stringify(good,null,2).replace('"bridge_mm": 18,','"bridge_mm": 18'),
 odd:JSON.stringify(odd,null,2),
 odd3:JSON.stringify(odd2,null,2),
 missing:JSON.stringify(missing,null,2),
 units:JSON.stringify(units,null,2),
 empty:"すみません、情報が見つかりませんでした。"
};
