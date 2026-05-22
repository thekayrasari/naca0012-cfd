// ============================================================
// MAIN — Entry Point & Render Loop
// ============================================================

(function() {
  // Get canvas elements from the DOM
  simCanvas = document.getElementById('simCanvas');
  simCtx = simCanvas.getContext('2d');
  cpCanvas = document.getElementById('cpCanvas');
  cpCtx = cpCanvas.getContext('2d');

  // Setup high-DPI scaling
  simSize = setupCanvasDPI(simCanvas);
  cpSize = setupCanvasDPI(cpCanvas);

  // Handle window resize
  window.addEventListener('resize', function() {
    simSize = setupCanvasDPI(simCanvas);
    cpSize = setupCanvasDPI(cpCanvas);
  });

  // Initialize all UI event listeners
  initUI();

  // Initialize the wind tunnel simulation
  initSimulation();

  // Performance timer
  var lastTime = performance.now();
  var frameCount = 0;
  var fps = 60;

  /**
   * Main animation loop.
   * Steps the LBM solver, updates particles, renders the field
   * and overlays, calculates aerodynamics, and draws the Cp plot.
   */
  function renderLoop() {
    // Step LBM Physics solver when active
    if (!simState.isPaused) {
      // Run solver steps per frame to speed up settling time
      var stepsPerFrame = 3;
      for (var s = 0; s < stepsPerFrame; s++) {
        solverStep();
      }

      // Update trace particles
      if (simState.overlayType === 'particles') {
        updateParticles();
      }
    }

    // Redraw simulation field
    renderField();
    renderOverlay();

    // Redraw Cp graph & stats
    calculateAerodynamics();
    renderCpPlot();

    // Compute frame rates
    frameCount++;
    var time = performance.now();
    if (time >= lastTime + 1000) {
      fps = Math.round((frameCount * 1000) / (time - lastTime));
      document.getElementById('val-fps').innerText = fps + ' FPS';
      frameCount = 0;
      lastTime = time;
    }

    requestAnimationFrame(renderLoop);
  }

  // Start the animation loop
  renderLoop();
})();
