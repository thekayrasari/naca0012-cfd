// ============================================================
// RENDERER — Field Visualization & Overlay Drawing
// ============================================================

// Canvas elements (set up in main.js)
var simCanvas, simCtx, simSize;

// Offscreen LBM pixel buffer
var offscreenCanvas = document.createElement('canvas');
offscreenCanvas.width = Nx;
offscreenCanvas.height = Ny;
var offCtx = offscreenCanvas.getContext('2d');
var offImg = offCtx.createImageData(Nx, Ny);
var offBuf = new ArrayBuffer(Nx * Ny * 4);
var offBuf8 = new Uint8ClampedArray(offBuf);
var offBuf32 = new Uint32Array(offBuf);

/**
 * Setup high-DPI scaling for a canvas element.
 * Returns the CSS dimensions { width, height }.
 */
function setupCanvasDPI(c) {
  var rect = c.getBoundingClientRect();
  var dpi = window.devicePixelRatio || 1;
  c.width = rect.width * dpi;
  c.height = rect.height * dpi;
  var context = c.getContext('2d');
  context.scale(dpi, dpi);
  return { width: rect.width, height: rect.height };
}

/**
 * Render the background field (velocity, pressure, vorticity, or none)
 * to the offscreen pixel buffer, then blit onto the main canvas.
 */
function renderField() {
  // Clear offscreen pixel buffer
  var bgHex = simState.canvasTheme === 'light' ? 0xFFFCFAFA : 0xFF0B0F19; // Light grey vs dark navy
  if (simState.bgFieldType === 'none') {
    offBuf32.fill(bgHex);
  } else {
    for (var i = 0; i < numCells; i++) {
      if (solid[i]) {
        // Write solid background
        offBuf32[i] = simState.canvasTheme === 'light' ? 0xFF786B53 : 0xFF332F2A; // Slate blue vs dark slate
        continue;
      }

      var ux = u_x_grid[i];
      var uy = u_y_grid[i];
      var rho = rho_grid[i];

      if (simState.bgFieldType === 'velocity') {
        var speed = Math.sqrt(ux*ux + uy*uy);
        // Normalized relative to max expected flow speed
        var val = Math.min(255, Math.round((speed / 0.12) * 255));
        offBuf32[i] = velocityLUT[val];
      }
      else if (simState.bgFieldType === 'pressure') {
        // Pressure variation around p_infinity = 1/3
        // Scale density range [0.93, 1.07] to [0, 255]
        var val = Math.min(255, Math.max(0, Math.round((rho - 0.93) / 0.14 * 255)));
        offBuf32[i] = pressureLUT[val];
      }
      else if (simState.bgFieldType === 'vorticity') {
        var x = i % Nx;
        var y = Math.floor(i / Nx);
        var vort = computeVorticity(x, y);
        // Map vorticity range [-0.05, 0.05] to [0, 255]
        var val = Math.min(255, Math.max(0, Math.round((vort + 0.05) / 0.10 * 255)));
        offBuf32[i] = vorticityLUT[val];
      }
    }
  }

  // Copy buffer to offscreen canvas
  offImg.data.set(offBuf8);
  offCtx.putImageData(offImg, 0, 0);

  // Draw offscreen canvas stretched onto main canvas
  simCtx.clearRect(0, 0, simSize.width, simSize.height);
  simCtx.imageSmoothingEnabled = true;
  simCtx.drawImage(offscreenCanvas, 0, 0, simSize.width, simSize.height);
}

/**
 * Render overlays on top of the field: streamlines, particles,
 * and the vector airfoil shape.
 */
function renderOverlay() {
  var scaleX = simSize.width / Nx;
  var scaleY = simSize.height / Ny;

  // 1. Draw Static Streamlines
  if (simState.overlayType === 'streamlines') {
    simCtx.lineWidth = 1.2;
    simCtx.strokeStyle = simState.canvasTheme === 'light' ? 'rgba(83, 107, 120, 0.45)' : 'rgba(110, 231, 183, 0.55)';

    var numStreamlines = 22;
    var dt = 0.8;

    for (var s = 0; s < numStreamlines; s++) {
      var px = 0;
      var py = (s + 0.5) * (Ny / numStreamlines);

      simCtx.beginPath();
      simCtx.moveTo(px * scaleX, py * scaleY);

      for (var step = 0; step < 260; step++) {
        // Bilinear interpolate velocity
        var x0 = Math.floor(px);
        var y0 = Math.floor(py);
        if (x0 < 0) x0 = 0; if (x0 >= Nx - 1) x0 = Nx - 2;
        var y0_p = (y0 % Ny + Ny) % Ny;
        var y1_p = ((y0 + 1) % Ny + Ny) % Ny;
        var tx = px - x0;
        var ty = py - y0;

        var idx00 = y0_p * Nx + x0;
        var idx10 = y0_p * Nx + (x0 + 1);
        var idx01 = y1_p * Nx + x0;
        var idx11 = y1_p * Nx + (x0 + 1);

        var ux = (1 - tx) * (1 - ty) * u_x_grid[idx00] + tx * (1 - ty) * u_x_grid[idx10] + (1 - tx) * ty * u_x_grid[idx01] + tx * ty * u_x_grid[idx11];
        var uy = (1 - tx) * (1 - ty) * u_y_grid[idx00] + tx * (1 - ty) * u_y_grid[idx10] + (1 - tx) * ty * u_y_grid[idx01] + tx * ty * u_y_grid[idx11];

        px += ux * dt;
        py += uy * dt;

        // Stop tracing if particle goes out of bounds or hits obstacle
        if (px < 0 || px >= Nx || py < 0 || py >= Ny) break;

        var gX = Math.round(px);
        var gY = (Math.round(py) % Ny + Ny) % Ny;
        if (solid[gY * Nx + gX]) break;

        simCtx.lineTo(px * scaleX, py * scaleY);
      }
      simCtx.stroke();
    }
  }

  // 2. Draw Moving Tracing Particles
  else if (simState.overlayType === 'particles') {
    simCtx.fillStyle = simState.canvasTheme === 'light' ? 'rgba(83, 107, 120, 0.8)' : 'rgba(6, 182, 212, 0.85)';
    for (var p = 0; p < simState.maxParticles; p++) {
      var sx = p_x[p] * scaleX;
      var sy = p_y[p] * scaleY;

      // Draw small trace circles
      simCtx.beginPath();
      simCtx.arc(sx, sy, 1.5, 0, 2 * Math.PI);
      simCtx.fill();
    }
  }

  // 3. Draw Vector Airfoil (Sleek Brutalist Styling)
  simCtx.beginPath();
  var rad = (simState.aoa * Math.PI) / 180;
  var cosA = Math.cos(rad);
  var sinA = Math.sin(rad);

  for (var i = 0; i <= 60; i++) {
    var xNorm = i / 60;
    var rx = xNorm * chord;
    var ry = chord * (
      0.5946895 * Math.sqrt(xNorm) -
      0.126 * xNorm -
      0.3516 * xNorm * xNorm +
      0.2843 * xNorm * xNorm * xNorm -
      0.1015 * xNorm * xNorm * xNorm * xNorm
    );
    var dx = rx * cosA - ry * sinA;
    var dy = rx * sinA + ry * cosA;

    var sx = (xc + dx) * scaleX;
    var sy = (yc + dy) * scaleY;

    if (i === 0) simCtx.moveTo(sx, sy); else simCtx.lineTo(sx, sy);
  }

  for (var i = 60; i >= 0; i--) {
    var xNorm = i / 60;
    var rx = xNorm * chord;
    var ry = -chord * (
      0.5946895 * Math.sqrt(xNorm) -
      0.126 * xNorm -
      0.3516 * xNorm * xNorm +
      0.2843 * xNorm * xNorm * xNorm -
      0.1015 * xNorm * xNorm * xNorm * xNorm
    );
    var dx = rx * cosA - ry * sinA;
    var dy = rx * sinA + ry * cosA;

    var sx = (xc + dx) * scaleX;
    var sy = (yc + dy) * scaleY;

    simCtx.lineTo(sx, sy);
  }
  simCtx.closePath();

  // Brutalist Style: Slate fill, 2px border
  simCtx.fillStyle = '#536b78';
  simCtx.fill();
  simCtx.lineWidth = 2;
  simCtx.strokeStyle = simState.canvasTheme === 'light' ? '#111827' : '#ffffff';
  simCtx.stroke();
}
