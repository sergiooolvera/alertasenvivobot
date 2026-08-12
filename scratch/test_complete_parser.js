const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'messages.html');
const content = fs.readFileSync(filePath, 'utf8');

// Parse HTML blocks
const messageBlocks = content.split(/<div class="message /);

let currentDate = 'Desconocida';
const rawMessages = [];

messageBlocks.forEach((block, idx) => {
    if (idx === 0) return;
    
    if (block.startsWith('service')) {
        const dateMatch = block.match(/<div class="body details">\s*([^<]+)\s*<\/div>/);
        if (dateMatch) {
            currentDate = dateMatch[1].trim();
        }
        return;
    }

    const idMatch = block.match(/id="message(\d+)"/);
    const id = idMatch ? idMatch[1] : `block_${idx}`;

    const titleDateMatch = block.match(/title="(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2}:\d{2})/);
    let fullDate = currentDate;
    let timeStr = '';
    if (titleDateMatch) {
        fullDate = titleDateMatch[1]; // DD.MM.YYYY
        timeStr = titleDateMatch[2];
    }

    const textMatch = block.match(/<div class="text">([\s\S]*?)<\/div>/);
    if (!textMatch) return;

    let text = textMatch[1].trim();
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/?[^>]+(>|$)/g, '');
    text = text.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

    rawMessages.push({ id, date: fullDate, time: timeStr, text });
});

console.log(`Parsed ${rawMessages.length} total messages.`);

const alerts = [];
const veredictos = [];
const parlays = [];
const otros = [];

rawMessages.forEach(msg => {
    const text = msg.text;
    if (text.includes('VEREDICTO POST-PARTIDO') || text.includes('VEREDICTO:')) {
        veredictos.push(msg);
    } else if (text.match(/REGLA\s*\d+/i) || text.includes('ANÁLISIS DE IA') || text.includes('ALERTAS DE BÉISBOL') || text.includes('REGLA ')) {
        alerts.push(msg);
    } else if (text.includes('PARLAY') || text.includes('COMBINADA')) {
        parlays.push(msg);
    } else {
        otros.push(msg);
    }
});

console.log(`Alertas: ${alerts.length}`);
console.log(`Veredictos: ${veredictos.length}`);
console.log(`Parlays: ${parlays.length}`);
console.log(`Otros: ${otros.length}`);

// Sample veredicto texts
console.log('\n--- VEREDICTO EXAMPLES ---');
veredictos.slice(0, 5).forEach((v, idx) => {
    console.log(`[Veredicto ${idx+1} - Date: ${v.date}]`);
    console.log(v.text);
    console.log('-------------------');
});

// Sample alert texts
console.log('\n--- ALERT EXAMPLES ---');
alerts.slice(0, 5).forEach((a, idx) => {
    console.log(`[Alert ${idx+1} - Date: ${a.date}]`);
    console.log(a.text.substring(0, 300) + '...');
    console.log('-------------------');
});
