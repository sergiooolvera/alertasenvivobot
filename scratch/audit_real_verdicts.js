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

function cleanMarkdownLinks(str) {
    if (!str) return '';
    return str.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1').replace(/[\[\]]/g, '').trim();
}

function normalizarRegla(regla) {
    let normal = regla.replace(/^(?:🔥|⏳|🟥|🟨|🟢|⚾|🚨|🏆|♟️|🎯|👑|⚡|🚀|🚩)\s*/i, '');
    normal = normal.replace(/^REGLA\s*\d+\s*:\s*/i, '');
    normal = normal.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    
    if (normal.includes('sorpresa')) return 'Regla 3: Sorpresa Tempranera';
    if (normal.includes('roja') || normal.includes('expulsion') || normal.includes('estrategica')) return 'Regla 2: Roja Estratégica';
    if (normal.includes('sufre') || normal.includes('favorito sufre')) return 'Regla 4: Sufre Favorito';
    if (normal.includes('caliente') || normal.includes('tarjeta')) return 'Regla 5: Partido Caliente';
    if (normal.includes('remontada') || normal.includes('comeback')) return 'Regla 6: Remontada Improbable';
    if (normal.includes('asedio') || normal.includes('gol') || normal.includes('inminente')) return 'Regla 1: Asedio Favorito';
    if (normal.includes('domina') || normal.includes('ht') || normal.includes('favorito domina')) return 'Regla 8: Favorito Domina HT';
    if (normal.includes('beisbol') || normal.includes('mlb') || normal.includes('carrera')) return 'Regla 7: Béisbol Live';
    if (normal.includes('corner')) return 'Regla 6: Presión Córneres';
    
    return regla.trim() || 'Reglas Generales';
}

function normalizarPartido(partido) {
    let clean = cleanMarkdownLinks(partido);
    clean = clean.replace(/flashscore/gi, '').replace(/%20/g, ' ');
    clean = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    clean = clean.replace(/[^a-zA-Z0-9\s]/g, ' ');
    return clean.toLowerCase().replace(/\s+vs\s+/g, 'vs').replace(/[^a-z0-9]/g, '');
}

const singleAlertsRaw = [];
const veredictosRaw = [];

rawMessages.forEach(msg => {
    const text = msg.text;
    if (text.includes('VEREDICTO') || text.includes('APUESTA EVITADA')) {
        veredictosRaw.push(msg);
    } else if (!text.includes('PARLAY') && !text.includes('COMBINADA') && (text.includes('REGLA') || text.includes('BÉISBOL') || text.includes('ANÁLISIS DE IA') || text.includes('GEMINI') || text.includes('DEEPSEEK'))) {
        singleAlertsRaw.push(msg);
    }
});

// Revisar todas las alertas y ver cuáles tienen veredicto REAL en mensajes.html
const alertsWithExplicitVerdicts = [];
const alertsWithoutVerdicts = [];

singleAlertsRaw.forEach(a => {
    const text = a.text;
    let partido = 'Desconocido';
    lines = text.split('\n');
    lines.forEach(l => {
        if (l.includes('⚽') || l.includes('⚾')) {
            partido = l.replace(/[⚽⚾]\s*/g, '').trim();
        }
    });
    const cleanP = cleanMarkdownLinks(partido);
    const pNorm = normalizarPartido(cleanP);

    // Buscar veredicto coincidente en veredictosRaw
    const matchV = veredictosRaw.find(v => {
        if (v.text.includes('PARLAY') || v.text.includes('COMBINADA')) return false;
        const vCleanP = cleanMarkdownLinks(v.text);
        const vPNorm = normalizarPartido(vCleanP);
        return vPNorm.includes(pNorm) || pNorm.includes(vPNorm);
    });

    if (matchV) {
        let outcome = 'DESCONOCIDO';
        if (matchV.text.includes('GREEN')) outcome = 'GREEN';
        else if (matchV.text.includes('RED')) outcome = 'RED';
        else if (matchV.text.includes('APUESTA EVITADA')) outcome = 'APUESTA EVITADA';

        let resDetalle = '';
        const resMatch = matchV.text.match(/Resultado:\s*([^\n]+)/i);
        if (resMatch) resDetalle = resMatch[1].trim();

        alertsWithExplicitVerdicts.push({
            id: a.id,
            date: a.date,
            time: a.time,
            partido: cleanP,
            outcome,
            detalle: resDetalle,
            veredictoMsgId: matchV.id
        });
    } else {
        // Extraer recomendación de IA
        const geminiIdx = text.indexOf('GEMINI');
        const deepseekIdx = text.indexOf('DEEPSEEK');
        let geminiText = geminiIdx !== -1 ? (deepseekIdx > geminiIdx ? text.substring(geminiIdx, deepseekIdx) : text.substring(geminiIdx)) : '';
        let deepseekText = deepseekIdx !== -1 ? text.substring(deepseekIdx) : '';
        
        let bet = 'N/A';
        if (deepseekText) {
            const b = deepseekText.match(/Apuesta:\s*([^\n\(]+)/i) || deepseekText.match(/Sugerencia:\s*([^\n\(]+)/i);
            if (b) bet = b[1].trim();
        } else if (geminiText) {
            const b = geminiText.match(/Apuesta:\s*([^\n\(]+)/i) || geminiText.match(/Sugerencia:\s*([^\n\(]+)/i);
            if (b) bet = b[1].trim();
        }

        alertsWithoutVerdicts.push({
            id: a.id,
            date: a.date,
            time: a.time,
            partido: cleanP,
            partidoNorm: pNorm,
            bet,
            rawText: text
        });
    }
});

console.log(`Alertas totales: ${singleAlertsRaw.length}`);
console.log(`Alertas con veredicto EXPLÍCITO en Telegram: ${alertsWithExplicitVerdicts.length}`);
console.log(`Alertas SIN veredicto en Telegram (requieren evaluación real): ${alertsWithoutVerdicts.length}`);

console.log("\n=== LISTA DE ALERTAS SIN VEREDICTO EN CHAT PARA AUDITAR ===");
alertsWithoutVerdicts.forEach((a, idx) => {
    console.log(`${idx + 1}. [${a.date} ${a.time}] ID: ${a.id} | ${a.partido} | Apuesta: "${a.bet}"`);
});

fs.writeFileSync(path.join(__dirname, 'alerts_without_verdicts.json'), JSON.stringify(alertsWithoutVerdicts, null, 2));
