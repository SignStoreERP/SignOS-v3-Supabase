const { execSync } = require('child_process');

// --- CONFIGURATION ---
const SUPABASE_URL = "https://agmxqdcnmfprnuktpmjq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnbXhxZGNubWZwcm51a3RwbWpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI3MTEzNywiZXhwIjoyMDg4ODQ3MTM3fQ.cRGAlMqDXzSB6ekStaG8przTGCvNFanFMB43E8tl8Qs"; 

async function backfillCommits() {
    console.log("Fetching local Git history for the last 7 days...");

    try {
        // 1. Grab git log: Hash | ISO Date | Author | Message
        const gitOutput = execSync('git log --since="7 days ago" --pretty=format:"%H|%cI|%an|%s"').toString();
        
        if (!gitOutput) {
            console.log("No commits found in the last 7 days.");
            return;
        }

        const commits = gitOutput.split('\n');
        console.log(`Found ${commits.length} commits. Beginning upload to Supabase...`);

        // 2. Loop through and POST each commit
        for (const line of commits) {
            const [hash, date, author, ...msgParts] = line.split('|');
            const message = msgParts.join('|').replace(/"/g, '\\"'); // Clean quotes for JSON

            const payload = {
                author: author,
                commit_hash: hash,
                message: message,
                files_changed: "1", // Simplified for backfill
                github_link: `https://github.com/SignStoreERP/signos-app/commit/${hash}`,
                environment: "DEV",
                timestamp: date
            };

            const response = await fetch(`${SUPABASE_URL}/rest/v1/sys_changelog`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                console.error(`Failed to log commit ${hash.substring(0,7)}:`, await response.text());
            } else {
                console.log(`✅ Logged: ${hash.substring(0,7)} - ${message.substring(0, 50)}...`);
            }
        }
        
        console.log("🎉 Backfill complete! Check admin_changelog.html");

    } catch (error) {
        console.error("Error executing Git command or fetching:", error.message);
    }
}

backfillCommits();