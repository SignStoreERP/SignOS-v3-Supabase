# SignOS v4.0: Cyber-Physical Operating System (CPOS)

SignOS v4.0 is a "Headless" ERP designed specifically for the sign manufacturing industry [1]. Moving beyond traditional quoting tools, SignOS functions as a High-Fidelity Simulation of a manufacturing business, orchestrating humans, hardware, and AI agents through physical material yields and spatial truth [1].

🔗 **Live System Access (Secure Gateway):** [https://signos-v3-supabase.vercel.app/](https://signos-v3-supabase.vercel.app/)
*(Note: Access requires authorized SignStore employee credentials and 6-digit PIN mapping via Supabase Auth) [1].*

---

## 🚀 What We've Done (Recent Milestones)

*   **Post & Panel 2D Architectural Drafting Engine:** We successfully moved away from experimental 3D CSS views, pivoting back to a rock-solid, precise 2D SVG architectural drafting engine. The `Calculator_PostPanel.html` module now dynamically renders mathematically accurate Front Elevation and Side Profile views, perfectly anchoring components to `y = 0` and auto-calculating internal frame bridging based on "Flush" vs. "Between" mounting styles.
*   **The "Twin-Engine" Physics Port:** We successfully migrated all core product calculators from client-side JS into **Supabase Edge Functions** (TypeScript/Deno) [2, 3]. The system now strictly isolates Market/Retail pricing from Physics/Hard Costs [4].
*   **Universal Cost Sandbox:** Integrated a dual-mode interactive ledger (`signos-sandbox.js`) into all calculators, allowing admins to test material overrides and inspect bidirectional math formulas without leaving the UI [5, 6].
*   **Master Data Engine:** Deployed `admin_database.html` to serve as a unified procurement matrix. Admins can globally update raw material costs, labor rates, and machine overheads, which instantly sync across all quoting modules [5, 7].
*   **The Omni-Terminal:** Built `Omni_Terminal.html`, transitioning from hardcoded HTML files to a unified, schema-driven quoting workspace that dynamically generates UI controls based on the product database [8, 9].

---

## 🛠️ Where We're Going (The Roadmap)

### 1. AI Agent Orchestration (The Cyber-Physical Workforce)
*   **VIR_AGENT_QA (Visual Auditor):** Replacing manual photo sorting by sweeping the Google Photos API with computer vision to auto-match shop floor photos to Job IDs based on physical geometry [10].
*   **VIR_AGENT_MACH (Physics Guard):** Physics engine validation for subtractive machine operations (CNC routers, etching pods) to ensure gantry safety and enforce the "Bit Awareness" protocol [11, 12].
*   **The Data Baton (Handshakes):** Expanding the UI to support `HANDSHAKE` logic gates between departmental silos, preventing Novice (Rank 1) users from passing work without Expert (Rank 3) signatures [13, 14].

### 2. FreshDesk Migration & Native Ticketing
*   **The Landing Pad & Relational Bridge:** Ingesting 10,000+ XML/CSV legacy FreshDesk tickets and transforming flat-string requesters into permanent relational keys mapping to PostgreSQL [15, 16].
*   **MES Supercharger:** Automated task-splitting engine to break monolithic work orders into departmental child tasks [17].

### 3. Advanced Fabrication Logic & Analytics
*   **Channel Letter Core:** Developing internal logic for Coil, Trim Cap, and LED power supply calculations [18].
*   **Profit Heatmap Analytics Engine:** Enhancing `admin_analytics.html` to chart pricing "sweet spots" and visualize margin intersections for volume runs [19].

### 4. DevOps & Infrastructure Improvements
*   **Automated Edge Function CI/CD:** Finalizing GitHub Actions YAML workflows so that a push automatically deploys Edge Functions alongside the Vercel UI [20].
*   **Automated Unit Testing:** Building physics test suites to ensure logic changes don't silently break margin math (Zero-Variance simulator expansion) [21].

---

## 💻 Our Tooling Ecosystem

SignOS utilizes a strict isolation protocol, leveraging a modern headless stack and AI-assisted workflows:

*   **Vercel (The Face):** Hosts the frontend UI application. It is built with pure HTML, Tailwind CSS, and vanilla JavaScript (`signos-core.js`). Vercel handles Preview Deployments for staging/sandbox testing [22, 23]. It strictly follows a "Zero Client-Side Math" mandate [4].
*   **Supabase (The Brain & Memory):** Acts as the primary backend. It manages the PostgreSQL database (the single source of truth for the Global Entity Taxonomy), handles 6-digit PIN Authentication & Row Level Security (RLS), and executes the TypeScript/Deno **Edge Functions** where the heavy physics math lives [24, 25].
*   **GitHub (The Source):** The absolute source of truth for all logic and markup. Code pushed to `main` triggers Vercel production deployments, while the `dev` branch spins up preview staging URLs [22, 26].
*   **Docker (Local Development):** Used locally via the Supabase CLI (`npx supabase start`). It runs a localized, isolated replica of the PostgreSQL database and Edge Functions at `localhost:54321`, ensuring that local development tests never affect live shop financials [27, 28].
*   **VS Code:** Our primary IDE. It utilizes extensions like Cursor/Continue for AI assistance. The workspace is governed by a `.cursorrules` file that acts as the "Constitutional" instruction set for the AI, enforcing naming conventions, architectural standards, and preventing the hallucination of pricing math [28, 29].
*   **NotebookLM (The Overwatch):** Acts as our central system architect and knowledge library. We feed it exported system states, database schemas (`SignOS_DEV_Backend_Context.txt`), and 6000-series documentation protocols [30]. It maintains the holistic context of the "Physics-First" principles across the entire codebase, guiding us before writing new features [30].

---

## 📂 Repository Architecture & File Map

The repository is strictly separated to isolate UI, Backend Logic, and Knowledge Documentation [31].

```text
SignOS-v3-Supabase/ (Root)
│
├── .github/                            <-- CI/CD AUTOMATION
│   └── workflows/deploy-functions.yml  <-- (Automated brain deployment) [32]
│
├── docs/                               <-- THE KNOWLEDGE BASE (6000s protocols) [32]
│   ├── 6000_COA-DOC.md                 <-- Numerical Chart of Accounts [33]
│   ├── 6410_Development_Protocol.md    <-- Headless DevOps standard [34]
│   ├── 6420_Master_Dev_Tracker.md      <-- Module status tracker [34]
│   └── 6600_Agent_Orchestration...     <-- AI Agent specifications [35]
│
├── supabase/                           <-- THE BRAIN & MEMORY [32]
│   ├── migrations/                     <-- SQL Schema (ref_, sys_, prod_) [36]
│   └── functions/                      <-- Deno/TypeScript Edge Functions [37]
│       ├── calculate-acm/
│       ├── calculate-ada/
│       ├── calculate-post-panel/
│       └── [all other physics engines]
│
├── tools/                              <-- LOCAL DEV TOOLS [37]
│   └── generate-context.js             <-- Auto-sync script for NotebookLM [37]
│
└── signos-modern/                      <-- THE FACE (Vercel Frontend) [37]
    ├── fonts/                          <-- TTF files for Canvas engine [37]
    ├── index.html                      <-- Secure Gateway Login [38]
    ├── menu.html                       <-- User Dashboard [38]
    │
    ├── Core System JS:                 <-- UI & API Handshake Managers
    │   ├── signos-core.js              <-- Auth, Routing, Telemetry [39]
    │   ├── signos-ui.js                <-- Standardized components [39]
    │   ├── signos-canvas.js            <-- SVG rendering & Font physics [39]
    │   ├── signos-builder.js           <-- Dynamic layout generation [39]
    │   ├── signos-sandbox.js           <-- Dual-Ledger cost sandbox [5]
    │   ├── signos-export-v2.js         <-- SVG CorelDraw pipeline [39]
    │   └── signos-view-svg.js          <-- Spatial 2D/3D viewers [39]
    │
    ├── UI Modules (Calculators):       <-- "Dumb" Input Capture Forms
    │   ├── Omni_Terminal.html          <-- Dynamic Schema-Driven Quoter [8]
    │   ├── Calculator_PostPanel.html   <-- 2D Architectural Drafter
    │   ├── Calculator_BulkNameplates.html
    │   ├── Calculator_Engraved.html
    │   └── [all other Calculator_*.html]
    │
    └── Admin Modules:                  <-- Overwatch Tools
        ├── admin_database.html         <-- Master Data Engine (Variables) [5]
        ├── admin_product_forge.html    <-- UI/Schema JSON Builder [8]
        ├── admin_simulator.html        <-- Zero-Variance AI Stress Tester [40]
        ├── admin_staff.html            <-- Workforce Role Manager [40]
        ├── admin_analytics.html        <-- Profit Heatmap Engine [41]
        ├── admin_changelog.html        <-- GitHub/System History [40]
        └── admin_viewer.html           <-- System Telemetry Logs [40]
