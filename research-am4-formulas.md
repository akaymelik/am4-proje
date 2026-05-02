# AM4 Profit Formula Research

*Tarih: 2026-05-02 — araştırılan kaynaklar: 8 (4 birincil, 4 ikincil)*

## Özet

Topluluk tarafından `R^2 ≈ 1` güvenle doğrulanmış kanonik formülasyon kaynağı `abc8747/am4` (eski adı `cathaypacific8747/am4`) reposunun `docs/formulae.md` dosyasıdır. Buna göre `logic.js`'deki **fuel formülü doğru**, **pax bilet fiyatları doğru**, **cargo bilet fiyatları yanlış (basitleştirilmiş)**, **maintenance/wear formülü yanlış (gerçek model olasılıksal)** ve en kritik olarak **reputation factor + load factor mekaniği tamamen eksik**. Mevcut kodda `Configurator.calculateOptimalSeats` doluluğu sadece talebe ve kapasiteye göre hesaplıyor — gerçek AM4'te doluluk `R` (reputation) ve `α` (autoprice ratio) ile çarpılıyor; default reputation %49 olduğundan tüm gelir tahminlerimiz **~%1.85× şişkin** (1/0.54 değil çünkü gerçek formül `0.0085855 × R` katsayısı ile geliyor — aşağıda detay).

Kısa rotalardaki yanlış pozitif kâr probleminin asıl nedeni iki katmanlı: (1) reputation çarpanı yok → load %100 sayılıyor, (2) wear/repair maliyeti bizim modelde lineer değil olasılıksal olduğu için her sefer ayrı bir wear riski yarattığını yakalamıyoruz. Turnaround sabit 0.5h hipotezini ne doğrulayan ne de çürüten kanonik veri bulundu — community tarafında "ground time" hiç dokümante edilmemiş, oyun içi otomatik depart 30dk varsayımı sadece reverse-engineered bir tahmin. Demand'ın airline'lar arası paylaşımı yok: her airline kendi reputation × autoprice formülüne göre talepten pay alıyor (`Pax Carried` formülü).

---

## Mevcut formül vs Gerçek formül karşılaştırması

### A. Fuel

| Bizim formül | Community formülü | Kaynak | Karar |
|--------------|-------------------|--------|-------|
| `ceil(d/2)*2 * fp * (CI/500+0.6) * fc / 1000` | `fuel_lbs = (1 - t_f) * ceil(d, 2) * c_f * (CI/500 + 0.6)` — ardından `cost = fuel_lbs * $/1000lbs` | [abc8747/am4 formulae.md](https://github.com/abc8747/am4/blob/master/docs/formulae.md) ($R^2=1$, %100 confidence) | DOĞRU (küçük not) |

**Not:** Gerçek formülde `ceil(d, 2)` "2 ondalık basamağa yukarı yuvarla" anlamında (örn. 1234.567 → 1234.57 km), bizim `ceil(d/2)*2` ise "2'nin katına yuvarla" (1234.567 → 1236). İkisi farklı operasyonlar — bizim versiyonumuz uzun rotalarda fuel'ı az miktarda **fazla** hesaplıyor. Pratik fark <%0.1, ihmal edilebilir ama teknik olarak yanlış. Ayrıca bizde fuel training (`t_f`, 0-3) çarpanı yok — kullanıcı oyunda bu eğitimi alabilir; tam doğruluk için input'a eklenmeli.

### B. Staff

| Bizim formül | Community formülü | Kaynak | Karar |
|--------------|-------------------|--------|-------|
| pax: `(capacity * 8 + 250) / trips`<br>cargo: `(capacity * 0.012 + 250) / trips` | **Bulunamadı** — kanonik formülae.md'de staff salary formülü yok. | Negatif kanıt: [abc8747/am4 formulae.md](https://github.com/abc8747/am4/blob/master/docs/formulae.md), [tutebox FAQ](https://www.tutebox.com/119/games/airline-manager-frequently-asked-questions/) sadece "raise verince rep artar" diyor | ŞÜPHELİ |

Topluluk staff salary'i mekanik düzeyde dokümante etmemiş. AM4'te staff kategorileri (pilot/cabin crew/cargo crew/engineer/marketer) günlük sabit maaş (haftalık paneldeki "salary" sliderindan gelir) ödeniyor — bu **sefer başına değil, fleet+staff sayısına göre günlük sabit**. Bizim sefer başına lineer formülümüz büyük olasılıkla **community ortalamasını yaklaşık olarak modelliyor** ama oyun içi gerçek mekanik **staffing sliderı + maaş sliderı** kombinasyonu. Kısa rotalarda bizim formül `/trips` paydası nedeniyle çok düşük çıkıyor (24 trip/gün için 250/24 ≈ 10$/trip), aslında gerçek günlük sabit gider sefer sayısından bağımsız. **Bu, kısa rota şişirilmiş kâr probleminin bir bileşeni olabilir.**

### C. Maintenance

| Bizim formül | Community formülü | Kaynak | Karar |
|--------------|-------------------|--------|-------|
| `airTime * (price * 0.00006) + (price * 0.00001)` | **Wear** sefere bağlı: `wear ~ U(0, 0.015 * (1 - 0.02 * t_r))` (uniform dağılım, beklenen %0.75/sefer)<br>**Repair cost**: `C_r = 0.001 * C * (1 - 0.02 * t_r) * wear`<br>Beklenen sefer-başı maliyet: `E[C_r] = 0.001 * C * 0.0075 = 7.5e-6 * C` | [abc8747/am4 formulae.md — Aircraft/Wear ve Repair Cost](https://github.com/abc8747/am4/blob/master/docs/formulae.md) ($R^2=1$, %100) | YANLIŞ |

**Sapma boyutu:**
- Bizim formül $50M uçak, 1 saatlik uçuş için: `1 * 50M * 6e-5 + 50M * 1e-5 = 3000 + 500 = 3500$/sefer`
- Community formülü beklenen değer: `7.5e-6 * 50M = 375$/sefer` (~%10x daha az!)

Bizim formül **maintenance'ı ~10 kat şişiriyor** uzun uçuşlarda. Ama bu paradoxal olarak kısa rotalarda da yanlış — kısa rotada `airTime` küçük olduğu için bizim formül çok düşük çıkıyor (0.1h × 50M × 6e-5 + 50M × 1e-5 = 800$/sefer), community formülü hâlâ 375$/sefer beklenen — yani **kısa rotalarda bizim hesap bile gerçeğe yakın ama uzun rotalarda dramatik farkla şişiyor.** Asıl problem: community formülünde **A-check / D-check ücretleri ayrı bir kategori** (`check_cost` API field'ı, formülae.md'de "downtime time" formülü var ama cost ayrı). Bunu hiç modellememişiz.

### D. Ticket Prices

| Bizim formül | Community formülü | Kaynak | Karar |
|--------------|-------------------|--------|-------|
| **Pax Easy:** Y=`0.4d+170`, J=`0.8d+560`, F=`1.2d+1200` | Aynı (autoprice). **Optimal** için Y×1.10, J×1.08, F×1.06 | [abc8747/am4 formulae.md — Ticket Prices](https://github.com/abc8747/am4/blob/master/docs/formulae.md) ($R^2=1$, %100) | DOĞRU (autoprice) |
| **Pax Realism:** Y=`0.3d+150`, J=`0.6d+500`, F=`0.9d+1000` | Aynı. **Optimal**: Y×1.10, J×1.08, F×1.06 | aynı | DOĞRU (autoprice) |
| **Cargo Easy:** L=`0.07d+50`, H=`0.11d+150` (1000'e bölünüyor) | L=`0.0948283724581252d + 85.2045432642377`, H=`0.0689663577640275d + 28.2981124272893` (autoprice; optimal L×1.10, H×1.08) | aynı | YANLIŞ |
| **Cargo Realism:** aynı bizim modelde | L=`0.0776321822039374d + 85.0567600367807`, H=`0.0517742799409248d + 24.6369915396414` | aynı | YANLIŞ + EKSİK (mod ayrımı yok) |

Cargo bilet fiyat formülü hem yanlış katsayılarla, hem de Easy/Realism farkını hiç göstermeyerek hatalı. Örneğin 5000 km'lik bir kargo rotasında bizim Easy L = `(0.07*5000+50)/1000 = 0.4 $/lbs`, gerçek = `(0.0948*5000+85.20)/1000 ≈ 0.559 $/lbs` — **biz cargo gelirini ~%30 az hesaplıyoruz**. Bu, cargo öneri sıralamasını da bozar. Ayrıca **optimal price multiplier** (1.10/1.08/1.06) bizim hiç uygulanmıyor — kullanıcı manuel autoprice üzerine yüzdelik koyabilir; bunu bir "price strategy" toggle olarak eklemek %6-10 ek gelir tahmini sağlar.

### E. ⭐ Reputation Factor

| Bizim formül | Community formülü | Kaynak | Karar |
|--------------|-------------------|--------|-------|
| Yok — load `Configurator.calculateOptimalSeats` doluluğu sadece demand vs capacity kıyaslıyor | **Pax Carried** (yeterli talep varken):<br>`E[load] = 0.0085855 * R` (autoprice α>1, no stop)<br>`E[load] = 0.0090435 * R` (α>1, with stop)<br>`E[load] = 1 + α(0.0090312 R - 1)` (α≤1, no stop) — yani autoprice altında doluluk yüksek<br>**Yetersiz talep durumunda:** `load = 0.11136 * R` (D≥C, no stop) | [abc8747/am4 formulae.md — Pax Carried](https://github.com/abc8747/am4/blob/master/docs/formulae.md) (%80 confidence, N≈2000) | YANLIŞ — KRİTİK EKSİK |

**Default reputation:** %49 (marketing'siz, hub bonusu olmadan). Steam tartışmasında doğal olarak ~%54'e çıkabildiği rapor edilmiş ([Steam discussion](https://steamcommunity.com/app/1641650/discussions/0/596271068722763628/), [tutebox](https://www.tutebox.com/119/games/airline-manager-frequently-asked-questions/)).

**Sapma boyutu (autoprice α=1.10, R=49):**
- Community E[load] = `0.0085855 × 49 = 0.421` → planın %42'si dolu
- Bizim model: kapasite ≤ talepse %100 dolu kabul ediliyor

Yani **biz rotanın 2.4 katı yolcu taşıdığımızı sanıyoruz**. Default 49 rep ile, gerçek `singlePlaneDailyProfit` bizim hesapladığımızın yaklaşık `0.42` katı. Bu, önerilen filo büyüklüğüne göre yanlılığın değişebileceği anlamına gelir — büyük uçaklar küçük uçaklardan daha fazla kapasite-fazlası gösterip biz onları kötü sıralarken, gerçekte aynı orana inecek.

**Kısa rota probleminin asıl kaynağı bu:** 45 km AMS-RTM rotasında bizim model 250 koltuklu uçağı %68 talep ile %68 dolu sayıyor (talep sınırlı). Gerçek: `load = min(0.11136 × R, D/C limit)` = `0.11136 × 49 = 5.45%` doluluk. Yani uçak %5 dolu uçuyor — fuel/staff/maintenance giderini karşılayamıyor.

### F. ⭐ Turnaround Time

| Bizim formül | Community formülü | Kaynak | Karar |
|--------------|-------------------|--------|-------|
| Sabit `+0.5h` (cycleTime = airTime + 0.5) | **Bulunamadı.** Topluluk dokümanı turnaround/ground time formülü içermiyor. Sadece "Check Time" (A/D-check downtime) ve "Repair Time" formülleri var, normal sefer arası ground time yok. | Negatif kanıt: [abc8747/am4 formulae.md](https://github.com/abc8747/am4/blob/master/docs/formulae.md). Real-world referansları (Pilot Bible, AeroTime) AM4'e uygulanamaz. | ŞÜPHELİ |

AM4'te uçaklar otomatik depart açıkken yeni rotaya neredeyse anında geçer — community gözlemi 25-35 dakika arası varyasyon. Manual schedule'da kullanıcı slot seçer, yani turnaround değişken. Bizim sabit 0.5h hipotezi makul bir orta değer ama **uçak boyutu (boarding süresi) ile ölçeklenmiyor**. A380 için 30 dk gerçek dışı; A320 için fazla. Bu bir kuyruk uzunluğu/gözlem problemi ama community herhangi bir formül yayınlamamış — kuvvetli kanıt yok. Mevcut hâl ihtiyatlı bir varsayım olarak korunabilir.

### G. Demand Distribution (airline'lar arası paylaşım)

| Bizim formül | Community formülü | Kaynak | Karar |
|--------------|-------------------|--------|-------|
| Talep tek airline'a aitmiş gibi (FleetEfficiency 0.4-1.0 ile zayıf approxime) | **Talep airline'lar arası paylaşılmıyor** — her airline'ın kendi reputation × autoprice formülüne göre kendi yolcu havuzu var. Gerçek talep "günlük rota max" sınırıdır, R/α ile o sınıra ne kadar yaklaşacağın belirlenir. | [airlinemanager Zendesk demand FAQ](https://airlinemanager.zendesk.com/hc/en-us/articles/21732303589138-How-does-demand-work), [abc8747/am4 Demand](https://github.com/abc8747/am4/blob/master/docs/formulae.md) | YANLIŞ MODEL |

**Kritik düzeltme:** AM4'te aynı rotada 2 airline uçabilir, biri diğerinin talebini "tüketmez". Talep her airline için **kendi reputation'ına göre yenilenir**. Yani bizim `fleetEfficiency` katsayısı (0.4-1.0) yanlış bir sebebi modelliyor: gerçek problem **talep paylaşımı değil, aynı filodaki birden fazla uçağın aynı rotanın günlük cap'ine takılması**. Demand reset 00:00 UTC. Her uçak günde N sefer × kapasite × R × α taşıyabilir; toplam günlük talep limitini aşan kısım boş kalır.

**Doğru model:** Tek bir uçağın günlük yolcu sayısı `min(trips × capacity × E[load], daily_demand)`. Filo büyüklüğü arttıkça bu limit toplam filoda paylaşılır. Bizim 0.4-1.0 kabaca makul ama mantığı yanlış (paylaşımı modellediğini sanıyor).

### H. Short Route Profitability (45 km, 100 km altı)

| Bizim formül | Community gözlemi | Kaynak | Karar |
|--------------|-------------------|--------|-------|
| Hardcoded `if (dist < 100) return;` filtresi (logic.js:70) | "Daha kısa rota saatlik kazançta daha kârlı görünür **ama** boş yere uçar" — `Ax + B` ticket formülünde `B` sabiti kısa rotada boyut başına geliri yapay yükseltir. Reputation × load factor uygulandığında pratik kâr eksiye düşer. | [tutebox FAQ](https://www.tutebox.com/119/games/airline-manager-frequently-asked-questions/), [bjthoughts AM4 review](https://bjthoughts.com/2021/08/gaming-101-the-addictive-airline-manager-4/) | KESTIRMEDE DOĞRU AMA SEMPTOM TEDAVİSİ |

Hard 100 km filtresi şimdilik makul (zaten community feeder rotaları manuel kullanır), ama **asıl çözüm reputation × load factor ekleyince filtre gereksiz hale gelir**. 45 km rotada doluluk gerçekten %5 çıkıyor, yani profit zaten negatif görünür. Filtre kalsa bile, F/E düzeltmeleri sonrası `< 100` eşiği `< 200` veya tamamen kaldırılabilir.

---

## Tespit edilen sapmalar

1. **Reputation/load factor eksik (en kritik)** — Tüm gelir tahminleri default %49 rep ile gerçeğin yaklaşık 2.4× üstünde. Kısa rotalarda fark daha dramatik (yetersiz demand zone'unda load = `0.11136 × R = %5.45`).
2. **Cargo bilet fiyatları yanlış katsayılarla** — gelir ~%30 az hesaplanıyor, mod ayrımı yok.
3. **Maintenance modeli wear-based değil** — uzun rotalarda ~10× şişiyor; A-check/D-check ücretleri hiç yok.
4. **Optimal price multiplier (1.10/1.08/1.06) hiç uygulanmıyor** — autoprice = sadece taban; topluluk standardı bunu çarpıyor.
5. **CO₂ maliyeti tamamen eksik** — kanonik formülde tam dökümlü, biz hiç kullanmıyoruz. Uzun pax rotada günde 100K+ lbs CO₂ × $/lbs cidddi gider.
6. **Fuel `ceil(d, 2)` semantik yanlış** — küçük etki ama teknik bug.
7. **Staff cost trips'e bölünüyor** — gerçekte günlük sabit; kısa rotada şişen profit'in ikincil sebebi.
8. **Demand sharing (`fleetEfficiency`) yanlış sebebi modelliyor** — sayısal değer makul olabilir ama mantık `daily_demand` cap'i olmalı.

---

## Önerilen düzeltmeler (logic.js)

### 1. Reputation × load factor uygula (en yüksek öncelik)

```js
// logic.js başında ek sabit
function getReputation() { return (window.REPUTATION ?? 49); } // 0-100
const PRICE_MULTIPLIER = { y: 1.10, j: 1.08, f: 1.06, l: 1.10, h: 1.08 }; // optimal autoprice over

// Configurator.calculateOptimalSeats / calculateOptimalCargo sonrası
// Ham koltuk allokasyonu sonrası bunu uygula:
function applyLoadFactor(seatsAllocated, demand, capacity, hasStop = false) {
    const R = getReputation();
    const alpha = 1.10; // varsayılan optimal autoprice
    let loadRatio;
    if (demand >= capacity) {
        // yeterli talep — α>1 dalı
        loadRatio = hasStop ? 0.0090435 * R : 0.0085855 * R;
    } else {
        // yetersiz talep — D/C oranlı
        loadRatio = hasStop
            ? 0.3105 * (demand/capacity) + 0.1038
            : 0.3312 * (demand/capacity) + 0.1014;
        // %100 cap
        if (demand < capacity * loadRatio) loadRatio = 1;
    }
    return seatsAllocated * loadRatio;
}
```

**Kaynak:** [abc8747/am4 formulae.md — Pax Carried section](https://github.com/abc8747/am4/blob/master/docs/formulae.md)

**Not:** Mevcut UI'da reputation input'u yok — kullanıcıdan al (anasayfada CI ve fuel_price gibi). Default 49.

### 2. Cargo bilet fiyatlarını düzelt

```js
// Configurator.getTicketMultipliers içinde
if (gameMode === 'easy') {
    return {
        y: 0.4*d + 170, j: 0.8*d + 560, f: 1.2*d + 1200,
        l: (0.0948283724581252*d + 85.2045432642377) / 1000,
        h: (0.0689663577640275*d + 28.2981124272893) / 1000
    };
} else {
    return {
        y: 0.3*d + 150, j: 0.6*d + 500, f: 0.9*d + 1000,
        l: (0.0776321822039374*d + 85.0567600367807) / 1000,
        h: (0.0517742799409248*d + 24.6369915396414) / 1000
    };
}
```

**Kaynak:** [abc8747/am4 formulae.md — Cargo](https://github.com/abc8747/am4/blob/master/docs/formulae.md)

### 3. Maintenance'ı wear-based modelle değiştir

```js
calculateMaintenanceCost: function(plane /* , airTime — artık gereksiz */) {
    // Beklenen wear sefer başına 0.75% (training=0)
    const expectedWearPerFlight = 0.0075;
    return 0.001 * plane.price * expectedWearPerFlight; // = 7.5e-6 * price
    // Not: A-check/D-check periyodik ücretleri ayrı kategori; günlük ortalama
    // ~ price * (acheck_cost / acheck_hours) eklenmeli ama plane.json'da bu
    // alanlar yok — bu pas için skip.
}
```

**Kaynak:** [abc8747/am4 formulae.md — Wear ve Repair Cost](https://github.com/abc8747/am4/blob/master/docs/formulae.md)

### 4. Optimal price multiplier toggle'ı

```js
// Configurator'da
const USE_OPTIMAL_PRICE = window.PRICE_STRATEGY === 'optimal'; // default false
const yPrice = base.y * (USE_OPTIMAL_PRICE ? 1.10 : 1.0);
// vb.
```

Optimal aktifse `Pax Carried` formülünde α>1 dalı kullanılır (load factor 0.0085855*R).

### 5. Fuel `ceil` semantic fix

```js
// Eski: const ceilDist = Math.ceil(route.distance / 2) * 2;
// Yeni: 2 ondalık basamağa yukarı yuvarlama
const ceilDist = Math.ceil(route.distance * 100) / 100;
```

**Kaynak:** [abc8747/am4 formulae.md — Fuel Consumption](https://github.com/abc8747/am4/blob/master/docs/formulae.md)

### 6. Staff'ı günlük sabit yap

```js
// Eski: per-trip allocation
// Yeni: günlük sabit, sefer sayısına bölme!
const dailyStaffCost = plane.type === 'cargo'
    ? plane.capacity * 0.012 + 250  // bizim eski formül ama TRIPS'e bölmeden
    : plane.capacity * 8 + 250;
// dailyProfit hesabında: profitPerFlight * trips - dailyStaffCost
```

**Not:** Bu bizim mevcut formüllerin `*trips` versiyonu — değer kaynağı belirsiz (community'de yok), ama yapısal olarak günlük sabit olarak modellemek **kısa rotalardaki şişmeyi düzeltir**. Belirsizlik: değer hâlâ makul mü? Belki kalibrasyon gerek.

### 7. CO₂ cost ekle (orta öncelik)

```js
// Pax CO2
const passengerWeight = y_loaded + 2*j_loaded + 3*f_loaded + y_capacity + j_capacity + f_capacity;
const co2_lbs = ceilDist * plane.co2_consumption * passengerWeight * (CI/2000 + 0.9);
const co2Cost = co2_lbs * (window.CO2_PRICE || 120) / 1000; // ~$120/1000lbs default
```

**Kaynak:** [abc8747/am4 formulae.md — CO₂ Consumption](https://github.com/abc8747/am4/blob/master/docs/formulae.md)

**Not:** `plane.co2_consumption` field'ı planes.json'da yok — eklenmesi gerek. Pas için fuel'ın %5-10'u olarak yaklaşıklayabiliriz.

---

## Kaynaklar

1. [abc8747/am4 docs/formulae.md (master branch)](https://github.com/abc8747/am4/blob/master/docs/formulae.md) — birincil. "By Cathay Express, Star Alliance and other contributors", son major revizyon 7 Jul 2021, son güncelleme 28 Aug 2025. Confidence işareti her formülde belirtilmiş ($R^2$ dahil). Tüm fuel, ticket, wear, repair, demand, pax-carried formülleri buradan alındı.
2. [abc8747/am4 GitHub repo](https://github.com/abc8747/am4) — repo yapısı doğrulaması, dokümantasyon site'i `abc8747.github.io/am4/`.
3. [airlinemanager.zendesk.com — How does demand work?](https://airlinemanager.zendesk.com/hc/en-us/articles/21732303589138-How-does-demand-work) — demand reset 00:00 UTC, "remaining demand" tanımı.
4. [airlinemanager.zendesk.com — What is cost index?](https://airlinemanager.zendesk.com/hc/en-us/articles/21733592849938-What-is-cost-index) — CI 0-200 aralığı, fuel-speed trade-off (içerik 403 ile kısmen okunamadı, search snippet'tan).
5. [Steam Community — reputation thread](https://steamcommunity.com/app/1641650/discussions/0/596271068722763628/) — default rep ~%49, doğal yükselme ~%54 cap, hub başına +%1 (10 hub'a kadar).
6. [Tutebox — AM4 FAQ](https://www.tutebox.com/119/games/airline-manager-frequently-asked-questions/) — pax = f(rep, advertising, demand), reputation max %49 marketingsiz.
7. [bjthoughts — Gaming 101: AM4 (2021)](https://bjthoughts.com/2021/08/gaming-101-the-addictive-airline-manager-4/) — Easy 4× hız, kısa rota Ax+B sabiti gözlemi.
8. [airlinemanager.zendesk.com — How do I increase my reputation?](https://airlinemanager.zendesk.com/hc/en-us/articles/21732301401490-How-do-I-increase-my-reputation) — eco-friendly, advertising, maintenance staying current rep'i etkiler (formül yok, kalitatif).

İncelendi ama formül vermedi: [Scribd guide'lar](https://www.scribd.com/document/727145390/EVERYTHING-ABOUT-AM4) (sadece preview), [airline-manager fandom wiki](https://airline-manager.fandom.com/wiki/Maintenance) (kalitatif), AirlinesManager Help (farklı oyun, AM4 değil).

Yasak kaynak (kontrol edildi, fetch edilmedi): am4tools.com.

---

## Belirsiz noktalar

- **Staff salary kesin formülü** — community dokümante etmemiş. Bizim `(capacity*8+250)/trips` mantığı yanlış (per-flight değil günlük olmalı) ama doğru sayısal kalibrasyon belirsiz. Bir düzine oyun-içi snapshot ile reverse-engineer gerek.
- **Turnaround time formülü** — sabit 30 dk hipotezini ne doğrulayan ne çürüten community kaynak yok. Uçak boyutuyla ölçeklendiği gözleniyor (büyük uçak ≥ 1h) ama formel formül yok. Geçici çözüm: airTime + max(0.5, capacity/500) gibi bir heuristik.
- **A-check / D-check ücretleri** — community formülü "downtime" verir, "cost"u verir ama günlük amortisman olarak nasıl modelleneceği bizim mimaride muğlak. `plane.check_cost` field'ı mevcut planes.js'de yok.
- **CO₂ price** — fuel price gibi piyasada dalgalanır, AM4'te ~$100-150/1000lbs aralığında gözlenir. Tek kaynak yok, kullanıcı input'u olmalı.
- **`Pax Carried` formülü %80 confidence** — diğer formüllerin çoğu %100 ($R^2=1$), bu %80 (N≈2000). Yani uygulanan load factor değerlerinin ±%5-10 belirsizlik var — kabul edilebilir ama "kesin" değil.
- **Fuel training (`t_f`), repair training (`t_r`), CO₂ training (`t_c`)** — hepsi 0-3/0-5 aralığında, kullanıcı oyunda upgrade edebilir. Şimdilik 0 varsay, ileri sürüm için optional input.
- **VIP rotalar** — formülae.md'de `1.7489×` çarpan veriyor; bizim modelde VIP ayrımı yok. Niche feature, pas geçilebilir.
- **Reputation hesaplama detayı** — `49 + hub_count*1 + eco_bonus + marketing_bonus` formülü var ama parça parça spekülatif; kullanıcıdan alıp sabit kabul etmek en güvenli yol.
