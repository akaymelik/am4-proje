/**
 * ui.js: Ekran geçişleri, veri görselleştirme ve kullanıcı etkileşimlerini yöneten modül.
 * Bu modül Logic, Utils, Configurator ve AircraftData ile tam entegre çalışır.
 */

const UI = {
    /**
     * Sayfalar arasında geçiş yapar.
     * @param {string} pageId - Aktif edilecek sayfanın ID'si.
     */
    showPage: function(pageId) {
        // Tüm sayfaları gizle
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        
        // Hedef sayfayı göster
        const target = document.getElementById(pageId);
        if (target) {
            target.classList.add('active');
        }
        
        // Eğer bir analiz sayfasına geçildiyse seçim kutularını doldur
        if (pageId.includes('route')) {
            this.fillSelects();
        }
    },

    /**
     * Uçak seçim kutularını (select) veritabanındaki uçaklarla doldurur.
     */
    fillSelects: function() {
        const paxSelect = document.getElementById('paxRouteSelect');
        const cargoSelect = document.getElementById('cargoRouteSelect');

        // Kutuları temizle (ilk seçenek hariç)
        if (paxSelect) paxSelect.innerHTML = '<option value="">-- Bir Uçak Seçin --</option>';
        if (cargoSelect) cargoSelect.innerHTML = '<option value="">-- Bir Uçak Seçin --</option>';

        // Uçak verilerini kategorilerine göre kutulara ekle
        for (let name in aircraftData) {
            const plane = aircraftData[name];
            const option = new Option(name, name);
            
            if (plane.type === "passenger" && paxSelect) {
                paxSelect.add(option);
            } else if (plane.type === "cargo" && cargoSelect) {
                cargoSelect.add(option);
            }
        }
    },

    /**
     * Bütçeye ve sefer hedefine göre en verimli uçakları listeler.
     * @param {string} cat - 'pax' veya 'cargo'
     */
    renderSuggestions: function(cat) {
        const budgetInput = document.getElementById(cat + 'BudgetInput');
        const mTripsInput = document.getElementById(cat + 'ManualTrips');
        const resultDiv = document.getElementById(cat + 'PlaneResult');
        
        if (!budgetInput || !budgetInput.value) return;
        
        const budget = Number(budgetInput.value);
        const mTrips = Number(mTripsInput.value) || null;
        const typeKey = cat === 'pax' ? 'passenger' : 'cargo';
        
        // Logic modülünden en iyi uçakları getir
        const matches = Logic.getBestPlanesByType(budget, typeKey, mTrips);
        
        if (matches.length === 0) {
            resultDiv.innerHTML = `<p style="padding: 20px; color: var(--text-muted);">Bu bütçeye uygun kârlı bir uçak bulunamadı.</p>`;
            return;
        }

        // Sonuçları ekrana bas (Süre ve Tam Rota dahil)
        resultDiv.innerHTML = matches.map(m => `
            <div class="result-item">
                <div>
                    <strong>${m.name}</strong><br>
                    <small style="color: var(--success); font-weight: 600;">
                        En Karlı Rota: ${m.bestRouteOrigin} ➔ ${m.bestRouteName}
                    </small><br>
                    <small style="color: var(--text-muted)">Süre: ${Utils.formatDuration(m.duration)}</small>
                </div>
                <div style="text-align: right;">
                    <span style="color: var(--primary); font-weight: bold; font-size: 1.1rem;">
                        ${Utils.formatPercent(m.efficiency)} Verim
                    </span><br>
                    <small style="color: var(--text-muted);">${m.roi} Gün ROI</small>
                </div>
            </div>
        `).join('');
    },

    /**
     * Seçilen uçak ve koltuk düzeni için Excel rotalarını analiz eder.
     * @param {string} cat - 'pax' veya 'cargo'
     */
    renderRouteAnalysis: function(cat) {
        const select = document.getElementById(cat + 'RouteSelect');
        const mTripsInput = document.getElementById(cat + (cat === 'pax' ? 'RouteManualTrips' : 'RouteManualTrips'));
        const resultDiv = document.getElementById(cat + 'RouteResult');
        
        const planeName = select.value;
        if (!planeName) return;
        
        const mTrips = Number(mTripsInput.value) || null;
        let seats = null;
        
        // Yolcu uçağı ise koltuk kontrolü yap
        if (cat === 'pax') {
            const isOk = Configurator.updateCapacityCheck();
            if (!isOk) return;
            seats = Configurator.getSeatConfig();
        }

        // Logic modülü üzerinden en iyi 10 rotayı getir
        const topRoutes = Logic.analyzeTopRoutesForPlane(planeName, 10, seats, mTrips);
        
        if (topRoutes.length === 0) {
            resultDiv.innerHTML = `<p style="color: var(--danger); padding: 20px;">Uçağa uygun rota bulunamadı.</p>`;
            return;
        }

        // Rota kartlarını oluştur
        resultDiv.innerHTML = `<h3>En Karlı 10 Rota (Günlük Kar Odaklı)</h3>` + topRoutes.map((r, i) => `
            <div class="route-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <strong style="font-size: 1.05rem;">#${i + 1} ${r.origin} ➔ ${r.destination}</strong>
                    <span style="color: var(--success); font-weight: 700; font-size: 1.1rem;">
                        ${Utils.formatCurrency(r.dailyProfit)} / Gün
                    </span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr) repeat(2, 1fr); gap: 10px; font-size: 0.85rem; color: var(--text-muted);">
                    <span><strong>Mesafe:</strong> ${r.distance} km</span>
                    <span><strong>Süre:</strong> ${Utils.formatDuration(r.duration)}</span>
                    <span><strong>Sefer:</strong> ${r.dailyTrips}x</span>
                    <span><strong>Verim:</strong> ${Utils.formatPercent(r.efficiency)}</span>
                </div>
            </div>
        `).join('');
    }
};

/**
 * Kapasite kontrolünü global kapsamda çalıştırabilmek için pencereye bağla.
 */
window.updateCapacityCheck = function() {
    Configurator.updateCapacityCheck();
};

/**
 * Uygulama başladığında ilk hazırlıkları yap.
 */
window.onload = function() {
    UI.fillSelects();
};
