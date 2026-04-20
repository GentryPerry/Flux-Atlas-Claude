import { useEffect, useRef } from 'react';

/* ─── Simplex noise 3D (matches design system exactly) ─────────────────── */
const F3 = 1 / 3, G3 = 1 / 6;
const grad3 = [
  [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
  [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
  [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1],
];

function createNoise3D() {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  const permMod12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    permMod12[i] = perm[i] % 12;
  }
  return function noise3D(x, y, z) {
    const s = (x + y + z) * F3;
    const i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
    const t = (i + j + k) * G3;
    const x0 = x - (i - t), y0 = y - (j - t), z0 = z - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0)      { i1=1;j1=0;k1=0;i2=1;j2=1;k2=0; }
      else if (x0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=0;k2=1; }
      else               { i1=0;j1=0;k1=1;i2=1;j2=0;k2=1; }
    } else {
      if (y0 < z0)       { i1=0;j1=0;k1=1;i2=0;j2=1;k2=1; }
      else if (x0 < z0)  { i1=0;j1=1;k1=0;i2=0;j2=1;k2=1; }
      else               { i1=0;j1=1;k1=0;i2=1;j2=1;k2=0; }
    }
    const x1=x0-i1+G3, y1=y0-j1+G3, z1=z0-k1+G3;
    const x2=x0-i2+2*G3, y2=y0-j2+2*G3, z2=z0-k2+2*G3;
    const x3=x0-1+3*G3, y3=y0-1+3*G3, z3=z0-1+3*G3;
    const ii=i&255, jj=j&255, kk=k&255;
    let n0=0,n1=0,n2=0,n3=0;
    let t0=.6-x0*x0-y0*y0-z0*z0; if(t0>=0){const g=grad3[permMod12[ii+perm[jj+perm[kk]]]]; t0*=t0; n0=t0*t0*(g[0]*x0+g[1]*y0+g[2]*z0);}
    let t1=.6-x1*x1-y1*y1-z1*z1; if(t1>=0){const g=grad3[permMod12[ii+i1+perm[jj+j1+perm[kk+k1]]]]; t1*=t1; n1=t1*t1*(g[0]*x1+g[1]*y1+g[2]*z1);}
    let t2=.6-x2*x2-y2*y2-z2*z2; if(t2>=0){const g=grad3[permMod12[ii+i2+perm[jj+j2+perm[kk+k2]]]]; t2*=t2; n2=t2*t2*(g[0]*x2+g[1]*y2+g[2]*z2);}
    let t3=.6-x3*x3-y3*y3-z3*z3; if(t3>=0){const g=grad3[permMod12[ii+1+perm[jj+1+perm[kk+1]]]];   t3*=t3; n3=t3*t3*(g[0]*x3+g[1]*y3+g[2]*z3);}
    return 32*(n0+n1+n2+n3);
  };
}

/* ─── Marching squares ──────────────────────────────────────────────────── */
function marchingSquares(field, cols, rows, threshold, step) {
  const segments = [];
  const val = (x, y) => field[y * cols + x];
  const lerp = (a, b, t) => a + (b - a) * t;
  for (let y = 0; y < rows - 1; y++) {
    for (let x = 0; x < cols - 1; x++) {
      const tl=val(x,y), tr=val(x+1,y), br=val(x+1,y+1), bl=val(x,y+1);
      let code = 0;
      if (tl>=threshold) code|=8;
      if (tr>=threshold) code|=4;
      if (br>=threshold) code|=2;
      if (bl>=threshold) code|=1;
      if (code===0||code===15) continue;
      const top    = lerp(x,   x+1, (threshold-tl)/(tr-tl));
      const bottom = lerp(x,   x+1, (threshold-bl)/(br-bl));
      const left   = lerp(y,   y+1, (threshold-tl)/(bl-tl));
      const right  = lerp(y,   y+1, (threshold-tr)/(br-tr));
      const px = v => v * step;
      const add = (x1,y1,x2,y2) => segments.push([px(x1),px(y1),px(x2),px(y2)]);
      switch(code){
        case 1:  add(x,left,bottom,y+1); break;
        case 2:  add(x+1,right,bottom,y+1); break;
        case 3:  add(x,left,x+1,right); break;
        case 4:  add(top,y,x+1,right); break;
        case 5:  add(top,y,x,left); add(bottom,y+1,x+1,right); break;
        case 6:  add(top,y,bottom,y+1); break;
        case 7:  add(top,y,x,left); break;
        case 8:  add(top,y,x,left); break;
        case 9:  add(top,y,bottom,y+1); break;
        case 10: add(top,y,x+1,right); add(x,left,bottom,y+1); break;
        case 11: add(top,y,x+1,right); break;
        case 12: add(x,left,x+1,right); break;
        case 13: add(x+1,right,bottom,y+1); break;
        case 14: add(x,left,bottom,y+1); break;
      }
    }
  }
  return segments;
}

function chainSegments(segments) {
  const eps = .5, chains = [], used = new Uint8Array(segments.length);
  const near = (a,b,c,d) => Math.abs(a-c)<eps && Math.abs(b-d)<eps;
  for (let s = 0; s < segments.length; s++) {
    if (used[s]) continue;
    used[s] = 1;
    const chain = [[segments[s][0],segments[s][1]],[segments[s][2],segments[s][3]]];
    let changed = true;
    while (changed) {
      changed = false;
      for (let j = 0; j < segments.length; j++) {
        if (used[j]) continue;
        const [ax,ay,bx,by] = segments[j];
        const tail = chain[chain.length-1], head = chain[0];
        if      (near(tail[0],tail[1],ax,ay)) { chain.push([bx,by]); used[j]=1; changed=true; }
        else if (near(tail[0],tail[1],bx,by)) { chain.push([ax,ay]); used[j]=1; changed=true; }
        else if (near(head[0],head[1],bx,by)) { chain.unshift([ax,ay]); used[j]=1; changed=true; }
        else if (near(head[0],head[1],ax,ay)) { chain.unshift([bx,by]); used[j]=1; changed=true; }
      }
    }
    if (chain.length >= 3) chains.push(chain);
  }
  return chains;
}

function drawSmoothChain(ctx, points) {
  if (points.length < 2) return;
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 0; i < points.length - 1; i++) {
    const cx = (points[i][0] + points[i+1][0]) / 2;
    const cy = (points[i][1] + points[i+1][1]) / 2;
    ctx.quadraticCurveTo(points[i][0], points[i][1], cx, cy);
  }
}

/* ─── React component ───────────────────────────────────────────────────── */
export default function TopoBackground({
  opacity    = 0.9,
  lineColor  = '118,138,142',   // r,g,b string — matches design system slate
  levels     = 14,
  step       = 5,
  scale      = 0.0022,
  speed      = 0.00028,
  style      = {},
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const noise3D = createNoise3D();
    let time = 0, raf;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (w <= 0 || h <= 0) return;
      canvas.width  = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function fractalNoise(px, py, t) {
      let value=0, amplitude=1, frequency=1, maxAmp=0;
      for (let o=0; o<3; o++) {
        value += amplitude * noise3D(px*frequency, py*frequency, t);
        maxAmp += amplitude;
        amplitude *= 0.34;
        frequency *= 2;
      }
      return value / maxAmp;
    }

    function draw() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (w <= 0 || h <= 0) { raf = requestAnimationFrame(draw); return; }
      const cols = Math.ceil(w / step) + 1;
      const rows = Math.ceil(h / step) + 1;
      const t    = time * speed;
      const field = new Float64Array(cols * rows);
      for (let y=0; y<rows; y++)
        for (let x=0; x<cols; x++)
          field[y*cols+x] = fractalNoise(x*step*scale, y*step*scale, t);

      ctx.clearRect(0, 0, w, h);

      for (let i=0; i<levels; i++) {
        const th    = -1 + (2/levels)*(i+.5);
        const alpha = 0.105 + 0.13*(1 - Math.abs(i - levels/2)/(levels/2));
        const chains = chainSegments(marchingSquares(field, cols, rows, th, step));
        ctx.strokeStyle = `rgba(${lineColor},${alpha.toFixed(3)})`;
        ctx.lineWidth  = 1.35;
        ctx.lineJoin   = 'round';
        ctx.lineCap    = 'round';
        ctx.beginPath();
        for (const chain of chains) drawSmoothChain(ctx, chain);
        ctx.stroke();
      }

      time++;
      raf = requestAnimationFrame(draw);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    raf = requestAnimationFrame(draw);

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [lineColor, levels, step, scale, speed]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        opacity,
        pointerEvents: 'none',
        ...style,
      }}
    />
  );
}
