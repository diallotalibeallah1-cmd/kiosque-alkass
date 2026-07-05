// server.js
const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    // IMPORTANT : change cette valeur avant de mettre le site en ligne.
    // Idéalement, définis-la via une variable d'environnement SESSION_SECRET.
    secret: process.env.SESSION_SECRET || 'change-moi-avant-la-mise-en-ligne-alkass',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 jours
    },
  })
);

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Non connecté.' });
  }
  next();
}

// ---------- Authentification ----------

app.post('/api/register', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' });
  }
  if (db.findUserByEmail(email)) {
    return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = db.createUser({ email, passwordHash });
  req.session.userId = user.id;
  req.session.email = user.email;
  res.json({ id: user.id, email: user.email });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  const user = db.findUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
  }

  req.session.userId = user.id;
  req.session.email = user.email;
  res.json({ id: user.id, email: user.email });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Non connecté.' });
  }
  res.json({ id: req.session.userId, email: req.session.email });
});

// ---------- Comptes rendus ----------

app.get('/api/reports', requireAuth, (req, res) => {
  res.json(db.getReportsByUser(req.session.userId));
});

app.post('/api/reports', requireAuth, (req, res) => {
  const { date, vendu, depenses, reinvestis, note } = req.body || {};
  if (!date) {
    return res.status(400).json({ error: 'La date est requise.' });
  }
  const report = db.addReport(req.session.userId, { date, vendu, depenses, reinvestis, note });
  res.json(report);
});

app.delete('/api/reports/:id', requireAuth, (req, res) => {
  const ok = db.deleteReport(req.session.userId, req.params.id);
  if (!ok) return res.status(404).json({ error: 'Compte rendu introuvable.' });
  res.json({ ok: true });
});

// ---------- Stock ----------

app.get('/api/stock', requireAuth, (req, res) => {
  res.json(db.getStockByUser(req.session.userId));
});

app.put('/api/stock/:key', requireAuth, (req, res) => {
  const { value } = req.body || {};
  const item = db.updateStockItem(req.session.userId, req.params.key, value || '');
  res.json(item);
});

// ---------- Tableau de bord (totaux agrégés) ----------

app.get('/api/dashboard', requireAuth, (req, res) => {
  const reports = db.getReportsByUser(req.session.userId);
  const totalVendu = reports.reduce((sum, r) => sum + r.vendu, 0);
  const totalDepenses = reports.reduce((sum, r) => sum + r.depenses, 0);
  const totalReinvestis = reports.reduce((sum, r) => sum + r.reinvestis, 0);
  const benefice = totalVendu - totalDepenses - totalReinvestis;
  res.json({ totalVendu, totalDepenses, totalReinvestis, benefice, count: reports.length });
});

app.listen(PORT, () => {
  console.log(`Kiosque Alkass est lancé : http://localhost:${PORT}`);
});
