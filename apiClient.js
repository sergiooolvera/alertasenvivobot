const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.API_FOOTBALL_KEY;
const API_HOST = 'v3.football.api-sports.io';

const apiClient = axios.create({
  baseURL: `https://${API_HOST}`,
  headers: {
    'x-apisports-key': API_KEY || 'MISSING_KEY'
  }
});

let rateLimitedUntil = 0;

function checkRateLimit() {
  if (Date.now() < rateLimitedUntil) {
    return true; // Cooldown activo
  }
  return false;
}

function handleApiError(endpoint, error) {
  if (error.response && error.response.status === 429) {
    rateLimitedUntil = Date.now() + 60000; // Cooldown de 60 segundos
    console.warn(`⚠️ [API-Sports Football] Límite de peticiones alcanzado (429). Pausando peticiones por 60s.`);
  } else {
    console.error(`Error fetching ${endpoint}:`, error.message);
  }
}

// Obtiene todos los partidos en vivo
async function getLiveMatches() {
  if (checkRateLimit()) return [];
  try {
    const response = await apiClient.get('/fixtures', { params: { live: 'all' } });
    return response.data.response || [];
  } catch (error) {
    handleApiError('live matches', error);
    return [];
  }
}

// Obtiene los eventos de un partido (tarjetas, goles)
async function getMatchEvents(fixtureId) {
  if (checkRateLimit()) {
    const res = [];
    res.isError = true;
    return res;
  }
  try {
    const response = await apiClient.get('/fixtures/events', { params: { fixture: fixtureId } });
    const res = response.data.response || [];
    res.isError = false;
    return res;
  } catch (error) {
    handleApiError(`events for ${fixtureId}`, error);
    const res = [];
    res.isError = true;
    return res;
  }
}

// Obtiene los momios pre-partido (Bet=1 es Match Winner/1X2)
async function getPreMatchOdds(fixtureId) {
  if (checkRateLimit()) return null;
  try {
    const response = await apiClient.get('/odds', { params: { fixture: fixtureId, bet: 1 } });
    
    if (response.data.response && response.data.response.length > 0) {
      const bookmaker = response.data.response[0].bookmakers[0];
      if (!bookmaker || !bookmaker.bets || bookmaker.bets.length === 0) return null;
      const bet = bookmaker.bets[0];
      if (!bet || !bet.values) return null;
      
      const homeVal = bet.values.find(v => v.value === 'Home');
      const drawVal = bet.values.find(v => v.value === 'Draw');
      const awayVal = bet.values.find(v => v.value === 'Away');

      if (!homeVal || !drawVal || !awayVal) return null;
      
      return { home: parseFloat(homeVal.odd), draw: parseFloat(drawVal.odd), away: parseFloat(awayVal.odd) };
    }
    return null;
  } catch (error) {
    handleApiError(`odds for ${fixtureId}`, error);
    return null;
  }
}

// Obtiene estadísticas de un partido específico (ej. posesión, tiros)
async function getMatchStatistics(fixtureId) {
  if (checkRateLimit()) return [];
  try {
    const response = await apiClient.get('/fixtures/statistics', { params: { fixture: fixtureId } });
    return response.data.response || [];
  } catch (error) {
    handleApiError(`stats for ${fixtureId}`, error);
    return [];
  }
}

// Obtiene los partidos de una fecha específica (formato YYYY-MM-DD)
async function getMatchesByDate(dateString) {
  if (checkRateLimit()) return [];
  try {
    const response = await apiClient.get('/fixtures', { params: { date: dateString } });
    return response.data.response || [];
  } catch (error) {
    handleApiError(`matches for ${dateString}`, error);
    return [];
  }
}

// Obtiene un partido específico por ID (útil para revisar si ya terminó)
async function getMatchById(fixtureId) {
  if (checkRateLimit()) return null;
  try {
    const response = await apiClient.get('/fixtures', { params: { id: fixtureId } });
    if (response.data.response && response.data.response.length > 0) {
      return response.data.response[0];
    }
    return null;
  } catch (error) {
    handleApiError(`match ${fixtureId}`, error);
    return null;
  }
}

// Obtiene los últimos N partidos de un equipo (Fútbol)
async function getTeamLastMatches(teamId, last = 5) {
  if (checkRateLimit()) return [];
  try {
    const response = await apiClient.get('/fixtures', { params: { team: teamId, last: last } });
    return response.data.response || [];
  } catch (error) {
    handleApiError(`last ${last} matches for team ${teamId}`, error);
    return [];
  }
}

// Obtiene los momios en vivo actuales (Fútbol)
async function getLiveOdds() {
  if (checkRateLimit()) return null;
  try {
    const response = await apiClient.get('/odds/live');
    return response.data;
  } catch (error) {
    handleApiError('live odds', error);
    return null;
  }
}

// Obtiene los últimos N enfrentamientos directos entre dos equipos
async function getHeadToHead(team1Id, team2Id, last = 5) {
  if (checkRateLimit()) return [];
  try {
    const response = await apiClient.get('/fixtures/headtohead', { params: { h2h: `${team1Id}-${team2Id}`, last: last } });
    return response.data.response || [];
  } catch (error) {
    handleApiError(`h2h for ${team1Id} vs ${team2Id}`, error);
    return [];
  }
}

// Caché en memoria para clasificaciones (standings) por liga y temporada
const standingsCache = new Map();
const STANDINGS_CACHE_TTL = 12 * 60 * 60 * 1000; // 12 horas en milisegundos

// Obtiene la clasificación (standings) de una liga y temporada específica
async function getStandings(leagueId, season) {
  if (!leagueId || !season) return null;
  const cacheKey = `${leagueId}_${season}`;
  const now = Date.now();
  
  if (standingsCache.has(cacheKey)) {
    const cached = standingsCache.get(cacheKey);
    if (now - cached.timestamp < STANDINGS_CACHE_TTL) {
      console.log(`[apiClient] Retornando standings desde caché para liga ${leagueId}, temporada ${season}`);
      return cached.data;
    }
  }

  if (checkRateLimit()) return null;

  try {
    console.log(`[apiClient] Consultando standings de API-Football para liga ${leagueId}, temporada ${season}`);
    const response = await apiClient.get('/standings', { params: { league: leagueId, season: season } });
    
    if (response.data.response && response.data.response.length > 0) {
      const standings = response.data.response[0].league.standings;
      standingsCache.set(cacheKey, { data: standings, timestamp: now });
      return standings;
    }
    return null;
  } catch (error) {
    handleApiError(`standings for league ${leagueId} season ${season}`, error);
    return null;
  }
}

module.exports = {
  getLiveMatches,
  getMatchEvents,
  getPreMatchOdds,
  getMatchStatistics,
  getMatchesByDate,
  getMatchById,
  getTeamLastMatches,
  getLiveOdds,
  getHeadToHead,
  getStandings
};


