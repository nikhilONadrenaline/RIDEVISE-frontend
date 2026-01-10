const API_BASE =
  window.location.hostname === "localhost"
    ? ""
    : "https://ridevise-backend.onrender.com";

// ====================
// STORAGE KEYS - Sirf sessionStorage use karenge
// ====================
const STORAGE_KEYS = {
  LAST_COMPARE_STATE: 'lastCompareState' // sab kuch yahin save hoga
};

// DOM Elements
const providersList = document.getElementById("providersList");
const categoryHeadings = document.getElementById("categoryHeadings");
const metaLine = document.getElementById("metaLine");
const resultsCount = document.getElementById("resultsCount");
const mapContainer = document.getElementById("mapContainer");
const confirmChoiceBtn = document.getElementById("confirmChoiceBtn");
const errorMessages = document.getElementById("errorMessages");
const choiceSavedOverlay = document.getElementById("choiceSavedOverlay");
const savedDetails = document.getElementById("savedDetails");
const closeSavedBtn = document.getElementById("closeSaved");
const detailOverlay = document.getElementById("detailOverlay");
const detailHeader = document.getElementById("detailHeader");
const detailBody = document.getElementById("detailBody");

// Height sync elements
const providersCard = document.querySelector("#resultsCard");
const mapCard = document.querySelector(".map-wrapper > .card");
const disclaimerBox = document.getElementById("disclaimerBox");

// State variables
let selectedProviderId = null;
let lastRequestPayload = null;
let lastSnapshotId = null;
let currentProvidersData = [];
let hasMetroOrWalk = false;
let fixedProvidersHeight = null;

// =============================================
// PAGE LOAD - State Restore + UserId Check
// =============================================
window.addEventListener('load', () => {
  // 1. Session se state restore attempt
  const savedState = sessionStorage.getItem(STORAGE_KEYS.LAST_COMPARE_STATE);
  if (savedState) {
    try {
      const parsed = JSON.parse(savedState);
      const payload = parsed.payload;
      // Form inputs wapas bharo
      if (payload?.origin) {
        document.getElementById('heroOrigin').value = payload.origin;
      }
      if (payload?.destination) {
        document.getElementById('heroDestination').value = payload.destination;
      }
      // State variables restore
      lastRequestPayload = payload;
      lastSnapshotId = parsed.data?.snapshotId;
      currentProvidersData = parsed.data?.sortedFares || [];
      // UI update
      metaLine.textContent = `Distance: ${parsed.data?.totalDistanceKm ?? "-"} km`;
      metaLine.style.fontSize = "1.2rem";
      metaLine.style.fontWeight = "700";
      metaLine.style.color = "#111827";
      resultsCount.textContent = parsed.data?.sortedFares?.length || 0;
      renderProviders(
        parsed.data?.sortedFares || [],
        parsed.data?.recommendation?.chosenProviderId || null,
        parsed.data?.totalDistanceKm
      );
      // Selected provider highlight restore
      if (parsed.selectedProviderId) {
        selectedProviderId = parsed.selectedProviderId;
        document.querySelector(`.provider-card[data-provider-id="${selectedProviderId}"]`)
          ?.classList.add('selected');
      }
      // Map restore
      if (payload?.origin && payload?.destination) {
        updateRouteMap(payload.origin, payload.destination);
      }
      // Scroll to results
      document.body.classList.remove("lock-scroll");
      document.getElementById("resultsSection")?.scrollIntoView({ behavior: "smooth" });
      setTimeout(syncMapHeight, 400);
      console.log("Restored from same session ✓");
    } catch (e) {
      console.warn("Saved state corrupt → fresh start", e);
      clearSessionState();
    }
  } else {
    // Bilkul fresh tab/session
    document.getElementById('heroOrigin').value = '';
    document.getElementById('heroDestination').value = '';
    console.log("Fresh session — clean slate");
  }

  // UserId check (login flow)
  const userId = localStorage.getItem("userId");
  if (!userId) {
    window.location.href = "login.html";
    return;
  }
  const userIdInput = document.getElementById("heroUserId");
  if (userIdInput) {
    userIdInput.value = userId;
    userIdInput.readOnly = true;
    userIdInput.style.background = "#f3f4f6";
    userIdInput.style.cursor = "not-allowed";
  }

  // Initial height sync
  setTimeout(syncMapHeight, 500);

  // Initialize sidebar
  initSidebar();
});

// =============================================
// FORM SUBMIT - New Search
// =============================================
document.getElementById("heroForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const origin = document.getElementById("heroOrigin").value.trim();
  const destination = document.getElementById("heroDestination").value.trim();
  const userId = document.getElementById("heroUserId").value.trim() || null;

  if (!origin || !destination) return;

  const payload = {
    userId,
    origin,
    destination,
    departureTime: null,
    preferCheapest: true,
    preferFastest: false,
  };

  lastRequestPayload = payload;
  doCompare(payload);

  // Scroll with lock removal
  const resultsSection = document.getElementById("resultsSection");
  resultsSection.scrollIntoView({ behavior: "smooth" });

  const removeLock = () => {
    document.body.classList.remove("lock-scroll");
    window.removeEventListener("scrollend", removeLock);
  };
  window.addEventListener("scrollend", removeLock, { once: true });
  setTimeout(removeLock, 1200); // fallback
});

// =============================================
// MAIN COMPARE FUNCTION
// =============================================
async function doCompare(payload) {
  providersList.innerHTML = '<div class="text-muted" style="padding:1rem; grid-column: 1 / -1;">Loading providers...</div>';
  categoryHeadings.innerHTML = "";
  selectedProviderId = null;
  hasMetroOrWalk = false;
  fixedProvidersHeight = null;

  try {
    const res = await fetch(API_BASE + "/api/v1/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("HTTP " + res.status);

    const data = await res.json();
    lastSnapshotId = data.snapshotId;
    currentProvidersData = data.sortedFares || [];

    metaLine.textContent = `Distance: ${data.totalDistanceKm ?? "-"} km`;
    metaLine.style.fontSize = "1.2rem";
    metaLine.style.fontWeight = "700";
    metaLine.style.color = "#111827";

    resultsCount.textContent = data.sortedFares?.length || 0;

    renderProviders(
      data.sortedFares || [],
      data.recommendation?.chosenProviderId || null,
      data.totalDistanceKm
    );

    updateRouteMap(payload.origin, payload.destination);

    // Full state save to sessionStorage only
    sessionStorage.setItem(STORAGE_KEYS.LAST_COMPARE_STATE, JSON.stringify({
      payload: payload,
      data: data,
      selectedProviderId: selectedProviderId || null
    }));

    setTimeout(syncMapHeight, 300);
  } catch (err) {
    console.error(err);
    providersList.innerHTML =
      '<div class="text-muted" style="padding:1rem; grid-column: 1 / -1;">Service temporarily unavailable.</div>';
  }
}

// =============================================
// UTILITY FUNCTIONS
// =============================================
function formatCO2(p) {
  const co2 = p?.metadata?.co2EmissionKg;
  if (typeof co2 !== "number") return "-";
  return `${co2.toFixed(2)} kg`;
}

function syncMapHeight() {
  if (!providersCard || !mapCard) return;
  const isDisclaimerOpen = disclaimerBox.classList.contains("show");
  if (!isDisclaimerOpen && fixedProvidersHeight === null) {
    fixedProvidersHeight = providersCard.offsetHeight;
  }
  if (fixedProvidersHeight !== null) {
    mapCard.style.height = fixedProvidersHeight + "px";
    mapCard.style.minHeight = fixedProvidersHeight + "px";
  }
}

function escapeHtml(s) {
  return String(s || "").replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[m])
  );
}

function updateRouteMap(origin, destination) {
  if (!origin || !destination) return;
  const iframe = document.createElement("iframe");
  iframe.width = "100%";
  iframe.height = "100%";
  iframe.style.border = "0";
  iframe.loading = "lazy";
  iframe.src = `https://www.google.com/maps?q=${encodeURIComponent(
    origin + " to " + destination
  )}&output=embed`;
  mapContainer.innerHTML = "";
  mapContainer.appendChild(iframe);
  setTimeout(syncMapHeight, 500);
}

function clearSessionState() {
  sessionStorage.removeItem(STORAGE_KEYS.LAST_COMPARE_STATE);
}

function createProviderCard(p, recommendedId, fastestProviderId) {
  const el = document.createElement("div");
  el.className = "provider-card";
  el.dataset.providerId = p.providerId;
  el.dataset.providerData = JSON.stringify(p);

  const surgeHtml = p.isSurge ? '<div class="surge">Surge</div>' : "";

  // Removed ETA line, added CO2 instead
  const co2 = formatCO2(p);
  const co2Emoji = co2 === "-" ? "" : (parseFloat(co2) <= 3 ? "🌱 CO<sub>2</sub> -" : "🌡️ CO<sub>2</sub> -");
  const co2Html = `<div class="co2-info ${co2 === "-" ? "text-muted" : ""}">
    ${co2Emoji} ${co2}
  </div>`;

  el.innerHTML = `
    ${surgeHtml}
    <div class="provider-name">
      ${escapeHtml(p.displayName || p.providerName)}
      ${p.providerId === recommendedId ? '<span class="best-badge">Best</span>' : ''}
      ${p.providerId === fastestProviderId ? '<span class="fastest-icon">Fastest</span>' : ''}
    </div>
    <div class="fare">₹${Number(p.price).toFixed(2)}</div>
    ${co2Html}
  `;

  return el;
}

// =============================================
// RENDER PROVIDERS
// =============================================
function renderProviders(
  sortedFares = [],
  recommendedId = null,
  totalDistanceKm = null
) {
  let fastestProviderId = null;
  let minEta = Infinity;

  sortedFares.forEach((p) => {
    if (typeof p.etaMinutes === "number" && p.etaMinutes < minEta) {
      minEta = p.etaMinutes;
      fastestProviderId = p.providerId;
    }
  });

  providersList.innerHTML = "";
  categoryHeadings.innerHTML = "";
  providersList.className = "columns-grid";

  if (!sortedFares || sortedFares.length === 0) {
    providersList.innerHTML =
      '<div class="text-muted" style="padding:1rem; grid-column: 1 / -1;">No providers available for this route.</div>';
    return;
  }

  // ── Groups banaye ──
  let groups = { bike: [], auto: [], car: [], metro: [] };
  let walkOption = null;

  sortedFares.forEach((p) => {
    let type = (p.vehicleType || p.vehicle_type || "").toLowerCase();
    if (type.includes("bike")) groups.bike.push(p);
    else if (type.includes("auto") || type.includes("rickshaw"))
      groups.auto.push(p);
    else if (
      type.includes("car") ||
      type.includes("cab") ||
      type.includes("sedan") ||
      type.includes("prime")
    )
      groups.car.push(p);
    else if (type.includes("metro")) groups.metro.push(p);
    else if (type.includes("walk")) walkOption = p;
  });

  hasMetroOrWalk =
    groups.metro.length > 0 || (walkOption && totalDistanceKm <= 3);

  Object.keys(groups).forEach((key) =>
    groups[key].sort((a, b) => a.price - b.price)
  );

  sortedFares.forEach((p) => {
    p.displayName = p.providerName.replace(/\s*\(Mock\)/gi, "");
  });

  // Car category classification
  const allCarProviders = groups.car;
  allCarProviders.forEach((p) => {
    const nameLower = (p.providerName || "").toLowerCase();
    if (nameLower.includes("prime") || nameLower.includes("premier") || nameLower.includes("premium")) {
      p.cabCategory = "Premium Cab";
    } else if (nameLower.includes("mini") || nameLower.includes("go")) {
      p.cabCategory = "Economy Cab";
    } else {
      p.cabCategory = "Economy Cab";
    }
  });

  // Uber special handling
  const uberCars = allCarProviders.filter(p => (p.providerName || "").toLowerCase().includes("uber"));
  if (uberCars.length >= 2) {
    const minUber = uberCars.reduce((prev, curr) => prev.price < curr.price ? prev : curr);
    const maxUber = uberCars.reduce((prev, curr) => prev.price > curr.price ? prev : curr);
    minUber.cabCategory = "Economy Cab";
    maxUber.cabCategory = "Premium Cab";
  }

  // Rapido special handling
  const rapidoCars = allCarProviders.filter(p => (p.providerName || "").toLowerCase().includes("rapido"));
  if (rapidoCars.length >= 2) {
    const minRapido = rapidoCars.reduce((prev, curr) => prev.price < curr.price ? prev : curr);
    const maxRapido = rapidoCars.reduce((prev, curr) => prev.price > curr.price ? prev : curr);
    minRapido.cabCategory = "Economy Cab";
    maxRapido.cabCategory = "Premium Cab";
  }

  // Grid setup
  providersList.style.gridTemplateColumns = "1fr 1fr 2fr";
  providersList.style.gap = "1rem";
  providersList.style.alignContent = "start";

  const categories = [
    { key: "bike", title: "Bike", emoji: "🏍️" },
    { key: "auto", title: "Auto", emoji: "🛺" },
  ];

  // Bike aur Auto columns
  categories.forEach((cat) => {
    if (groups[cat.key].length === 0) return;
    const col = document.createElement("div");
    col.style.display = "flex";
    col.style.flexDirection = "column";
    col.style.gap = "0.6rem";
    col.style.flex = "1";

    const head = document.createElement("div");
    head.className = "category-column-heading";
    head.textContent = `${cat.emoji} ${cat.title}`;
    col.appendChild(head);

    groups[cat.key].forEach((p) => {
      const card = createProviderCard(p, recommendedId, fastestProviderId);
      col.appendChild(card);
    });

    const spacer = document.createElement("div");
    spacer.style.flexGrow = "1";
    col.appendChild(spacer);

    providersList.appendChild(col);
  });

  // METRO / WALK COLUMN
  const metroCol = document.createElement("div");
  metroCol.style.gridColumn = "1 / 3";
  metroCol.style.display = "flex";
  metroCol.style.flexDirection = "column";
  metroCol.style.gap = "0.6rem";

  const metroHead = document.createElement("div");
  metroHead.className = "category-column-heading";
  metroHead.textContent = "🚇 Metro / 🚶‍♂️ Walk";
  metroCol.appendChild(metroHead);

  if (groups.metro.length > 0) {
    groups.metro.forEach((p) => {
      const card = createProviderCard(p, recommendedId, fastestProviderId);
      metroCol.appendChild(card);
    });
  } else {
    const noMetro = document.createElement("div");
    noMetro.className = "no-option-message";
    noMetro.textContent = "No metro in this route";
    metroCol.appendChild(noMetro);
  }

  if (walkOption && totalDistanceKm <= 3) {
    const walkCard = document.createElement("div");
    walkCard.className = "provider-card walk";
    walkCard.dataset.providerId = walkOption.providerId;
    walkCard.dataset.providerData = JSON.stringify(walkOption);

    walkCard.innerHTML = `
      <div class="provider-name">Walk 🌱</div>
      <div class="fare">₹0.00</div>
      <div class="text-muted" style="font-size:0.85rem;">
        Eco-friendly & Healthy
      </div>
    `;
    metroCol.appendChild(walkCard);
  } else {
    const noWalk = document.createElement("div");
    noWalk.className = "no-option-message";
    noWalk.textContent = "Too much distance to 🚶‍♂️";
    metroCol.appendChild(noWalk);
  }

  providersList.appendChild(metroCol);

  // CAR SECTION
  if (groups.car.length > 0) {
    const carContainer = document.createElement("div");
    carContainer.className = "car-main-container";
    carContainer.style.gridColumn = "3 / 4";
    carContainer.style.gridRow = "1 / -1";
    carContainer.style.display = "flex";
    carContainer.style.flexDirection = "column";
    carContainer.style.gap = "1rem";

    const subColumns = document.createElement("div");
    subColumns.style.display = "grid";
    subColumns.style.gridTemplateColumns = "1fr 1fr";
    subColumns.style.gap = "1rem";
    subColumns.style.flex = "1";

    // Economy
    const ecoCol = document.createElement("div");
    ecoCol.className = "economy-subcolumn";
    ecoCol.style.display = "flex";
    ecoCol.style.flexDirection = "column";
    ecoCol.style.gap = "0.6rem";
    ecoCol.style.padding = "0";
    const ecoHead = document.createElement("div");
    ecoHead.className = "category-column-heading";
    ecoHead.style.fontSize = "1.1rem";
    subColumns.style.gap = "1rem";
    ecoHead.textContent = "🚕 Economy Cab";
    ecoCol.appendChild(ecoHead);

    // Premium
    const premCol = document.createElement("div");
    premCol.className = "premium-subcolumn";
    premCol.style.display = "flex";
    premCol.style.flexDirection = "column";
    premCol.style.gap = "0.6rem";
    premCol.style.padding = "0";
    const premHead = document.createElement("div");
    premHead.className = "category-column-heading";
    premHead.style.fontSize = "1.1rem";
    subColumns.style.gap = "1rem";
    premHead.textContent = "🚘 Premium Cab";
    premCol.appendChild(premHead);

    // Cards add karo
    allCarProviders.forEach((p) => {
        const card = createProviderCard(p, recommendedId, fastestProviderId);
        if (p.cabCategory === "Economy Cab") {
            ecoCol.appendChild(card);
        } else {
            premCol.appendChild(card);
        }
    });

    subColumns.appendChild(ecoCol);
    subColumns.appendChild(premCol);
    carContainer.appendChild(subColumns);
    providersList.appendChild(carContainer);
  }

  // Cards ko proper width
  const cards = providersList.querySelectorAll(".provider-card");
  cards.forEach((card) => {
    card.style.width = "100%";
    card.style.flex = "0 0 auto";
  });

  setTimeout(syncMapHeight, 100);
}

// =============================================
// PROVIDER CARD CLICK → DETAIL MODAL
// =============================================
providersList.addEventListener("click", (e) => {
  const card = e.target.closest(".provider-card");
  if (!card) return;

  const providerId = card.dataset.providerId;
  const data = JSON.parse(card.dataset.providerData || "{}");

  if (selectedProviderId === providerId) {
    selectedProviderId = null;
    card.classList.remove("selected");
  } else {
    selectedProviderId = providerId;
    document
      .querySelectorAll(".provider-card")
      .forEach((c) => c.classList.remove("selected"));
    card.classList.add("selected");
  }

  showDetailModal(data);
});

function showDetailModal(p) {
  let typeEmoji = "🚗";
  let category = "";

  const type = (p.vehicleType || p.vehicle_type || "").toLowerCase();

  if (type.includes("bike")) {
    typeEmoji = "🏍️";
    category = "Bike Taxi";
  } else if (type.includes("auto") || type.includes("rickshaw")) {
    typeEmoji = "🛺";
    category = "Auto Rickshaw";
  } else if (type.includes("metro")) {
    typeEmoji = "🚇";
    category = "Metro Rail";
  } else if (type.includes("walk")) {
    typeEmoji = "🚶";
    category = "Walking";
  } else if (type.includes("car") || type.includes("cab")) {
    const providerNameLower = (p.providerName || "").toLowerCase();
    const displayNameLower = (
      p.displayName ||
      p.providerName ||
      ""
    ).toLowerCase();

    if (
      providerNameLower.includes("prime") ||
      providerNameLower.includes("premier") ||
      providerNameLower.includes("premium") ||
      displayNameLower.includes("prime")
    ) {
      category = "Premium Cab";
    } else if (providerNameLower.includes("uber") || displayNameLower.includes("uber")) {
      const uberProviders = currentProvidersData.filter((prov) => {
        const name = (
          prov.providerName ||
          prov.displayName ||
          ""
        ).toLowerCase();
        return name.includes("uber");
      });
      if (uberProviders.length >= 2) {
        const maxUberPrice = Math.max(
          ...uberProviders.map((prov) => Number(prov.price || 0))
        );
        if (Number(p.price) === maxUberPrice) {
          category = "Premium Cab";
        } else {
          category = "Economy Cab";
        }
      } else {
        category = "Economy Cab";
      }
    } else if (providerNameLower.includes("rapido") || displayNameLower.includes("rapido")) {
      const rapidoProviders = currentProvidersData.filter((prov) => {
        const name = (
          prov.providerName ||
          prov.displayName ||
          ""
        ).toLowerCase();
        return name.includes("rapido");
      });
      if (rapidoProviders.length >= 2) {
        const maxRapidoPrice = Math.max(
          ...rapidoProviders.map((prov) => Number(prov.price || 0))
        );
        if (Number(p.price) === maxRapidoPrice) {
          category = "Premium Cab";
        } else {
          category = "Economy Cab";
        }
      } else {
        category = "Economy Cab";
      }
    } else {
      category = "Economy Cab";
    }
  }

  const displayName = p.displayName || p.providerName || "Unknown";

  detailHeader.innerHTML = `${typeEmoji} ${escapeHtml(
    displayName
  )} <span style="font-weight:400; color:#666;">(${category})</span>`;

  const co2 = formatCO2(p);
  const isEco = co2.includes("-") ? false : parseFloat(co2) <= 3;
  const co2Emoji = isEco ? "🌱" : "🌡️";
  let ecoText = "";
  if (type.includes("metro")) {
    ecoText = `Taking the metro is the most eco-friendly option with virtually zero direct CO2 emissions.`;
  } else if (type.includes("walk")) {
    ecoText = `Walking is the healthiest and most eco-friendly option with zero CO2 emissions.`;
  } else {
    ecoText = isEco
      ? `This ${category.toLowerCase()} option has relatively lower CO2 emissions.`
      : `This ${category.toLowerCase()} option has higher CO2 emissions. Consider greener options if available.`;
  }

  let arrivalLine = "";
  if (!type.includes("walk") && !type.includes("metro")) {
    arrivalLine = `<div class="detail-info">⏱️ Arrival Time: <strong>${
      p.etaMinutes ?? "-"
    } minutes</strong></div>`;
  }

  detailBody.innerHTML = `
    <div class="detail-info">💰 Fare: <strong>₹ ${Number(p.price).toFixed(
      2
    )}</strong></div>
    ${arrivalLine}
    <div class="detail-info">${co2Emoji} CO2 Emission: <strong>${co2}</strong></div>
    <div class="detail-eco-text">${ecoText}</div>
  `;

  detailOverlay.classList.add("show");
}

// Detail modal close
document.querySelector(".detail-close").addEventListener("click", () => {
  detailOverlay.classList.remove("show");
});

detailOverlay.addEventListener("click", (e) => {
  if (e.target === detailOverlay) detailOverlay.classList.remove("show");
});

// =============================================
// CONFIRM CHOICE
// =============================================
confirmChoiceBtn.addEventListener("click", async () => {
  errorMessages.innerHTML = "";
  let errors = [];

  if (!lastRequestPayload?.userId)
    errors.push("Enter UserID to save choices");
  if (!selectedProviderId)
    errors.push("Please select a option before confirming");

  if (errors.length > 0) {
    errorMessages.innerHTML = errors
      .map((err) => `<p>${err}</p>`)
      .join("");
    return;
  }

  if (!lastSnapshotId) return;

  const selectedProvider = currentProvidersData.find(
    (p) => p.providerId === selectedProviderId
  );

  const payload = {
    userId: lastRequestPayload.userId,
    origin: lastRequestPayload.origin,
    destination: lastRequestPayload.destination,
    departureTime: lastRequestPayload.departureTime,
    snapshotId: lastSnapshotId,
    chosenProviderId: selectedProviderId,
  };

  try {
    const res = await fetch(API_BASE + "/api/v1/compare/choose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      document
        .querySelectorAll(".provider-card")
        .forEach((c) => c.classList.remove("selected"));

      document
        .querySelector(
          `.provider-card[data-provider-id="${selectedProviderId}"]`
        )
        ?.classList.add("confirmed");

      const rawName = selectedProvider?.providerName || selectedProviderId || 'Unknown';
      const providerName = escapeHtml(rawName.replace(/\s*\(Mock\)/gi, '').trim());
      const price = Number(selectedProvider?.price || 0).toFixed(2);
      const origin = escapeHtml(lastRequestPayload.origin);
      const destination = escapeHtml(lastRequestPayload.destination);
      const vehicleType = (selectedProvider?.vehicleType || selectedProvider?.vehicle_type || '').toLowerCase();

      let vehicleLine = '';
      if (vehicleType.includes('bike')) {
        vehicleLine = '<div style="margin-bottom: 1rem; color: #374151; font-size: 1rem;">Vehicle: Bike</div>';
      } else if (vehicleType.includes('auto') || vehicleType.includes('rickshaw')) {
        vehicleLine = '<div style="margin-bottom: 1rem; color: #374151; font-size: 1rem;">Vehicle: Auto Rickshaw</div>';
      } else if (vehicleType.includes('car') || vehicleType.includes('cab') || vehicleType.includes('sedan') || vehicleType.includes('prime')) {
        vehicleLine = '<div style="margin-bottom: 1rem; color: #374151; font-size: 1rem;">Vehicle: Car</div>';
      }

      savedDetails.innerHTML = `
        <div style="margin-bottom: 0.8rem; font-size: 1.1rem; font-weight: 500;">
            ${providerName} - ₹${price}
        </div>
        ${vehicleLine}
        <div style="margin-bottom: 1rem; color: #6b7280;">
            ${origin} → ${destination}
        </div>
        <div style="font-size: 0.9rem; color: #4b5563;">
            Your choice has been saved to your history.
        </div>
      `;

      choiceSavedOverlay.classList.add("show");
    }
  } catch (e) {
    console.error(e);
    alert("Error saving choice.");
  }
});

closeSavedBtn.addEventListener("click", () => {
  choiceSavedOverlay.classList.remove("show");
});

choiceSavedOverlay.addEventListener("click", (e) => {
  if (!e.target.closest(".saved-card"))
    choiceSavedOverlay.classList.remove("show");
});

// =============================================
// DISCLAIMER TOGGLE
// =============================================
document
  .getElementById("toggleDisclaimer")
  .addEventListener("click", () => {
    disclaimerBox.classList.toggle("show");
    setTimeout(syncMapHeight, 150);
  });

// =============================================
// BACKGROUND TRAIL ANIMATION
// =============================================
(function () {
  const canvas = document.getElementById("trail-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let trails = [];
  const dpr = window.devicePixelRatio || 1;
  let stopAnimate = false;

  function resize() {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    ctx.scale(dpr, dpr);
  }

  window.addEventListener("resize", resize);
  resize();

  const bgImage = new Image();
  bgImage.src = "bg.jpg";

  let isMoving = false;
  window.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    isMoving = true;

    if (
      trails.length === 0 ||
      Math.hypot(
        trails[trails.length - 1].x - mouseX / dpr,
        trails[trails.length - 1].y - mouseY / dpr
      ) > 8
    ) {
      trails.push({ x: mouseX / dpr, y: mouseY / dpr, age: 0 });
    }
  });

  function animate() {
    if (stopAnimate) return;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    ctx.drawImage(bgImage, 0, 0, canvas.width / dpr, canvas.height / dpr);

    if (trails.length > 1) {
      ctx.lineWidth = 2.5;
      ctx.setLineDash([10, 12]);
      ctx.lineDashOffset = (-Date.now() / 40) % 22;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (let i = trails.length - 2; i >= 0; i--) {
        const progressFromTail = (trails.length - 2 - i) / (trails.length - 2);
        const opacity = 1 - progressFromTail;
        ctx.strokeStyle = `rgba(100, 130, 160, ${opacity * 0.8})`;
        ctx.beginPath();
        ctx.moveTo(trails[i].x, trails[i].y);
        ctx.lineTo(trails[i + 1].x, trails[i + 1].y);
        ctx.stroke();
      }
    }

    trails = trails.filter((p) => {
      p.age++;
      return p.age < 70;
    });

    if (!isMoving && trails.length > 0) {
      trails.forEach((p) => (p.age += 4));
    }

    requestAnimationFrame(animate);
  }

  bgImage.onload = () => {
    animate();
  };

  if (bgImage.complete && bgImage.naturalWidth > 0) {
    animate();
  }

  window.addEventListener("click", () => {
    trails = [];
  });

  delete window.stopTrail;
})();

// =============================================
// DEMO BUTTONS
// =============================================
document.querySelectorAll(".demo-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.getElementById("heroOrigin").value = btn.dataset.origin;
    document.getElementById("heroDestination").value =
      btn.dataset.destination;
    document
      .getElementById("heroForm")
      .dispatchEvent(new Event("submit"));
  });
});

// =============================================
// RESIZE LISTENER
// =============================================
window.addEventListener("resize", () => {
  setTimeout(syncMapHeight, 100);
});

// =============================================
// LOGOUT FUNCTION
// =============================================
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  // Data hatao
  localStorage.removeItem("userId");
  sessionStorage.clear();

  // Sidha bhaga do
  window.location.href = "index.html";
});

// =============================================
// SIDEBAR FUNCTIONALITY (from contact page)
// =============================================
function initSidebar() {
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
}

console.log("RideVise full JS loaded - session-only state - CO2 version");
