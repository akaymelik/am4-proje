/**
 * planes.js: Genişletilmiş AM4 Küresel Uçak ve Rota Veritabanı
 */
const aircraftData = {
    // --- YOLCU UÇAKLARI (PAX) ---
    "ATR-42": { type: "passenger", capacity: 50, fuel_consumption: 0.25, range: 1500, cruise_speed: 400, price: 1200000 },
    "ATR-72": { type: "passenger", capacity: 70, fuel_consumption: 0.35, range: 1500, cruise_speed: 510, price: 2100000 },
    "Bombardier CRJ-900": { type: "passenger", capacity: 85, fuel_consumption: 0.35, range: 3200, cruise_speed: 860, price: 2400000 },
    "Boeing 737-800": { type: "passenger", capacity: 184, fuel_consumption: 0.85, range: 5765, cruise_speed: 839, price: 4400000 },
    "Airbus A320neo": { type: "passenger", capacity: 195, fuel_consumption: 0.75, range: 6500, cruise_speed: 833, price: 8500000 },
    "Airbus A321neo": { type: "passenger", capacity: 240, fuel_consumption: 0.82, range: 7400, cruise_speed: 833, price: 12500000 },
    "MC-21-400": { type: "passenger", capacity: 230, fuel_consumption: 1.05, range: 5500, cruise_speed: 870, price: 33750000 },
    "Boeing 787-9": { type: "passenger", capacity: 406, fuel_consumption: 1.75, range: 14140, cruise_speed: 903, price: 125000000 },
    "Airbus A350-1000": { type: "passenger", capacity: 480, fuel_consumption: 2.10, range: 16100, cruise_speed: 903, price: 185000000 },
    "Boeing 747-8": { type: "passenger", capacity: 467, fuel_consumption: 11.2, range: 14310, cruise_speed: 917, price: 180000000 },
    "Airbus A380-800": { type: "passenger", capacity: 600, fuel_consumption: 12.0, range: 15000, cruise_speed: 903, price: 215000000 },

    // --- KARGO UÇAKLARI (Cargo) ---
    "Cessna 208B (C)": { type: "cargo", capacity: 8300, fuel_consumption: 0.15, range: 2000, cruise_speed: 340, price: 1500000 },
    "Boeing 737-700C": { type: "cargo", capacity: 41000, fuel_consumption: 0.75, range: 6000, cruise_speed: 839, price: 6500000 },
    "Boeing 757-200F": { type: "cargo", capacity: 88000, fuel_consumption: 1.10, range: 5800, cruise_speed: 850, price: 15000000 },
    "Airbus A300-600F": { type: "cargo", capacity: 106000, fuel_consumption: 1.80, range: 7500, cruise_speed: 830, price: 28000000 },
    "McDonnell Douglas MD-11F": { type: "cargo", capacity: 205000, fuel_consumption: 3.80, range: 7330, cruise_speed: 876, price: 42000000 },
    "Boeing 777F": { type: "cargo", capacity: 226000, fuel_consumption: 2.80, range: 9200, cruise_speed: 892, price: 145000000 },
    "Boeing 747-8F": { type: "cargo", capacity: 303000, fuel_consumption: 10.5, range: 8130, cruise_speed: 908, price: 185000000 },
    "Antonov An-225": { type: "cargo", capacity: 550000, fuel_consumption: 25.0, range: 15400, cruise_speed: 800, price: 450000000 }
};

/**
 * Küresel Rota Veritabanı
 */
const popularRoutes = [
    // --- AVRUPA MERKEZLİ ---
    { origin: "Istanbul (IST)", destination: "London (LHR)", distance: 2500, demand: 850 },
    { origin: "Istanbul (IST)", destination: "Paris (CDG)", distance: 2250, demand: 880 },
    { origin: "Istanbul (IST)", destination: "Antalya (AYT)", distance: 480, demand: 1500 },
    { origin: "London (LHR)", destination: "New York (JFK)", distance: 5570, demand: 2100 },
    { origin: "London (LHR)", destination: "Dubai (DXB)", distance: 5470, demand: 1800 },
    { origin: "Paris (CDG)", destination: "Montreal (YUL)", distance: 5500, demand: 1400 },
    { origin: "Frankfurt (FRA)", destination: "Bangkok (BKK)", distance: 9000, demand: 1100 },
    { origin: "Madrid (MAD)", destination: "Mexico City (MEX)", distance: 9000, demand: 950 },
    { origin: "Berlin (BER)", destination: "Rome (FCO)", distance: 1100, demand: 1200 },

    // --- KUZEY VE GÜNEY AMERİKA ---
    { origin: "New York (JFK)", destination: "Los Angeles (LAX)", distance: 3950, demand: 2500 },
    { origin: "New York (JFK)", destination: "London (LHR)", distance: 5570, demand: 2100 },
    { origin: "Miami (MIA)", destination: "Sao Paulo (GRU)", distance: 6500, demand: 1100 },
    { origin: "Chicago (ORD)", destination: "Tokyo (NRT)", distance: 10100, demand: 850 },
    { origin: "Toronto (YYZ)", destination: "Vancouver (YVR)", distance: 3350, demand: 1500 },
    { origin: "Los Angeles (LAX)", destination: "Sydney (SYD)", distance: 12000, demand: 750 },
    { origin: "San Francisco (SFO)", destination: "Seoul (ICN)", distance: 9000, demand: 900 },

    // --- ASYA VE PASİFİK ---
    { origin: "Singapore (SIN)", destination: "London (LHR)", distance: 10880, demand: 1400 },
    { origin: "Singapore (SIN)", destination: "Sydney (SYD)", distance: 6300, demand: 1200 },
    { origin: "Tokyo (NRT)", destination: "Los Angeles (LAX)", distance: 8800, demand: 1550 },
    { origin: "Hong Kong (HKG)", destination: "London (LHR)", distance: 9600, demand: 1300 },
    { origin: "Seoul (ICN)", destination: "Paris (CDG)", distance: 8900, demand: 880 },
    { origin: "Shanghai (PVG)", destination: "San Francisco (SFO)", distance: 9800, demand: 1000 },
    { origin: "Sydney (SYD)", destination: "Dubai (DXB)", distance: 12000, demand: 1300 },
    { origin: "Melbourne (MEL)", destination: "Auckland (AKL)", distance: 2600, demand: 1100 },

    // --- ORTA DOĞU VE AFRİKA ---
    { origin: "Dubai (DXB)", destination: "Istanbul (IST)", distance: 3000, demand: 1600 },
    { origin: "Dubai (DXB)", destination: "Mumbai (BOM)", distance: 1900, demand: 2200 },
    { origin: "Dubai (DXB)", destination: "London (LHR)", distance: 5470, demand: 1800 },
    { origin: "Doha (DOH)", destination: "New York (JFK)", distance: 10700, demand: 900 },
    { origin: "Abu Dhabi (AUH)", destination: "Sydney (SYD)", distance: 12000, demand: 850 },
    { origin: "Johannesburg (JNB)", destination: "Perth (PER)", distance: 8300, demand: 600 },
    { origin: "Cairo (CAI)", destination: "Jeddah (JED)", distance: 1200, demand: 2800 },
    { origin: "Addis Ababa (ADD)", destination: "Guangzhou (CAN)", distance: 8000, demand: 750 }
];
