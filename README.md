# SignOS v4.0 Unified Architecture

SignOS is a Cyber-Physical Operating System (CPOS) engineered to function as a high-fidelity simulation of manufacturing reality. It enforces a strict separation between the user interface, logic processing, and persistent state.

## 🚀 What We've Done (Recent Milestones)
*   **The "Twin-Engine" Physics Port:** We successfully migrated all core product calculators from client-side JS into **Supabase Edge Functions** (TypeScript/Deno). The system now strictly isolates Market/Retail pricing from Physics/Hard Costs.
*   **Universal Cost Sandbox:** Integrated a dual-mode interactive ledger (`signos-sandbox.js`) into all calculators, allowing admins to test material overrides and inspect bidirectional math formulas without leaving the UI.
*   **Master Data Engine:** Deployed `admin_database.html` to serve as a unified procurement matrix. Admins can globally update raw material costs, labor rates, and machine overheads, which instantly sync across all quoting modules.
*   **The Omni-Terminal:** Built `Omni_Terminal.html`, transitioning from hardcoded HTML files to a unified, schema-driven quoting workspace that dynamically generates UI controls based on the product database.
*   **Automated Edge Function CI/CD:** Successfully activated the GitHub Actions workflow pipeline (`deploy-functions.yml`). Pushing to the repository now automatically deploys the Vercel UI and simultaneously syncs the Deno/TypeScript Edge Functions to the live Supabase cloud, completely eliminating manual backend terminal deployments.
*   **Physics/Retail Decoupling & Batch Auditing:** Upgraded the Edge Function architecture to support bulk array payloads and separated the Retail Engine (`VIR_AGENT_SALES`) from the Physics Engine (`VIR_AGENT_MACH`). The Price Auditor now executes 100+ simulations in a single, zero-latency parallel network request using a 4-Option SRE Throttle (`full`, `retail_only`, `cost_only`, `db_verify`).

## 🛠️ Where We're Going (The Roadmap)

### 1. AI Agent Orchestration (The Cyber-Physical Workforce)
*   **VIR_AGENT_QA (Visual Auditor):** Replacing manual photo sorting by sweeping the Google Photos API with computer vision to auto-match shop floor photos to Job IDs based on physical geometry.
*   **VIR_AGENT_MACH (Physics Guard):** Physics engine validation for subtractive machine operations (CNC routers, etching pods) to ensure gantry safety and enforce the "Bit Awareness" protocol.
*   **The Data Baton (Handshakes):** Expanding the UI to support `HANDSHAKE` logic gates between departmental silos, preventing Novice (Rank 1) users from passing work without Expert (Rank 3) signatures.

### 2. FreshDesk Migration & Native Ticketing
*   **The Landing Pad & Relational Bridge:** Ingesting 10,000+ XML/CSV legacy FreshDesk tickets and transforming flat-string requesters into permanent relational keys mapping to PostgreSQL.
*   **MES Supercharger:** Automated task-splitting engine to break monolithic work orders into departmental child tasks.

### 3. Advanced Fabrication Logic & Analytics
*   **Channel Letter Core:** Developing internal logic for Coil, Trim Cap, and LED power supply calculations.
*   **Profit Heatmap Analytics Engine:** Enhancing `admin_analytics.html` to chart pricing "sweet spots" and visualize margin intersections for volume runs.

### 4. DevOps & Infrastructure Improvements
*   **NotebookLM (The Overwatch):** Acts as our central system architect and knowledge library. We feed it exported system states, database schemas (`SignOS_DEV_Backend_Context.txt`), and 6000-series documentation protocols. It maintains the holistic context of the "Physics-First" principles across the entire codebase, guiding us before writing new features.

## 📂 Repository Architecture & File Map
The repository is strictly separated to isolate UI, Backend Logic, and Knowledge Documentation.

```text
SignOS-v3-Supabase/ (Root)
│
├── .github/                            <-- CI/CD AUTOMATION
│   └── workflows/deploy-functions.yml  <-- (Automated brain deployment)
│
├── docs/                               <-- THE KNOWLEDGE BASE (6000s protocols)
│   ├── 6000_COA-DOC.md                 <-- Numerical Chart of Accounts
│   ├── 6410_Development_Protocol.md    <-- Headless DevOps standard
│   ├── 6420_Master_Dev_Tracker.md      <-- Module status tracker
│   └── 6600_Agent_Orchestration...     <-- AI Agent specifications
│
├── supabase/                           <-- THE BRAIN & MEMORY
│   ├── migrations/                     <-- SQL Schema (ref_, sys_, prod_)
│   └── functions/                      <-- Deno/TypeScript Edge Functions
│       ├── calculate-acm/
│       ├── calculate-ada/
│       ├── calculate-post-panel/
│       └── [all other physics engines]
│
├── tools/                              <-- LOCAL DEV TOOLS
│   └── generate-context.cjs            <-- Auto-sync script for NotebookLM
│
└── signos-modern/                      <-- THE FACE (Vercel Frontend)
    ├── fonts/                          <-- TTF files for Canvas engine
    ├── index.html                      <-- Secure Gateway Login
    ├── menu.html                       <-- User Dashboard
    ├── signos-core.js                  <-- Handshake routing
    ├── signos-ui.js                    <-- UI component generation
    ├── signos-canvas.js                <-- SVG rendering & Font physics
    ├── signos-builder.js               <-- Dynamic layout generation
    ├── signos-sandbox.js               <-- Dual-Ledger cost sandbox
    ├── signos-export-v2.js             <-- SVG CorelDraw pipeline
    └── signos-view-svg.js              <-- Spatial 2D/3D viewers
│
├── UI Modules (Calculators):           <-- "Dumb" Input Capture Forms
│   ├── Omni_Terminal.html              <-- Dynamic Schema-Driven Quoter
│   ├── Calculator_PostPanel.html       <-- 2D Architectural Drafter
│   ├── Calculator_BulkNameplates.html
│   ├── Calculator_Engraved.html
│   └── [all other Calculator_*.html]
│
└── Admin Modules:                      <-- Overwatch Tools
    ├── admin_database.html             <-- Master Data Engine (Variables)
    ├── admin_product_forge.html        <-- UI/Schema JSON Builder
    ├── admin_simulator.html            <-- Zero-Variance AI Stress Tester
    ├── admin_staff.html                <-- Workforce Role Manager
    ├── admin_analytics.html            <-- Profit Heatmap Engine
    ├── admin_changelog.html            <-- GitHub/System History
    └── admin_viewer.html               <-- System Telemetry Logs
