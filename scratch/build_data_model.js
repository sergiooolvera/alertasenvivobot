const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'messages.html');
const content = fs.readFileSync(filePath, 'utf8');

const messageBlocks = content.split(/<div class="message /);

let currentDate = '04.08.2026';
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

function normalizarRegla(regla) {
    let normal = regla.replace(/^(?:🔥|⏳|🟥|🟨|🟢|⚾|🚨|🏆)\s*/i, '');
    normal = normal.replace(/^REGLA\s*\d+\s*:\s*/i, '');
    normal = normal.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    
    if (normal.includes('sorpresa')) return 'Regla 3: Sorpresa Tempranera';
    if (normal.includes('roja') || normal.includes('expulsion') || normal.includes('estrategica')) return 'Regla 2: Roja Estratégica';
    if (normal.includes('sufre') || normal.includes('favorito sufre')) return 'Regla 4: Sufre Favorito';
    if (normal.includes('caliente') || normal.includes('tarjeta')) return 'Regla 5: Partido Caliente';
    if (normal.includes('remontada') || normal.includes('comeback')) return 'Regla 6: Remontada Improbable';
    if (normal.includes('asedio') || normal.includes('goal') || normal.includes('gol')) return 'Regla 1: Asedio Favorito';
    if (normal.includes('beisbol') || normal.includes('mlb') || normal.includes('carrera')) return 'Regla 7: Béisbol Live';
    
    return regla.trim() || 'Otras Reglas';
}

function normalizarPartido(partido) {
    return partido
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+vs\s+/g, 'vs')
        .replace(/[^a-z0-9]/g, '');
}

const alertas = [];
const veredictos = [];

rawMessages.forEach(msg => {
    const text = msg.text;
    if (text.includes('VEREDICTO POST-PARTIDO') || text.includes('VEREDICTO:')) {
        veredictos.push(msg);
    } else if (text.includes('REGLA') || text.includes('ANÁLISIS DE IA') || text.includes('GEMINI') || text.includes('DEEPSEEK') || text.includes('BÉISBOL')) {
        alertas.push(msg);
    }
});

// Map alerts
const processedAlerts = [];
const alertMapByKey = {};

alertas.forEach(a => {
    const text = a.text;
    
    // Regla
    const reglaMatch = text.match(/(?:🔥|⏳|🟥|🟨|🟢|⚾)?\s*(REGLA\s*\d+:\s*[^━\n]+)/i) || text.match(/(REGLA\s*\d+:[^\n]+)/i) || text.match(/(BÉISBOL[^\n]+)/i);
    const rawRegla = reglaMatch ? reglaMatch[1].trim() : 'REGLA GENERAL';
    const reglaNombre = normalizarRegla(rawRegla);
    
    // Partido, Liga, Minuto, Marcador
    let liga = 'Desconocida';
    let partido = 'Desconocido';
    let minuto = '';
    let marcador = '';
    
    const lines = text.split('\n');
    lines.forEach(l => {
        if (l.includes('Liga:')) liga = l.replace(/.*Liga:\s*/i, '').trim();
        if (l.includes('⚽') || l.includes('⚾')) {
            partido = l.replace(/[⚽⚾]\s*/g, '').trim();
        }
        if (l.includes('Minuto:')) minuto = l.replace(/.*Minuto:\s*/i, '').split('|')[0].trim();
        if (l.includes('Marcador:')) marcador = l.replace(/.*Marcador:\s*/i, '').trim();
    });
    
    if (partido === 'Desconocido') {
        const pMatch = text.match(/([A-Z0-9\s\.\-]+\s+vs\s+[A-Z0-9\s\.\-]+)/i);
        if (pMatch) partido = pMatch[1].trim();
    }
    
    // IA Parse
    const geminiIdx = text.indexOf('GEMINI');
    const deepseekIdx = text.indexOf('DEEPSEEK');
    
    let geminiText = geminiIdx !== -1 ? (deepseekIdx > geminiIdx ? text.substring(geminiIdx, deepseekIdx) : text.substring(geminiIdx)) : '';
    let deepseekText = deepseekIdx !== -1 ? text.substring(deepseekIdx) : '';
    
    let geminiBet = 'N/A';
    let geminiConf = 0;
    if (geminiText) {
        const b = geminiText.match(/Apuesta:\s*([^\n\(]+)/i);
        const c = geminiText.match(/Confianza:\s*(\d+)%/i);
        if (b) geminiBet = b[1].trim();
        if (c) geminiConf = parseInt(c[1]);
    }
    
    let deepseekBet = 'N/A';
    let deepseekConf = 0;
    if (deepseekText) {
        const b = deepseekText.match(/Apuesta:\s*([^\n\(]+)/i);
        const c = deepseekText.match(/Confianza:\s*(\d+)%/i);
        if (b) deepseekBet = b[1].trim();
        if (c) deepseekConf = parseInt(c[1]);
    }
    
    const geminiAvoid = geminiBet.toLowerCase().includes('evitar') || geminiBet.toLowerCase().includes('no recomendada') || geminiConf < 40;
    const deepseekAvoid = deepseekBet.toLowerCase().includes('evitar') || deepseekBet.toLowerCase().includes('no recomendada') || deepseekConf < 40;
    
    const partidoNorm = normalizarPartido(partido);
    const reglaNorm = normalizarRegla(rawRegla);
    const key = `${partidoNorm}_${reglaNorm}`;
    
    const alertObj = {
        id: a.id,
        date: a.date,
        time: a.time,
        liga,
        partido,
        partidoNorm,
        reglaRaw: rawRegla,
        reglaNombre,
        minuto,
        marcador,
        geminiBet,
        geminiConf,
        geminiRecommend: !geminiAvoid,
        deepseekBet,
        deepseekConf,
        deepseekRecommend: !deepseekAvoid,
        veredicto: null,
        veredictoDetalle: '',
        veredictoDate: null
    };
    
    alertMapByKey[key] = alertObj;
    processedAlerts.push(alertObj);
});

// Link veredictos
let matchedVeredictos = 0;

veredictos.forEach(v => {
    const text = v.text;
    let outcome = 'DESCONOCIDO';
    if (text.includes('GREEN')) outcome = 'GREEN';
    else if (text.includes('RED')) outcome = 'RED';
    else if (text.includes('APUESTA EVITADA')) outcome = 'APUESTA EVITADA';
    
    let partido = 'Desconocido';
    let reglaRaw = '';
    let detalle = '';
    
    const lines = text.split('\n');
    lines.forEach(l => {
        if (l.includes('Regla:')) reglaRaw = l.replace(/.*Regla:\s*/i, '').trim();
        if (l.includes('⚽') || l.includes('⚾')) {
            partido = l.replace(/[⚽⚾]\s*/g, '').trim();
            // Remove score if inline e.g. Thor Akureyri 1 - 0 Breidablik
            const vsScoreMatch = partido.match(/([^\d\-]+)\s+\d+\s*-\s*\d+\s+([^\d\-]+)/);
            if (vsScoreMatch) {
                partido = `${vsScoreMatch[1].trim()} vs ${vsScoreMatch[2].trim()}`;
            }
        }
        if (l.includes('Resultado:')) detalle = l.replace(/.*Resultado:\s*/i, '').trim();
    });
    
    const partidoNorm = normalizarPartido(partido);
    const reglaNorm = normalizarRegla(reglaRaw);
    
    // Find alert match
    let match = alertMapByKey[`${partidoNorm}_${reglaNorm}`];
    if (!match) {
        // Try fuzzy match
        const found = processedAlerts.find(a => {
            if (a.veredicto) return false; // already matched
            if (a.partidoNorm.includes(partidoNorm) || partidoNorm.includes(a.partidoNorm)) return true;
            const p1 = partidoNorm.split('vs');
            const p2 = a.partidoNorm.split('vs');
            if (p1.length === 2 && p2.length === 2) {
                if (p1[0].substring(0,4) === p2[0].substring(0,4) && p1[1].substring(0,4) === p2[1].substring(0,4)) return true;
            }
            return false;
        });
        if (found) match = found;
    }
    
    if (match) {
        match.veredicto = outcome;
        match.veredictoDetalle = detalle;
        match.veredictoDate = v.date;
        matchedVeredictos++;
    }
});

console.log(`Alerts processed: ${processedAlerts.length}`);
console.log(`Matched veredictos: ${matchedVeredictos}`);

// Group by Date stats
const byDate = {};
processedAlerts.forEach(a => {
    const d = a.date;
    if (!byDate[d]) {
        byDate[d] = { date: d, total: 0, green: 0, red: 0, evitadas: 0, sinVeredicto: 0, geminiRec: 0, geminiOk: 0, deepseekRec: 0, deepseekOk: 0 };
    }
    const stat = byDate[d];
    stat.total++;
    if (a.veredicto === 'GREEN') stat.green++;
    else if (a.veredicto === 'RED') stat.red++;
    else if (a.veredicto === 'APUESTA EVITADA') stat.evitadas++;
    else stat.sinVeredicto++;

    if (a.geminiRecommend) {
        stat.geminiRec++;
        if (a.veredicto === 'GREEN') stat.geminiOk++;
    }
    if (a.deepseekRecommend) {
        stat.deepseekRec++;
        if (a.veredicto === 'GREEN') stat.deepseekOk++;
    }
});

console.log('\n--- BY DATE STATS ---');
console.table(byDate);

// Group by Rule stats
const byRule = {};
processedAlerts.forEach(a => {
    const r = a.reglaNombre;
    if (!byRule[r]) {
        byRule[r] = { regla: r, total: 0, green: 0, red: 0, evitadas: 0, sinVeredicto: 0 };
    }
    const stat = byRule[r];
    stat.total++;
    if (a.veredicto === 'GREEN') stat.green++;
    else if (a.veredicto === 'RED') stat.red++;
    else if (a.veredicto === 'APUESTA EVITADA') stat.evitadas++;
    else stat.sinVeredicto++;
});

console.log('\n--- BY RULE STATS ---');
console.table(byRule);
