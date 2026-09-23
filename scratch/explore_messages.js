const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'messages.html');
const content = fs.readFileSync(filePath, 'utf8');

const messageBlocks = content.split(/<div class="message /);
console.log(`Total bloques de mensaje: ${messageBlocks.length}`);

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

console.log(`Total mensajes extraídos: ${rawMessages.length}`);
const datesFound = [...new Set(rawMessages.map(m => m.date))];
console.log(`Fechas encontradas (${datesFound.length}):`, datesFound);

const alerts = [];
const veredictos = [];

rawMessages.forEach(msg => {
    const text = msg.text;
    if (text.includes('VEREDICTO POST-PARTIDO') || text.includes('VEREDICTO:')) {
        veredictos.push(msg);
    } else if (text.includes('REGLA') || text.includes('ANÁLISIS DE IA') || text.includes('GEMINI') || text.includes('DEEPSEEK') || text.includes('BÉISBOL')) {
        alerts.push(msg);
    }
});

console.log(`Total Alertas detectadas: ${alerts.length}`);
console.log(`Total Veredictos detectados: ${veredictos.length}`);

// Analizar reglas en las alertas
const ruleCounts = {};
alerts.forEach(a => {
    const m = a.text.match(/(REGLA\s*\d+[^━\n]+)/i) || a.text.match(/(BÉISBOL[^━\n]+)/i);
    const r = m ? m[1].trim() : 'OTRA / NO IDENTIFICADA';
    ruleCounts[r] = (ruleCounts[r] || 0) + 1;
});
console.log('\n--- CONTEO DE REGLAS (RAW) ---');
console.table(ruleCounts);

// Mostrar primeros 3 veredictos y últimas 3 alertas
console.log('\n--- MUESTRA DE 2 ALERTAS ---');
alerts.slice(0, 2).forEach((a, i) => console.log(`[Alerta ${i+1}] (${a.date} ${a.time}):\n${a.text.substring(0, 250)}...\n`));

console.log('\n--- MUESTRA DE 2 VEREDICTOS ---');
veredictos.slice(0, 2).forEach((v, i) => console.log(`[Veredicto ${i+1}] (${v.date} ${v.time}):\n${v.text}\n`));
