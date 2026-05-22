// ============================================================
// PARTICLES — Tracing Particle System
// ============================================================

// Particle position and life arrays
var p_x = new Float32Array(maxParticlesLimit);
var p_y = new Float32Array(maxParticlesLimit);
var p_life = new Float32Array(maxParticlesLimit);

/**
 * Initialize all particles to random positions with randomized decay state.
 */
function initParticles() {
  for (var p = 0; p < maxParticlesLimit; p++) {
    p_x[p] = Math.random() * Nx;
    p_y[p] = Math.random() * Ny;
    p_life[p] = Math.random(); // Randomized decay state
  }
}

/**
 * Advect tracing particles through the velocity field using
 * bilinear interpolation. Handles decay, obstacle collision,
 * and boundary respawn.
 */
function updateParticles() {
  var dt = 1.0;
  for (var p = 0; p < simState.maxParticles; p++) {
    var px = p_x[p];
    var py = p_y[p];

    // Bilinear interpolation of velocity field at particle coordinates
    var x0 = Math.floor(px);
    var y0 = Math.floor(py);
    var x1 = x0 + 1;
    if (x1 >= Nx) x1 = Nx - 1;
    var y1 = y0 + 1;

    // Periodic wrapping indices
    var y0_p = (y0 % Ny + Ny) % Ny;
    var y1_p = (y1 % Ny + Ny) % Ny;

    var tx = px - x0;
    var ty = py - y0;

    var idx00 = y0_p * Nx + x0;
    var idx10 = y0_p * Nx + x1;
    var idx01 = y1_p * Nx + x0;
    var idx11 = y1_p * Nx + x1;

    var ux = (1 - tx) * (1 - ty) * u_x_grid[idx00] + tx * (1 - ty) * u_x_grid[idx10] + (1 - tx) * ty * u_x_grid[idx01] + tx * ty * u_x_grid[idx11];
    var uy = (1 - tx) * (1 - ty) * u_y_grid[idx00] + tx * (1 - ty) * u_y_grid[idx10] + (1 - tx) * ty * u_y_grid[idx01] + tx * ty * u_y_grid[idx11];

    // Move particle
    px += ux * dt;
    py += uy * dt;

    // Check if inside solid obstacle
    var hitObstacle = false;
    var gridX = Math.round(px);
    var gridY = (Math.round(py) % Ny + Ny) % Ny;
    if (gridX >= 0 && gridX < Nx) {
      if (solid[gridY * Nx + gridX]) {
        hitObstacle = true;
      }
    }

    // Decay particle life
    p_life[p] -= 0.00015 + Math.random() * 0.00015;

    // Reset particle on boundaries, obstacle hit, or decay
    if (px >= Nx - 1 || px <= 0 || py < 0 || py >= Ny || hitObstacle || p_life[p] <= 0) {
      p_x[p] = 0;
      p_y[p] = Math.random() * Ny;
      p_life[p] = 1.0;
    } else {
      p_x[p] = px;
      p_y[p] = py;
    }
  }
}

/**
 * Inject ink particles at lattice coordinates (lx, ly).
 * Used for interactive mouse/touch drawing.
 */
function injectInkAt(lx, ly) {
  for (var i = 0; i < 15; i++) {
    var idx = Math.floor(Math.random() * simState.maxParticles);
    p_x[idx] = lx + (Math.random() - 0.5) * 1.5;
    p_y[idx] = (ly + (Math.random() - 0.5) * 1.5 + Ny) % Ny;
    p_life[idx] = 1.0; // Reset life
  }
}
