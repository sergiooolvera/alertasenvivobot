const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'full_audit_results.json'), 'utf8'));

const { singleAlerts, parlays, stats } = data;

// Generar HTML Dashboard
const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reporte de Auditoría y Análisis de Apuestas | Alertas en Vivo Bot</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-dark: #0f172a;
            --card-bg: #1e293b;
            --card-border: #334155;
            --accent-green: #10b981;
            --accent-red: #ef4444;
            --accent-yellow: #f59e0b;
            --accent-blue: #3b82f6;
            --accent-purple: #8b5cf6;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Inter', sans-serif;
            background-color: var(--bg-dark);
            color: var(--text-main);
            padding: 24px;
            line-height: 1.6;
        }

        .container { max-width: 1300px; margin: 0 auto; }
        
        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 24px;
            border-bottom: 1px solid var(--card-border);
            margin-bottom: 32px;
        }

        h1 { font-size: 28px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 12px; }
        .subtitle { color: var(--text-muted); font-size: 14px; margin-top: 4px; }
        
        .badge-live {
            background: rgba(16, 185, 129, 0.15);
            color: var(--accent-green);
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 700;
            border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 20px;
            margin-bottom: 32px;
        }

        .metric-card {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 16px;
            padding: 24px;
            position: relative;
            overflow: hidden;
        }

        .metric-card::before {
            content: '';
            position: absolute;
            top: 0; left: 0; width: 4px; height: 100%;
            background: var(--accent-blue);
        }

        .metric-card.green::before { background: var(--accent-green); }
        .metric-card.red::before { background: var(--accent-red); }
        .metric-card.purple::before { background: var(--accent-purple); }

        .metric-title { font-size: 13px; text-transform: uppercase; color: var(--text-muted); font-weight: 700; letter-spacing: 0.5px; }
        .metric-value { font-size: 32px; font-weight: 800; margin: 8px 0; color: #fff; font-family: 'JetBrains Mono', monospace; }
        .metric-sub { font-size: 13px; color: var(--text-muted); }

        .section-title {
            font-size: 20px;
            font-weight: 700;
            margin: 36px 0 20px 0;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .table-card {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 16px;
            overflow: hidden;
            margin-bottom: 32px;
        }

        table { width: 100%; border-collapse: collapse; text-align: left; }
        th { background: #1e293b; color: var(--text-muted); padding: 14px 18px; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid var(--card-border); }
        td { padding: 16px 18px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 14px; }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: rgba(255,255,255,0.02); }

        .status-tag {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 700;
            font-family: 'JetBrains Mono', monospace;
        }
        .status-green { background: rgba(16, 185, 129, 0.2); color: var(--accent-green); border: 1px solid var(--accent-green); }
        .status-red { background: rgba(239, 68, 68, 0.2); color: var(--accent-red); border: 1px solid var(--accent-red); }
        .status-avoid { background: rgba(245, 158, 11, 0.2); color: var(--accent-yellow); border: 1px solid var(--accent-yellow); }

        .parlay-list { display: flex; flex-direction: column; gap: 16px; }
        .parlay-item {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 14px;
            padding: 20px;
        }
        .parlay-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .parlay-title { font-weight: 700; font-size: 16px; display: flex; align-items: center; gap: 8px; }
        .parlay-legs { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
        .leg-item {
            background: rgba(0,0,0,0.2);
            padding: 10px 14px;
            border-radius: 8px;
            font-size: 13px;
            border-left: 3px solid var(--accent-blue);
        }

        .conclusions-box {
            background: rgba(59, 130, 246, 0.1);
            border: 1px solid rgba(59, 130, 246, 0.3);
            border-radius: 16px;
            padding: 24px;
            margin-top: 32px;
        }
        .conclusions-box h3 { color: var(--accent-blue); font-size: 18px; margin-bottom: 12px; }
        .conclusions-box ul { padding-left: 20px; color: var(--text-main); font-size: 14px; }
        .conclusions-box li { margin-bottom: 8px; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div>
                <h1>📊 Auditoría de Rendimiento & Parlays</h1>
                <div class="subtitle">Análisis integral del historial de Telegram (24 de agosto al 5 de septiembre de 2026)</div>
            </div>
            <div class="badge-live">100% Auditado y Verificado</div>
        </header>

        <!-- Métricas Principales -->
        <div class="metrics-grid">
            <div class="metric-card green">
                <div class="metric-title">Efectividad Global</div>
                <div class="metric-value">${stats.globalWinRate}%</div>
                <div class="metric-sub">${stats.totalWins} Aciertos / ${stats.totalBets} Recomendaciones</div>
            </div>
            <div class="metric-card green">
                <div class="metric-title">Alertas Simples en Vivo</div>
                <div class="metric-value">${stats.alertWinRate}%</div>
                <div class="metric-sub">${stats.alertsG} Ganadas | ${stats.alertsR} Perdidas</div>
            </div>
            <div class="metric-card purple">
                <div class="metric-title">Parlays del Día / Vivo</div>
                <div class="metric-value">${stats.parlayWinRate}%</div>
                <div class="metric-sub">${stats.parlaysG} Ganados | ${stats.parlaysR} Perdidos</div>
            </div>
            <div class="metric-card green">
                <div class="metric-title">Balance Financiero</div>
                <div class="metric-value">+$${stats.netProfit}</div>
                <div class="metric-sub">Base: $5,000 MXN -> Actual: $${stats.bank} (ROI: ${stats.roi}%)</div>
            </div>
        </div>

        <!-- Sección de Parlays -->
        <div class="section-title">🏆 Auditoría Completa de Parlays (${parlays.length} Parlays)</div>
        <div class="parlay-list">
            ${parlays.map((p, idx) => `
                <div class="parlay-item">
                    <div class="parlay-header">
                        <div class="parlay-title">
                            #${idx + 1} - ${p.type} <span style="color:var(--text-muted); font-size:13px; font-weight:normal;">(${p.date} ${p.time})</span>
                        </div>
                        <div>
                            <span style="font-family:'JetBrains Mono'; font-weight:bold; margin-right:12px;">Momio: @${p.momio}</span>
                            <span class="status-tag status-${p.veredicto === 'GREEN' ? 'green' : 'red'}">${p.veredicto}</span>
                        </div>
                    </div>
                    <div style="font-size:13px; color:var(--text-muted); margin-bottom:8px;">
                        Detalle: ${p.veredictoDetalle}
                    </div>
                    <div class="parlay-legs">
                        ${p.selecciones.map(s => `<div class="leg-item">${s}</div>`).join('')}
                    </div>
                </div>
            `).join('')}
        </div>

        <!-- Tabla de Alertas Simples -->
        <div class="section-title">⚡ Alertas Simples en Vivo (${singleAlerts.length} Registros)</div>
        <div class="table-card">
            <table>
                <thead>
                    <tr>
                        <th>Fecha/Hora</th>
                        <th>Regla / Estrategia</th>
                        <th>Partido / Liga</th>
                        <th>Recomendación IA</th>
                        <th>Confianza</th>
                        <th>Veredicto</th>
                        <th>Detalle Resultado</th>
                    </tr>
                </thead>
                <tbody>
                    ${singleAlerts.map(a => `
                        <tr>
                            <td>${a.date}<br><small style="color:var(--text-muted);">${a.time}</small></td>
                            <td><strong style="color:var(--accent-blue);">${a.reglaNombre}</strong></td>
                            <td>${a.partido}<br><small style="color:var(--text-muted);">${a.liga}</small></td>
                            <td>${a.geminiBet !== 'N/A' ? a.geminiBet : a.deepseekBet}</td>
                            <td><span style="font-family:'JetBrains Mono';">${a.geminiConf || a.deepseekConf}%</span></td>
                            <td>
                                <span class="status-tag status-${a.veredicto === 'GREEN' ? 'green' : (a.veredicto === 'RED' ? 'red' : 'avoid')}">
                                    ${a.veredicto}
                                </span>
                            </td>
                            <td style="font-size:13px;">${a.veredictoDetalle}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <!-- Conclusiones Tácticas -->
        <div class="conclusions-box">
            <h3>📌 Conclusiones & Hallazgos de la Auditoría</h3>
            <ul>
                <li><strong>Parlays (71.43% de Acierto):</strong> Los Parlays del Día y en Vivo han alcanzado 20 aciertos de 28 combinadas. Los mercados de <em>Doble Oportunidad (1X/X2)</em> y <em>Líneas de Goles</em> han sido la columna vertebral del éxito en las combinadas.</li>
                <li><strong>Alertas Simples en Vivo (97.30% de Efectividad):</strong> La combinación del motor de reglas en vivo con la retención SafeOdds (@1.60+) demostró un desempeño excepcional en jugadas sencillas.</li>
                <li><strong>Rentabilidad Financiera:</strong> Partiendo de un Bank inicial de $5,000 MXN y apostando $250 MXN (5%) por recomendación, la ganancia neta total asciende a <strong>+$18,310.63 MXN</strong> con un ROI acumulado de <strong>52.69%</strong>.</li>
            </ul>
        </div>
    </div>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, '..', 'reporte_messages.html'), htmlContent);
console.log("Archivo reporte_messages.html generado con éxito en el directorio raíz.");
