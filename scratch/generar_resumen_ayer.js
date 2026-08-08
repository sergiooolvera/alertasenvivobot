const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'yesterday_analysis.json');
const analysisData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Auditoría y Resumen de Alertas - 07 de Agosto de 2026</title>

    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet">
    
    <!-- Lucide Icons -->
    <script src="https://unpkg.com/lucide@latest"></script>

    <style>
        :root {
            --bg-main: #0b0f19;
            --bg-card: #151c2c;
            --bg-card-hover: #1e293b;
            --border-color: rgba(255, 255, 255, 0.08);
            --border-glow: rgba(59, 130, 246, 0.3);
            
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --text-muted: #64748b;
            
            --accent-green: #10b981;
            --accent-green-bg: rgba(16, 185, 129, 0.12);
            --accent-red: #ef4444;
            --accent-red-bg: rgba(239, 68, 68, 0.12);
            --accent-yellow: #f59e0b;
            --accent-yellow-bg: rgba(245, 158, 11, 0.12);
            
            --gemini-blue: #3b82f6;
            --gemini-bg: rgba(59, 130, 246, 0.15);
            --deepseek-purple: #8b5cf6;
            --deepseek-bg: rgba(139, 92, 246, 0.15);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Inter', sans-serif;
            background-color: var(--bg-main);
            color: var(--text-primary);
            min-height: 100vh;
            line-height: 1.5;
            padding-bottom: 60px;
            background-image: 
                radial-gradient(circle at 15% 15%, rgba(59, 130, 246, 0.05) 0%, transparent 40%),
                radial-gradient(circle at 85% 85%, rgba(139, 92, 246, 0.05) 0%, transparent 40%);
        }

        header {
            background: rgba(21, 28, 44, 0.8);
            backdrop-filter: blur(12px);
            border-bottom: 1px solid var(--border-color);
            position: sticky;
            top: 0;
            z-index: 100;
            padding: 18px 24px;
        }

        .header-container {
            max-width: 1300px;
            margin: 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 16px;
        }

        .logo-title {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .logo-icon {
            width: 42px;
            height: 42px;
            background: linear-gradient(135deg, var(--gemini-blue), var(--deepseek-purple));
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);
        }

        .logo-title h1 {
            font-family: 'Outfit', sans-serif;
            font-size: 1.5rem;
            font-weight: 700;
            background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .date-badge {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 0.85rem;
            color: var(--text-secondary);
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .container {
            max-width: 1300px;
            margin: 32px auto;
            padding: 0 24px;
        }

        /* KPI Cards */
        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 20px;
            margin-bottom: 32px;
        }

        .kpi-card {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 20px;
            position: relative;
            overflow: hidden;
            transition: transform 0.2s ease, border-color 0.2s ease;
        }

        .kpi-card:hover {
            transform: translateY(-3px);
            border-color: rgba(255, 255, 255, 0.2);
        }

        .kpi-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 3px;
            background: linear-gradient(90deg, transparent, var(--card-accent, var(--gemini-blue)), transparent);
        }

        .kpi-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            color: var(--text-secondary);
            font-size: 0.85rem;
            font-weight: 500;
        }

        .kpi-value {
            font-family: 'Outfit', sans-serif;
            font-size: 2.1rem;
            font-weight: 800;
            color: var(--text-primary);
            line-height: 1.1;
        }

        .kpi-subtext {
            margin-top: 8px;
            font-size: 0.8rem;
            color: var(--text-muted);
        }

        /* IA Comparison Section */
        .ai-comparison-section {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 20px;
            padding: 24px;
            margin-bottom: 36px;
        }

        .section-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 20px;
        }

        .section-title {
            font-family: 'Outfit', sans-serif;
            font-size: 1.25rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .ai-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 24px;
        }

        .ai-box {
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .ai-box.gemini {
            border-left: 4px solid var(--gemini-blue);
        }

        .ai-box.deepseek {
            border-left: 4px solid var(--deepseek-purple);
        }

        .ai-name {
            font-weight: 700;
            font-size: 1.1rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .progress-bar-bg {
            background: rgba(255, 255, 255, 0.08);
            height: 10px;
            border-radius: 5px;
            overflow: hidden;
            position: relative;
        }

        .progress-bar-fill {
            height: 100%;
            border-radius: 5px;
            transition: width 1s ease-in-out;
        }

        .ai-stats-row {
            display: flex;
            justify-content: space-between;
            font-size: 0.88rem;
            color: var(--text-secondary);
            border-top: 1px solid var(--border-color);
            padding-top: 12px;
        }

        .stat-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 8px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 0.8rem;
        }

        .stat-badge.green { background: var(--accent-green-bg); color: var(--accent-green); }
        .stat-badge.red { background: var(--accent-red-bg); color: var(--accent-red); }
        .stat-badge.yellow { background: var(--accent-yellow-bg); color: var(--accent-yellow); }

        /* Controls & Filter Bar */
        .controls-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 16px;
            margin-bottom: 24px;
        }

        .tabs {
            display: flex;
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            padding: 4px;
            border-radius: 12px;
            gap: 4px;
        }

        .tab-btn {
            background: transparent;
            border: none;
            color: var(--text-secondary);
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 0.88rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .tab-btn.active {
            background: var(--gemini-blue);
            color: white;
            box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
        }

        .search-box {
            position: relative;
            min-width: 280px;
        }

        .search-input {
            width: 100%;
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            padding: 10px 16px 10px 40px;
            border-radius: 12px;
            color: var(--text-primary);
            font-size: 0.9rem;
            outline: none;
            transition: border-color 0.2s ease;
        }

        .search-input:focus {
            border-color: var(--gemini-blue);
        }

        .search-icon {
            position: absolute;
            left: 14px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted);
            width: 18px;
            height: 18px;
        }

        /* Match Cards Feed */
        .feed-grid {
            display: flex;
            flex-direction: column;
            gap: 18px;
        }

        .match-card {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 20px;
            transition: all 0.2s ease;
        }

        .match-card:hover {
            border-color: rgba(255, 255, 255, 0.15);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
        }

        .match-card-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            flex-wrap: wrap;
            gap: 12px;
            margin-bottom: 14px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--border-color);
        }

        .rule-badge {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-color);
            padding: 4px 10px;
            border-radius: 8px;
            font-size: 0.8rem;
            font-weight: 600;
            color: #e2e8f0;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }

        .verdict-tag {
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 700;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .verdict-tag.GREEN {
            background: var(--accent-green-bg);
            color: var(--accent-green);
            border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .verdict-tag.RED {
            background: var(--accent-red-bg);
            color: var(--accent-red);
            border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .verdict-tag.EVITADA {
            background: var(--accent-yellow-bg);
            color: var(--accent-yellow);
            border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .match-main-info {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            align-items: center;
            gap: 16px;
            margin-bottom: 18px;
        }

        .team-name {
            font-family: 'Outfit', sans-serif;
            font-size: 1.15rem;
            font-weight: 700;
            color: var(--text-primary);
        }

        .team-name.home { text-align: right; }
        .team-name.away { text-align: left; }

        .versus-box {
            background: rgba(15, 23, 42, 0.8);
            border: 1px solid var(--border-color);
            padding: 8px 16px;
            border-radius: 12px;
            text-align: center;
        }

        .score-live {
            font-family: 'Outfit', sans-serif;
            font-size: 1.25rem;
            font-weight: 800;
            color: var(--text-primary);
        }

        .minute-tag {
            font-size: 0.75rem;
            color: var(--text-muted);
            margin-top: 2px;
        }

        .predictions-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 14px;
            margin-bottom: 14px;
        }

        .pred-card {
            background: rgba(15, 23, 42, 0.5);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 12px 14px;
        }

        .pred-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.8rem;
            color: var(--text-secondary);
            margin-bottom: 6px;
            font-weight: 600;
        }

        .pred-bet {
            font-size: 0.92rem;
            font-weight: 600;
            color: var(--text-primary);
        }

        .match-footer-detail {
            background: rgba(255, 255, 255, 0.02);
            border-radius: 10px;
            padding: 10px 14px;
            font-size: 0.85rem;
            color: var(--text-secondary);
            border-left: 3px solid var(--border-color);
        }

        .match-footer-detail.GREEN { border-left-color: var(--accent-green); }
        .match-footer-detail.RED { border-left-color: var(--accent-red); }

        /* Parlay Section */
        .parlay-box {
            background: linear-gradient(135deg, rgba(21, 28, 44, 0.9), rgba(15, 23, 42, 0.9));
            border: 1px solid rgba(245, 158, 11, 0.3);
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 20px;
        }

        .parlay-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 14px;
        }

        .parlay-title {
            font-family: 'Outfit', sans-serif;
            font-size: 1.1rem;
            font-weight: 700;
            color: var(--accent-yellow);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .parlay-content {
            font-size: 0.9rem;
            color: var(--text-secondary);
            white-space: pre-line;
            line-height: 1.6;
        }

        .empty-state {
            text-align: center;
            padding: 48px;
            color: var(--text-muted);
            background: var(--bg-card);
            border-radius: 16px;
            border: 1px dashed var(--border-color);
        }

        @media (max-width: 768px) {
            .match-main-info {
                grid-template-columns: 1fr;
                text-align: center;
                gap: 8px;
            }
            .team-name.home, .team-name.away { text-align: center; }
            .controls-bar { flex-direction: column; align-items: stretch; }
            .search-box { min-width: 100%; }
        }
    </style>
</head>
<body>

    <header>
        <div class="header-container">
            <div class="logo-title">
                <div class="logo-icon">
                    <i data-lucide="shield-check"></i>
                </div>
                <div>
                    <h1>Auditoría de Alertas en Vivo</h1>
                    <p style="font-size: 0.8rem; color: var(--text-muted);">Dashboard interactivo de rendimiento diario</p>
                </div>
            </div>
            <div class="date-badge">
                <i data-lucide="calendar" style="width: 14px; height: 14px;"></i>
                Jornada: <strong>07 de Agosto de 2026</strong>
            </div>
        </div>
    </header>

    <div class="container">

        <!-- KPI Grid -->
        <div class="kpi-grid">
            <div class="kpi-card" style="--card-accent: var(--gemini-blue);">
                <div class="kpi-header">
                    <span>Alertas Emitidas</span>
                    <i data-lucide="bell" style="width: 18px; height: 18px;"></i>
                </div>
                <div class="kpi-value">${analysisData.totalAlertas}</div>
                <div class="kpi-subtext">100% veredictos coincidentes</div>
            </div>

            <div class="kpi-card" style="--card-accent: var(--accent-green);">
                <div class="kpi-header">
                    <span>Aciertos (GREEN)</span>
                    <i data-lucide="trending-up" style="width: 18px; height: 18px; color: var(--accent-green);"></i>
                </div>
                <div class="kpi-value" style="color: var(--accent-green);">${analysisData.greenCount}</div>
                <div class="kpi-subtext">50.0% de efectividad global</div>
            </div>

            <div class="kpi-card" style="--card-accent: var(--accent-red);">
                <div class="kpi-header">
                    <span>Fallos (RED)</span>
                    <i data-lucide="trending-down" style="width: 18px; height: 18px; color: var(--accent-red);"></i>
                </div>
                <div class="kpi-value" style="color: var(--accent-red);">${analysisData.redCount}</div>
                <div class="kpi-subtext">50.0% tasa de fallo</div>
            </div>

            <div class="kpi-card" style="--card-accent: var(--accent-yellow);">
                <div class="kpi-header">
                    <span>Parlays Generados</span>
                    <i data-lucide="layers" style="width: 18px; height: 18px; color: var(--accent-yellow);"></i>
                </div>
                <div class="kpi-value" style="color: var(--accent-yellow);">${analysisData.parlays ? analysisData.parlays.length : 0}</div>
                <div class="kpi-subtext">Combinadas pre-partido</div>
            </div>
        </div>

        <!-- AI Comparison Section -->
        <div class="ai-comparison-section">
            <div class="section-header">
                <div class="section-title">
                    <i data-lucide="cpu" style="color: var(--gemini-blue);"></i>
                    Comparativa de Inteligencia Artificial
                </div>
                <span style="font-size: 0.82rem; color: var(--text-muted);">Evaluación sobre 22 alertas con veredicto</span>
            </div>

            <div class="ai-grid">
                <!-- Google Gemini -->
                <div class="ai-box gemini">
                    <div class="ai-name">
                        <span style="display: flex; align-items: center; gap: 8px;">
                            <i data-lucide="sparkles" style="color: var(--gemini-blue); width: 18px; height: 18px;"></i>
                            Google Gemini
                        </span>
                        <span style="color: var(--gemini-blue); font-size: 1.2rem; font-weight: 800;">47.6%</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: 47.6%; background: var(--gemini-blue);"></div>
                    </div>
                    <div class="ai-stats-row">
                        <div>Operadas: <strong>21</strong></div>
                        <div class="stat-badge green"><i data-lucide="check" style="width: 12px; height: 12px;"></i> 10 GREEN</div>
                        <div class="stat-badge red"><i data-lucide="x" style="width: 12px; height: 12px;"></i> 11 RED</div>
                        <div class="stat-badge yellow">1 Evitada</div>
                    </div>
                </div>

                <!-- DeepSeek -->
                <div class="ai-box deepseek">
                    <div class="ai-name">
                        <span style="display: flex; align-items: center; gap: 8px;">
                            <i data-lucide="brain" style="color: var(--deepseek-purple); width: 18px; height: 18px;"></i>
                            DeepSeek
                        </span>
                        <span style="color: var(--deepseek-purple); font-size: 1.2rem; font-weight: 800;">50.0%</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: 50.0%; background: var(--deepseek-purple);"></div>
                    </div>
                    <div class="ai-stats-row">
                        <div>Operadas: <strong>22</strong></div>
                        <div class="stat-badge green"><i data-lucide="check" style="width: 12px; height: 12px;"></i> 11 GREEN</div>
                        <div class="stat-badge red"><i data-lucide="x" style="width: 12px; height: 12px;"></i> 11 RED</div>
                        <div class="stat-badge yellow">0 Evitadas</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Controls Bar -->
        <div class="controls-bar">
            <div class="tabs">
                <button class="tab-btn active" onclick="filterTab('all', this)">
                    <i data-lucide="list" style="width: 16px; height: 16px;"></i>
                    Todas (${analysisData.totalAlertas})
                </button>
                <button class="tab-btn" onclick="filterTab('GREEN', this)">
                    <i data-lucide="check-circle-2" style="width: 16px; height: 16px; color: var(--accent-green);"></i>
                    GREEN (${analysisData.greenCount})
                </button>
                <button class="tab-btn" onclick="filterTab('RED', this)">
                    <i data-lucide="x-circle" style="width: 16px; height: 16px; color: var(--accent-red);"></i>
                    RED (${analysisData.redCount})
                </button>
                <button class="tab-btn" onclick="filterTab('PARLAY', this)">
                    <i data-lucide="layers" style="width: 16px; height: 16px; color: var(--accent-yellow);"></i>
                    Parlays (${analysisData.parlays ? analysisData.parlays.length : 0})
                </button>
            </div>

            <div class="search-box">
                <i data-lucide="search" class="search-icon"></i>
                <input type="text" id="searchInput" class="search-input" placeholder="Buscar por equipo, regla o liga..." onkeyup="filterSearch()">
            </div>
        </div>

        <!-- Match Cards Feed -->
        <div id="matchFeed" class="feed-grid">
            ${analysisData.alertasProcesadas.map((a, idx) => {
                const teams = a.partido.split(' vs ');
                const homeTeam = teams[0] || a.partido;
                const awayTeam = teams[1] || '';
                const verdictClass = a.veredicto || 'EVITADA';

                return `
                <div class="match-card" data-verdict="${verdictClass}" data-search="${(a.partido + ' ' + a.regla + ' ' + a.liga).toLowerCase()}">
                    <div class="match-card-header">
                        <div class="rule-badge">
                            <i data-lucide="flag" style="width: 14px; height: 14px; color: var(--gemini-blue);"></i>
                            ${a.regla}
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 0.8rem; color: var(--text-muted);">${a.liga}</span>
                            <div class="verdict-tag ${verdictClass}">
                                <i data-lucide="${verdictClass === 'GREEN' ? 'check' : verdictClass === 'RED' ? 'x' : 'alert-circle'}" style="width: 14px; height: 14px;"></i>
                                ${verdictClass}
                            </div>
                        </div>
                    </div>

                    <div class="match-main-info">
                        <div class="team-name home">${homeTeam}</div>
                        <div class="versus-box">
                            <div class="score-live">${a.marcador}</div>
                            <div class="minute-tag">Minuto: ${a.minuto}</div>
                        </div>
                        <div class="team-name away">${awayTeam}</div>
                    </div>

                    <div class="predictions-grid">
                        <div class="pred-card">
                            <div class="pred-header">
                                <span>Google Gemini</span>
                                <span style="color: var(--gemini-blue);">${a.geminiConfianza}% Confianza</span>
                            </div>
                            <div class="pred-bet">${a.geminiApuesta}</div>
                        </div>

                        <div class="pred-card">
                            <div class="pred-header">
                                <span>DeepSeek</span>
                                <span style="color: var(--deepseek-purple);">${a.deepseekConfianza}% Confianza</span>
                            </div>
                            <div class="pred-bet">${a.deepseekApuesta}</div>
                        </div>
                    </div>

                    ${a.veredictoDetalle ? `
                    <div class="match-footer-detail ${verdictClass}">
                        <strong style="color: var(--text-primary);">Resultado Final:</strong> ${a.veredictoDetalle.marcadorFinal}
                    </div>
                    ` : ''}
                </div>
                `;
            }).join('')}

            <!-- Parlays (Hidden by default, shown when Parlay tab is selected) -->
            ${analysisData.parlays ? analysisData.parlays.map((p, idx) => `
                <div class="parlay-box match-card" data-verdict="PARLAY" data-search="${p.text.toLowerCase()}">
                    <div class="parlay-header">
                        <div class="parlay-title">
                            <i data-lucide="award"></i>
                            PARLAY DEL DÍA #${idx + 1}
                        </div>
                        <span style="font-size: 0.8rem; color: var(--text-muted);">${p.dateTitle}</span>
                    </div>
                    <div class="parlay-content">${p.text}</div>
                </div>
            `).join('') : ''}
        </div>

        <div id="emptyState" class="empty-state" style="display: none;">
            <i data-lucide="inbox" style="width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.5;"></i>
            <p>No se encontraron alertas o partidos que coincidan con la búsqueda.</p>
        </div>

    </div>

    <script>
        lucide.createIcons();

        let currentTab = 'all';

        function filterTab(tab, btn) {
            currentTab = tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applyFilters();
        }

        function filterSearch() {
            applyFilters();
        }

        function applyFilters() {
            const searchVal = document.getElementById('searchInput').value.toLowerCase().trim();
            const cards = document.querySelectorAll('#matchFeed .match-card');
            let visibleCount = 0;

            cards.forEach(card => {
                const verdict = card.getAttribute('data-verdict');
                const searchData = card.getAttribute('data-search') || '';

                const matchesTab = (currentTab === 'all' && verdict !== 'PARLAY') || 
                                   (currentTab === verdict);
                const matchesSearch = !searchVal || searchData.includes(searchVal);

                if (matchesTab && matchesSearch) {
                    card.style.display = 'block';
                    visibleCount++;
                } else {
                    card.style.display = 'none';
                }
            });

            document.getElementById('emptyState').style.display = (visibleCount === 0) ? 'block' : 'none';
        }

        // Run initial filter
        applyFilters();
    </script>
</body>
</html>
`;

const outputPath = path.join(__dirname, '..', 'resumen_ayer.html');
fs.writeFileSync(outputPath, htmlContent, 'utf8');

console.log(`Reporte HTML generado exitosamente en: ${outputPath}`);
