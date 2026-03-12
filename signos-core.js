// SignOS Core System v3.0 (Supabase Edition)
const IS_DEV_ENV = window.location.href.includes('localhost') || window.location.href.includes('127.0.0.1');

// --- SUPABASE API ROUTING ---
const SUPABASE_URL = "https://agmxqdcnmfprnuktpmjq.supabase.co"; // <-- INSERT YOUR URL HERE
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnbXhxZGNubWZwcm51a3RwbWpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNzExMzcsImV4cCI6MjA4ODg0NzEzN30.AHxH92Jo1BQyjtYN5Un5ZWcol6eiNjY5APQhcWTTuik"; // <-- INSERT YOUR ANON KEY HERE

let clientIP = "Unknown";
const currentHost = window.location.hostname;

// 1. IP Telemetry (Preserved)
fetch('https://api.ipify.org?format=json')
    .then(r => r.json())
    .then(d => { clientIP = d.ip; })
    .catch(e => console.log("IP Silent"));

// 2. Session Security
if (!window.location.pathname.includes('index.html')) {
    const user = sessionStorage.getItem('signos_user');
    if (!user) window.location.href = 'index.html';
}

// 3. Global Logout (Updated for Supabase)
function logout() {
    sessionStorage.clear();
    window.location.href = 'index.html';
}

// 4. Global Navigation
function goBack() {
    const role = sessionStorage.getItem('signos_role');
    let mode = 'sales';
    if (role === 'PROD') mode = 'production';
    else if (role === 'ADMIN' || role === 'SUPER') mode = IS_DEV_ENV ? 'dev' : 'admin';
    window.location.href = `menu.html?mode=${mode}`;
}

// 5. UI INJECTION (The "ACM Style" Dual Header)
function injectHeader(title, showMenu = true) {
    const u = sessionStorage.getItem('signos_user') || 'GUEST';
    const r = sessionStorage.getItem('signos_role') || 'VIEW';
    
    // Target the main card to keep the "Island" look
    const container = document.getElementById('main-card') || document.querySelector('.max-w-md') || document.body;
    
    const html = `
    <!-- TOP UTILITY BAR -->
    <div class="bg-gray-800 px-4 py-1 flex justify-between items-center text-[10px] text-gray-400 border-b border-gray-700 shrink-0">
        <div class="flex gap-2">
            <span>USER: <b class="text-gray-200 uppercase">${u}</b></span>
            <span>ROLE: <b class="text-blue-400 uppercase">${r}</b></span>
        </div>
        <button onclick="logout()" class="hover:text-white font-bold uppercase transition flex items-center gap-1">
            Logout
        </button>
    </div>

    <!-- MAIN NAV BAR -->
    <div class="bg-gray-900 px-6 py-4 text-white flex justify-between items-center shrink-0">
        ${showMenu ? `
        <a href="#" onclick="goBack()" class="text-gray-400 hover:text-white text-xs font-bold uppercase flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg> MENU
        </a>` : '<div></div>'}
        
        <div class="text-center">
            <h2 class="text-lg font-bold">${title}</h2>
            <div class="flex items-center justify-center gap-2 text-[10px] mt-0.5">
                <span id="status-dot" class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                <span id="status-text" class="font-bold text-gray-400">CONNECTING...</span>
                <span id="version-display" class="text-gray-500 font-mono hidden"></span>
            </div>
        </div>
        
        <button onclick="location.reload()" class="text-gray-400 hover:text-white" title="Refresh Data">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
        </button>
    </div>`;
    
    container.insertAdjacentHTML('afterbegin', html);
}

// 6. Feedback Modal Logic
window.addEventListener('load', function() {
    const user = sessionStorage.getItem('signos_user');
    if (!user || window.location.pathname.includes('index.html')) return;
    injectFeedbackUI();
});

function injectFeedbackUI() {
    const btn = document.createElement('button');
    btn.innerHTML = '<span class="text-xl">📣</span>';
    btn.className = "fixed bottom-4 right-4 bg-white text-gray-800 p-3 rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 hover:scale-110 transition z-50 flex items-center justify-center w-12 h-12";
    btn.title = "Report Bug / Request Feature";
    btn.onclick = openFeedback;
    document.body.appendChild(btn);

    const modalHTML = `
    <div id="glb-feedback-modal" class="fixed inset-0 bg-black/80 z-50 hidden flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div class="bg-gray-900 text-white px-4 py-3 flex justify-between items-center">
                <h3 class="font-bold text-sm">Submit Feedback</h3>
                <button onclick="document.getElementById('glb-feedback-modal').classList.add('hidden')" class="text-gray-400 hover:text-white">✕</button>
            </div>
            <div class="p-6 space-y-4">
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Type</label>
                    <div class="flex gap-2">
                        <label class="flex-1 cursor-pointer"><input type="radio" name="fb-type" value="Bug" class="peer sr-only"><div class="text-center text-xs border rounded p-2 peer-checked:bg-red-600 peer-checked:text-white font-bold">Bug</div></label>
                        <label class="flex-1 cursor-pointer"><input type="radio" name="fb-type" value="Feature" class="peer sr-only" checked><div class="text-center text-xs border rounded p-2 peer-checked:bg-blue-600 peer-checked:text-white font-bold">Feature</div></label>
                        <label class="flex-1 cursor-pointer"><input type="radio" name="fb-type" value="Content" class="peer sr-only"><div class="text-center text-xs border rounded p-2 peer-checked:bg-purple-600 peer-checked:text-white font-bold">Content</div></label>
                    </div>
                </div>
                <div><label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Context</label><input type="text" id="fb-context" class="w-full border p-2 rounded text-xs bg-gray-100 text-gray-500" readonly></div>
                <div><label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Title</label><input type="text" id="fb-title" class="w-full border p-2 rounded text-sm font-bold" placeholder="Summary..."></div>
                <div><label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Details</label><textarea id="fb-desc" class="w-full border p-2 rounded text-sm h-24" placeholder="Details..."></textarea></div>
                <button onclick="submitFeedback()" id="btn-fb-send" class="w-full bg-gray-900 hover:bg-black text-white font-bold py-3 rounded text-xs tracking-widest transition">SUBMIT TICKET</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function openFeedback() {
    document.getElementById('fb-context').value = window.location.pathname.split('/').pop() || 'Home';
    document.getElementById('glb-feedback-modal').classList.remove('hidden');
}

async function submitFeedback() {
    const user = sessionStorage.getItem('signos_user');
    const type = document.querySelector('input[name="fb-type"]:checked').value;
    const ctx = document.getElementById('fb-context').value;
    const title = document.getElementById('fb-title').value;
    const desc = document.getElementById('fb-desc').value;
    const btn = document.getElementById('btn-fb-send');

    if(!title) { alert("Title required"); return; }
    btn.innerText = "SENDING..."; btn.disabled = true;

    try {
        await fetch(`${SCRIPT_URL}?req=add_roadmap&user=${user}&cat=${type}&title=${encodeURIComponent(title)}&desc=${encodeURIComponent(desc)}&prio=Med&target=APP&source=User&context=${ctx}`, {mode: 'no-cors'});
        alert("Ticket Submitted!");
        document.getElementById('glb-feedback-modal').classList.add('hidden');
        document.getElementById('fb-title').value = ""; document.getElementById('fb-desc').value = "";
    } catch(e) { alert("Error: " + e.message); } 
    finally { btn.innerText = "SUBMIT TICKET"; btn.disabled = false; }
}

// --- CENTRALIZED API LOADER (Supabase RPC) ---
window.SignOS = window.SignOS || {};

SignOS.fetchProductData = async function(productId, refTables = []) {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_product_bundle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
                p_product_id: productId,
                p_tables: refTables
            })
        });

        if (!response.ok) {
            throw new Error(`Database Error: ${response.statusText}`);
        }

        const json = await response.json();
        return json;
        
    } catch (error) {
        console.error("SignOS Backend Connection Failed:", error);
        return { error: error.message };
    }
};
