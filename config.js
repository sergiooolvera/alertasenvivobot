// Configuración de Ligas Importantes (Top Leagues) para aplicar Reglas Avanzadas (5-7)

const MAJOR_LEAGUE_IDS = new Set([
    2,   // UEFA Champions League
    3,   // UEFA Europa League
    848, // UEFA Conference League
    531, // UEFA Super Cup
    5,   // UEFA Nations League
    39,  // Premier League (Inglaterra)
    40,  // Championship (Inglaterra)
    45,  // FA Cup (Inglaterra)
    48,  // EFL Cup / Carabao Cup (Inglaterra)
    140, // La Liga (España)
    143, // Copa del Rey (España)
    135, // Serie A (Italia)
    137, // Coppa Italia (Italia)
    78,  // Bundesliga (Alemania)
    81,  // DFB Pokal (Alemania)
    61,  // Ligue 1 (Francia)
    66,  // Coupe de France (Francia)
    88,  // Eredivisie (Países Bajos)
    94,  // Primeira Liga (Portugal)
    262, // Liga MX (México)
    128, // Liga Profesional (Argentina)
    130, // Copa Argentina
    71,  // Brasileirão Serie A (Brasil)
    73,  // Copa do Brasil
    253, // MLS (EEUU)
    807, // Leagues Cup
    16,  // CONCACAF Champions Cup
    307, // Saudi Pro League (Arabia Saudita - Liga de CR7)
    308, // King Cup (Arabia Saudita)
    17,  // AFC Champions League (Champions de Asia)
    13,  // Copa Libertadores
    11,  // Copa Sudamericana
    1,   // World Cup
    15,  // FIFA Club World Cup
    4,   // Euro Championship
    9    // Copa América
]);

// Palabras clave en caso de que la ID varíe según el plan de la API
const MAJOR_LEAGUE_KEYWORDS = [
    'champions league',
    'europa league',
    'conference league',
    'uefa super cup',
    'nations league',
    'premier league',
    'championship',
    'fa cup',
    'efl cup',
    'carabao cup',
    'la liga',
    'laliga',
    'copa del rey',
    'serie a',
    'coppa italia',
    'bundesliga',
    'dfb-pokal',
    'dfb pokal',
    'ligue 1',
    'coupe de france',
    'eredivisie',
    'primeira liga',
    'liga mx',
    'copa argentina',
    'copa do brasil',
    'copa libertadores',
    'copa sudamericana',
    'brasileirao',
    'mls',
    'leagues cup',
    'concacaf champions',
    'saudi pro league',
    'saudi professional league',
    'roshn saudi league',
    'king cup',
    'afc champions',
    'world cup',
    'club world cup',
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
    isMajorLeague,
    MONITORING_START_HOUR: 7,
    MONITORING_END_HOUR: 21,
    TIMEZONE: 'America/Mexico_City',
    isWithinActiveHours: function() {
        const options = { timeZone: 'America/Mexico_City', hour: 'numeric', hour12: false };
        const formatter = new Intl.DateTimeFormat('en-US', options);
        const hour = parseInt(formatter.format(new Date()), 10);
        return hour >= 7 && hour <= 21;
    }
};

