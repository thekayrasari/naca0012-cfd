// ============================================================
// STATE — Mutable Simulation Parameters
// ============================================================

var simState = {
  aoa: 0,                    // Angle of Attack (degrees)
  Re: 150,                   // Reynolds number
  u0: 0.05,                  // Inlet velocity
  isPaused: false,
  bgFieldType: 'velocity',   // velocity, pressure, vorticity, none
  overlayType: 'particles',  // particles, streamlines, none
  canvasTheme: 'light',      // light, dark
  maxParticles: 1200,

  // Derived solver values (recomputed via recalcDerived)
  viscosity: 0,
  tau: 0
};

// Recompute derived values from current state
function recalcDerived() {
  simState.viscosity = (simState.u0 * chord) / simState.Re;
  simState.tau = 3.0 * simState.viscosity + 0.5;
}

// Initial calculation
recalcDerived();
