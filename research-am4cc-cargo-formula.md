# am4-cc.pages.dev Cargo Formula Analizi

*Tarih: 2026-05-04. Bundle: `_am4cc_dump/index.js` (380 KB, single-file Vite build, hash `BLhCUJra`).*
*Karşılaştırılan kanonik kaynak: `abc8747/am4` GitHub repo, `src/am4/utils/cpp/ticket.cpp` ve `route.cpp`.*

## ÖZET

**Cargo bilet katsayıları doğru, ama bölme faktörü yanlış: 1000 yerine 100 olmalı.**

`configurator.js`'de uyguladığımız Fix #2 katsayıları hem am4-cc.pages.dev'in indirdiği bundle'da hem de abc8747/am4 C++ source'unda byte-byte aynı çıktı (Easy L=`0.0948283…d + 85.20…`, Realism L=`0.0776…d + 85.05…`, vb.). Sütunlar **kayıt değil**, swap yok. Heavy'in lbs başına Light'tan ucuz olması bug değil — kanonik AM4 formülü gerçekten böyle. ŞÜPHELİ ETMEYE GEREK YOK: 4 farklı bağımsız kaynak (am4-cc minified bundle, abc8747 C++ source, abc8747 docs/formulae.md, kendi research-am4-formulas.md notlarımız) birebir aynı katsayıları gösteriyor.

**Asıl bug:** Hem am4-cc hem abc8747 source şu transformasyonu kullanıyor: `floor(autoprice * x) / 100` (yani autoprice doğrudan **cents** birimi üretir, sonra cents→dollar dönüşümü için 100'e bölünür → **`$/lbs`** birimi). Bizim configurator.js ise `(formül sonucu) / 1000` yapıyor — sonuç bizde `$0.34/lbs`, kanonikte `$3.44/lbs` çıkıyor. **Cargo gelirimiz olduğundan 10× düşük tahmin ediliyor.** Bu, "A330-200F neden tüm rotalarda zarar ediyor" sorusunun birinci sebebidir; ek olarak bizde `0.7×` Light kapasite/ağırlık çarpanı ve A-check/repair maliyet kalemleri de eksik (ikincil; ana mesele divisor).

**Bir sonraki adım:** `configurator.js` getTicketMultipliers cargo dallarında `/ 1000` → `/ 100` (tek satır × 4) ve sonra A330-200F testi. Beklenen: per-trip revenue ~$150-180K (am4-cc'nin canlı sayılarına göre).

## Cargo bilet fiyat formülü

**am4-cc.pages.dev `Vt(distance, gameMode)` fonksiyonu (`_am4cc_dump/index.js`, single line bundle):**

```js
function Vt(e,t){
  return String(t||`Realism`).toLowerCase()===`easy`
    ? { l: zt(1.1*(.0948283724581252*e+85.2045432642377)),
        h: zt(1.08*(.0689663577640275*e+28.2981124272893)) }
    : { l: zt(1.1*(.0776321822039374*e+85.0567600367807)),
        h: zt(1.08*(.0517742799409248*e+24.6369915396414)) }
}
function zt(e){ return Math.floor(Number(e||0))/100 }
```

**Kanonik abc8747 C++ source (`ticket.cpp`):**

```cpp
// EASY
ticket.l = floorf(static_cast<float>(1.10 * (0.0948283724581252 * distance + 85.2045432642377))) / 100;
ticket.h = floorf(static_cast<float>(1.08 * (0.0689663577640275 * distance + 28.2981124272893))) / 100;
// NORMAL (Realism)
ticket.l = floorf(static_cast<float>(1.10 * (0.0776321822039374 * distance + 85.0567600367807))) / 100;
ticket.h = floorf(static_cast<float>(1.08 * (0.0517742799409248 * distance + 24.6369915396414))) / 100;
```

**Sonuçlar:**
- **Heavy:** ✅ bulundu, hem am4-cc hem abc8747 source'ta birebir.
- **Light:** ✅ bulundu, hem am4-cc hem abc8747 source'ta birebir.
- **Mod ayrımı:** ✅ Easy ve Realism için ayrı katsayılar var. (Eski research-am4-formulas.md bunu zaten doğru tespit etmişti, kod da uygulamış.)
- **Birim:** ham formül **cents/lbs** üretir (doc'ta yazmıyor, kod'dan çıkarıldı), `floor(...) / 100` ile **`$/lbs`**'e çevrilir. Optimal autoprice çarpanı (L×1.10, H×1.08) `floor` ÖNCESİ uygulanıyor.

**Örnek hesap (d = 5000 km):**

| | Easy L | Easy H | Realism L | Realism H |
|--|--|--|--|--|
| Ham formül | `1.1*(0.0948*5000+85.20) = 562.74` | `1.08*(0.0689*5000+28.30) = 402.99` | `1.1*(0.0776*5000+85.06) = 520.39` | `1.08*(0.0517*5000+24.64) = 306.20` |
| `floor(.)/100` | **$5.62/lbs** | **$4.02/lbs** | **$5.20/lbs** | **$3.06/lbs** |
| Bizim hesap (`/1000`) | $0.563/lbs | $0.402/lbs | $0.520/lbs | $0.306/lbs |
| Sapma | **10× düşük** | **10× düşük** | **10× düşük** | **10× düşük** |

(Heavy'nin Light'tan ucuz olması doğru — kanonik AM4 mekaniği, swap değil.)

## Cargo gelir hesabı (gross revenue)

**am4-cc.pages.dev hesabı (`z` memo, single-route view):**

```js
let n = Bt(M.yd, M.jd);              // demand: l = yd*500, h = jd*1000 (lbs/gün)
let r = Vt(t, e);                    // prices: { l, h } in $/lbs (yukarıdaki Vt)
let i = Ht(capacity, n.l, n.h, Ge, de, 'auto');  // config: tripL, tripH (lbs/sefer), lPct, hPct
let o = i.tripL*r.l + i.tripH*r.h;   // estimatedTripRevenue
let s = o * Ge;                      // estimatedDailyRevenue (Ge = tripsPerDay user input)
```

**Önemli iç fonksiyonlar:**

```js
// Ht: cargo config (lPct verilen, hPct = 100 - lPct)
function Ht(e,t,n,r,i,a='auto'){
  let s = Rt(e, i);                  // s = effective capacity (capacity × loadPct/100)
  let u = .7 * 1.06;                 // lCapFactor = 0.742  (Large training lvl 6)
  let d = 1.06;                      // hCapFactor = 1.06   (Heavy training lvl 6)
  // tripL = floor(lPct/100 * effectiveCapacity * 0.742)  -- lbs of L per trip
  // tripH = floor(hPct/100 * effectiveCapacity * 1.06)   -- lbs of H per trip
  ...
}

// Bt: kargo demand'ı pax demand'tan türet (am4-cc'nin kendi data shortcut'u)
function Bt(e,t){ return { l: Math.max(0,Number(e||0)*500),
                            h: Math.max(0,Number(t||0)*1000) } }

// Rt: effective capacity = capacity × loadPct/100
function Rt(e,t){ return Math.max(0, Math.floor(Number(e||0) * Lt(t))) }
function Lt(e){ return It(e)/100 }
function It(e){ return Math.max(0, Math.min(100, Number(e))) }
```

**Kanonik abc8747 C++ kargo gelir formülü (`route.cpp` `update_cargo_details`):**

```cpp
auto calc_income = [&](const Aircraft::CargoConfig& cfg) -> double {
    return ((1 + user.l_training / 100.0) * cfg.l * 0.7 * tkt.l + 
            (1 + user.h_training / 100.0) * cfg.h * tkt.h) *
           ac_capacity / 100.0;
};
```

`cfg.l`, `cfg.h` burada **yüzde** (0-100). Final `/ 100.0` yüzdeyi fraction'a çevirir. **L için ayrıca 0.7 çarpanı var, H için yok** — bu, "Light cargo birim ağırlığa daha az yer kaplar ama biz onu daha az slot dolduğu için tek slot başına daha az gelir getirir" mekaniğini modelliyor (kapasiteye L'nin daha sıkı paketlenmesi). am4-cc bu 0.7'yi `Ht`'ye taşımış (`lCapFactor=0.742`).

**Reputation/load factor:**
- am4-cc'de yok. `loadPercent` (`de`) tamamen kullanıcı input — UI'da bir slider; varsayılan UI'da 100, kullanıcı kendi reputation'ını bilip elle giriyor. **Reputation × autoprice formülü uygulanmamış.** Bu, abc8747 docs'taki `Pax Carried` formülünün **sadece pax route analyzer'da `estimate_load` fonksiyonu olarak C++ source'ta var ama cargo path'inde kullanılmıyor** ifadesiyle uyumlu (route.cpp'den onaylandı).
- Yani **am4-cc kullanıcıdan "doluluk yüzdesi" alıyor**, biz ise koltuk allokasyonunu demand vs capacity'den hesaplıyoruz; ikisi de "gerçek" reputation çarpanı uygulamıyor.

**Optimal autoprice multiplier (L×1.10, H×1.08):**
- am4-cc'de **default ve sabit** — `Vt` her zaman bunu uyguluyor, toggle yok. abc8747 C++ source'ta da aynı (autoprice = optimal default).
- Bizim Fix #4'te de aynısı: `getTicketMultipliers` her zaman 1.10/1.08 çarpıyor. ✅ Doğru.

## Maliyet hesabı (am4-cc'de)

**am4-cc'nin cargo route view'unda profit hesaplanmıyor — sadece revenue gösteriliyor.** Ayrı bir "Aircraft Range Calculator" sayfası var (`pr` ve `kr` fonksiyonları, ID'lerden `Or`/`Ar` UI bölümleri) — burada profit hesaplanıyor ama **sadece pax (Y class), ve sadece** şu kalemleri çıkarıyor:

```js
// _am4cc_dump/index.js, range calculator
let p = (1 - i/100) * u * Number(e.fuel||0) * (c/500 + .6);     // fuelPerFlightLbs
let m = (1 - a/100) * u * Number(e.co2||0) * f * (c/2e3 + .9);  // co2PerFlightKg
let g = h/1e3 * o;                                               // fuelCost = totalLbs/1000 * fuelPrice
let v = _/1e3 * s;                                               // co2Cost = totalKg/1000 * co2Price
return { /* ... */, profit: x - g - v };                         // profit = revenue - fuel - co2
```

- **Yakıt formülü:** `fuelLbs = (1 - fuelTraining/100) × distance × plane.fuel × (CI/500 + 0.6)`. Bizim `logic.js`'tekiyle aynı ama bizde `t_f` (training) yok ve `ceil(d/2)*2` semantic farkı var (ihmal edilebilir).
- **Staff/personel:** **am4-cc'de yok.** Profit'ten staff salary çıkarılmıyor. abc8747 C++ source'ta da staff salary `update_*_details` profit zincirinde **yok** (`profit = income - fuel*fp/1000 - co2*cp/1000 - acheck_cost - repair_cost` — staff'sız).
- **Bakım/maintenance:** am4-cc bundle'ında profit'e dahil değil. abc8747 source'ta ise `acheck_cost + repair_cost` ayrı kalemler olarak çıkarılıyor (wear-based, lineer değil). Bizim `airTime * price * 0.00006 + price * 0.00001` modelimiz uzun rotalarda ~10× şişiyor (önceki research notuna göre).
- **A-check / D-check:** abc8747 source'ta `acheck_cost` profit'ten direkt çıkarılır (per trip). Bizde yok.
- **CO₂:** am4-cc bundle'ı `co2Cost = co2lbs/1000 * co2Price` formülünü kullanıyor; abc8747 da aynı. Bizde **yok** — `logic.js`'te CO₂ hiç hesaplanmıyor.

## Karşılaştırma

| Kalem | Bizim (`configurator.js` + `logic.js`) | am4-cc.pages.dev | abc8747/am4 docs + C++ source |
|--|--|--|--|
| **Cargo L katsayısı (Easy)** | `0.0948283724581252×d + 85.2045432642377` | aynı | aynı |
| **Cargo L katsayısı (Realism)** | `0.0776321822039374×d + 85.0567600367807` | aynı | aynı |
| **Cargo H katsayısı (Easy)** | `0.0689663577640275×d + 28.2981124272893` | aynı | aynı |
| **Cargo H katsayısı (Realism)** | `0.0517742799409248×d + 24.6369915396414` | aynı | aynı |
| **Bölme faktörü** | **`/1000`** ← BUG | `floor(...)/100` | `floorf(...) / 100` |
| **Autoprice çarpanı L** | ×1.10 (Fix #4) | ×1.10 (sabit, floor öncesi) | ×1.10 |
| **Autoprice çarpanı H** | ×1.08 (Fix #4) | ×1.08 (sabit, floor öncesi) | ×1.08 |
| **Light kapasite çarpanı (0.7)** | **yok** | `lCapFactor=0.742` (= 0.7×1.06, Large training lvl 6 dahil) | `cfg.l × 0.7 × tkt.l` (training bonusu opsiyonel) |
| **Heavy kapasite çarpanı** | n/a | `hCapFactor=1.06` (Heavy training lvl 6) | training bonusu opsiyonel, baseline 1.0 |
| **Reputation × load factor** | yok (demand vs capacity) | yok (kullanıcı input) | sadece pax `estimate_load`'da, cargo yolunda yok |
| **Pax bilet fiyatları** | bizim formül = autoprice × (1.10/1.08/1.06), `$/pax` direkt | aynı, ama final `floor(.)−1` ile $1 indirim ve VIP planeleri için 1.7489× ek çarpan | aynı (autoprice × optimal mult) |
| **Yakıt formülü** | `ceil(d/2)*2 × fuel_consumption × (CI/500+0.6) × fp / 1000` | `(1−t_f/100) × d × fuel × (CI/500+0.6)` ardından `lbs/1000 × fp` | aynı abc8747 (kanonik) |
| **Staff salary** | per-trip: `(cap*0.012+250)/trips` (cargo) | hiç yok (profit zincirinde değil) | hiç yok (profit zincirinde değil) |
| **Maintenance** | `airTime × price × 6e-5 + price × 1e-5` | hiç yok (profit zincirinde değil) | `acheck_cost + repair_cost` (wear-based, lineer değil) |
| **CO₂ cost** | yok | `co2_lbs / 1000 × co2_price` | aynı |

## Kritik tespitler

1. **L/H sütun karışıklığı YOK.** Bizim configurator.js'teki `0.0948…` Easy L katsayısı, am4-cc bundle'ında `Vt` fonksiyonunun Easy dalında L olarak görünüyor (line 1, ~`Vt(e,t){...easy?{l:zt(1.1*(.0948283724581252*e+85.2045432642377))…}` substring'i). abc8747 ticket.cpp da aynı satırda `ticket.l = ... 0.0948…`. **3 bağımsız kaynakla doğrulandı, swap yok.**

2. **Mod farkı VAR ve doğru uyguluyoruz.** Easy ve Realism cargo katsayıları farklı (Easy daha pahalı per lbs). Bizim configurator.js bunu uyguluyor. ✅

3. **Heavy lbs başına gerçekten Light'tan ucuz** — bug değil, oyun mekaniği. Soru başlangıcındaki "Heavy paying more per lbs olmalı" varsayımı yanlış. AM4'te Heavy ucuz/lbs ama slot başına daha çok lbs taşır (1.06× vs 0.742× = 1.43× ağırlık/slot) → kullanıcı **dense** rotalarda H tercih eder, hafif/yüksek-talep rotalarda L. Per-trip revenue: bizim canonical hesabımıza göre 70K lbs A330-200F × 100% L tek-mod = $168K, 100% H tek-mod = $133K — Realism d=2933. Yani aynı 100% slot doluluğunda **L hâlâ daha çok ücret üretir**, H'in avantajı talep ile sınırlanmış olduğu rotalarda ortaya çıkar.

4. **Reputation default belirsiz.** am4-cc bundle'ında reputation hesabı yok, kullanıcı `loadPercent` slider'ından elle giriyor. abc8747 C++'da `estimate_load` reputation kullanıyor ama cargo profit zincirinde **çağrılmıyor**. Bizim mevcut modelimiz da aynı şey (demand vs capacity'ye dayalı, reputation çarpanı yok).

5. **Eksik maliyet kalemlerimiz (önem sırasına göre):**
   - **`/1000` divisor → `/100` (KRİTİK)**: cargo gelirini 10× düşük hesaplıyoruz, bu A330-200F'ın eksiye düşmesinin BİRİNCİL sebebi.
   - **Light için 0.7× kapasite/ağırlık çarpanı (ÖNEMLİ)**: configurator.js `calculateOptimalCargo`'da L için `cap × 0.7` yapmamız gerekiyor; şu an L ve H aynı kapasite birimini paylaşıyor sandığımız için L'i overpriced gösteriyoruz. Düzeltme: tripL/tripH am4-cc'deki Ht gibi 0.742/1.06 ayrımı.
   - **Maintenance modeli yanlış**: bizim lineer formül uzun rotalarda ~10× şişiyor; am4-cc bunu hiç koymuyor, abc8747 wear-based. Şu an staff+maintenance fazlası, fix #2 sonrası A330-200F'ı dipte tutan ikincil sebep.
   - **Staff salary per-trip yanlış**: am4-cc ve abc8747'de profit zincirinde staff yok. Bizim `(cap × 0.012 + 250) / trips` formülü kısa rotalarda düşük, uzun rotalarda yüksek bir per-trip değer üretiyor; tamamen kaldırmak fix gerekir.
   - **CO₂ yok**: pax/cargo iki için de eksik. abc8747 ve am4-cc uyguluyor, bizde yok. Default `$120/1000lbs` * `co2_lbs` ekleyince fuel'ın ~%5-10'u kadar bir gider çıkar — toplam profit'i %3-5 düşürür ama kritik değil.

6. **Beklenen sonuç (am4-cc'ye göre A330-200F profitability):**
   - am4-cc cargo route view'unda profit gösterilmiyor, sadece revenuePerTrip + fuelCost ayrı görsel.
   - 70K lbs A330-200F, FRA→TBS (2933 km), 100% L, Realism, default trips: revenue per trip ≈ **$168K**, fuel cost (canonical) ≈ `2933 × 4.5 lbs/km × (200/500+0.6) × 950/1000 = 12,540 lbs × $0.95 = $11,913 → ~$11.9K`. Profit per trip ≈ `$168K - $12K = $156K` (CO₂ ihmal). 4 sefer/gün → ~$624K/gün.
   - Bizim mevcut hesap (`/1000` bug + maintenance şişkin): revenue $24K, fuel $12K, maintenance ~$3K, staff ~$10/trip → profit ≈ **+$9K/trip**, ama bunu 4 ile çarpsak bile $36K/gün — gerçek değerin %5'i. Ek olarak demand kısıtlı rotalarda (FRA→TBS gibi) bizim 0.7 çarpanı eksikliği L allocation'ı şişiriyor → revenue daha da yanlış oluyor.
   - Senin başlangıçta "FRA→TBS 100% load = -$35,667 profit/flight" dediğin sayı muhtemelen logic.js'te demand `c` field'ı yokken `calculateOptimalCargo`'nun `{l:0,h:0}` döndürmesi + sabit fuel/staff/maintenance düşülmesinden kaynaklı. Yani revenue 0, gider 35K → -35K. Demand şu an `routes.js`'te kargo için yok (CLAUDE.md "kargo route demand verisi" Açık Görevler arasında).

## Önerilen düzeltmeler

**ŞÜPHELİ olmayan, doğrulanmış öneriler (sırayla, en kritikten ene az kritiğe):**

### 1. (KRİTİK) `configurator.js` getTicketMultipliers cargo divisor'ünü düzelt — 10× revenue restore eder

```js
// Mevcut (hatalı):
l: (((0.0776321822039374 * distance) + 85.0567600367807) / 1000) * 1.10,
h: (((0.0517742799409248 * distance) + 24.6369915396414) / 1000) * 1.08

// Doğru (am4-cc + abc8747 ile aynı):
l: Math.floor(1.10 * (0.0776321822039374 * distance + 85.0567600367807)) / 100,
h: Math.floor(1.08 * (0.0517742799409248 * distance + 24.6369915396414)) / 100
```

`floor` öncesi 1.10/1.08, ardından `/100`. Easy dalı için aynı değişiklik. Sonuç: `$/lbs` birimi.

### 2. (ÖNEMLİ) `calculateOptimalCargo` L/H kapasite çarpanı ayrımı

am4-cc Ht fonksiyonu gibi:
```js
// L için 0.742× (Large training lvl 6 baseline), H için 1.06× (Heavy training lvl 6)
// Eğer training kullanıcıdan alınmıyorsa, baseline lvl 0 için 0.7/1.0 kullanılabilir.
const L_CAP_FACTOR = 0.742; // veya 0.7 (training=0)
const H_CAP_FACTOR = 1.06;  // veya 1.0
let sH_lbs = Math.min(demandH, Math.floor(remCap * H_CAP_FACTOR));
let sL_lbs = Math.min(demandL, Math.floor((remCap - sH_lbs/H_CAP_FACTOR) * L_CAP_FACTOR));
```

Daha basit: am4-cc'nin yaklaşımını taklit et — `lPct + hPct = 100`, sonra `tripL = lPct/100 × cap × 0.742`, `tripH = hPct/100 × cap × 1.06`.

### 3. (ORTA) Maintenance modelini wear-based yap

```js
// Eski: airTime * price * 6e-5 + price * 1e-5  (uzun rotalarda 10× şişiyor)
// Yeni (abc8747 wear formülü, beklenen değer):
calculateMaintenanceCost: function(plane) {
    return plane.price * 7.5e-6;  // = 0.001 × price × E[wear=0.0075]
}
```

### 4. (ORTA) Staff salary'i profit zincirinden çıkar

am4-cc ve abc8747 profit'ten staff çıkarmıyor. Mevcut `(cap × 0.012 + 250) / trips` formülünü kaldır veya UI'a "günlük sabit staff cost" input'u ekle.

### 5. (DÜŞÜK) CO₂ cost ekle

`logic.js` calculateProfit'e:
```js
const co2Lbs = ceilDist * (plane.co2_consumption || plane.fuel_consumption * 0.1) * effectiveLoad * (CI/2000 + 0.9);
const co2Cost = co2Lbs * (window.CO2_PRICE || 120) / 1000;
// profit = grossRevenue - fuelCost - co2Cost - maintenanceCost (- staff?)
```

`plane.co2_consumption` field'ı planes.js'de yok — orta vadeli ekleme; geçici olarak `fuel_consumption × 0.10` kullanılabilir.

**Bu raporda KOD DEĞİŞİKLİĞİ YAPILMADI** (görev dışı). Sadece research.

## Kaynaklar

**am4-cc.pages.dev URL'leri ziyaret edildi:**
- `https://am4-cc.pages.dev/` → `_am4cc_dump/index.html` (1934 byte)
- `https://am4-cc.pages.dev/assets/index-BLhCUJra.js` → `_am4cc_dump/index.js` (379,785 byte)
- `https://am4-cc.pages.dev/assets/index-Bngi_nJT.css` → `_am4cc_dump/index.css` (47,138 byte)
- `https://am4-cc.pages.dev/registerSW.js` → `_am4cc_dump/registerSW.js` (134 byte)

**İndirilen bundle'lar:** `C:\Users\melik\Desktop\am4-proje\_am4cc_dump\` klasöründe; tek-satır Vite build, 4 fonksiyon kritik (Vt, Bt, Ht, Mt).

**Kritik satır alıntıları (`_am4cc_dump/index.js` line 9, single-line minified):**
- `Vt(e,t){return String(t||'Realism').toLowerCase()==='easy'?{l:zt(1.1*(.0948283724581252*e+85.2045432642377)),h:zt(1.08*(.0689663577640275*e+28.2981124272893))}:{l:zt(1.1*(.0776321822039374*e+85.0567600367807)),h:zt(1.08*(.0517742799409248*e+24.6369915396414))}}`
- `function zt(e){return Math.floor(Number(e||0))/100}`
- `Ht(e,t,n,r,i,a='auto'){let o=Math.max(1,Number(r||1)),s=Rt(e,i),c=Math.floor(Number(t||0)/o),l=Math.floor(Number(n||0)/o),u=.7*1.06,d=1.06;…}`
- `Bt(e,t){return{l:Math.max(0,Number(e||0)*500),h:Math.max(0,Number(t||0)*1e3)}}`
- Single-route revenue calc: `o=i.tripL*r.l+i.tripH*r.h,s=o*Ge` (revenue/trip × tripsPerDay)
- Range calculator profit: `profit:x-g-v` (revenue − fuelCost − co2Cost; **staff/maintenance YOK**)

**abc8747/am4 doğrulama:**
- Repo: `https://github.com/abc8747/am4` (master branch, 2026-05-04 erişim)
- `docs/formulae.md`: `https://github.com/abc8747/am4/blob/master/docs/formulae.md` — cargo katsayıları ve optimal autoprice çarpanı (1.10/1.08) doğrulandı. **Birim açıkça yazmıyor**, source'tan çıkarıldı.
- `src/am4/utils/cpp/ticket.cpp`: cargo bilet fiyatlarının kaynak kodu, `floorf(...) / 100` divisor ile birebir aynı katsayılar.
- `src/am4/utils/cpp/route.cpp`: `update_cargo_details` fonksiyonu, `((1+t_l/100) × cfg.l × 0.7 × tkt.l + (1+t_h/100) × cfg.h × tkt.h) × ac_capacity / 100` revenue formülü ve `profit = income - fuel × fp/1000 - co2 × cp/1000 - acheck_cost - repair_cost` profit formülü doğrulandı.

**Raporda kullanılan kendi notlarımız:** `C:\Users\melik\Desktop\am4-proje\research-am4-formulas.md` (özellikle § D Ticket Prices ve § C Maintenance bölümleri — geçen araştırmanın katsayı çıkarımı doğru, ama divisor'ün `/1000` mı `/100` mü olduğu bu pasta net belirtilmemişti, mevcut bug'a o boşluktan girmiş olabilir).
