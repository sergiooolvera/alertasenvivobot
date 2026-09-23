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

    rawMessages.push({ id: parseInt(id) || idx, date: fullDate, time: timeStr, text });
});

console.log(`Cargados ${rawMessages.length} mensajes.`);

// Clasificación
const singleAlerts = [];
const parlays = [];
const veredictos = [];

rawMessages.forEach(msg => {
    const t = msg.text;
    if (t.includes('VEREDICTO POST-PARTIDO') || t.includes('VEREDICTO:') || t.includes('APUESTA EVITADA') || t.includes('VEREDICTO DE PARLAY') || t.includes('VEREDICTO PARLAY')) {
        veredictos.push(msg);
    } else if (t.includes('PARLAY DEL DÍA DE LA IA') || t.includes('PARLAY DEL DIA DE LA IA') || t.includes('PARLAY EN VIVO') || t.includes('COMBINADA EN VIVO') || t.includes('🔥 PARLAY EN VIVO 🔥')) {
        parlays.push(msg);
    } else if (t.includes('REGLA') || t.includes('BÉISBOL') || t.includes('ANÁLISIS DE IA') || t.includes('GEMINI') || t.includes('DEEPSEEK')) {
        singleAlerts.push(msg);
    }
});

console.log(`Alertas individuales: ${singleAlerts.length}`);
console.log(`Parlays detectados: ${parlays.length}`);
console.log(`Veredictos detectados: ${veredictos.length}`);

// Guardar volcados preliminares
fs.writeFileSync(path.join(__dirname, 'dump_parlays.json'), JSON.stringify(parlays, null, 2));
fs.writeFileSync(path.join(__dirname, 'dump_veredictos.json'), JSON.stringify(veredictos, null, 2));

console.log("Dump completado en scratch/dump_parlays.json y scratch/dump_veredictos.json");
