import { useState, useEffect, useRef, useCallback } from "react";

// ── Module-level constants (never change) ──────────────────────────────────
const Nx = 150, Ny = 75, numCells = Nx * Ny;
const CHORD = 40, XC = 35, YC = Math.floor(Ny / 2);
const MAX_PARTICLES_LIMIT = 2500;

function rgbTo32(r, g, b, a = 255) {
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

function nacaYt(xNorm) {
  return CHORD * (
    0.5946895 * Math.sqrt(xNorm) -
    0.126      * xNorm -
    0.3516     * xNorm * xNorm +
    0.2843     * xNorm * xNorm * xNorm -
    0.1015     * xNorm * xNorm * xNorm * xNorm
  );
}

// ── Component ─────────────────────────────────────────────────────────────
export default function AeroDyn() {

  // ── UI state (drives renders) ──────────────────────────────────────────
  const [aoaState,         setAoaState]         = useState(0);
  const [reState,          setReState]          = useState(150);
  const [u0State,          setU0State]          = useState(0.05);
  const [isPausedState,    setIsPausedState]    = useState(false);
  const [bgFieldState,     setBgFieldState]     = useState("velocity");
  const [overlayState,     setOverlayState]     = useState("particles");
  const [themeState,       setThemeState]       = useState("light");
  const [maxPState,        setMaxPState]        = useState(1200);

  // display values
  const [clDisplay,        setClDisplay]        = useState("0.000");
  const [fpsDisplay,       setFpsDisplay]       = useState("00 FPS");
  const [stallDisplay,     setStallDisplay]     = useState("Normal");
  const [isStalling,       setIsStalling]       = useState(false);
  const [themeLabel,       setThemeLabel]       = useState("LATTICE BOLTZMANN SOLVER");

  // ── Canvas refs ────────────────────────────────────────────────────────
  const simCanvasRef = useRef(null);
  const cpCanvasRef  = useRef(null);

  // ── One big ref that holds everything the render loop mutates ──────────
  const S = useRef(null);

  // Initialise the sim-state object exactly once
  if (!S.current) {
    const mk = (n) => new Float32Array(n);
    S.current = {
      // params (kept in sync with React state)
      aoa: 0, Re: 150, u0: 0.05, isPaused: false,
      bgFieldType: "velocity", overlayType: "particles",
      canvasTheme: "light", maxParticles: 1200,
      viscosity: (0.05 * CHORD) / 150,
      tau: 3 * ((0.05 * CHORD) / 150) + 0.5,

      // distribution functions
      f0: mk(numCells), f1: mk(numCells), f2: mk(numCells),
      f3: mk(numCells), f4: mk(numCells), f5: mk(numCells),
      f6: mk(numCells), f7: mk(numCells), f8: mk(numCells),
      f0n: mk(numCells), f1n: mk(numCells), f2n: mk(numCells),
      f3n: mk(numCells), f4n: mk(numCells), f5n: mk(numCells),
      f6n: mk(numCells), f7n: mk(numCells), f8n: mk(numCells),

      // macroscopic
      ux: mk(numCells), uy: mk(numCells), rho: mk(numCells),
      solid: new Uint8Array(numCells),

      // particles
      px: mk(MAX_PARTICLES_LIMIT),
      py: mk(MAX_PARTICLES_LIMIT),
      pl: mk(MAX_PARTICLES_LIMIT),

      // LUTs
      velLUT:  new Uint32Array(256),
      presLUT: new Uint32Array(256),
      vortLUT: new Uint32Array(256),

      // offscreen raster
      offCanvas: null, offCtx: null, offImg: null,
      offBuf8: null, offBuf32: null,

      // canvas sizes (CSS pixels)
      simW: 0, simH: 0, cpW: 0, cpH: 0,

      // perf
      rafId: null, lastPerfTime: 0, frameCount: 0,
      forceSumY: 0,
    };
  }

  // ── Simulation functions (captured in stable callbacks) ────────────────
  const updateSolidMask = useCallback(() => {
    const s = S.current;
    s.solid.fill(0);
    const rad  = (s.aoa * Math.PI) / 180;
    const cosA = Math.cos(rad), sinA = Math.sin(rad);
    for (let y = 0; y < Ny; y++) {
      for (let x = 0; x < Nx; x++) {
        const dx = x - XC, dy = y - YC;
        const rx = dx * cosA + dy * sinA;
        const ry = -dx * sinA + dy * cosA;
        if (rx >= 0 && rx <= CHORD) {
          const xN = rx / CHORD;
          const yt = nacaYt(xN);
          if (Math.abs(ry) <= yt) s.solid[y * Nx + x] = 1;
        }
      }
    }
  }, []);

  const generateLUTs = useCallback(() => {
    const s = S.current;
    const dark = s.canvasTheme === "dark";
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      // velocity
      if (!dark) {
        s.velLUT[i] = rgbTo32(
          Math.round(240 - 200 * t),
          Math.round(245 - 140 * t),
          Math.round(250 -  50 * t)
        );
      } else {
        let r = 0, g = 0, b = 0;
        if (t < 0.25)       { b = Math.round(t * 4 * 255); }
        else if (t < 0.5)   { g = Math.round((t - 0.25) * 4 * 255); b = 255; }
        else if (t < 0.75)  { r = Math.round((t - 0.5) * 4 * 255); g = 255; b = Math.round((0.75 - t) * 4 * 255); }
        else                { r = 255; g = Math.round((1 - t) * 4 * 255); }
        s.velLUT[i] = rgbTo32(r, g, b);
      }
      // pressure
      if (!dark) {
        if (t < 0.5) {
          const n = t * 2;
          s.presLUT[i] = rgbTo32(Math.round(30 + 215 * n), Math.round(58 + 187 * n), Math.round(138 + 112 * n));
        } else {
          const n = (t - 0.5) * 2;
          s.presLUT[i] = rgbTo32(Math.round(245 + 10 * n), Math.round(245 - 200 * n), Math.round(250 - 210 * n));
        }
      } else {
        if (t < 0.5) {
          const n = t * 2;
          s.presLUT[i] = rgbTo32(Math.round(30 * (1 - n)), Math.round(58 * (1 - n)), Math.round(255 - 230 * n));
        } else {
          const n = (t - 0.5) * 2;
          s.presLUT[i] = rgbTo32(Math.round(25 + 230 * n), 10, Math.round(25 * (1 - n)));
        }
      }
      // vorticity
      if (!dark) {
        if (t < 0.5) {
          const n = t * 2;
          s.vortLUT[i] = rgbTo32(Math.round(2 + 240 * n), Math.round(132 + 113 * n), Math.round(199 + 51 * n));
        } else {
          const n = (t - 0.5) * 2;
          s.vortLUT[i] = rgbTo32(Math.round(242 + 13 * n), Math.round(245 - 188 * n), Math.round(250 - 220 * n));
        }
      } else {
        if (t < 0.5) {
          const n = t * 2;
          s.vortLUT[i] = rgbTo32(0, Math.round(130 * n), Math.round(100 + 155 * n));
        } else {
          const n = (t - 0.5) * 2;
          s.vortLUT[i] = rgbTo32(Math.round(100 + 155 * n), Math.round(130 * (1 - n)), 0);
        }
      }
    }
  }, []);

  const initParticles = useCallback(() => {
    const s = S.current;
    for (let p = 0; p < MAX_PARTICLES_LIMIT; p++) {
      s.px[p] = Math.random() * Nx;
      s.py[p] = Math.random() * Ny;
      s.pl[p] = Math.random();
    }
  }, []);

  const initSimulation = useCallback(() => {
    const s = S.current;
    s.viscosity = (s.u0 * CHORD) / s.Re;
    s.tau = 3 * s.viscosity + 0.5;
    updateSolidMask();
    generateLUTs();
    const u0 = s.u0;
    for (let y = 0; y < Ny; y++) {
      for (let x = 0; x < Nx; x++) {
        const idx = y * Nx + x;
        const ux  = s.solid[idx] ? 0 : u0;
        s.ux[idx] = ux; s.uy[idx] = 0; s.rho[idx] = 1;
        const u2  = ux * ux;
        const u2_15 = 1.5 * u2, ux3 = 3 * ux;
        s.f0[idx] = s.f0n[idx] = (4/9)  * (1 - u2_15);
        s.f1[idx] = s.f1n[idx] = (1/9)  * (1 + ux3 + 4.5 * ux * ux - u2_15);
        s.f2[idx] = s.f2n[idx] = (1/9)  * (1 - u2_15);
        s.f3[idx] = s.f3n[idx] = (1/9)  * (1 - ux3 + 4.5 * ux * ux - u2_15);
        s.f4[idx] = s.f4n[idx] = (1/9)  * (1 - u2_15);
        const up = ux, um = ux;
        s.f5[idx] = s.f5n[idx] = (1/36) * (1 + 3 * up + 4.5 * up * up - u2_15);
        s.f6[idx] = s.f6n[idx] = (1/36) * (1 - 3 * up + 4.5 * up * up - u2_15);  // f6 init = like f7
        s.f7[idx] = s.f7n[idx] = (1/36) * (1 - 3 * up + 4.5 * up * up - u2_15);
        s.f8[idx] = s.f8n[idx] = (1/36) * (1 + 3 * up + 4.5 * up * up - u2_15);
      }
    }
    initParticles();
  }, [updateSolidMask, generateLUTs, initParticles]);

  const solverStep = useCallback(() => {
    const s = S.current;
    const minRho = 0.2, maxRho = 2.0, maxVel = 0.25;
    const Cs = 0.15;
    const Cs_sq_18_sqrt2 = 18 * Cs * Cs * Math.sqrt(2);
    const { f0,f1,f2,f3,f4,f5,f6,f7,f8,
            f0n,f1n,f2n,f3n,f4n,f5n,f6n,f7n,f8n,
            ux: uxg, uy: uyg, rho: rhog, solid, tau } = s;

    for (let y = 0; y < Ny; y++) {
      for (let x = 0; x < Nx; x++) {
        const idx = y * Nx + x;
        if (solid[idx]) continue;

        const f0v=f0[idx],f1v=f1[idx],f2v=f2[idx],f3v=f3[idx],f4v=f4[idx];
        const f5v=f5[idx],f6v=f6[idx],f7v=f7[idx],f8v=f8[idx];

        let rho = f0v+f1v+f2v+f3v+f4v+f5v+f6v+f7v+f8v;
        if (rho < minRho) rho = minRho; else if (rho > maxRho) rho = maxRho;

        let vx = (f1v - f3v + f5v - f6v - f7v + f8v) / rho;
        let vy = (f2v - f4v + f5v + f6v - f7v - f8v) / rho;
        if (vx >  maxVel) vx =  maxVel; else if (vx < -maxVel) vx = -maxVel;
        if (vy >  maxVel) vy =  maxVel; else if (vy < -maxVel) vy = -maxVel;

        uxg[idx] = vx; uyg[idx] = vy; rhog[idx] = rho;

        const u2 = vx*vx + vy*vy, u2_15 = 1.5*u2;
        const vx3 = 3*vx, vy3 = 3*vy;
        const up = vx + vy, um = -vx + vy;

        const f0e=(4/9) *rho*(1         - u2_15);
        const f1e=(1/9) *rho*(1 + vx3   + 4.5*vx*vx - u2_15);
        const f2e=(1/9) *rho*(1 + vy3   + 4.5*vy*vy - u2_15);
        const f3e=(1/9) *rho*(1 - vx3   + 4.5*vx*vx - u2_15);
        const f4e=(1/9) *rho*(1 - vy3   + 4.5*vy*vy - u2_15);
        const f5e=(1/36)*rho*(1 + 3*up  + 4.5*up*up  - u2_15);
        const f6e=(1/36)*rho*(1 + 3*um  + 4.5*um*um  - u2_15);
        const f7e=(1/36)*rho*(1 - 3*up  + 4.5*up*up  - u2_15);
        const f8e=(1/36)*rho*(1 - 3*um  + 4.5*um*um  - u2_15);

        const q0=f0v-f0e,q1=f1v-f1e,q2=f2v-f2e,q3=f3v-f3e,q4=f4v-f4e;
        const q5=f5v-f5e,q6=f6v-f6e,q7=f7v-f7e,q8=f8v-f8e;
        const Qxx=q1+q3+q5+q6+q7+q8, Qyy=q2+q4+q5+q6+q7+q8, Qxy=q5-q6+q7-q8;
        const Qn = Math.sqrt(Qxx*Qxx + Qyy*Qyy + 2*Qxy*Qxy);
        const tl = tau + 0.5*(Math.sqrt(tau*tau + Cs_sq_18_sqrt2*Qn/rho) - tau);
        const om = 1 / tl;

        const f0s=f0v+om*(f0e-f0v), f1s=f1v+om*(f1e-f1v), f2s=f2v+om*(f2e-f2v);
        const f3s=f3v+om*(f3e-f3v), f4s=f4v+om*(f4e-f4v), f5s=f5v+om*(f5e-f5v);
        const f6s=f6v+om*(f6e-f6v), f7s=f7v+om*(f7e-f7v), f8s=f8v+om*(f8e-f8v);

        f0n[idx] = f0s;

        let nx, ny, nid;
        // dir 1 (+x)
        nx = x+1; if (nx < Nx) { nid=y*Nx+nx; if(solid[nid]) f3n[idx]=f1s; else f1n[nid]=f1s; }
        // dir 2 (+y)
        ny=(y+1)%Ny; nid=ny*Nx+x; if(solid[nid]) f4n[idx]=f2s; else f2n[nid]=f2s;
        // dir 3 (-x)
        nx = x-1; if (nx >= 0) { nid=y*Nx+nx; if(solid[nid]) f1n[idx]=f3s; else f3n[nid]=f3s; }
        // dir 4 (-y)
        ny=(y-1+Ny)%Ny; nid=ny*Nx+x; if(solid[nid]) f2n[idx]=f4s; else f4n[nid]=f4s;
        // dir 5 (+x,+y)
        nx=x+1; ny=(y+1)%Ny; if(nx<Nx){ nid=ny*Nx+nx; if(solid[nid]) f7n[idx]=f5s; else f5n[nid]=f5s; }
        // dir 6 (-x,+y)
        nx=x-1; ny=(y+1)%Ny; if(nx>=0){ nid=ny*Nx+nx; if(solid[nid]) f8n[idx]=f6s; else f6n[nid]=f6s; }
        // dir 7 (-x,-y)
        nx=x-1; ny=(y-1+Ny)%Ny; if(nx>=0){ nid=ny*Nx+nx; if(solid[nid]) f5n[idx]=f7s; else f7n[nid]=f7s; }
        // dir 8 (+x,-y)
        nx=x+1; ny=(y-1+Ny)%Ny; if(nx<Nx){ nid=ny*Nx+nx; if(solid[nid]) f6n[idx]=f8s; else f8n[nid]=f8s; }
      }
    }

    // Zou-He inlet
    const u0 = s.u0;
    for (let y = 0; y < Ny; y++) {
      const i = y * Nx;
      let rho = (f0n[i]+f2n[i]+f4n[i]+2*(f3n[i]+f6n[i]+f7n[i]))/(1-u0);
      if (rho<minRho) rho=minRho; else if(rho>maxRho) rho=maxRho;
      f1n[i] = f3n[i] + (2/3)*rho*u0;
      f5n[i] = f7n[i] - 0.5*(f2n[i]-f4n[i]) + (1/6)*rho*u0;
      f8n[i] = f6n[i] + 0.5*(f2n[i]-f4n[i]) + (1/6)*rho*u0;
    }

    // Extrapolation outlet
    for (let y = 0; y < Ny; y++) {
      const i = y*Nx+(Nx-1), j = y*Nx+(Nx-2);
      f0n[i]=f0n[j]; f1n[i]=f1n[j]; f2n[i]=f2n[j]; f3n[i]=f3n[j]; f4n[i]=f4n[j];
      f5n[i]=f5n[j]; f6n[i]=f6n[j]; f7n[i]=f7n[j]; f8n[i]=f8n[j];
    }

    // Swap buffers
    let t;
    t=s.f0;s.f0=s.f0n;s.f0n=t; t=s.f1;s.f1=s.f1n;s.f1n=t;
    t=s.f2;s.f2=s.f2n;s.f2n=t; t=s.f3;s.f3=s.f3n;s.f3n=t;
    t=s.f4;s.f4=s.f4n;s.f4n=t; t=s.f5;s.f5=s.f5n;s.f5n=t;
    t=s.f6;s.f6=s.f6n;s.f6n=t; t=s.f7;s.f7=s.f7n;s.f7n=t;
    t=s.f8;s.f8=s.f8n;s.f8n=t;

    if (isNaN(s.f0[0])) { console.warn("Divergence – resetting"); initSimulation(); }
  }, [initSimulation]);

  const computeVorticity = useCallback((x, y) => {
    const { ux: uxg, uy: uyg } = S.current;
    const xp = Math.min(x+1, Nx-1), xm = Math.max(x-1, 0);
    const yp = (y+1)%Ny, ym = (y-1+Ny)%Ny;
    return (uyg[y*Nx+xp]-uyg[y*Nx+xm])*0.5 - (uxg[yp*Nx+x]-uxg[ym*Nx+x])*0.5;
  }, []);

  const updateParticles = useCallback(() => {
    const s = S.current;
    const { px, py, pl, ux: uxg, uy: uyg, solid, maxParticles } = s;
    for (let p = 0; p < maxParticles; p++) {
      let ppx = px[p], ppy = py[p];
      const x0 = Math.floor(ppx), y0 = Math.floor(ppy);
      const x1 = Math.min(x0+1, Nx-1);
      const y0p = ((y0%Ny)+Ny)%Ny, y1p = (((y0+1)%Ny)+Ny)%Ny;
      const tx = ppx-x0, ty = ppy-y0;
      const i00=y0p*Nx+x0,i10=y0p*Nx+x1,i01=y1p*Nx+x0,i11=y1p*Nx+x1;
      const vx=(1-tx)*(1-ty)*uxg[i00]+tx*(1-ty)*uxg[i10]+(1-tx)*ty*uxg[i01]+tx*ty*uxg[i11];
      const vy=(1-tx)*(1-ty)*uyg[i00]+tx*(1-ty)*uyg[i10]+(1-tx)*ty*uyg[i01]+tx*ty*uyg[i11];
      ppx += vx; ppy += vy;
      const gx=Math.round(ppx), gy=((Math.round(ppy)%Ny)+Ny)%Ny;
      const hit = gx>=0&&gx<Nx&&solid[gy*Nx+gx];
      pl[p] -= 0.00015 + Math.random()*0.00015;
      if (ppx>=Nx-1||ppx<=0||ppy<0||ppy>=Ny||hit||pl[p]<=0) {
        px[p]=0; py[p]=Math.random()*Ny; pl[p]=1;
      } else { px[p]=ppx; py[p]=ppy; }
    }
  }, []);

  const renderField = useCallback(() => {
    const s = S.current;
    const { offBuf32, offBuf8, offImg, offCtx, velLUT, presLUT, vortLUT,
            solid, ux: uxg, uy: uyg, rho: rhog, bgFieldType, canvasTheme } = s;
    const bgHex = canvasTheme==="light" ? 0xFFFCFAFA : 0xFF0B0F19;
    const solidHex = canvasTheme==="light" ? 0xFF786B53 : 0xFF332F2A;
    if (bgFieldType === "none") {
      offBuf32.fill(bgHex);
    } else {
      for (let i = 0; i < numCells; i++) {
        if (solid[i]) { offBuf32[i]=solidHex; continue; }
        const vx=uxg[i], vy=uyg[i], rho=rhog[i];
        if (bgFieldType === "velocity") {
          const sp = Math.sqrt(vx*vx+vy*vy);
          offBuf32[i] = velLUT[Math.min(255, Math.round(sp/0.12*255))];
        } else if (bgFieldType === "pressure") {
          offBuf32[i] = presLUT[Math.min(255, Math.max(0, Math.round((rho-0.93)/0.14*255)))];
        } else if (bgFieldType === "vorticity") {
          const x=i%Nx, y=Math.floor(i/Nx);
          const vort = computeVorticity(x,y);
          offBuf32[i] = vortLUT[Math.min(255, Math.max(0, Math.round((vort+0.05)/0.10*255)))];
        }
      }
    }
    offImg.data.set(offBuf8);
    offCtx.putImageData(offImg, 0, 0);
    const ctx = simCanvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, s.simW, s.simH);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(s.offCanvas, 0, 0, s.simW, s.simH);
  }, [computeVorticity]);

  const renderOverlay = useCallback(() => {
    const s = S.current;
    const ctx = simCanvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { solid, ux: uxg, uy: uyg, px, py, maxParticles, overlayType, canvasTheme, aoa } = s;
    const scX = s.simW / Nx, scY = s.simH / Ny;

    if (overlayType === "streamlines") {
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = canvasTheme==="light" ? "rgba(83,107,120,0.45)" : "rgba(110,231,183,0.55)";
      const nSL = 22, dt = 0.8;
      for (let sl = 0; sl < nSL; sl++) {
        let ppx=0, ppy=(sl+0.5)*(Ny/nSL);
        ctx.beginPath(); ctx.moveTo(ppx*scX, ppy*scY);
        for (let st = 0; st < 260; st++) {
          let x0=Math.floor(ppx), y0=Math.floor(ppy);
          if(x0<0)x0=0; if(x0>=Nx-1)x0=Nx-2;
          const y0p=((y0%Ny)+Ny)%Ny, y1p=(((y0+1)%Ny)+Ny)%Ny;
          const tx=ppx-x0, ty=ppy-y0;
          const i00=y0p*Nx+x0,i10=y0p*Nx+(x0+1),i01=y1p*Nx+x0,i11=y1p*Nx+(x0+1);
          const vx=(1-tx)*(1-ty)*uxg[i00]+tx*(1-ty)*uxg[i10]+(1-tx)*ty*uxg[i01]+tx*ty*uxg[i11];
          const vy=(1-tx)*(1-ty)*uyg[i00]+tx*(1-ty)*uyg[i10]+(1-tx)*ty*uyg[i01]+tx*ty*uyg[i11];
          ppx+=vx*dt; ppy+=vy*dt;
          if(ppx<0||ppx>=Nx||ppy<0||ppy>=Ny) break;
          const gx=Math.round(ppx),gy=((Math.round(ppy)%Ny)+Ny)%Ny;
          if(solid[gy*Nx+gx]) break;
          ctx.lineTo(ppx*scX, ppy*scY);
        }
        ctx.stroke();
      }
    } else if (overlayType === "particles") {
      ctx.fillStyle = canvasTheme==="light" ? "rgba(83,107,120,0.8)" : "rgba(6,182,212,0.85)";
      for (let p = 0; p < maxParticles; p++) {
        ctx.beginPath(); ctx.arc(px[p]*scX, py[p]*scY, 1.5, 0, 2*Math.PI); ctx.fill();
      }
    }

    // Draw airfoil outline
    const rad=aoa*Math.PI/180, cosA=Math.cos(rad), sinA=Math.sin(rad);
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const xN=i/60, rx=xN*CHORD, ry=nacaYt(xN);
      const dx=rx*cosA-ry*sinA, dy=rx*sinA+ry*cosA;
      const sx=(XC+dx)*scX, sy=(YC+dy)*scY;
      i===0 ? ctx.moveTo(sx,sy) : ctx.lineTo(sx,sy);
    }
    for (let i = 60; i >= 0; i--) {
      const xN=i/60, rx=xN*CHORD, ry=-nacaYt(xN);
      const dx=rx*cosA-ry*sinA, dy=rx*sinA+ry*cosA;
      ctx.lineTo((XC+dx)*scX, (YC+dy)*scY);
    }
    ctx.closePath();
    ctx.fillStyle = "#536b78"; ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = canvasTheme==="light" ? "#111827" : "#ffffff";
    ctx.stroke();
  }, []);

  const calculateAerodynamics = useCallback(() => {
    const s = S.current;
    const { rho: rhog, aoa, u0 } = s;
    const pInf = 1/3;
    const rad=aoa*Math.PI/180, cosA=Math.cos(rad), sinA=Math.sin(rad);
    let sumTop=0, sumBot=0;
    for (let i = 0; i < CHORD; i++) {
      const xN=i/(CHORD-1), rx=xN*CHORD, ry=nacaYt(xN);
      const dxT=rx*cosA-ry*sinA, dyT=rx*sinA+ry*cosA;
      const gxT=Math.round(XC+dxT+sinA*1.2), gyT=Math.round(YC+dyT-cosA*1.2);
      const dxB=rx*cosA+ry*sinA, dyB=rx*sinA-ry*cosA;
      const gxB=Math.round(XC+dxB-sinA*1.2), gyB=Math.round(YC+dyB+cosA*1.2);
      const getP = (gx,gy) => {
        const gyw=((gy%Ny)+Ny)%Ny;
        return (gx>=0&&gx<Nx) ? rhog[gyw*Nx+gx]/3 : pInf;
      };
      sumTop += getP(gxT,gyT); sumBot += getP(gxB,gyB);
    }
    s.forceSumY = sumBot - sumTop;
    const dyn = 0.5*u0*u0*CHORD;
    const cl = dyn > 1e-6 ? s.forceSumY/dyn : 0;
    setClDisplay(cl.toFixed(3));
    const stalling = Math.abs(aoa) >= 12;
    setStallDisplay(stalling ? "Stall Warning" : "Normal");
    setIsStalling(stalling);
  }, []);

  const renderCpPlot = useCallback(() => {
    const s = S.current;
    const cpCanvas = cpCanvasRef.current;
    if (!cpCanvas) return;
    const ctx = cpCanvas.getContext("2d");
    const W = s.cpW, H = s.cpH;
    const mL=50,mR=15,mT=25,mB=25;
    const gW=W-mL-mR, gH=H-mT-mB;
    const minCpY=-1.5, maxCpY=3.0;
    const getY = (cp) => {
      const t = (-cp - minCpY)/(maxCpY-minCpY);
      return mT + gH*(1-t);
    };
    ctx.fillStyle="#fff"; ctx.fillRect(0,0,W,H);
    const yZero=getY(0);
    ctx.strokeStyle="#e2e8f0"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(mL,yZero); ctx.lineTo(mL+gW,yZero); ctx.stroke();
    const ticks=[-1,0,1,2];
    ctx.fillStyle="#64748b"; ctx.font="9px monospace";
    ctx.textAlign="right"; ctx.textBaseline="middle";
    ticks.forEach(tick => {
      const yT=getY(tick);
      if(yT>=mT&&yT<=mT+gH) {
        ctx.strokeStyle="#f1f5f9"; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(mL,yT); ctx.lineTo(mL+gW,yT); ctx.stroke();
        ctx.fillStyle="#64748b"; ctx.fillText(tick.toFixed(1), mL-8, yT);
      }
    });
    ctx.strokeStyle="#536b78"; ctx.lineWidth=2;
    ctx.strokeRect(mL,mT,gW,gH);
    ctx.fillStyle="#536b78"; ctx.font="10px sans-serif"; ctx.textAlign="center";
    ctx.fillText("Leading Edge (0%)", mL+5, H-8);
    ctx.fillText("Trailing Edge (100%)", mL+gW-5, H-8);
    ctx.save(); ctx.translate(12,H/2); ctx.rotate(-Math.PI/2);
    ctx.fillText("-Cp (Suction ↑)", 0, 0); ctx.restore();
    const { rho: rhog, aoa, u0 } = s;
    const rad=aoa*Math.PI/180, cosA=Math.cos(rad), sinA=Math.sin(rad);
    const pInf=1/3, dyn=0.5*u0*u0;
    const cpTop=[], cpBot=[];
    for (let i = 0; i < CHORD; i++) {
      const xN=i/(CHORD-1), rx=xN*CHORD, ry=nacaYt(xN);
      const dxT=rx*cosA-ry*sinA, dyT=rx*sinA+ry*cosA;
      const gxT=Math.round(XC+dxT+sinA*1.2), gyT=Math.round(YC+dyT-cosA*1.2);
      const dxB=rx*cosA+ry*sinA, dyB=rx*sinA-ry*cosA;
      const gxB=Math.round(XC+dxB-sinA*1.2), gyB=Math.round(YC+dyB+cosA*1.2);
      const getP=(gx,gy)=>{const gyw=((gy%Ny)+Ny)%Ny;return (gx>=0&&gx<Nx)?rhog[gyw*Nx+gx]/3:pInf;};
      const pT=getP(gxT,gyT), pB=getP(gxB,gyB);
      const vT=dyn>1e-6?(pT-pInf)/dyn:0, vB=dyn>1e-6?(pB-pInf)/dyn:0;
      cpTop.push({x:xN,y:vT}); cpBot.push({x:xN,y:vB});
    }
    if (cpTop.length) {
      ctx.strokeStyle="#536b78"; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(mL+cpTop[0].x*gW, getY(cpTop[0].y));
      for(let i=1;i<cpTop.length;i++) ctx.lineTo(mL+cpTop[i].x*gW, getY(cpTop[i].y));
      ctx.stroke();
    }
    if (cpBot.length) {
      ctx.strokeStyle="#ef4444"; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(mL+cpBot[0].x*gW, getY(cpBot[0].y));
      for(let i=1;i<cpBot.length;i++) ctx.lineTo(mL+cpBot[i].x*gW, getY(cpBot[i].y));
      ctx.stroke();
    }
    ctx.font="9px monospace"; ctx.textAlign="left";
    ctx.fillStyle="#536b78"; ctx.fillRect(mL+20,mT+12,10,6);
    ctx.fillStyle="#64748b"; ctx.fillText("Upper Surface",mL+35,mT+16);
    ctx.fillStyle="#ef4444"; ctx.fillRect(mL+120,mT+12,10,6);
    ctx.fillStyle="#64748b"; ctx.fillText("Lower Surface",mL+135,mT+16);
  }, []);

  const setupDPI = useCallback((canvas) => {
    const rect = canvas.getBoundingClientRect();
    const dpi = window.devicePixelRatio || 1;
    canvas.width  = rect.width  * dpi;
    canvas.height = rect.height * dpi;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpi, dpi);
    return { width: rect.width, height: rect.height };
  }, []);

  // ── Ink inject helper ──────────────────────────────────────────────────
  const injectInkAt = useCallback((lx, ly) => {
    const s = S.current;
    for (let i = 0; i < 15; i++) {
      const idx = Math.floor(Math.random() * s.maxParticles);
      s.px[idx] = lx + (Math.random()-0.5)*1.5;
      s.py[idx] = (ly + (Math.random()-0.5)*1.5 + Ny) % Ny;
      s.pl[idx] = 1;
    }
  }, []);

  // ── Mount / unmount ────────────────────────────────────────────────────
  useEffect(() => {
    const s = S.current;
    const simCanvas = simCanvasRef.current;
    const cpCanvas  = cpCanvasRef.current;

    // Offscreen buffer
    const off = document.createElement("canvas");
    off.width = Nx; off.height = Ny;
    const offCtx = off.getContext("2d");
    const offImg = offCtx.createImageData(Nx, Ny);
    const buf = new ArrayBuffer(Nx * Ny * 4);
    s.offCanvas = off; s.offCtx = offCtx; s.offImg = offImg;
    s.offBuf8 = new Uint8ClampedArray(buf);
    s.offBuf32 = new Uint32Array(buf);

    // Canvas sizes
    const resizeCanvases = () => {
      const { width: sw, height: sh } = setupDPI(simCanvas);
      s.simW = sw; s.simH = sh;
      const { width: cw, height: ch } = setupDPI(cpCanvas);
      s.cpW = cw; s.cpH = ch;
    };
    resizeCanvases();
    window.addEventListener("resize", resizeCanvases);

    initSimulation();

    // Render loop
    let lastTime = performance.now(), frameCount = 0;
    const loop = () => {
      if (!s.isPaused) {
        for (let st = 0; st < 3; st++) solverStep();
        if (s.overlayType === "particles") updateParticles();
      }
      renderField();
      renderOverlay();
      calculateAerodynamics();
      renderCpPlot();
      frameCount++;
      const now = performance.now();
      if (now >= lastTime + 1000) {
        const fps = Math.round((frameCount * 1000) / (now - lastTime));
        setFpsDisplay(`${fps} FPS`);
        frameCount = 0; lastTime = now;
      }
      s.rafId = requestAnimationFrame(loop);
    };
    s.rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(s.rafId);
      window.removeEventListener("resize", resizeCanvases);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Control handlers ───────────────────────────────────────────────────
  const handleAoA = (e) => {
    const v = parseInt(e.target.value);
    setAoaState(v); S.current.aoa = v; updateSolidMask();
  };
  const handleRe = (e) => {
    const v = parseInt(e.target.value);
    setReState(v); S.current.Re = v;
    S.current.viscosity = (S.current.u0 * CHORD) / v;
    S.current.tau = 3 * S.current.viscosity + 0.5;
  };
  const handleU0 = (e) => {
    const v = parseFloat(e.target.value);
    setU0State(v); S.current.u0 = v;
    S.current.viscosity = (v * CHORD) / S.current.Re;
    S.current.tau = 3 * S.current.viscosity + 0.5;
  };
  const handleMaxP = (e) => {
    const v = parseInt(e.target.value);
    setMaxPState(v); S.current.maxParticles = v;
  };
  const handleBgField = (e) => { setBgFieldState(e.target.value); S.current.bgFieldType = e.target.value; };
  const handleOverlay = (e) => { setOverlayState(e.target.value); S.current.overlayType = e.target.value; };
  const handleTheme = (e) => {
    const v = e.target.value; setThemeState(v); S.current.canvasTheme = v;
    setThemeLabel(v === "light" ? "LATTICE BOLTZMANN SOLVER" : "WIND TUNNEL SOLVER [DARK]");
    generateLUTs();
  };
  const handlePlayPause = () => {
    const next = !S.current.isPaused;
    S.current.isPaused = next; setIsPausedState(next);
  };
  const handleStep = () => {
    if (S.current.isPaused) {
      solverStep();
      if (S.current.overlayType === "particles") updateParticles();
    }
  };
  const handleResetParticles = () => initParticles();
  const handleReset = () => initSimulation();

  // canvas mouse/touch
  const canvasPointerDown = (e) => {
    const rect = simCanvasRef.current.getBoundingClientRect();
    const lx = (e.clientX - rect.left) / rect.width * Nx;
    const ly = (e.clientY - rect.top)  / rect.height * Ny;
    injectInkAt(lx, ly);
  };
  const canvasPointerMove = (e) => {
    if (e.buttons !== 1) return;
    const rect = simCanvasRef.current.getBoundingClientRect();
    injectInkAt((e.clientX-rect.left)/rect.width*Nx, (e.clientY-rect.top)/rect.height*Ny);
  };
  const canvasTouchStart = (e) => {
    const rect = simCanvasRef.current.getBoundingClientRect();
    const t = e.touches[0];
    injectInkAt((t.clientX-rect.left)/rect.width*Nx, (t.clientY-rect.top)/rect.height*Ny);
  };
  const canvasTouchMove = (e) => {
    e.preventDefault();
    const rect = simCanvasRef.current.getBoundingClientRect();
    const t = e.touches[0];
    injectInkAt((t.clientX-rect.left)/rect.width*Nx, (t.clientY-rect.top)/rect.height*Ny);
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=Roboto+Mono:wght@400;500;700&display=swap');
        :root {
          --primary:#536b78;--primary-fg:#cee5f2;--accent:#2F3037;
          --font-sans:Inter,sans-serif;--font-mono:"Roboto Mono",monospace;
        }
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:var(--font-sans);font-size:16px;color:#111827;background:#f7f9fb;padding:32px;min-height:100vh}
        .title-container{display:flex;flex-direction:column;margin-bottom:24px;border-bottom:2px solid var(--primary);padding-bottom:16px}
        .main-heading{font-family:var(--font-sans);font-size:clamp(48px,6vw,160px);font-weight:900;line-height:clamp(48px,6vw,130px);letter-spacing:-6px;color:var(--primary);text-transform:uppercase}
        .sub-heading{font-family:var(--font-mono);font-size:14px;font-weight:700;letter-spacing:2px;color:var(--primary);text-transform:uppercase;margin-top:4px}
        .dashboard-grid{display:grid;grid-template-columns:1fr;gap:24px}
        @media(min-width:1024px){.dashboard-grid{grid-template-columns:3fr 2fr}}
        .card{background:#fff;border:2px solid var(--primary);padding:24px;box-shadow:0 4px 12px rgba(0,0,0,.05);margin-bottom:16px;position:relative}
        .card-title{font-size:14px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:var(--primary);border-bottom:1px solid rgba(83,107,120,.05);padding-bottom:4px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}
        .canvas-container{position:relative;width:100%;background:#000;border:2px solid var(--primary);overflow:hidden;aspect-ratio:2/1}
        .canvas-container canvas{display:block;width:100%;height:100%;image-rendering:pixelated}
        .canvas-overlay-indicator{position:absolute;top:12px;left:12px;background:rgba(0,0,0,.7);color:#fff;font-family:var(--font-mono);font-size:11px;padding:4px 8px;border:1px solid rgba(255,255,255,.2);pointer-events:none}
        button{font-family:var(--font-sans);font-size:13px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--primary);background:#fff;border:2px solid var(--primary);padding:8px 14px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:.15s cubic-bezier(.4,0,.2,1);position:relative;overflow:hidden}
        button:hover{background:var(--primary);color:var(--primary-fg)}
        button:active{transform:translateY(1px)}
        .btn-danger{color:#b91c1c;border-color:#b91c1c}
        .btn-danger:hover{background:#b91c1c;color:#fff}
        .control-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
        .form-group{margin-bottom:16px}
        .label-row{display:flex;justify-content:space-between;font-size:12px;font-weight:700;text-transform:uppercase;color:var(--primary);margin-bottom:4px}
        .label-val{font-family:var(--font-mono);color:var(--accent)}
        input[type=range]{-webkit-appearance:none;width:100%;height:6px;background:#cee5f2;border:1px solid #536b78;outline:none;margin:10px 0}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:20px;background:#536b78;cursor:pointer;border:1px solid #cee5f2}
        input[type=range]::-moz-range-thumb{width:14px;height:20px;background:#536b78;cursor:pointer;border:1px solid #cee5f2}
        select{width:100%;background:#fff;border:2px solid var(--primary);padding:8px;font-family:var(--font-sans);font-size:13px;font-weight:700;color:var(--primary);outline:none;cursor:pointer;text-transform:uppercase}
        .stats-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:16px}
        @media(min-width:640px){.stats-grid{grid-template-columns:repeat(4,1fr)}.sidebar-column .stats-grid{grid-template-columns:repeat(2,1fr)}}
        .stat-box{border:1px solid var(--primary);padding:8px 16px;background:#fdfdfd}
        .stat-label{font-size:10px;font-weight:700;text-transform:uppercase;color:var(--primary);margin-bottom:2px}
        .stat-value{font-family:var(--font-mono);font-size:18px;font-weight:700;color:var(--accent)}
        .stall-warning{background:#fee2e2!important;border-color:#ef4444!important}
        .stall-warning .stat-label{color:#b91c1c}
        .stall-warning .stat-value{color:#b91c1c}
        .cp-plot-container{width:100%;height:160px;background:#fff;border:1px solid var(--primary);position:relative}
        .cp-plot-container canvas{width:100%;height:100%}
        .banner{background:#fff;border:2px solid var(--primary);border-left-width:6px;padding:16px 24px;margin:24px 0;box-shadow:0 4px 12px rgba(0,0,0,.05)}
        .banner-title{font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:.5px;color:var(--primary);margin-bottom:8px}
        .banner-content{font-size:13px;color:#374151;line-height:20px}
        .banner-content code{font-family:var(--font-mono);background:#eef2f6;padding:2px 4px;font-size:12px}
        footer{text-align:center;margin-top:48px;font-family:var(--font-mono);font-size:11px;color:var(--primary);border-top:1px solid var(--primary);padding-top:16px}
        .badge{font-family:var(--font-sans);font-size:11px;font-weight:700;letter-spacing:.75px;text-transform:uppercase;color:#fff;background:var(--primary);padding:6px 12px;display:inline-block}
        .badge-interactive{background:#0284c7;animation:pulse 2s infinite}
        @keyframes pulse{0%{opacity:.9}50%{opacity:1;transform:scale(1.02)}100%{opacity:.9}}
      `}</style>

      <div className="title-container">
        <h1 className="main-heading">NACA 0012</h1>
        <div className="sub-heading">Real-Time Interactive 2D CFD Wind Tunnel</div>
      </div>

      <div className="dashboard-grid">
        {/* ── Left column ── */}
        <div className="main-column">
          <div className="card">
            <div className="card-title">
              <span>Wind Tunnel Visualizer</span>
              <span className="badge badge-interactive">Drag Mouse to Inject Ink</span>
            </div>
            <div className="canvas-container">
              <canvas
                ref={simCanvasRef}
                onMouseDown={canvasPointerDown}
                onMouseMove={canvasPointerMove}
                onTouchStart={canvasTouchStart}
                onTouchMove={canvasTouchMove}
              />
              <div className="canvas-overlay-indicator">{themeLabel}</div>
            </div>
            <div className="control-actions">
              <button onClick={handlePlayPause}>
                {isPausedState ? (
                  <><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg><span>Resume</span></>
                ) : (
                  <><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg><span>Pause</span></>
                )}
              </button>
              <button onClick={handleStep}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                <span>Step Frame</span>
              </button>
              <button onClick={handleResetParticles}><span>Clear Ink</span></button>
              <button onClick={handleReset} className="btn-danger">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                <span>Reset Wind Tunnel</span>
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-title">
              <span>Chordwise Pressure Distribution</span>
              <span className="badge" style={{background:"#536b78"}}>-Cp vs Chord %</span>
            </div>
            <div className="cp-plot-container">
              <canvas ref={cpCanvasRef} />
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="sidebar-column">
          <div className="card">
            <div className="card-title">Live Telemetry</div>
            <div className="stats-grid">
              <div className={`stat-box${isStalling ? " stall-warning" : ""}`}>
                <div className="stat-label">Lift Coeff (C<sub>l</sub>)</div>
                <div className="stat-value">{clDisplay}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Performance</div>
                <div className="stat-value">{fpsDisplay}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Reynolds (Re)</div>
                <div className="stat-value">{reState}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Stall State</div>
                <div className="stat-value" style={{fontSize:14,textTransform:"uppercase"}}>{stallDisplay}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Wind Tunnel Configurations</div>

            <div className="form-group">
              <div className="label-row">
                <span>Angle of Attack (AoA)</span>
                <span className="label-val">{aoaState > 0 ? "+" : ""}{aoaState}°</span>
              </div>
              <input type="range" min="-20" max="20" value={aoaState} step="1" onChange={handleAoA} />
            </div>

            <div className="form-group">
              <div className="label-row">
                <span>Viscosity / Reynolds</span>
                <span className="label-val">Re = {reState}</span>
              </div>
              <input type="range" min="50" max="800" value={reState} step="10" onChange={handleRe} />
            </div>

            <div className="form-group">
              <div className="label-row">
                <span>Inlet Velocity (u<sub>0</sub>)</span>
                <span className="label-val">{u0State.toFixed(3)}</span>
              </div>
              <input type="range" min="0.01" max="0.08" value={u0State} step="0.005" onChange={handleU0} />
            </div>

            <div className="form-group">
              <div className="label-row">Background Field</div>
              <select value={bgFieldState} onChange={handleBgField}>
                <option value="velocity">Velocity Magnitude</option>
                <option value="pressure">Pressure Distribution</option>
                <option value="vorticity">Vorticity Field (Wake Shedding)</option>
                <option value="none">None (Clean Background)</option>
              </select>
            </div>

            <div className="form-group">
              <div className="label-row">Visual Overlay</div>
              <select value={overlayState} onChange={handleOverlay}>
                <option value="particles">Flow Tracing Particles</option>
                <option value="streamlines">Static Streamlines</option>
                <option value="none">None</option>
              </select>
            </div>

            <div className="form-group">
              <div className="label-row">Tunnel Design Theme</div>
              <select value={themeState} onChange={handleTheme}>
                <option value="light">Light Canvas</option>
                <option value="dark">Dark Canvas</option>
              </select>
            </div>

            {overlayState === "particles" && (
              <div className="form-group">
                <div className="label-row">
                  <span>Max Tracing Particles</span>
                  <span className="label-val">{maxPState}</span>
                </div>
                <input type="range" min="200" max="2500" value={maxPState} step="100" onChange={handleMaxP} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="banner">
        <div className="banner-title">Aerodynamic Context &amp; Solver Physics</div>
        <div className="banner-content">
          <strong>NACA 0012 Airfoil Profile:</strong> Calculated dynamically via half-thickness{" "}
          <code>y_t = 0.5946895√x − 0.126x − 0.3516x² + 0.2843x³ − 0.1015x⁴</code>. Adjusting the Angle of
          Attack rotates the solid boundary cells around the leading edge, regenerating the obstacle mask instantly.
          <br /><br />
          <strong>Lattice Boltzmann Method (LBM D2Q9):</strong> Solving particle probability distributions{" "}
          <code>f<sub>i</sub>(x,t)</code> on a structured lattice grid. Standard bounce-back boundary condition
          is applied on the airfoil surface. Zou-He velocity boundaries drive the inlet; zero-gradient convective
          extrapolation stabilizes the exit. A local <strong>Smagorinsky SGS LES Model</strong> stabilizes wake
          shedding at high Reynolds numbers.
        </div>
      </div>

      <footer>
        AeroDyn 2D Solver Core — Developed with LBM D2Q9 &amp; Smagorinsky Turbulence Closures. Runs entirely client-side.
      </footer>
    </>
  );
}
