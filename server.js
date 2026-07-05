// server.js
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const db = require('./db');
const mail = require('./mail');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
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

function getBaseUrl(req) {
  return process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
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

// ---------- Mot de passe oublié ----------

app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis.' });

  const user = db.findUserByEmail(email);
  // On répond pareil que l'email existe ou non, pour ne pas révéler qui a un compte.
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = Date.now() + 1000 * 60 * 60; // 1 heure
    db.setResetToken(user.id, token, expiry);
    const resetUrl = `${getBaseUrl(req)}/reset.html?token=${token}`;
    await mail.sendResetPasswordEmail(user.email, resetUrl);
  }
  res.json({ ok: true, message: 'Si un compte existe avec cet email, un lien a été envoyé.' });
});

app.post('/api/reset-password', async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Lien invalide.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' });
  }

  const user = db.findUserByResetToken(token);
  if (!user || !user.resetTokenExpiry || Date.now() > user.resetTokenExpiry) {
    return res.status(400).json({ error: 'Ce lien a expiré ou est invalide. Refais une demande.' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  db.updateUserPassword(user.id, passwordHash);
  db.clearResetToken(user.id);
  res.json({ ok: true });
});

app.post('/api/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Mot de passe actuel et nouveau requis.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });
  }

  const user = db.findUserById(req.session.userId);
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  db.updateUserPassword(user.id, passwordHash);
  res.json({ ok: true });
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

// ---------- Tableau de bord (totaux agrégés) ----------

app.get('/api/dashboard', requireAuth, (req, res) => {
  const reports = db.getReportsByUser(req.session.userId);
  const totalVendu = reports.reduce((sum, r) => sum + r.vendu, 0);
  const totalDepenses = reports.reduce((sum, r) => sum + r.depenses, 0);
  const totalReinvestis = reports.reduce((sum, r) => sum + r.reinvestis, 0);
  const benefice = totalVendu - totalDepenses - totalReinvestis;
  res.json({ totalVendu, totalDepenses, totalReinvestis, benefice, count: reports.length });
});

// ---------- Analyse / graphiques ----------

function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // lundi comme premier jour
  return new Date(date.setDate(diff));
}

function groupReports(reports, period) {
  const groups = {};
  reports.forEach((r) => {
    const d = new Date(r.date);
    let key;
    if (period === 'day') {
      key = r.date;
    } else if (period === 'week') {
      const monday = startOfWeek(d);
      key = monday.toISOString().slice(0, 10);
    } else {
      key = r.date.slice(0, 7); // YYYY-MM
    }
    if (!groups[key]) groups[key] = { key, vendu: 0, depenses: 0, reinvestis: 0, benefice: 0, count: 0 };
    groups[key].vendu += r.vendu;
    groups[key].depenses += r.depenses;
    groups[key].reinvestis += r.reinvestis;
    groups[key].benefice += r.vendu - r.depenses - r.reinvestis;
    groups[key].count += 1;
  });
  return Object.values(groups).sort((a, b) => a.key.localeCompare(b.key));
}

app.get('/api/analytics', requireAuth, (req, res) => {
  const period = ['day', 'week', 'month'].includes(req.query.period) ? req.query.period : 'day';
  const reports = db.getReportsByUser(req.session.userId);
  const series = groupReports(reports, period).slice(-12); // 12 derniers points

  let bestDay = null;
  let worstDay = null;
  reports.forEach((r) => {
    const benefice = r.vendu - r.depenses - r.reinvestis;
    if (!bestDay || benefice > bestDay.benefice) bestDay = { date: r.date, benefice, vendu: r.vendu };
    if (!worstDay || benefice < worstDay.benefice) worstDay = { date: r.date, benefice, vendu: r.vendu };
  });

  res.json({ period, series, bestDay, worstDay });
});

// ---------- Objectifs ----------

app.get('/api/goals', requireAuth, (req, res) => {
  const goal = db.getGoal(req.session.userId);
  if (!goal) return res.json({ goal: null, progress: 0, current: 0 });

  const reports = db.getReportsByUser(req.session.userId);
  const now = new Date();
  let since;
  if (goal.period === 'weekly') {
    since = startOfWeek(now);
  } else {
    since = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  const current = reports
    .filter((r) => new Date(r.date) >= since)
    .reduce((sum, r) => sum + (r.vendu - r.depenses - r.reinvestis), 0);

  const progress = goal.amount > 0 ? Math.min(100, Math.round((current / goal.amount) * 100)) : 0;
  res.json({ goal, current, progress });
});

app.post('/api/goals', requireAuth, (req, res) => {
  const { period, amount } = req.body || {};
  if (!['weekly', 'monthly'].includes(period) || !amount) {
    return res.status(400).json({ error: 'Période (weekly/monthly) et montant requis.' });
  }
  const goal = db.setGoal(req.session.userId, { period, amount });
  res.json(goal);
});

// ---------- Rappels par email (appelé par un service de cron externe) ----------

app.post('/api/cron/send-reminders', async (req, res) => {
  const secret = req.headers['x-cron-secret'];
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Non autorisé.' });
  }

  const today = new Date().toISOString().slice(0, 10);
  const users = db.getAllUsers();
  let sentCount = 0;

  for (const user of users) {
    if (user.lastReminderSentDate === today) continue;
    const reports = db.getReportsByUser(user.id);
    const hasReportToday = reports.some((r) => r.date === today);
    if (!hasReportToday) {
      const sent = await mail.sendReminderEmail(user.email);
      if (sent) {
        db.setLastReminderSentDate(user.id, today);
        sentCount += 1;
      }
    }
  }

  res.json({ ok: true, sentCount });
});

app.listen(PORT, () => {
  console.log(`Kiosque Alkass est lancé : http://localhost:${PORT}`);
});
