const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASEBALL_API_HOST = 'v1.baseball.api-sports.io';

const baseballApiClient = axios.create({
  baseURL: `https://${BASEBALL_API_HOST}`,
  headers: {
    'x-apisports-key': API_KEY || 'MISSING_KEY'
  }
});

// Obtiene todos los juegos de béisbol en vivo
async function getLiveBaseballGames() {
  try {
    const response = await baseballApiClient.get('/games', { params: { live: 'all' } });
    return response.data.response || [];
  } catch (error) {
    console.error('Error fetching live baseball games:', error.message);
    return [];
  }
}

// Obtiene los momios pre-partido para Béisbol (Bet 1 = Winner 12)
async function getPreGameBaseballOdds(gameId) {
  try {
    const response = await baseballApiClient.get('/odds', { params: { game: gameId, bet: 1 } });
    
    if (response.data.response && response.data.response.length > 0) {
      const bookmaker = response.data.response[0].bookmakers[0];
      if (!bookmaker) return null;
      
      const bet = bookmaker.bets[0];
      if (!bet || !bet.values) return null;
      
      const homeOddObj = bet.values.find(v => v.value === 'Home' || v.value === '1');
      const awayOddObj = bet.values.find(v => v.value === 'Away' || v.value === '2');

      if (!homeOddObj || !awayOddObj) return null;
      
      const homeOdd = parseFloat(homeOddObj.odd);
      const awayOdd = parseFloat(awayOddObj.odd);
      
      return { home: homeOdd, away: awayOdd };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching baseball odds for game ${gameId}:`, error.message);
    return null;
  }
}

// Obtiene un juego de béisbol específico por ID para verificar si terminó
async function getBaseballGameById(gameId) {
  try {
    const response = await baseballApiClient.get('/games', { params: { id: gameId } });
    if (response.data.response && response.data.response.length > 0) {
      return response.data.response[0];
    }
    return null;
  } catch (error) {
    console.error(`Error fetching baseball game ${gameId}:`, error.message);
    return null;
  }
}

module.exports = {
  getLiveBaseballGames,
  getPreGameBaseballOdds,
  getBaseballGameById
};
