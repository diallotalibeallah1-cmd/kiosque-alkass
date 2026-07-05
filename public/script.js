// ---- Aides ----
function formatFCFA(n) {
  return Number(n || 0).toLocaleString('fr-FR') + ' FCFA';
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Une erreur est survenue.');
  }
  return data;
}

// ---- Bascule connexion / inscription ----
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const authSubtitle = document.getElementById('authSubtitle');

document.getElementById('showRegister').addEventListener('click', (e) => {
  e.preventDefault();
  loginForm.classList.add('hidden');
  registerForm.classList.remove('hidden');
  authSubtitle.textContent = 'Créer un compte';
});

document.getElementById('showLogin').addEventListener('click', (e) => {
  e.preventDefault();
  registerForm.classList.add('hidden');
  loginForm.classList.remove('hidden');
  authSubtitle.textContent = 'Connexion utilisateur';
});

// ---- Connexion ----
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('loginError');
  errorEl.classList.add('hidden');

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPass').value;

  try {
    const user = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    enterApp(user);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
});

// ---- Inscription ----
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('registerError');
  errorEl.classList.add('hidden');

  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPass').value;

  try {
    const user = await api('/api/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    enterApp(user);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
});

// ---- Déconnexion ----
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  document.getElementById('app').classList.add('hidden');
  document.getElementById('authScreen').classList.remove('hidden');
  loginForm.reset();
  registerForm.reset();
});

function enterApp(user) {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('userPill').textContent = user.email;
  renderDashboard();
  renderStock();
}

// ---- Formulaire de compte rendu ----
document.getElementById('reportForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const date = document.getElementById('repDate').value;
  const vendu = Number(document.getElementById('repVendu').value) || 0;
  const depenses = Number(document.getElementById('repDepenses').value) || 0;
  const reinvestis = Number(document.getElementById('repReinvestis').value) || 0;
  const note = document.getElementById('repNote').value.trim();

  if (!date) {
    alert('Merci de choisir une date.');
    return;
  }

  try {
    await api('/api/reports', {
      method: 'POST',
      body: JSON.stringify({ date, vendu, depenses, reinvestis, note }),
    });
    e.target.reset();
    renderDashboard();
  } catch (err) {
    alert(err.message);
  }
});

// ---- Suppression d'un compte rendu ----
async function deleteReport(id) {
  if (!confirm('Supprimer ce compte rendu ?')) return;
  try {
    await api('/api/reports/' + id, { method: 'DELETE' });
    renderDashboard();
  } catch (err) {
    alert(err.message);
  }
}

// ---- Affichage du tableau de bord ----
async function renderDashboard() {
  const [dashboard, reports] = await Promise.all([
    api('/api/dashboard'),
    api('/api/reports'),
  ]);

  document.getElementById('kpiVendu').textContent = formatFCFA(dashboard.totalVendu);
  document.getElementById('kpiVenduSmall').textContent = dashboard.count
    ? dashboard.count + ' compte(s) rendu(s) enregistré(s)'
    : 'Aucune vente enregistrée';
  document.getElementById('kpiDepenses').textContent = formatFCFA(dashboard.totalDepenses);
  document.getElementById('kpiReinvestis').textContent = formatFCFA(dashboard.totalReinvestis);
  document.getElementById('kpiBenefice').textContent = formatFCFA(dashboard.benefice);

  const max = Math.max(dashboard.totalVendu, dashboard.totalDepenses, dashboard.totalReinvestis, 1);
  document.getElementById('barVendu').style.width = (dashboard.totalVendu / max * 100) + '%';
  document.getElementById('barDepenses').style.width = (dashboard.totalDepenses / max * 100) + '%';
  document.getElementById('barReinvestis').style.width = (dashboard.totalReinvestis / max * 100) + '%';
  document.getElementById('barVenduVal').textContent = dashboard.totalVendu.toLocaleString('fr-FR');
  document.getElementById('barDepensesVal').textContent = dashboard.totalDepenses.toLocaleString('fr-FR');
  document.getElementById('barReinvestisVal').textContent = dashboard.totalReinvestis.toLocaleString('fr-FR');

  const tbody = document.getElementById('reportsTableBody');
  tbody.innerHTML = '';

  if (reports.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="4">Aucun compte rendu pour l\'instant. Ajoute-en un ci-dessous.</td></tr>';
    return;
  }

  reports.forEach((r) => {
    const tr = document.createElement('tr');
    const dateStr = new Date(r.date).toLocaleDateString('fr-FR');
    const label = r.note ? r.note : 'Compte rendu';
    const montant = r.vendu - r.depenses - r.reinvestis;
    const td = document.createElement('td');
    tr.innerHTML = `<td>${dateStr}</td><td>${label}</td><td>${formatFCFA(montant)}</td>`;
    const deleteTd = document.createElement('td');
    deleteTd.className = 'delete-cell';
    const btn = document.createElement('button');
    btn.textContent = '✕';
    btn.title = 'Supprimer';
    btn.addEventListener('click', () => deleteReport(r.id));
    deleteTd.appendChild(btn);
    tr.appendChild(deleteTd);
    tbody.appendChild(tr);
  });
}

// ---- Stock rapide ----
async function renderStock() {
  const stock = await api('/api/stock');
  const container = document.getElementById('stockList');
  container.innerHTML = '';

  stock.forEach((item) => {
    const row = document.createElement('div');
    const label = document.createElement('span');
    label.textContent = item.label;
    const value = document.createElement('b');
    value.textContent = item.value;
    value.contentEditable = 'true';
    value.addEventListener('blur', async () => {
      try {
        await api('/api/stock/' + item.key, {
          method: 'PUT',
          body: JSON.stringify({ value: value.textContent.trim() }),
        });
      } catch (err) {
        alert(err.message);
      }
    });
    row.appendChild(label);
    row.appendChild(value);
    container.appendChild(row);
  });
}

// ---- Reprise de session si déjà connecté ----
(async function init() {
  try {
    const user = await api('/api/me');
    enterApp(user);
  } catch (err) {
    // Pas connecté : on reste sur l'écran de connexion.
  }
})();
