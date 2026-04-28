/**
 * ui.js: Kullanıcı etkileşimleri, sayfa yönetimi ve verilerin görselleştirilmesi.
 * Bu dosya logic.js ve configurator.js ile tam entegre çalışır.
 */

/**
 * Sayfalar arası geçişi sağlar.
 */
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(pageId);
    if (target) {
        target.classList.add('active');
    }
    
    // Rota analiz sayfalarında uçak listesini doldur
    if (pageId.includes('route')) {
        fillRouteSelects();
    }
}

/**
 * Uçak seçim kutularını (select) veritabanına göre doldurur.
 */
function fillRouteSelects() {
    const paxSelect = document.getElementById('paxRouteSelect');
    const cargoSelect = document.getElementById('cargoRouteSelect');

    if (paxSelect && paxSelect.options.length <= 1) {
        for (let name in aircraftData) {
            if (aircraftData[name].type === "passenger") {
                paxSelect.add(new Option(name, name));
            }
        }
    }

    if (cargoSelect && cargoSelect.options.length <= 1) {
        for (let name in aircraftData) {
            if (aircraftData[name].type === "cargo") {
                cargoSelect.add(new Option(name, name));
            }
        }
    }
}

/**
 * Bütçeye göre en verimli uçakları ve kârlı oldukları ana rotayı listeler.
 */
function renderSuggestions(category) {
    const budgetInput = document.getElementById(category + 'BudgetInput');
    const container = document.getElementById(category + 'PlaneResult');
    
    if (!budgetInput || !budgetInput.value) {
        return; // Bütçe girilmemişse işlem yapma
    }
    
    const budget = Number(budgetInput.value);
    const typeKey = category === 'pax' ? 'passenger' : 'cargo';
    
    // logic.js'den en verimli uçakları getir
    const results = getBestPlanesByType(budget, typeKey);
    
    if (results.length === 0) {
        container.innerHTML = `<p style="padding: 20px; color: var(--text-muted);">Bu bütçeye uygun uçak bulunamadı.</p>`;
        return;
    }

    // "Nereden ➔ Nereye" formatında rotayı gösteren liste
    container.innerHTML = results.map(p => `
        <div class="result-item">
            <div>
                <strong style="font-size: 1.1rem;">${p.name}</strong><br>
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
 * Seçilen uçak ve koltuk yapılandırması için Excel'deki en kârlı 10 rotayı analiz eder.
 */
function renderRouteAnalysis(category) {
    const selectElement = document.getElementById(category + 'RouteSelect');
    const container = document.getElementById(category + 'RouteResult');
    const planeName = selectElement.value;
    
    if (!planeName) {
        return;
    }
    
    let customSeats = null;
    
    // Yolcu uçuşu ise koltuk düzenini kontrol et
    if (category === 'pax') {
        if (typeof Configurator !== 'undefined') {
            const isCapacityOk = Configurator.updateCapacityCheck();
            if (!isCapacityOk) {
                container.innerHTML = `<p style="color: var(--danger); padding: 10px; font-weight: bold;">Hata: Koltuk sayısı kapasiteyi aşıyor!</p>`;
                return;
            }
            customSeats = Configurator.getSeatConfig();
        }
    }

    // logic.js üzerinden en iyi 10 rotayı getir
    const topRoutes = analyzeTopRoutesForPlane(planeName, 10, customSeats);
    
    if (topRoutes.length === 0) {
        container.innerHTML = `<p style="color: var(--danger); padding: 20px;">Uçağın menziline veya pazar talebine uygun rota bulunamadı.</p>`;
        return;
    }

    // Sonuç kartlarını oluştur
    container.innerHTML = `<h3>En Karlı 10 Rota (Günlük Kar Odaklı)</h3>` + topRoutes.map((r, index) => `
        <div class="route-card" style="border: 1px solid var(--border); padding: 15px; border-radius: 10px; margin-bottom: 10px; background: #fff;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong>#${index + 1} ${r.origin} ➔ ${r.destination}</strong>
                <span style="color: var(--success); font-weight: 700;">
                    $${Math.floor(r.dailyProfit).toLocaleString()} / Gün
                </span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 0.85rem; color: var(--text-muted);">
                <span>Mesafe: ${r.distance} km</span>
                <span>Sefer: ${r.dailyTrips}x</span>
                <span>Verim: %${r.efficiency}</span>
            </div>
        </div>
    `).join('');
}

/**
 * Koltuk sayısı değişimlerinde kapasite kontrolünü tetikler.
 */
window.updateCapacityCheck = function() {
    if (typeof Configurator !== 'undefined') {
        Configurator.updateCapacityCheck();
    }
};

/**
 * Başlangıç ayarları
 */
window.onload = function() {
    fillRouteSelects();
};
