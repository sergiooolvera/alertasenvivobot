const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'messages.html');
const content = fs.readFileSync(filePath, 'utf8');
const messageBlocks = content.split(/<div class="message /);

let currentDate = 'Desconocida';
const rawMessages = [];

messageBlocks.forEach((block, idx) => {
    if (idx === 0) return;
    if (block.startsWith('service')) {
        const dateMatch = block.match(/<div class="body details">\s*([^<]+)\s*<\/div>/);
        if (dateMatch) currentDate = dateMatch[1].trim();
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
    let text = textMatch[1].trim()
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?[^>]+(>|$)/g, '')
        .replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    rawMessages.push({ id, date: fullDate, time: timeStr, text });
});

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

// Ver alertas no identificadas
alerts.forEach(a => {
    const m = a.text.match(/(REGLA\s*\d+[^━\n]+)/i) || a.text.match(/(BÉISBOL[^━\n]+)/i);
    if (!m) {
        console.log(`[ALERTA SIN REGLA DETECTADA ID ${a.id} ${a.date}]:\n${a.text.substring(0, 150)}\n---`);
    }
});
