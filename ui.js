/**
 * ui.js: AM4 Strateji Merkezi Arayüz Motoru.
 * Güncellemeler: 
 * - Splash Screen (Yükleme Ekranı) takılma sorunu için "Fail-safe" (Güvenlik Zamanlayıcısı) eklendi.
 * - Bakım (A-Check) maliyetleri ve Talep Senkronizasyonu uyarıları arayüze entegre edildi.
 * - Mobil/iPhone için dokunmatik menü (toggleDropdown) desteği stabilize edildi.
 * - Hata yakalama (try-catch) ile sistemin çökmesi engellendi.
 */

const UI = {
    /**
     * Sayfalar arasında geçiş yapar.
     * @param {string} pageId - Aktif edilecek sayfa ID'si.
     */
    showPage: function(pageId) {
        try {
            // Tüm sayfaları gizle
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            
            // Hedef sayfayı göster
            const target = document.getElementById(pageId);
            if (target) {
                target.classList.add('active');
            }
            
            // Menü geçişlerinde açık dropdownları kapat
            this.closeAllDropdowns();
            
            // Rota analizi sayfalarındaysak uçak listelerini doldur
            if (pageId.includes('route')) {
                this.fillSelects();
            }
            
            // Sayfa başına yumuşak kaydır
            window.scrollTo(0, 0);
        } catch (error) {
            console.error("Sayfa geçişi sırasında hata:", error);
            // Hata durumunda ana sayfayı kurtar
            const home = document.getElementById('home');
            if (home) home.classList.add('active');
        }
    },

    /**
     * Mobil cihazlarda menü başlıklarına tıklandığında alt menüyü açar/kapatır.
     * @param {string} id - Dropdown kapsayıcısının ID'si.
     */
    toggleDropdown: function(id) {
        const drop = document.getElementById(id);
        if (!drop) return;
        
        const isOpen = drop.classList.contains('open');
        
        // Diğer açık menüleri temizle
        this.closeAllDropdowns();
        
        // Hedef menüyü aç veya kapat
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
     * Oyun modunu (Easy/Realism) değiştirir ve arayüzdeki buton stillerini günceller.
     */
    setGameMode: function(mode) {
        window.gameMode = mode; 
        
        // Butonların görsel durumunu güncelle (Sadece aktif olan mavi olur)
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        const targetId = mode === 'easy' ? 'btn-easy' : 'id-real';
        const activeBtn = document.getElementById(targetId);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // Ana sayfadaki aktif mod bilgisini güncelle (Sade metin)
        const display = document.getElementById('modeDisplay');
        if (display) {
            display.innerText = mode === 'easy' ? "Aktif Mod: Easy" : "Aktif Mod: Realism";
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

        if (typeof aircraftData === 'undefined') return;

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
     * Bütçeye göre en verimli uçakları Hibrit Skor ile listeler.
     */
    renderSuggestions: function(cat) {
        try {
            const budgetInput = document.getElementById(cat + 'BudgetInput');
            const mTripsInput = document.getElementById(cat + 'ManualTrips');
            const resultDiv = document.getElementById(cat + 'PlaneResult');
            
            if (!budgetInput || !budgetInput.value) return;

            const budget = Number(budgetInput.value);
            const mTrips = Number(mTripsInput.value) || null;
            const typeKey = cat === 'pax' ? 'passenger' : 'cargo';

            const matches = Logic.getBestPlanesByType(budget, typeKey, mTrips);
            
            if (matches.length === 0) {
                resultDiv.innerHTML = `<p style="padding: 20px; color: var(--text-muted);">Bu bütçeye uygun uçak bulunamadı.</p>`;
                return;
            }

            resultDiv.innerHTML = matches.map((m, index) => `
                <div class="result-item" style="border-left: 5px solid ${index === 0 ? 'var(--success)' : 'var(--primary)'}">
                    <div style="flex: 2; text-align: left;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                            <strong style="font-size: 1.15rem;">${m.name}</strong>
                            <span style="background: var(--primary); color: white; padding: 2px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: 700;">
                                Skor: %${(m.finalScore * 100).toFixed(0)}
                            </span>
                        </div>
                        <small style="color: var(--success); font-weight: 700; display: block; margin-bottom: 5px;">
                            Rota: ${m.bestRouteOrigin} ➔ ${m.bestRouteName}
                        </small>
                        <div style="font-size: 0.85rem; color: var(--text);">
                            Fiyat: <strong>${Utils.formatCurrency(m.price)}</strong> | 
                            Kâr: <strong style="color: var(--primary);">${Utils.formatCurrency(m.profitPerFlight)}</strong>
                        </div>
                        <small style="color: var(--text-muted); font-size: 0.75rem; display: block; margin-top: 3px;">
                            Operasyon: <strong>Günde ${m.appliedTrips} Sefer</strong>
                        </small>
                    </div>
                    <div style="text-align: right; flex: 1; border-left: 1px solid var(--border); padding-left: 10px;">
                        <div style="color: var(--primary); font-weight: 800; font-size: 1.1rem;">
                            ${Utils.formatPercent(m.efficiency)}
                        </div>
                        <small style="color: var(--text-muted); font-weight: 600;">${m.roi} G. ROI</small>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            console.error("Öneri render hatası:", e);
        }
    },

    /**
     * Seçilen uçak için en kârlı rotaları analiz eder (Bakım ve Talep Uyarıları Dahil).
     */
    renderRouteAnalysis: function(cat) {
        try {
            const select = document.getElementById(cat + 'RouteSelect');
            const mTripsInput = document.getElementById(cat + 'RouteManualTrips');
            const resultDiv = document.getElementById(cat + 'RouteResult');
            
            const planeName = select.value;
            if (!planeName) return;
            
            const plane = aircraftData[planeName];
            const tripsValue = Number(mTripsInput.value) || null;
            
            // Mevcut koltuk/kargo konfigürasyonunu al
            const config = cat === 'pax' ? Configurator.getSeatConfig() : Configurator.getCargoConfig();

            const topRoutes = Logic.analyzeTopRoutesForPlane(planeName, 10, config, tripsValue);
            const currentMode = window.gameMode || 'realism';

            resultDiv.innerHTML = `<h3>En Karlı Rotalar (${currentMode.toUpperCase()})</h3>` + topRoutes.map((r, i) => {
                const opt = (cat === 'pax') 
                    ? Configurator.calculateOptimalSeats(plane, r, tripsValue) 
                    : Configurator.calculateOptimalCargo(plane, r, tripsValue);
                
                return `
                <div class="route-card" style="${r.demandWarning ? 'border-top: 4px solid var(--danger);' : ''}">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                        <div>
                            <strong style="font-size: 1.05rem; display: block; text-align: left;">#${i + 1} ${r.origin} ➔ ${r.destination}</strong>
                            ${r.demandWarning ? '<small style="color: var(--danger); font-weight: 800;">⚠️ KAPASİTE TALEBİ AŞIYOR!</small>' : ''}
                        </div>
                        <div style="text-align: right;">
                            <div style="color: var(--success); font-weight: 800; font-size: 1.1rem;">
                                ${Utils.formatCurrency(r.dailyProfit)} / Gün
                            </div>
                            <div style="color: var(--text-muted); font-size: 0.7rem; font-weight: 600;">
                                Bakım Gideri: ${Utils.formatCurrency(r.maintenanceCost)} / Uçuş
                            </div>
                        </div>
                    </div>
                    
                    <div style="background: var(--primary-light); padding: 12px; border-radius: 12px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(37, 99, 235, 0.1);">
                        <div style="text-align: left;">
                            <span style="color: var(--primary); font-weight: 800; font-size: 0.8rem; margin-right: 8px;">ÖNERİLEN:</span> 
                            ${cat === 'pax' 
                                ? `<span class="suggest-badge">Y:${opt.y}</span> <span class="suggest-badge">J:${opt.j}</span> <span class="suggest-badge">F:${opt.f}</span>`
                                : `<span class="suggest-badge">L:${opt.l}</span> <span class="suggest-badge">H:${opt.h}</span>`
                            }
                        </div>
                        <button onclick="Configurator.applySuggestion(${cat === 'pax' ? `${opt.y}, ${opt.j}, ${opt.f}` : `${opt.l}, ${opt.h}`})" 
                                style="width: auto; padding: 6px 12px; margin: 0; font-size: 0.7rem; background: var(--success); border-radius: 8px;">
                            Yükle
                        </button>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 0.8rem; color: var(--text-muted); border-top: 1px solid var(--border); padding-top: 10px;">
                        <span><strong>Mesafe:</strong> ${r.distance}km</span>
                        <span><strong>Uçuş:</strong> ${Utils.formatDuration(r.duration)}</span>
                        <span><strong>Sefer:</strong> ${r.dailyTrips}x</span>
                        <span><strong>Verim:</strong> ${Utils.formatPercent(r.efficiency)}</span>
                    </div>
                </div>`;
            }).join('');
        } catch (e) {
            console.error("Rota analiz hatası:", e);
        }
    }
};

/**
 * Giriş Ekranı (Splash) Kaldırma Mantığı
 */
const hideSplashScreen = () => {
    const splash = document.getElementById('splash-screen');
    if (splash && !splash.classList.contains('hidden')) {
        splash.classList.add('hidden');
    }
};

/**
 * Uygulama Başlatıcı
 */
const initMenoa = () => {
    try {
        UI.fillSelects(); 
        UI.setGameMode('realism'); 
        // Sayfa kaynakları yüklendikten 1.2 sn sonra ekranı aç
        setTimeout(hideSplashScreen, 1200);
    } catch (e) {
        console.error("Başlatma hatası:", e);
        hideSplashScreen(); // Hata olsa bile ekranı aç
    }
};

/**
 * Pencere Olayları
 */
window.onload = function() {
    initMenoa();
};

// GÜVENLİK ÖNLEMİ: Eğer sayfa kaynakları (font, resim vb) takılırsa ekranı 3.5 saniye sonra zorla aç.
// Bilgisayarlardaki takılma sorununu bu satır çözer.
setTimeout(hideSplashScreen, 3500);

// Global tıklama dinleyici (Dropdown kapatmak için)
document.addEventListener('click', function(e) {
    if (!e.target.closest('.dropdown')) {
        UI.closeAllDropdowns();
    }
});

// Global kapasite kontrolü köprüsü
window.updateCapacityCheck = () => {
    if (typeof Configurator !== 'undefined') Configurator.updateCapacityCheck();
};
