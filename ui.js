/**
 * ui.js: MENOA AI Arayüz ve Sohbet Yönetimi.
 * GÜNCELLEME: Master ROI göstergeleri ve AI Rota Analizi desteği eklendi.
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
        
        // Rota sayfaları açıldığında uçak listelerini doldur
        if (id && id.includes('route')) {
            UI.fillSelects();
        }
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

    closeAllDropdowns: function() {
        document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
    },

    /**
     * Oyun modunu (Easy/Realism) ayarlar.
     */
    setGameMode: function(mode) {
        window.gameMode = mode;
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        
        const activeBtnId = mode === 'easy' ? 'btn-easy' : 'id-real';
        const activeBtn = document.getElementById(activeBtnId);
        if (activeBtn) activeBtn.classList.add('active');
        
        const display = document.getElementById('modeDisplay');
        if (display) {
            display.innerText = "Aktif Mod: " + (mode === 'easy' ? "Easy (Master)" : "Realism (1.0x)");
            display.className = "status-box " + (mode === 'easy' ? "status-success" : "status-danger");
        }
    },

    /**
     * Uçak seçim kutularını verilerle doldurur.
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
     * Daktilo (Typewriter) Efekti: AI yanıtlarını karakter karakter yazar.
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
                if (chatBody && element.closest('#chat-body')) {
                    chatBody.scrollTop = chatBody.scrollHeight;
                }
            } else {
                clearInterval(timer);
            }
        }, speed);
    },

    /**
     * Cloudflare Worker üzerinden AI analizi talep eder.
     */
    askGemini: async function(planeName, routeData) {
        const resultArea = document.getElementById('aiResultArea');
        if (!resultArea) return;

        resultArea.innerHTML = '<div class="status-box status-neutral">🤖 MENOA Master Verileri Analiz Ediyor...</div>';

        try {
            const response = await fetch("https://ai.airm4.workers.dev/", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plane: planeName,
                    route: `${routeData.origin} ➔ ${routeData.destination}`,
                    profit: Utils.formatCurrency(routeData.dailyProfit),
                    distance: routeData.distance,
                    efficiency: Utils.formatPercent(routeData.efficiency)
                })
            });
            const data = await response.json();
            
            resultArea.innerHTML = `
                <div class="ai-report-card">
                    <h4 style="color:var(--primary); margin-bottom:10px;">🤖 MENOA MASTER ANALİZİ</h4>
                    <div id="typingArea" style="font-size:0.9rem; line-height:1.6;"></div>
                </div>`;
            
            this.typeEffect(document.getElementById('typingArea'), data.text);
            resultArea.scrollIntoView({ behavior: 'smooth' });

        } catch (error) {
            resultArea.innerHTML = `<div class="status-box status-danger">⚠️ Hata: Motor meşgul.</div>`;
        }
    },

    /**
     * Bütçeye göre en verimli uçakları ROI odaklı listeler.
     */
    renderSuggestions: function(cat) {
        const budgetInput = document.getElementById(cat + 'BudgetInput');
        const budget = Number(budgetInput?.value);
        const resultDiv = document.getElementById(cat + 'PlaneResult');
        
        if (!budget || budget <= 0) return;

        const bestPlanes = Logic.getBestPlanesByType(budget, cat === 'pax' ? 'passenger' : 'cargo');
        
        resultDiv.innerHTML = bestPlanes.map(p => `
            <div class="plane-item">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong>${p.name}</strong>
                    <span style="color:var(--danger); font-weight:800;">ROI: ${p.roiDays.toFixed(1)} Gün</span>
                </div>
                <div style="font-size:0.8rem; margin-top:5px; color:var(--secondary);">
                    Hız: ${p.speed} km/s | Günlük Kâr: ${Utils.formatCurrency(p.dailyProfit)}
                </div>
                <small style="color:var(--success); font-weight:600; display:block; margin-top:5px;">
                    Rota: ${p.bestRouteOrigin} ➔ ${p.bestRouteName}
                </small>
            </div>
        `).join('');
    },

    /**
     * Rota analiz sonuçlarını ekrana basar.
     */
    renderRouteAnalysis: function(cat) {
        const selectId = cat === 'pax' ? 'paxRouteSelect' : 'cargoRouteSelect';
        const resultId = cat === 'pax' ? 'paxRouteResult' : 'cargoRouteResult';
        const planeName = document.getElementById(selectId)?.value;
        const resultDiv = document.getElementById(resultId);
        
        if (!planeName) return;

        resultDiv.innerHTML = `<div id="aiResultArea"></div><h3 style="margin:20px 0;">Master Strateji Rotaları</h3>`;
        const topRoutes = Logic.analyzeTopRoutesForPlane(planeName, 10);
        
        topRoutes.forEach((r, i) => {
            const card = document.createElement('div');
            card.className = 'route-card';
            
            const plane = aircraftData[planeName];
            const opt = plane.type === 'passenger' 
                ? Configurator.calculateOptimalSeats(plane, r, r.dailyTrips)
                : Configurator.calculateOptimalCargo(plane, r, r.dailyTrips);

            card.innerHTML = `
                <div class="route-header">
                    <div class="route-info">
                        <strong>#${i + 1} ${r.origin} ➔ ${r.destination}</strong>
                        <small style="color:var(--secondary);">${r.distance} km | ${r.dailyTrips} Sefer</small>
                    </div>
                    <div class="route-stats">
                        <div class="profit-val">${Utils.formatCurrency(r.dailyProfit)}/G</div>
                        <div class="efficiency-tag">Verim: ${Utils.formatPercent(r.efficiency)}</div>
                    </div>
                </div>
                <div class="suggestion-bar">
                    <div class="ideal-config" style="font-size:0.8rem; font-weight:700;">
                        ÖNERİ: ${cat === 'pax' ? `Y:${opt.y} J:${opt.j} F:${opt.f}` : `Large:${opt.l}`}
                    </div>
                    <div class="action-buttons" style="display:flex; gap:5px;">
                        <button class="ai-btn-small" onclick="UI.askGemini('${planeName}', ${JSON.stringify(r).replace(/\"/g, '&quot;')})" style="width:auto; padding:5px 10px;">🤖 AI</button>
                        <button class="apply-btn-small" onclick="Configurator.applySuggestion(${opt.y || opt.l}, ${opt.j || opt.h || 0}, ${opt.f || 'null'})" style="width:auto; padding:5px 10px; background:var(--success);">Yükle</button>
                    </div>
                </div>
            `;
            resultDiv.appendChild(card);
        });
    }
};

/** --- AI SOHBET MODÜLÜ --- */
const Chat = {
    toggle: function() {
        const win = document.getElementById('chat-window');
        if (win) win.classList.toggle('chat-hidden');
    },

    addMessage: function(text, sender) {
        const body = document.getElementById('chat-body');
        if (!body) return;
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-msg ${sender}-msg`;
        body.appendChild(msgDiv);

        if (sender === 'ai') {
            UI.typeEffect(msgDiv, text, 12);
        } else {
            msgDiv.innerText = text;
            body.scrollTop = body.scrollHeight;
        }
    },

    send: async function() {
        const input = document.getElementById('chatInput');
        const text = input?.value.trim();
        if (!text) return;

        this.addMessage(text, 'user');
        input.value = '';

        try {
            const response = await fetch("https://ai.airm4.workers.dev/", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatMessage: text })
            });
            const data = await response.json();
            this.addMessage(data.text || "Yanıt alınamadı.", 'ai');
        } catch (e) {
            this.addMessage("⚠️ Hata: Motor şu an yanıt vermiyor.", 'ai');
        }
    }
};

// Global erişim
window.UI = UI;
window.Chat = Chat;

// Dropdown dışı tıklama kontrolü
document.addEventListener('click', e => {
    if (!e.target.closest('.dropdown')) UI.closeAllDropdowns();
});
