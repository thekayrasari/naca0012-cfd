// ============================================================
// SOLVER — Lattice Boltzmann D2Q9 Engine
// ============================================================

// Distribution function double-buffers (9 directions × 2)
var f0 = new Float32Array(numCells);
var f1 = new Float32Array(numCells);
var f2 = new Float32Array(numCells);
var f3 = new Float32Array(numCells);
var f4 = new Float32Array(numCells);
var f5 = new Float32Array(numCells);
var f6 = new Float32Array(numCells);
var f7 = new Float32Array(numCells);
var f8 = new Float32Array(numCells);

var f0_new = new Float32Array(numCells);
var f1_new = new Float32Array(numCells);
var f2_new = new Float32Array(numCells);
var f3_new = new Float32Array(numCells);
var f4_new = new Float32Array(numCells);
var f5_new = new Float32Array(numCells);
var f6_new = new Float32Array(numCells);
var f7_new = new Float32Array(numCells);
var f8_new = new Float32Array(numCells);

// Macroscopic field grids
var u_x_grid = new Float32Array(numCells);
var u_y_grid = new Float32Array(numCells);
var rho_grid = new Float32Array(numCells);

/**
 * Initialize the LBM solver: set equilibrium distributions,
 * regenerate airfoil mask, rebuild color LUTs, reset particles.
 */
function initSimulation() {
  // Re-evaluate derived parameters
  recalcDerived();
  updateSolidMask();
  generateLUTs();

  var u0 = simState.u0;

  // Set initial equilibrium state
  for (var y = 0; y < Ny; y++) {
    for (var x = 0; x < Nx; x++) {
      var idx = y * Nx + x;
      var rho = 1.0;
      var ux = solid[idx] ? 0.0 : u0;
      var uy = 0.0;

      u_x_grid[idx] = ux;
      u_y_grid[idx] = uy;
      rho_grid[idx] = rho;

      // Equilibrium distributions
      var u2 = ux * ux + uy * uy;
      var u2_15 = 1.5 * u2;
      var ux3 = 3.0 * ux;
      var uy3 = 3.0 * uy;

      f0[idx] = f0_new[idx] = (4/9) * rho * (1 - u2_15);
      f1[idx] = f1_new[idx] = (1/9) * rho * (1 + ux3 + 4.5 * ux * ux - u2_15);
      f2[idx] = f2_new[idx] = (1/9) * rho * (1 + uy3 + 4.5 * uy * uy - u2_15);
      f3[idx] = f3_new[idx] = (1/9) * rho * (1 - ux3 + 4.5 * ux * ux - u2_15);
      f4[idx] = f4_new[idx] = (1/9) * rho * (1 - uy3 + 4.5 * uy * uy - u2_15);

      var u_plus = ux + uy;
      var u_minus = -ux + uy;
      f5[idx] = f5_new[idx] = (1/36) * rho * (1 + 3 * u_plus + 4.5 * u_plus * u_plus - u2_15);
      f6[idx] = f6_new[idx] = (1/36) * rho * (1 + 3 * u_minus + 4.5 * u_minus * u_minus - u2_15);
      f7[idx] = f7_new[idx] = (1/36) * rho * (1 - 3 * u_plus + 4.5 * u_plus * u_plus - u2_15);
      f8[idx] = f8_new[idx] = (1/36) * rho * (1 - 3 * u_minus + 4.5 * u_minus * u_minus - u2_15);
    }
  }

  initParticles();
}

/**
 * Execute one full LBM time step:
 * 1. BGK collision with Smagorinsky SGS turbulence model
 * 2. Streaming with bounce-back on solid boundaries
 * 3. Zou-He velocity inlet (left wall)
 * 4. Extrapolation outlet (right wall)
 * 5. Buffer swap
 * 6. NaN divergence auto-reset
 */
function solverStep() {
  // Numerical clamp boundaries to prevent divergence
  var minRho = 0.2;
  var maxRho = 2.0;
  var maxVel = 0.25;

  var u0 = simState.u0;
  var tau = simState.tau;

  // Smagorinsky Subgrid Turbulence closure constant
  var Cs = 0.15;
  var Cs_sq_18_sqrt2 = 18.0 * Cs * Cs * Math.sqrt(2.0);

  for (var y = 0; y < Ny; y++) {
    for (var x = 0; x < Nx; x++) {
      var idx = y * Nx + x;

      if (solid[idx]) {
        continue;
      }

      var f0_val = f0[idx];
      var f1_val = f1[idx];
      var f2_val = f2[idx];
      var f3_val = f3[idx];
      var f4_val = f4[idx];
      var f5_val = f5[idx];
      var f6_val = f6[idx];
      var f7_val = f7[idx];
      var f8_val = f8[idx];

      // Compute density
      var rho = f0_val + f1_val + f2_val + f3_val + f4_val + f5_val + f6_val + f7_val + f8_val;
      if (rho < minRho) rho = minRho; else if (rho > maxRho) rho = maxRho;

      // Compute velocity
      var ux = (f1_val - f3_val + f5_val - f6_val - f7_val + f8_val) / rho;
      var uy = (f2_val - f4_val + f5_val + f6_val - f7_val - f8_val) / rho;

      // Velocity stabilizer clamps
      if (ux > maxVel) ux = maxVel; else if (ux < -maxVel) ux = -maxVel;
      if (uy > maxVel) uy = maxVel; else if (uy < -maxVel) uy = -maxVel;

      u_x_grid[idx] = ux;
      u_y_grid[idx] = uy;
      rho_grid[idx] = rho;

      // Equilibrium calculations
      var u2 = ux * ux + uy * uy;
      var u2_15 = 1.5 * u2;
      var ux3 = 3.0 * ux;
      var uy3 = 3.0 * uy;

      var f0_eq = (4.0/9.0) * rho * (1.0 - u2_15);
      var f1_eq = (1.0/9.0) * rho * (1.0 + ux3 + 4.5 * ux * ux - u2_15);
      var f2_eq = (1.0/9.0) * rho * (1.0 + uy3 + 4.5 * uy * uy - u2_15);
      var f3_eq = (1.0/9.0) * rho * (1.0 - ux3 + 4.5 * ux * ux - u2_15);
      var f4_eq = (1.0/9.0) * rho * (1.0 - uy3 + 4.5 * uy * uy - u2_15);

      var u_plus = ux + uy;
      var u_minus = -ux + uy;
      var f5_eq = (1.0/36.0) * rho * (1.0 + 3.0 * u_plus + 4.5 * u_plus * u_plus - u2_15);
      var f6_eq = (1.0/36.0) * rho * (1.0 + 3.0 * u_minus + 4.5 * u_minus * u_minus - u2_15);
      var f7_eq = (1.0/36.0) * rho * (1.0 - 3.0 * u_plus + 4.5 * u_plus * u_plus - u2_15);
      var f8_eq = (1.0/36.0) * rho * (1.0 - 3.0 * u_minus + 4.5 * u_minus * u_minus - u2_15);

      // Smagorinsky Non-Equilibrium Strain tensor calculation
      var q0 = f0_val - f0_eq;
      var q1 = f1_val - f1_eq;
      var q2 = f2_val - f2_eq;
      var q3 = f3_val - f3_eq;
      var q4 = f4_val - f4_eq;
      var q5 = f5_val - f5_eq;
      var q6 = f6_val - f6_eq;
      var q7 = f7_val - f7_eq;
      var q8 = f8_val - f8_eq;

      var Qxx = q1 + q3 + q5 + q6 + q7 + q8;
      var Qyy = q2 + q4 + q5 + q6 + q7 + q8;
      var Qxy = q5 - q6 + q7 - q8;
      var Q_norm = Math.sqrt(Qxx*Qxx + Qyy*Qyy + 2.0 * Qxy*Qxy);

      // Dynamic localized relaxation time (stabilizes subgrid structures)
      var tau_local = tau + 0.5 * (Math.sqrt(tau*tau + Cs_sq_18_sqrt2 * Q_norm / rho) - tau);
      var omega_local = 1.0 / tau_local;

      // Collision outputs (Post-collision distribution functions)
      var f0_star = f0_val + omega_local * (f0_eq - f0_val);
      var f1_star = f1_val + omega_local * (f1_eq - f1_val);
      var f2_star = f2_val + omega_local * (f2_eq - f2_val);
      var f3_star = f3_val + omega_local * (f3_eq - f3_val);
      var f4_star = f4_val + omega_local * (f4_eq - f4_val);
      var f5_star = f5_val + omega_local * (f5_eq - f5_val);
      var f6_star = f6_val + omega_local * (f6_eq - f6_val);
      var f7_star = f7_val + omega_local * (f7_eq - f7_val);
      var f8_star = f8_val + omega_local * (f8_eq - f8_val);

      // Streaming & Obstacle Bounce-Back
      // Direction 0 (Stationary)
      f0_new[idx] = f0_star;

      // Direction 1 (+x)
      var nx = x + 1;
      var ny = y;
      if (nx < Nx) {
        var n_idx = ny * Nx + nx;
        if (solid[n_idx]) f3_new[idx] = f1_star; else f1_new[n_idx] = f1_star;
      }

      // Direction 2 (+y)
      nx = x;
      ny = (y + 1) % Ny;
      {
        var n_idx = ny * Nx + nx;
        if (solid[n_idx]) f4_new[idx] = f2_star; else f2_new[n_idx] = f2_star;
      }

      // Direction 3 (-x)
      nx = x - 1;
      ny = y;
      if (nx >= 0) {
        var n_idx = ny * Nx + nx;
        if (solid[n_idx]) f1_new[idx] = f3_star; else f3_new[n_idx] = f3_star;
      }

      // Direction 4 (-y)
      nx = x;
      ny = (y - 1 + Ny) % Ny;
      {
        var n_idx = ny * Nx + nx;
        if (solid[n_idx]) f2_new[idx] = f4_star; else f4_new[n_idx] = f4_star;
      }

      // Direction 5 (+x, +y)
      nx = x + 1;
      ny = (y + 1) % Ny;
      if (nx < Nx) {
        var n_idx = ny * Nx + nx;
        if (solid[n_idx]) f7_new[idx] = f5_star; else f5_new[n_idx] = f5_star;
      }

      // Direction 6 (-x, +y)
      nx = x - 1;
      ny = (y + 1) % Ny;
      if (nx >= 0) {
        var n_idx = ny * Nx + nx;
        if (solid[n_idx]) f8_new[idx] = f6_star; else f6_new[n_idx] = f6_star;
      }

      // Direction 7 (-x, -y)
      nx = x - 1;
      ny = (y - 1 + Ny) % Ny;
      if (nx >= 0) {
        var n_idx = ny * Nx + nx;
        if (solid[n_idx]) f5_new[idx] = f7_star; else f7_new[n_idx] = f7_star;
      }

      // Direction 8 (+x, -y)
      nx = x + 1;
      ny = (y - 1 + Ny) % Ny;
      if (nx < Nx) {
        var n_idx = ny * Nx + nx;
        if (solid[n_idx]) f6_new[idx] = f8_star; else f8_new[n_idx] = f8_star;
      }
    }
  }

  // Zou-He Velocity Inlet at x = 0
  for (var y = 0; y < Ny; y++) {
    var idx = y * Nx;
    var f0_val = f0_new[idx];
    var f2_val = f2_new[idx];
    var f4_val = f4_new[idx];
    var f3_val = f3_new[idx];
    var f6_val = f6_new[idx];
    var f7_val = f7_new[idx];

    var rho = (f0_val + f2_val + f4_val + 2.0 * (f3_val + f6_val + f7_val)) / (1.0 - u0);
    if (rho < minRho) rho = minRho; else if (rho > maxRho) rho = maxRho;

    f1_new[idx] = f3_val + (2.0/3.0) * rho * u0;
    f5_new[idx] = f7_val - 0.5 * (f2_val - f4_val) + (1.0/6.0) * rho * u0;
    f8_new[idx] = f6_val + 0.5 * (f2_val - f4_val) + (1.0/6.0) * rho * u0;
  }

  // Extrapolation Boundary Outlet at x = Nx - 1
  for (var y = 0; y < Ny; y++) {
    var idx = y * Nx + (Nx - 1);
    var idx_neighbor = y * Nx + (Nx - 2);
    f0_new[idx] = f0_new[idx_neighbor];
    f1_new[idx] = f1_new[idx_neighbor];
    f2_new[idx] = f2_new[idx_neighbor];
    f3_new[idx] = f3_new[idx_neighbor];
    f4_new[idx] = f4_new[idx_neighbor];
    f5_new[idx] = f5_new[idx_neighbor];
    f6_new[idx] = f6_new[idx_neighbor];
    f7_new[idx] = f7_new[idx_neighbor];
    f8_new[idx] = f8_new[idx_neighbor];
  }

  // Buffer swap pointers
  var temp;
  temp = f0; f0 = f0_new; f0_new = temp;
  temp = f1; f1 = f1_new; f1_new = temp;
  temp = f2; f2 = f2_new; f2_new = temp;
  temp = f3; f3 = f3_new; f3_new = temp;
  temp = f4; f4 = f4_new; f4_new = temp;
  temp = f5; f5 = f5_new; f5_new = temp;
  temp = f6; f6 = f6_new; f6_new = temp;
  temp = f7; f7 = f7_new; f7_new = temp;
  temp = f8; f8 = f8_new; f8_new = temp;

  // Numerical sanity check (auto-reset on divergence)
  if (isNaN(f0[0])) {
    console.warn("Numerical divergence detected. Resetting solver...");
    initSimulation();
  }
}

/**
 * Compute vorticity (curl of velocity) at grid point (x, y)
 * using central finite differences.
 */
function computeVorticity(x, y) {
  var xp = x + 1; if (xp >= Nx) xp = Nx - 1;
  var xm = x - 1; if (xm < 0) xm = 0;
  var yp = (y + 1) % Ny;
  var ym = (y - 1 + Ny) % Ny;

  var uy_x = (u_y_grid[y * Nx + xp] - u_y_grid[y * Nx + xm]) * 0.5;
  var ux_y = (u_x_grid[yp * Nx + x] - u_x_grid[ym * Nx + x]) * 0.5;

  return uy_x - ux_y;
}
