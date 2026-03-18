// SignOS Core System v4.0 (Supabase Edition)

const IS_DEV_ENV = window.location.href.includes('localhost') || window.location.href.includes('127.0.0.1');

// --- TRUE HYBRID ROUTING ---
const SUPABASE_URL = "https://agmxqdcnmfprnuktpmjq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnbXhxZGNubWZwcm51a3RwbWpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNzExMzcsImV4cCI6MjA4ODg0NzEzN30.AHxH92Jo1BQyjtYN5Un5ZWcol6eiNjY5APQhcWTTuik";
const EDGE_URL = IS_DEV_ENV ? "http://127.0.0.1:54321" : SUPABASE_URL;
const EDGE_KEY = SUPABASE_ANON_KEY; 

// 2. Session Security
if (!window.location.pathname.includes('index.html')) {
    const user = sessionStorage.getItem('signos_user');
    if (!user) window.location.href = 'index.html';
}

// 3. Global Logout 
function logout() {
    sessionStorage.clear();
    window.location.href = 'index.html';
}

// 4. Global Navigation
function goBack() {
    window.location.href = 'menu.html';
}

// 5. Global Header Injector (With Profile Avatars)
function injectHeader(title, showMenu = true) {
    const uFirst = sessionStorage.getItem('signos_user') || 'GUEST';
    const uLast = sessionStorage.getItem('signos_user_last') || '';
    const r = sessionStorage.getItem('signos_role') || 'SALES';
    const dept = (sessionStorage.getItem('signos_dept') || 'UNASSIGNED').replace('DEPT_', '');

    // Construct Avatar Initials and Full Name
    const initials = (uFirst.charAt(0) + (uLast ? uLast.charAt(0) : '')).toUpperCase();
    const fullName = `${uFirst} ${uLast}`.trim().toUpperCase();

    // Map Role to specific System Color
    let roleBg = "bg-gray-600";
    let roleText = "text-gray-400";
    if (r === 'SUPER') { roleBg = "bg-purple-600"; roleText = "text-purple-400"; }
    else if (r === 'ADMIN') { roleBg = "bg-red-600"; roleText = "text-red-400"; }
    else if (r === 'SALES') { roleBg = "bg-blue-600"; roleText = "text-blue-400"; }
    else if (r === 'PROD') { roleBg = "bg-green-600"; roleText = "text-green-400"; }

    const container = document.body;

    const html = `
    <!-- TOP UTILITY BAR (NEW AVATAR SYSTEM) -->
    <div class="bg-gray-800 px-4 py-2 flex justify-between items-center text-[10px] text-gray-400 border-b border-gray-700 shrink-0 shadow-sm z-50">
        <div class="flex items-center gap-3">
            <a href="user_profile.html" class="w-8 h-8 rounded-full ${roleBg} text-white flex items-center justify-center font-black shadow-inner border-2 border-gray-700 hover:scale-105 transition hover:border-white" title="Edit Profile">
                ${initials}
            </a>
            <div class="flex flex-col leading-none justify-center">
                <a href="user_profile.html" class="text-gray-200 font-bold uppercase hover:text-white hover:underline transition mb-1">${fullName}</a>
                <div class="flex items-center gap-1.5">
                    <span class="text-[8px] font-black uppercase tracking-widest ${roleText}">${r}</span>
                    <span class="text-gray-600 font-black">|</span>
                    <span class="text-[8px] font-bold text-gray-400 uppercase tracking-widest">${dept}</span>
                    ${r === 'SUPER' ? '<span class="ml-1 text-[8px] font-black bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded border border-purple-800 leading-none">OVERWATCH</span>' : ''}
                </div>
            </div>
        </div>
        <button onclick="logout()" class="hover:text-white font-bold uppercase tracking-widest transition flex items-center gap-1">
            Logout
        </button>
    </div>

    <!-- MAIN NAV BAR -->
    <div class="bg-gray-900 px-6 py-4 text-white flex justify-between items-center shrink-0 z-40 shadow-md">
        ${showMenu ? `
        <a href="#" onclick="goBack()" class="text-gray-400 hover:text-white text-xs font-bold uppercase flex items-center gap-1 transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg> MENU
        </a>` : '<div></div>'}
        <div class="text-center">
            <h2 class="text-lg font-bold">${title}</h2>
            <div class="flex items-center justify-center gap-2 text-[10px] mt-0.5">
                <span id="status-dot" class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                <span id="status-text" class="font-bold text-gray-400">CONNECTING...</span>
                <span id="version-display" class="text-gray-500 font-mono hidden"></span>
            </div>
        </div>
        <button onclick="location.reload()" class="text-gray-400 hover:text-white transition" title="Refresh Data">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
        </button>
    </div>`;

    container.insertAdjacentHTML('afterbegin', html);

    // Auto-inject the global footer on every page
    injectFooter();
}

// 6. UNIVERSAL FOOTER INJECTOR
function injectFooter() {
    if (document.getElementById('signos-universal-footer')) return;

    const footerHtml = `
    <div id="signos-universal-footer" class="mt-auto bg-gray-900 border-t border-gray-800 px-6 py-4 flex justify-between items-center shrink-0 w-full z-40">
        <a href="menu.html" class="text-[10px] font-bold text-gray-400 hover:text-white uppercase tracking-widest transition flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            System Menu
        </a>
        <div class="flex items-center gap-4">
            <span class="text-[9px] text-gray-600 font-mono font-bold tracking-widest uppercase">SignOS v4.0</span>
            <button onclick="if(typeof openFeedback === 'function') openFeedback(); else alert('Feedback module not loaded.');" class="text-[10px] font-bold text-red-400 hover:text-red-300 uppercase tracking-widest transition border border-red-900/50 bg-red-950/20 px-3 py-1.5 rounded flex items-center gap-1.5">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                Report Issue
            </button>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', footerHtml);
}

// 7. Feedback Modal Logic
window.addEventListener('load', function() {
    const user = sessionStorage.getItem('signos_user');
    if (!user || window.location.pathname.includes('index.html')) return;
    injectFeedbackUI();
});

function injectFeedbackUI() {
    // Injects the hidden modal (but no floating button, as the footer triggers it)
    const modalHtml = `
    <div id="glb-feedback-modal" class="hidden fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            <div class="p-4 bg-gray-900 flex justify-between items-center text-white">
                <h3 class="font-black uppercase tracking-widest text-xs flex items-center gap-2"><span class="text-xl">📣</span> Report an Issue</h3>
                <button onclick="closeFeedback()" class="text-gray-400 hover:text-white transition">✕</button>
            </div>
            <div class="p-6 space-y-4">
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 uppercase mb-2">Issue Type</label>
                    <div class="flex gap-2">
                        <label class="flex-1 cursor-pointer"><input type="radio" name="fb-type" value="Bug" class="peer sr-only"><div class="text-center text-xs border rounded p-2 peer-checked:bg-red-600 peer-checked:text-white font-bold">Bug</div></label>
                        <label class="flex-1 cursor-pointer"><input type="radio" name="fb-type" value="Feature" class="peer sr-only" checked><div class="text-center text-xs border rounded p-2 peer-checked:bg-blue-600 peer-checked:text-white font-bold">Feature</div></label>
                        <label class="flex-1 cursor-pointer"><input type="radio" name="fb-type" value="Content" class="peer sr-only"><div class="text-center text-xs border rounded p-2 peer-checked:bg-purple-600 peer-checked:text-white font-bold">Content</div></label>
                    </div>
                </div>
                <div><label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Context</label><input type="text" id="fb-context" class="w-full border p-2 rounded text-xs bg-gray-100 text-gray-500" readonly></div>
                <div><label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Title</label><input type="text" id="fb-title" class="w-full border p-2 rounded text-sm font-bold" placeholder="Summary..."></div>
                <div><label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Description</label><textarea id="fb-desc" class="w-full border p-2 rounded text-sm h-24" placeholder="What happened or what do you need?"></textarea></div>
                <button onclick="submitFeedback()" id="btn-submit-fb" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded text-xs uppercase tracking-widest transition">SUBMIT TICKET</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function openFeedback() {
    document.getElementById('fb-context').value = window.location.pathname.split('/').pop() || 'Home';
    document.getElementById('glb-feedback-modal').classList.remove('hidden');
}

function closeFeedback() {
    document.getElementById('glb-feedback-modal').classList.add('hidden');
}

async function submitFeedback() {
    const user = sessionStorage.getItem('signos_user');
    const type = document.querySelector('input[name="fb-type"]:checked').value;
    const ctx = document.getElementById('fb-context').value;
    const title = document.getElementById('fb-title').value;
    const desc = document.getElementById('fb-desc').value;
    const btn = document.getElementById('btn-submit-fb');

    if (!title || !desc) return alert("Please fill out the title and description.");

    btn.innerText = "SUBMITTING...";
    btn.disabled = true;

    try {
        await fetch(`${SUPABASE_URL}/rest/v1/access_logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
            body: JSON.stringify({
                user_id: user,
                role: sessionStorage.getItem('signos_role') || 'UNKNOWN',
                action: `FEEDBACK_${type.toUpperCase()}`,
                target: ctx,
                meta_data: { title: title, description: desc }
            })
        });

        alert("Feedback submitted successfully. Thank you!");
        closeFeedback();
        document.getElementById('fb-title').value = ""; document.getElementById('fb-desc').value = "";
    } catch(e) { alert("Error: " + e.message); }
    finally { btn.innerText = "SUBMIT TICKET"; btn.disabled = false; }
}

// --- CENTRALIZED API LOADER (Supabase RPC) ---
window.SignOS = window.SignOS || {};

SignOS.fetchProductData = async function(productId, refTables = []) {
    try {
        // 1. Fetch ALL Global Variables (Master Data Engine)
        const gvRes = await fetch(`${SUPABASE_URL}/rest/v1/global_variables?select=id,default_value,override_value`, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        });
        if (!gvRes.ok) throw new Error("Failed to fetch global variables");
        const gvData = await gvRes.json();

        let gvMap = {};
        gvData.forEach(row => {
            gvMap[row.id] = (row.override_value !== null && row.override_value !== undefined) ? row.override_value : row.default_value;
        });

        // 2. Fetch the specific product configuration
        const prodRes = await fetch(`${SUPABASE_URL}/rest/v1/product_configurations?id=eq.${productId}&select=matrix_overrides,ui_schema`, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        });
        if (!prodRes.ok) throw new Error("Failed to fetch product configuration");
        const prodData = await prodRes.json();

        // 3. Combine Global Data with Product Overrides
        let config = { ...gvMap };

        if (prodData && prodData.length > 0) {
            const productRow = prodData;
            const matrixOverrides = productRow.matrix_overrides || {};

            for (let key in matrixOverrides) {
                if (matrixOverrides[key] === true) continue;
                if (matrixOverrides[key] === false) {
                    delete config[key];
                    continue;
                }
                config[key] = matrixOverrides[key];
            }
            config.ui_schema = productRow.ui_schema || null;
        }

        // 4. Fetch optional reference tables
        let tables = {};
        for (const table of refTables) {
            const tableRes = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1000`, {
                headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
            });
            if (tableRes.ok) {
                tables[table] = await tableRes.json();
            }
        }

        return { config: config, tables: tables };
    } catch (e) {
        console.error("fetchProductData Error:", e);
        return { error: e.message };
    }
};