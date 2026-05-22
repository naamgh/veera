// Stronger 3:2 share card export for Strava timeline presence.
(function(){
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

  function avg(values){
    const nums=values.filter(v=>Number.isFinite(v));
    return nums.length ? nums.reduce((a,b)=>a+b,0)/nums.length : null;
  }

  function fmt(sec){
    if(typeof formatTime === 'function') return formatTime(sec);
    sec=Math.max(0,Math.round(sec||0));
    const h=Math.floor(sec/3600);
    const m=Math.floor((sec%3600)/60);
    const s=sec%60;
    return h>0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
  }

  function zoneColour(pct){
    if(pct < .56) return '#2563eb';
    if(pct < .76) return '#0891b2';
    if(pct < .91) return '#7c3aed';
    if(pct < 1.06) return '#9333ea';
    if(pct < 1.21) return '#db2777';
    return '#dc2626';
  }

  function drawText(ctx,text,x,y,size,weight='#fff',align='left'){
    ctx.fillStyle=weight;
    ctx.textAlign=align;
    ctx.textBaseline='alphabetic';
    ctx.font=`900 ${size}px Inter, Arial, sans-serif`;
    ctx.fillText(String(text),x,y);
  }

  window.workoutShareImageDataUrl = function(reason='completed'){
    const W=1800;
    const H=1200; // 3:2
    const canvas=document.createElement('canvas');
    canvas.width=W;
    canvas.height=H;
    const ctx=canvas.getContext('2d');

    const summary=typeof getRideSummary === 'function' ? getRideSummary() : {};
    const duration=summary.duration || (typeof currentElapsed==='function' ? Math.round(currentElapsed()) : 0) || (typeof totalDuration==='function' ? totalDuration() : 0);
    const total=Math.max(1, (typeof totalDuration==='function' ? totalDuration() : duration) || duration || 1);
    const ftpVal=typeof ftp === 'function' ? Math.max(1, ftp()) : 250;
    const blocks=Array.isArray(window.workout) ? window.workout : (typeof workout !== 'undefined' ? workout : []);
    const samples=Array.isArray(window.rideSamples) ? window.rideSamples : (typeof rideSamples !== 'undefined' ? rideSamples : []);

    // Strong solid gradient background.
    const bg=ctx.createLinearGradient(0,0,W,H);
    bg.addColorStop(0,'#172554');
    bg.addColorStop(.45,'#312e81');
    bg.addColorStop(1,'#0e7490');
    ctx.fillStyle=bg;
    ctx.fillRect(0,0,W,H);

    // Bold mesh accents, less washed-out than previous share card.
    ctx.save();
    ctx.globalCompositeOperation='screen';
    ctx.filter='blur(42px) saturate(1.35)';
    let g=ctx.createRadialGradient(240,140,40,420,260,680);
    g.addColorStop(0,'rgba(56,189,248,.92)');
    g.addColorStop(.5,'rgba(59,130,246,.50)');
    g.addColorStop(1,'rgba(59,130,246,0)');
    ctx.fillStyle=g;ctx.fillRect(-120,-120,W+240,H+240);
    g=ctx.createRadialGradient(1580,160,70,1320,330,780);
    g.addColorStop(0,'rgba(168,85,247,.88)');
    g.addColorStop(.55,'rgba(236,72,153,.44)');
    g.addColorStop(1,'rgba(236,72,153,0)');
    ctx.fillStyle=g;ctx.fillRect(-120,-120,W+240,H+240);
    g=ctx.createRadialGradient(980,1150,100,900,880,700);
    g.addColorStop(0,'rgba(34,211,238,.70)');
    g.addColorStop(1,'rgba(34,211,238,0)');
    ctx.fillStyle=g;ctx.fillRect(-120,-120,W+240,H+240);
    ctx.restore();
    ctx.filter='none';

    // Main dark glass card.
    ctx.save();
    ctx.shadowColor='rgba(0,0,0,.34)';
    ctx.shadowBlur=42;
    ctx.shadowOffsetY=26;
    ctx.fillStyle='rgba(15,23,42,.74)';
    rr(ctx,70,70,W-140,H-140,54);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle='rgba(255,255,255,.22)';
    ctx.lineWidth=2;
    rr(ctx,70,70,W-140,H-140,54);
    ctx.stroke();

    // Header.
    const name=(typeof loadedName !== 'undefined' && loadedName) ? loadedName : 'Veera Workout';
    drawText(ctx,'veera',130,162,44,'rgba(255,255,255,.86)');
    ctx.font='900 58px Inter, Arial, sans-serif';
    ctx.fillStyle='#fff';
    ctx.textAlign='left';
    ctx.fillText(name,130,242);
    ctx.font='800 24px Inter, Arial, sans-serif';
    ctx.fillStyle='rgba(226,232,240,.78)';
    ctx.fillText(reason === 'stopped' ? 'Workout stopped' : 'Workout complete',130,286);

    // Preview panel.
    const px=130, py=335, pw=W-260, ph=515;
    ctx.fillStyle='rgba(2,6,23,.54)';
    rr(ctx,px,py,pw,ph,42);
    ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.16)';
    ctx.lineWidth=2;
    ctx.stroke();

    const padX=48, padY=44;
    const plotX=px+padX, plotY=py+padY;
    const plotW=pw-padX*2, plotH=ph-padY*2;

    // Solid workout blocks.
    const maxPct=Math.max(1.25,...blocks.map(b=>{
      if(b.high!==undefined || b.low!==undefined) return ((Number(b.low||b.power||0)+Number(b.high||b.power||0))/2);
      return Number(b.power||0);
    }));
    let bx=plotX;
    blocks.forEach(b=>{
      const dur=Number(b.duration||0);
      const bw=Math.max(8,(dur/total)*plotW);
      const pct=(b.high!==undefined || b.low!==undefined) ? ((Number(b.low||b.power||0)+Number(b.high||b.power||0))/2) : Number(b.power||0);
      const bh=Math.max(34,Math.min(plotH,(pct/maxPct)*(plotH-18)));
      const by=plotY+plotH-bh;
      ctx.fillStyle=zoneColour(pct);
      rr(ctx,bx+3,by,Math.max(4,bw-6),bh,16);
      ctx.fill();
      bx+=bw;
    });

    // Overlay live traces for performance feel.
    const sampleStart=samples[0] ? new Date(samples[0].time).getTime() : null;
    const sampleValues=samples.map(s=>({
      t: sampleStart ? Math.max(0,(new Date(s.time).getTime()-sampleStart)/1000) : 0,
      power:Number(s.power),
      hr:Number(s.heartRate)
    }));
    let powerValues=sampleValues.filter(s=>Number.isFinite(s.power)).map(s=>({t:s.t,v:s.power}));
    if(powerValues.length<2 && typeof targetAt === 'function'){
      const arr=[];
      const step=Math.max(1,total/280);
      for(let t=0;t<=total;t+=step){
        const target=targetAt(t);
        if(target) arr.push({t,v:target.watts});
      }
      powerValues=arr;
    }
    const hrValues=sampleValues.filter(s=>Number.isFinite(s.hr)).map(s=>({t:s.t,v:s.hr}));
    const axisMax=Math.max(ftpVal*1.35,summary.maxPower||0,summary.maxHr||0,180);

    function trace(values,color,width){
      const clean=values.filter(v=>Number.isFinite(v.v)&&Number.isFinite(v.t));
      if(clean.length<2) return;
      ctx.save();
      ctx.strokeStyle=color;
      ctx.lineWidth=width;
      ctx.lineCap='round';
      ctx.lineJoin='round';
      ctx.shadowColor=color;
      ctx.shadowBlur=8;
      ctx.beginPath();
      clean.forEach((pt,i)=>{
        const x=plotX+Math.max(0,Math.min(1,pt.t/total))*plotW;
        const y=plotY+plotH-(Math.max(0,Math.min(axisMax,pt.v))/axisMax)*plotH;
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      });
      ctx.stroke();
      ctx.restore();
    }
    trace(powerValues,'rgba(255,255,255,.92)',5);
    trace(hrValues,'rgba(251,113,133,.92)',4);

    // Stat strip.
    const stats=[
      {label:'DURATION',value:fmt(duration)},
      {label:'AVG POWER',value:summary.avgPower?`${summary.avgPower}w`:'--'},
      {label:'NP',value:summary.np?`${summary.np}w`:'--'},
      {label:'AVG HR',value:summary.avgHr?`${summary.avgHr} bpm`:'--'},
      {label:'TSS',value:Number.isFinite(summary.tss)?String(summary.tss):(summary.tss||'0')}
    ];
    const sx=130, sy=930, sw=W-260, col=sw/stats.length;
    stats.forEach((st,i)=>{
      const cx=sx+col*i+col/2;
      if(i>0){ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(sx+col*i,sy-18);ctx.lineTo(sx+col*i,sy+128);ctx.stroke();}
      ctx.textAlign='center';
      ctx.fillStyle='#fff';
      ctx.font='950 52px Inter, Arial, sans-serif';
      ctx.fillText(st.value,cx,sy+48);
      ctx.fillStyle='rgba(226,232,240,.72)';
      ctx.font='900 20px Inter, Arial, sans-serif';
      ctx.fillText(st.label,cx,sy+92);
    });

    // Small footer mark.
    ctx.textAlign='right';
    ctx.fillStyle='rgba(255,255,255,.56)';
    ctx.font='800 20px Inter, Arial, sans-serif';
    ctx.fillText('truth in training data',W-130,H-102);

    return canvas.toDataURL('image/png');
  };
})();
