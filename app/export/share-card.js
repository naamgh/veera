// Stronger 3:2 share card export.
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

  window.workoutShareImageDataUrl = function(){
    const W = 1800;
    const H = 1200;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const bg = ctx.createLinearGradient(0,0,W,H);
    bg.addColorStop(0,'#172554');
    bg.addColorStop(.45,'#312e81');
    bg.addColorStop(1,'#0e7490');
    ctx.fillStyle = bg;
    ctx.fillRect(0,0,W,H);

    ctx.fillStyle = 'rgba(15,23,42,.74)';
    rr(ctx,70,70,W-140,H-140,54);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = '900 58px Inter, Arial';
    ctx.fillText('Veera Workout',130,220);

    return canvas.toDataURL('image/png');
  };
})();
