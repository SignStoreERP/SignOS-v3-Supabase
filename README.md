# ⚡ SignOS v4.0 Unified Architecture (Headless ERP)

SignOS is a Cyber-Physical Operating System (CPOS) engineered to function as a high-fidelity digital twin of manufacturing reality. It enforces a strict separation between the user interface ("The Face"), logic processing ("The Brain"), and persistent state ("The Memory").

## 🏗️ Core Architectural Mandates

1. **Zero Client-Side Math:** The browser is strictly a "Dumb Face" responsible only for UI state management, user input capture, and SVG rendering. No pricing, physics, or yield calculations may exist in HTML or client-side JavaScript.
2. **Physics-First Costing:** Hard costs are calculated by Edge Functions based on actual material yields, waste constraints (e.g., 4x8 sheets, 54" rolls), and machine run-times. 
3. **Twin-Engine Isolation:** All products run through a Market Engine (threshold-based retail curves) and a Physics Engine (hard costs/yield) simultaneously, exposing exact profit margins in real-time to the Zero-Variance Simulator.

---

## 🚀 Recent Milestones & Upgrades

*   **The "Floating Island" UI & Avatar System:** Upgraded the entire frontend to a "Single-Tier Floating Island" design language. Implemented a global, role-based Avatar identity system that dynamically renders initials and system colors across all modules, along with Expanded User Profiles featuring UUID extraction.
*   **The "Twin-Engine" Edge Function Port:** Successfully migrated all core product calculators (including the v2.0 Post & Panel system) from client-side JS into **Supabase Edge Functions** (TypeScript/Deno).
*   **3D Spatial Studio & Channel Letter Integration:** Integrated a decoupled high-precision bridge (`vps-3d-studio`) between digital vector geometry and physical shop-floor execution for Front-Lit Channel Letters.
*   **Hybrid VPS Factory Integration:** Implemented a containerized AI workflow to manage heavy graphical rendering and React-based Three.js environments securely alongside the standard DOM.
*   **Centralized SVG Icon Library:** Replaced static HTML icons with a unified database-driven `ref_system_icons` library for cross-platform visual consistency.
*   **Automated CI/CD Pipelines:** Activated GitHub Actions (`deploy-functions.yml`, `nightly-health-check.yml`) so that pushing to the repository automatically deploys UI updates, syncs Deno Edge Functions, and runs automated mathematical health audits.

---

## 📂 Repository Architecture & File Map

```text
SignOS-v4-Supabase/ (Root)
│
├── .github/workflows/                  <-- CI/CD AUTOMATION
│   ├── deploy-functions.yml            <-- (Automated brain deployment)
│   ├── nightly-health-check.yml        <-- (SRE Health Monitoring)
│   ├── sync-changelog.yml              <-- (Automated Changelog tracking)
│   └── sync-roadmap.yml                <-- (Automated Epic tracking)
│
├── docs/                               <-- THE KNOWLEDGE BASE (6000s Protocols)
│   ├── 6100_System_Architecture.md
│   ├── 6420_Master_Development_Tracker.md
│   ├── 6415_AI_Development_Quarantine_Protocol.md
│   └── 6550_VPS_Factory_Integration_Protocol.md
│
├── supabase/                           <-- THE BRAIN & MEMORY
│   ├── migrations/                     <-- SQL Schema Definitions
│   └── functions/                      <-- Deno/TypeScript Edge Functions
│       ├── _shared/                    <-- Universal Physics Engines
│       ├── calculate-acm/              
│       ├── calculate-post-panel/       <-- Structural fabrication math
│       └── system-health-check/        <-- SRE Automated Diagnostics
│
├── vps-3d-studio/                      <-- HYBRID VPS FACTORY INTEGRATION
│   ├── components/                     <-- React/Three.js viewers and configurators
│   ├── services/                       <-- Blueprint exporters and pricing engines
│   └── data/fonts/                     <-- Opentype metrics
│
└── signos-modern/                      <-- THE FACE (Vercel Frontend)
    ├── menu.html                       <-- User Dashboard (Floating Island UI)
    ├── user_profile.html               <-- Self-Service Profile & Identity
    ├── Omni_Terminal.html              <-- Dynamic Schema-Driven Quoter
    ├── Calculator_PostPanel.html       <-- 2D Architectural Drafter & Work Orders
    └── Admin Modules (admin_*.html)    <-- Overwatch Tools & Simulators