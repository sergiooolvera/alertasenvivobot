const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const os = require('os');
const { toAmericanOdd } = require('./utils');

const BROWSER_PATHS = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];

let cachedBrowserPath = null;

function getBrowserPath() {
    if (cachedBrowserPath && fs.existsSync(cachedBrowserPath)) {
        return cachedBrowserPath;
    }
    for (const bPath of BROWSER_PATHS) {
        if (fs.existsSync(bPath)) {
            cachedBrowserPath = bPath;
            return bPath;
        }
    }
    return null;
}

const TICKETS_DIR = path.join(__dirname, 'scratch', 'tickets');
if (!fs.existsSync(TICKETS_DIR)) {
    try {
        fs.mkdirSync(TICKETS_DIR, { recursive: true });
    } catch (e) {
        // Fallback a temp si no se puede crear
    }
}

/**
 * Genera el archivo HTML para renderizar el ticket estilo Caliente.
 */
function buildTicketHtml(data) {
    const {
        homeTeam,
        awayTeam,
        leagueName,
        elapsed,
        scoreHome,
        scoreAway,
        recommendation,
        oddVal,
        confidence,
        ruleName,
        stakeAmount = 500,
        isUpdate = false,
        statusText = 'ABIERTO'
    } = data;

    const decOdd = parseFloat(oddVal) || 1.60;
    const americanOdd = toAmericanOdd(decOdd);
    const totalReturn = (stakeAmount * decOdd).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const elapsedDisplay = typeof elapsed === 'number' ? `${elapsed}'` : (elapsed || 'En vivo');
    const headerTitle = `${homeTeam} vs. ${awayTeam}`;
    const statusLabel = isUpdate ? 'ACTUALIZADO' : statusText;
    const confVal = confidence ? String(confidence).replace('%', '') : '80';

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background-color: transparent;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    display: inline-block;
    padding: 12px;
  }
  .ticket-card {
    width: 440px;
    background: #ffffff;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
    border: 1px solid #e5e7eb;
  }
  .ticket-header {
    background: #5a626a;
    color: #ffffff;
    padding: 12px 18px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13.5px;
    font-weight: 600;
  }
  .ticket-header .match-title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 310px;
    display: flex;
    align-items: center;
    gap: 8px;
    letter-spacing: -0.2px;
  }
  .ticket-header .status {
    text-transform: uppercase;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.8px;
    color: #e5e7eb;
  }
  .ticket-body {
    padding: 20px 22px 16px 22px;
  }
  .selection-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 4px;
  }
  .selection-name {
    font-size: 18px;
    font-weight: 700;
    color: #111827;
    line-height: 1.3;
  }
  .selection-odds {
    font-size: 18px;
    font-weight: 700;
    color: #111827;
    letter-spacing: -0.5px;
    margin-left: 12px;
  }
  .market-name {
    font-size: 13px;
    color: #6b7280;
    margin-bottom: 4px;
  }
  .event-name {
    font-size: 14px;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 4px;
  }
  .match-time {
    font-size: 12.5px;
    color: #9ca3af;
    display: flex;
    justify-content: space-between;
  }
  .divider {
    height: 1px;
    background: #f3f4f6;
    margin: 18px 0 14px 0;
  }
  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    font-size: 14px;
    color: #6b7280;
  }
  .info-row .val {
    font-weight: 700;
    color: #111827;
  }
  .info-row.profit .val {
    color: #16a34a;
    font-size: 17px;
    font-weight: 800;
  }
  .ticket-footer {
    background: #0f172a;
    color: #cbd5e1;
    padding: 10px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.5px;
  }
</style>
</head>
<body>

<div class="ticket-card" id="ticket">
  <div class="ticket-header">
    <div class="match-title">
      <span>—</span>
      <span>${headerTitle}</span>
    </div>
    <div class="status">${statusLabel}</div>
  </div>

  <div class="ticket-body">
    <div class="selection-row">
      <div class="selection-name">${recommendation}</div>
      <div class="selection-odds">${americanOdd}</div>
    </div>
    <div class="market-name">${ruleName || 'Apuesta en Vivo'} · ${leagueName || 'Partido'}</div>
    <div class="event-name">${homeTeam} vs. ${awayTeam}</div>
    <div class="match-time">
      <span>Minuto ${elapsedDisplay} · En vivo</span>
      <span>${scoreHome ?? 0}:${scoreAway ?? 0}</span>
    </div>

    <div class="divider"></div>

    <div class="info-row">
      <span>Momios / Cuota</span>
      <span class="val">${americanOdd} (@${decOdd.toFixed(2)})</span>
    </div>
    <div class="info-row">
      <span>Apuesta total</span>
      <span class="val">$${stakeAmount.toFixed(2)}</span>
    </div>
    <div class="info-row profit">
      <span>Ganancia Total</span>
      <span class="val">$${totalReturn}</span>
    </div>
  </div>

  <div class="ticket-footer">
    <span>⚽ ALERTAS EN VIVO</span>
    <span style="color:#38bdf8;">CONF. ${confVal}%</span>
  </div>
</div>

</body>
</html>`;
}

/**
 * Renderiza el HTML a imagen PNG usando Chrome o Edge headless.
 * @param {Object} data 
 * @returns {Promise<string|null>} Ruta del archivo PNG generado o null si falla.
 */
async function generateBetTicketImage(data) {
    const browserPath = getBrowserPath();
    if (!browserPath) {
        console.warn('[ticketImageService] No se encontró Chrome ni Edge para generar el ticket en imagen.');
        return null;
    }

    const id = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const targetDir = fs.existsSync(TICKETS_DIR) ? TICKETS_DIR : os.tmpdir();
    const htmlPath = path.join(targetDir, `ticket_${id}.html`);
    const pngPath = path.join(targetDir, `ticket_${id}.png`);

    try {
        const html = buildTicketHtml(data);
        fs.writeFileSync(htmlPath, html, 'utf8');

        const args = [
            '--headless',
            '--disable-gpu',
            '--no-sandbox',
            '--window-size=465,380',
            '--hide-scrollbars',
            `--screenshot=${pngPath}`,
            `file:///${htmlPath.replace(/\\/g, '/')}`
        ];

        await new Promise((resolve, reject) => {
            execFile(browserPath, args, { timeout: 8000 }, (error) => {
                if (error) return reject(error);
                resolve();
            });
        });

        if (fs.existsSync(pngPath) && fs.statSync(pngPath).size > 1000) {
            // Eliminar archivo HTML temporal
            try { fs.unlinkSync(htmlPath); } catch (e) {}
            return pngPath;
        } else {
            console.warn('[ticketImageService] El screenshot no se generó o está vacío.');
            return null;
        }
    } catch (err) {
        console.error('[ticketImageService] Error generando imagen del ticket:', err.message);
        try { if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath); } catch (e) {}
        try { if (fs.existsSync(pngPath)) fs.unlinkSync(pngPath); } catch (e) {}
        return null;
    }
}

/**
 * Genera el caption limpio en formato Markdown para Telegram:
 * - Nombres de los equipos en texto limpio (SIN enlaces de Flashscore).
 * - Enlace único de Flashscore en la línea inferior.
 */
function buildTicketCaption(data) {
    const { homeTeam, awayTeam, leagueName, elapsed, scoreHome, scoreAway } = data;
    const matchSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(homeTeam + ' vs ' + awayTeam + ' Flashscore')}`;
    const elapsedDisplay = typeof elapsed === 'number' ? `${elapsed}'` : (elapsed || 'En vivo');
    const scoreDisplay = `${scoreHome ?? 0} - ${scoreAway ?? 0}`;

    let msg = `⚽ *${homeTeam} vs ${awayTeam}*\n`;
    if (leagueName) {
        msg += `🏆 *Liga:* ${leagueName}\n`;
    }
    msg += `⏱️ *Minuto:* ${elapsedDisplay}  |  📊 *Marcador:* ${scoreDisplay}\n`;
    msg += `🔍 *Flashscore:* [Ver Partido en Flashscore](${matchSearchUrl})`;

    return msg;
}

module.exports = {
    generateBetTicketImage,
    buildTicketCaption,
    buildTicketHtml
};
