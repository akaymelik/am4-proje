/**
 * routes.js: Airline Manager 4 Küresel Rota Veritabanı
 * Bu liste dünya genelindeki ana hub'ları ve kârlı koridorları kapsar.
 */
const popularRoutes = [
    // --- AVRUPA & TÜRKİYE MERKEZLİ ---
    { origin: "Istanbul (IST)", destination: "London (LHR)", distance: 2500 },
    { origin: "Istanbul (IST)", destination: "Paris (CDG)", distance: 2250 },
    { origin: "Istanbul (IST)", destination: "New York (JFK)", distance: 8000 },
    { origin: "Istanbul (IST)", destination: "Tokyo (NRT)", distance: 8900 },
    { origin: "Istanbul (IST)", destination: "Antalya (AYT)", distance: 480 },
    { origin: "Istanbul (IST)", destination: "Berlin (BER)", distance: 1750 },
    { origin: "Istanbul (IST)", destination: "Dubai (DXB)", distance: 3000 },
    { origin: "Istanbul (IST)", destination: "Moscow (SVO)", distance: 1750 },
    { origin: "London (LHR)", destination: "New York (JFK)", distance: 5570 },
    { origin: "London (LHR)", destination: "Dubai (DXB)", distance: 5470 },
    { origin: "London (LHR)", destination: "Singapore (SIN)", distance: 10880 },
    { origin: "Paris (CDG)", destination: "Montreal (YUL)", distance: 5500 },
    { origin: "Frankfurt (FRA)", destination: "Bangkok (BKK)", distance: 9000 },
    { origin: "Amsterdam (AMS)", destination: "Seoul (ICN)", distance: 8550 },
    { origin: "Madrid (MAD)", destination: "Mexico City (MEX)", distance: 9060 },

    // --- KUZEY AMERİKA MERKEZLİ ---
    { origin: "New York (JFK)", destination: "Los Angeles (LAX)", distance: 3950 },
    { origin: "New York (JFK)", destination: "London (LHR)", distance: 5570 },
    { origin: "Los Angeles (LAX)", destination: "Tokyo (NRT)", distance: 8800 },
    { origin: "Los Angeles (LAX)", destination: "Sydney (SYD)", distance: 12000 },
    { origin: "Chicago (ORD)", destination: "Tokyo (HND)", distance: 10100 },
    { origin: "Miami (MIA)", destination: "Bogota (BOG)", distance: 2400 },
    { origin: "San Francisco (SFO)", destination: "Singapore (SIN)", distance: 13500 },
    { origin: "Toronto (YYZ)", destination: "Hong Kong (HKG)", distance: 12500 },

    // --- ASYA & OKYANUSYA MERKEZLİ ---
    { origin: "Singapore (SIN)", destination: "London (LHR)", distance: 10880 },
    { origin: "Singapore (SIN)", destination: "Sydney (SYD)", distance: 6300 },
    { origin: "Tokyo (NRT)", destination: "Honolulu (HNL)", distance: 6100 },
    { origin: "Seoul (ICN)", destination: "Los Angeles (LAX)", distance: 9600 },
    { origin: "Hong Kong (HKG)", destination: "London (LHR)", distance: 9600 },
    { origin: "Sydney (SYD)", destination: "Dubai (DXB)", distance: 12000 },
    { origin: "Mumbai (BOM)", destination: "Dubai (DXB)", distance: 1900 },

    // --- ORTA DOĞU & AFRİKA ---
    { origin: "Dubai (DXB)", destination: "London (LHR)", distance: 5470 },
    { origin: "Dubai (DXB)", destination: "New York (JFK)", distance: 11000 },
    { origin: "Dubai (DXB)", destination: "Johannesburg (JNB)", distance: 6400 },
    { origin: "Cairo (CAI)", destination: "Jeddah (JED)", distance: 1200 },
    { origin: "Johannesburg (JNB)", destination: "London (LHR)", distance: 9000 },
    { origin: "Nairobi (NBO)", destination: "Dubai (DXB)", distance: 3500 },

    // --- KARGO ODAKLI ROTALAR ---
    { origin: "Anchorage (ANC)", destination: "Tokyo (NRT)", distance: 5500 },
    { origin: "Shanghai (PVG)", destination: "Anchorage (ANC)", distance: 9000 },
    { origin: "Luxembourg (LUX)", destination: "Hong Kong (HKG)", distance: 9300 },
    { origin: "Leipzig (LEJ)", destination: "Cincinnati (CVG)", distance: 7100 },
    { origin: "Memphis (MEM)", destination: "Paris (CDG)", distance: 7500 }
];
