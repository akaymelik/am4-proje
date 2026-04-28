/**
 * ui.js: Sayfa geçişleri, dinamik liste dolumu ve sonuçların ekrana basılması.
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
    
    // Rota analiz sayfasına geçildiyse seçim kutularını doldur
    if (pageId.includes('route')) {
        fillRouteSelects();
    }
}

/**
 * Rota analizi için uçak seçim listelerini uçak tipine göre doldurur.
 */
function fillRouteSelects() {
    const paxSelect = document.getElementById('paxRouteSelect');
    const cargoSelect = document.getElementById('cargoRouteSelect');

    // Eğer listeler boşsa (sadece varsayılan seçenek varsa) doldur
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
 * Bütçeye göre en verimli uçak önerilerini listeler.
 * @param {string} category - 'pax' veya 'cargo'
 */
function renderSuggestions(category) {
    const typeKey = category === 'pax' ? 'passenger' : 'cargo';
    const inputId = category === 'pax' ? 'paxBudgetInput' : 'cargoBudgetInput';
    const resultId = category === 'pax' ? 'paxPlaneResult' : 'cargoPlaneResult';
    
    const budgetInput = document.getElementById(inputId);
    const container = document.getElementById(resultId);
    
    if (!budgetInput || !budgetInput.value) {
        return alert("Lütfen analize başlamak için bir bütçe girin!");
    }
    
    const budget = Number(budgetInput.value);
    // logic.js içindeki verimlilik odaklı fonksiyonu çağırıyoruz
    const results = getBestPlanesByType(budget, typeKey);
    
    if (results.length === 0) {
        container.innerHTML = "<p style='margin-top:20px; color: #64748b;'>Bu bütçeye uygun uçak bulunamadı.</p>";
        return;
    }

    // Sonuçları HTML olarak ekrana bas
    container.innerHTML = results.map(p => `
        <div class="result-item">
            <div>
                <strong style="font-size: 1.1rem; color: #1e293b;">${p.name}</strong><br>
                <small style="color: var(--success); font-weight: 600;">
                    En Karlı Rota: ${p.origin} ➔ ${p.destination}
                </small>
            </div>
            <div style="text-align: right;">
                <span style="color: var(--primary); font-weight: bold; font-size: 1.1rem;">%${p.efficiency.toFixed(3)} Verim</span><br>
                <small style="color: var(--text-muted);">${p.roi} Gün Amorti</small>
            </div>
        </div>
    `).join('');
}

/**
 * Seçilen bir uçağın en karlı rota detaylarını gösterir.
 * @param {string} category - 'pax' veya 'cargo'
 */
function renderRouteAnalysis(category) {
    const selectId = category === 'pax' ? 'paxRouteSelect' : 'cargoRouteSelect';
    const resultId = category === 'pax' ? 'paxRouteResult' : 'cargoRouteResult';
    
    const planeName = document.getElementById(selectId).value;
    const container = document.getElementById(resultId);
    
    if (!planeName) return alert("Lütfen bir uçak seçin!");
    
    // logic.js içindeki rota analiz fonksiyonunu çağırıyoruz
    const best = analyzeBestRouteForPlane(planeName);
    
    if (best) {
        container.innerHTML = `
            <div class="result-item" style="display: block; border-left: 5px solid var(--success); margin-top: 20px;">
                <div style="margin-bottom: 15px;">
                    <h4 style="margin: 0; color: #1e293b;">Rota: ${best.origin} ➔ ${best.destination}</h4>
                    <small style="color: var(--text-muted);">Bu uçak için veritabanındaki en karlı sonuç.</small>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 0.95rem;">
                    <span><strong>Mesafe:</strong> ${best.distance} km</span>
                    <span><strong>Sefer Süresi:</strong> ${best.flightTime} Saat</span>
                    <span><strong>Günlük Sefer:</strong> ${best.dailyTrips} Sefer</span>
                    <span><strong>Günlük Net Kâr:</strong> <span style="color: var(--success); font-weight: bold;">$${parseInt(best.dailyProfit).toLocaleString()}</span></span>
                </div>

                <hr style="border: 0; border-top: 1px solid var(--border); margin: 20px 0;">
                
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <small style="display: block; color: var(--text-muted);">Günlük Yatırım Verimi</small>
                        <strong style="color: var(--primary); font-size: 1.3rem;">%${best.efficiency}</strong>
                    </div>
                    <div style="text-align: right;">
                        <small style="display: block; color: var(--text-muted);">Amorti Süresi</small>
                        <strong style="color: var(--text); font-size: 1.3rem;">${best.roiDays} GÜN</strong>
                    </div>
                </div>
            </div>
        `;
    } else {
        container.innerHTML = "<p style='color: #ef4444; margin-top: 20px;'>Hata: Bu uçak için rota verisi hesaplanamadı.</p>";
    }
}

// Sayfa yüklendiğinde varsayılan listeleri hazırla
window.onload = function() {
    fillRouteSelects();
};
