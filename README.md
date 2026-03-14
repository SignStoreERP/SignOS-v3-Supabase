# SignOS v4.0: Cyber-Physical Operating System (CPOS)

SignOS v4.0 is a "Headless" ERP designed specifically for the sign manufacturing industry. Moving beyond traditional quoting tools, SignOS functions as a High-Fidelity Simulation of a manufacturing business, orchestrating humans, hardware, and AI agents through physical material yields and 3D spatial truth.

🔗 **Live System Access (Secure Gateway):** [https://signos-v3-supabase.vercel.app/](https://signos-v3-supabase.vercel.app/)  
*(Note: Access requires authorized SignStore employee credentials and 6-digit PIN mapping via Supabase Auth).*

---

## 🏗️ System Architecture & Tech Stack

SignOS is built on a strict "Twin-Engine" logic model, isolating Market/Retail pricing from Physics/Hard Costs. It strictly separates concerns into distinct architectural layers:

*   **The Face (Frontend UI):** Hosted on **Vercel**. Built with pure **HTML**, **Tailwind CSS**, and vanilla **JavaScript** (`signos-core.js`, `signos-ui.js`, `signos-canvas.js`). Follows a strict "Zero Client-Side Math" mandate; the browser acts purely as a "dumb" input-capture and SVG rendering layer.
*   **The Brain (Logic Engine):** Powered by **Supabase Edge Functions** (Deno/TypeScript) and **Python FastAPI** services. All pricing, physics algorithms, and "Bounding Box" yield mathematics occur strictly server-side.
*   **The Memory (Database):** A centralized **PostgreSQL** database hosted on **Supabase**. Governed by a Global Entity Taxonomy (`ref_` for knowledge/materials, `prod_` for market curves, `sys_` for infrastructure, `usr_` for roles).
*   **The Shield (Security & Routing):** **Cloudflare** handles DNS, SSL, Edge Caching (for 3D textures), and Zero Trust access restrictions for admin modules.
*   **The Source (Version Control):** **GitHub** acts as the single source of truth for logic and markup, preventing binary file bloat.
*   **The Library (External APIs):** **Google Workspace** integrations. Google Drive stores high-res vectors/PDFs, Google Maps handles field install coordinates, and Google Photos manages the production QA visual stream.

---

## 🚀 Approved & Live Modules

The following calculators and tools have been successfully migrated to the Supabase Edge Functions architecture. They adhere to the "Physics-First" and "No Hardcoding" rules, pulling live variables directly from the SQL matrices:

### Rigid Media (Sheet Yield Physics)
*   🟢 **Yard Signs** (`PROD_Yard` via `calculate-yard`)
*   🟢 **Custom Coroplast** (`PROD_Coro` via `calculate-coro`)
*   🟢 **ACM Signs** (`PROD_ACM` via `calculate-acm`)
*   🟢 **PVC Signs** (`PROD_PVC` via `calculate-pvc`)
*   🟢 **Foam Core Boards** (`PROD_Foam` via `calculate-foam`)
*   🟢 **Acrylic Signs** (`PROD_Acr` via `calculate-acrylic`)

### Roll Media (Linear Feed Physics)
*   🟢 **Vinyl Banners** (`PROD_Ban` via `calculate-banner`)
*   🟢 **Digital Print / Decals** (`PROD_Dec` via `calculate-decal`)
*   🟢 **Cut Vinyl Lettering** (`PROD_Cut` via `calculate-cut`)
*   🟢 **Vehicle Wraps** (`PROD_Wrap` via `calculate-wrap`)
*   🟢 **Interior Wall Wraps** (`PROD_Wall` via `calculate-wall`)

### System & Admin Infrastructure
*   🟢 **Log Viewer / Site Activity** (`admin_viewer.html`)
*   🟢 **Log Backup Utility** (`admin_backup.html`)
*   🟢 **Master Strategy Board** (`admin_roadmap.html`)
*   🟢 **System Changelog** (`admin_changelog.html`)

---

## 🛠️ Roadmap & Next Up

Based on the Master Development Tracker and System Roadmaps, here are the immediate priorities for upcoming development sprints:

### 1. ADA, Nameplates & 3D Fabrication
*   🟡 **ADA Quoter / Engraved Signs** (`Calculator_Engraved.html`) - Finalizing API fetching and 3D isometric viewer generation.
*   🟡 **Bulk Nameplates & Sliders** (`Calculator_Nameplate.html`) - Implementing SVG export capabilities and bulk roster text parsing.
*   🟡 **Post & Panel Structural Signs** (`Calculator_PostPanel.html`) - Finalizing structural engineering validations and collision detection.

### 2. FreshDesk Migration & Native Ticketing
*   **The Landing Pad:** Raw ingestion of 10,000+ XML/CSV legacy FreshDesk tickets to maintain historical data without downtime.
*   **The Relational Bridge:** Transforming flat-string requesters into permanent relational keys mapping to `crm_customers` and `master_staff`.
*   **MES Supercharger:** Automated task-splitting engine to break monolithic work orders into departmental child tasks (e.g., routing Weld Shop vs. Print Room vs. Paint Booth).

### 3. DevOps & Infrastructure "Missing Links"
*   **Automated Edge Function CI/CD:** Implementing GitHub Actions YAML workflows (`.github/workflows/deploy-functions.yml`) so that a push automatically deploys Edge Functions alongside the Vercel UI.
*   **Automated Unit Testing:** Building physics test suites to ensure logic changes (e.g., ADA stacking) don't silently break margin math.
*   **Staging-to-Prod Sync:** Creating scripts to clone the live `public.materials` inventory into the staging environment for Sandbox testing.

### 4. AI Agent Orchestration (The Cyber-Physical Workforce)
*   **VIR_AGENT_QA (Visual Auditor):** Replacing the manual photo-sorting model. This agent will sweep the Google Photos API using computer vision to auto-match shop floor photos to Job IDs based on sign geometry and OCR.
*   **VIR_AGENT_MACH (Physics Guard):** Physics engine validation for subtractive machine operations (CNC routers, etching pods) to ensure gantry safety and toolpath compliance.
*   **The Data Baton (Inter-Department Handshakes):** Expanding the UI to support `HANDSHAKE` logic gates, blocking Novice (Rank 1) users from releasing tasks to the next department without an Expert (Rank 3) digital signature.

### 5. Upcoming Product Logic Engines
*   **Channel Letter Core:** Developing logic for Coil, Trim Cap, and LED power supply calculations.
*   **Profit Heatmap Analytics Engine:** Enhancing the `admin_analytics.html` module to chart pricing "sweet spots" and dynamically visualize margin intersections for volume runs.
