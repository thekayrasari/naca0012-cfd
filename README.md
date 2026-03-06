# NACA 0012 — Interactive CFD Analysis

A browser-based, interactive 2D aerodynamic simulation of the **NACA 0012 symmetric airfoil**. Built as a single-file HTML application, it uses a viscous-corrected empirical model to compute lift and drag characteristics in real time — no backend, no dependencies, no build step.

**Live demo:** [thekayrasari.github.io/naca0012-cfd](https://thekayrasari.github.io/naca0012-cfd/)

---

## Overview

This tool simulates incompressible, viscous 2D flow over the NACA 0012 airfoil across a configurable range of angles of attack and Reynolds numbers. It is intended for aerodynamics education, quick-look polar generation, and interactive exploration of airfoil behavior including stall.

### Aerodynamic Model

| Property | Value |
|---|---|
| Profile | NACA 0012 (symmetric, 12% thickness) |
| Chord | 1.00 m |
| Span | ∞ (2D assumption) |
| Flow regime | Incompressible |
| Method | Viscous Empirical v2 |
| Stall model | Reynolds-dependent with hysteresis |

The solver uses a viscous-corrected empirical approach calibrated to published NACA 0012 wind tunnel data. It accounts for Reynolds number effects on stall onset and incorporates hysteresis behavior around the stall angle. It does **not** use a panel method or finite-volume solver — it is a fast analytical approximation suitable for educational use.

---

## Features

- **Real-time aerodynamic readouts** — C\_L, C\_D, and L/D ratio update instantly as parameters change
- **Angle of Attack sweep** — automated α-sweep from −20° to +25° with configurable step size
- **Reynolds number control** — adjustable from 0.5M to 6.0M
- **Stall detection** — alerts when flow separation is predicted (typically α ≈ 15° for Re ~ 1M)
- **C\_L vs α polar plot** — full polars generated from sweep results
- **Airfoil geometry display** — rendered cross-section of the NACA 0012 profile
- **No installation required** — entirely self-contained in a single `index.html` file

---

## Usage

### Running Locally

Clone the repository and open the file directly in any modern browser:

```bash
git clone https://github.com/thekayrasari/naca0012-cfd.git
cd naca0012-cfd
open index.html   # macOS
# or just double-click index.html on Windows/Linux
```

No web server, build tools, or internet connection required.

### Controls

| Control | Range | Description |
|---|---|---|
| Angle of Attack (α) | −20° to +25° | Sets the geometric angle of attack |
| Reynolds Number | 0.5M to 6.0M | Controls viscous scaling of the flow |
| Sweep Step | 0.5° to 2.0° | Resolution of the automated α-sweep |
| Run α-Sweep | — | Executes sweep and plots the full polar |
| Reset | — | Returns all parameters to defaults |

---

## Output Parameters

- **C\_L** — Lift coefficient
- **C\_D** — Drag coefficient
- **L/D** — Lift-to-drag ratio (aerodynamic efficiency)
- **Alpha (α)** — Current angle of attack in degrees
- **Stall warning** — Triggered when attached flow separation is detected

---

## Repository Structure

```
naca0012-cfd/
├── index.html      # Complete simulation — all logic, UI, and rendering
└── LICENSE         # MIT License
```

---

## Limitations

- 2D analysis only — no 3D wing or finite-span effects
- Incompressible flow — not valid above approximately Mach 0.3
- Empirical model — results are approximate; not a substitute for panel method (e.g. XFOIL) or CFD (e.g. OpenFOAM) analysis
- No boundary layer transition control
- Subsonic regime only

For higher-fidelity results, consider [XFOIL](https://web.mit.edu/drela/Public/web/xfoil/) or a full RANS solver.

---

## License

MIT License — see [LICENSE](./LICENSE) for details.
