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

function normalizarPartido(partido) {
    const clean = cleanMarkdownLinks(partido);
    return clean
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+vs\s+/g, 'vs')
        .replace(/[^a-z0-9]/g, '');
}

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
    
    const lines = text.split('\n');
    lines.forEach(l => {
        if (l.includes('Liga:')) liga = l.replace(/.*Liga:\s*/i, '').trim();
        if (l.includes('⚽') || l.includes('⚾')) {
            partido = l.replace(/[⚽⚾]\s*/g, '').trim();
        }
        if (l.includes('Minuto:')) minuto = l.replace(/.*Minuto:\s*/i, '').split('|')[0].trim();
        if (l.includes('Marcador:')) marcador = l.replace(/.*Marcador:\s*/i, '').trim();
    });
    
    const cleanPartido = cleanMarkdownLinks(partido);
    const partidoNorm = normalizarPartido(cleanPartido);
    
    processedAlerts.push({
        id: a.id,
        date: a.date,
        time: a.time,
        liga,
        partido: cleanPartido,
        partidoNorm,
        reglaNombre,
        veredicto: null
    });
});

let matched = 0;
veredictos.forEach(v => {
    const text = v.text;
    let generalOutcome = 'DESCONOCIDO';
    if (text.includes('GREEN')) generalOutcome = 'GREEN';
    else if (text.includes('RED')) generalOutcome = 'RED';
    else if (text.includes('APUESTA EVITADA')) generalOutcome = 'APUESTA EVITADA';
    
    let partido = 'Desconocido';
    let reglaRaw = '';
    
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
    });
    
    const cleanPartido = cleanMarkdownLinks(partido);
    const partidoNorm = normalizarPartido(cleanPartido);
    const reglaNombre = normalizarRegla(reglaRaw);
    
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
        matched++;
    }
});

console.log(`Matched veredictos with markdown link cleaning: ${matched} of ${veredictos.length}`);
const remainingPendientes = processedAlerts.filter(a => !a.veredicto);
console.log(`Remaining pending alerts: ${remainingPendientes.length} of ${processedAlerts.length}`);

console.log('\n--- REMAINING PENDING ALERTS ---');
remainingPendientes.forEach((p, i) => {
    console.log(`[${i+1}] Date: ${p.date} | ${p.reglaNombre} | ${p.partido} (${p.liga}) | Key: ${p.partidoNorm}`);
});
