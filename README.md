# ⚡ SignOS v4.0: Cyber-Physical Operating System & Headless ERP

Welcome to **SignOS v4.0**. Originally conceived as a quoting tool for The Sign Store (Macon Hub), SignOS has evolved into a fully autonomous Cyber-Physical Operating System (CPOS) and Headless ERP. 

SignOS is engineered to function as a high-fidelity digital twin of manufacturing reality. By orchestrating humans, robots, and AI agents through absolute 3D spatial truth, the system guarantees that what is quoted on the sales floor can be perfectly manufactured on the shop floor.

---

## 🛠️ The Technology Stack

SignOS utilizes a strictly decoupled, "Headless" architecture divided into specialized logical layers to ensure maximum performance, security, and scalability:

*   **The Face (Frontend UI):** Pure HTML, Tailwind CSS, and Vanilla JS hosted on **Vercel**. The frontend is deliberately "dumb"—restricted exclusively to UI state management, user input capture, and dynamic SVG/Canvas rendering.
*   **The Brain (Logic Engine):** **Supabase Edge Functions** powered by Deno and TypeScript. All heavy-duty manufacturing math, physics yields, and pricing logic are executed server-side.
*   **The Memory (Database):** **PostgreSQL** (via Supabase) serves as the single source of truth. It enforces a strict relational taxonomy separating references (`ref_`), product schemas (`prod_`), system logs (`sys_`), and user profiles (`usr_`).
*   **The Shield (Security & Routing):** **Cloudflare** manages DNS, SSL, and Zero-Trust access to ensure the administrative perimeter remains secure.
*   **The 3D Studio (VPS Integration):** A containerized hybrid environment built with **React, @react-three/fiber, and Three.js** to handle complex 3D rendering, engineering blueprints, and WebGL physics (e.g., Channel Letters).
*   **The Mesh (AI Integration):** **Google Gemini API** and NotebookLM power the conversational LLM bridges, automated ticketing, and computer vision QA agents.

---

## 🏛️ Core Architectural Mandates

Every piece of code committed to this repository must adhere to the following unshakeable protocols:

1.  **Zero Client-Side Math:** Absolutely no pricing logic, waste algorithms, or machine yield math may exist in HTML or JS files. All mathematics must happen in the Deno Edge Functions.
2.  **The "No Fallback" Mandate:** Edge Functions must never rely on hardcoded fallback prices. They must query the `ref_` tables via Shared Agents. If a material SKU or labor rate is missing, the system must instantly throw a fatal 500 error to halt production and prevent profit drift.
3.  **The Twin-Engine Approach:** The system simultaneously runs two distinct calculators for every job. The **Retail Engine** calculates threshold-based market pricing, while the **Physics Engine** calculates the exact hard cost of raw materials and labor. 
4.  **Physical Yield & "Physics-First" Math:** The engine bills for the physical footprint consumed (e.g., linear feet of a 24ft steel stick or bounding-box nesting on a 4x8 sheet), applying the Non-Zero Remnant Rule.
5.  **Global Entity Taxonomy:** Everything follows the `[Class]_[Category]_[Identifier]` model. Classes include `PHY_` (Physical Hardware/Staff), `VIR_` (Virtual Manifests/Agents), `OPS_` (Operations), `EDU_` (Training), and `FIN_` (Ledgers).

---

## 📂 Repository Architecture & File Map

The repository is strictly structured to isolate the UI, Backend Logic, CI/CD automations, and Knowledge Base documentation.

```text
SignOS-v3-Supabase/ (Root)
│
├── .github/workflows/                  <-- CI/CD AUTOMATION
│   ├── deploy-functions.yml            <-- (Auto-deploys Deno Brain to Supabase)
│   └── nightly-health-check.yml        <-- (SRE automated diagnostics)
│
├── docs/                               <-- THE KNOWLEDGE BASE (6000s Protocols)
│   ├── 6100_System_Architecture.md     <-- Unified Architecture & Silos
│   └── 6430_Repository_Architecture.md <-- Strict Directory Standards
│
├── supabase/                           <-- THE BRAIN & MEMORY
│   ├── migrations/                     <-- SQL Schema Definitions
│   └── functions/                      <-- Deno/TypeScript Edge Functions
│       │
│       ├── _shared/agents/             <-- UNIVERSAL AGENT HUBS (NO FALLBACKS)
│       │   ├── Agent_Material_Stock.ts <-- SKU inventory & physical Bounding Box math
│       │   ├── Agent_Labor_Ops.ts      <-- Role-based workforce cost routing
│       │   ├── Agent_Machine_Physics.ts<-- Machine overhead & ink depletion tracking
│       │   ├── Agent_Retail_Market.ts  <-- Threshold-based tiered market pricing
│       │   └── Agent_System_Auth.ts    <-- Edge-level Row Level Security (RLS) check
│       │
│       ├── calculate-acm/              <-- Rigid substrate physics engines
│       ├── calculate-ada/              <-- Multi-Layer 3D Z-axis logic
│       ├── calculate-post-panel/       <-- Heavy Structural fabrication math
│       └── [all other calculate-* functions]
│
├── tools/                              <-- LOCAL DEV & SRE TOOLS
│   └── generate-context.cjs            <-- Auto-sync script for NotebookLM AI Context
│
├── vps-3d-studio/                      <-- HYBRID 3D/WEBGL CONTAINER
│   ├── src/components/Viewer3D         <-- React/Three.js Spatial Viewers
│   └── src/services                    <-- Blueprint, Export, and Gemini Logic
│
└── signos-modern/                      <-- THE FACE (Vercel Frontend)
    ├── index.html                      <-- Secure Gateway Login
    ├── menu.html                       <-- User Dashboard
    │
    ├── Core System JS:                 <-- UI & API Handshake Managers
    │   ├── signos-core.js              <-- Auth, Routing, Telemetry
    │   ├── signos-ui.js                <-- Standardized UI Component Injection
    │   ├── signos-canvas.js            <-- SVG typography rendering & physics
    │   ├── signos-builder.js           <-- Dynamic layout & coordinate generation
    │   ├── signos-sandbox.js           <-- Dual-Ledger cost sandbox & auditor
    │   ├── signos-view-svg.js          <-- Spatial 2D/3D viewers
    │   └── signos-export-v2.js         <-- CorelDraw & PDF Work Order pipeline
    │
    ├── UI Modules (Calculators):       <-- "Dumb" Input Capture Forms
    │   ├── Omni_Terminal.html          <-- Dynamic Schema-Driven Quoter
    │   ├── Calculator_PostPanel.html   <-- 2D Architectural Drafter
    │   └── [all other Calculator_*.html]
    │
    └── Admin Modules:                  <-- Overwatch Tools
        ├── admin_database.html         <-- Master Data Engine (Variables)
        ├── admin_product_forge.html    <-- UI/Schema JSON Builder
        ├── admin_simulator.html        <-- Zero-Variance AI Stress Tester
        ├── admin_staff.html            <-- Workforce & RBAC Manager
        ├── admin_audit.html            <-- Retail vs Cost Price Auditor
        ├── admin_roadmap.html          <-- Master Epic/Strategy Board
        └── admin_system.html           <-- CPOS Command Center & RLS Auditor
```

---

## 🔮 Where We Are Going (The Roadmap)

SignOS is actively transitioning from a purely computational ERP into a sentient manufacturing manager. Our immediate trajectory focuses on:

### 1. The Omni-Terminal Transition
We are deprecating individual, hardcoded HTML calculators (e.g., `Calculator_Coro.html`) in favor of the **Omni_Terminal.html**. This unified quoting workspace queries the Supabase `system_modules` JSON schemas and builds the UI dynamically. If a new material is added to the database, the sales UI updates instantly without developer intervention.

### 2. The AI Agent Workforce (The Mesh)
SignOS replaces administrative bloat with a multi-tier agentic mesh that automates tedious operational tasks:
*   **`VIR_AGENT_SALES`**: Translates customer dreams and natural language into precise 3D physics inputs.
*   **`VIR_AGENT_DSGN`**: Generates production-ready SVG artwork and spatial anchors.
*   **`VIR_AGENT_QA`**: Sweeps Google Photos via Computer Vision to auto-match and verify completed physical signs against the database's 3D Manifests.
*   **`VIR_AGENT_MACH` / `VIR_AGENT_ADA`**: Acts as the "Physics Guard" for Subtractive Manufacturing. Enforces Z-axis limits (e.g., stopping a router bit from plunging too deep) and calculates toolpaths.

### 3. Public Launch & Integration
SignOS is being hardened for commercial readiness. This includes scrubbing internal Macon Hub financial data, hardening Row Level Security (RLS) with Zero-Trust parameters, and generating an automated public demo environment. Furthermore, we are actively building out integrations to ingest XML tickets from external ERPs (like FreshDesk) to automatically schedule Work Orders.

---

## 🔒 Deployment & The Zero-Variance Gate

The deployment of code from the `dev` branch to the `main` branch (LIVE) is strictly governed by the **Zero-Variance Simulation Protocol**:

1.  **Develop:** Logic is written locally and pushed to the `dev` branch.
2.  **Stress Test:** The code must be run through `admin_simulator.html`.
3.  **Verify:** Code promotion is **physically blocked** unless the simulator returns a strict `$0.00` variance across a 1 to 1,000 unit volume test between the legacy blue sheets and the new Edge Function algorithms.
4.  **Deploy:** Upon verification, the code is merged to `main`, which automatically triggers GitHub Actions (`deploy-functions.yml`) to deploy the logic to the live Supabase cloud.
~~~