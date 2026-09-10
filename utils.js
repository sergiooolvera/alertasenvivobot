/**
 * Utilidades compartidas para el sistema de alertas de fútbol.
 */

/**
 * Determina si una tarjeta / expulsión fue fuera del campo (banca, entrenador, cuerpo técnico, suplente o jugador ya sustituido).
 * @param {Object} e - Evento de tarjeta
 * @param {Array} events - Lista completa de eventos del partido
 * @returns {boolean} true si la tarjeta fue fuera del campo, false de lo contrario.
 */
function isOffFieldCard(e, events = []) {
    if (!e) return false;

    const comments = (e.comments || '').toLowerCase();
    const detail = (e.detail || '').toLowerCase();
    const playerName = (e.player && e.player.name ? e.player.name : '').toLowerCase();

    // Palabras clave que indican sanción fuera del campo / banca / cuerpo técnico / suplente
    const offFieldKeywords = [
        'fuera del campo',
        'fuera del terreno',
        'fuera de la cancha',
        'off-pitch',
        'off pitch',
        'off the pitch',
        'off field',
        'off-field',
        'bench',
        'banca',
        'banquillo',
        'coach',
        'entrenador',
        'manager',
        'director tecnico',
        'director técnico',
        'dt',
        'cuerpo tecnico',
        'cuerpo técnico',
        'staff',
        'assistant',
        'asistente',
        'substitute',
        'suplente',
        'reserva'
    ];

    const textToTest = `${comments} ${detail} ${playerName}`;
    const matchesKeyword = offFieldKeywords.some(keyword => textToTest.includes(keyword));
    if (matchesKeyword) return true;

    // Verificar si el jugador ya había sido sustituido (salió del campo) antes o en el mismo minuto
    if (e.player && (e.player.id || e.player.name) && Array.isArray(events) && events.length > 0) {
        const cardTime = (e.time && typeof e.time.elapsed === 'number') ? e.time.elapsed : 999;
        const isSubbedOut = events.some(sub => {
            if (sub.type !== 'Subst') return false;
            const subTime = (sub.time && typeof sub.time.elapsed === 'number') ? sub.time.elapsed : 0;
            if (subTime > cardTime) return false; // La sustitución fue posterior a la tarjeta
            
            // sub.player es el jugador que sale de la cancha
            if (e.player.id && sub.player && sub.player.id) {
                return e.player.id === sub.player.id;
            }
            if (e.player.name && sub.player && sub.player.name) {
                return e.player.name.toLowerCase() === sub.player.name.toLowerCase();
            }
            return false;
        });
        if (isSubbedOut) return true;
    }

    return false;
}

module.exports = {
    isOffFieldCard
};
