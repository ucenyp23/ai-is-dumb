const bcrypt = require('bcryptjs');
const { connect, getDb } = require('./mongo');

async function initDB() {
  await connect();
  // collections/indexes are ensured in connect()
  return true;
}

async function registerUser(username, password) {
  if (!username || !password) {
    return { success: false, error: 'Username a password jsou povinné' };
  }
  const db = getDb();
  const users = db.collection('users');

  const hashedPassword = bcrypt.hashSync(password, 10);
  try {
    const now = new Date().toISOString();
    const doc = {
      username,
      password: hashedPassword,
      completedMazes: 0,
      deaths: 0,
      steps: 0,
      createdAt: now,
    };
    await users.insertOne(doc);
    return { success: true, message: 'Registrace úspěšná', userId: username };
  } catch (err) {
    if (err.code === 11000) { // duplicate key
      return { success: false, error: 'Uživatel již existuje' };
    }
    console.error('DB register error', err);
    return { success: false, error: 'Chyba při registraci' };
  }
}

async function loginUser(username, password) {
  if (!username || !password) {
    return { success: false, error: 'Username a password jsou povinné' };
  }
  const db = getDb();
  const users = db.collection('users');
  const user = await users.findOne({ username });
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return { success: false, error: 'Nesprávné přihlašovací údaje' };
  }
  return { success: true, message: 'Přihlášení úspěšné', userId: username };
}

async function getUser(username) {
  const db = getDb();
  const users = db.collection('users');
  const user = await users.findOne({ username }, { projection: { _id: 0, password: 0 } });
  return user || null;
}

async function updateUser(username, updates) {
  const db = getDb();
  const users = db.collection('users');

  const allowedFields = ['completedMazes', 'deaths', 'steps'];
  const set = {};

  for (const f of allowedFields) {
    if (f in updates && updates[f] !== undefined) {
      set[f] = updates[f];
    }
  }

  try {
    if (Object.keys(set).length === 0) {
      const user = await users.findOne(
        { username },
        { projection: { _id: 0, password: 0 } }
      );

      if (!user) {
        return { success: false, error: 'Uživatel nenalezen' };
      }

      return { success: true, data: user };
    }

    const result = await users.findOneAndUpdate(
      { username },
      { $set: set },
      {
        returnDocument: 'after',
        projection: { _id: 0, password: 0 }
      }
    );

    // MongoDB driver v5+ vrací přímo dokument nebo null
    if (!result) {
      return { success: false, error: 'Uživatel nenalezen' };
    }

    return { success: true, data: result };

  } catch (err) {
    console.error('DB update error:', err);
    return { success: false, error: 'Chyba při aktualizaci uživatele' };
  }
}

async function getAllUsers() {
  const db = getDb();
  const users = db.collection('users');
  const rows = await users.find({}, { projection: { _id: 0, username: 1, createdAt: 1 } }).toArray();
  return rows;
}

module.exports = {
  initDB,
  registerUser,
  loginUser,
  getUser,
  updateUser,
  getAllUsers,
};
