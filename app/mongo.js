const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ucenyp23:edRisKZ3EyeLnTws@cluster0.uoa05vh.mongodb.net/?appName=Cluster0';
const DB_NAME = process.env.MONGODB_DB || 'mazegame';

let client;
let db;

async function connect() {
  if (db) return db;
  client = new MongoClient(MONGODB_URI); // no useNewUrlParser/useUnifiedTopology
  await client.connect();
  db = client.db(DB_NAME);
  await db.collection('users').createIndex({ username: 1 }, { unique: true });
  return db;
}

function getDb() {
  if (!db) throw new Error('MongoDB not connected. Call connect() first.');
  return db;
}

async function close() {
  if (client) await client.close();
  client = null;
  db = null;
}

module.exports = { connect, getDb, close };
