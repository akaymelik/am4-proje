// Sayfa geçişlerini yönetir
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    
    // Rota sayfasına geçilirse uçak listesini yenile
    if (pageId === 'karlı-rota') {
        fillRoutePlaneSelect();
    }
}

// Rota sayfasındaki seçim kutusunu doldurur
function fillRoutePlaneSelect() {
    const select = document.getElementById('rotaUcaks');
    if (select.options.length <= 1) { // Eğer boşsa doldur
        for (let name in aircraftData) {
            let opt = document.createElement('option');
            opt.value = name;
            opt.innerText = name;
            select.appendChild(opt);
        }
    }
}

// Bütçeye göre en iyi uçağı ve o uçak için EN KARLI olan rotayı listeler
function renderPlaneSuggestions() {
    const budget = document.getElementById('budgetInput').value;
    const container = document.getElementById('ucakSonuc');
    
    if (!budget) return alert("Lütfen bütçenizi girin!");
    
    const results = findBestPlanes(budget);
    
    if (results.length === 0) {
        container.innerHTML = "<p style='color: #64748b;'>Bu bütçeye uygun uçak bulunamadı.</p>";
        return;
    }

    container.innerHTML = results.map(p => `
        <div class="result-item">
            <div>
                <strong style="font-size: 1.1rem; color: #1e293b;">${p.name}</strong><br>
                <small style="color: #059669; font-weight: 600;">En Karlı Rota: ${p.bestRouteName}</small>
            </div>
            <div style="text-align: right;">
                <span style="color: #2563eb; font-weight: bold; font-size: 1.1rem;">${p.roi} Gün</span><br>
                <small style="color: #64748b;">Maliyet: $${p.price.toLocaleString()}</small>
            </div>
        </div>
    `).join('');
}

// Seçilen belirli bir uçak için en karlı rota detaylarını detaylıca gösterir
function renderBestRoute() {
    const planeName = document.getElementById('rotaUcaks').value;
    const container = document.getElementById('rotaSonuc');
    
    if (!planeName) return alert("Lütfen bir uçak seçin!");
    
    const best = analyzeBestRouteForPlane(planeName);
    
    if (best) {
        container.innerHTML = `
            <div class="result-item" style="display: block; border-left-color: #059669;">
                <div style="margin-bottom: 15px;">
                    <h4 style="margin: 0; color: #1e293b;">Analiz Sonucu: ${best.origin} ➔ ${best.destination}</h4>
                    <small style="color: #64748b;">Bu uçak için veritabanındaki en karlı eşleşmedir.</small>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.95rem;">
                    <span><strong>Mesafe:</strong> ${best.distance} km</span>
                    <span><strong>Uçuş Süresi:</strong> ${best.flightTime} Saat</span>
                    <span><strong>Günlük Sefer:</strong> ${best.dailyTrips} Uçuş</span>
                    <span><strong>Yıllık Kar Tahmini:</strong> $${(best.dailyProfit * 365).toLocaleString()}</span>
                </div>

                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 15px 0;">
                
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <small style="display: block; color: #64748b;">Günlük Net Kâr</small>
                        <strong style="color: #059669; font-size: 1.2rem;">$${parseInt(best.dailyProfit).toLocaleString()}</strong>
                    </div>
                    <div style="text-align: right;">
                        <small style="display: block; color: #64748b;">Amorti (ROI)</small>
                        <strong style="color: #2563eb; font-size: 1.2rem;">${best.roiDays} Gün</strong>
                    </div>
                </div>
            </div>
        `;
    } else {
        container.innerHTML = "<p style='color: #ef4444;'>Bu uçak için uygun rota bulunamadı. Menzili popüler rotalarımızdan daha kısa olabilir.</p>";
    }
}
