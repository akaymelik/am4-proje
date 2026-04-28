/**
 * ui.js: Kullanıcı arayüzü etkileşimleri, sayfa yönetimi ve veri görselleştirme.
 */

/**
 * Sayfalar arasında geçiş yapar.
 * @param {string} pageId - Gösterilecek sayfanın ID değeri.
 */
function showPage(pageId) {
    // Tüm sayfaları gizle
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    
    // Hedef sayfayı aktif et
    const target = document.getElementById(pageId);
    if (target) {
        target.classList.add('active');
    }
    
    // Eğer bir rota analiz sayfasına geçildiyse uçak listelerini tazele
    if (pageId.includes('route')) {
        fillRouteSelects();
    }
}

/**
 * Rota analizi bölümlerindeki uçak seçim kutularını (select) doldurur.
 */
function fillRouteSelects() {
    const paxSelect = document.getElementById('paxRouteSelect');
    const cargoSelect = document.getElementById('cargoRouteSelect');

    // Yolcu uçaklarını doldur
    if (paxSelect && paxSelect.options.length <= 1) {
        for (let name in aircraftData) {
            if (aircraftData[name].type === "passenger") {
                let opt = new Option(name, name);
                paxSelect.add(opt);
            }
        }
    }

    // Kargo uçaklarını doldur
    if (cargoSelect && cargoSelect.options.length <= 1) {
        for (let name in aircraftData) {
            if (aircraftData[name].type === "cargo") {
                let opt = new Option(name, name);
                cargoSelect.add(opt);
            }
        }
    }
}

/**
 * Bütçeye göre en verimli (Efficiency odaklı) uçak önerilerini listeler.
 * @param {string} category - 'pax' (Yolcu) veya 'cargo' (Kargo)
 */
function renderSuggestions(category) {
    const budgetInput = document.getElementById(category + 'BudgetInput');
    const container = document.getElementById(category + 'PlaneResult');
    
    if (!budgetInput || !budgetInput.value) {
        return alert("Lütfen analize başlamak için bütçenizi girin!");
    }
    
    const budget = Number(budgetInput.value);
    const typeKey = category === 'pax' ? 'passenger' : 'cargo';
    
    // logic.js'den en verimli uçak listesini al
    const results = getBestPlanesByType(budget, typeKey);
    
    if (results.length === 0) {
        container.innerHTML = `<p style="margin-top:20px; color: var(--text-muted);">Bu bütçeye uygun uçak bulunamadı.</p>`;
        return;
    }

    // Sonuçları HTML olarak oluştur
    container.innerHTML = results.map(p => `
        <div class="result-item">
            <div>
                <strong style="font-size: 1.1rem; color: var(--text);">${p.name}</strong><br>
                <small style="color: var(--success); font-weight: 600;">
                    En Karlı Rota: ${p.origin} ➔ ${p.destination}
                </small>
            </div>
            <div style="text-align: right;">
                <span style="color: var(--primary); font-weight: bold; font-size: 1.1rem;">%${p.efficiency} Verim</span><br>
                <small style="color: var(--text-muted);">${p.roi} Gün Amorti</small>
            </div>
        </div>
    `).join('');
}

/**
 * Seçilen uçak ve koltuk düzeni için en karlı 10 rotayı detaylı listeler.
 * @param {string} category - 'pax' veya 'cargo'
 */
function renderRouteAnalysis(category) {
    const selectElement = document.getElementById(category + 'RouteSelect');
    const container = document.getElementById(category + 'RouteResult');
    const planeName = selectElement.value;
    
    if (!planeName) {
        return alert("Lütfen analiz edilecek bir uçak seçin!");
    }
    
    let customSeats = null;
    
    // Yolcu uçuşu ise koltuk düzenini Configurator'dan al ve kontrol et
    if (category === 'pax') {
        if (typeof Configurator !== 'undefined') {
            const isCapacityOk = Configurator.updateCapacityCheck();
            if (!isCapacityOk) {
                return alert("Hata: Girdiğiniz koltuk sayıları uçak kapasitesini aşıyor!");
            }
            customSeats = Configurator.getSeatConfig();
        }
    }

    // logic.js üzerinden en iyi 10 rotayı hesapla
    const topRoutes = analyzeTopRoutesForPlane(planeName, 10, customSeats);
    
    if (topRoutes.length === 0) {
        container.innerHTML = `<p style="color: var(--danger); margin-top: 20px;">Uçağın menziline uygun rota bulunamadı.</p>`;
        return;
    }

    // Rota kartlarını oluştur
    container.innerHTML = `<h3>En Karlı 10 Rota (Günlük Kar Odaklı)</h3>` + topRoutes.map((r, index) => `
        <div class="route-card" style="border-left: 5px solid ${index === 0 ? 'var(--success)' : 'var(--border)'};">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong style="font-size: 1.05rem;">#${index + 1} ${r.origin} ➔ ${r.destination}</strong>
                <span style="color: var(--success); font-weight: 700; font-size: 1.1rem;">
                    $${Math.floor(r.dailyProfit).toLocaleString()} / Gün
                </span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 0.85rem; color: var(--text-muted);">
                <span><strong>Mesafe:</strong> ${r.distance} km</span>
                <span><strong>Günlük Sefer:</strong> ${r.dailyTrips}x</span>
                <span><strong>Yatırım Verimi:</strong> %${r.efficiency}</span>
            </div>
        </div>
    `).join('');
}

/**
 * Koltuk inputları değiştikçe kapasite kontrolünü tetikler (Configurator ile bağlantılı).
 */
window.updateCapacityCheck = function() {
    if (typeof Configurator !== 'undefined') {
        Configurator.updateCapacityCheck();
    }
};

/**
 * Sayfa yüklendiğinde gerekli başlangıç ayarlarını yapar.
 */
window.onload = function() {
    fillRouteSelects();
};
