// ============================================================
// CP PLOT — Chordwise Pressure Coefficient Distribution
// ============================================================

// Cp canvas elements (set up in main.js)
var cpCanvas, cpCtx, cpSize;

/**
 * Render the live Cp (pressure coefficient) distribution plot.
 * Shows upper surface (slate) and lower surface (red) curves
 * plotted as -Cp vs chord percentage.
 */
function renderCpPlot() {
  // Clear cp graph canvas
  cpCtx.fillStyle = '#ffffff';
  cpCtx.fillRect(0, 0, cpSize.width, cpSize.height);

  var marginL = 50;
  var marginR = 15;
  var marginT = 25;
  var marginB = 25;
  var graphW = cpSize.width - marginL - marginR;
  var graphH = cpSize.height - marginT - marginB;

  // Draw Grid Axes
  cpCtx.strokeStyle = '#e2e8f0';
  cpCtx.lineWidth = 1;
  cpCtx.beginPath();

  // Reference line Cp = 0.0
  // Scale: -Cp goes from -1.5 (bottom) to 3.0 (top)
  var minCpY = -1.5;
  var maxCpY = 3.0;
  var getScreenY = function(cpVal) {
    var valNeg = -cpVal; // negative Cp plotted up
    var t = (valNeg - minCpY) / (maxCpY - minCpY);
    return marginT + graphH * (1.0 - t);
  };

  var yZero = getScreenY(0.0);
  cpCtx.moveTo(marginL, yZero);
  cpCtx.lineTo(marginL + graphW, yZero);
  cpCtx.stroke();

  // Tick markers (Horizontal reference bars)
  var ticks = [-1.0, 0.0, 1.0, 2.0];
  cpCtx.fillStyle = '#64748b';
  cpCtx.font = '9px var(--font-mono)';
  cpCtx.textAlign = 'right';
  cpCtx.textBaseline = 'middle';

  ticks.forEach(function(tick) {
    var yTick = getScreenY(tick);
    if (yTick >= marginT && yTick <= marginT + graphH) {
      // Draw faint guideline
      cpCtx.strokeStyle = '#f1f5f9';
      cpCtx.beginPath();
      cpCtx.moveTo(marginL, yTick);
      cpCtx.lineTo(marginL + graphW, yTick);
      cpCtx.stroke();

      // Label
      cpCtx.fillText(tick.toFixed(1), marginL - 8, yTick);
    }
  });

  // Axis borders
  cpCtx.strokeStyle = '#536b78';
  cpCtx.lineWidth = 2;
  cpCtx.strokeRect(marginL, marginT, graphW, graphH);

  // Label details
  cpCtx.fillStyle = '#536b78';
  cpCtx.font = '10px var(--font-sans)';
  cpCtx.textAlign = 'center';
  cpCtx.fillText("Leading Edge (0%)", marginL + 5, cpSize.height - 8);
  cpCtx.fillText("Trailing Edge (100%)", marginL + graphW - 5, cpSize.height - 8);

  cpCtx.save();
  cpCtx.translate(12, cpSize.height / 2);
  cpCtx.rotate(-Math.PI / 2);
  cpCtx.fillText("-Cp (Suction \u2191)", 0, 0);
  cpCtx.restore();

  // Calculate Cp curves along chord
  var cpTop = [];
  var cpBottom = [];
  var u0 = simState.u0;
  var dynamicPres = 0.5 * 1.0 * u0 * u0;
  var pInf = 1.0 / 3.0;
  var aoa = simState.aoa;

  var rad = (aoa * Math.PI) / 180;
  var cosA = Math.cos(rad);
  var sinA = Math.sin(rad);

  for (var i = 0; i < chord; i++) {
    var xNorm = i / (chord - 1);
    var rx = xNorm * chord;
    var ry = chord * (
      0.5946895 * Math.sqrt(xNorm) -
      0.126 * xNorm -
      0.3516 * xNorm * xNorm +
      0.2843 * xNorm * xNorm * xNorm -
      0.1015 * xNorm * xNorm * xNorm * xNorm
    );

    // Upper surface global coordinates
    var dxTop = rx * cosA - ry * sinA;
    var dyTop = rx * sinA + ry * cosA;
    var gxTop = Math.round(xc + dxTop + sinA * 1.2);
    var gyTop = Math.round(yc + dyTop - cosA * 1.2);

    // Lower surface global coordinates
    var dxBot = rx * cosA + ry * sinA;
    var dyBot = rx * sinA - ry * cosA;
    var gxBot = Math.round(xc + dxBot - sinA * 1.2);
    var gyBot = Math.round(yc + dyBot + cosA * 1.2);

    var getVal = function(gx, gy) {
      var gy_wrapped = (gy % Ny + Ny) % Ny;
      if (gx >= 0 && gx < Nx) {
        return rho_grid[gy_wrapped * Nx + gx] / 3.0;
      }
      return pInf;
    };

    var pTop = getVal(gxTop, gyTop);
    var pBottom = getVal(gxBot, gyBot);

    // Cp = (p - p_inf) / (0.5 * rho * u0^2)
    var valTop = dynamicPres > 1e-6 ? (pTop - pInf) / dynamicPres : 0.0;
    var valBottom = dynamicPres > 1e-6 ? (pBottom - pInf) / dynamicPres : 0.0;

    cpTop.push({ x: xNorm, y: valTop });
    cpBottom.push({ x: xNorm, y: valBottom });
  }

  // Draw upper surface curve (slate)
  if (cpTop.length > 0) {
    cpCtx.strokeStyle = '#536b78';
    cpCtx.lineWidth = 2;
    cpCtx.beginPath();
    cpCtx.moveTo(marginL + cpTop[0].x * graphW, getScreenY(cpTop[0].y));
    for (var i = 1; i < cpTop.length; i++) {
      cpCtx.lineTo(marginL + cpTop[i].x * graphW, getScreenY(cpTop[i].y));
    }
    cpCtx.stroke();
  }

  // Draw lower surface curve (red)
  if (cpBottom.length > 0) {
    cpCtx.strokeStyle = '#ef4444';
    cpCtx.lineWidth = 2;
    cpCtx.beginPath();
    cpCtx.moveTo(marginL + cpBottom[0].x * graphW, getScreenY(cpBottom[0].y));
    for (var i = 1; i < cpBottom.length; i++) {
      cpCtx.lineTo(marginL + cpBottom[i].x * graphW, getScreenY(cpBottom[i].y));
    }
    cpCtx.stroke();
  }

  // Small Legend Overlay
  cpCtx.fillStyle = '#64748b';
  cpCtx.font = '9px var(--font-mono)';
  cpCtx.textAlign = 'left';
  cpCtx.fillStyle = '#536b78';
  cpCtx.fillRect(marginL + 20, marginT + 12, 10, 6);
  cpCtx.fillStyle = '#64748b';
  cpCtx.fillText("Upper Surface", marginL + 35, marginT + 16);

  cpCtx.fillStyle = '#ef4444';
  cpCtx.fillRect(marginL + 120, marginT + 12, 10, 6);
  cpCtx.fillStyle = '#64748b';
  cpCtx.fillText("Lower Surface", marginL + 135, marginT + 16);
}
