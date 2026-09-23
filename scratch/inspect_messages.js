const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'messages.html');
if (!fs.existsSync(filePath)) {
    console.error("No se encontró el archivo messages.html");
    process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');

// Parse HTML blocks
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
    const id = idMatch ? idMatch[1] : `block_${idx}`;

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

console.log(`Total de mensajes parseados: ${rawMessages.length}`);

// Categorizar mensajes
const alerts = [];
const parlays = [];
const veredictos = [];
const otros = [];

rawMessages.forEach(msg => {
    const text = msg.text;
    if (text.includes('PARLAY') || text.includes('COMBINADA') || text.includes('PARLAY EN VIVO') || text.includes('PARLAY DEL DÍA') || text.includes('PARLAY DEL DIA')) {
        parlays.push(msg);
    } else if (text.includes('VEREDICTO') || text.includes('GREEN') || text.includes('RED') || text.includes('APUESTA EVITADA')) {
        veredictos.push(msg);
    } else if (text.includes('REGLA') || text.includes('ANÁLISIS DE IA') || text.includes('GEMINI') || text.includes('DEEPSEEK') || text.includes('BÉISBOL')) {
        alerts.push(msg);
    } else {
        otros.push(msg);
    }
});

console.log(`Alertas simples: ${alerts.length}`);
console.log(`Parlays: ${parlays.length}`);
console.log(`Veredictos: ${veredictos.length}`);
console.log(`Otros: ${otros.length}`);

// Imprimir todos los parlays para inspección
console.log("\n=================== TODOS LOS PARLAYS ===================");
parlays.forEach(p => console.log(`[${p.date} ${p.time}] ID: ${p.id}\n${p.text}\n----------------------------------`));
