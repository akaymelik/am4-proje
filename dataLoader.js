/**
 * dataLoader.js — abc8747/am4 verisinden üretilmiş 3907 havalimanı + 7.6M rota'ya erişim
 *
 * Mimari (am4-cc.pages.dev tarzı, kendi /data/ klasörümüzden serve edilir):
 *   /data/airports.json           ~960 KB   3907 havalimanı, JSON
 *   /data/distances.bin           ~15.3 MB  uint16 LE × N(N-1)/2 (üst-üçgen mesafe tablosu)
 *   /data/demands_0..5.bin        ~5.1 MB×6 uint32 LE bit-pack: (yd<<20)|(jd<<10)|fd
 *   /data/demands_overflow.bin    ~22 B     header + (uint32 idx, uint16 yd_full) × N
 *
 * İlk yükleme ~47 MB. Sonraki ziyaretlerde IndexedDB cache → 0 byte transfer.
 *
 * Endian uyarısı: TypedArray native endianness kullanır. x86/ARM/WASM hepsi LE,
 * 2026'da BE platform yok denecek kadar az. DataView ile bit-pack zaten her durumda LE.
 */

(function () {
    'use strict';

    const N = 3907;
    const CHUNK_SIZE = 1_271_728;
    const NUM_CHUNKS = 6;

    const DB_NAME = 'menoa_data_cache';
    const DB_VERSION = 1;
    const STORE = 'files';
    const KEYS = ['airports', 'distances', 'demands_0', 'demands_1', 'demands_2', 'demands_3', 'demands_4', 'demands_5', 'overflow'];

    // ---------- IndexedDB helpers ----------
    function openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => req.result.createObjectStore(STORE);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    function dbGet(db, key) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    function dbPutAll(db, entries) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            for (const [k, v] of entries) tx.objectStore(STORE).put(v, k);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    // ---------- DataLoader class ----------
    class DataLoader {
        constructor() {
            this.airports = null;       // Array<airport>
            this.iataToId = new Map();  // iata → 0-based position
            this.distances = null;      // Uint16Array
            this.demands = [];          // [Uint32Array × 6]
            this.overflow = new Map();  // routeIdx → uint16 yd_full
            this.N = N;
            this.CHUNK_SIZE = CHUNK_SIZE;
            this.ready = false;
            this.loading = null;        // Promise (yarıda çağırılırsa aynı promise)
            this.error = null;
        }

        // ---------- Bit-pack helpers ----------
        triIndex(i, j) {
            if (i > j) { const t = i; i = j; j = t; }
            return i * (2 * this.N - i - 1) / 2 + (j - i - 1);
        }

        unpack(packed) {
            // >>> unsigned shift — 32-bit pack için kritik (signed >> top bit'leri yanlış yorumlar)
            return {
                y: (packed >>> 20) & 0xFFF,
                j: (packed >>> 10) & 0x3FF,
                f: packed & 0x3FF
            };
        }

        // ---------- Public API ----------
        getAirport(iata) {
            if (!this.ready) return null;
            const id = this.iataToId.get(iata);
            return id === undefined ? null : this.airports[id];
        }

        getDistance(iata1, iata2) {
            if (!this.ready) return null;
            const i = this.iataToId.get(iata1);
            const j = this.iataToId.get(iata2);
            if (i === undefined || j === undefined || i === j) return null;
            return this.distances[this.triIndex(i, j)];
        }

        getDemand(iata1, iata2) {
            if (!this.ready) return null;
            const i = this.iataToId.get(iata1);
            const j = this.iataToId.get(iata2);
            if (i === undefined || j === undefined || i === j) return null;
            const idx = this.triIndex(i, j);
            const chunkId = Math.floor(idx / this.CHUNK_SIZE);
            const localIdx = idx - chunkId * this.CHUNK_SIZE;

            let result;
            // Kuyruk satırı (chunk'lara sığmayan 3 tane) — yalnızca overflow'da
            if (chunkId >= NUM_CHUNKS) {
                if (!this.overflow.has(idx)) return null;
                result = { y: this.overflow.get(idx), j: 0, f: 0 };
            } else {
                const packed = this.demands[chunkId][localIdx];
                result = this.unpack(packed);
                if (this.overflow.has(idx)) result.y = this.overflow.get(idx);
            }

            // Kargo demand (am4-cc demand.cpp formülü: PaxDemand → CargoDemand)
            //   l (light)  = round(y / 2) × 1000  lbs
            //   h (heavy)  = j × 1000             lbs
            result.l = Math.round(result.y / 2) * 1000;
            result.h = result.j * 1000;
            return result;
        }

        searchAirports(query, limit = 10) {
            if (!this.ready || !query) return [];
            const q = query.toLowerCase();
            const matches = [];
            for (const ap of this.airports) {
                if (matches.length >= limit) break;
                if (ap.iata.toLowerCase().includes(q) ||
                    ap.name.toLowerCase().includes(q) ||
                    (ap.fullname && ap.fullname.toLowerCase().includes(q)) ||
                    (ap.country && ap.country.toLowerCase().includes(q))) {
                    matches.push(ap);
                }
            }
            return matches;
        }

        isReady() { return this.ready; }

        // ---------- Loading pipeline ----------
        async load() {
            if (this.ready) return;
            if (this.loading) return this.loading;
            this.loading = this._loadInternal().catch(err => {
                this.error = err;
                console.error('[dataLoader] yükleme başarısız:', err);
                throw err;
            });
            return this.loading;
        }

        async _loadInternal() {
            const t0 = performance.now();

            // 1. IndexedDB cache kontrol
            try {
                const cached = await this._readCache();
                if (cached) {
                    this._parseAll(cached);
                    this.ready = true;
                    console.log(`[dataLoader] cache'ten yüklendi (${(performance.now() - t0).toFixed(0)} ms): ${this.airports.length} havalimanı`);
                    return;
                }
            } catch (e) {
                console.warn('[dataLoader] IndexedDB cache okunamadı, fetch yapılacak:', e);
            }

            // 2. Network'ten paralel fetch
            console.log('[dataLoader] /data/ indiriliyor (~47 MB ilk yükleme)…');
            const baseUrl = '/data/';
            const fetchBuf = (path) => fetch(baseUrl + path).then(r => {
                if (!r.ok) throw new Error(`${path} fetch ${r.status}`);
                return r.arrayBuffer();
            });
            const [airportsJson, distBuf, d0, d1, d2, d3, d4, d5, overBuf] = await Promise.all([
                fetch(baseUrl + 'airports.json').then(r => {
                    if (!r.ok) throw new Error(`airports.json fetch ${r.status}`);
                    return r.json();
                }),
                fetchBuf('distances.bin'),
                fetchBuf('demands_0.bin'),
                fetchBuf('demands_1.bin'),
                fetchBuf('demands_2.bin'),
                fetchBuf('demands_3.bin'),
                fetchBuf('demands_4.bin'),
                fetchBuf('demands_5.bin'),
                fetchBuf('demands_overflow.bin')
            ]);

            const payload = {
                airports: airportsJson,
                distances: distBuf,
                demands_0: d0, demands_1: d1, demands_2: d2,
                demands_3: d3, demands_4: d4, demands_5: d5,
                overflow: overBuf
            };
            this._parseAll(payload);
            this.ready = true;
            console.log(`[dataLoader] fetch tamamlandı (${(performance.now() - t0).toFixed(0)} ms): ${this.airports.length} havalimanı`);

            // 3. IndexedDB'ye yaz (await değil, fire-and-forget)
            this._writeCache(payload).catch(e => console.warn('[dataLoader] cache yazılamadı:', e));
        }

        async _readCache() {
            if (!('indexedDB' in window)) return null;
            const db = await openDB();
            const values = await Promise.all(KEYS.map(k => dbGet(db, k)));
            if (values.some(v => v === undefined)) return null;
            return {
                airports: values[0],
                distances: values[1],
                demands_0: values[2], demands_1: values[3], demands_2: values[4],
                demands_3: values[5], demands_4: values[6], demands_5: values[7],
                overflow: values[8]
            };
        }

        async _writeCache(payload) {
            if (!('indexedDB' in window)) return;
            const db = await openDB();
            await dbPutAll(db, KEYS.map(k => [k, payload[k]]));
        }

        _parseAll(p) {
            // airports
            this.airports = p.airports;
            this.iataToId.clear();
            for (let i = 0; i < this.airports.length; i++) {
                this.iataToId.set(this.airports[i].iata, i);
            }

            // distances (uint16 LE — TypedArray native endianness, modern devices = LE)
            this.distances = new Uint16Array(p.distances);

            // demands (uint32 × 6 chunk)
            this.demands = [
                new Uint32Array(p.demands_0),
                new Uint32Array(p.demands_1),
                new Uint32Array(p.demands_2),
                new Uint32Array(p.demands_3),
                new Uint32Array(p.demands_4),
                new Uint32Array(p.demands_5)
            ];

            // overflow Map: header(uint32 count) + entries (uint32 idx + uint16 val) × N
            this.overflow.clear();
            if (p.overflow && p.overflow.byteLength >= 4) {
                const view = new DataView(p.overflow);
                const count = view.getUint32(0, true);
                for (let k = 0; k < count; k++) {
                    const base = 4 + k * 6;
                    if (base + 6 > view.byteLength) break;
                    const idx = view.getUint32(base, true);
                    const val = view.getUint16(base + 4, true);
                    this.overflow.set(idx, val);
                }
            }
        }
    }

    // Global singleton
    window.dataLoader = new DataLoader();

    // Auto-init: window load'da yükle, splash bekleme yok (background)
    window.addEventListener('load', () => {
        window.dataLoader.load().then(() => {
            // Smoke test
            const dl = window.dataLoader;
            console.log('[dataLoader] hazır:', dl.airports.length, 'havalimanı,', dl.distances.length.toLocaleString(), 'mesafe');
            const lhrJfk = dl.getDistance('LHR', 'JFK');
            const demandLhrJfk = dl.getDemand('LHR', 'JFK');
            console.log('[dataLoader] LHR→JFK distance:', lhrJfk, 'km');
            console.log('[dataLoader] LHR→JFK demand:', demandLhrJfk);
            // Bizim referans rota da test
            const bzePtp = dl.getDemand('BZE', 'PTP');
            console.log('[dataLoader] BZE→PTP demand (referans, beklenen y=2414/j=274/f=153):', bzePtp);
        });
    });
})();
