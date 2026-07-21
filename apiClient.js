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

// Obtiene todos los partidos en vivo
async function getLiveMatches() {
  try {
    const response = await apiClient.get('/fixtures', { params: { live: 'all' } });
    return response.data.response || [];
  } catch (error) {
    console.error('Error fetching live matches:', error.message);
    return [];
  }
}

// Obtiene los eventos de un partido (tarjetas, goles)
async function getMatchEvents(fixtureId) {
    try {
        const response = await apiClient.get('/fixtures/events', { params: { fixture: fixtureId } });
        return response.data.response || [];
    } catch (error) {
        console.error(`Error fetching events for ${fixtureId}:`, error.message);
        return [];
    }
}

// Obtiene los momios pre-partido (Bet=1 es Match Winner/1X2)
async function getPreMatchOdds(fixtureId) {
  try {
    const response = await apiClient.get('/odds', { params: { fixture: fixtureId, bet: 1 } });
    
    if (response.data.response && response.data.response.length > 0) {
      // Tomamos el primer corredor de apuestas disponible
      const bookmaker = response.data.response[0].bookmakers[0];
      const bet = bookmaker.bets[0];
      
      const homeOdd = parseFloat(bet.values.find(v => v.value === 'Home').odd);
      const drawOdd = parseFloat(bet.values.find(v => v.value === 'Draw').odd);
      const awayOdd = parseFloat(bet.values.find(v => v.value === 'Away').odd);
      
      return { home: homeOdd, draw: drawOdd, away: awayOdd };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching odds for ${fixtureId}:`, error.message);
    return null;
  }
}

// Obtiene estadísticas de un partido específico (ej. posesión, tiros)
async function getMatchStatistics(fixtureId) {
    try {
        const response = await apiClient.get('/fixtures/statistics', { params: { fixture: fixtureId } });
        return response.data.response || [];
    } catch (error) {
        console.error(`Error fetching stats for ${fixtureId}:`, error.message);
        return [];
    }
}

// Obtiene los partidos de una fecha específica (formato YYYY-MM-DD)
async function getMatchesByDate(dateString) {
    try {
        const response = await apiClient.get('/fixtures', { params: { date: dateString } });
        return response.data.response || [];
    } catch (error) {
        console.error(`Error fetching matches for ${dateString}:`, error.message);
        return [];
    }
}

// Obtiene un partido específico por ID (útil para revisar si ya terminó)
async function getMatchById(fixtureId) {
    try {
        const response = await apiClient.get('/fixtures', { params: { id: fixtureId } });
        if (response.data.response && response.data.response.length > 0) {
            return response.data.response[0];
        }
        return null;
    } catch (error) {
        console.error(`Error fetching match ${fixtureId}:`, error.message);
        return null;
    }
}

module.exports = {
  getLiveMatches,
  getMatchEvents,
  getPreMatchOdds,
  getMatchStatistics,
  getMatchesByDate,
  getMatchById
};
