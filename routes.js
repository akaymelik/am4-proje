/**
 * routes.js: AM4-MENOA Excel Veritabanından Alınan Gerçek Rotalar
 * Sadece Excel'deki rotaları içerir, piyasa talepleri bire bir eşlenmiştir.
 */
const popularRoutes = [
    // --- İSTANBUL (IST) ÇIKIŞLI ANA ROTALAR ---
    { origin: "Istanbul (IST)", destination: "Antalya (AYT)", distance: 483, demand: { y: 1326, j: 147, f: 46 } },
    { origin: "Istanbul (IST)", destination: "London (LHR)", distance: 2503, demand: { y: 1046, j: 308, f: 201 } },
    { origin: "Istanbul (IST)", destination: "Paris (CDG)", distance: 2258, demand: { y: 947, j: 288, f: 192 } },
    { origin: "Istanbul (IST)", destination: "New York (JFK)", distance: 8016, demand: { y: 1104, j: 357, f: 251 } },
    { origin: "Istanbul (IST)", destination: "Dubai (DXB)", distance: 3002, demand: { y: 852, j: 304, f: 226 } },
    { origin: "Istanbul (IST)", destination: "Frankfurt (FRA)", distance: 1867, demand: { y: 912, j: 275, f: 184 } },
    { origin: "Istanbul (IST)", destination: "Amsterdam (AMS)", distance: 2215, demand: { y: 884, j: 262, f: 175 } },
    { origin: "Istanbul (IST)", destination: "Munich (MUC)", distance: 1587, demand: { y: 895, j: 254, f: 168 } },
    { origin: "Istanbul (IST)", destination: "Rome (FCO)", distance: 1382, demand: { y: 872, j: 245, f: 162 } },
    { origin: "Istanbul (IST)", destination: "Madrid (MAD)", distance: 2741, demand: { y: 824, j: 231, f: 154 } },
    { origin: "Istanbul (IST)", destination: "Barcelona (BCN)", distance: 2243, demand: { y: 812, j: 228, f: 151 } },
    { origin: "Istanbul (IST)", destination: "Athens (ATH)", distance: 554, demand: { y: 1150, j: 184, f: 58 } },
    { origin: "Istanbul (IST)", destination: "Ankara (ESB)", distance: 376, demand: { y: 1420, j: 125, f: 38 } },
    { origin: "Istanbul (IST)", destination: "Izmir (ADB)", distance: 341, demand: { y: 1380, j: 118, f: 35 } },
    { origin: "Istanbul (IST)", destination: "Tel Aviv (TLV)", distance: 1162, demand: { y: 1024, j: 215, f: 142 } },
    { origin: "Istanbul (IST)", destination: "Cairo (CAI)", distance: 1238, demand: { y: 984, j: 208, f: 138 } },
    { origin: "Istanbul (IST)", destination: "Doha (DOH)", distance: 2724, demand: { y: 785, j: 284, f: 212 } },
    { origin: "Istanbul (IST)", destination: "Riyadh (RUH)", distance: 2435, demand: { y: 814, j: 265, f: 198 } },
    { origin: "Istanbul (IST)", destination: "Jeddah (JED)", distance: 2368, demand: { y: 842, j: 272, f: 204 } },
    { origin: "Istanbul (IST)", destination: "Kuwait (KWI)", distance: 2174, demand: { y: 826, j: 258, f: 188 } }
];
