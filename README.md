# ⚡ SignOS v4.0 Unified Architecture (Headless ERP)

SignOS is a Cyber-Physical Operating System (CPOS) engineered to function as a high-fidelity digital twin of manufacturing reality [5]. It enforces a strict separation between the user interface ("The Face"), logic processing ("The Brain"), and persistent state ("The Memory") [8, 9].

## 🏗️ Core Architectural Mandates

1. **Zero Client-Side Math:** The browser is strictly a "Dumb Face" responsible only for UI state management, user input capture, and SVG rendering [10, 11]. No pricing, physics, or yield calculations may exist in HTML or client-side JavaScript [12].
2. **The "Twin-Engine" Protocol:** All calculations are isolated into two distinct streams within Supabase Edge Functions: the **Market Engine** (Retail Curves) and the **Physics Engine** (Hard Cost / Material Yield) [13, 14].
3. **Physics-First Bounding:** Calculations must mirror physical material yields (e.g., 4'x8' sheet constraints, 52" roll widths) rather than abstract square-foot averaging [12, 15].
4. **Performer Agnosticism:** System instructions must describe the *physics* of a task (force, vectors, toolpaths) rather than the identity of the worker (human vs. robot) [16, 17].

---

## 🚀 Recent Milestones & Upgrades

*   **The "Floating Island" UI & Avatar System:** Upgraded the entire frontend to a "Single-Tier Floating Island" design language. Headers and footers now float as centered, elevated modules with crisp `shadow-md` edges. Implemented a global, role-based Avatar identity system that dynamically renders initials and system colors (e.g., Purple for Overwatch, Red for Admin) across all modules.
*   **The "Twin-Engine" Edge Function Port:** Successfully migrated all core product calculators from client-side JS into **Supabase Edge Functions** (TypeScript/Deno) [5].
*   **Universal Cost Sandbox:** Integrated a dual-mode interactive ledger (`signos-sandbox.js`) into all calculators, allowing admins to test material overrides and inspect bidirectional math formulas without leaving the UI [6].
*   **Master Data Engine & SVG Library:** Deployed `admin_database.html` to serve as a unified procurement matrix [6]. Admins can globally update raw material costs, labor rates, machine overheads, and manage the central `ref_system_icons` SVG library dynamically.
*   **The Omni-Terminal:** Built `Omni_Terminal.html`, transitioning from hardcoded HTML files to a unified, schema-driven quoting workspace that dynamically generates UI controls based on the database [6].
*   **Automated CI/CD Pipelines:** Activated GitHub Actions (`deploy-functions.yml`) so that pushing to the repository automatically deploys Vercel UI updates and syncs Deno/TypeScript Edge Functions to the Supabase cloud [7, 18].
*   **User Profile & RLS Integrity:** Expanded `user_profile.html` to extract and expose secure UUIDs, enforcing Row Level Security (RLS) token handshakes for all personal settings updates [19, 20].

---

## 📂 Repository Architecture & File Map

The repository is strictly separated to isolate UI, Backend Logic, and Knowledge Documentation based on the latest 2026-03-18 state [1].

```text
SignOS-v3-Supabase/ (Root)
│
├── .github/workflows/                  <-- CI/CD AUTOMATION [21]
│   ├── deploy-functions.yml            <-- (Automated brain deployment) [1]
│   ├── nightly-health-check.yml        <-- (SRE Health Monitoring) [1]
│   ├── sync-changelog.yml              <-- (Automated Changelog tracking) [1]
│   └── sync-roadmap.yml                <-- (Automated Epic tracking) [1]
│
├── docs/                               <-- THE KNOWLEDGE BASE (6000s Protocols) [22]
│   └── 6430_Repository_Architecture.md <-- Directory Standards [1]
│
├── supabase/                           <-- THE BRAIN & MEMORY [23]
│   ├── migrations/                     <-- SQL Schema Definitions [3]
│   └── functions/                      <-- Deno/TypeScript Edge Functions [2]
│       ├── _shared/                    <-- Universal Physics Engines [2]
│       ├── calculate-acm/              <-- ACM Router Logic [2]
│       ├── calculate-ada/              <-- ADA/Braille Engine [2]
│       ├── calculate-banner/           <-- Banner Media Engine [2]
│       ├── calculate-coro/             <-- Coroplast Engine [2]
│       ├── calculate-cut/              <-- Cut Vinyl Engine [2]
│       ├── calculate-decal/            <-- Decal Print & Cut [2]
│       ├── calculate-foam/             <-- Foam Core Logic [2]
│       ├── calculate-nameplate/        <-- Engraving Stack Logic [2]
│       ├── calculate-post-panel/       <-- Structural/Architectural Drafts [2]
│       ├── calculate-pvc/              <-- PVC Logic [3]
│       ├── calculate-wall/             <-- Wall Wrap Yield [3]
│       ├── calculate-wrap/             <-- Vehicle Wrap Yield [3]
│       ├── calculate-yard/             <-- Yard Sign Logic [3]
│       └── system-health-check/        <-- SRE Automated Diagnostics [24]
│
├── tools/                              <-- LOCAL DEV & SRE TOOLS [4]
│   ├── backfill-commits.cjs            <-- Historical git sync [4]
│   └── generate-context.cjs            <-- Auto-sync script for NotebookLM [4]
│
└── signos-modern/                      <-- THE FACE (Vercel Frontend) [25]
    ├── fonts/                          <-- TTF files for Canvas engine (Arimo) [1, 2]
    ├── index.html                      <-- Secure Gateway Login [2]
    ├── menu.html                       <-- User Dashboard [2]
    ├── user_profile.html               <-- Self-Service Profile & Identity [2]
    │
    ├── Core System JS:                 <-- UI & API Handshake Managers [25]
    │   ├── signos-core.js              <-- Auth, Routing, Telemetry [2]
    │   ├── signos-ui.js                <-- Standardized Component Injection [2]
    │   ├── signos-canvas.js            <-- SVG rendering & Font physics [2]
    │   ├── signos-builder.js           <-- Dynamic layout generation [2]
    │   ├── signos-sandbox.js           <-- Dual-Ledger cost sandbox [2]
    │   └── signos-view-svg.js          <-- Spatial 2D/3D viewers [2]
    │
    ├── UI Modules (Calculators):       <-- "Dumb" Input Capture Forms [26]
    │   ├── Omni_Terminal.html          <-- Dynamic Schema-Driven Quoter [27]
    │   ├── Calculator_PostPanel.html   <-- 2D Architectural Drafter [28, 29]
    │   ├── Calculator_BulkNameplates.html
    │   ├── Calculator_Engraved.html
    │   └── [all other Calculator_*.html]
    │
    └── Admin Modules:                  <-- Overwatch Tools [30]
        ├── admin_database.html         <-- Master Data Engine (Variables) [30]
        ├── admin_product_forge.html    <-- UI/Schema JSON Builder [30]
        ├── admin_simulator.html        <-- Zero-Variance AI Stress Tester [30]
        ├── admin_staff.html            <-- Workforce & RBAC Manager [30]
        ├── admin_analytics.html        <-- Profit Heatmap Engine [31]
        ├── admin_changelog.html        <-- GitHub/System History [32]
        ├── admin_system.html           <-- CPOS Command Center [30]
        └── admin_viewer.html           <-- System Telemetry Logs [30]

--------------------------------------------------------------------------------
🤖 The AI Agent Workforce (The Mesh)
SignOS replaces traditional administrative bloat with a multi-tier agentic mesh
.
Tier 1 (Market Intake): VIR_AGENT_SALES (Converts natural language into 3D physics inputs) and VIR_AGENT_DSGN (Generates production-ready SVG artwork)
.
Tier 2 (Fabrication Silos): Agents like VIR_AGENT_ADA (Enforces Z-axis limits and Braille math) and VIR_AGENT_MACH (Force and toolpath generation) protect physical boundaries
.
Tier 3 (Operational Overwatch): Agents like VIR_AGENT_SCHED (Manages the "Routing Hub") and VIR_AGENT_QA (Visual snapshot auditing) keep jobs flowing without bottlenecks
.
Tier 4 (Strategic Orchestration): VIR_AGENT_ORCHESTRATOR (The Overwatch) serves as the sovereign authority for system architecture and conflict resolution across the shop floor
.
The Data Baton (Convergence Handshakes)
Moving parts between departments requires a "Data Baton" to ensure agents stay synchronized
. A valid payload must include:
parent_manifest_id (Link to the 3D model)
.
physical_location_tag (GPS or Bin Location)
.
qa_hash_confirmation (Worker-uploaded verification photo)
.
handling_instructions (Performer-agnostic safety data)
.

--------------------------------------------------------------------------------
🔒 Deployment & The Zero-Variance Gate
The promotion of code from DEV to LIVE strictly adheres to the Zero-Variance Simulation Protocol
:
Develop: Math and logic updates are written locally and pushed to the dev branch
.
Stress Test: The code is run through admin_simulator.html, which triggers the Edge Function with array payloads representing 1 to 1,000 unit volumes
.
Verify: Code promotion is physically blocked unless the simulator returns a strict $0.00 variance between the new algorithm's cost and the shop's established target margins
.
Deploy: Upon verification, the branch is merged, triggering .github/workflows/deploy-functions.yml to seamlessly sync the Brain to the cloud
.
