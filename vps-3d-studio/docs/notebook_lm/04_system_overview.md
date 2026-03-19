# 04: SignFabricator OS System Overview

This document provides a high-level overview of the application's architecture and design philosophy.

## 1. The "Silent Orchestrator" Philosophy
The application is designed as a **Data-Driven Engine**. 
- **The UI** is just a controller for a JSON state.
- **The 3D Viewer** is a visual representation of that JSON state.
- **The Engine** is a mathematical transformation of that JSON state.

By keeping the entire state in a single `SignConfig` object, the application becomes "portable." You can save it, email it, or move it between different backend systems without losing any fidelity.

## 2. Tech Stack
- **Frontend:** React 19 (Functional Components, Hooks)
- **3D Rendering:** Three.js via `@react-three/fiber` and `@react-three/drei`
- **Styling:** Tailwind CSS (Utility-first)
- **Icons:** Lucide React
- **Post-Processing:** `@react-three/postprocessing` (for the neon/bloom effect)
- **Language:** TypeScript (Strict typing for all engineering data)

## 3. Key Directory Structure
- `/src/components/Viewer3D`: The core WebGL rendering logic.
- `/src/components/Configurator`: The UI controls that modify the state.
- `/src/services`: The "Brains" of the app (Pricing, Engineering, Vector Math).
- `/src/data`: Static libraries for fonts and materials.
- `/src/types.ts`: The central definition of all data structures.

## 4. Realistic Graphic Previews
The application achieves realism through:
- **Physically Based Rendering (PBR):** Materials use roughness, metalness, and normal maps to react to light.
- **Environment Mapping:** The signs reflect a high-dynamic-range (HDR) environment.
- **Bloom/Glow:** LEDs emit actual light that bleeds into the camera lens, simulating real-world photography.
- **Dynamic Shadows:** Halo-lit signs cast soft, realistic shadows onto the wall texture.

## 5. Future Extensibility
Because the system is modular, you can easily add:
- **New Fonts:** By adding a new entry to the `FONT_LIBRARY`.
- **New Materials:** By updating `materials.ts`.
- **New Manufacturing Exports:** By adding a new service in `/src/services` (e.g., a direct export to a specific CNC router format).

## Usage in NotebookLM
- This document provides the context needed for NotebookLM to understand how the different parts of the code interact.
- Use it to explain to stakeholders how the "Design-to-Fabrication" pipeline works.
