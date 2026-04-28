/**
 * ui.js: Kullanıcı etkileşimleri, sayfa yönetimi ve veri görselleştirme.
 * Bu dosya logic.js ve configurator.js ile tam entegre çalışır.
 */

/**
 * Sayfalar arasında geçişi sağlar.
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
    
    // Rota analiz sayfalarında uçak listesini tazele
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
                paxSelect.add(new Option(name, name));
            }
        }
    }

    // Kargo uçaklarını doldur
    if (cargoSelect && cargoSelect.options.length <= 1) {
        for (let name in aircraftData) {
            if (aircraftData[name].type === "cargo") {
                cargoSelect.add(new Option(name, name));
            }
        }
    }
}

/**
 * Bütçeye ve kullanıcı tarafından belirlenen sefer sayısına göre en verimli uçakları listeler.
 * @param {string} category - 'pax' (Yolcu) veya 'cargo' (Kargo)
 */
function renderSuggestions(category) {
    const budgetInput = document.getElementById(category + 'BudgetInput');
    const manualTripsInput = document.getElementById(category + 'ManualTrips');
    const container = document.getElementById(category + 'PlaneResult');
    
    if (!budgetInput || !budgetInput.value) {
        return;
    }
    
    const budget = Number(budgetInput.value);
    const manualTrips = Number(manualTripsInput.value) || null;
    const typeKey = category === 'pax' ? 'passenger' : 'cargo';
    
    // logic.js'den en verimli uçak listesini al (Sefer sayısı parametresiyle)
    const results = getBestPlanesByType(budget, typeKey, manualTrips);
    
    if (results.length === 0) {
        container.innerHTML = `<p style="padding: 20px; color: var(--text-muted);">Bu bütçeye veya sefer hedefine uygun uçak bulunamadı.</p>`;
        return;
    }

    // Sonuçları HTML olarak oluştur (Tam rota gösterimi dahil)
    container.innerHTML = results.map(p => `
        <div class="result-item">
            <div>
                <strong style="font-size: 1.1rem; color: var(--text);">${p.name}</strong><br>
                <small style="color: var(--success); font-weight: 600;">
                    En Karlı Rota: ${p.bestRouteOrigin} ➔ ${p.bestRouteName}
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
 * Seçilen uçak, koltuk düzeni ve sefer sayısı için en kârlı 10 rotayı listeler.
 * @param {string} category - 'pax' veya 'cargo'
 */
function renderRouteAnalysis(category) {
    const selectElement = document.getElementById(category + 'RouteSelect');
    const manualTripsInput = document.getElementById(category + (category === 'pax' ? 'RouteManualTrips' : 'RouteManualTrips'));
    const container = document.getElementById(category + 'RouteResult');
    const planeName = selectElement.value;
    
    if (!planeName) {
        return;
    }
    
    const manualTrips = Number(manualTripsInput.value) || null;
    let customSeats = null;
    
    // Yolcu uçuşu ise koltuk düzenini Configurator'dan al ve kontrol et
    if (category === 'pax') {
        if (typeof Configurator !== 'undefined') {
            const isCapacityOk = Configurator.updateCapacityCheck();
            if (!isCapacityOk) {
                return; // Hata mesajı configurator tarafından basılıyor
            }
            customSeats = Configurator.getSeatConfig();
        }
    }

    // logic.js üzerinden sefer ayarlı en iyi 10 rotayı hesapla
    const topRoutes = analyzeTopRoutesForPlane(planeName, 10, customSeats, manualTrips);
    
    if (topRoutes.length === 0) {
        container.innerHTML = `<p style="color: var(--danger); padding: 20px;">Uçağın menziline veya pazar talebine uygun rota bulunamadı.</p>`;
        return;
    }

    // Rota kartlarını oluştur
    container.innerHTML = `<h3>En Karlı 10 Rota (Günlük Kar Odaklı)</h3>` + topRoutes.map((r, index) => `
        <div class="route-card" style="border: 1px solid var(--border); padding: 15px; border-radius: 10px; margin-bottom: 10px; background: #fff;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong style="font-size: 1.05rem;">#${index + 1} ${r.origin} ➔ ${r.destination}</strong>
                <span style="color: var(--success); font-weight: 700; font-size: 1.1rem;">
                    $${Math.floor(r.dailyProfit).toLocaleString()} / Gün
                </span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 0.85rem; color: var(--text-muted);">
                <span><strong>Mesafe:</strong> ${r.distance} km</span>
                <span><strong>Uygulanan Sefer:</strong> ${r.dailyTrips}x</span>
                <span><strong>Yatırım Verimi:</strong> %${r.efficiency}</span>
            </div>
        </div>
    `).join('');
}

/**
 * Koltuk inputları değiştikçe kapasite kontrolünü tetikler.
 */
window.updateCapacityCheck = function() {
    if (typeof Configurator !== 'undefined') {
        Configurator.updateCapacityCheck();
    }
};

/**
 * Sayfa yüklendiğinde başlangıç ayarlarını yapar.
 */
window.onload = function() {
    fillRouteSelects();
};
