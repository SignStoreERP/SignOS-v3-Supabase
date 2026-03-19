const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = ['.git', 'node_modules', '.supabase', '.temp'];
const OUTPUT_FILE = 'SignOS_Context_Dump.txt';

function buildTree(dir, prefix = '') {
    let output = '';
    const files = fs.readdirSync(dir).sort();
    
    files.forEach((file, index) => {
        if (IGNORE_DIRS.includes(file)) return;
        
        const fullPath = path.join(dir, file);
        const isLast = index === files.length - 1;
        const pointer = isLast ? '└── ' : '├── ';
        
        // Standard concatenation (No backticks or $ symbols)
        output += prefix + pointer + file + '\n';
        
        if (fs.statSync(fullPath).isDirectory()) {
            output += buildTree(fullPath, prefix + (isLast ? '    ' : '│   '));
        }
    });
    return output;
}

console.log("Generating SignOS Context Dump...");
const tree = buildTree(path.join(__dirname, '../'));

const finalOutput = "SIGNOS REPOSITORY STATE\nGenerated: " + new Date().toISOString() + "\n\n" + tree;

fs.writeFileSync(path.join(__dirname, '../', OUTPUT_FILE), finalOutput);
console.log("✅ Success! Upload '" + OUTPUT_FILE + "' to NotebookLM.");