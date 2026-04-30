/**
 * ui.js: MENOA AI Arayüz ve Sohbet Yönetimi.
 * GÜNCELLEME: Manuel Sefer Sayısı (Manual Trips) girişi ve /Day etiketleri eklendi.
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
        
        // Rota sayfaları açıldığında uçak seçim listelerini doldur
        if (id && id.includes('route')) UI.fillSelects();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    /**
     * Açılır menü (Dropdown) kontrolü.
     */
    toggleDropdown: function(id) {
        const el = document.getElementById(id);
        if (!el) return;
        const isOpen = el.classList.contains('open');
        UI.closeAllDropdowns();
        if (!isOpen) el.classList.add('open');
    },

    closeAllDropdowns: () => document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open')),

    /**
     * Oyun modunu (Easy/Realism) ayarlar.
     */
    setGameMode: function(mode) {
        window.gameMode = mode;
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(mode === 'easy' ? 'btn-easy' : 'id-real').classList.add('active');
        const display = document.getElementById('modeDisplay');
        if (display) {
            display.innerText = "Aktif Mod: " + (mode === 'easy' ? "Easy (Master)" : "Realism (1.0x)");
            display.className = "status-box " + (mode === 'easy' ? "status-success" : "status-danger");
        }
    },

    /**
     * Uçak seçim kutularını doldurur.
     */
    fillSelects: function() {
        const ps = document.getElementById('paxRouteSelect');
        const cs = document.getElementById('cargoRouteSelect');
        if (ps) {
            ps.innerHTML = '<option value="">-- Uçak Seçiniz --</option>';
            for (let n in aircraftData) if (aircraftData[n].type === 'passenger') ps.add(new Option(n, n));
        }
        if (cs) {
            cs.innerHTML = '<option value="">-- Uçak Seçiniz --</option>';
            for (let n in aircraftData) if (aircraftData[n].type === 'cargo') cs.add(new Option(n, n));
        }
    },

    /**
     * Daktilo Efekti: AI yanıtlarını akıcı bir şekilde yazar.
     */
    typeEffect: function(element, text, speed = 10) {
        if (!element) return;
        let i = 0;
        element.innerHTML = "";
        const timer = setInterval(() => {
            if (i < text.length) {
                element.innerHTML += text.charAt(i) === "\n" ? "<br>" : text.charAt(i);
                i++;
                const chatBody = document.getElementById('chat-body');
                if (chatBody && element.closest('#chat-body')) chatBody.scrollTop = chatBody.scrollHeight;
            } else { clearInterval(timer); }
        }, speed);
    },

    /**
     * Cloudflare Worker üzerinden Gemini AI analizi talep eder.
     */
    askGemini: async function(planeName, routeData) {
        const area = document.getElementById('aiResultArea');
        if (!area) return;
        area.innerHTML = '<div class="status-box status-neutral">🤖 MENOA Stratejileri Analiz Ediyor...</div>';
        
        try {
            const res = await fetch("https://ai.airm4.workers.dev/", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    plane: planeName, 
                    route: `${routeData.origin} ➔ ${routeData.destination}`, 
                    profit: Utils.formatCurrency(routeData.dailyProfit) + " per Day", 
                    distance: routeData.distance + " km",
                    efficiency: Utils.formatPercent(routeData.efficiency)
                })
            });
            const data = await res.json();
            area.innerHTML = `
                <div class="ai-report-card">
                    <h4 style="color:var(--primary); margin-bottom:10px;">🤖 MENOA MASTER ANALİZİ</h4>
                    <div id="typingArea" style="font-size:0.9rem; line-height:1.6;"></div>
                </div>`;
            this.typeEffect(document.getElementById('typingArea'), data.text);
            area.scrollIntoView({ behavior: 'smooth' });
        } catch (e) { area.innerHTML = `<div class="status-box status-danger">⚠️ Hata: Motor meşgul.</div>`; }
    },

    /**
     * Bütçeye göre en iyi uçakları ROI odaklı listeler.
     */
    renderSuggestions: function(cat) {
        const budget = Number(document.getElementById(cat + 'BudgetInput')?.value);
        if (!budget || budget <= 0) return;
        const res = Logic.getBestPlanesByType(budget, cat === 'pax' ? 'passenger' : 'cargo');
        document.getElementById(cat + 'PlaneResult').innerHTML = res.map(p => `
            <div class="plane-item">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong>${p.name}</strong>
                    <span style="color:var(--danger); font-weight:800;">ROI: ${p.roiDays.toFixed(1)} Gün</span>
                </div>
                <div style="font-size:0.8rem; margin-top:5px; color:var(--secondary);">
                    Hız: ${p.cruise_speed} km/s | Kâr: ${Utils.formatCurrency(p.dailyProfit)}/Day
                </div>
                <small style="color:var(--success); font-weight:600; display:block; margin-top:5px;">
                    En Karlı Rota: ${p.bestRouteOrigin} ➔ ${p.bestRouteName}
                </small>
            </div>
        `).join('');
    },

    /**
     * Rota analiz sonuçlarını ekrana basar.
     */
    renderRouteAnalysis: function(cat) {
        const selectId = cat === 'pax' ? 'paxRouteSelect' : 'cargoRouteSelect';
        const planeName = document.getElementById(selectId)?.value;
        const resDiv = document.getElementById(cat + 'RouteResult');
        const manualTripsInput = document.getElementById(cat === 'pax' ? 'paxTripsInput' : 'cargoTripsInput');
        const manualTrips = parseInt(manualTripsInput?.value) || null;

        if (!planeName || !resDiv) return;

        // Manuel konfigürasyon kontrolü
        let manualConfig = null;
        if (cat === 'pax') {
            const y = parseInt(document.getElementById('seatsY').value) || 0;
            const j = parseInt(document.getElementById('seatsJ').value) || 0;
            const f = parseInt(document.getElementById('seatsF').value) || 0;
            if (y > 0 || j > 0 || f > 0) manualConfig = { y, j, f };
        } else {
            const l = parseInt(document.getElementById('cargoL').value) || 0;
            const h = parseInt(document.getElementById('cargoH').value) || 0;
            if (l > 0 || h > 0) manualConfig = { l, h };
        }

        resDiv.innerHTML = '<div id="aiResultArea"></div><h3 style="margin:20px 0;">Rota Kâr Analizi</h3>';
        
        Logic.analyzeTopRoutesForPlane(planeName, 10, manualConfig, manualTrips).forEach((r, i) => {
            const plane = aircraftData[planeName];
            const opt = manualConfig || (plane.type === 'passenger' 
                ? Configurator.calculateOptimalSeats(plane, r, r.dailyTrips)
                : Configurator.calculateOptimalCargo(plane, r, r.dailyTrips));

            const card = document.createElement('div');
            card.className = 'route-card';
            card.innerHTML = `
                <div class="route-header">
                    <div class="route-info">
                        <strong>#${i + 1} ${r.origin} ➔ ${r.destination}</strong>
                        <small style="color:var(--secondary);">${r.distance} km | ${r.dailyTrips} Sefer/Day</small>
                    </div>
                    <div class="route-stats">
                        <div class="profit-val">${Utils.formatCurrency(r.dailyProfit)}/Day</div>
                        <div class="efficiency-tag">Verim: ${Utils.formatPercent(r.efficiency)}</div>
                    </div>
                </div>
                <div class="suggestion-bar">
                    <span class="ideal-config">ÖNERİ: ${cat === 'pax' ? `Y:${opt.y} J:${opt.j} F:${opt.f}` : `L:${opt.l} H:${opt.h}`}</span>
                    <div class="action-buttons">
                        <button class="ai-btn-small" onclick="UI.askGemini('${planeName}', ${JSON.stringify(r).replace(/\"/g, '&quot;')})">🤖 AI</button>
                        <button class="apply-btn-small" onclick="Configurator.applySuggestion(${opt.y || opt.l}, ${opt.j || opt.h || 0}, ${opt.f || 'null'})">Yükle</button>
                    </div>
                </div>`;
            resDiv.appendChild(card);
        });
    }
};

/** --- AI SOHBET MODÜLÜ --- */
const Chat = {
    toggle: () => document.getElementById('chat-window').classList.toggle('chat-hidden'),
    
    addMessage: (t, s) => {
        const b = document.getElementById('chat-body');
        if (!b) return;
        const d = document.createElement('div');
        d.className = `chat-msg ${s}-msg`;
        b.appendChild(d);
        if (s === 'ai') UI.typeEffect(d, t, 12);
        else { d.innerText = t; b.scrollTop = b.scrollHeight; }
    },
    
    send: async function() {
        const i = document.getElementById('chatInput');
        const t = i.value.trim(); if (!t) return;
        this.addMessage(t, 'user'); i.value = '';
        try {
            const r = await fetch("https://ai.airm4.workers.dev/", { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatMessage: t }) 
            });
            const d = await r.json(); this.addMessage(d.text || "Yanıt alınamadı.", 'ai');
        } catch (e) { this.addMessage("⚠️ Hata: Motor şu an yanıt vermiyor.", 'ai'); }
    }
};

window.UI = UI; window.Chat = Chat;
document.addEventListener('click', e => { if (!e.target.closest('.dropdown')) UI.closeAllDropdowns(); });
