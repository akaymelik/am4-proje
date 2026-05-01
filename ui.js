/**
 * ui.js: MENOA AI Arayüz ve Sohbet Yönetimi (HAFIZALI VERSİYON).
 * GÜNCELLEME: Mesaj geçmişi (Chat History) eklendi.
 */

const UI = {
    // Sayfa yönetimi ve diğer görsel fonksiyonlar (Değişmedi)
    showPage: function(id) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const target = document.getElementById(id);
        if (target) target.classList.add('active');
        UI.closeAllDropdowns();
        if (id && id.includes('route')) UI.fillSelects();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    toggleDropdown: function(id) {
        const el = document.getElementById(id);
        if (!el) return;
        const isOpen = el.classList.contains('open');
        UI.closeAllDropdowns();
        if (!isOpen) el.classList.add('open');
    },

    closeAllDropdowns: () => document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open')),

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

    askGemini: async function(planeName, routeData) {
        const area = document.getElementById('aiResultArea');
        if (!area) return;
        area.innerHTML = '<div class="status-box status-neutral">🤖 MENOA Analiz Ediyor...</div>';
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
            area.innerHTML = `<div class="ai-report-card"><h4>🤖 MENOA MASTER ANALİZİ</h4><p id="typingArea"></p></div>`;
            this.typeEffect(document.getElementById('typingArea'), data.text);
            area.scrollIntoView({ behavior: 'smooth' });
        } catch (e) { area.innerHTML = "⚠️ Hata: Motor meşgul."; }
    }
};

/** --- AI SOHBET MODÜLÜ (GÜNCELLENDİ) --- */
const Chat = {
    // Tarayıcı hafızasında geçmişi tutan dizi
    history: [],

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

        // 1. Kullanıcı mesajını ekrana bas ve hafızaya al
        this.addMessage(t, 'user');
        i.value = '';

        try {
            // 2. Worker'a sadece mesajı değil, tüm geçmişi gönder
            const response = await fetch("https://ai.airm4.workers.dev/", { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    chatMessage: t,
                    history: this.history // Tüm konuşma geçmişi gidiyor
                }) 
            });
            
            const data = await response.json();
            
            // 3. Yapay zeka cevabını ekrana bas
            if (data.text) {
                this.addMessage(data.text, 'ai');
                
                // 4. HAFIZAYI GÜNCELLE: Gemini formatı için geçmişi kaydet
                this.history.push({ role: "user", parts: [{ text: t }] });
                this.history.push({ role: "model", parts: [{ text: data.text }] });
            }

        } catch (e) { 
            this.addMessage("⚠️ Hata: Motor şu an yanıt vermiyor.", 'ai'); 
        }
    }
};

window.UI = UI; window.Chat = Chat;
document.addEventListener('click', e => { if (!e.target.closest('.dropdown')) UI.closeAllDropdowns(); });
