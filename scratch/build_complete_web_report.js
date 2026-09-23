const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'full_dataset_calculated.json'), 'utf8'));

const { statsByRule, statsByDate, statsByModel, processedAlerts } = data;

// Ordenar reglas por total de alertas
const sortedRules = Object.values(statsByRule).sort((a,b) => b.totalAlerts - a.totalAlerts);

// Calcular acumulación de profit diario
let runningProfit = 0;
const dailyData = Object.keys(statsByDate).map(dateStr => {
    const s = statsByDate[dateStr];
    runningProfit += s.profit;
    const decided = s.green + s.red;
    const wr = decided > 0 ? ((s.green / decided) * 100).toFixed(1) : 0;
    return {
        date: dateStr,
        alerts: s.totalAlertas,
        resolved: s.withVeredicto,
        green: s.green,
        red: s.red,
        evitada: s.evitada,
        winrate: wr,
        dailyProfit: parseFloat(s.profit.toFixed(2)),
        cumProfit: parseFloat(runningProfit.toFixed(2))
    };
});

const totalAlertas = processedAlerts.length;
const totalResueltas = processedAlerts.filter(a => a.matchedVeredicto).length;
const totalPendientes = totalAlertas - totalResueltas;
const totalGreen = statsByModel.system.green;
const totalRed = statsByModel.system.red;
const totalProfit = statsByModel.system.profit;
const winrateGlobal = ((totalGreen / (totalGreen + totalRed)) * 100).toFixed(1);
const yieldGlobal = ((totalProfit / (totalGreen + totalRed)) * 100).toFixed(1);

const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reporte de Inteligencia y Rendimiento | Alertas en Vivo Bot</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root {
            --bg-body: #090d16;
            --bg-card: #111827;
            --bg-card-hover: #162033;
            --border: #1f2937;
            --border-highlight: #374151;
            --accent-green: #10b981;
            --accent-green-bg: rgba(16, 185, 129, 0.12);
            --accent-red: #ef4444;
            --accent-red-bg: rgba(239, 68, 68, 0.12);
            --accent-blue: #3b82f6;
            --accent-blue-bg: rgba(59, 130, 246, 0.12);
            --accent-amber: #f59e0b;
            --accent-amber-bg: rgba(245, 158, 11, 0.12);
            --accent-purple: #8b5cf6;
            --accent-purple-bg: rgba(139, 92, 246, 0.12);
            --text-main: #f9fafb;
            --text-muted: #9ca3af;
            --text-dim: #6b7280;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background-color: var(--bg-body);
            color: var(--text-main);
            padding: 24px;
            line-height: 1.5;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
        }

        /* Header */
        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 24px 0 32px 0;
            border-bottom: 1px solid var(--border);
            margin-bottom: 32px;
            flex-wrap: wrap;
            gap: 16px;
        }

        .header-title h1 {
            font-size: 28px;
            font-weight: 800;
            letter-spacing: -0.5px;
            display: flex;
            align-items: center;
            gap: 12px;
            color: #ffffff;
        }

        .header-title p {
            color: var(--text-muted);
            font-size: 14px;
            margin-top: 6px;
        }

        .badge-live {
            background: var(--accent-green-bg);
            color: var(--accent-green);
            padding: 6px 14px;
            border-radius: 9999px;
            font-size: 13px;
            font-weight: 700;
            border: 1px solid rgba(16, 185, 129, 0.3);
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }

        .pulse-dot {
            width: 8px;
            height: 8px;
            background-color: var(--accent-green);
            border-radius: 50%;
            box-shadow: 0 0 10px var(--accent-green);
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% { transform: scale(0.95); opacity: 0.8; }
            50% { transform: scale(1.3); opacity: 1; }
            100% { transform: scale(0.95); opacity: 0.8; }
        }

        /* KPI Cards Grid */
        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 16px;
            margin-bottom: 32px;
        }

        .kpi-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 20px;
            position: relative;
            overflow: hidden;
            transition: transform 0.2s ease, border-color 0.2s ease;
        }

        .kpi-card:hover {
            transform: translateY(-2px);
            border-color: var(--border-highlight);
        }

        .kpi-card::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 3px;
            background: var(--accent-blue);
        }

        .kpi-card.green::before { background: var(--accent-green); }
        .kpi-card.red::before { background: var(--accent-red); }
        .kpi-card.purple::before { background: var(--accent-purple); }
        .kpi-card.amber::before { background: var(--accent-amber); }

        .kpi-label {
            font-size: 12px;
            text-transform: uppercase;
            font-weight: 700;
            color: var(--text-dim);
            letter-spacing: 0.6px;
        }

        .kpi-value {
            font-size: 32px;
            font-weight: 800;
            margin: 8px 0 4px 0;
            font-family: 'JetBrains Mono', monospace;
            color: #ffffff;
        }

        .kpi-sub {
            font-size: 13px;
            color: var(--text-muted);
        }

        /* Section Layouts */
        .grid-2col {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            margin-bottom: 32px;
        }

        @media (max-width: 1024px) {
            .grid-2col { grid-template-columns: 1fr; }
        }

        .card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 32px;
        }

        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--border);
        }

        .card-title {
            font-size: 18px;
            font-weight: 700;
            color: #ffffff;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        /* Badges */
        .badge {
            display: inline-flex;
            align-items: center;
            padding: 3px 10px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 700;
            font-family: 'JetBrains Mono', monospace;
        }

        .badge-green { background: var(--accent-green-bg); color: var(--accent-green); border: 1px solid rgba(16, 185, 129, 0.3); }
        .badge-red { background: var(--accent-red-bg); color: var(--accent-red); border: 1px solid rgba(239, 68, 68, 0.3); }
        .badge-blue { background: var(--accent-blue-bg); color: var(--accent-blue); border: 1px solid rgba(59, 130, 246, 0.3); }
        .badge-amber { background: var(--accent-amber-bg); color: var(--accent-amber); border: 1px solid rgba(245, 158, 11, 0.3); }
        .badge-purple { background: var(--accent-purple-bg); color: var(--accent-purple); border: 1px solid rgba(139, 92, 246, 0.3); }

        /* Tables */
        .table-responsive {
            overflow-x: auto;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
            text-align: left;
        }

        th {
            background-color: rgba(255, 255, 255, 0.02);
            color: var(--text-dim);
            font-weight: 600;
            padding: 12px 14px;
            border-bottom: 1px solid var(--border);
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
        }

        td {
            padding: 14px;
            border-bottom: 1px solid var(--border);
            color: var(--text-main);
        }

        tr:hover td {
            background-color: var(--bg-card-hover);
        }

        .mono {
            font-family: 'JetBrains Mono', monospace;
        }

        /* Rules summary breakdown */
        .rule-bar-container {
            margin-bottom: 18px;
        }

        .rule-bar-header {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            margin-bottom: 6px;
            font-weight: 600;
        }

        .progress-track {
            height: 8px;
            background: #1f2937;
            border-radius: 4px;
            overflow: hidden;
            display: flex;
        }

        .progress-fill {
            height: 100%;
            border-radius: 4px;
        }

        /* Verdict styling */
        .verdict-tag {
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 700;
            font-size: 11px;
            letter-spacing: 0.5px;
        }
        .v-green { background: rgba(16, 185, 129, 0.2); color: #34d399; }
        .v-red { background: rgba(239, 68, 68, 0.2); color: #f87171; }
        .v-void { background: rgba(156, 163, 175, 0.2); color: #9ca3af; }

        /* Filter Controls */
        .filter-bar {
            display: flex;
            gap: 12px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }

        .search-input {
            background: #1f2937;
            border: 1px solid var(--border-highlight);
            color: #fff;
            padding: 10px 16px;
            border-radius: 8px;
            font-size: 14px;
            flex: 1;
            min-width: 250px;
        }

        .search-input:focus {
            outline: none;
            border-color: var(--accent-blue);
        }

        .select-filter {
            background: #1f2937;
            border: 1px solid var(--border-highlight);
            color: #fff;
            padding: 10px 16px;
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
        }

        .select-filter:focus {
            outline: none;
            border-color: var(--accent-blue);
        }

        /* Insight Callouts */
        .insight-box {
            padding: 18px;
            border-radius: 12px;
            margin-bottom: 20px;
            display: flex;
            align-items: flex-start;
            gap: 14px;
            font-size: 14px;
        }

        .insight-box.success {
            background: rgba(16, 185, 129, 0.08);
            border-left: 4px solid var(--accent-green);
        }

        .insight-box.warning {
            background: rgba(239, 68, 68, 0.08);
            border-left: 4px solid var(--accent-red);
        }

        .insight-box.info {
            background: rgba(59, 130, 246, 0.08);
            border-left: 4px solid var(--accent-blue);
        }

        .chart-box {
            position: relative;
            height: 320px;
            width: 100%;
        }
    </style>
</head>
<body>

<div class="container">
    <!-- Header -->
    <header>
        <div class="header-title">
            <h1>📊 Auditoría de Rendimiento & Inteligencia en Vivo</h1>
            <p>Análisis exhaustivo del canal de alertas | Período: 24 de Agosto de 2026 al 23 de Septiembre de 2026 (31 Días)</p>
        </div>
        <div class="badge-live">
            <span class="pulse-dot"></span>
            Base de Datos: 285 Alertas Auditadas
        </div>
    </header>

    <!-- KPI Highlights -->
    <div class="kpi-grid">
        <div class="kpi-card green">
            <div class="kpi-label">Winrate Global</div>
            <div class="kpi-value">${winrateGlobal}%</div>
            <div class="kpi-sub">${totalGreen} Verdes / ${totalRed} Rojas</div>
        </div>
        <div class="kpi-card green">
            <div class="kpi-label">Beneficio Neto Acumulado</div>
            <div class="kpi-value">+${totalProfit.toFixed(2)}u</div>
            <div class="kpi-sub">Rentabilidad plana de 1u por pick</div>
        </div>
        <div class="kpi-card purple">
            <div class="kpi-label">Yield Global (ROI)</div>
            <div class="kpi-value">+${yieldGlobal}%</div>
            <div class="kpi-sub">Sobre 270 apuestas resueltas</div>
        </div>
        <div class="kpi-card amber">
            <div class="kpi-label">Regla Dominante</div>
            <div class="kpi-value">46.3%</div>
            <div class="kpi-sub">Regla 7 (Tarjetas en Vivo)</div>
        </div>
        <div class="kpi-card blue">
            <div class="kpi-label">Volumen Total</div>
            <div class="kpi-value">${totalAlertas}</div>
            <div class="kpi-sub">270 Resueltas | 15 Pendientes</div>
        </div>
    </div>

    <!-- Comparativa de Modelos IA -->
    <div class="card">
        <div class="card-header">
            <div class="card-title">🤖 Veredicto Comparativo: Google Gemini vs DeepSeek</div>
            <span class="badge badge-purple">Análisis Dual de IA</span>
        </div>
        <div class="grid-2col" style="margin-bottom: 0;">
            <div style="background: rgba(139, 92, 246, 0.05); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 12px; padding: 20px;">
                <h3 style="color: #a78bfa; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
                    <span>♊ Google Gemini</span>
                    <span class="badge badge-green">81.0% Winrate</span>
                </h3>
                <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 16px;">
                    Gemini actúa con una selección de altísima precisión (picks conservadores, hándicaps asiáticos y líneas altas de tarjetas).
                </p>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; text-align: center;">
                    <div style="background: var(--bg-card); padding: 12px; border-radius: 8px;">
                        <div style="font-size: 11px; color: var(--text-dim);">ACIERTO</div>
                        <div style="font-size: 18px; font-weight: 700; color: var(--accent-green);">${statsByModel.gemini.green}W - ${statsByModel.gemini.red}L</div>
                    </div>
                    <div style="background: var(--bg-card); padding: 12px; border-radius: 8px;">
                        <div style="font-size: 11px; color: var(--text-dim);">PROFIT</div>
                        <div style="font-size: 18px; font-weight: 700; color: #a78bfa;">+${statsByModel.gemini.profit.toFixed(2)}u</div>
                    </div>
                    <div style="background: var(--bg-card); padding: 12px; border-radius: 8px;">
                        <div style="font-size: 11px; color: var(--text-dim);">YIELD</div>
                        <div style="font-size: 18px; font-weight: 700; color: #fff;">+33.3%</div>
                    </div>
                </div>
            </div>

            <div style="background: rgba(59, 130, 246, 0.05); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 12px; padding: 20px;">
                <h3 style="color: #60a5fa; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
                    <span>🐳 DeepSeek</span>
                    <span class="badge badge-blue">61.9% Winrate</span>
                </h3>
                <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 16px;">
                    DeepSeek es el motor de alta frecuencia del sistema. Emite pronósticos en el 99% de las alertas con volumen masivo.
                </p>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; text-align: center;">
                    <div style="background: var(--bg-card); padding: 12px; border-radius: 8px;">
                        <div style="font-size: 11px; color: var(--text-dim);">ACIERTO</div>
                        <div style="font-size: 18px; font-weight: 700; color: var(--accent-blue);">${statsByModel.deepseek.green}W - ${statsByModel.deepseek.red}L</div>
                    </div>
                    <div style="background: var(--bg-card); padding: 12px; border-radius: 8px;">
                        <div style="font-size: 11px; color: var(--text-dim);">PROFIT</div>
                        <div style="font-size: 18px; font-weight: 700; color: #60a5fa;">+${statsByModel.deepseek.profit.toFixed(2)}u</div>
                    </div>
                    <div style="background: var(--bg-card); padding: 12px; border-radius: 8px;">
                        <div style="font-size: 11px; color: var(--text-dim);">YIELD</div>
                        <div style="font-size: 18px; font-weight: 700; color: #fff;">+9.5%</div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Insights Clave de Rentabilidad -->
    <div class="grid-2col">
        <div class="insight-box success">
            <div style="font-size: 24px;">🚀</div>
            <div>
                <strong>Top Reglas Más Rentables (Generadoras de Capital):</strong>
                <ul style="margin-top: 6px; padding-left: 18px; font-size: 13px; line-height: 1.6;">
                    <li><strong>Regla 7 (Partido Caliente / Tarjetas):</strong> Generó <strong>+25.44 unidades</strong> (68.6% Winrate). Es el pilar de liquidez y mayor confianza de todo el bot.</li>
                    <li><strong>Regla 9 (Gol Inminente Global):</strong> Rendimiento récord con <strong>+12.69 unidades</strong> y <strong>73.7% Winrate</strong> (+33.4% Yield).</li>
                    <li><strong>Regla 8 (Favorito Domina HT):</strong> Sólida y consistente con <strong>+5.02 unidades</strong> y <strong>72.7% Winrate</strong>.</li>
                </ul>
            </div>
        </div>

        <div class="insight-box warning">
            <div style="font-size: 24px;">⚠️</div>
            <div>
                <strong>Reglas con Pérdidas (Fugas de Rendimiento a Ajustar):</strong>
                <ul style="margin-top: 6px; padding-left: 18px; font-size: 13px; line-height: 1.6;">
                    <li><strong>Regla 1 (Tarjeta Roja Estratégica):</strong> Dejó <strong>-5.03 unidades</strong> (51.1% Winrate). El mercado sobreajusta la desventaja y los equipos con 10 hombres suelen replegarse con eficacia.</li>
                    <li><strong>Regla 6 (Presión de Córneres):</strong> Dejó <strong>-4.85 unidades</strong> (42.1% Winrate). Alta varianza en minutos finales.</li>
                    <li><strong>Regla 5 (Remontada al Descanso):</strong> Dejó <strong>-2.40 unidades</strong> (33.3% Winrate). Intentar predecir giros completos de marcador genera pérdidas consistentes.</li>
                </ul>
            </div>
        </div>
    </div>

    <!-- Gráfica de Rentabilidad y Curva de Bankroll -->
    <div class="card">
        <div class="card-header">
            <div class="card-title">📈 Evolución del Rendimiento Diario y Curva de Capital (31 Días)</div>
            <span class="badge badge-green">Pico Máximo: +36.00u</span>
        </div>
        <div class="chart-box">
            <canvas id="profitChart"></canvas>
        </div>
    </div>

    <!-- Tabla Detallada por Regla -->
    <div class="card">
        <div class="card-header">
            <div class="card-title">📋 Rendimiento y Uso por Regla (¿Cuáles rinden y cuáles no?)</div>
            <span class="badge badge-blue">7 Reglas Analizadas</span>
        </div>
        <div class="table-responsive">
            <table>
                <thead>
                    <tr>
                        <th>Regla del Bot</th>
                        <th>Alertas Disparadas</th>
                        <th>% Uso</th>
                        <th>Veredictos</th>
                        <th>Greens</th>
                        <th>Reds</th>
                        <th>Winrate</th>
                        <th>Beneficio Neto</th>
                        <th>Yield</th>
                        <th>Diagnóstico</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedRules.map(r => {
                        const pctUso = ((r.totalAlertas / totalAlertas) * 100).toFixed(1);
                        const decided = r.systemGreen + r.systemRed;
                        const wr = decided > 0 ? ((r.systemGreen / decided) * 100).toFixed(1) : 0;
                        const yieldVal = decided > 0 ? ((r.systemProfit / decided) * 100).toFixed(1) : 0;
                        const isProfitable = r.systemProfit > 0;
                        const diagBadge = isProfitable 
                            ? '<span class="badge badge-green">🟢 Rentable</span>'
                            : (r.systemProfit === 0 ? '<span class="badge badge-amber">🟡 Neutro</span>' : '<span class="badge badge-red">🔴 En Pérdida</span>');
                        
                        return `
                        <tr>
                            <td><strong>${r.rule}</strong></td>
                            <td class="mono"><strong>${r.totalAlertas}</strong></td>
                            <td>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span class="mono">${pctUso}%</span>
                                    <div style="flex: 1; height: 6px; background: #1f2937; border-radius: 3px; max-width: 60px;">
                                        <div style="width: ${pctUso}%; height: 100%; background: var(--accent-blue); border-radius: 3px;"></div>
                                    </div>
                                </div>
                            </td>
                            <td class="mono">${r.withVeredicto}</td>
                            <td class="mono" style="color: var(--accent-green); font-weight: 700;">${r.systemGreen}</td>
                            <td class="mono" style="color: var(--accent-red); font-weight: 700;">${r.systemRed}</td>
                            <td class="mono" style="font-weight: 700; color: ${wr >= 60 ? 'var(--accent-green)' : (wr >= 50 ? 'var(--accent-amber)' : 'var(--accent-red)')};">${wr}%</td>
                            <td class="mono" style="font-weight: 800; color: ${isProfitable ? 'var(--accent-green)' : 'var(--accent-red)'};">
                                ${r.systemProfit > 0 ? '+' : ''}${r.systemProfit.toFixed(2)}u
                            </td>
                            <td class="mono" style="font-weight: 700; color: ${yieldVal > 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">
                                ${yieldVal > 0 ? '+' : ''}${yieldVal}%
                            </td>
                            <td>${diagBadge}</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    </div>

    <!-- Rendimiento por Día -->
    <div class="card">
        <div class="card-header">
            <div class="card-title">📅 Rendimiento y Veredictos Día por Día</div>
            <span class="badge badge-amber">31 Días de Auditoría</span>
        </div>
        <div class="table-responsive">
            <table>
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Alertas</th>
                        <th>Evaluadas</th>
                        <th>Greens (✅)</th>
                        <th>Reds (❌)</th>
                        <th>Winrate</th>
                        <th>Profit Diario</th>
                        <th>Profit Acumulado</th>
                        <th>Estatus del Día</th>
                    </tr>
                </thead>
                <tbody>
                    ${dailyData.map(d => {
                        const isWinDay = d.dailyProfit > 0;
                        const isZeroDay = d.dailyProfit === 0;
                        const statusBadge = isWinDay 
                            ? '<span class="badge badge-green">Ganador</span>'
                            : (isZeroDay ? '<span class="badge badge-blue">Tablas</span>' : '<span class="badge badge-red">Negativo</span>');
                        return `
                        <tr>
                            <td class="mono"><strong>${d.date}</strong></td>
                            <td class="mono">${d.alerts}</td>
                            <td class="mono">${d.resolved}</td>
                            <td class="mono" style="color: var(--accent-green); font-weight: 700;">${d.green}</td>
                            <td class="mono" style="color: var(--accent-red); font-weight: 700;">${d.red}</td>
                            <td class="mono" style="font-weight: 700;">${d.winrate}%</td>
                            <td class="mono" style="font-weight: 700; color: ${isWinDay ? 'var(--accent-green)' : (isZeroDay ? 'var(--text-dim)' : 'var(--accent-red)')};">
                                ${d.dailyProfit > 0 ? '+' : ''}${d.dailyProfit.toFixed(2)}u
                            </td>
                            <td class="mono" style="font-weight: 800; color: ${d.cumProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">
                                ${d.cumProfit > 0 ? '+' : ''}${d.cumProfit.toFixed(2)}u
                            </td>
                            <td>${statusBadge}</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    </div>

    <!-- Explorador Interactivo de Todas las Apuestas -->
    <div class="card">
        <div class="card-header">
            <div class="card-title">🔍 Explorador Detallado de Todas las Apuestas y Veredictos</div>
            <span class="badge badge-blue">${totalAlertas} Registros</span>
        </div>

        <div class="filter-bar">
            <input type="text" id="searchInput" class="search-input" placeholder="Buscar por equipo, liga o apuesta..." oninput="filterTable()">
            <select id="ruleSelect" class="select-filter" onchange="filterTable()">
                <option value="">Todas las Reglas</option>
                ${sortedRules.map(r => `<option value="${r.rule}">${r.rule}</option>`).join('')}
            </select>
            <select id="verdictSelect" class="select-filter" onchange="filterTable()">
                <option value="">Todos los Veredictos</option>
                <option value="GREEN">Solo Greens (✅)</option>
                <option value="RED">Solo Reds (❌)</option>
                <option value="PENDIENTE">Pendientes / Sin Resolver</option>
            </select>
        </div>

        <div class="table-responsive" style="max-height: 700px; overflow-y: auto;">
            <table id="betsTable">
                <thead>
                    <tr>
                        <th>Fecha / Hora</th>
                        <th>Regla</th>
                        <th>Partido / Liga</th>
                        <th>Min / Score</th>
                        <th>Apuesta DeepSeek</th>
                        <th>Apuesta Gemini</th>
                        <th>Resultado Real</th>
                        <th>Veredicto</th>
                        <th>P&L</th>
                    </tr>
                </thead>
                <tbody>
                    ${processedAlerts.map(a => {
                        const v = a.matchedVeredicto;
                        const outcome = v ? v.generalOutcome : 'PENDIENTE';
                        const scoreFinal = v && v.marcadorFinal ? v.marcadorFinal : (a.marcador || 'N/D');
                        const odd = a.momioSugerido || 1.80;
                        let pnlStr = '-';
                        let pnlColor = 'var(--text-dim)';

                        if (outcome === 'GREEN') {
                            pnlStr = `+${(odd - 1).toFixed(2)}u`;
                            pnlColor = 'var(--accent-green)';
                        } else if (outcome === 'RED') {
                            pnlStr = '-1.00u';
                            pnlColor = 'var(--accent-red)';
                        }

                        const vBadge = outcome === 'GREEN'
                            ? '<span class="verdict-tag v-green">GREEN ✅</span>'
                            : (outcome === 'RED' ? '<span class="verdict-tag v-red">RED ❌</span>' : '<span class="verdict-tag v-void">PENDIENTE ⏳</span>');

                        return `
                        <tr data-rule="${a.reglaNombre}" data-verdict="${outcome}">
                            <td class="mono" style="font-size: 12px; white-space: nowrap;">
                                <strong>${a.date}</strong><br>
                                <span style="color: var(--text-dim);">${a.time || ''}</span>
                            </td>
                            <td style="font-size: 13px;">
                                <span class="badge ${a.reglaNombre.includes('7') ? 'badge-amber' : (a.reglaNombre.includes('9') ? 'badge-green' : (a.reglaNombre.includes('1') ? 'badge-red' : 'badge-blue'))}">
                                    ${a.reglaNombre.split(':')[0]}
                                </span>
                            </td>
                            <td>
                                <strong>${a.partido}</strong><br>
                                <span style="color: var(--text-dim); font-size: 12px;">${a.liga}</span>
                            </td>
                            <td class="mono" style="font-size: 13px; white-space: nowrap;">
                                <span style="color: var(--accent-amber);">${a.minuto || '-'}</span><br>
                                <span style="font-weight: 700;">${scoreFinal}</span>
                            </td>
                            <td style="font-size: 13px;">
                                <div style="color: #60a5fa; font-weight: 600;">${a.deepseekBet !== 'N/A' ? a.deepseekBet : (v && v.deepseekBet ? v.deepseekBet : 'N/A')}</div>
                                ${a.deepseekConf > 0 ? `<span style="font-size: 11px; color: var(--text-dim);">Conf: ${a.deepseekConf}%</span>` : ''}
                            </td>
                            <td style="font-size: 13px;">
                                <div style="color: #c084fc; font-weight: 600;">${a.geminiBet !== 'N/A' ? a.geminiBet : (v && v.geminiBet ? v.geminiBet : 'N/A')}</div>
                                ${a.geminiConf > 0 ? `<span style="font-size: 11px; color: var(--text-dim);">Conf: ${a.geminiConf}%</span>` : ''}
                            </td>
                            <td style="font-size: 12px; color: var(--text-muted); max-width: 250px;">
                                ${v && v.detalle ? v.detalle : (a.matchedVeredicto && a.matchedVeredicto.geminiDetalle ? a.matchedVeredicto.geminiDetalle : 'En seguimiento')}
                            </td>
                            <td>${vBadge}</td>
                            <td class="mono" style="font-weight: 800; color: ${pnlColor}; white-space: nowrap;">
                                ${pnlStr}
                            </td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    </div>
</div>

<script>
    // Gráfica de Evolución
    const dailyLabels = ${JSON.stringify(dailyData.map(d => d.date))};
    const cumProfitData = ${JSON.stringify(dailyData.map(d => d.cumProfit))};
    const dailyProfitData = ${JSON.stringify(dailyData.map(d => d.dailyProfit))};

    const ctx = document.getElementById('profitChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: dailyLabels,
            datasets: [
                {
                    label: 'Capital Acumulado (Unidades)',
                    data: cumProfitData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3,
                    yAxisID: 'y'
                },
                {
                    label: 'P&L Diario (Unidades)',
                    data: dailyProfitData,
                    type: 'bar',
                    backgroundColor: dailyProfitData.map(v => v >= 0 ? 'rgba(59, 130, 246, 0.6)' : 'rgba(239, 68, 68, 0.6)'),
                    borderRadius: 4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    labels: { color: '#9ca3af', font: { family: 'Inter' } }
                },
                tooltip: {
                    backgroundColor: '#1f2937',
                    titleColor: '#fff',
                    bodyColor: '#e5e7eb',
                    borderColor: '#374151',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    grid: { color: '#1f2937' },
                    ticks: { color: '#9ca3af', font: { family: 'JetBrains Mono', size: 10 } }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: { color: '#1f2937' },
                    ticks: {
                        color: '#10b981',
                        font: { family: 'JetBrains Mono' },
                        callback: function(value) { return value + 'u'; }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: {
                        color: '#9ca3af',
                        font: { family: 'JetBrains Mono' },
                        callback: function(value) { return value + 'u'; }
                    }
                }
            }
        }
    });

    // Filtros de tabla
    function filterTable() {
        const query = document.getElementById('searchInput').value.toLowerCase();
        const selectedRule = document.getElementById('ruleSelect').value;
        const selectedVerdict = document.getElementById('verdictSelect').value;
        
        const rows = document.querySelectorAll('#betsTable tbody tr');
        rows.forEach(r => {
            const text = r.textContent.toLowerCase();
            const rule = r.getAttribute('data-rule');
            const verdict = r.getAttribute('data-verdict');

            let matchesQuery = !query || text.includes(query);
            let matchesRule = !selectedRule || rule === selectedRule;
            let matchesVerdict = !selectedVerdict || verdict === selectedVerdict;

            if (matchesQuery && matchesRule && matchesVerdict) {
                r.style.display = '';
            } else {
                r.style.display = 'none';
            }
        });
    }
</script>

</body>
</html>`;

fs.writeFileSync(path.join(__dirname, '..', 'reporte_messages.html'), html);
console.log('Reporte generado exitosamente en reporte_messages.html');
