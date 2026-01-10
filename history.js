const navToggle = document.getElementById('navToggle');
const sidebarMenu = document.getElementById('sidebarMenu');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const closeMenu = document.getElementById('closeMenu');

function openSidebar() {
    sidebarMenu.classList.add('active');
    sidebarOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeSidebar() {
    sidebarMenu.classList.remove('active');
    sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

if (navToggle && sidebarMenu && sidebarOverlay && closeMenu) {
    navToggle.addEventListener('click', openSidebar);
    closeMenu.addEventListener('click', closeSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);

    sidebarMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', closeSidebar);
    });
}

// ── History Logic ────────────────────────────────────────────────────────────
const API_BASE = window.location.hostname === 'localhost' ? '' : 'https://ridevise-backend.onrender.com';

window.addEventListener("load", () => {
    const userId = localStorage.getItem("userId");

    if (!userId) {
        window.location.href = "login.html";
        return;
    }

    const userIdInput = document.getElementById('historyUserId');
    if (userIdInput) {
        userIdInput.value = userId;
    }

    loadHistory();
});

const historyList = document.getElementById('historyList');

function fmtDate(ts) {
    try {
        return new Date(ts).toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    } catch(e) {
        return ts || '—';
    }
}

function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[m]);
}

function formatChosenProvider(rawChosen) {
    let chosen = String(rawChosen || '').trim();
    if (!chosen || chosen === '—') return 'Chosen: —';

    if (chosen.startsWith('Provider -')) return chosen;

    const parts = chosen.split(':');
    let provider = parts[0].trim();
    let service = parts.length > 1 ? parts[1].trim() : '';

    if (service) {
        service = service
            .replace(/_/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
    }

    const servicePart = service ? ` (${service})` : '';
    return `Provider - ${provider}${servicePart}`;
}

function renderHistory(items) {
    historyList.innerHTML = '';

    if (!items || items.length === 0) {
        historyList.innerHTML = '<div class="empty-state">No history found for this user.</div>';
        return;
    }

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';

        const origin = escapeHtml(item.tripRequest?.origin || item.origin || '—');
        const dest = escapeHtml(item.tripRequest?.destination || item.destination || '—');
        const rawChosen = item.chosenProviderId || item.chosenProvider || '—';
        const saved = Number(item.savings || 0).toFixed(2);
        const co2 = Number(item.co2EmissionKg || 0).toFixed(2);
        const co2Emoji = co2 > 50 ? '🌡️' : '🌱';
        const walked = item.walkedDistanceKm != null ? Number(item.walkedDistanceKm).toFixed(2) : null;

        const chosenText = formatChosenProvider(rawChosen);

        div.innerHTML = `
            <div class="top-row">
              <div>
                <div class="route">${origin} → ${dest}</div>
                <div class="date">${fmtDate(item.createdAt || item.timestamp || item.date)}</div>
                <div class="stats">
                  CO₂ Emission: ${co2Emoji} <strong>${co2} kg</strong>
                  ${walked !== null ? `<br>Walked: <strong>${walked} km</strong>` : ''}
                </div>
              </div>
              <div>
                <div class="savings">Saved ₹${saved}</div>
                <div style="color:var(--text-muted);font-size:0.95rem;text-align:right;margin-top:0.4rem;">
                  ${chosenText}
                </div>
              </div>
            </div>
        `;

        historyList.appendChild(div);
    });
}

async function loadHistory() {
    const userId = localStorage.getItem("userId");

    historyList.innerHTML = '<div class="empty-state">Loading history...</div>';

    try {
        const res = await fetch(API_BASE + '/api/v1/history/' + encodeURIComponent(userId));
        if (!res.ok) throw new Error('Failed: ' + res.status);
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data.items || []);
        renderHistory(items);
    } catch (err) {
        console.error(err);
        historyList.innerHTML = '<div class="empty-state" style="color:#dc2626">Failed to load history. Please try again.</div>';
    }
}
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  // Data hatao
  localStorage.removeItem("userId");
  sessionStorage.clear();

  // Sidha bhaga do
  window.location.href = "index.html";
});
