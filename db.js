// db.js
// Base de données simple basée sur un fichier JSON (data/db.json).
// Suffisant pour un kiosque avec quelques utilisateurs et un usage modéré.
// Pour un usage à plus grande échelle, on pourrait migrer vers PostgreSQL/MySQL
// en gardant les mêmes fonctions exportées ci-dessous.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

function ensureDb() {
  if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const initial = { users: [], reports: [], stock: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
  }
}

function readDb() {
  ensureDb();
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw);
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function newId() {
  return crypto.randomUUID();
}

// ---------- Utilisateurs ----------

function findUserByEmail(email) {
  const db = readDb();
  return db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

function createUser({ email, passwordHash }) {
  const db = readDb();
  const user = {
    id: newId(),
    email,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);

  // Stock par défaut pour un nouveau compte
  db.stock.push(
    { userId: user.id, key: 'boissons', label: 'Boissons', value: '0 unité' },
    { userId: user.id, key: 'biscuits', label: 'Biscuits', value: '0 unité' },
    { userId: user.id, key: 'divers', label: 'Produits divers', value: '0 unité' }
  );

  writeDb(db);
  return user;
}

// ---------- Comptes rendus / rapports ----------

function getReportsByUser(userId) {
  const db = readDb();
  return db.reports
    .filter((r) => r.userId === userId)
    .sort((a, b) => new Date(b.date) - new Date(a.date) || b.createdAt.localeCompare(a.createdAt));
}

function addReport(userId, { date, vendu, depenses, reinvestis, note }) {
  const db = readDb();
  const report = {
    id: newId(),
    userId,
    date,
    vendu: Number(vendu) || 0,
    depenses: Number(depenses) || 0,
    reinvestis: Number(reinvestis) || 0,
    note: (note || '').trim(),
    createdAt: new Date().toISOString(),
  };
  db.reports.push(report);
  writeDb(db);
  return report;
}

function deleteReport(userId, reportId) {
  const db = readDb();
  const before = db.reports.length;
  db.reports = db.reports.filter((r) => !(r.id === reportId && r.userId === userId));
  writeDb(db);
  return db.reports.length < before;
}

// ---------- Stock ----------

function getStockByUser(userId) {
  const db = readDb();
  return db.stock.filter((s) => s.userId === userId);
}

function updateStockItem(userId, key, value) {
  const db = readDb();
  let item = db.stock.find((s) => s.userId === userId && s.key === key);
  if (!item) {
    item = { userId, key, label: key, value };
    db.stock.push(item);
  } else {
    item.value = value;
  }
  writeDb(db);
  return item;
}

module.exports = {
  findUserByEmail,
  createUser,
  getReportsByUser,
  addReport,
  deleteReport,
  getStockByUser,
  updateStockItem,
};
