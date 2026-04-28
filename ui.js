/**
 * ui.js: Sayfa geçişleri ve verilerin ekrana yazdırılması.
 */

/**
 * Sayfalar arası geçişi yönetir.
 * @param {string} pageId - Görüntülenecek sayfanın ID'si
 */
function showPage(pageId) {
    // Tüm sayfaları gizle
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    
    // Hedef sayfayı göster
    const target = document.getElementById(pageId);
    if (target) target.classList.add('active');
    
    // Rota sayfalarından birine geçilirse seçim listelerini doldur
    if (pageId.includes('route')) {
        fillRouteSelects();
    }
}

/**
 * Rota analizi için uçak seçim listelerini (select) doldurur.
 */
function fillRouteSelects() {
    const paxSelect = document.getElementById('paxRouteSelect');
    const cargoSelect = document.getElementById('cargoRouteSelect');

    // Eğer listeler henüz dolmamışsa (sadece varsayılan seçenek varsa) doldur
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

/**
 * Bütçeye göre en karlı uçak önerilerini listeler.
 * @param {string} category - 'pax' veya 'cargo'
 */
function renderSuggestions(category, subType) {
    const typeKey = category === 'pax' ? 'passenger' : 'cargo';
    const inputId = category === 'pax' ? 'paxBudgetInput' : 'cargoBudgetInput';
    const resultId = category === 'pax' ? 'paxPlaneResult' : 'cargoPlaneResult';
    
    const budgetInput = document.getElementById(inputId);
    const container = document.getElementById(resultId);
    
    if (!budgetInput || !budgetInput.value) return alert("Lütfen bütçenizi girin!");
    
    const budget = parseFloat(budgetInput.value);
    // logic.js'deki fonksiyonu çağırıyoruz
    const results = getBestPlanesByType(budget, typeKey);
    
    if (results.length === 0) {
        container.innerHTML = "<p style='margin-top:20px; color:#64748b;'>Bu bütçeye uygun sonuç bulunamadı.</p>";
        return;
    }

    container.innerHTML = results.map(p => `
        <div class="result-item">
            <div>
                <strong style="font-size: 1.1rem;">${p.name}</strong><br>
                <small style="color: var(--success); font-weight: 600;">
                    En İyi Rota: ${p.origin} ➔ ${p.destination}
                </small>
            </div>
            <div style="text-align: right;">
                <span style="color: var(--primary); font-weight: bold; font-size: 1.1rem;">${p.roi} Gün</span><br>
                <small style="color: var(--text-muted);">$${p.price.toLocaleString()}</small>
            </div>
        </div>
    `).join('');
}

/**
 * Seçilen bir uçağın en karlı rotasını detaylandırır.
 * @param {string} category - 'pax' veya 'cargo'
 */
function renderRouteAnalysis(category) {
    const selectId = category === 'pax' ? 'paxRouteSelect' : 'cargoRouteSelect';
    const resultId = category === 'pax' ? 'paxRouteResult' : 'cargoRouteResult';
    
    const planeName = document.getElementById(selectId).value;
    const container = document.getElementById(resultId);
    
    if (!planeName) return alert("Lütfen bir uçak seçin!");
    
    // logic.js'deki analiz fonksiyonunu çağırıyoruz
    const best = analyzeBestRouteForPlane(planeName);
    
    if (best) {
        container.innerHTML = `
            <div class="result-item" style="display: block; border-left: 5px solid var(--success); margin-top: 20px;">
                <h4 style="margin-bottom: 15px;">${best.origin} ➔ ${best.destination}</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 0.95rem;">
                    <span><strong>Mesafe:</strong> ${best.distance} km</span>
                    <span><strong>Uçuş Süresi:</strong> ${best.flightTime} Saat</span>
                    <span><strong>Günlük Sefer:</strong> ${best.dailyTrips} Uçuş</span>
                    <span><strong>Günlük Net Kâr:</strong> <span style="color: var(--success); font-weight: bold;">$${parseInt(best.dailyProfit).toLocaleString()}</span></span>
                </div>
                <hr style="border: 0; border-top: 1px solid var(--border); margin: 20px 0;">
                <div style="text-align: center;">
                    <span style="color: var(--text-muted); font-size: 0.85rem;">Amorti Süresi (ROI)</span><br>
                    <strong style="color: var(--primary); font-size: 1.4rem;">${best.roiDays} GÜN</strong>
                </div>
            </div>
        `;
    } else {
        container.innerHTML = "<p style='margin-top:20px; color:#ef4444;'>Bu uçak için uygun rota bulunamadı (Menzil yetersiz olabilir).</p>";
    }
}

// Sayfa ilk yüklendiğinde seçim listelerini hazırla
window.onload = function() {
    fillRouteSelects();
};
