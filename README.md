# SignOS v4.0 - Headless Sign Shop ERP

SignOS v4.0 is a modern, "Headless" Enterprise Resource Planning (ERP) system purpose-built for the sign industry [1]. It transitions away from legacy Google Apps Script/Sheets backends to a robust PostgreSQL/Supabase environment, utilizing a physics-first mathematical engine for highly accurate quoting and production management [1].

## System Architecture

SignOS separates the platform into three core layers [1]:
*   **The Face (Frontend):** Pure HTML and Tailwind CSS modules. The browser handles UI state, 3D/SVG rendering, and input harvesting [1].
*   **The Brain (Middleware):** Supabase Edge Functions and PostgreSQL RPCs handle all mathematical heavy lifting.
*   **The Memory (Database):** A PostgreSQL schema storing reference materials, labor rates, retail curves, and global variables [2].

### Governing Principles
1.  **Physics-First Math:** Internal costs are calculated based on raw physical yields (e.g., 4'x8' sheet bounding box math, linear foot roll feeds, and waste factors) rather than simple square footage [3, 4].
2.  **Market-Curve Pricing:** Retail pricing utilizes threshold-based "Retail Curves" rather than cost-plus-markup to remain highly competitive [3].
3.  **Twin-Engine Environment:** Safe deployment using isolated `dev` and `public` (live) schemas for parallel testing [5, 6].

## File Structure (Chart of Accounts)

SignOS uses a numerical prefix system to ensure AI agents (like NotebookLM or Cursor) perfectly understand the role of each file within the architecture [7]:

*   **1000–1999 [CORE]:** System Foundations. Core JavaScript handling authentication, routing, Canvas SVG rendering, and Supabase handshakes (e.g., `1020_CORE_System_JS.js`) [7].
*   **2000–2999 [CALC]:** Frontend Interfaces. Staff-facing calculator modules for specific product lines (e.g., `2010_CALC_YardSign.html`, `2020_CALC_ADA.html`) [8].
*   **3000–3999 [PHYS]:** Physics Engines. Standalone logic processing material yields and labor calculations [8].
*   **4000–4999 [ADMIN]:** Management Modules. Internal shop tools for owners, including margin heatmaps, ticket logs, and roadmaps [9].
*   **5000–5999 [SQL]:** Database Definitions. Schema dumps and migration logs [9].
*   **6000–6999 [GUIDE]:** Business Intelligence. Knowledge base files, external catalogs, and development standards [9, 10].

## Tech Stack
*   **Frontend:** HTML5, Tailwind CSS, Vanilla JS
*   **Backend / DB:** Supabase (PostgreSQL, RPCs, Edge Functions)
*   **Typography / Rendering:** Opentype.js, CorelDraw SVG pipeline [7, 11]
