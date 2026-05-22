// ============================================================
// AERODYNAMICS — Lift Coefficient & Stall Detection
// ============================================================

var forceSumY = 0;

/**
 * Calculate aerodynamic forces by integrating surface pressure
 * along the upper and lower surfaces of the airfoil.
 * Updates the lift coefficient (Cl) and stall warning in the DOM.
 */
function calculateAerodynamics() {
  var sumTopP = 0;
  var sumBottomP = 0;
  var pInf = 1.0 / 3.0;
  var u0 = simState.u0;
  var aoa = simState.aoa;

  var rad = (aoa * Math.PI) / 180;
  var cosA = Math.cos(rad);
  var sinA = Math.sin(rad);

  // Sample points along the surface
  var samples = chord;
  for (var i = 0; i < samples; i++) {
    var xNorm = i / (samples - 1);
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

    sumTopP += getVal(gxTop, gyTop);
    sumBottomP += getVal(gxBot, gyBot);
  }

  // Integrated vertical pressure force
  forceSumY = sumBottomP - sumTopP;

  // Calculate Lift Coefficient Cl
  // Cl = Fy / (0.5 * rho * u0^2 * chord)
  var dynamicPres = 0.5 * 1.0 * u0 * u0 * chord;
  var liftCoeff = dynamicPres > 1e-6 ? forceSumY / dynamicPres : 0.0;

  // Update DOM
  document.getElementById('val-cl').innerText = liftCoeff.toFixed(3);

  var stallElement = document.getElementById('val-stall');
  var liftBoxElement = document.getElementById('lift-box');
  if (Math.abs(aoa) >= 12) {
    stallElement.innerText = "Stall Warning";
    liftBoxElement.classList.add('stall-warning');
  } else {
    stallElement.innerText = "Normal";
    liftBoxElement.classList.remove('stall-warning');
  }
}
