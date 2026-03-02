// Správa bludišť s JSON databází
const { generateMaze } = require('../mazeGenerator');
const { getUser } = require('./authController');
const db = require('../db');

// In-memory storage pro bludiště během hry (není v databázi!)
const mazeStorage = new Map();

// Inicializace nového bludiště pro uživatele
async function initMaze(userId, width = 15, height = 15) {
  const user = await getUser(userId);

  if (!user) {
    return { success: false, error: 'Uživatel nenalezen' };
  }

  width = Math.max(7, Math.min(51, parseInt(width)));
  if (width % 2 === 0) width += 1;

  height = Math.max(7, Math.min(51, parseInt(height)));
  if (height % 2 === 0) height += 1;

  const { maze, startPos, goalPos, portalA, portalB } =
    generateMaze(width, height);

  mazeStorage.set(userId, {
    maze,
    startPos,
    playerPos: startPos,
    goalPos,
    portalA,
    portalB,
  });

  return {
    success: true,
    message: 'Bludiště inicializováno',
    playerPos: startPos,
    goalPos,
    portalA,
    portalB,
    width: maze[0].length,
    height: maze.length,
  };
}

// Získej bludiště
async function getMaze(userId) {
  const mazeData = mazeStorage.get(userId);

  if (!mazeData) {
    return { success: false, error: 'Bludiště nenalezeno' };
  }

  return {
    success: true,
    maze: mazeData.maze,
    playerPos: mazeData.playerPos,
    goalPos: mazeData.goalPos,
    portalA: mazeData.portalA,
    portalB: mazeData.portalB,
    width: mazeData.maze[0].length,
    height: mazeData.maze.length,
  };
}

// Pohyb hráče
async function movePlayer(userId, x, y) {
  const mazeData = mazeStorage.get(userId);

  if (!mazeData) {
    return { success: false, error: 'Bludiště nenalezeno' };
  }

  const { maze, playerPos, goalPos, startPos } = mazeData;

  if (x < 0 || x >= maze[0].length || y < 0 || y >= maze.length) {
    return { success: false, error: 'Pozice mimo bludiště' };
  }

  const distance = Math.max(Math.abs(x - playerPos.x), Math.abs(y - playerPos.y));
  if (distance > 1) {
    return { success: false, error: 'Lze se pohybovat pouze na sousední políčko' };
  }

  const cell = maze[y][x];

  if (cell.type === 1) {
    return { success: false, error: 'Nemůžeš projít zdí!' };
  }

  const dbUser = await getUser(userId);
  if (!dbUser) {
    return { success: false, error: 'Uživatel nenalezen' };
  }

  // Speciální zeď
  if (cell.type === 2) {
    mazeData.playerPos = startPos;

    const updatedUser = await db.updateUser(userId, {
      deaths: (dbUser.deaths || 0) + 1,
      steps: (dbUser.steps || 0) + 1,
    });

    return {
      success: true,
      playerPos: startPos,
      died: true,
      message: '💀 Narazil jsi na trny! Začínáš znovu...',
      stats: updatedUser.success ? updatedUser.data : dbUser,
    };
  }

  // Normální pohyb
  mazeData.playerPos = { x, y };
  const reachedGoal = x === goalPos.x && y === goalPos.y;

  const updatedUser = await db.updateUser(userId, {
    steps: (dbUser.steps || 0) + 1,
    ...(reachedGoal && {
      completedMazes: (dbUser.completedMazes || 0) + 1,
    }),
  });

  return {
    success: true,
    playerPos: { x, y },
    reachedGoal,
    message: reachedGoal
      ? '🎉 Dosáhl jsi cíle! Gratuluji!'
      : 'Pohyb proveden',
    stats: updatedUser.success ? updatedUser.data : dbUser,
  };
}

module.exports = { initMaze, getMaze, movePlayer };
