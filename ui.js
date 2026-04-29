/**
 * ui.js: AM4 Strateji Merkezi Arayüz.
 * Güncelleme: Worker URL adresi 'ai.airm4.workers.dev' olarak güncellendi.
 * Bağlantı: Gemini 2.5 Flash Motoru ile tam uyumlu.
 */

const UI = {
    /**
     * Sayfa değiştirme ve navigasyon yönetimi.
     */
    showPage: function(id) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const targetPage = document.getElementById(id);
        if (targetPage) targetPage.classList.add('active');
        
        UI.closeAllDropdowns();
        
        // Rota sayfalarında uçak listelerini doldur
        if (id.includes('route')) {
            UI.fillSelects();
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    /**
     * Dropdown (Açılır Menü) yönetimi.
     */
    toggleDropdown: function(id) {
        const el = document.getElementById(id);
        if (!el) return;
        const isOpen = el.classList.contains('open');
        UI.closeAllDropdowns();
        if (!isOpen) el.classList.add('open');
    },

    closeAllDropdowns: function() {
        document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
    },

    /**
     * Oyun modunu (Easy/Realism) ayarlar.
     */
    setGameMode: function(mode) {
        window.gameMode = mode;
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        const activeBtn = mode === 'easy' ? document.getElementById('btn-easy') : document.getElementById('id-real');
        if (activeBtn) activeBtn.classList.add('active');
        
        const display = document.getElementById('modeDisplay');
        if (display) {
            display.innerText = "Aktif Mod: " + (mode === 'easy' ? "Easy (1.1x)" : "Realism (1.0x)");
            display.className = "status-box " + (mode === 'easy' ? "status-success" : "status-danger");
        }
    },

    /**
     * Uçak seçim kutularını doldurur.
     */
    fillSelects: function() {
        const paxSelect = document.getElementById('paxRouteSelect');
        const cargoSelect = document.getElementById('cargoRouteSelect');
        
        if (paxSelect) {
            paxSelect.innerHTML = '<option value="">-- Uçak Seçiniz --</option>';
            for (let name in aircraftData) {
                if (aircraftData[name].type === "passenger") paxSelect.add(new Option(name, name));
            }
        }
        
        if (cargoSelect) {
            cargoSelect.innerHTML = '<option value="">-- Uçak Seçiniz --</option>';
            for (let name in aircraftData) {
                if (aircraftData[name].type === "cargo") cargoSelect.add(new Option(name, name));
            }
        }
    },

    /**
     * Gemini Yapay Zekasına (ai.airm4.workers.dev) analiz talebi gönderir.
     */
    askGemini: async function(planeName, routeData) {
        // AKTİF WORKER ADRESİN
        const workerUrl = "https://ai.airm4.workers.dev/";
        
        const resultArea = document.getElementById('aiResultArea');
        if (!resultArea) return;

        resultArea.innerHTML = '<div id="aiLoader">🤖 MENOA Verileri İşliyor...</div>';

        try {
            const response = await fetch(workerUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    plane: planeName,
                    route: `${routeData.origin} ➔ ${routeData.destination}`,
                    profit: Utils.formatCurrency(routeData.dailyProfit),
                    distance: routeData.distance,
                    efficiency: Utils.formatPercent(routeData.efficiency)
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.text || "Yapay zeka motoruna bağlanılamadı.");
            }
            
            resultArea.innerHTML = `
                <div class="ai-report-card">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
                        <span style="font-size:1.4rem;">🤖</span>
                        <h4 style="margin:0; color:var(--primary); font-weight:800;">MENOA AI ANALİZİ</h4>
                    </div>
                    <div style="font-size:0.9rem; line-height:1.7; color:var(--text);">
                        ${(data.text || "Analiz raporu oluşturulamadı.").replace(/\n/g, '<br>')}
                    </div>
                </div>`;
            resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });

        } catch (error) {
            console.error("AI Bağlantı Hatası:", error);
            resultArea.innerHTML = `
                <div class="status-box status-danger">
                    <strong>HATA OLUŞTU:</strong><br>
                    <small>${error.message}</small>
                </div>`;
        }
    },

    /**
     * Bütçeye göre en verimli uçakları listeler.
     */
    renderSuggestions: function(cat) {
        const budgetInput = document.getElementById(cat + 'BudgetInput');
        const budget = Number(budgetInput?.value);
        const resultDiv = document.getElementById(cat + 'PlaneResult');
        
        if (!budget || budget <= 0) {
            if (resultDiv) resultDiv.innerHTML = '<div class="status-box status-danger">Lütfen geçerli bir bütçe giriniz.</div>';
            return;
        }

        const bestPlanes = Logic.getBestPlanesByType(budget, cat === 'pax' ? 'passenger' : 'cargo');
        
        if (bestPlanes.length === 0) {
            if (resultDiv) resultDiv.innerHTML = '<div class="status-box status-danger">Bu bütçeye uygun kârlı uçak bulunamadı.</div>';
            return;
        }

        resultDiv.innerHTML = bestPlanes.map(p => `
            <div class="plane-item">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong>${p.name}</strong>
                    <span style="color:var(--primary); font-weight:800;">${Utils.formatPercent(p.efficiency)} Verim</span>
                </div>
                <div style="font-size:0.8rem; margin-top:5px; color:var(--text-muted);">
                    Fiyat: ${Utils.formatCurrency(p.price)} | Kâr: ${Utils.formatCurrency(p.dailyProfit)}
                </div>
                <small style="color:var(--success); font-weight:600;">En Karlı Rota: ${p.bestRouteOrigin} ➔ ${p.bestRouteName}</small>
            </div>
        `).join('');
    },

    /**
     * Belirli bir uçak için tüm rotaları analiz eder.
     */
    renderRouteAnalysis: function(cat) {
        const selectId = cat === 'pax' ? 'paxRouteSelect' : 'cargoRouteSelect';
        const resultId = cat === 'pax' ? 'paxRouteResult' : 'cargoRouteResult';
        const planeName = document.getElementById(selectId)?.value;
        const resultDiv = document.getElementById(resultId);

        if (!planeName) return;

        resultDiv.innerHTML = `<div id="aiResultArea"></div><h3>En Karlı Rotalar</h3>`;

        const topRoutes = Logic.analyzeTopRoutesForPlane(planeName, 12);

        topRoutes.forEach((r, i) => {
            const card = document.createElement('div');
            card.className = 'route-card';
            
            const opt = aircraftData[planeName].type === 'passenger' 
                ? Configurator.calculateOptimalSeats(aircraftData[planeName], r)
                : Configurator.calculateOptimalCargo(aircraftData[planeName], r);

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <strong>#${i + 1} ${r.origin} ➔ ${r.destination}</strong>
                    <div style="text-align:right;">
                        <div style="color:var(--success); font-weight:800; font-size:1.1rem;">${Utils.formatCurrency(r.dailyProfit)}/G.</div>
                        <div style="font-size:0.7rem; color:var(--text-muted);">${Utils.formatCurrency(r.profitPerFlight)}/Uçuş</div>
                    </div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; background:var(--primary-light); padding:10px; border-radius:10px;">
                    <div style="font-size:0.75rem; font-weight:700;">İDEAL: ${cat === 'pax' ? `Y:${opt.y} J:${opt.j} F:${opt.f}` : `L:${opt.l} H:${opt.h}`}</div>
                    <div style="display:flex; gap:5px;">
                        <button class="ai-btn-small" onclick="UI.askGemini('${planeName}', ${JSON.stringify(r).replace(/\"/g, '&quot;')})">🤖 AI</button>
                        <button class="apply-btn-small" onclick="Configurator.applySuggestion(${opt.y || opt.l}, ${opt.j || opt.h}, ${opt.f || null})">Yükle</button>
                    </div>
                </div>
                <div style="display:flex; gap:15px; font-size:0.7rem; color:var(--text-muted); border-top:1px solid var(--border); padding-top:8px; margin-top:8px;">
                    <span>Mesafe: ${r.distance}km</span> <span>Sefer: ${r.dailyTrips}x</span> <span>Verim: ${Utils.formatPercent(r.efficiency)}</span>
                </div>
            `;
            resultDiv.appendChild(card);
        });
    }
};

/**
 * Global tıklama dinleyicisi: Dropdown dışına tıklandığında menüleri kapatır.
 */
document.addEventListener('click', e => {
    if (!e.target.closest('.dropdown')) UI.closeAllDropdowns();
});
