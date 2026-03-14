\### 6430\_Repository\_Architecture.md - 20260313



\#### 1. System Metadata \& Objective

\*   \*\*Protocol ID:\*\* 6430\_Repository\_Architecture

\*   \*\*Status:\*\* Active Guardrail

\*   \*\*Objective:\*\* To define the strict directory structure of the SignOS v4.0 GitHub repository, ensuring the complete separation of "The Face" (UI), "The Brain" (Edge Functions), and "The Docs" (AI Context).



\#### 2. The Master Directory Map

All future developments must adhere to this folder structure:



```text

SignOS-v3-Supabase/ (Root)

│

├── .github/                            <-- THE CI/CD AUTOMATION

│   └── workflows/

│       └── deploy-functions.yml        <-- (Automated brain deployment)

│

├── docs/                               <-- THE KNOWLEDGE BASE (6000s)

│   ├── 6000\_COA-DOC.md                 

│   ├── 6070\_DevOps\_Ownership\_Guide.md

│   ├── 6075\_Secure\_Credential\_Vault.md

│   ├── 6410\_Development\_Protocol.md

│   ├── 6420\_Master\_Development\_Tracker.md

│   └── 6430\_Repository\_Architecture.md

│

├── supabase/                           <-- THE BRAIN \& MEMORY

│   ├── config.toml

│   ├── migrations/                     

│   └── functions/                      <-- Deno/TypeScript Edge Functions

│       ├── calculate-acm/

│       ├── calculate-ada/

│       └── calculate-coro/

│

├── tools/                              <-- LOCAL DEV TOOLS

│   └── generate-context.js             <-- Auto-sync script for NotebookLM

│

└── signos-modern/                      <-- THE FACE (Vercel Frontend)

&#x20;   ├── fonts/                          <-- TTF files for Canvas engine

&#x20;   ├── index.html                      <-- Secure Gateway

&#x20;   ├── menu.html                       <-- User Dashboard

&#x20;   ├── signos-core.js                  <-- Handshake routing

&#x20;   ├── Calculator\_\*.html               <-- All UI modules

&#x20;   └── cost\_\*.js                       <-- (Legacy physics, slated for Edge)

