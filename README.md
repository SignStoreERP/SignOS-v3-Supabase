# SignOS v4.0: Cyber-Physical Operating System (CPOS)

SignOS v4.0 is a "Headless" ERP designed specifically for the sign manufacturing industry. Moving beyond traditional quoting tools, SignOS functions as a High-Fidelity Simulation of a manufacturing business, orchestrating humans, hardware, and AI agents through physical material yields and 3D spatial truth.

🔗 **Live System Access (Secure Gateway):** [https://signos-v3-supabase.vercel.app/](https://signos-v3-supabase.vercel.app/)
*(Note: Access requires authorized SignStore employee credentials and 6-digit PIN mapping via Supabase Auth).*

---

## 🏗️ The Headless Architecture

To maintain the integrity of our "Digital Twin," the system enforces a strict separation of concerns across five logical layers:

*   **The Face (Vercel):** The frontend UI (HTML/Tailwind). Strictly "dumb" and restricted to state management, user input capture, and Schema-Driven UI rendering. Zero client-side financial math is permitted.
*   **The Brain (Supabase Edge Functions):** Deno/TypeScript serverless functions. All physics simulations, material yield calculations, and retail pricing curves execute here.
*   **The Memory (PostgreSQL):** The relational database acting as the single source of truth for the Global Entity Taxonomy (Physical, Virtual, Operational, Financial, and Educational data).
*   **The Shield (Cloudflare):** Manages DNS, SSL, Edge caching of heavy 3D textures, and Zero-Trust network perimeters for admin tools.
*   **The Source (GitHub):** The single source of truth for logic and markup. No binary file bloat.

## 🧠 Core Engineering Mandates

*   **Zero Client-Side Math:** The browser never computes pricing. All math is requested from the Edge Function Brain.
*   **Physics-First Yields:** Calculations must mirror physical material constraints (e.g., 4'x8' rigid sheet bounding boxes or 54" roll widths) rather than abstract square-foot averaging.
*   **Performer Agnosticism:** System instruction sets describe the *physics* of the task (vectors, forces, depths) rather than the identity of the worker, ensuring seamless handoffs between humans and future robotics.

---

## 🚀 Live Production Modules

The following calculators and tools are successfully migrated to the Supabase Edge Functions architecture, fully utilizing the "Twin-Engine" (Market vs. Physics) approach:

### Subtractive, Structural & Rigid Signs (SILO_MACH & SILO_METL)
*   🟢 **ADA Quoter** (`Calculator_Engraved.html`)
*   🟢 **ADA Nameplates & Sliders** (`Calculator_Nameplate.html`)
*   🟢 **Bulk Nameplate Generator** (`Calculator_BulkNameplates.html`)
*   🟢 **Post & Panel Systems** (`Calculator_PostPanel.html`)
*   🟢 **ACM Signs** (`Calculator_ACM.html`)
*   🟢 **Custom Coroplast** (`Calculator_Coro.html`)
*   🟢 **Yard Signs** (`Calculator_YardSign.html`)
*   🟢 **PVC Signs** (`Calculator_PVC.html`)
*   🟢 **Foam Core** (`Calculator_Foam.html`)
*   🟢 **Acrylic Signs** (`Calculator_Acrylic.html`)

### Roll Media & Graphics (SILO_VNYL)
*   🟢 **Cut Vinyl Lettering** (`Calculator_CutVinyl.html`)
*   🟢 **Digital Print / Decals** (`Calculator_Decal.html`)
*   🟢 **Vinyl Banners** (`Calculator_Banner.html`)
*   🟢 **Vehicle Wraps** (`Calculator_Wrap.html`)
*   🟢 **Interior Wall Wraps** (`Calculator_Wall.html`)

---

## ⚙️ Core Infrastructure & Admin Tools

*   🟢 **Universal Cost Sandbox:** Dual-mode interactive UI natively injected into calculators for live physics/market variable overrides.
*   🟢 **Universal Spatial Preview Tool:** Centralized 2D/3D visualizer that reads absolute Z-axis arrays to dynamically build accurate material stack previews.
*   🟢 **Schema-Driven UI Injector:** Headless javascript engine that automatically builds data-driven modals, layer-stacks, and color grids without hardcoded HTML.
*   🟢 **Master Strategy Board:** Kanban epic tracker (`admin_roadmap.html`).
*   🟢 **Pricing Analytics:** Visual heatmap simulator for margin testing (`admin_analytics.html`).
*   🟢 **Log Viewer & System Activity:** Real-time audit trails (`admin_viewer.html`, `admin_changelog.html`).
*   🟢 **Log Backup Utility:** Manual Google Drive archival (`admin_backup.html`).

---

## 🗺️ Active Roadmap (Next Sprints)

### 1. The "Scorched Earth" Purge
*   **Objective:** Complete decommissioning of all legacy local math functions in remaining `cost_*.js` files. 
*   **Action:** Replacing legacy functions with sanitized `_CONFIG` schemas to ensure absolute security and enforce the "Zero Client-Side Math" mandate.

### 2. FreshDesk Migration & Native Ticketing
*   **The Landing Pad:** Raw ingestion of 10,000+ XML/CSV legacy tickets for historical preservation.
*   **The Relational Bridge:** Transforming flat-string requesters into permanent relational keys mapped to `crm_customers` and `master_staff`.

### 3. AI Agent Orchestration (The Cyber-Physical Workforce)
*   **VIR_AGENT_QA (Visual Auditor):** Sweeping Google Photos APIs to auto-match shop floor QA photos to Job IDs using computer vision.
*   **The Data Baton:** Expanding the UI to support inter-departmental `HANDSHAKE` logic gates, blocking Novice (Rank 1) users from releasing tasks without Expert (Rank 3) signatures.

### 4. Phase 5: v2.0 Architecture
*   **Universal Product Generator Tool:** Building a node-based interface that allows admins to construct new calculators visually by linking raw materials, sub-assemblies, and labor workflows without touching code.

---

## 📂 Repository Architecture

```text
SignOS-v3-Supabase/
│
├── .github/                            <-- CI/CD AUTOMATION
│   └── workflows/
│       └── deploy-functions.yml        <-- Automated Edge Function deployment
│
├── docs/                               <-- KNOWLEDGE BASE (6000s)
│   ├── 6410_Development_Protocol.md
│   ├── 6420_Master_Development_Tracker.md
│   └── ...
│
├── supabase/                           <-- THE BRAIN & MEMORY
│   ├── migrations/                     <-- SQL Relational Schemas
│   └── functions/                      <-- Deno/TypeScript Edge Functions
│
├── tools/                              <-- LOCAL DEV TOOLS
│   └── generate-context.js             <-- Auto-sync script for AI contexts
│
└── signos-modern/                      <-- THE FACE (Vercel Frontend)
    ├── fonts/                          <-- Local TTF files for Canvas engine
    ├── index.html                      <-- Secure Gateway
    ├── menu.html                       <-- Role-based Dashboard
    ├── signos-core.js                  <-- Handshake routing & telemetry
    ├── signos-ui.js                    <-- Schema-Driven UI Injector
    ├── signos-view-svg.js              <-- Universal Spatial Preview Tool
    ├── signos-sandbox.js               <-- Universal Cost Sandbox
    └── Calculator_*.html               <-- Headless UI modules
