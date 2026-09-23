const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'messages.html');
const content = fs.readFileSync(filePath, 'utf8');

const messageBlocks = content.split(/<div class="message /);

let currentDate = '';
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
    const id = idMatch ? parseInt(idMatch[1]) : idx;

    const titleDateMatch = block.match(/title="(\d{2}\.\d{2}\.\d{4}|\d{2}\.\d{4}\.\d{4})\s+(\d{2}:\d{2}:\d{2})/);
    let fullDate = currentDate;
    let timeStr = '';
    if (titleDateMatch) {
        fullDate = titleDateMatch[1];
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

const datesMap = {};
rawMessages.forEach(m => {
    if (!datesMap[m.date]) datesMap[m.date] = { alerts: 0, parlays: 0, veredictos: 0 };
    if (m.text.includes('PARLAY') || m.text.includes('COMBINADA')) {
        datesMap[m.date].parlays++;
    } else if (m.text.includes('VEREDICTO') || m.text.includes('APUESTA EVITADA')) {
        datesMap[m.date].veredictos++;
    } else if (m.text.includes('REGLA') || m.text.includes('BÉISBOL') || m.text.includes('GEMINI') || m.text.includes('DEEPSEEK') || m.text.includes('ANÁLISIS DE IA')) {
        datesMap[m.date].alerts++;
    }
});

console.log("=== INVENTARIO POR FECHA EN MESSAGES.HTML ===");
console.table(datesMap);
