// ============================================================
// AIRFOIL — NACA 0012 Geometry & Solid Mask Generation
// ============================================================

// Solid obstacle mask (1 = solid, 0 = fluid)
var solid = new Uint8Array(numCells);

/**
 * Regenerate the solid mask for the NACA 0012 airfoil at the current AoA.
 * Uses the standard NACA 0012 half-thickness equation:
 *   y_t = 0.5946895*sqrt(x) - 0.126*x - 0.3516*x^2 + 0.2843*x^3 - 0.1015*x^4
 * The coordinate system is rotated by the angle of attack around the leading edge.
 */
function updateSolidMask() {
  solid.fill(0);
  var rad = (simState.aoa * Math.PI) / 180;
  var cosA = Math.cos(rad);
  var sinA = Math.sin(rad);

  for (var y = 0; y < Ny; y++) {
    for (var x = 0; x < Nx; x++) {
      var dx = x - xc;
      var dy = y - yc;

      // Rotate coordinate system back to airfoil frame
      var rx = dx * cosA + dy * sinA;
      var ry = -dx * sinA + dy * cosA;

      if (rx >= 0 && rx <= chord) {
        var xNorm = rx / chord;
        // NACA 0012 Symmetrical half-thickness equation
        var yt = chord * (
          0.5946895 * Math.sqrt(xNorm) -
          0.126 * xNorm -
          0.3516 * xNorm * xNorm +
          0.2843 * xNorm * xNorm * xNorm -
          0.1015 * xNorm * xNorm * xNorm * xNorm
        );
        if (Math.abs(ry) <= yt) {
          solid[y * Nx + x] = 1;
        }
      }
    }
  }
}
