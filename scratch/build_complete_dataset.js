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

function categorizarTextoApuesta(str) {
    if (!str || str === 'N/A') return 'Otros Mercados';
    const s = str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    if (s.includes('evitar') || s.includes('no recomendada')) return 'Apuesta Evitada / Descartada';
    if (s.includes('ambos anotan') || s.includes('ambos marcan') || s.includes('btts') || s.includes('ambos equipos')) return 'Ambos Anotan (BTTS)';
    if (s.includes('over 2.5') || s.includes('mas de 2.5') || s.includes('> 2.5') || s.includes('+2.5') || s.includes('over 3.5') || s.includes('mas de 3.5') || s.includes('over 1.5') || s.includes('mas de 1.5') || s.includes('goles totales') || s.includes('linea de goles') || (s.includes('over') && !s.includes('tarjeta') && !s.includes('corner'))) return 'Línea de Goles (Over/Under)';
    if (s.includes('proximo gol') || s.includes('siguiente gol') || s.includes('primer gol') || s.includes('gol de')) return 'Próximo Gol / Gol en Vivo';
    if (s.includes('doble oportunidad') || s.includes('empate o') || s.includes('1x') || s.includes('x2') || s.includes('12')) return 'Doble Oportunidad (1X / X2)';
    if (s.includes('victoria') || s.includes('gana') || s.includes('ml') || s.includes('resultado final') || s.includes('ganador') || s.includes('apuesta sin empate') || s.includes('dnb') || s.includes('handicap')) return 'Victoria Directa (1X2 / ML)';
    if (s.includes('tarjeta') || s.includes('tarjetas')) return 'Tarjetas Totales / Tarjetas en Vivo';
    if (s.includes('corner') || s.includes('corners') || s.includes('esquina')) return 'Córneres Totales / Saques de Esquina';
    if (s.includes('carrera') || s.includes('entrada') || s.includes('beisbol') || s.includes('mlb')) return 'Béisbol Live (Carreras / ML)';

    return 'Otros Mercados';
}

const singleAlertsRaw = [];
const parlaysRaw = [];
const veredictosRaw = [];

rawMessages.forEach(msg => {
    const text = msg.text;
    if (text.includes('VEREDICTO') || text.includes('APUESTA EVITADA')) {
        veredictosRaw.push(msg);
    } else if (text.includes('PARLAY') || text.includes('COMBINADA')) {
        parlaysRaw.push(msg);
    } else if (text.includes('REGLA') || text.includes('BÉISBOL') || text.includes('ANÁLISIS DE IA') || text.includes('GEMINI') || text.includes('DEEPSEEK')) {
        singleAlertsRaw.push(msg);
    }
});

// Parse Single Alerts
const singleAlerts = singleAlertsRaw.map(a => {
    const text = a.text;
    
    const reglaMatch = text.match(/(?:🔥|⏳|🟥|🟨|🟢|⚾|🚨|🏆|♟️|🎯|👑|⚡|🚀|🚩)?\s*(REGLA\s*\d+:\s*[^━\n]+)/i) || text.match(/(REGLA\s*\d+:[^\n]+)/i) || text.match(/(BÉISBOL[^\n]+)/i);
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
    
    const cleanPartido = cleanMarkdownLinks(partido);
    const partidoNorm = normalizarPartido(cleanPartido);
    
    const geminiIdx = text.indexOf('GEMINI');
    const deepseekIdx = text.indexOf('DEEPSEEK');
    
    let geminiText = geminiIdx !== -1 ? (deepseekIdx > geminiIdx ? text.substring(geminiIdx, deepseekIdx) : text.substring(geminiIdx)) : '';
    let deepseekText = deepseekIdx !== -1 ? text.substring(deepseekIdx) : '';
    
    let geminiBet = 'N/A';
    let geminiConf = 0;
    let geminiReason = '';
    if (geminiText) {
        const b = geminiText.match(/Apuesta:\s*([^\n\(]+)/i) || geminiText.match(/Sugerencia:\s*([^\n\(]+)/i);
        const c = geminiText.match(/Confianza:\s*(\d+)%/i);
        const r = geminiText.match(/Análisis:\s*([^\n]+)/i) || geminiText.match(/Motivo:\s*([^\n]+)/i);
        if (b) geminiBet = b[1].trim();
        if (c) geminiConf = parseInt(c[1]);
        if (r) geminiReason = r[1].trim();
    }
    
    let deepseekBet = 'N/A';
    let deepseekConf = 0;
    let deepseekReason = '';
    if (deepseekText) {
        const b = deepseekText.match(/Apuesta:\s*([^\n\(]+)/i) || deepseekText.match(/Sugerencia:\s*([^\n\(]+)/i);
        const c = deepseekText.match(/Confianza:\s*(\d+)%/i);
        const r = deepseekText.match(/Análisis:\s*([^\n]+)/i) || deepseekText.match(/Motivo:\s*([^\n]+)/i);
        if (b) deepseekBet = b[1].trim();
        if (c) deepseekConf = parseInt(c[1]);
        if (r) deepseekReason = r[1].trim();
    }
    
    const geminiAvoid = geminiBet.toLowerCase().includes('evitar') || geminiBet.toLowerCase().includes('no recomendada') || (geminiConf > 0 && geminiConf < 40);
    const deepseekAvoid = deepseekBet.toLowerCase().includes('evitar') || deepseekBet.toLowerCase().includes('no recomendada') || (deepseekConf > 0 && deepseekConf < 40);
    
    const geminiCategory = categorizarTextoApuesta(geminiBet);
    const deepseekCategory = categorizarTextoApuesta(deepseekBet);
    const primaryCategory = geminiCategory !== 'Otros Mercados' && geminiCategory !== 'Apuesta Evitada / Descartada' ? geminiCategory : deepseekCategory;

    return {
        id: a.id,
        date: a.date,
        time: a.time,
        liga,
        partido: cleanPartido,
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
        geminiCategory,
        deepseekBet,
        deepseekConf,
        deepseekReason,
        deepseekRecommend: !deepseekAvoid,
        deepseekCategory,
        primaryCategory,
        veredicto: null,
        veredictoDetalle: '',
        veredictoDate: null,
        geminiVeredicto: null,
        deepseekVeredicto: null
    };
});

// Emparejar Veredictos de Alertas Simples
veredictosRaw.forEach(v => {
    const text = v.text;
    if (text.includes('PARLAY') || text.includes('COMBINADA')) return; // handled separately

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
        }
        if (deepseekPart) {
            if (deepseekPart[1].includes('GREEN')) deepseekOutcome = 'GREEN';
            else if (deepseekPart[1].includes('RED')) deepseekOutcome = 'RED';
            else if (deepseekPart[1].includes('EVITADA')) deepseekOutcome = 'APUESTA EVITADA';
        }
    }
    
    const cleanPartido = cleanMarkdownLinks(partido);
    const partidoNorm = normalizarPartido(cleanPartido);
    const reglaNombre = normalizarRegla(reglaRaw);
    
    let alertMatch = singleAlerts.find(a => !a.veredicto && a.partidoNorm === partidoNorm && a.reglaNombre === reglaNombre);
    if (!alertMatch) {
        alertMatch = singleAlerts.find(a => !a.veredicto && a.partidoNorm === partidoNorm);
    }
    if (!alertMatch) {
        alertMatch = singleAlerts.find(a => {
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

// Identificar alertas sin veredicto
const pendingAlerts = singleAlerts.filter(a => !a.veredicto);
console.log(`Alertas simples procesadas: ${singleAlerts.length} | Con veredicto en chat: ${singleAlerts.length - pendingAlerts.length} | Sin veredicto: ${pendingAlerts.length}`);

if (pendingAlerts.length > 0) {
    console.log("\n=== ALERTAS PENDIENTES DE VERIFICACIÓN WEB ===");
    pendingAlerts.forEach(a => console.log(`[${a.date} ${a.time}] ${a.reglaNombre} | ${a.partido} | Gemini: ${a.geminiBet} | DeepSeek: ${a.deepseekBet}`));
}

fs.writeFileSync(path.join(__dirname, 'complete_dataset.json'), JSON.stringify({
    singleAlerts,
    pendingAlerts
}, null, 2));
