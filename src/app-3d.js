/* app-3d.js  3D表示と断面。比較画面で使う。index.html の中に埋め込まれる */
var TMIN=1, TMAX=6;
var HAS3D=(typeof THREE!=='undefined')&&!!THREE.OrbitControls;
var RAMP=!HAS3D?[]:[[0,'#FAD4CE'],[0.33,'#F09A8E'],[0.66,'#D9534A'],[1,'#8E1F14']].map(function(p){return [p[0],new THREE.Color(p[1])]});
// 凡例の色を3Dと同じ定義から作る（食い違いを防ぐ）
(function(){var el=document.querySelector('.ramp');if(el)el.style.background='linear-gradient(90deg,'+['#FAD4CE','#F09A8E','#D9534A','#8E1F14'].join(',')+')';})();
function rampColor(t){var v=Math.min(1,Math.max(0,(t-TMIN)/(TMAX-TMIN)));for(var i=1;i<RAMP.length;i++){if(v<=RAMP[i][0]){return RAMP[i-1][1].clone().lerp(RAMP[i][1],(v-RAMP[i-1][0])/(RAMP[i][0]-RAMP[i-1][0]))}}return RAMP[RAMP.length-1][1].clone()}
// ---- 3D ----
function outlineFn(fr){var t=E.outline(fr),N=t.length;return function(phi){var f=(phi/(2*Math.PI))*N;f=((f%N)+N)%N;var i=Math.floor(f),u=f-i,a=t[i],b=t[(i+1)%N];return [a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u]}}
function frameMat(fr,ghost){if(ghost!=null)return new THREE.MeshStandardMaterial({color:ghost,transparent:true,opacity:.28,depthWrite:false,roughness:.6,side:THREE.DoubleSide});return new THREE.MeshStandardMaterial({color:fr.metal?0x50565c:0x23272a,metalness:fr.metal?.75:.05,roughness:fr.metal?.35:.75,side:THREE.DoubleSide})}
function buildGlasses(fr,lens,rx,ghost){
  var g=new THREE.Group(),K=22,N=144,outlineAt=outlineFn(fr);
  ['R','L'].forEach(function(eye){
    var m=E.lensModel(fr,lens.index,lens.design,eye,rx);
    var pos=[],col=[],idx=[];
    function push(x,y,z,t){pos.push(x,y,z);var c=rampColor(t);col.push(c.r,c.g,c.b)}
    function grid(back){var base=pos.length/3,i,j;
      for(i=0;i<=K;i++)for(j=0;j<N;j++){var o=outlineAt(j/N*2*Math.PI),w=m.toWorld(o[0]*i/K,o[1]*i/K),t=m.thick(w[0],w[1]);push(w[0],w[1],m.zf(w[0],w[1])-(back?t:0),t)}
      for(i=0;i<K;i++)for(j=0;j<N;j++){var a=base+i*N+j,b=base+(i+1)*N+j,c=base+(i+1)*N+(j+1)%N,d=base+i*N+(j+1)%N;if(back)idx.push(a,c,b,a,d,c);else idx.push(a,b,c,a,c,d)}}
    grid(false);grid(true);
    var sb=pos.length/3,j;
    for(j=0;j<N;j++){var o=outlineAt(j/N*2*Math.PI),w=m.toWorld(o[0],o[1]),t=m.thick(w[0],w[1]),z=m.zf(w[0],w[1]);push(w[0],w[1],z,t);push(w[0],w[1],z-t,t)}
    for(j=0;j<N;j++){var a=sb+2*j,b=a+1,c=sb+2*((j+1)%N)+1,d=sb+2*((j+1)%N);idx.push(a,b,c,a,c,d)}
    var geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));geo.setIndex(idx);geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo,ghost!=null?new THREE.MeshStandardMaterial({color:ghost,roughness:.4,transparent:true,opacity:.42,depthWrite:false,side:THREE.DoubleSide}):new THREE.MeshStandardMaterial({vertexColors:true,roughness:.35,transparent:true,opacity:.93,side:THREE.DoubleSide})));
    if(ghost!=null)g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo,35),new THREE.LineBasicMaterial({color:ghost})));
    else{var fl=[],bl=[];for(var q=0;q<N;q++){var oo=outlineAt(q/N*2*Math.PI),ww=m.toWorld(oo[0],oo[1]),tt=m.thick(ww[0],ww[1]),zz=m.zf(ww[0],ww[1]);fl.push(new THREE.Vector3(ww[0],ww[1],zz));bl.push(new THREE.Vector3(ww[0],ww[1],zz-tt))}
      [fl,bl].forEach(function(pts){g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x5B6675,transparent:true,opacity:.7})))})}
    if(fr.rimType!=='rimless'){
      var rp=[],ri=[];
      for(j=0;j<N;j++){var q=outlineAt(j/N*2*Math.PI),r=Math.hypot(q[0],q[1])||1,iw=m.toWorld(q[0],q[1]),ow=m.toWorld(q[0]+fr.rimW*q[0]/r,q[1]+fr.rimW*q[1]/r);
        if(fr.rimType==='half'&&q[1]<0){var zF0=m.zf(iw[0],iw[1])+E.SETBACK;rp.push(iw[0],iw[1],zF0,iw[0],iw[1],zF0,iw[0],iw[1],zF0,iw[0],iw[1],zF0);continue}
        var zF=m.zf(iw[0],iw[1])+E.SETBACK,zB=zF-fr.rimD;rp.push(iw[0],iw[1],zF,ow[0],ow[1],zF,ow[0],ow[1],zB,iw[0],iw[1],zB)}
      for(j=0;j<N;j++){var a2=4*j,b2=4*((j+1)%N);for(var k=0;k<4;k++){var k2=(k+1)%4;ri.push(a2+k,a2+k2,b2+k2,a2+k,b2+k2,b2+k)}}
      var rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.Float32BufferAttribute(rp,3));rg.setIndex(ri);rg.computeVertexNormals();
      g.add(new THREE.Mesh(rg,frameMat(fr,ghost)));
    }
    var tx=m.toWorld(fr.A/2+fr.rimW*0.6,0)[0];
    var tm=new THREE.Mesh(new THREE.BoxGeometry(fr.metal?1.4:3,fr.metal?2:4,60),frameMat(fr,ghost));tm.position.set(tx,fr.B*0.28,-32);g.add(tm);
  });
  var by=fr.B*0.22,bx=fr.DBL/2;
  var curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(-bx-0.5,by,0),new THREE.Vector3(0,by+4,0.5),new THREE.Vector3(bx+0.5,by,0));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve,24,fr.metal?0.9:1.8,10,false),frameMat(fr,ghost)));
  return g;
}
// 重ねる表示用：表と裏の縁を太い管（チューブ）で描き、側面はごく薄く塗る。
// 塗りどうしが重なって片方が隠れる問題を避けるため、主役は太い輪郭にする。
function buildOverlay(fr,lens,rx,color,front){
  var g=new THREE.Group(),N=144,outlineAt=outlineFn(fr);
  ['L'].forEach(function(eye){
    var m=E.lensModel(fr,lens.index,lens.design,eye,rx),j;
    var band=[],bi=[],fp=[],bp=[];
    for(j=0;j<N;j++){var o=outlineAt(j/N*2*Math.PI),w=m.toWorld(o[0],o[1]),t=m.thick(w[0],w[1]),z=m.zf(w[0],w[1]);
      band.push(w[0],w[1],z,w[0],w[1],z-t);fp.push(new THREE.Vector3(w[0],w[1],z));bp.push(new THREE.Vector3(w[0],w[1],z-t))}
    for(j=0;j<N;j++){var a=2*j,b=a+1,c=2*((j+1)%N)+1,d=2*((j+1)%N);bi.push(a,b,c,a,c,d)}
    var bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.Float32BufferAttribute(band,3));bg.setIndex(bi);bg.computeVertexNormals();
    var bm=new THREE.Mesh(bg,new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide}));bm.renderOrder=1;g.add(bm);
    var mat=new THREE.MeshStandardMaterial({color:color,roughness:.45});
    [fp,bp].forEach(function(pts){
      if(front){var curve=new THREE.CatmullRomCurve3(pts,true);var tube=new THREE.Mesh(new THREE.TubeGeometry(curve,N,0.35,8,true),mat);tube.renderOrder=2;g.add(tube);return}
      // Bは破線（6点描いて3点あける）
      for(var s=0;s<N;s+=9){var seg=[];for(var q=0;q<=6;q++)seg.push(pts[(s+q)%N]);var c2=new THREE.CatmullRomCurve3(seg,false);var t2=new THREE.Mesh(new THREE.TubeGeometry(c2,12,0.35,8,false),mat);t2.renderOrder=2;g.add(t2)}
    });
  });
  return g;
}
var OVER={A:null,B:null},SHOW='both';
var camera=HAS3D?new THREE.PerspectiveCamera(28,1.6,20,1500):null;if(camera)camera.position.set(170,110,250);
function makeView(canvas){
  var renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  var scene=new THREE.Scene();scene.add(new THREE.AmbientLight(0xffffff,.55));
  var d1=new THREE.DirectionalLight(0xffffff,.8);d1.position.set(80,120,200);scene.add(d1);
  var d2=new THREE.DirectionalLight(0xffffff,.35);d2.position.set(-150,-40,-120);scene.add(d2);
  var controls=new THREE.OrbitControls(camera,canvas);controls.enableDamping=true;controls.target.set(0,0,-3);controls.minDistance=60;controls.maxDistance=900;
  return {renderer:renderer,scene:scene,controls:controls,canvas:canvas,group:null};
}
var VA,VB,VO,gl=HAS3D;
var glWhy=HAS3D?'':'load';
var glReady=false;
function init3D(){if(glReady)return gl;glReady=true;if(gl){try{VA=makeView($('cA'));VB=makeView($('cB'));VO=makeView($('cO'))}catch(e){gl=false;glWhy='webgl'}}if(!gl)show3DFallback();else loop();return gl}
function setGroup(V,g){if(V.group){V.scene.remove(V.group);V.group.traverse(function(x){x.geometry&&x.geometry.dispose();x.material&&x.material.dispose()})}V.group=g;V.scene.add(g)}
function resize(){if(!gl||!VA)return;[VA,VB,VO].forEach(function(V){var w=V.canvas.clientWidth,h=V.canvas.clientHeight;if(w&&h)V.renderer.setSize(w,h,false)});var c=mode==='over'?VO.canvas:VA.canvas;var w=c.clientWidth||600,h=c.clientHeight||260;camera.aspect=w/h;camera.updateProjectionMatrix()}
window.addEventListener('resize',resize);
var mode='side';
document.querySelectorAll('[data-mode]').forEach(function(b){b.addEventListener('click',function(){mode=b.dataset.mode;
  document.querySelectorAll('[data-mode]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b))});
  $('stSide').hidden=mode!=='side';$('overBox').hidden=mode!=='over';if(mode==='over'){var tb=document.querySelector('[data-cam=top]');if(tb)tb.click();}$('camSeg').hidden=mode==='sec';$('stSec').hidden=mode!=='sec';$('legend').hidden=mode!=='side';resize();if(mode==='sec')drawSection()})});

// ---- 断面（左目） ----
var CUR=null;
function profile(fr,lens,rx,dir){
  var m=E.lensModel(fr,lens.index,lens.design,'L',rx),t=E.outline(fr);
  var lxo=(m.cx-m.ocx)*m.ns,lo=1e9,hi=-1e9;
  t.forEach(function(q){if(dir==='h'?Math.abs(q[1])<1.2:Math.abs(q[0]-lxo)<1.5){var v=dir==='h'?q[0]:q[1];lo=Math.min(lo,v);hi=Math.max(hi,v)}});
  var pts=[];for(var i=0;i<=120;i++){var v=lo+(hi-lo)*i/120,w=dir==='h'?m.toWorld(v,0):m.toWorld(lxo,v),u=dir==='h'?v-lxo:v,zf=m.zf(w[0],w[1]),th=m.thick(w[0],w[1]);pts.push([u,zf,zf-th])}
  return {pts:pts,rimW:fr.rimW,rimD:fr.rimD,rimless:fr.rimType==='rimless'};
}
function drawSection(){
  if(!CUR)return;var c=$('sec'),x=c.getContext('2d'),W=c.width,H=c.height;x.clearRect(0,0,W,H);
  var ink=css('--muted'),fg=css('--ink'),COL={A:css('--a3d'),B:css('--b3d')},Z=3;
  var ph={A:profile(CUR.A.fr,CUR.A.lens,CUR.rx,'h'),B:profile(CUR.B.fr,CUR.B.lens,CUR.rx,'h')};
  var pv={A:profile(CUR.A.fr,CUR.A.lens,CUR.rx,'v'),B:profile(CUR.B.fr,CUR.B.lens,CUR.rx,'v')};
  function span(pr){var m=0;['A','B'].forEach(function(k){pr[k].pts.forEach(function(q){m=Math.max(m,Math.abs(q[0])+pr[k].rimW+1)})});return m}
  var hw=W*0.64, vx0=hw+20, vw=W-vx0;
  x.font='22px Meiryo, sans-serif';x.fillStyle=fg;
  // ---- 横の断面：上から見た図（上が外側、下が目の側）
  var sh=(hw/2-40)/span(ph), ox=hw/2, oy=150;
  x.fillText('横の断面（上から見た図）',20,36);
  x.fillStyle=ink;x.font='16px Meiryo, sans-serif';x.fillText('左 鼻側　右 耳側　上 外側　下 目の側',20,62);
  x.strokeStyle=ink;x.globalAlpha=.4;x.setLineDash([4,6]);x.beginPath();x.moveTo(ox,80);x.lineTo(ox,H-50);x.stroke();x.setLineDash([]);x.globalAlpha=1;
  x.fillText('黒目',ox+6,H-56);
  var endY={first:0,last:0};['A','B'].forEach(function(k){var P=ph[k].pts;endY.first=Math.max(endY.first,oy-P[0][2]*sh*Z);endY.last=Math.max(endY.last,oy-P[P.length-1][2]*sh*Z)});
  ['A','B'].forEach(function(k,ki){var pr=ph[k],P=pr.pts,col=COL[k];
    function X(u){return ox+u*sh}function Y(z){return oy-z*sh*Z}
    x.beginPath();P.forEach(function(q,i){i?x.lineTo(X(q[0]),Y(q[1])):x.moveTo(X(q[0]),Y(q[1]))});for(var i=P.length-1;i>=0;i--)x.lineTo(X(P[i][0]),Y(P[i][2]));x.closePath();
    x.fillStyle=col;x.globalAlpha=.10;x.fill();x.globalAlpha=1;x.strokeStyle=col;x.lineWidth=3;x.setLineDash(k==='B'?[12,7]:[]);x.stroke();x.setLineDash([]);
    if(!pr.rimless)[P[0],P[P.length-1]].forEach(function(e){var dn=Math.sign(e[0])||1,zF=e[1]+E.SETBACK;x.setLineDash([5,4]);x.lineWidth=1.5;x.strokeRect(dn>0?X(e[0]):X(e[0])-pr.rimW*sh,Y(zF),pr.rimW*sh,pr.rimD*sh*Z);x.setLineDash([])});
    x.fillStyle=col;x.font='bold 18px Meiryo, sans-serif';
    [[P[P.length-1],'right','last'],[P[0],'left','first']].forEach(function(qa){var q=qa[0];x.textAlign=qa[1];x.fillText(k+' '+(q[1]-q[2]).toFixed(1)+'mm',X(q[0])+(qa[1]==='left'?8:-8),endY[qa[2]]+26+ki*24);x.textAlign='left'});
  });
  // ---- 縦の断面：横から見た図（上が上、左が外側、右が目の側）
  var sv=(H/2-70)/span(pv), cx=vx0+vw*0.42, cy=H/2+20;
  x.strokeStyle=ink;x.globalAlpha=.25;x.beginPath();x.moveTo(vx0-10,40);x.lineTo(vx0-10,H-20);x.stroke();x.globalAlpha=1;
  x.fillStyle=fg;x.font='22px Meiryo, sans-serif';x.fillText('縦の断面（横から見た図）',vx0+10,36);
  x.fillStyle=ink;x.font='16px Meiryo, sans-serif';x.fillText('左 外側　右 目の側',vx0+10,62);
  x.strokeStyle=ink;x.globalAlpha=.4;x.setLineDash([4,6]);x.beginPath();x.moveTo(vx0+10,cy);x.lineTo(W-10,cy);x.stroke();x.setLineDash([]);x.globalAlpha=1;
  x.fillText('黒目',W-50,cy-6);
  ['A','B'].forEach(function(k,ki){var pr=pv[k],P=pr.pts,col=COL[k];
    function X(z){return cx-z*sv*Z}function Y(u){return cy-u*sv}
    x.beginPath();P.forEach(function(q,i){i?x.lineTo(X(q[1]),Y(q[0])):x.moveTo(X(q[1]),Y(q[0]))});for(var i=P.length-1;i>=0;i--)x.lineTo(X(P[i][2]),Y(P[i][0]));x.closePath();
    x.fillStyle=col;x.globalAlpha=.10;x.fill();x.globalAlpha=1;x.strokeStyle=col;x.lineWidth=3;x.setLineDash(k==='B'?[12,7]:[]);x.stroke();x.setLineDash([]);
    if(!pr.rimless)[P[0],P[P.length-1]].forEach(function(e){var dn=Math.sign(e[0])||1,zF=e[1]+E.SETBACK;var y1=Y(e[0]),y2=Y(e[0]+dn*pr.rimW);x.setLineDash([5,4]);x.lineWidth=1.5;x.strokeRect(X(zF),Math.min(y1,y2),pr.rimD*sv*Z,Math.abs(y2-y1));x.setLineDash([])});
    x.fillStyle=col;x.font='bold 18px Meiryo, sans-serif';
    [[P[P.length-1],-1],[P[0],1]].forEach(function(qa){var q=qa[0];x.fillText(k+' '+(q[1]-q[2]).toFixed(1)+'mm',X(q[2])+10+ki*0,Y(q[0])+qa[1]*(22+ki*22)+(qa[1]>0?0:8))});
  });
  x.fillStyle=ink;x.font='16px Meiryo, sans-serif';x.fillText('厚み方向は3倍に拡大。点線の四角はリム（奥行きは推定を含む）。左目の断面です。',20,H-14);
}
function loop(){if(gl&&VA){[VA,VB,VO].forEach(function(V){V.controls.update()});if(mode==='side'){VA.renderer.render(VA.scene,camera);VB.renderer.render(VB.scene,camera)}else if(mode==='over'){VO.renderer.render(VO.scene,camera)}}requestAnimationFrame(loop)}

function applyShow(){if(!OVER.A)return;OVER.A.visible=SHOW!=='B';OVER.B.visible=SHOW!=='A'}
document.querySelectorAll('[data-show]').forEach(function(b){b.addEventListener('click',function(){SHOW=b.dataset.show;document.querySelectorAll('[data-show]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b))});applyShow()})});
function setCam(v){if(!gl||!VA)return;var p=v==='front'?[0,0,330]:v==='top'?[0,330,-3]:[170,110,250];camera.position.set(p[0],p[1],p[2]);if(v==='top')camera.up.set(0,0,-1);else camera.up.set(0,1,0);[VA,VB,VO].forEach(function(V){V.controls.target.set(0,0,-3);V.controls.update()})}
document.querySelectorAll('[data-cam]').forEach(function(b){b.addEventListener('click',function(){document.querySelectorAll('[data-cam]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b))});setCam(b.dataset.cam)})});
