/**
 * ui.js: Sayfa geçişleri, listelerin doldurulması ve sonuçların gösterilmesi.
 */

// Sayfalar arası geçişi yönetir
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(pageId);
    if (target) target.classList.add('active');
    
    // Rota sayfasına geçilirse listeleri doldur
    if (pageId.includes('route')) {
        fillRouteSelects();
    }
}

// Seçim kutularını (select) uçak verileriyle doldurur
function fillRouteSelects() {
    const paxSelect = document.getElementById('paxRouteSelect');
    const cargoSelect = document.getElementById('cargoRouteSelect');

    if (paxSelect && paxSelect.options.length <= 1) {
        for (let name in aircraftData) {
            if (aircraftData[name].type === "passenger") {
                let opt = document.createElement('option');
                opt.value = name;
                opt.innerText = name;
                paxSelect.appendChild(opt);
            }
        }
    }

    if (cargoSelect && cargoSelect.options.length <= 1) {
        for (let name in aircraftData) {
            if (aircraftData[name].type === "cargo") {
                let opt = document.createElement('option');
                opt.value = name;
                opt.innerText = name;
                cargoSelect.appendChild(opt);
            }
        }
    }
}

// Uçak önerilerini bütçeye göre listeler
function renderSuggestions(category) {
    const typeKey = category === 'pax' ? 'passenger' : 'cargo';
    const inputId = category === 'pax' ? 'paxBudgetInput' : 'cargoBudgetInput';
    const resultId = category === 'pax' ? 'paxPlaneResult' : 'cargoPlaneResult';
    
    const budgetInput = document.getElementById(inputId);
    const container = document.getElementById(resultId);
    
    if (!budgetInput || !budgetInput.value) return alert("Lütfen bütçenizi girin!");
    
    const budget = Number(budgetInput.value);
    const results = getBestPlanesByType(budget, typeKey);
    
    if (results.length === 0) {
        container.innerHTML = "<p style='margin-top:20px; color:#64748b;'>Uygun uçak bulunamadı.</p>";
        return;
    }

    container.innerHTML = results.map(p => `
        <div class="result-item">
            <div>
                <strong style="font-size: 1.1rem;">${p.name}</strong><br>
                <small style="color: var(--success); font-weight: 600;">
                    Rota: ${p.origin} ➔ ${p.destination}
                </small>
            </div>
            <div style="text-align: right;">
                <span style="color: var(--primary); font-weight: bold; font-size: 1.1rem;">${p.roi} Gün</span><br>
                <small style="color: var(--text-muted);">$${p.price.toLocaleString()}</small>
            </div>
        </div>
    `).join('');
}

// Belirli bir uçak için en iyi rotayı analiz eder
function renderRouteAnalysis(category) {
    const selectId = category === 'pax' ? 'paxRouteSelect' : 'cargoRouteSelect';
    const resultId = category === 'pax' ? 'paxRouteResult' : 'cargoRouteResult';
    
    const planeName = document.getElementById(selectId).value;
    const container = document.getElementById(resultId);
    
    if (!planeName) return alert("Lütfen bir uçak seçin!");
    
    const best = analyzeBestRouteForPlane(planeName);
    
    if (best) {
        container.innerHTML = `
            <div class="result-item" style="display: block; border-left: 5px solid var(--success); margin-top: 20px;">
                <h4 style="margin-bottom: 10px;">${best.origin} ➔ ${best.destination}</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.9rem;">
                    <span><strong>Mesafe:</strong> ${best.distance} km</span>
                    <span><strong>Süre:</strong> ${best.flightTime} Saat</span>
                    <span><strong>Günlük Sefer:</strong> ${best.dailyTrips}</span>
                    <span><strong>Günlük Kâr:</strong> <span style="color:var(--success)">$${parseInt(best.dailyProfit).toLocaleString()}</span></span>
                </div>
                <hr style="border:0; border-top: 1px solid var(--border); margin:15px 0;">
                <div style="text-align:center">
                    <small style="color:var(--text-muted)">Amorti Süresi</small><br>
                    <strong style="color:var(--primary); font-size: 1.3rem;">${best.roiDays} GÜN</strong>
                </div>
            </div>
        `;
    }
}

// Sayfa yüklendiğinde listeleri hazırla
window.onload = fillRouteSelects;
