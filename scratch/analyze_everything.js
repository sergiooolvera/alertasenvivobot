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

// Separar tipos de mensajes
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

// Procesar Parlays
const parlays = parlaysRaw.map(p => {
    const text = p.text;
    const isDia = text.includes('PARLAY DEL DÍA') || text.includes('PARLAY DEL DIA');
    const isVivo = text.includes('PARLAY EN VIVO') || text.includes('COMBINADA EN VIVO');
    
    const momioMatch = text.match(/MOMIO TOTAL ESTIMADO:\s*@?([\d\.]+)/i) || text.match(/MOMIO ESTIMADO:\s*@?([\d\.]+)/i) || text.match(/MOMIO COMBINADO:\s*@?([\d\.]+)/i);
    const momio = momioMatch ? parseFloat(momioMatch[1]) : 1.70;

    const confMatch = text.match(/CONFIANZA COMBINADA:\s*(\d+)%/i) || text.match(/CONFIANZA:\s*(\d+)%/i);
    const confianza = confMatch ? parseInt(confMatch[1]) : 75;

    // Extraer selecciones
    const selecciones = [];
    const lines = text.split('\n');
    lines.forEach(l => {
        if (l.match(/^\d+\./) || l.includes('Pronóstico:') || l.includes('SELECCIÓN')) {
            selecciones.push(l.trim());
        }
    });

    return {
        id: p.id,
        date: p.date,
        time: p.time,
        type: isDia ? 'PARLAY DEL DÍA' : (isVivo ? 'PARLAY EN VIVO' : 'PARLAY GENERAL'),
        momio,
        confianza,
        text,
        selecciones,
        veredicto: null,
        detalleVeredicto: ''
    };
});

// Emparejar veredictos de parlays
veredictosRaw.forEach(v => {
    const text = v.text;
    if (text.includes('PARLAY') || text.includes('COMBINADA')) {
        let isGreen = text.includes('GREEN') || text.includes('🟢') || text.includes('GANADA') || text.includes('EXITOSO');
        let isRed = text.includes('RED') || text.includes('🔴') || text.includes('PERDIDA') || text.includes('FALLADA');

        // Buscar parlay por fecha / hora o ID cercano anterior
        const matchingParlay = parlays.reverse().find(p => p.id < v.id && !p.veredicto);
        if (matchingParlay) {
            matchingParlay.veredicto = isGreen ? 'GREEN' : (isRed ? 'RED' : 'PENDIENTE');
            matchingParlay.detalleVeredicto = text;
        }
    }
});

console.log("\n================ DETALLE DE PARLAYS ================");
parlays.forEach(p => {
    console.log(`[${p.date} ${p.time}] ID: ${p.id} | Tipo: ${p.type} | Momio: @${p.momio} | Confianza: ${p.confianza}% | Veredicto: ${p.veredicto || 'SIN VEREDICTO EN CHAT'}`);
    console.log(`Selecciones:\n  ${p.selecciones.join('\n  ')}`);
    if (p.detalleVeredicto) {
        console.log(`Veredicto chat: ${p.detalleVeredicto.substring(0, 120)}...`);
    }
    console.log("----------------------------------------------------");
});

fs.writeFileSync(path.join(__dirname, 'parlays_summary.json'), JSON.stringify(parlays, null, 2));
