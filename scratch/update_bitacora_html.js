const fs = require('fs');
const path = require('path');

const bitacoraPath = path.join(__dirname, '..', 'bitacora.md');
let content = fs.readFileSync(bitacoraPath, 'utf8');

const entry = `- **[2026-08-08]**: Generación de Dashboard Interactivo Premium \`resumen_ayer.html\`. Se construyó el script \`scratch/generar_resumen_ayer.js\` que compila los resultados de auditoría de la jornada del 7 de agosto de 2026 en una interfaz web responsiva en modo oscuro con diseño Glassmorphism, tipografía Google Fonts (Inter/Outfit) e iconos Lucide. El dashboard incluye tarjetas KPI de efectividad (50.0% GREEN / 50.0% RED), comparativa visual en barras de progreso entre Google Gemini (47.6%) y DeepSeek (50.0%), filtro dinámico por estado de veredicto (Todas, GREEN, RED, Parlays) y barra de búsqueda en tiempo real.\n`;

if (!content.includes('resumen_ayer.html')) {
    content += `\n` + entry;
} else {
    // Append at the very end
    content = content.trim() + `\n` + entry;
}

fs.writeFileSync(bitacoraPath, content, 'utf8');
console.log('Bitácora actualizada con éxito.');
