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

function normalizarTexto(str) {
    if (!str) return '';
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

// Extraer Alertas Individuales, Parlays y Veredictos
const alerts = [];
const parlays = [];
const veredictos = [];

rawMessages.forEach(msg => {
    const text = msg.text;
    if (text.includes('VEREDICTO') || text.includes('APUESTA EVITADA')) {
        veredictos.push(msg);
    } else if (text.includes('PARLAY') || text.includes('COMBINADA')) {
        parlays.push(msg);
    } else if (text.includes('REGLA') || text.includes('BÉISBOL') || text.includes('GEMINI') || text.includes('DEEPSEEK') || text.includes('ANÁLISIS DE IA')) {
        alerts.push(msg);
    }
});

console.log(`Mensajes totales: ${rawMessages.length}`);
console.log(`Alertas simples: ${alerts.length}`);
console.log(`Parlays: ${parlays.length}`);
console.log(`Veredictos: ${veredictos.length}`);

// Analizar Parlays
const processedParlays = parlays.map(p => {
    const text = p.text;
    const isDia = text.includes('PARLAY DEL DÍA') || text.includes('PARLAY DEL DIA');
    const isVivo = text.includes('PARLAY EN VIVO') || text.includes('COMBINADA EN VIVO');
    
    // Momio
    const momioMatch = text.match(/MOMIO TOTAL ESTIMADO:\s*@?([\d\.]+)/i) || text.match(/MOMIO ESTIMADO:\s*@?([\d\.]+)/i) || text.match(/MOMIO COMBINADO:\s*@?([\d\.]+)/i);
    const momio = momioMatch ? parseFloat(momioMatch[1]) : null;

    // Confianza
    const confMatch = text.match(/CONFIANZA COMBINADA:\s*(\d+)%/i) || text.match(/CONFIANZA:\s*(\d+)%/i);
    const confianza = confMatch ? parseInt(confMatch[1]) : null;

    // Selecciones / Selecciones del Parlay
    const selecciones = [];
    const lines = text.split('\n');
    lines.forEach(line => {
        if (line.match(/^\d+\./) || line.includes('Pronóstico:') || line.includes('SELECCIÓN') || line.includes('Selección')) {
            selecciones.push(line.trim());
        }
    });

    return {
        id: p.id,
        date: p.date,
        time: p.time,
        type: isDia ? 'PARLAY_DEL_DIA' : (isVivo ? 'PARLAY_EN_VIVO' : 'PARLAY'),
        momio,
        confianza,
        text,
        selecciones
    };
});

// Analizar Veredictos
const processedVeredictos = veredictos.map(v => {
    const text = v.text;
    const isGreen = text.includes('GREEN') || text.includes('🟢') || text.includes('GANADA') || text.includes('ACERTADA');
    const isRed = text.includes('RED') || text.includes('🔴') || text.includes('PERDIDA') || text.includes('FALLADA');
    const isEvitada = text.includes('APUESTA EVITADA') || text.includes('⚪') || text.includes('OMITIDA');
    const isParlayVerdict = text.includes('PARLAY') || text.includes('COMBINADA');

    return {
        id: v.id,
        date: v.date,
        time: v.time,
        outcome: isGreen ? 'GREEN' : (isRed ? 'RED' : (isEvitada ? 'EVITADA' : 'OTRO')),
        isParlayVerdict,
        text
    };
});

fs.writeFileSync(path.join(__dirname, 'parsed_summary.json'), JSON.stringify({
    alertsCount: alerts.length,
    parlaysCount: parlays.length,
    veredictosCount: veredictos.length,
    parlays: processedParlays,
    veredictos: processedVeredictos
}, null, 2));

console.log("Resumen guardado en scratch/parsed_summary.json");
