// ============================================================
// UI — Event Listeners & User Controls
// ============================================================

/**
 * Initialize all UI event listeners for sliders, selects,
 * buttons, and canvas mouse/touch interactions.
 * Called once from main.js after DOM is ready.
 */
function initUI() {
  // AoA Slider
  var slideAoA = document.getElementById('slide-aoa');
  var lblAoA = document.getElementById('lbl-aoa');
  slideAoA.addEventListener('input', function(e) {
    simState.aoa = parseInt(e.target.value);
    lblAoA.innerText = (simState.aoa > 0 ? '+' : '') + simState.aoa + '\u00B0';
    updateSolidMask();
  });

  // Reynolds Slider
  var slideRe = document.getElementById('slide-re');
  var lblRe = document.getElementById('lbl-re');
  slideRe.addEventListener('input', function(e) {
    simState.Re = parseInt(e.target.value);
    lblRe.innerText = 'Re = ' + simState.Re;
    document.getElementById('val-re').innerText = simState.Re;
    recalcDerived();
  });

  // Velocity Slider
  var slideU0 = document.getElementById('slide-u0');
  var lblU0 = document.getElementById('lbl-u0');
  slideU0.addEventListener('input', function(e) {
    simState.u0 = parseFloat(e.target.value);
    lblU0.innerText = simState.u0.toFixed(3);
    recalcDerived();
  });

  // Particle Count Slider
  var slideParticles = document.getElementById('slide-particles');
  var lblParticles = document.getElementById('lbl-particles');
  slideParticles.addEventListener('input', function(e) {
    simState.maxParticles = parseInt(e.target.value);
    lblParticles.innerText = simState.maxParticles;
  });

  // Background Field Select
  var selectBgField = document.getElementById('select-bg-field');
  selectBgField.addEventListener('change', function(e) {
    simState.bgFieldType = e.target.value;
  });

  // Overlay Select
  var selectOverlay = document.getElementById('select-overlay');
  var groupParticles = document.getElementById('group-particles');
  selectOverlay.addEventListener('change', function(e) {
    simState.overlayType = e.target.value;
    if (simState.overlayType === 'particles') {
      groupParticles.style.display = 'block';
    } else {
      groupParticles.style.display = 'none';
    }
  });

  // Theme Select
  var selectTheme = document.getElementById('select-theme');
  selectTheme.addEventListener('change', function(e) {
    simState.canvasTheme = e.target.value;
    document.getElementById('theme-indicator').innerText =
      simState.canvasTheme === 'light' ? 'LATTICE BOLTZMANN SOLVER' : 'WIND TUNNEL SOLVER [DARK]';
    generateLUTs();
  });

  // Play/Pause Button
  var btnPlayPause = document.getElementById('btn-play-pause');
  btnPlayPause.addEventListener('click', function() {
    simState.isPaused = !simState.isPaused;
    btnPlayPause.innerHTML = simState.isPaused ?
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg><span>Resume</span>' :
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg><span>Pause</span>';
  });

  // Step Frame Button
  var btnStep = document.getElementById('btn-step');
  btnStep.addEventListener('click', function() {
    if (simState.isPaused) {
      solverStep();
      if (simState.overlayType === 'particles') updateParticles();
    }
  });

  // Clear Ink Button
  document.getElementById('btn-reset-particles').addEventListener('click', function() {
    initParticles();
  });

  // Reset Wind Tunnel Button
  document.getElementById('btn-reset').addEventListener('click', function() {
    initSimulation();
  });

  // Interactive Ink Spraying — Mouse
  simCanvas.addEventListener('mousedown', function(e) {
    if (e.button === 0) {
      var rect = simCanvas.getBoundingClientRect();
      var lx = (e.clientX - rect.left) / rect.width * Nx;
      var ly = (e.clientY - rect.top) / rect.height * Ny;
      injectInkAt(lx, ly);
    }
  });

  simCanvas.addEventListener('mousemove', function(e) {
    if (e.buttons === 1) { // Left mouse click held
      var rect = simCanvas.getBoundingClientRect();
      var lx = (e.clientX - rect.left) / rect.width * Nx;
      var ly = (e.clientY - rect.top) / rect.height * Ny;
      injectInkAt(lx, ly);
    }
  });

  // Interactive Ink Spraying — Touch
  simCanvas.addEventListener('touchstart', function(e) {
    var rect = simCanvas.getBoundingClientRect();
    var touch = e.touches[0];
    var lx = (touch.clientX - rect.left) / rect.width * Nx;
    var ly = (touch.clientY - rect.top) / rect.height * Ny;
    injectInkAt(lx, ly);
  });

  // Prevent scrolling when drawing on touchscreen
  simCanvas.addEventListener('touchmove', function(e) {
    e.preventDefault();
    var rect = simCanvas.getBoundingClientRect();
    var touch = e.touches[0];
    var lx = (touch.clientX - rect.left) / rect.width * Nx;
    var ly = (touch.clientY - rect.top) / rect.height * Ny;
    injectInkAt(lx, ly);
  }, { passive: false });
}
