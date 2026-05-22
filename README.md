# Lattice Boltzmann Wind Tunnel Simulator

A high-performance, interactive 2D aerodynamics simulator built with the **Lattice Boltzmann Method (LBM)** and **D2Q9 lattice**. Visualize airflow around a NACA 0012 airfoil in real-time with live pressure coefficient distributions, stall detection, and interactive particle tracing.

## Features

### Core Simulation
- **Lattice Boltzmann D2Q9 Solver**: Accurate incompressible fluid dynamics on a 150×75 grid
- **NACA 0012 Airfoil**: Parametric geometry with variable angle of attack (±25°)
- **Smagorinsky Subgrid Turbulence Closure**: Dynamic relaxation time for stable, realistic turbulence modeling
- **Boundary Conditions**:
  - Zou-He velocity inlet (left wall)
  - Extrapolation outlet (right wall)
  - Periodic boundaries (top/bottom)
  - No-slip bounce-back on airfoil surface

### Aerodynamic Analysis
- **Lift Coefficient (Cl) Calculation**: Real-time computation from integrated surface pressure
- **Pressure Coefficient (Cp) Distribution Plot**: Live chordwise pressure curves for upper and lower surfaces
- **Stall Detection**: Automatic warning at angles of attack ≥12°
- **Comprehensive Visualization**:
  - Velocity field heatmap
  - Pressure field diverging colormap
  - Vorticity magnitude field
  - Static streamlines or particle tracing

### Interactive Controls
- **Angle of Attack Slider**: -25° to +25°
- **Reynolds Number Control**: 50 to 300 (influences viscosity and relaxation)
- **Inlet Velocity Adjustment**: Fine-tune flow dynamics
- **Particle Count**: 0 to 2500 tracing particles
- **Field Visualization**: Switch between velocity, pressure, vorticity, or blank background
- **Overlay Modes**: Streamlines, particles, or none
- **Theme Support**: Light and dark canvas themes
- **Interactive Ink Spraying**: Click or touch to inject particles and visualize flow patterns
- **Playback Controls**: Play/pause, manual stepping, reset

## Technical Details

### Solver Architecture

#### Distribution Functions (D2Q9)
The simulation maintains 9 distribution functions per grid cell representing discrete velocity directions:
```
Direction indices:     Velocity vectors:
    6 2 5                (-1,+1) (0,+1) (+1,+1)
    3 0 1                (-1, 0) (0, 0) (+1, 0)
    7 4 8                (-1,-1) (0,-1) (+1,-1)
```

#### LBM Algorithm Steps
1. **Collision**: BGK operator with Smagorinsky turbulence correction
2. **Streaming**: Advection with bounce-back boundary handling
3. **Inlet BC**: Zou-He scheme for prescribed velocity
4. **Outlet BC**: Extrapolation from upstream cell
5. **Macroscopic Recovery**: Compute density and velocity from distributions

### Aerodynamic Calculations

**Pressure Sampling**: Surface pressure is sampled perpendicular to the airfoil surface at each chordwise position.

**Lift Coefficient**:
```
Cl = Fy / (0.5 × ρ × u₀² × chord)
```
where Fy is the integrated vertical pressure force.

**Pressure Coefficient**:
```
Cp = (p - p∞) / (0.5 × ρ × u₀²)
```

### Grid & Parameters
- **Grid Size**: 150 × 75 cells (lattice units)
- **Chord Length**: 40 lattice units
- **Max Particles**: 2,500 tracer particles
- **Max Velocity**: ±0.25 lattice units/step (Mach number control)
- **Density Range**: 0.2 to 2.0 (compressibility control)

### File Structure

```
├── index.html              # Main HTML structure
├── main.js                 # Render loop & entry point
├── solver.js               # LBM D2Q9 engine with SGS turbulence
├── aerodynamics.js         # Cl, Cp, stall detection
├── renderer.js             # Field visualization & canvas DPI scaling
├── particles.js            # Particle advection & lifecycle
├── airfoil.js              # NACA 0012 geometry & solid mask
├── colormap.js             # Color lookup tables for all fields
├── ui.js                   # Event listeners & user controls
├── state.js                # Simulation state & parameters
├── constants.js            # Grid dimensions & D2Q9 lattice
├── cpplot.js               # Pressure coefficient plot renderer
├── aerodyn.jsx             # React wrapper (if used in React environment)
└── aerodynamics.js         # Aerodynamic forces module
```

## Usage

### Basic Workflow
1. **Load the simulator** in a modern web browser (Chrome, Firefox, Safari, Edge)
2. **Adjust Parameters**:
   - Use sliders for angle of attack, Reynolds number, velocity
   - Select visualization fields and overlay types
   - Choose light or dark theme
3. **Observe Flow**:
   - Watch velocity/pressure/vorticity fields update in real-time
   - Monitor Cl value and stall warning
   - Check Cp plot for pressure distribution
4. **Interactive Drawing**:
   - Click/drag or touch the canvas to inject tracer particles
   - Visualize flow patterns around the airfoil

### Control Reference

| Control | Range | Effect |
|---------|-------|--------|
| Angle of Attack | -25° to +25° | Airfoil orientation; triggers stall warning at ≥12° |
| Reynolds Number | 50–300 | Affects viscosity and turbulent behavior |
| Inlet Velocity | 0.01–0.15 | Flow speed; influences Cl and separation |
| Particle Count | 0–2,500 | Tracer particle density for visualization |
| Background Field | velocity / pressure / vorticity / none | Main visualization layer |
| Overlay Type | particles / streamlines / none | Secondary flow visualization |
| Theme | light / dark | Canvas background and color palette |

### Performance Tips
- For smoother animation on slower devices, reduce particle count
- Increasing Reynolds number may require longer settling time (more iterations)
- 3 solver steps per frame is default; adjust `stepsPerFrame` in `main.js` for speed/accuracy trade-off

## Physical Parameters

### Reynolds Number Relationship
```
Re = (u₀ × chord) / ν
ν = (u₀ × chord) / Re
τ = 3ν + 0.5
```

Higher Re → thinner boundary layers, more complex separation; requires finer grid or higher relaxation time.

### Stall Behavior
NACA 0012 typically stalls around 8–10° in real experiments. This simulator triggers a warning at ≥12° due to grid coarseness and lattice Mach number limitations.

### Pressure Scaling
- **Reference pressure**: p∞ = 1/3 (lattice units)
- **Density range**: [0.93, 1.07] in steady-state flow
- **Velocity clamps**: ±0.25 (prevents numerical instability)

## Color Schemes

### Light Theme
- **Velocity**: Cool (light grey) → Hot (warm tones)
- **Pressure**: Deep blue (low) → Neutral grey → Deep red (high)
- **Vorticity**: Cyan/blue (negative/clockwise) → Neutral → Orange/red (positive/counterclockwise)
- **Airfoil**: Slate fill with dark border

### Dark Theme
- **Velocity**: Dark blue → Cyan → Green → Yellow → Red
- **Pressure**: Dark blue → Red with higher contrast
- **Vorticity**: Blue/cyan → Orange/red with inverted scale
- **Airfoil**: Slate fill with white border

## Numerical Stability & Limitations

### Clamping & Safety
- Density is clamped to [0.2, 2.0] to prevent divergence
- Velocity is clamped to [−0.25, 0.25] to maintain low Mach number
- Auto-reset triggers if NaN is detected

### Known Limitations
1. **Coarse Grid**: 150×75 resolution limits boundary layer detail
2. **Lattice Mach Constraint**: Ma = u₀/c_s < 0.3 restricts flow speeds
3. **Symmetric Airfoil**: NACA 0012 only; no cambered profiles
4. **2D Only**: No spanwise variations or 3D effects
5. **Inviscid Limit**: Very low Re (<50) may show artificial behavior

## Building & Extending

### Browser Compatibility
- Requires ES5+ (modern JavaScript engines)
- Uses `Uint8Array`, `Float32Array` for efficient memory
- Canvas 2D API with high-DPI support

### Adding Custom Airfoils
Replace the NACA 0012 equation in `airfoil.js` and `renderer.js`:
```javascript
var yt = chord * (yourAirfoilFunction(xNorm));
```

### Modifying Solver
- Change `stepsPerFrame` in `main.js` for speed/accuracy
- Adjust Smagorinsky constant `Cs = 0.15` in `solver.js`
- Modify relaxation time bounds in `state.js`

### React Integration
Use `aerodyn.jsx` as a wrapper component for integration into React applications.

## Performance Metrics

### Typical Performance (Desktop)
- **Frame Rate**: 50–60 FPS (with 3 solver steps/frame, 1200 particles)
- **Update Time**: ~15–30ms per frame
- **Memory**: ~5–8 MB (grid + buffers + particles)

## References

- **Lattice Boltzmann Method**: Succi, S. (2001). *The Lattice Boltzmann Equation*
- **D2Q9 Lattice**: Bhatnagar, Gross, and Krook (BGK) collision operator
- **Smagorinsky SGS**: Pope, S.B. (2000). *Turbulent Flows*
- **NACA 0012**: Abbott & Von Doenhoff (1959). *Theory of Wing Sections*
- **Boundary Conditions**: Zou & He (1997); Latt et al. (2008)
