// Stronger 3:2 share card export.
// Official share-card module. Keeps the darker Strava-friendly version and renders ramp blocks as ramps.
(function(){
  if(window.__veeraShareCardLoaded) return;
  window.__veeraShareCardLoaded = true;

  function rr(ctx,x,y,w,h,r){
    const q=Math.min(r,w/2,h/2);
    ctx.beginPath();
    ctx.moveTo(x+q,y);
    ctx.lineTo(x+w-q,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+q);
    ctx.lineTo(x+w,y+h-q);
    ctx.quadraticCurveTo(x+w,y+h,x+w-q,y+h);
    ctx.lineTo(x+q,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-q);
    ctx.lineTo(x,y+q);
    ctx.quadraticCurveTo(x,y,x+q,y);
    ctx.closePath();
  }

  function fmt(sec){
    if(typeof formatTime === 'function') return formatTime(sec || 0);
    sec=Math.max(0,Math.round(sec||0));
    const h=Math.floor(sec/3600);
    const m=Math.floor((sec%3600)/60);
    const s=sec%60;
    return h>0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
  }

  function avg(values){
    const nums = values.filter(v=>Number.isFinite(v));
    return nums.length ? nums.reduce((a,b)=>a+b,0) / nums.length : null;
  }

  function zoneColour(pct){
    if(pct < .56) return '#2563eb';
    if(pct < .76) return '#0891b2';
    if(pct < .91) return '#7c3aed';
    if(pct < 1.06) return '#9333ea';
    if(pct < 1.21) return '#db2777';
    return '#dc2626';
  }

  function getBlocks(){
    try{
      if(Array.isArray(workout)) return workout;
    }catch(e){}
    return [];
  }

  function getSamples(){
    try{
      if(Array.isArray(rideSamples)) return rideSamples;
    }catch(e){}
    return [];
  }

  function getFtp(){
    try{
      if(typeof ftp === 'function') return Math.max(1, ftp());
    }catch(e){}
    return 250;
  }

  function getTotalDuration(blocks, fallback){
    try{
      if(typeof totalDuration === 'function') return Math.max(1, totalDuration());
    }catch(e){}
    const total = blocks.reduce((s,b)=>s + Number(b.duration || 0), 0);
    return Math.max(1, total || fallback || 1);
  }

  function getSummary(){
    try{
      if(typeof getRideSummary === 'function') return getRideSummary() || {};
    }catch(e){}
    return {};
  }

  function drawSmoothTrace(ctx, points, opts){
    if(points.length < 2) return;
    ctx.save();
    ctx.strokeStyle = opts.color;
    ctx.lineWidth = opts.width;
    ctx.lineCap = opts.cap || 'round';
    ctx.lineJoin = opts.join || 'bevel';
    ctx.shadowColor = opts.shadow || 'transparent';
    ctx.shadowBlur = opts.shadowBlur || 0;
    ctx.beginPath();
    points.forEach((p,i)=>{
      if(i === 0){
        ctx.moveTo(p.x,p.y);
      }else{
        const prev = points[i-1];
        const cx = (prev.x + p.x) / 2;
        const cy = (prev.y + p.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, cx, cy);
      }
    });
    const last = points[points.length-1];
    ctx.lineTo(last.x,last.y);
    ctx.stroke();
    ctx.restore();
  }

  window.workoutShareImageDataUrl = function(reason='completed'){
    const W = 1800;
    const H = 1200; // 3:2
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const summary = getSummary();
    const blocks = getBlocks();
    const samples = getSamples();
    const duration = summary.duration || (()=>{ try{ return Math.round(currentElapsed()); }catch(e){ return 0; } })() || 0;
    const total = getTotalDuration(blocks, duration);
    const ftpVal = getFtp();
    const name = (()=>{ try{ return loadedName || 'Veera Workout'; }catch(e){ return 'Veera Workout'; } })();

    // Strong dark background.
    const bg = ctx.createLinearGradient(0,0,W,H);
    bg.addColorStop(0,'#172554');
    bg.addColorStop(.45,'#312e81');
    bg.addColorStop(1,'#0e7490');
    ctx.fillStyle = bg;
    ctx.fillRect(0,0,W,H);

    // Saturated mesh accents.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.filter = 'blur(46px) saturate(1.32)';
    let g = ctx.createRadialGradient(240,140,40,420,260,680);
    g.addColorStop(0,'rgba(56,189,248,.92)');
    g.addColorStop(.55,'rgba(59,130,246,.45)');
    g.addColorStop(1,'rgba(59,130,246,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-140,-140,W+280,H+280);

    g = ctx.createRadialGradient(1580,160,70,1320,330,780);
    g.addColorStop(0,'rgba(168,85,247,.86)');
    g.addColorStop(.58,'rgba(236,72,153,.42)');
    g.addColorStop(1,'rgba(236,72,153,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-140,-140,W+280,H+280);

    g = ctx.createRadialGradient(980,1150,100,900,880,700);
    g.addColorStop(0,'rgba(34,211,238,.68)');
    g.addColorStop(1,'rgba(34,211,238,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-140,-140,W+280,H+280);
    ctx.restore();
    ctx.filter = 'none';

    // Main card.
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.34)';
    ctx.shadowBlur = 42;
    ctx.shadowOffsetY = 26;
    ctx.fillStyle = 'rgba(15,23,42,.74)';
    rr(ctx,70,70,W-140,H-140,54);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.22)';
    ctx.lineWidth = 2;
    rr(ctx,70,70,W-140,H-140,54);
    ctx.stroke();

    // Header.
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,.84)';
    ctx.font = '900 44px Inter, Arial, sans-serif';
    ctx.fillText('veera',130,162);
    ctx.fillStyle = '#fff';
    ctx.font = '950 58px Inter, Arial, sans-serif';
    ctx.fillText(name,130,242);
    ctx.fillStyle = 'rgba(226,232,240,.76)';
    ctx.font = '800 24px Inter, Arial, sans-serif';
    ctx.fillText(reason === 'stopped' ? 'Workout stopped' : 'Workout complete',130,286);

    // Preview panel.
    const px=130, py=335, pw=W-260, ph=515;
    ctx.fillStyle = 'rgba(2,6,23,.54)';
    rr(ctx,px,py,pw,ph,42);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.16)';
    ctx.lineWidth = 2;
    rr(ctx,px,py,pw,ph,42);
    ctx.stroke();

    const padX=48, padY=44;
    const plotX=px+padX, plotY=py+padY;
    const plotW=pw-padX*2, plotH=ph-padY*2;
    const baseY = plotY + plotH;

    ctx.save();
    rr(ctx, px, py, pw, ph, 42);
    ctx.clip();

    // Solid workout block preview, ramps drawn as sloped polygons.
    const maxPct = Math.max(1.25, ...blocks.map(b=>Math.max(
      Number(b.power || 0),
      Number(b.low || 0),
      Number(b.high || 0)
    )));
    let bx = plotX;
    blocks.forEach(b=>{
      const dur = Number(b.duration || 0);
      if(dur <= 0) return;
      const bw = Math.max(8, (dur / total) * plotW);
      const hasRamp = Number.isFinite(Number(b.low)) && Number.isFinite(Number(b.high)) && Number(b.low) !== Number(b.high);
      const lowPct = hasRamp ? Number(b.low) : Number(b.power || b.low || b.high || 0);
      const highPct = hasRamp ? Number(b.high) : Number(b.power || b.high || b.low || 0);
      const avgPct = (lowPct + highPct) / 2;
      const x1 = bx + 3;
      const x2 = bx + Math.max(4, bw - 3);
      const width = Math.max(4, x2 - x1);
      const y1 = plotY + plotH - Math.max(34, Math.min(plotH, (lowPct / maxPct) * (plotH - 18)));
      const y2 = plotY + plotH - Math.max(34, Math.min(plotH, (highPct / maxPct) * (plotH - 18)));

      ctx.fillStyle = zoneColour(avgPct);
      if(hasRamp){
        ctx.beginPath();
        ctx.moveTo(x1, baseY);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x2, baseY);
        ctx.closePath();
        ctx.fill();
      }else{
        const y = Math.min(y1, y2);
        const bh = Math.max(34, baseY - y);
        rr(ctx, x1, y, width, bh, 14);
        ctx.fill();
      }
      bx += bw;
    });

    // Optional live traces over preview.
    const sampleStart = samples[0] ? new Date(samples[0].time).getTime() : null;
    const sampleValues = samples.map(s=>({
      t: sampleStart ? Math.max(0,(new Date(s.time).getTime()-sampleStart)/1000) : Number(s.elapsedWorkoutSec || 0),
      power:Number(s.power),
      hr:Number(s.heartRate)
    }));

    let powerValues = sampleValues.filter(s=>Number.isFinite(s.power)).map(s=>({t:s.t,v:s.power}));
    const hrValues = sampleValues.filter(s=>Number.isFinite(s.hr)).map(s=>({t:s.t,v:s.hr}));

    if(powerValues.length < 2 && typeof targetAt === 'function'){
      const fallback = [];
      const step = Math.max(1,total/260);
      for(let t=0;t<=total;t+=step){
        const target = targetAt(t);
        if(target && Number.isFinite(target.watts)) fallback.push({t,v:target.watts});
      }
      powerValues = fallback;
    }

    const axisMax = Math.max(ftpVal*1.35, summary.maxPower || 0, summary.maxHr || 0, 180);
    function toPoints(values){
      return values
        .filter(p=>Number.isFinite(p.t) && Number.isFinite(p.v))
        .map(p=>({
          x: plotX + Math.max(0,Math.min(1,p.t/total))*plotW,
          y: plotY + plotH - (Math.max(0,Math.min(axisMax,p.v))/axisMax)*plotH
        }));
    }
    drawSmoothTrace(ctx,toPoints(powerValues),{color:'rgba(255,255,255,.92)',width:5,shadow:'rgba(255,255,255,.24)',shadowBlur:8});
    drawSmoothTrace(ctx,toPoints(hrValues),{color:'rgba(251,113,133,.92)',width:4,shadow:'rgba(251,113,133,.22)',shadowBlur:6});

    ctx.restore();

    // Stat strip.
    const stats=[
      {label:'DURATION',value:fmt(duration || total)},
      {label:'AVG POWER',value:summary.avgPower ? `${summary.avgPower}w` : '--'},
      {label:'NP',value:summary.np ? `${summary.np}w` : '--'},
      {label:'AVG HR',value:summary.avgHr ? `${summary.avgHr} bpm` : '--'},
      {label:'TSS',value:Number.isFinite(summary.tss) ? String(summary.tss) : (summary.tss || '0')}
    ];
    const sx=130, sy=930, sw=W-260, col=sw/stats.length;
    stats.forEach((st,i)=>{
      const cx=sx+col*i+col/2;
      if(i>0){
        ctx.strokeStyle='rgba(255,255,255,.18)';
        ctx.lineWidth=2;
        ctx.beginPath();
        ctx.moveTo(sx+col*i,sy-18);
        ctx.lineTo(sx+col*i,sy+128);
        ctx.stroke();
      }
      ctx.textAlign='center';
      ctx.fillStyle='#fff';
      ctx.font='950 52px Inter, Arial, sans-serif';
      ctx.fillText(String(st.value),cx,sy+48);
      ctx.fillStyle='rgba(226,232,240,.72)';
      ctx.font='900 20px Inter, Arial, sans-serif';
      ctx.fillText(st.label,cx,sy+92);
    });

    ctx.textAlign='right';
    ctx.fillStyle='rgba(255,255,255,.56)';
    ctx.font='800 20px Inter, Arial, sans-serif';
    ctx.fillText('truth in training data',W-130,H-102);

    return canvas.toDataURL('image/png');
  };
})();
