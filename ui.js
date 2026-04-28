/**
 * ui.js: AM4 Strateji Merkezi Arayüz Motoru.
 * Güncellemeler:
 * - iPhone/Mobil için "çift tıklama" gerektirmeyen dokunmatik menü (toggleDropdown) desteği.
 * - Uçuş süresi gösterimi düzeltildi (Hazırlık süresi dahil edilmeden gösterilir).
 * - ROI doğrulaması için "Günlük Sefer" (Trips) bilgisi eklendi.
 * - Başlangıç Modu: Realism.
 */

const UI = {
    /**
     * Sayfalar arasında geçiş yapar ve arayüzü temizler.
     * @param {string} pageId - Aktif edilecek sayfa ID'si.
     */
    showPage: function(pageId) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const target = document.getElementById(pageId);
        if (target) {
            target.classList.add('active');
        }
        
        // Sayfa geçişinde açık menüleri kapat ve en üste kaydır
        this.closeAllDropdowns();
        window.scrollTo(0, 0);

        // Rota analizi sayfasına giriliyorsa seçim kutularını doldur
        if (pageId.includes('route')) {
            this.fillSelects();
        }
    },

    /**
     * Mobil cihazlarda menü başlıklarına tıklandığında alt menüyü yönetir.
     */
    toggleDropdown: function(id) {
        const drop = document.getElementById(id);
        const isOpen = drop.classList.contains('open');
        
        this.closeAllDropdowns();
        
        if (!isOpen) {
            drop.classList.add('open');
        }
    },

    /**
     * Tüm açık dropdown menüleri kapatır.
     */
    closeAllDropdowns: function() {
        document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
    },

    /**
     * Oyun modunu (Easy/Realism) değiştirir ve buton renklerini ayarlar.
     */
    setGameMode: function(mode) {
        window.gameMode = mode; 
        
        // Sadece aktif olan butonu mavi yapar (Style.css ile uyumlu)
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        const targetId = mode === 'easy' ? 'btn-easy' : 'id-real';
        const activeBtn = document.getElementById(targetId);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // Ana sayfadaki mod metnini ve renkli kutuyu güncelle
        const display = document.getElementById('modeDisplay');
        if (display) {
            display.innerText = mode === 'easy' 
                ? "Aktif Mod: Easy Mode (1.1x Bilet Çarpanı)" 
                : "Aktif Mod: Realism (1.0x Bilet Çarpanı)";
            display.className = "status-box " + (mode === 'easy' ? "status-success" : "status-danger");
        }

        // Mod değiştiğinde eski sonuçları temizle
        ['paxRouteResult', 'cargoRouteResult', 'paxPlaneResult', 'cargoPlaneResult'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = "";
        });
    },

    /**
     * Uçak seçim listelerini planes.js verileriyle doldurur.
     */
    fillSelects: function() {
        const paxSelect = document.getElementById('paxRouteSelect');
        const cargoSelect = document.getElementById('cargoRouteSelect');

        if (paxSelect) paxSelect.innerHTML = '<option value="">-- Bir Uçak Seçin --</option>';
        if (cargoSelect) cargoSelect.innerHTML = '<option value="">-- Bir Uçak Seçin --</option>';

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
     * Bütçeye göre en verimli uçakları listeler.
     * Logic.js'den gelen appliedTrips verisini kullanarak ROI'yi doğrular.
     */
    renderSuggestions: function(cat) {
        const budgetInput = document.getElementById(cat + 'BudgetInput');
        const mTripsInput = document.getElementById(cat + 'ManualTrips');
        const resultDiv = document.getElementById(cat + 'PlaneResult');
        
        if (!budgetInput || !budgetInput.value) return;

        const budget = Number(budgetInput.value);
        const mTrips = Number(mTripsInput.value) || null;
        const typeKey = cat === 'pax' ? 'passenger' : 'cargo';

        const matches = Logic.getBestPlanesByType(budget, typeKey, mTrips);
        
        if (matches.length === 0) {
            resultDiv.innerHTML = `<p style="padding: 20px; color: var(--text-muted);">Uygun uçak bulunamadı.</p>`;
            return;
        }

        resultDiv.innerHTML = matches.map((m, index) => `
            <div class="result-item" style="border-left: 5px solid ${index === 0 ? 'var(--success)' : 'var(--primary)'}">
                <div style="flex: 2; text-align: left;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                        <strong style="font-size: 1.15rem;">${m.name}</strong>
                        <span style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 700;">
                            Skor: %${(m.finalScore * 100).toFixed(0)}
                        </span>
                    </div>
                    <small style="color: var(--success); font-weight: 700;">
                        En Karlı Rota: ${m.bestRouteOrigin} ➔ ${m.bestRouteName}
                    </small><br>
                    <div style="font-size: 0.85rem; margin-top: 5px; color: var(--text);">
                        Fiyat: <strong>${Utils.formatCurrency(m.price)}</strong> | 
                        1 Uçuş Kârı: <strong style="color: var(--primary);">${Utils.formatCurrency(m.profitPerFlight)}</strong>
                    </div>
                    <small style="color: var(--text-muted); font-size: 0.75rem;">
                        Operasyon: <strong>Günde ${m.appliedTrips} Sefer</strong> (ROI bu veriye dayanır)
                    </small>
                </div>
                <div style="text-align: right; flex: 1; border-left: 1px solid var(--border); padding-left: 10px;">
                    <div style="color: var(--primary); font-weight: 800; font-size: 1.1rem;">
                        ${Utils.formatPercent(m.efficiency)}
                    </div>
                    <small style="color: var(--text-muted); font-weight: 600;">${m.roi} Gün ROI</small>
                </div>
            </div>
        `).join('');
    },

    /**
     * Belirli bir uçak için en kârlı rotaları analiz eder.
     * Logic.js'den gelen 'duration' (airTime) verisini kullanarak gerçek süreyi gösterir.
     */
    renderRouteAnalysis: function(cat) {
        const select = document.getElementById(cat + 'RouteSelect');
        const mTripsInput = document.getElementById(cat + 'RouteManualTrips');
        const resultDiv = document.getElementById(cat + 'RouteResult');
        
        const planeName = select.value;
        if (!planeName) return;
        
        const plane = aircraftData[planeName];
        const mTrips = Number(mTripsInput.value) || null;
        let seats = cat === 'pax' ? Configurator.getSeatConfig() : null;

        const topRoutes = Logic.analyzeTopRoutesForPlane(planeName, 10, seats, mTrips);
        const currentMode = window.gameMode || 'realism';

        resultDiv.innerHTML = `<h3 style="margin: 20px 0 15px 0;">En Karlı Rotalar (${currentMode.toUpperCase()})</h3>` + topRoutes.map((r, i) => {
            const opt = (cat === 'pax') ? Configurator.calculateOptimalSeats(plane, r, mTrips) : null;
            
            return `
            <div class="route-card">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                    <strong style="font-size: 1.05rem; flex: 1; text-align: left;">#${i + 1} ${r.origin} ➔ ${r.destination}</strong>
                    <div style="text-align: right;">
                        <div style="color: var(--success); font-weight: 800; font-size: 1.1rem;">
                            ${Utils.formatCurrency(r.dailyProfit)} / Gün
                        </div>
                        <div style="color: var(--text-muted); font-size: 0.8rem; font-weight: 600;">
                            ${Utils.formatCurrency(r.profitPerFlight)} / Uçuş
                        </div>
                    </div>
                </div>
                
                ${cat === 'pax' ? `
                <div style="background: var(--primary-light); padding: 12px; border-radius: 12px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(37, 99, 235, 0.1);">
                    <div style="text-align: left;">
                        <span style="color: var(--primary); font-weight: 800; font-size: 0.8rem; margin-right: 8px;">İDEAL:</span> 
                        <span class="suggest-badge">Y:${opt.y}</span>
                        <span class="suggest-badge">J:${opt.j}</span>
                        <span class="suggest-badge">F:${opt.f}</span>
                    </div>
                    <button onclick="Configurator.applySuggestion(${opt.y}, ${opt.j}, ${opt.f})" 
                            style="width: auto; padding: 6px 12px; margin: 0; font-size: 0.7rem; background: var(--success); border-radius: 8px;">
                        Yükle
                    </button>
                </div>
                ` : `
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 10px; text-align: left;">
                    <span style="font-weight: 700; color: var(--text);">Kargo Talebi:</span> ${r.demand.c || (r.demand.y * 500)} birim
                </div>
                `}

                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 0.8rem; color: var(--text-muted); border-top: 1px solid var(--border); padding-top: 10px;">
                    <span><strong>Mesafe:</strong> ${r.distance}km</span>
                    <span><strong>Uçuş:</strong> ${Utils.formatDuration(r.duration)}</span>
                    <span><strong>Sefer:</strong> ${r.dailyTrips}x</span>
                    <span><strong>Verim:</strong> ${Utils.formatPercent(r.efficiency)}</span>
                </div>
            </div>`;
        }).join('');
    }
};

/**
 * Global başlatıcılar ve Pencere olayları.
 */
window.updateCapacityCheck = function() { 
    if (typeof Configurator !== 'undefined') Configurator.updateCapacityCheck(); 
};

window.onload = function() { 
    UI.fillSelects(); 
    UI.setGameMode('realism'); // Başlangıç modu Realism.
    
    // Mobil dışı (arkaplan) tıklamalarda açık menüleri otomatik kapat.
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.dropdown')) {
            UI.closeAllDropdowns();
        }
    });
};
