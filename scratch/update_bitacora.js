const fs = require('fs');
const path = require('path');

const bitacoraPath = path.join(__dirname, '..', 'bitacora.md');
let content = fs.readFileSync(bitacoraPath, 'utf8');

const newEntry = `
- **[2026-09-23]**: Auditoría Integral de Rendimiento y Análisis de Reglas de \`messages.html\` (24 de Agosto al 23 de Septiembre de 2026).
  - **Procesamiento de Datos**: Se procesó el archivo completo recién exportado de Telegram (\`messages.html\`), conteniendo 711 mensajes a lo largo de 31 días.
  - **Emparejamiento de Alertas y Veredictos**:
    - **Total Alertas Identificadas**: 285 alertas en vivo.
    - **Veredictos Evaluados**: 270 resueltos con veredicto en canal (15 pendientes o de cierre).
    - Se resolvió la captura de equipos con caracteres numéricos (U20, U21, U19, 1961, etc.) y se asociaron los mensajes de análisis extendido de DeepSeek con sus respectivos veredictos.
  - **Rendimiento Global**:
    - **Winrate Global**: 63.0% (170 Greens / 100 Reds).
    - **Beneficio Neto Acumulado**: +29.87 unidades (Yield ROI: +11.1%). Pico máximo de balance en +36.00u el 16 de septiembre.
  - **Desglose de Reglas (Frecuencia y Rentabilidad)**:
    - **Regla 7 (Partido Caliente / Tarjetas)**: 132 alertas (46.3% del total), 83W - 38L (68.6% Winrate), **+25.44u** (+21.0% Yield). *La regla más usada y de mayor beneficio total.*
    - **Regla 9 (Gol Inminente Global)**: 38 alertas (13.3%), 28W - 10L (73.7% Winrate), **+12.69u** (+33.4% Yield). *La regla con mayor porcentaje de rentabilidad (Yield).*
    - **Regla 8 (Favorito Domina HT)**: 24 alertas (8.4%), 16W - 6L (72.7% Winrate), **+5.02u** (+22.8% Yield). *Altamente consistente.*
    - **Regla 1 (Tarjeta Roja Estratégica)**: 49 alertas (17.2%), 24W - 23L (51.1% Winrate), **-5.03u** (-10.7% Yield). *Requiere optimización de cuotas y filtros de repliegue.*
    - **Regla 6 (Presión de Córneres)**: 19 alertas (6.7%), 8W - 11L (42.1% Winrate), **-4.85u** (-25.5% Yield). *Fuga de rendimiento en córneres finales.*
    - **Regla 5 (Remontada al Descanso)**: 6 alertas (2.1%), 2W - 4L (33.3% Winrate), **-2.40u** (-40.0% Yield).
    - **Regla 4 (Asedio Intenso)**: 17 alertas (6.0%), 9W - 8L (52.9% Winrate), **-1.00u** (-5.9% Yield).
  - **Comparativa de Modelos IA**:
    - **Google Gemini**: 17W - 4L (81.0% Winrate), +7.00u netas (+33.3% Yield). Altísima precisión y selectividad conservadora.
    - **DeepSeek**: 166W - 102L (61.9% Winrate), +25.47u netas (+9.5% Yield). Motor de alta frecuencia que sostiene el grueso de las operaciones.
  - **Generación del Reporte Web**: Se actualizó y modernizó el archivo [\`reporte_messages.html\`](file:///c:/Users/sergi/.gemini/antigravity/scratch/rojas%20y%20goles/reporte_messages.html) con gráficos interactivos de curva de capital (Chart.js), tarjetas KPI, tabla por reglas, tabla cronológica por día y explorador interactivo de apuestas con filtros en vivo por texto, regla y veredicto.
`;

fs.writeFileSync(bitacoraPath, content.trim() + '\n' + newEntry, 'utf8');
console.log('Bitácora actualizada correctamente.');
