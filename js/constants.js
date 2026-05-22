// ============================================================
// CONSTANTS — Grid, D2Q9 Lattice, Airfoil Geometry
// ============================================================

// Grid dimensions
var Nx = 150;
var Ny = 75;
var numCells = Nx * Ny;

// Airfoil geometry (lattice units)
var chord = 40;                    // Chord length
var xc = 35;                      // Leading edge x-coordinate
var yc = Math.floor(Ny / 2);      // Leading edge y-coordinate (centered)

// D2Q9 Lattice Boltzmann weights
var w = new Float32Array([4/9, 1/9, 1/9, 1/9, 1/9, 1/36, 1/36, 1/36, 1/36]);

// D2Q9 velocity components
var cx = new Int32Array([0, 1, 0, -1, 0, 1, -1, -1, 1]);
var cy = new Int32Array([0, 0, 1, 0, -1, 1, 1, -1, -1]);

// Opposite direction indices (for bounce-back)
var opp = new Int32Array([0, 3, 4, 1, 2, 7, 8, 5, 6]);

// Particle system limits
var maxParticlesLimit = 2500;
