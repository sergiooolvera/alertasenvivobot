const fs = require('fs');
const path = require('path');

const bitacoraPath = path.join(__dirname, '..', 'bitacora.md');
let content = fs.readFileSync(bitacoraPath, 'utf8');

const badLinePattern = /-   \* \* \[ 2 0 2 6 - 0 8 - 0 7 \] \* \* :[\s\S]*/;

if (badLinePattern.test(content)) {
    content = content.replace(badLinePattern, `- **[2026-08-07]**: Corrección de error de sintaxis en Regla 1 (Versión 2.2.1). Se arregló un error crítico (SyntaxError: Unexpected end of input) causado por una llave de cierre faltante en el bloque de la Regla 1 en rulesEngine.js. Se incrementó la versión a v2.2.1.\n- **[2026-08-08]**: Auditoría completa de rendimiento de \`messages.html\` del día 7 de agosto de 2026. Se desarrolló un script de procesamiento \`scratch/analyze_yesterday.js\` que parseó 22 alertas y 22 veredictos post-partido registrados en el chat. Se determinó un 50.0% de aciertos global (11 GREEN / 11 RED). En la comparativa de IAs, DeepSeek logró un 50.0% de aciertos (11 GREEN / 11 RED en 22 apuestas) mientras que Google Gemini logró un 47.6% (10 GREEN / 11 RED en 21 apuestas recomendadas, más 1 evitada). La Regla 1 (Tarjeta Roja Estratégica) mantuvo una efectividad impecable del 100% (3/3 GREEN), mientras que la Regla 3 (Sorpresa Tempranera) registró 8 GREEN y 10 RED. Se registraron 3 parlays del día.\n`);
} else {
    content += `\n- **[2026-08-08]**: Auditoría completa de rendimiento de \`messages.html\` del día 7 de agosto de 2026. Se desarrolló un script de procesamiento \`scratch/analyze_yesterday.js\` que parseó 22 alertas y 22 veredictos post-partido registrados en el chat. Se determinó un 50.0% de aciertos global (11 GREEN / 11 RED). En la comparativa de IAs, DeepSeek logró un 50.0% de aciertos (11 GREEN / 11 RED en 22 apuestas) mientras que Google Gemini logró un 47.6% (10 GREEN / 11 RED en 21 apuestas recomendadas, más 1 evitada). La Regla 1 (Tarjeta Roja Estratégica) mantuvo una efectividad impecable del 100% (3/3 GREEN), mientras que la Regla 3 (Sorpresa Tempranera) registró 8 GREEN y 10 RED. Se registraron 3 parlays del día.\n`;
}

fs.writeFileSync(bitacoraPath, content, 'utf8');
console.log('Bitácora corregida y actualizada con éxito.');
