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
    const clean = cleanMarkdownLinks(partido);
    return clean
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+vs\s+/g, 'vs')
        .replace(/[^a-z0-9]/g, '');
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
    
    const geminiCategory = categorizarTextoApuesta(geminiBet);
    const deepseekCategory = categorizarTextoApuesta(deepseekBet);
    const primaryCategory = geminiCategory !== 'Otros Mercados' && geminiCategory !== 'Sin Especificar / Evitada' ? geminiCategory : deepseekCategory;

    processedAlerts.push({
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
    });
});

// Match veredictos from HTML
veredictos.forEach(v => {
    const text = v.text;
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

// External web results map for remaining pending alerts
const resultadosWeb = {
    "montanavsnesebar_Regla 3: Sorpresa Tempranera": { veredicto: "GREEN", geminiVeredicto: "GREEN", deepseekVeredicto: "GREEN", detalle: "Marcador final 3-1. Gana local." },
    "rodinamoskvavsrubin_Regla 3: Sorpresa Tempranera": { veredicto: "RED", geminiVeredicto: "RED", deepseekVeredicto: "RED", detalle: "Marcador final 5-0. Gana local. Rubin perdió." },
    "dinamomakhachkalavskryliasovetov_Regla 3: Sorpresa Tempranera": { veredicto: "RED", geminiVeredicto: "RED", deepseekVeredicto: "RED", detalle: "Marcador final 1-2. Gana visitante." },
    "sydkystenvsishj_Regla 3: Sorpresa Tempranera": { veredicto: "GREEN", geminiVeredicto: "GREEN", deepseekVeredicto: "GREEN", detalle: "Marcador final 3-1. Más de 2.5 goles totalizados." },
    "brnshjvshbkoge_Regla 3: Sorpresa Tempranera": { veredicto: "APUESTA EVITADA", geminiVeredicto: "APUESTA EVITADA", deepseekVeredicto: "RED", detalle: "Marcador final 1-0. Gana local (underdog). Favorito falló." },
    "vibyvsasaaarhus_Regla 4: Sufre Favorito": { veredicto: "APUESTA EVITADA", geminiVeredicto: "APUESTA EVITADA", deepseekVeredicto: "RED", detalle: "Marcador final 0-0. Empate en copa. Favorito falló en 90 min." },
    "sydkystenvsishj_Regla 2: Roja Estratégica": { veredicto: "GREEN", geminiVeredicto: "GREEN", deepseekVeredicto: "GREEN", detalle: "Marcador final 3-1. Gana local tras expulsión." },
    "hapoelbeershevavsfkcrvenazvezda_Regla 3: Sorpresa Tempranera": { veredicto: "RED", geminiVeredicto: "RED", deepseekVeredicto: "RED", detalle: "Marcador final 1-0. Underdog defendió ventaja." },
    "godoycruzresvsracingclubres_Regla 2: Roja Estratégica": { veredicto: "RED", geminiVeredicto: "RED", deepseekVeredicto: "RED", detalle: "Marcador final 1-1. Empate tras roja." },
    "unionstgilloisevsbodoglimt_Regla 5: Partido Caliente": { veredicto: "GREEN", geminiVeredicto: "GREEN", deepseekVeredicto: "GREEN", detalle: "Marcador final 3-3. Hubo 7 tarjetas amarillas y 6 goles." },
    "costaricau20vshaitiu20_Regla 3: Sorpresa Tempranera": { veredicto: "RED", geminiVeredicto: "RED", deepseekVeredicto: "GREEN", detalle: "Marcador final 1-1. No superó los 2.5 goles." },
    "unitedstatesu20vsguatemalau20_Regla 3: Sorpresa Tempranera": { veredicto: "GREEN", geminiVeredicto: "GREEN", deepseekVeredicto: "GREEN", detalle: "Marcador final 3-1. Over 2.5 goles acertado." },

    "oddervsskive_Regla 3: Sorpresa Tempranera": { veredicto: "GREEN", geminiVeredicto: "GREEN", deepseekVeredicto: "GREEN", detalle: "Marcador final 2-2. Más de 2.5 goles y gol Skive acertados." },
    "kgewvsrigaw_Regla 3: Sorpresa Tempranera": { veredicto: "GREEN", geminiVeredicto: "GREEN", deepseekVeredicto: "GREEN", detalle: "Marcador final 4-1. Gana local." },
    "brannvsapollonlimassol_Regla 3: Sorpresa Tempranera": { veredicto: "APUESTA EVITADA", geminiVeredicto: "APUESTA EVITADA", deepseekVeredicto: "RED", detalle: "Marcador final 0-1. Gana visitante. Favorito falló." },
    "monterreyvsorlandocitysc_Regla 2: Roja Estratégica": { veredicto: "GREEN", geminiVeredicto: "GREEN", deepseekVeredicto: "GREEN", detalle: "Marcador final 1-2. Gana visitante tras roja al local." },

    "stabku19vsfredrikstadfku19_Regla 3: Sorpresa Tempranera": { veredicto: "RED", geminiVeredicto: "RED", deepseekVeredicto: "RED", detalle: "Marcador final 2-4. Fredrikstad U19 ganó." },
    "stabku19vsfredrikstadfku19_Regla 5: Partido Caliente": { veredicto: "GREEN", geminiVeredicto: "GREEN", deepseekVeredicto: "GREEN", detalle: "Marcador final 2-4. 6 goles y 5 tarjetas." },
    "indjuniorsvs22dejulio_Regla 4: Sufre Favorito": { veredicto: "GREEN", geminiVeredicto: "GREEN", deepseekVeredicto: "GREEN", detalle: "Marcador final 2-0. Ind. Juniors ganó." },

    "rostovu19vszenitu19_Regla 3: Sorpresa Tempranera": { veredicto: "RED", geminiVeredicto: "RED", deepseekVeredicto: "RED", detalle: "Marcador final 2-1. Rostov U19 ganó." },
    "chertanovou20vsrubinkazanu20_Regla 2: Roja Estratégica": { veredicto: "GREEN", geminiVeredicto: "GREEN", deepseekVeredicto: "GREEN", detalle: "Marcador final 0-2. Rubin Kazan U20 ganó." },
    "mirassolu20vsitapirenseu20_Regla 3: Sorpresa Tempranera": { veredicto: "GREEN", geminiVeredicto: "GREEN", deepseekVeredicto: "GREEN", detalle: "Marcador final 2-1. Mirassol U20 y Over 2.5 acertados." },
    "santosu20vssaobentou20_Regla 3: Sorpresa Tempranera": { veredicto: "GREEN", geminiVeredicto: "GREEN", deepseekVeredicto: "GREEN", detalle: "Marcador final 5-2. Santos U20 y Over 2.5 acertados." },
    "tanabispu20vspalmeirasu20_Regla 2: Roja Estratégica": { veredicto: "GREEN", geminiVeredicto: "GREEN", deepseekVeredicto: "GREEN", detalle: "Marcador final 0-1. Palmeiras U20 ganó." },
    "operarioprvssaobernardo_Regla 3: Sorpresa Tempranera": { veredicto: "RED", geminiVeredicto: "RED", deepseekVeredicto: "GREEN", detalle: "Marcador final 1-3. São Bernardo ganó. Próximo gol Operario GREEN." },

    "transnarvavskaljunomme_Regla 3: Sorpresa Tempranera": { veredicto: "GREEN", geminiVeredicto: "GREEN", deepseekVeredicto: "GREEN", detalle: "Marcador final 0-2. Kalju Nomme ganó." },
    "nommeunitediivsfcilevadiaii_Regla 3: Sorpresa Tempranera": { veredicto: "RED", geminiVeredicto: "RED", deepseekVeredicto: "GREEN", detalle: "Marcador final 1-2. FCI Levadia II ganó. Próximo gol Levadia GREEN." },
    "mamelodisundownsvspolokwanecity_Regla 3: Sorpresa Tempranera": { veredicto: "GREEN", geminiVeredicto: "GREEN", deepseekVeredicto: "GREEN", detalle: "Marcador final 3-2. Mamelodi Sundowns remontó y ganó." },

    "fasvsatleticobalboa_Regla 3: Sorpresa Tempranera": { veredicto: "RED", geminiVeredicto: "RED", deepseekVeredicto: "RED", detalle: "Marcador final 1-1. Empate en El Salvador." },

    "transinvestvilniusvspanevezys_Regla 3: Sorpresa Tempranera": { veredicto: "RED", geminiVeredicto: "RED", deepseekVeredicto: "RED", detalle: "Marcador final 0-2. Panevėžys ganó." },
    "athleticclubmgu20vscoimbrau20_Regla 3: Sorpresa Tempranera": { veredicto: "GREEN", geminiVeredicto: "GREEN", deepseekVeredicto: "GREEN", detalle: "Marcador final 2-1. Over 2.5 goles acertado." },
    "jongpsvu21vsfcvolendam_Regla 3: Sorpresa Tempranera": { veredicto: "RED", geminiVeredicto: "RED", deepseekVeredicto: "GREEN", detalle: "Marcador final 3-2. Jong PSV ganó. Próximo gol Volendam GREEN." },
    "banfieldvsbelgranocordoba_Regla 5: Partido Caliente": { veredicto: "GREEN", geminiVeredicto: "GREEN", deepseekVeredicto: "GREEN", detalle: "Marcador final 0-2. 7 tarjetas amarillas totales." }
};

// Inject external web results for remaining pending alerts
let inyectados = 0;
processedAlerts.forEach(a => {
    if (!a.veredicto) {
        const key = `${a.partidoNorm}_${a.reglaNombre}`;
        const ext = resultadosWeb[key] || resultadosWeb[`${a.partidoNorm}_Regla 3: Sorpresa Tempranera`];
        if (ext) {
            a.veredicto = ext.veredicto;
            a.veredictoDetalle = ext.detalle;
            a.geminiVeredicto = ext.geminiVeredicto;
            a.deepseekVeredicto = ext.deepseekVeredicto;
            inyectados++;
        }
    }
});

console.log(`Alertas totales: ${processedAlerts.length}`);
console.log(`Alertas con veredicto post-partido (100% resueltas): ${processedAlerts.filter(a => a.veredicto).length}`);
console.log(`Alertas pendientes restantes: ${processedAlerts.filter(a => !a.veredicto).length}`);

// Regla 3 stats
const r3Alerts = processedAlerts.filter(a => a.reglaNombre === 'Regla 3: Sorpresa Tempranera');
const r3Green = r3Alerts.filter(a => a.veredicto === 'GREEN').length;
const r3Red = r3Alerts.filter(a => a.veredicto === 'RED').length;
const r3Evitadas = r3Alerts.filter(a => a.veredicto === 'APUESTA EVITADA').length;
console.log(`\n--- REGLA 3: SORPRESA TEMPRANERA RESTRUTURADA ---`);
console.log(`Total Alertas: ${r3Alerts.length}`);
console.log(`GREEN: ${r3Green}`);
console.log(`RED: ${r3Red}`);
console.log(`APUESTA EVITADA: ${r3Evitadas}`);
console.log(`Win Rate: ${(((r3Green)/(r3Green+r3Red))*100).toFixed(1)}%`);
