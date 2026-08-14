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
        if (dateMatch) currentDate = dateMatch[1].trim();
        return;
    }
    const titleDateMatch = block.match(/title="(\d{2}\.\d{2}\.\d{4}|\d{2}\.\d{4}\.\d{4})\s+(\d{2}:\d{2}:\d{2})/);
    let fullDate = currentDate;
    if (titleDateMatch) fullDate = titleDateMatch[1];
    const textMatch = block.match(/<div class="text">([\s\S]*?)<\/div>/);
    if (!textMatch) return;
    let text = textMatch[1].trim()
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?[^>]+(>|$)/g, '')
        .replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    rawMessages.push({ date: fullDate, text });
});

function normalizarRegla(regla) {
    let normal = regla.replace(/^(?:🔥|⏳|🟥|🟨|🟢|⚾|🚨|🏆)\s*/i, '');
    normal = normal.replace(/^REGLA\s*\d+\s*:\s*/i, '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (normal.includes('sorpresa')) return 'Regla 3: Sorpresa Tempranera';
    if (normal.includes('roja') || normal.includes('expulsion')) return 'Regla 2: Roja Estratégica';
    if (normal.includes('sufre') || normal.includes('favorito sufre')) return 'Regla 4: Sufre Favorito';
    if (normal.includes('caliente') || normal.includes('tarjeta')) return 'Regla 5: Partido Caliente';
    if (normal.includes('remontada') || normal.includes('comeback')) return 'Regla 6: Remontada Improbable';
    if (normal.includes('asedio') || normal.includes('gol')) return 'Regla 1: Asedio Favorito';
    if (normal.includes('domina') || normal.includes('ht')) return 'Regla 8: Favorito Domina HT';
    if (normal.includes('beisbol') || normal.includes('mlb')) return 'Regla 7: Béisbol Live';
    if (normal.includes('corner')) return 'Regla 6: Presión Córneres';
    return regla.trim();
}

function cleanMarkdownLinks(str) {
    if (!str) return '';
    return str.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1').replace(/[\[\]]/g, '').trim();
}

const alerts = [];
const veredictos = [];

rawMessages.forEach(msg => {
    if (msg.text.includes('VEREDICTO POST-PARTIDO') || msg.text.includes('VEREDICTO:')) {
        veredictos.push(msg);
    } else if (msg.text.includes('REGLA') || msg.text.includes('ANÁLISIS DE IA')) {
        alerts.push(msg);
    }
});

const processedAlerts = [];
alerts.forEach(a => {
    const text = a.text;
    const reglaMatch = text.match(/(?:🔥|⏳|🟥|🟨|🟢|⚾)?\s*(REGLA\s*\d+:\s*[^━\n]+)/i) || text.match(/(REGLA\s*\d+:[^\n]+)/i);
    if (!reglaMatch) return;
    const reglaNombre = normalizarRegla(reglaMatch[1].trim());
    
    let partido = 'Desconocido';
    let liga = 'Desconocida';
    let minScore = '';
    const lines = text.split('\n');
    lines.forEach(l => {
        if (l.includes('Liga:')) liga = l.replace(/.*Liga:\s*/i, '').trim();
        if (l.includes('⚽') || l.includes('⚾')) partido = l.replace(/[⚽⚾]\s*/g, '').trim();
        if (l.includes('Minuto:')) minScore = l.replace(/.*Minuto:\s*/i, '').trim();
    });
    
    // Extraer recomendaciones
    const geminiIdx = text.indexOf('GEMINI');
    const deepseekIdx = text.indexOf('DEEPSEEK');
    let geminiBet = 'N/A';
    let deepseekBet = 'N/A';
    if (geminiIdx !== -1) {
        const chunk = deepseekIdx > geminiIdx ? text.substring(geminiIdx, deepseekIdx) : text.substring(geminiIdx);
        const b = chunk.match(/Apuesta:\s*([^\n\(]+)/i);
        if (b) geminiBet = b[1].trim();
    }
    if (deepseekIdx !== -1) {
        const chunk = text.substring(deepseekIdx);
        const b = chunk.match(/Apuesta:\s*([^\n\(]+)/i);
        if (b) deepseekBet = b[1].trim();
    }

    processedAlerts.push({
        date: a.date,
        partido: cleanMarkdownLinks(partido),
        partidoNorm: cleanMarkdownLinks(partido).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+vs\s+/g, 'vs').replace(/[^a-z0-9]/g, ''),
        reglaNombre,
        liga,
        minScore,
        geminiBet,
        deepseekBet,
        veredicto: null
    });
});

// Cruzar con veredictos de HTML
veredictos.forEach(v => {
    let partido = 'Desconocido';
    let reglaRaw = '';
    const lines = v.text.split('\n');
    lines.forEach(l => {
        if (l.includes('Regla:')) reglaRaw = l.replace(/.*Regla:\s*/i, '').trim();
        if (l.includes('⚽') || l.includes('⚾')) {
            partido = l.replace(/[⚽⚾]\s*/g, '').trim();
            const vsMatch = partido.match(/([^\d\-]+)\s+\d+\s*-\s*\d+\s+([^\d\-]+)/);
            if (vsMatch) partido = `${vsMatch[1].trim()} vs ${vsMatch[2].trim()}`;
        }
    });
    const partidoNorm = cleanMarkdownLinks(partido).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+vs\s+/g, 'vs').replace(/[^a-z0-9]/g, '');
    const reglaNombre = normalizarRegla(reglaRaw);
    
    let match = processedAlerts.find(a => !a.veredicto && a.partidoNorm === partidoNorm && a.reglaNombre === reglaNombre);
    if (!match) match = processedAlerts.find(a => !a.veredicto && a.partidoNorm === partidoNorm);
    if (match) {
        match.veredicto = v.text.includes('GREEN') ? 'GREEN' : (v.text.includes('RED') ? 'RED' : 'APUESTA EVITADA');
    }
});

// Resultados estaticos
const resultadosWeb = {
    "montanavsnesebar_Regla 3: Sorpresa Tempranera": "GREEN",
    "rodinamoskvavsrubin_Regla 3: Sorpresa Tempranera": "RED",
    "dinamomakhachkalavskryliasovetov_Regla 3: Sorpresa Tempranera": "RED",
    "sydkystenvsishj_Regla 3: Sorpresa Tempranera": "GREEN",
    "brnshjvshbkoge_Regla 3: Sorpresa Tempranera": "APUESTA EVITADA",
    "vibyvsasaaarhus_Regla 4: Sufre Favorito": "APUESTA EVITADA",
    "sydkystenvsishj_Regla 2: Roja Estratégica": "GREEN",
    "hapoelbeershevavsfkcrvenazvezda_Regla 3: Sorpresa Tempranera": "RED",
    "godoycruzresvsracingclubres_Regla 2: Roja Estratégica": "RED",
    "unionstgilloisevsbodoglimt_Regla 5: Partido Caliente": "GREEN",
    "costaricau20vshaitiu20_Regla 3: Sorpresa Tempranera": "RED",
    "unitedstatesu20vsguatemalau20_Regla 3: Sorpresa Tempranera": "GREEN",
    "oddervsskive_Regla 3: Sorpresa Tempranera": "GREEN",
    "kgewvsrigaw_Regla 3: Sorpresa Tempranera": "GREEN",
    "brannvsapollonlimassol_Regla 3: Sorpresa Tempranera": "APUESTA EVITADA",
    "monterreyvsorlandocitysc_Regla 2: Roja Estratégica": "GREEN",
    "stabku19vsfredrikstadfku19_Regla 3: Sorpresa Tempranera": "RED",
    "stabku19vsfredrikstadfku19_Regla 5: Partido Caliente": "GREEN",
    "indjuniorsvs22dejulio_Regla 4: Sufre Favorito": "GREEN",
    "rostovu19vszenitu19_Regla 3: Sorpresa Tempranera": "RED",
    "chertanovou20vsrubinkazanu20_Regla 2: Roja Estratégica": "GREEN",
    "mirassolu20vsitapirenseu20_Regla 3: Sorpresa Tempranera": "GREEN",
    "santosu20vssaobentou20_Regla 3: Sorpresa Tempranera": "GREEN",
    "tanabispu20vspalmeirasu20_Regla 2: Roja Estratégica": "GREEN",
    "operarioprvssaobernardo_Regla 3: Sorpresa Tempranera": "RED",
    "transnarvavskaljunomme_Regla 3: Sorpresa Tempranera": "GREEN",
    "nommeunitediivsfcilevadiaii_Regla 3: Sorpresa Tempranera": "RED",
    "mamelodisundownsvspolokwanecity_Regla 3: Sorpresa Tempranera": "GREEN",
    "fasvsatleticobalboa_Regla 3: Sorpresa Tempranera": "RED",
    "transinvestvilniusvspanevezys_Regla 3: Sorpresa Tempranera": "RED",
    "athleticclubmgu20vscoimbrau20_Regla 3: Sorpresa Tempranera": "GREEN",
    "jongpsvu21vsfcvolendam_Regla 3: Sorpresa Tempranera": "RED",
    "banfieldvsbelgranocordoba_Regla 5: Partido Caliente": "GREEN"
};

processedAlerts.forEach(a => {
    if (!a.veredicto) {
        const key = `${a.partidoNorm}_${a.reglaNombre}`;
        const ext = resultadosWeb[key] || resultadosWeb[`${a.partidoNorm}_Regla 3: Sorpresa Tempranera`];
        if (ext) a.veredicto = ext;
    }
});

const cachePath = path.join(__dirname, 'resultados_cache.json');
let cacheResultados = {};
if (fs.existsSync(cachePath)) {
    cacheResultados = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
}
processedAlerts.forEach(a => {
    if (!a.veredicto) {
        const key = `${a.partidoNorm}_${a.reglaNombre}`;
        if (cacheResultados[key]) a.veredicto = cacheResultados[key].veredicto;
    }
});

const pendientes = processedAlerts.filter(a => !a.veredicto);
console.log(`Alertas pendientes encontradas: ${pendientes.length}`);
pendientes.forEach((p, idx) => {
    console.log(`${idx + 1}. Fecha: ${p.date} | Partido: ${p.partido} | Liga: ${p.liga} | Regla: ${p.reglaNombre} | Gemini: ${p.geminiBet} | DeepSeek: ${p.deepseekBet}`);
});
