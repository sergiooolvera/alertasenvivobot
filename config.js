// Configuración de Ligas Importantes (Top Leagues) para aplicar Reglas Avanzadas (5-7)

const MAJOR_LEAGUE_IDS = new Set([
    2,   // UEFA Champions League
    3,   // UEFA Europa League
    848, // UEFA Conference League
    39,  // Premier League (Inglaterra)
    140, // La Liga (España)
    135, // Serie A (Italia)
    78,  // Bundesliga (Alemania)
    61,  // Ligue 1 (Francia)
    88,  // Eredivisie (Países Bajos)
    94,  // Primeira Liga (Portugal)
    262, // Liga MX (México)
    128, // Liga Profesional (Argentina)
    71,  // Brasileirão Serie A (Brasil)
    253, // MLS (EEUU)
    13,  // Copa Libertadores
    11,  // Copa Sudamericana
    1,   // World Cup
    4,   // Euro Championship
    9    // Copa América
]);

// Palabras clave en caso de que la ID varíe según el plan de la API
const MAJOR_LEAGUE_KEYWORDS = [
    'champions league',
    'europa league',
    'conference league',
    'premier league',
    'la liga',
    'laliga',
    'serie a',
    'bundesliga',
    'ligue 1',
    'eredivisie',
    'primeira liga',
    'liga mx',
    'copa libertadores',
    'copa sudamericana',
    'brasileirao',
    'mls',
    'world cup',
    'euro'
];

function isMajorLeague(league) {
    if (!league) return false;
    if (league.id && MAJOR_LEAGUE_IDS.has(league.id)) {
        return true;
    }
    if (league.name) {
        const nameLower = league.name.toLowerCase();
        return MAJOR_LEAGUE_KEYWORDS.some(kw => nameLower.includes(kw));
    }
    return false;
}

module.exports = {
    MAJOR_LEAGUE_IDS,
    isMajorLeague
};
