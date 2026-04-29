/**
 * ui.js: MENOA AI Arayüz, Sohbet ve Analiz Yönetimi.
 * Özellikler: Daktilo efekti, İmzasız mesajlar, Akıllı UI geçişleri.
 * Bağlantı: https://ai.airm4.workers.dev/
 */

const UI = {
    showPage: function(id) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const targetPage = document.getElementById(id);
        if (targetPage) targetPage.classList.add('active');
        UI.closeAllDropdowns();
        if (id.includes('route')) UI.fillSelects();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

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
     * Rota Analizi - Daktilo Efektli
     */
    askGemini: async function(planeName, routeData) {
        const workerUrl = "https://ai.airm4.workers.dev/";
        const resultArea = document.getElementById('aiResultArea');
        if (!resultArea) return;

        resultArea.innerHTML = '<div id="aiLoader">🤖 MENOA Verileri İşliyor...</div>';

        try {
            const response = await fetch(workerUrl, {
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
                    <h4 style="margin:0 0 10px 0; color:var(--primary); font-weight:800;">🤖 MENOA AI ANALİZİ</h4>
                    <div id="typingAnalysis" style="font-size:0.9rem; line-height:1.6; color:var(--text);"></div>
                </div>`;
            
            this.typeEffect(document.getElementById('typingAnalysis'), data.text);
            resultArea.scrollIntoView({ behavior: 'smooth' });

        } catch (error) {
            resultArea.innerHTML = `<div class="status-box status-danger">Bağlantı Hatası: ${error.message}</div>`;
        }
    },

    /**
     * Daktilo Efekti Fonksiyonu
     */
    typeEffect: function(element, text) {
        let i = 0;
        element.innerHTML = "";
        const timer = setInterval(() => {
            if (i < text.length) {
                element.innerHTML += text.charAt(i) === "\n" ? "<br>" : text.charAt(i);
                i++;
                if (i % 5 === 0) window.scrollBy(0, 1);
            } else {
                clearInterval(timer);
            }
        }, 15);
    },

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
                    <span style="color:var(--primary); font-weight:800;">${Utils.formatPercent(p.efficiency)} Verim</span>
                </div>
                <small style="color:var(--success); font-weight:600;">Rota: ${p.bestRouteOrigin} ➔ ${p.bestRouteName}</small>
            </div>
        `).join('');
    },

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
            card.innerHTML = `
                <strong>#${i + 1} ${r.origin} ➔ ${r.destination}</strong> 
                <div style="color:var(--success); font-weight:700;">${Utils.formatCurrency(r.dailyProfit)}/G.</div>
                <button class="ai-btn-small" onclick="UI.askGemini('${planeName}', ${JSON.stringify(r).replace(/\"/g, '&quot;')})">🤖 AI</button>`;
            resultDiv.appendChild(card);
        });
    }
};

/** --- SOHBET MODÜLÜ --- */
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
            let i = 0;
            const timer = setInterval(() => {
                if (i < text.length) {
                    msgDiv.innerHTML += text.charAt(i) === "\n" ? "<br>" : text.charAt(i);
                    i++;
                    body.scrollTop = body.scrollHeight;
                } else {
                    clearInterval(timer);
                }
            }, 10);
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
            this.addMessage("⚠️ Bağlantı hatası.", 'ai');
        }
    }
};

window.UI = UI;
window.Chat = Chat;

document.addEventListener('click', e => {
    if (!e.target.closest('.dropdown')) UI.closeAllDropdowns();
});
