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

    const titleDateMatch = block.match(/title="(\d{2}\.\d{4}\.\d{4}|\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2}:\d{2})/);
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
    if (normal.includes('asedio') || normal.includes('gol') || normal.includes('inminente')) return 'Regla 1: Asedio Favorito';
    if (normal.includes('domina') || normal.includes('ht') || normal.includes('favorito domina')) return 'Regla 8: Favorito Domina HT';
    if (normal.includes('beisbol') || normal.includes('mlb') || normal.includes('carrera')) return 'Regla 7: Béisbol Live';
    if (normal.includes('corner')) return 'Regla 6: Presión Córneres';
    
    return regla.trim() || 'Reglas Generales';
}

function normalizarPartido(partido) {
    return partido
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+vs\s+/g, 'vs')
        .replace(/[^a-z0-9]/g, '');
}

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

// Process Alerts
const processedAlerts = [];

alerts.forEach(a => {
    const text = a.text;
    
    const reglaMatch = text.match(/(?:🔥|⏳|🟥|🟨|🟢|⚾)?\s*(REGLA\s*\d+:\s*[^━\n]+)/i) || text.match(/(REGLA\s*\d+:[^\n]+)/i) || text.match(/(BÉISBOL[^\n]+)/i);
    const rawRegla = reglaMatch ? reglaMatch[1].trim() : 'REGLA GENERAL';
    const reglaNombre = normalizarRegla(rawRegla);
    
    let liga = 'Desconocida';
    let partido = 'Desconocido';
    let minuto = '';
    let marcador = '';
    let momios = '';
    
    const lines = text.split('\n');
    lines.forEach(l => {
        if (l.includes('Liga:')) liga = l.replace(/.*Liga:\s*/i, '').trim();
        if (l.includes('⚽') || l.includes('⚾')) {
            partido = l.replace(/[⚽⚾]\s*/g, '').trim();
        }
        if (l.includes('Minuto:')) minuto = l.replace(/.*Minuto:\s*/i, '').split('|')[0].trim();
        if (l.includes('Marcador:')) marcador = l.replace(/.*Marcador:\s*/i, '').trim();
        if (l.includes('Momios')) momios = l.replace(/.*Momios[^\:]*:\s*/i, '').trim();
    });
    
    if (partido === 'Desconocido') {
        const pMatch = text.match(/([A-Z0-9\s\.\-]+\s+vs\s+[A-Z0-9\s\.\-]+)/i);
        if (pMatch) partido = pMatch[1].trim();
    }
    
    // Parse Gemini and DeepSeek
    const geminiIdx = text.indexOf('GEMINI');
    const deepseekIdx = text.indexOf('DEEPSEEK');
    
    let geminiText = geminiIdx !== -1 ? (deepseekIdx > geminiIdx ? text.substring(geminiIdx, deepseekIdx) : text.substring(geminiIdx)) : '';
    let deepseekText = deepseekIdx !== -1 ? text.substring(deepseekIdx) : '';
    
    let geminiBet = 'N/A';
    let geminiConf = 0;
    let geminiReason = '';
    if (geminiText) {
        const b = geminiText.match(/Apuesta:\s*([^\n\(]+)/i);
        const c = geminiText.match(/Confianza:\s*(\d+)%/i);
        const r = geminiText.match(/Análisis:\s*([^\n]+)/i);
        if (b) geminiBet = b[1].trim();
        if (c) geminiConf = parseInt(c[1]);
        if (r) geminiReason = r[1].trim();
    }
    
    let deepseekBet = 'N/A';
    let deepseekConf = 0;
    let deepseekReason = '';
    if (deepseekText) {
        const b = deepseekText.match(/Apuesta:\s*([^\n\(]+)/i);
        const c = deepseekText.match(/Confianza:\s*(\d+)%/i);
        const r = deepseekText.match(/Análisis:\s*([^\n]+)/i);
        if (b) deepseekBet = b[1].trim();
        if (c) deepseekConf = parseInt(c[1]);
        if (r) deepseekReason = r[1].trim();
    }
    
    const geminiAvoid = geminiBet.toLowerCase().includes('evitar') || geminiBet.toLowerCase().includes('no recomendada') || geminiConf < 40;
    const deepseekAvoid = deepseekBet.toLowerCase().includes('evitar') || deepseekBet.toLowerCase().includes('no recomendada') || deepseekConf < 40;
    
    const partidoNorm = normalizarPartido(partido);
    
    processedAlerts.push({
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
        momios,
        geminiBet,
        geminiConf,
        geminiReason,
        geminiRecommend: !geminiAvoid,
        deepseekBet,
        deepseekConf,
        deepseekReason,
        deepseekRecommend: !deepseekAvoid,
        veredicto: null,
        veredictoDetalle: '',
        veredictoDate: null,
        geminiVeredicto: null,
        deepseekVeredicto: null
    });
});

// Process Veredictos and match to alerts
veredictos.forEach(v => {
    const text = v.text;
    
    // Check if DUAL veredicto
    const isDual = text.includes('DUAL');
    
    let generalOutcome = 'DESCONOCIDO';
    if (text.includes('GREEN')) generalOutcome = 'GREEN';
    else if (text.includes('RED')) generalOutcome = 'RED';
    else if (text.includes('APUESTA EVITADA')) generalOutcome = 'APUESTA EVITADA';
    
    let partido = 'Desconocido';
    let reglaRaw = '';
    let detalle = '';
    
    let geminiOutcome = null;
    let deepseekOutcome = null;
    
    const lines = text.split('\n');
    lines.forEach(l => {
        if (l.includes('Regla:')) reglaRaw = l.replace(/.*Regla:\s*/i, '').trim();
        if (l.includes('⚽') || l.includes('⚾')) {
            partido = l.replace(/[⚽⚾]\s*/g, '').trim();
            const vsMatch = partido.match(/([^\d\-]+)\s+\d+\s*-\s*\d+\s+([^\d\-]+)/);
            if (vsMatch) {
                partido = `${vsMatch[1].trim()} vs ${vsMatch[2].trim()}`;
            }
        }
        if (l.includes('Resultado:')) detalle = l.replace(/.*Resultado:\s*/i, '').trim();
    });
    
    if (isDual) {
        const geminiPart = text.match(/GEMINI:\s*([^\n]+)/i);
        const deepseekPart = text.match(/DEEPSEEK:\s*([^\n]+)/i);
        if (geminiPart) {
            if (geminiPart[1].includes('GREEN')) geminiOutcome = 'GREEN';
            else if (geminiPart[1].includes('RED')) geminiOutcome = 'RED';
            else if (geminiPart[1].includes('EVITADA')) geminiOutcome = 'APUESTA EVITADA';
            else if (geminiPart[1].includes('N/D')) geminiOutcome = 'N/D';
        }
        if (deepseekPart) {
            if (deepseekPart[1].includes('GREEN')) deepseekOutcome = 'GREEN';
            else if (deepseekPart[1].includes('RED')) deepseekOutcome = 'RED';
            else if (deepseekPart[1].includes('EVITADA')) deepseekOutcome = 'APUESTA EVITADA';
            else if (deepseekPart[1].includes('N/D')) deepseekOutcome = 'N/D';
        }
    }
    
    const partidoNorm = normalizarPartido(partido);
    const reglaNombre = normalizarRegla(reglaRaw);
    
    // Match logic
    let alertMatch = processedAlerts.find(a => !a.veredicto && a.partidoNorm === partidoNorm && a.reglaNombre === reglaNombre);
    if (!alertMatch) {
        alertMatch = processedAlerts.find(a => !a.veredicto && a.partidoNorm === partidoNorm);
    }
    if (!alertMatch) {
        alertMatch = processedAlerts.find(a => {
            if (a.veredicto) return false;
            const p1 = partidoNorm.split('vs');
            const p2 = a.partidoNorm.split('vs');
            if (p1.length === 2 && p2.length === 2) {
                if (p1[0].length >= 4 && p2[0].length >= 4 && (p1[0].includes(p2[0].substring(0,4)) || p2[0].includes(p1[0].substring(0,4)))) {
                    return true;
                }
            }
            return false;
        });
    }
    
    if (alertMatch) {
        alertMatch.veredicto = generalOutcome;
        alertMatch.veredictoDetalle = detalle || alertMatch.veredictoDetalle;
        alertMatch.veredictoDate = v.date;
        alertMatch.geminiVeredicto = geminiOutcome || (generalOutcome !== 'DESCONOCIDO' ? generalOutcome : null);
        alertMatch.deepseekVeredicto = deepseekOutcome || (generalOutcome !== 'DESCONOCIDO' ? generalOutcome : null);
    }
});

// Calculate statistics
const dates = [...new Set(processedAlerts.map(a => a.date))].sort();
const rules = [...new Set(processedAlerts.map(a => a.reglaNombre))].sort();

console.log(`Dates (${dates.length}):`, dates);
console.log(`Rules (${rules.length}):`, rules);

fs.writeFileSync(path.join(__dirname, 'processed_data.json'), JSON.stringify(processedAlerts, null, 2));
console.log(`Saved processed data to scratch/processed_data.json`);
