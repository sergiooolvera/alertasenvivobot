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

function extractTeams(str) {
    if (!str) return { home: '', away: '' };
    let clean = cleanMarkdownLinks(str).replace(/flashscore/gi, '').replace(/%20/g, ' ');
    clean = clean.replace(/[⚽⚾]\s*/g, '').trim();

    // Si tiene marcador ej "Chico 2 - 0 Once Caldas"
    const scoreMatch = clean.match(/^(.+?)\s+\d+\s*-\s*\d+\s+(.+)$/);
    if (scoreMatch) {
        return { home: scoreMatch[1].trim(), away: scoreMatch[2].trim() };
    }

    // Si tiene "vs" ej "Chico vs Once Caldas"
    const vsMatch = clean.match(/^(.+?)\s+vs\s+(.+)$/i);
    if (vsMatch) {
        return { home: vsMatch[1].trim(), away: vsMatch[2].trim() };
    }

    return { home: clean, away: '' };
}

function simplifyName(name) {
    return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

// Separar Alertas Simples, Parlays y Veredictos
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

// Procesar Veredictos Raw para extracción limpia
const veredictosProcesados = veredictosRaw.map(v => {
    const text = v.text;
    const isParlay = text.includes('PARLAY') || text.includes('COMBINADA');
    let outcome = 'DESCONOCIDO';
    if (text.includes('GREEN') || text.includes('🟩')) outcome = 'GREEN';
    else if (text.includes('RED') || text.includes('🟥')) outcome = 'RED';
    else if (text.includes('BLACK') || text.includes('⬛')) outcome = 'BLACK'; // VOID / CANCELLED
    else if (text.includes('APUESTA EVITADA') || text.includes('⚪')) outcome = 'APUESTA EVITADA';

    let partidoLine = '';
    let detalle = '';
    const lines = text.split('\n');
    lines.forEach(l => {
        if (l.includes('⚽') || l.includes('⚾')) partidoLine = l.replace(/[⚽⚾]\s*/g, '').trim();
        if (l.includes('Resultado:') || l.includes('💡')) detalle = l.replace(/.*Resultado:\s*/i, '').replace(/.*💡\s*/i, '').trim();
    });

    const teams = extractTeams(partidoLine);

    return {
        id: v.id,
        date: v.date,
        time: v.time,
        isParlay,
        outcome,
        detalle,
        home: teams.home,
        away: teams.away,
        homeSimp: simplifyName(teams.home),
        awaySimp: simplifyName(teams.away),
        text
    };
});

// Procesar Alertas Simples
const singleAlertsProcesadas = singleAlertsRaw.map(a => {
    const text = a.text;
    
    const reglaMatch = text.match(/(?:🔥|⏳|🟥|🟨|🟢|⚾|🚨|🏆|♟️|🎯|👑|⚡|🚀|🚩)?\s*(REGLA\s*\d+:\s*[^━\n]+)/i) || text.match(/(REGLA\s*\d+:[^\n]+)/i) || text.match(/(BÉISBOL[^\n]+)/i);
    const rawRegla = reglaMatch ? reglaMatch[1].trim() : 'REGLA GENERAL';
    const reglaNombre = normalizarRegla(rawRegla);
    
    let liga = 'Desconocida';
    let partidoLine = 'Desconocido';
    let minuto = '';
    let marcador = '';
    let momios = '';
    
    const lines = text.split('\n');
    lines.forEach(l => {
        if (l.includes('Liga:')) liga = l.replace(/.*Liga:\s*/i, '').trim();
        if (l.includes('⚽') || l.includes('⚾')) {
            partidoLine = l.replace(/[⚽⚾]\s*/g, '').trim();
        }
        if (l.includes('Minuto:')) minuto = l.replace(/.*Minuto:\s*/i, '').split('|')[0].trim();
        if (l.includes('Marcador:')) marcador = l.replace(/.*Marcador:\s*/i, '').trim();
        if (l.includes('Momios')) momios = l.replace(/.*Momios[^\:]*:\s*/i, '').trim();
    });

    const teams = extractTeams(partidoLine);
    const homeSimp = simplifyName(teams.home);
    const awaySimp = simplifyName(teams.away);

    const geminiIdx = text.indexOf('GEMINI');
    const deepseekIdx = text.indexOf('DEEPSEEK');
    
    let geminiText = geminiIdx !== -1 ? (deepseekIdx > geminiIdx ? text.substring(geminiIdx, deepseekIdx) : text.substring(geminiIdx)) : '';
    let deepseekText = deepseekIdx !== -1 ? text.substring(deepseekIdx) : '';
    
    let geminiBet = 'N/A';
    let geminiConf = 0;
    if (geminiText) {
        const b = geminiText.match(/Apuesta:\s*([^\n\(]+)/i) || geminiText.match(/Sugerencia:\s*([^\n\(]+)/i);
        const c = geminiText.match(/Confianza:\s*(\d+)%/i);
        if (b) geminiBet = b[1].trim();
        if (c) geminiConf = parseInt(c[1]);
    }
    
    let deepseekBet = 'N/A';
    let deepseekConf = 0;
    if (deepseekText) {
        const b = deepseekText.match(/Apuesta:\s*([^\n\(]+)/i) || deepseekText.match(/Sugerencia:\s*([^\n\(]+)/i);
        const c = deepseekText.match(/Confianza:\s*(\d+)%/i);
        if (b) deepseekBet = b[1].trim();
        if (c) deepseekConf = parseInt(c[1]);
    }

    return {
        id: a.id,
        date: a.date,
        time: a.time,
        liga,
        partido: `${teams.home} vs ${teams.away}`,
        homeSimp,
        awaySimp,
        reglaNombre,
        minuto,
        marcador,
        geminiBet,
        geminiConf,
        deepseekBet,
        deepseekConf,
        veredicto: null,
        veredictoDetalle: '',
        veredictoMsgId: null
    };
});

// Algoritmo de emparejamiento estricto por similitud de equipos y secuencia de ID
singleAlertsProcesadas.forEach(alert => {
    // Buscar veredictos individuales no asignados que sigan a la alerta
    const candidates = veredictosProcesados.filter(v => !v.isParlay && v.id > alert.id && !v.assigned);

    const bestMatch = candidates.find(v => {
        if (!alert.homeSimp || !v.homeSimp) return false;
        // Coincidencia exacta o contenida de nombres de equipo
        const homeOk = alert.homeSimp.includes(v.homeSimp.substring(0, 4)) || v.homeSimp.includes(alert.homeSimp.substring(0, 4));
        const awayOk = !alert.awaySimp || !v.awaySimp || alert.awaySimp.includes(v.awaySimp.substring(0, 4)) || v.awaySimp.includes(alert.awaySimp.substring(0, 4));
        return homeOk && awayOk;
    });

    if (bestMatch) {
        bestMatch.assigned = true;
        alert.veredicto = bestMatch.outcome;
        alert.veredictoDetalle = bestMatch.detalle || 'Veredicto oficial de Telegram';
        alert.veredictoMsgId = bestMatch.id;
    }
});

const emparejadas = singleAlertsProcesadas.filter(a => a.veredicto !== null);
const noEmparejadas = singleAlertsProcesadas.filter(a => a.veredicto === null);

console.log(`Alertas totales: ${singleAlertsProcesadas.length}`);
console.log(`Emparejadas exitosamente con su veredicto oficial de Telegram: ${emparejadas.length}`);
console.log(`Alertas sin veredicto expreso en Telegram: ${noEmparejadas.length}`);

// Inspeccionar emparejamientos clave como Chico vs Once Caldas
const chicoAlert = singleAlertsProcesadas.find(a => a.homeSimp.includes('chico') || a.awaySimp.includes('chico'));
console.log("\n=== AUDITORÍA CHICO VS ONCE CALDAS ===");
console.log(chicoAlert);

fs.writeFileSync(path.join(__dirname, 'verdict_audit_strict.json'), JSON.stringify({
    emparejadas,
    noEmparejadas
}, null, 2));
