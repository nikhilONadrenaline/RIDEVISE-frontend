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

const API_BASE = window.location.hostname === "localhost" ? "" : "https://ridevise-backend.onrender.com";

const totalRequests = document.getElementById("totalRequests");
const avgSavings = document.getElementById("avgSavings");
const mostUsed = document.getElementById("mostUsed");
const chartLoading = document.getElementById("chartLoading");
const noDataMessage = document.getElementById("noDataMessage");

const co2Range = document.getElementById("co2Range");
const co2Canvas = document.getElementById("co2Chart");
const walkRange = document.getElementById("walkRange");
const walkCanvas = document.getElementById("walkChart");
const savingsCo2Canvas = document.getElementById("savingsCo2Chart");
const chartCanvas = document.getElementById("requestsChart");

let savingsCo2Chart = null;
let walkChart = null;
let co2Chart = null;
let providerChart = null;

const COLORS = [
    "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
    "#8c564b", "#e377c2", "#7f7f7f", "#17becf"
];

const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { position: "top", labels: { usePointStyle: true, pointStyle: "rectRounded", padding: 15, font: { size: 14, weight: 500 } } },
        tooltip: { backgroundColor: "rgba(255,255,255,0.9)", borderColor: "#ddd", borderWidth: 1, bodyColor: "#333", titleColor: "#333", padding: 10, cornerRadius: 8 }
    },
    scales: {
        x: { ticks: { font: { size: 12 } }, title: { display: true, text: "Date", font: { size: 14 } }, grid: { color: "#eef2f6" } },
        y: { ticks: { font: { size: 12 } }, title: { display: true, font: { size: 14 } }, grid: { color: "#eef2f6" } }
    }
};

function cleanProviderName(name) {
    return name
        .replace(/\s*\(mock\)/gi, '')
        .replace(/\s*\(Mock\)/g, '')
        .trim();
}

function formatMonth(dateStr) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function loadSummary(userId) {
    try {
        const res = await fetch(`${API_BASE}/api/v1/analytics/summary?userId=${userId}`);
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();

        totalRequests.textContent = data.totalRequests ?? "—";
        avgSavings.textContent = (data.averageSavings ?? 0).toFixed(2);
        mostUsed.textContent = data.mostUsedProvider ?? "—";
        document.getElementById("summaryCo2").textContent = `🌱 ${(data.co2SavedKg ?? 0)} kg`;
        document.getElementById("summaryWalked").textContent = `🚶 ${(data.walkedKm ?? 0)} km`;
        document.getElementById("summaryCalories").textContent = `🔥 ~${(data.caloriesBurned ?? 0)} kcal`;

        return (data.totalRequests ?? 0) > 0;
    } catch (e) {
        console.error(e);
        totalRequests.textContent = avgSavings.textContent = mostUsed.textContent = "—";
        document.getElementById("summaryCo2").textContent = document.getElementById("summaryWalked").textContent = document.getElementById("summaryCalories").textContent = "—";
        return false;
    }
}

async function loadProviderSavings(userId) {
    chartLoading.style.display = "flex";
    noDataMessage.style.display = "none";
    if (providerChart) providerChart.destroy();

    try {
        const res = await fetch(`${API_BASE}/api/v1/analytics/provider-savings-trend?userId=${userId}`);
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();

        if (!data.labels?.length || !data.datasets?.length) {
            noDataMessage.style.display = "block";
            return;
        }

        let lastValidIndex = 0;
        let hasAnyNonZero = false;

        data.datasets.forEach(ds => {
            ds.data.forEach((value, i) => {
                if (value > 0) {
                    hasAnyNonZero = true;
                    lastValidIndex = Math.max(lastValidIndex, i);
                }
            });
        });

        const finalLength = hasAnyNonZero ? Math.min(lastValidIndex + 3, data.labels.length) : data.labels.length;

        if (finalLength === 0) {
            noDataMessage.style.display = "block";
            return;
        }

        const trimmedLabels = data.labels.slice(0, finalLength).map(l => l.replace("#", ""));
        const chartData = data.datasets.map((ds, i) => ({
            label: cleanProviderName(ds.label),
            data: ds.data.slice(0, finalLength),
            borderColor: COLORS[i % COLORS.length],
            backgroundColor: `${COLORS[i % COLORS.length]}33`,
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 5
        }));

        providerChart = new Chart(chartCanvas.getContext("2d"), {
            type: "line",
            data: { labels: trimmedLabels, datasets: chartData },
            options: {
                ...commonOptions,
                scales: {
                    ...commonOptions.scales,
                    x: { ...commonOptions.scales.x, title: { ...commonOptions.scales.x.title, text: "Request Number" } },
                    y: { ...commonOptions.scales.y, title: { ...commonOptions.scales.y.title, text: "Cumulative Savings (₹)" } }
                }
            }
        });
    } catch (e) {
        console.error(e);
        noDataMessage.style.display = "block";
    } finally {
        chartLoading.style.display = "none";
    }
}

async function loadCo2Trend(userId) {
    const days = co2Range.value;
    try {
        const res = await fetch(`${API_BASE}/api/v1/analytics/co2-trend?userId=${userId}&days=${days}`);
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        if (!data.labels?.length) return;

        if (co2Chart) co2Chart.destroy();
        co2Chart = new Chart(co2Canvas.getContext("2d"), {
            type: "line",
            data: {
                labels: data.labels,
                datasets: [{ label: "CO₂ Emission (kg)", data: data.data, borderColor: "#2ca02c", backgroundColor: "rgba(44,160,44,0.1)", fill: true, borderWidth: 2 }]
            },
            options: {
                ...commonOptions,
                scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, title: { text: "CO₂ (kg)" } } }
            }
        });
    } catch (e) {}
}

async function loadWalkingTrend(userId) {
    const range = walkRange.value;
    try {
        const res = await fetch(`${API_BASE}/api/v1/analytics/walking-trend?userId=${userId}&range=${range}`);
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();

        const totalWalked = (data.distance || []).reduce((sum, v) => sum + Number(v || 0), 0);

        if (totalWalked <= 0) {
            walkCanvas.parentElement.innerHTML = `
                <div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#64748b;font-size:1.3rem;text-align:center;padding:2rem;background:linear-gradient(135deg,#f0f9ff,#e0f2fe);">
                    <div style="font-size:3.5rem;margin-bottom:1rem;">🏃‍♂️😴</div>
                    Got two legs doing nothing?<br>Start walking to activate this graph ✨
                </div>`;
            return;
        }

        if (!data.labels?.length) return;

        if (walkChart) walkChart.destroy();

        const isDayView = range === "day";
        walkChart = new Chart(walkCanvas.getContext("2d"), {
            type: isDayView ? "line" : "bar",
            data: {
                labels: data.labels,
                datasets: [
                    { label: "Distance Walked (km)", data: data.distance.map(Number), borderColor: "#1f77b4", backgroundColor: isDayView ? "rgba(31,119,180,0.15)" : "rgba(31,119,180,0.75)", fill: isDayView, yAxisID: "y" },
                    { label: "Calories Burned (kcal)", data: data.calories.map(Number), borderColor: "#ff7f0e", backgroundColor: isDayView ? "rgba(255,127,14,0.15)" : "rgba(255,127,14,0.75)", fill: isDayView, yAxisID: "y1" }
                ]
            },
            options: {
                ...commonOptions,
                scales: {
                    y: { title: { text: "Distance (km)", color: "#1f77b4" }, position: "left" },
                    y1: { title: { text: "Calories (kcal)", color: "#ff7f0e" }, position: "right", grid: { drawOnChartArea: false } }
                }
            }
        });
    } catch (e) {
        console.error(e);
    }
}

async function loadSavingsVsCo2(userId) {
    try {
        const res = await fetch(`${API_BASE}/api/v1/analytics/savings-vs-co2?userId=${userId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data.points?.length) return;

        if (savingsCo2Chart) savingsCo2Chart.destroy();
        savingsCo2Chart = new Chart(savingsCo2Canvas.getContext("2d"), {
            type: "scatter",
            data: { datasets: [{ label: "Trips", data: data.points, backgroundColor: "#9467bd", pointRadius: 6 }] },
            options: {
                ...commonOptions,
                scales: {
                    x: { ...commonOptions.scales.x, title: { text: "Savings (₹)" } },
                    y: { ...commonOptions.scales.y, title: { text: "CO₂ Emission (kg)" } }
                }
            }
        });
    } catch (e) {}
}

window.addEventListener("load", async () => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
        window.location.href = "login.html";
        return;
    }

    document.getElementById("analyticsUserId").value = userId;

    chartLoading.style.display = "flex";

    const hasData = await loadSummary(userId);

    if (hasData) {
        await Promise.all([
            loadProviderSavings(userId),
            loadCo2Trend(userId),
            loadWalkingTrend(userId),
            loadSavingsVsCo2(userId)
        ]);
    }

    chartLoading.style.display = "none";
});
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  // Data hatao
  localStorage.removeItem("userId");
  sessionStorage.clear();

  // Sidha bhaga do
  window.location.href = "index.html";
});

co2Range.addEventListener("change", () => loadCo2Trend(localStorage.getItem("userId")));
walkRange.addEventListener("change", () => loadWalkingTrend(localStorage.getItem("userId")));
