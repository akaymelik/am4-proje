// ROI (Amorti Süresi) Hesabı: Fiyat / (Günlük Tahmini Kar)
function calculateROI(plane) {
    const dailyProfit = (plane.capacity * 400 * 4) - (plane.fuel_consumption * 2000 * 4); // Örnek günlük 4 sefer
    return (plane.price / dailyProfit).toFixed(1);
}

function findBestPlanes(budget) {
    let matches = [];
    for (let name in aircraftData) {
        const p = aircraftData[name];
        if (p.price <= budget) {
            matches.push({
                name: name,
                roi: calculateROI(p),
                ...p
            });
        }
    }
    // En hızlı amorti olana göre sırala
    return matches.sort((a, b) => a.roi - b.roi);
}
