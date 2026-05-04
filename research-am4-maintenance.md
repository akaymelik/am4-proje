# AM4 Maintenance Veri Araştırması

*Tarih: 2026-05-04. Araştırılan kaynaklar: 4 (abc8747/am4 docs + cpp source + aircrafts.csv, am4-cc /data/aircrafts.json bundle).*
*Önceki notlar: `research-am4-formulas.md` § C, `research-am4cc-cargo-formula.md` (cargo report’ta acheck_cost+repair_cost ipucu).*

## ÖZET

**Per-aircraft maintenance dataset GERÇEKTEN VAR ve indirilebilir.** abc8747/am4 reposunda `docs/assets/aircrafts.csv` (501 satır, MIT lisans) ve am4-cc.pages.dev’in `/data/aircrafts.json` endpoint’inde (499 entry) **iki bağımsız kaynak BİREBİR aynı `check_cost` (A-check Cost $) ve `maint` (A-check Hours) değerlerini taşıyor — 337/337 unique aircraft’ta tam eşleşme**. Bu veri 338 unique uçağı kapsıyor; bizim `planes.js`’deki 329 uçağın **317’si (96.4%) isim bazında doğrudan eşleşiyor**, kalan 12 küçük/eski uçak shortname tabloyla manuel eşlenebilir.

Kanonik formül `abc8747/am4/src/am4/utils/cpp/route.cpp:321-325` satırlarında C++ kodunda doğrulanmış: A-check **fraction-of-check-consumed** mantığıyla `acheck_cost = check_cost × mode_mult × ceil(flight_time) / maint`, repair `cost × 0.0075 × (1 - 0.02 × t_r) / 1000` (beklenen değer). Bu formülü mevcut sabit `airTime × price × 6e-5 + price × 1e-5` yaklaşımımızla karşılaştırınca: A330-200F için 2933 km Realism’da bizim formül **\$12,665/sefer** veriyor, kanonik **\$109,549/sefer** — yani **mevcut kodumuz maintenance’ı ~%88 az hesaplıyor**. (Önceki `research-am4-formulas.md` § C raporu “10× şişiyor” demişti — bu yanlıştı: o rapor sadece repair_cost komponentini hesaplamış, dominant olan A-check kalemini görmemişti. A-check’i dahil edince bizim formül **az hesaplıyor**, fazla değil.)

**Sonuç (kararsız değil):** **Approach 2 (per-aircraft data) tek kanıta dayalı ve teknik olarak uygulanabilir.** Approach 1 (tek formül) kanonik kaynakta YOK — abc8747’nin tek formülü zaten per-aircraft `check_cost` ve `maint` değerlerine ihtiyaç duyuyor. Yani “tek formül” bile per-aircraft veri olmadan çalışmıyor. Kullanıcıya tavsiye: **Approach 2’yi seç, çünkü Approach 1 fiilen mümkün değil — her iki yaklaşım da aynı veriye ihtiyaç duyuyor.**

## Kaynak taraması

| Kaynak | Veri var mı? | Format | URL | Erişim tarihi |
|--------|--------------|--------|-----|---------------|
| abc8747/am4 `docs/formulae.md` | ✅ Wear, Repair Cost, Repair Time, Check Time formülleri (tüm $R^2=1$) | Markdown | https://github.com/abc8747/am4/blob/master/docs/formulae.md | 2026-05-04 |
| abc8747/am4 `src/am4/utils/cpp/route.cpp` | ✅ Profit zincirinde acheck_cost + repair_cost canlı uygulama | C++ kaynak kodu | https://github.com/abc8747/am4/blob/master/src/am4/utils/cpp/route.cpp | 2026-05-04 |
| abc8747/am4 `docs/assets/aircrafts.csv` | ✅ 501 satır, 338 unique uçak, `check_cost` + `maint` kolonları + tam metadata | CSV | https://raw.githubusercontent.com/abc8747/am4/master/docs/assets/aircrafts.csv | 2026-05-04 |
| abc8747/am4 `scripts/check_cost/check_cost.csv` | ✅ 24 uçaktan oyun-içi check_cost gözlem verisi (R^2=1 doğrulaması için) | CSV | https://raw.githubusercontent.com/abc8747/am4/master/scripts/check_cost/check_cost.csv | 2026-05-04 |
| abc8747/am4 `src/am4/utils/data/aircrafts.parquet` | ✅ Aynı veri parquet binary olarak (decode edilmedi, schema csv ile aynı) | Parquet | https://github.com/abc8747/am4/blob/master/src/am4/utils/data/aircrafts.parquet | 2026-05-04 |
| am4-cc.pages.dev `/data/aircrafts.json` | ✅ 499 entry, 338 unique uçak, abc CSV ile **byte-byte identical** check_cost + maint | JSON | https://am4-cc.pages.dev/data/aircrafts.json (`_am4cc_dump/aircrafts.json`, 234KB) | 2026-05-04 |
| am4-cc.pages.dev bundle `index.js` | ⚠️ Sadece UI-display (`A-check Hours`, `A-check Cost` label’ları); profit zincirinde maintenance YOK | Minified JS | `_am4cc_dump/index.js` line 9 | 2026-05-04 |
| Fandom wiki — `airline-manager.fandom.com/wiki/Maintenance` | ❓ Cloudflare challenge nedeniyle erişilemedi | HTML | https://airline-manager.fandom.com/wiki/Maintenance | 2026-05-04 (engellendi) |

## A-check

- **Interval (uçak başına farklı):** `maint` field, **A-check periyodu saat olarak** (`docs/formulae.md` ve cpp source’ta “A-check Hours”). Range: 200h (küçük turbo-prop’lar) → 3500h (büyük cargo). Örnek değerler:
  - B747-400: 330h
  - A330-200F: 400h
  - A380-800: 720h
  - Concorde: ~3500h (en yüksek)
  - ATR 42-50: 1000h
- **Cost (uçak başına farklı):** `check_cost` field, **bir tam A-check’in tutarı** ($). Range: \$950 → \$43.8M. Realism modunda × 2.0, Easy modunda × 1.0 (`docs/formulae.md`: “Note that the check cost for easy players are half of realism”).
- **Per-trip dağıtım formülü** (`route.cpp:321-322`):
  ```cpp
  acr.acheck_cost = static_cast<float>(ac.check_cost * (user.game_mode == User::GameMode::EASY ? 1.0 : 2.0)) *
                    ceil(acr.flight_time * game_mode_speed_multiplier) / static_cast<float>(ac.maint);
  ```
  Yani sefer başına: `check_cost × mode_mult × ceil(flight_time_hours) / maint_hours`. Mantık: sefer `flight_time` saat sürüyor, bu `flight_time/maint` oranında bir A-check tüketiyor; orana göre tam A-check ücretinin payı bu sefer için faturalandırılıyor.
- **Kaynak güven:** **Tier 1**. Üç bağımsız kaynak (abc8747 cpp source + abc8747 docs + am4-cc bundle UI) tutarlı; abc8747 `scripts/check_cost/check_cost.csv` 24 uçakta canlı oyun verisiyle $R^2 = 1$ doğrulaması.
- **Quote** (`docs/formulae.md:755-773`):
  > ### Check Time
  > Found: 29 June 2024 (Cathay Express, Point Connect)
  > Confidence: 95%.
  > Note that the check cost for easy players are half of realism.
  > #### Easy: $T = 0.01 \cdot C+1860$
  > #### Realism: $T = 0.01 \cdot C+3700$
  > where: $T$: downtime (seconds), $C$: [check cost][utils.aircraft.Aircraft.check_cost]

  *(Not: `formulae.md` doğrudan A-check `cost` formülü vermiyor — sadece check **time** veriyor. Cost mekaniği `route.cpp` C++ source’unda canlı. CSV/JSON dataset’i her iki kaynakta da aynı sayıları taşıdığı için “fixed per-aircraft constant” oldukları açık.)*

## D-check

- **Veri bulunamadı.** Hem `docs/formulae.md`, hem `aircraft.cpp`, hem `route.cpp`, hem `aircrafts.json/csv` taranınca **D-check için ayrı bir field veya formül yok**. AM4 oyun mekaniği bağlamında abc8747 sadece A-check (büyük ve tek tip periyodik bakım) modelliyor.
- **Olasılık (ŞÜPHELİ):** AM4 oyun içinde D-check ayrı bir mekanik olabilir ama community formülü yok. Bizim kodda da D-check ayrımına gerek olmayabilir — A-check bütün periyodik bakımı kapsayan tek kategori olarak modellenebilir.
- **Kaynak güven:** **Negatif kanıt Tier 1** (kanonik kaynakta ayrı kategori yok).

## Wear mekanizması

- **Wear nasıl artar?** Sefer başına (per-departure), uniform random distribution. **Uçuş saatine veya mesafeye değil, sayım sayısına bağlı.**
  - Formül: `wear ~ U(0, 0.015 × (1 - 0.02 × t_r))`
  - Beklenen değer: `E[wear] = 0.0075 × (1 - 0.02 × t_r)` (training=0 için %0.75/sefer)
  - Quote (`formulae.md:707-722`):
    > ### Wear
    > Found: 2021 (Cathay Express)
    > Confidence: 100% ($R^2 = 1$). Applicable for both easy and realism.
    > $$\text{wear} \sim \mathcal{U}(0, 0.015 \cdot (1 - 0.02 t_r))$$
    > Equivalently, the expected wear is 0.75% per departure, which decreases by 2% per training point.

- **Wear cost’u ETKİLER Mİ?**
  - **Olasılık A (sadece performans):** Hiç kanıt yok. cpp source’ta wear sadece `repair_cost` ve `repair_time` formüllerinde geçiyor; cruise speed veya fuel consumption ile ilişkisi yok. Reddit/forum’larda “high wear = aircraft slower/less efficient” iddiaları var ama abc8747 tarafından kanıtlanmamış.
  - **Olasılık B (cost çarpanı):** **EVET — sadece repair_cost kalemi için.** `route.cpp:323-325`:
    ```cpp
    acr.repair_cost =
        ac.cost / 1000.0 * 0.0075 *
        (1 - 2 * user.repair_training / 100.0);  // each flight adds random [0, 1.5]% wear, each tp decreases wear by 2%
    ```
    Bu kod beklenen değer (E[wear]=0.0075) substituted edilmiş hâli — anlamı: her sefer **rastgele bir wear miktarı (0-1.5%)** ekleniyor ve repair’de o wear silinirken `repair_cost = 0.001 × price × (1 - 0.02 × t_r) × wear` faturalanıyor. Per-trip beklenen değer formülü yukarıda bizim kullanacağımız.
    Quote (`formulae.md:724-738`):
    > ### Repair Cost
    > Found: 2020 (Cathay Express)
    > Confidence: 100% ($R^2 = 1$). Untested on realism.
    > $$C_r = 0.001C(1 - 0.02 t_r) \cdot \text{wear}$$

- **Hangi olasılık daha güvenilir kaynaktan geliyor?** **Olasılık B kazanır, ama dar bir tanımla:** wear, **sadece repair_cost’u** çarpıyor — A-check cost’u **etkilemiyor** (A-check fixed per-aircraft constant, wear-independent). “Wear cost’u etkiler mi?” sorusunun doğru cevabı: **“Repair cost wear ile lineer artar; A-check cost wear’den bağımsız.”** Bu nüans önemli çünkü pratik per-trip bakım maliyeti **dominant olarak A-check** (long route 100K+ \$/trip vs repair 469 \$/trip), wear etkisi ikincil.

- **Performans etkisi (Olasılık A) için kanıt:** Kanonik kaynakta YOK. Eğer wear cruise speed/fuel’i etkiliyorsa abc8747 modellemiyor; community Reddit thread’leri spekülatif. Bizim kodumuzda da bu modellenmemeli — sadece repair_cost’a wear çarpanı uygulanmalı (uygulanıyorsa zaten beklenen değer ile 0.0075 sabiti).

## Mevcut formülümüzün kaynağı

- **Formül:** `airTime × (price × 0.00006) + (price × 0.00001)` (`logic.js:20-22`)
- **Git blame:** `git log -S "0.00006" -- logic.js` tek commit gösteriyor — `65243102` (1 May 2026, “Yapi duzeltildi: yinelenen am4-proje/ alt klasoru kaldirildi”). Yani formül daha **önceki proje yapısından** taşındı — kaynak commit’i ya silinmiş am4-proje/ alt klasöründe, ya da o tarihten önce dış bir referansta tanımlanmış. Önceki “Update logic.js” commitleri (a342ba7, 3b7fd86, …) muhtemelen bu sabitlerin orijinal yazımını içeriyor ama tek-commit-içi diff göstermiyor (silinen klasör → yeni dizin geçişi).
- **Hangi varsayımları içeriyor?**
  - “Bakım maliyeti, uçuş saati × ucağın fiyatına orantılıdır” — kabaca makul ama **wear/A-check ayrımını yapmıyor**.
  - `6e-5` ve `1e-5` sabitleri **kalibre edilmemiş** — abc8747 docs’ta yok, am4-cc bundle’ında yok, hiçbir community kaynağında geçmiyor.
- **Bu formül abc8747 docs’ta var mı?** **HAYIR.** `formulae.md` taraması, cpp source taraması ve aircrafts.csv schema kontrolü hiçbiri `airTime × price × constant` şeklinde bir bakım modeli içermiyor. Kanonik model zorunlu olarak `check_cost` ve `maint` field’larını gerektiriyor.
- **Sonuç:** Bizim formülümüz ya eski bir reverse-engineering tahmini, ya da generic bir “bakım uçak yaşıyla artar” heuristiği. Kanonik kaynakla uyumsuz; düzeltilmeli.

## Karşılaştırma — A330-200F (cargo, capacity 270K, cruise 914.55 km/h, fiyat \$62.57M, fuel 26.26)

`am4-cc.pages.dev` ve `abc8747/am4/docs/assets/aircrafts.csv` her ikisi de aynı değerleri veriyor: `check_cost = $5,454,000`, `maint = 400h`. Per-trip canonical maintenance = `5454000 × mode_mult × ceil(flight_time) / 400 + 62565894 × 0.0075 / 1000` (training=0, repair component ~$469).

| Mesafe | Flight time | Mevcut formülümüzle | Kanonik (Realism) | Kanonik (Easy) | Sapma (mevcut/kanonik Realism) |
|--------|-------------|---------------------|-------------------|----------------|-------------------------------|
| 500 km | 0.547 h | \$2,678 | \$27,739 | \$13,935 | **0.10×** (bizimki %90 az) |
| 2933 km (FRA→TBS) | 3.21 h | \$12,665 | \$109,549 | \$55,009 | **0.12×** (bizimki %88 az) |
| 6000 km | 6.56 h | \$25,254 | \$191,359 | \$95,949 | **0.13×** |
| 10000 km | 10.93 h | \$41,673 | \$300,439 | \$150,529 | **0.14×** |

**Kritik tespit:** `route.cpp` formülünde `ceil(flight_time)` kullanılması, kısa rotalarda ciddi yuvarlama etkisi yaratıyor — 0.547h flight için A-check 1 saat bazında faturalandırılıyor. Bu, kısa rotalarda göreceli maintenance maliyetini şişirir (bir per-saat lineer modelle vs). Ek olarak Realism modunda Easy’nin 2 katı (mod multiplier).

(Önceki `research-am4-formulas.md` § C raporu: “mevcut formülümüz uzun rotalarda ~10× şişiriyor” iddiası **yanlış idi** — sadece repair_cost komponentini değerlendirmiş, A-check kalemini ihmal etmişti. Doğru bilanço: **mevcut formül her mesafede ~7-10× ALAÇA** — yani biz maintenance’ı kayda değer ölçüde **az hesaplıyoruz**, çok değil.)

## Önerilen yaklaşım

### Yaklaşım 1 (tek formül düzeltme) — ❌ Mümkün değil

“Tek formül” diye bir kanonik formül **YOK**. abc8747’nin formülü zaten per-aircraft `check_cost` ve `maint` değerlerine bağlı:

```js
acheck_cost = plane.check_cost * modeMultiplier * Math.ceil(airTime) / plane.maint;
repair_cost = plane.price * 0.0075 / 1000;  // E[wear], training=0
maintenanceCostPerTrip = acheck_cost + repair_cost;
```

Eğer `plane.check_cost` ve `plane.maint` field’ları olmadan tek formül üretmek istersek **bütün uçaklar için sabit varsayım** yapmak zorunda kalırız (örn. ortalama check_cost/maint oranı), bu da Approach 2’nin kalitesinde olmaz — kompleks/küçük uçaklarda hatalar büyür (Concorde maint=3500h vs ATR maint=1000h). Tipik çözüm:

- **Tek formül YAKLAŞIK olarak `airTime × C × price`** denenebilir — abc8747 dataset’inden regresyon ile en uygun `C` bulunup mode_mult ile çarpılır. Ama bu hala **Approach 2 için datayı indirip regresyon yapmayı gerektiriyor**, kapsama olarak Approach 2’nin alt kümesi.

### Yaklaşım 2 (per-aircraft veri) — ✅ Tek doğru çözüm

**Veri kaynağı:** `https://raw.githubusercontent.com/abc8747/am4/master/docs/assets/aircrafts.csv` (MIT lisans, atıf ver).

**Format ve coverage:**
- 501 satır, 338 unique uçak (her uçak 1-4 motor variant’ı ile).
- Bizim `planes.js`’deki 329 uçaktan **317’si (96.4%) doğrudan name eşleşmesi**. Kalan 12 (1900D, 172, 208B vs.) küçük/eski uçaklar — manuel shortname mapping ile %100’e çıkar.
- Tek motor variant alınabilir (priority=0) veya engine-aware mapping (`eid`); biz priority=0 kullanırız (basit).

**Eklenmesi gereken field’lar (uçak başına 2 sayı):**
```js
"A330-200F": { ..., check_cost: 5454000, maint: 400 },
"B747-400":  { ..., check_cost: 7140605, maint: 330 },
// ... 329 uçak için
```

**Zorluk:** ~10 dakikalık script — abc8747 CSV’yi okuyup planes.js’ye merge eden tek seferlik bir migration. Manual fix gerekenler ~12 uçak.

**Ayrıca eklenmesi mümkün (opsiyonel, daha sonra):** `co2`, `fuel` (zaten var ama çapraz doğrula), `pilots`, `crew`, `engineers`, `technicians` — staff salary modeli için ileride kullanılabilir.

### Hangi yaklaşım daha sağlam?

**Yaklaşım 2.** Sebepler:

1. **Yaklaşım 1 fiilen Yaklaşım 2’ye bağımlı** — tek formül üretmek için bile abc8747 verisinden regresyon yapmak gerekiyor.
2. **Veri zaten var ve indirilebilir** (501 satır CSV, MIT lisans). Lisans engeli yok.
3. **Coverage 96.4%, kolayca %100’e çıkar** — manuel mapping minimum.
4. **Format değişikliği minimal** — `planes.js`’ye uçak başına 2 yeni field. ~10 satır kod logic.js’de.
5. **Kullanıcı ileride başka kalemleri de (staff, CO2) aynı dataset’ten çekebilir** — bir kez mapping yapılırsa platform ileri fix’ler için hazır.

Riskler / dezavantajlar:

- **Realism mode multiplier (×2):** logic.js’de `gameMode === 'realism'` koşulu eklemek gerek. Trivial.
- **Repair training input:** kullanıcı default `t_r=0` varsayımı doğru, ileride UI’a eklenebilir. Şu an deactivate edilebilir (sadece beklenen değeri al).
- **`maint` saatlerinin oyun-içi gerçek değer ile uyumu:** abc8747 `scripts/check_cost/check_cost.csv` 24 uçakta `R^2 = 1` doğrulamış — yüksek güven.

**Tarafsız değerlendirme:** Approach 2 net olarak daha sağlam. “Veri bulunamadı, Approach 1 tek seçenek” şeklinde bir negatif sonuç YOK; tam tersine, veri çok temiz halde mevcut.

## Açık sorular

- **`maint` saati “sefer başına consumption” mı yoksa “her A-check intervalında reset olan running counter” mı?** cpp formülünden (`ceil(flight_time) / maint`) anlaşılan: per-trip dağıtım yapılıyor, gerçek oyun mekaniği bir uçağın kullandıkça birikip A-check’te sıfırlanan saat sayacı. Bizim profit hesabında “amortize edilmiş per-trip maliyet” olarak modellemek doğru — zaten formülün yaptığı bu.
- **`ceil(flight_time)` mantığı:** kısa rotalarda yuvarlama dezavantajı yaratıyor — bu intentional mı (1 saat bazında faturalanıyor) yoksa bir `floor` mu olmalı? Cpp source `ceil` kullanıyor; abc8747 docs’ta açıkça yazmıyor. Bence kanonik kaynağa sadık kalıp `ceil` kullan.
- **Easy/Realism speed_multiplier (`game_mode_speed_multiplier`):** cpp formülünde `flight_time × game_mode_speed_multiplier` çarpımı var. Bizim `calculateFlightTime` Easy modunda speed × 4 kullanıyor → Easy modunda flight_time zaten 1/4 küçük. Yani cpp’nin `speed_multiplier` Easy=4 değilse (cpp Easy mode için flight_time’ı tekrar çarpıyorsa) burada double-counting riski var. **Bunu cpp source’ta detaylı izlemek gerek** (game.cpp veya user.cpp’ye bakılmalı). ŞÜPHELİ.
- **D-check oyun-içinde gerçekten ayrı bir kategori mi yoksa abc8747 sadece A-check’i modelliyor mu?** abc8747 D-check’i hiç anmıyor, dataset’te kolon yok. Eğer oyunda D-check varsa kanonik kaynak modellemiyor — bizim modelimiz de modellemese de doğruluk zarar görmez (community standardı bu).
- **Wear performans etkisi (cruise speed / fuel) gerçekten yok mu?** Kanonik kaynakta yok ama oyun-içi pratiğinde yıpranmış uçak ~%2-5 yavaş gidebilir (Reddit anekdotal). Tier 4 kanıt; Tier 1’de modellenmemiş, biz de modellememeliyiz.

## Kaynaklar

- **Tier 1 (canonical):**
  - `https://github.com/abc8747/am4/blob/master/docs/formulae.md` (837 satır, accessed 2026-05-04). Wear/Repair Cost/Repair Time/Check Time bölümleri lines 707-778.
  - `https://github.com/abc8747/am4/blob/master/src/am4/utils/cpp/route.cpp` lines 321-328: `acheck_cost` + `repair_cost` profit zincirinde live (accessed 2026-05-04, indirildi `_am4cc_dump/abc8747/route.cpp`).
  - `https://github.com/abc8747/am4/blob/master/src/am4/utils/cpp/aircraft.cpp` (575 satır, indirildi `_am4cc_dump/abc8747/aircraft.cpp`).
  - `https://raw.githubusercontent.com/abc8747/am4/master/docs/assets/aircrafts.csv` (501 satır, MIT, indirildi `_am4cc_dump/abc8747/aircrafts.csv`).
  - `https://raw.githubusercontent.com/abc8747/am4/master/scripts/check_cost/check_cost.csv` (24 uçak oyun-içi gözlem, indirildi `_am4cc_dump/abc8747/check_cost_data.csv`).

- **Tier 1/2 (cross-validation):**
  - `https://am4-cc.pages.dev/data/aircrafts.json` (499 entry, indirildi `_am4cc_dump/aircrafts.json`, 234KB). Schema: `id, shortname, manufacturer, name, type, priority, eid, ename, speed, fuel, co2, cost, capacity, rwy, check_cost, range, ceil, maint, pilots, crew, engineers, technicians, img, wingspan, length`.
  - `_am4cc_dump/index.js` line 9 (am4-cc Vite bundle): `A-check Hours = y.maint`, `A-check Cost = y.check_cost`, Realism modunda × 2 multiplier UI’da gösterilir; profit zincirinde **kullanılmıyor** (am4-cc cargo profit hesabında maintenance YOK — cargo report’ta zaten gösterildi).

- **Tier 3 (denenmiş, erişilemedi):**
  - `https://airline-manager.fandom.com/wiki/Maintenance` — Cloudflare bot challenge tarafından engellendi. JavaScript renderer olmadan içerik alınamadı; manuel kullanıcı tarayıcısı ile kontrol edilebilir ama Tier 1 kanıtla zaten yeter.

- **İlgili önceki notlar:**
  - `research-am4-formulas.md` § C — “maintenance 10× şişiyor” iddiası **bu raporla revize ediliyor** (sadece repair_cost değerlendirmiş, A-check’i unutmuş; doğru bilanço: 7-10× **az** hesaplıyoruz, çok değil).
  - `research-am4cc-cargo-formula.md` — am4-cc’nin profit zincirinde maintenance yok teyidi; cargo report’u abc8747 cpp source’ta acheck_cost+repair_cost ipucunu vermişti, bu rapor o ipucunu tam izledi.

- **Yasaklı:** am4tools.com (CLAUDE.md, kontrol edilmedi).

- **Yararlanılan veri-tipi ölçümü:**
  - 337/337 unique aircraft eşleşmesi (am4-cc JSON ↔ abc8747 CSV) — `python3` script `_am4cc_dump/` üzerinde çalıştırıldı, `check_cost` ve `maint` field’ları byte-byte aynı.
  - planes.js name-mapping: 317/329 = 96.4% direct, 12 uçak için manuel mapping (1900D, 1900, 1900C, B377 Strato, 172, 208B, L-1049G S/C, 340, 90 Scandia, 2000, B-377SG, Boeing 777-300ERSF).
