const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'messages.html');
const content = fs.readFileSync(filePath, 'utf8');
const messageBlocks = content.split(/<div class="message /);

let currentDate = 'Desconocida';
const rawMessages = [];

messageBlocks.forEach((block, idx) => {
    if (idx === 0) return;
    if (block.startsWith('service')) {
        const dateMatch = block.match(/<div class="body details">\s*([^<]+)\s*<\/div>/);
        if (dateMatch) currentDate = dateMatch[1].trim();
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
    let text = textMatch[1].trim()
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?[^>]+(>|$)/g, '')
        .replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    rawMessages.push({ id, date: fullDate, time: timeStr, text });
});

function cleanMarkdownLinks(str) {
    if (!str) return '';
    return str.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1').replace(/[\[\]]/g, '').trim();
}

function normalizarEquipo(str) {
    if (!str) return '';
    return cleanMarkdownLinks(str)
        .replace(/flashscore/gi, '')
        .replace(/%20/g, ' ')
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

function normalizarPartido(str) {
    if (!str) return '';
    const clean = cleanMarkdownLinks(str)
        .replace(/flashscore/gi, '')
        .replace(/%20/g, ' ')
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    
    const parts = clean.split(/\s+vs\.?\s+|\s+-\s+/i);
    if (parts.length >= 2) {
        return normalizarEquipo(parts[0]) + 'vs' + normalizarEquipo(parts[1]);
    }
    return clean.replace(/[^a-z0-9]/g, '');
}

function normalizarNombreRegla(regla) {
    let r = (regla || '').toUpperCase();
    if (r.includes('REGLA 1') || r.includes('TARJETA ROJA') || r.includes('ROJA ESTRATÉGICA')) return 'Regla 1: Tarjeta Roja Estratégica';
    if (r.includes('REGLA 4') || r.includes('ASEDIO INTENSO') || r.includes('HUELE A GOL') || r.includes('LATE GOAL')) return 'Regla 4: Asedio Intenso (Huele a Gol)';
    if (r.includes('REGLA 5') || r.includes('REMONTADA POTENCIAL')) return 'Regla 5: Remontada Potencial al Descanso';
    if (r.includes('REGLA 6') || r.includes('CÓRNERES') || r.includes('CORNERES') || r.includes('PRESION DE CORNERES') || r.includes('LATE CORNERS')) return 'Regla 6: Presión de Córneres';
    if (r.includes('REGLA 7') || r.includes('PARTIDO CALIENTE') || r.includes('TARJETAS')) return 'Regla 7: Partido Caliente (Tarjetas)';
    if (r.includes('REGLA 8') || r.includes('FAVORITO DOMINA HT')) return 'Regla 8: Favorito Domina HT';
    if (r.includes('REGLA 9') || r.includes('GOL INMINENTE GLOBAL')) return 'Regla 9: Gol Inminente Global';
    if (r.includes('REGLA 3') || r.includes('SORPRESA TEMPRANERA')) return 'Regla 3: Sorpresa Tempranera';
    if (r.includes('BÉISBOL') || r.includes('BEISBOL')) return 'Béisbol Live';
    return r.trim() || 'Otras Reglas';
}

function categorizarTextoApuesta(str) {
    if (!str || str === 'N/A') return 'Otros Mercados';
    const s = str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    if (s.includes('evitar') || s.includes('no recomendada')) return 'Apuesta Evitada / Descartada';
    if (s.includes('ambos anotan') || s.includes('ambos marcan') || s.includes('btts') || s.includes('ambos equipos')) return 'Ambos Anotan (BTTS)';
    if (s.includes('over 2.5') || s.includes('mas de 2.5') || s.includes('> 2.5') || s.includes('+2.5') || s.includes('over 3.5') || s.includes('mas de 3.5') || s.includes('over 1.5') || s.includes('mas de 1.5') || s.includes('goles totales') || s.includes('linea de goles') || (s.includes('over') && !s.includes('tarjeta') && !s.includes('corner'))) return 'Línea de Goles (Over/Under)';
    if (s.includes('proximo gol') || s.includes('siguiente gol') || s.includes('primer gol') || s.includes('gol de')) return 'Próximo Gol / Gol en Vivo';
    if (s.includes('doble oportunidad') || s.includes('empate o') || s.includes('1x') || s.includes('x2') || s.includes('12')) return 'Doble Oportunidad (1X / X2)';
    if (s.includes('victoria') || s.includes('gana') || s.includes('ml') || s.includes('resultado final') || s.includes('ganador') || s.includes('apuesta sin empate') || s.includes('dnb') || s.includes('handicap')) return 'Victoria Directa (1X2 / ML / AH)';
    if (s.includes('tarjeta') || s.includes('tarjetas')) return 'Tarjetas Totales / Tarjetas en Vivo';
    if (s.includes('corner') || s.includes('corners') || s.includes('esquina')) return 'Córneres Totales / Saques de Esquina';
    if (s.includes('carrera') || s.includes('entrada') || s.includes('beisbol') || s.includes('mlb')) return 'Béisbol Live (Carreras / ML)';

    return 'Otros Mercados';
}

const veredictos = [];
const alerts = [];

rawMessages.forEach(msg => {
    const text = msg.text;
    if (text.includes('VEREDICTO POST-PARTIDO') || text.includes('VEREDICTO:')) {
        let generalOutcome = 'DESCONOCIDO';
        if (text.includes('GREEN') || text.includes('🟩')) generalOutcome = 'GREEN';
        else if (text.includes('RED') || text.includes('🟥')) generalOutcome = 'RED';
        else if (text.includes('APUESTA EVITADA') || text.includes('EVITADA')) generalOutcome = 'APUESTA EVITADA';
        else if (text.includes('VOID') || text.includes('ANULADA')) generalOutcome = 'VOID';

        let equipo1 = '';
        let equipo2 = '';
        let partido = 'Desconocido';
        let marcadorFinal = '';
        let reglaRaw = '';
        let detalle = '';
        let geminiOutcome = null;
        let deepseekOutcome = null;
        let geminiBet = '';
        let deepseekBet = '';
        let geminiDetalle = '';
        let deepseekDetalle = '';

        const lines = text.split('\n');
        lines.forEach(l => {
            if (l.includes('Regla:')) reglaRaw = l.replace(/.*Regla:\s*/i, '').trim();
            if (l.includes('⚽') || l.includes('⚾')) {
                const matchLine = l.replace(/[⚽⚾]\s*/g, '').trim();
                const m = matchLine.match(/^(.*?)\s+(\d{1,2})\s*-\s*(\d{1,2})\s+(.*)$/);
                if (m) {
                    equipo1 = m[1].trim();
                    marcadorFinal = `${m[2]} - ${m[3]}`;
                    equipo2 = m[4].trim();
                    partido = `${equipo1} vs ${equipo2}`;
                } else {
                    partido = matchLine;
                }
            }
            if (l.includes('Resultado:')) {
                detalle = l.replace(/.*Resultado:\s*/i, '').trim();
            }
        });

        const geminiIdx = text.indexOf('GEMINI');
        const deepseekIdx = text.indexOf('DEEPSEEK');

        if (geminiIdx !== -1) {
            const geminiSub = (deepseekIdx > geminiIdx) ? text.substring(geminiIdx, deepseekIdx) : text.substring(geminiIdx);
            if (geminiSub.includes('GREEN') || geminiSub.includes('🟩')) geminiOutcome = 'GREEN';
            else if (geminiSub.includes('RED') || geminiSub.includes('🟥')) geminiOutcome = 'RED';
            else if (geminiSub.includes('EVITADA')) geminiOutcome = 'APUESTA EVITADA';
            else if (geminiSub.includes('VOID')) geminiOutcome = 'VOID';
            
            const b = geminiSub.match(/Apuesta:\s*([^\n]+)/i);
            if (b) geminiBet = b[1].trim();
            const res = geminiSub.match(/Resultado:\s*([^\n]+)/i);
            if (res) geminiDetalle = res[1].trim();
        }

        if (deepseekIdx !== -1) {
            const deepseekSub = text.substring(deepseekIdx);
            if (deepseekSub.includes('GREEN') || deepseekSub.includes('🟩')) deepseekOutcome = 'GREEN';
            else if (deepseekSub.includes('RED') || deepseekSub.includes('🟥')) deepseekOutcome = 'RED';
            else if (deepseekSub.includes('EVITADA')) deepseekOutcome = 'APUESTA EVITADA';
            else if (deepseekSub.includes('VOID')) deepseekOutcome = 'VOID';

            const b = deepseekSub.match(/Apuesta:\s*([^\n]+)/i);
            if (b) deepseekBet = b[1].trim();
            const res = deepseekSub.match(/Resultado:\s*([^\n]+)/i);
            if (res) deepseekDetalle = res[1].trim();
        }

        if (!geminiOutcome && !deepseekOutcome) {
            if (text.includes('DEEPSEEK')) deepseekOutcome = generalOutcome;
            else if (text.includes('GEMINI')) geminiOutcome = generalOutcome;
            else {
                geminiOutcome = generalOutcome;
                deepseekOutcome = generalOutcome;
            }
        }

        veredictos.push({
            id: msg.id,
            date: msg.date,
            time: msg.time,
            equipo1,
            equipo2,
            partido,
            marcadorFinal,
            partidoNorm: normalizarPartido(partido),
            reglaRaw,
            reglaNombre: normalizarNombreRegla(reglaRaw),
            generalOutcome,
            geminiOutcome,
            deepseekOutcome,
            geminiBet,
            deepseekBet,
            geminiDetalle,
            deepseekDetalle,
            detalle,
            rawText: text
        });
    } else if (text.includes('REGLA') || text.includes('ANÁLISIS DE IA') || text.includes('GEMINI') || text.includes('DEEPSEEK') || text.includes('BÉISBOL')) {
        alerts.push(msg);
    }
});

const processedAlerts = [];
alerts.forEach(a => {
    const text = a.text;
    const reglaMatch = text.match(/(?:🔥|⏳|🟥|🟨|🟢|⚾|🚨|🏆|♟️|🎯|👑|⚡|🚀|🚩)?\s*(REGLA\s*\d+:\s*[^━\n]+)/i) || text.match(/(REGLA\s*\d+:[^\n]+)/i) || text.match(/(BÉISBOL[^\n]+)/i);
    const rawRegla = reglaMatch ? reglaMatch[1].trim() : 'REGLA GENERAL';
    const reglaNombre = normalizarNombreRegla(rawRegla);

    let liga = 'Desconocida';
    let partido = 'Desconocido';
    let minuto = '';
    let marcador = '';
    let momios = '';
    let momioSugerido = 1.80;

    const lines = text.split('\n');
    lines.forEach(l => {
        if (l.includes('Liga:')) liga = l.replace(/.*Liga:\s*/i, '').trim();
        if (l.includes('⚽') || l.includes('⚾')) partido = l.replace(/[⚽⚾]\s*/g, '').trim();
        if (l.includes('Minuto:')) minuto = l.replace(/.*Minuto:\s*/i, '').split('|')[0].trim();
        if (l.includes('Marcador:')) marcador = l.replace(/.*Marcador:\s*/i, '').trim();
        if (l.includes('Momios Iniciales:')) momios = l.replace(/.*Momios Iniciales:\s*/i, '').trim();
        if (l.includes('Momio Sugerido')) {
            const m = l.match(/@?([1-9]\.\d{2})/);
            if (m) momioSugerido = parseFloat(m[1]);
        }
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
        momioSugerido,
        geminiBet,
        geminiConf,
        geminiReason,
        geminiCategory: categorizarTextoApuesta(geminiBet),
        deepseekBet,
        deepseekConf,
        deepseekReason,
        deepseekCategory: categorizarTextoApuesta(deepseekBet),
        matchedVeredicto: null
    });
});

const usedVeredictoIds = new Set();

// Ronda 1: Coincidencia exacta de partidoNorm y reglaNombre
processedAlerts.forEach(al => {
    let match = veredictos.find(v => !usedVeredictoIds.has(v.id) && v.partidoNorm === al.partidoNorm && v.reglaNombre === al.reglaNombre);
    if (match) {
        usedVeredictoIds.add(match.id);
        al.matchedVeredicto = match;
    }
});

// Ronda 2: Coincidencia exacta de partidoNorm (cualquier regla)
processedAlerts.forEach(al => {
    if (al.matchedVeredicto) return;
    let match = veredictos.find(v => !usedVeredictoIds.has(v.id) && v.partidoNorm === al.partidoNorm);
    if (match) {
        usedVeredictoIds.add(match.id);
        al.matchedVeredicto = match;
    }
});

// Ronda 3: Coincidencia por subpartes de los dos equipos
processedAlerts.forEach(al => {
    if (al.matchedVeredicto) return;
    const pParts = al.partidoNorm.split('vs');
    if (pParts.length === 2 && pParts[0].length >= 3 && pParts[1].length >= 3) {
        let match = veredictos.find(v => {
            if (usedVeredictoIds.has(v.id)) return false;
            const vParts = v.partidoNorm.split('vs');
            if (vParts.length === 2) {
                const eq1Match = vParts[0].includes(pParts[0].substring(0, 4)) || pParts[0].includes(vParts[0].substring(0, 4));
                const eq2Match = vParts[1].includes(pParts[1].substring(0, 4)) || pParts[1].includes(vParts[1].substring(0, 4));
                return eq1Match && eq2Match;
            }
            return false;
        });
        if (match) {
            usedVeredictoIds.add(match.id);
            al.matchedVeredicto = match;
        }
    }
});

// Ronda 4: Emparejar veredictos restantes por coincidencia parcial de texto crudo
processedAlerts.forEach(al => {
    if (al.matchedVeredicto) return;
    if (al.partido && al.partido !== 'Desconocido') {
        const eq1Clean = normalizarEquipo(al.partido.split(/vs/i)[0]);
        let match = veredictos.find(v => {
            if (usedVeredictoIds.has(v.id)) return false;
            if (eq1Clean.length >= 5 && v.partidoNorm.includes(eq1Clean)) return true;
            return false;
        });
        if (match) {
            usedVeredictoIds.add(match.id);
            al.matchedVeredicto = match;
        }
    }
});

console.log(`Alertas totales: ${processedAlerts.length}`);
console.log(`Alertas emparejadas con veredicto: ${processedAlerts.filter(a => a.matchedVeredicto).length}`);
console.log(`Veredictos sin alerta asignada: ${veredictos.length - usedVeredictoIds.size}`);
console.log(`Alertas sin veredicto asignado: ${processedAlerts.filter(a => !a.matchedVeredicto).length}`);

// Guardar lista actualizada
fs.writeFileSync('scratch/emparejamiento_resumen.json', JSON.stringify({
    totalAlertas: processedAlerts.length,
    totalVeredictos: veredictos.length,
    emparejadas: processedAlerts.filter(a => a.matchedVeredicto).length,
    noEmparejadasAlertas: processedAlerts.filter(a => !a.matchedVeredicto).map(a => ({ id: a.id, date: a.date, partido: a.partido, regla: a.reglaNombre })),
    noEmparejadasVeredictos: veredictos.filter(v => !usedVeredictoIds.has(v.id)).map(v => ({ id: v.id, date: v.date, partido: v.partido, regla: v.reglaNombre, outcome: v.generalOutcome }))
}, null, 2));
