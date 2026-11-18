/**
 * Atlas data for the guides index: one row per guide slug.
 * [display name, ISO 3166 alpha-2, region, lat, lon, capital, prohibited items, restricted items]
 * Coordinates and regions from the world-countries dataset; item counts are the
 * bullet counts of the "Prohibited Items" and "Restricted/Dutiable Items" chapters
 * in src/lib/data/country-guides. Regenerate if guides are added.
 */
export type Region = 'Americas' | 'Europe' | 'Africa' | 'Middle East' | 'Asia' | 'Oceania';
type Row = [string, string, Region, number, number, string, number, number];

const ATLAS: Record<string, Row> = {
  "afghanistan": ["Afghanistan", "AF", "Asia", 33, 65, "Kabul", 6, 2],
  "albania": ["Albania", "AL", "Europe", 41, 20, "Tirana", 11, 6],
  "algeria": ["Algeria", "DZ", "Africa", 28, 3, "Algiers", 10, 1],
  "american-samoa": ["American Samoa", "AS", "Oceania", -14.3, -170, "Pago Pago", 11, 36],
  "angola": ["Angola", "AO", "Africa", -12.5, 18.5, "Luanda", 7, 2],
  "argentina": ["Argentina", "AR", "Americas", -34, -64, "Buenos Aires", 11, 8],
  "armenia": ["Armenia", "AM", "Asia", 40, 45, "Yerevan", 6, 2],
  "aruba": ["Aruba", "AW", "Americas", 12.5, -70, "Oranjestad", 9, 4],
  "australia": ["Australia", "AU", "Oceania", -27, 133, "Canberra", 4, 60],
  "austria": ["Austria", "AT", "Europe", 47.3, 13.3, "Vienna", 1, 6],
  "azerbaijan": ["Azerbaijan", "AZ", "Asia", 40.5, 47.5, "Baku", 6, 7],
  "bahrain": ["Bahrain", "BH", "Middle East", 26, 50.5, "Manama", 10, 10],
  "bangladesh": ["Bangladesh", "BD", "Asia", 24, 90, "Dhaka", 10, 9],
  "barbados": ["Barbados", "BB", "Americas", 13.2, -59.5, "Bridgetown", 2, 3],
  "belarus": ["Belarus", "BY", "Europe", 53, 28, "Minsk", 5, 4],
  "belgium": ["Belgium", "BE", "Europe", 50.8, 4, "Brussels", 2, 8],
  "benin": ["Benin", "BJ", "Africa", 9.5, 2.3, "Porto-Novo", 11, 10],
  "bermuda": ["Bermuda", "BM", "Americas", 32.3, -64.8, "Hamilton", 4, 2],
  "bhutan": ["Bhutan", "BT", "Asia", 27.5, 90.5, "Thimphu", 6, 6],
  "bolivia": ["Bolivia", "BO", "Americas", -17, -65, "Sucre", 4, 9],
  "bosnia-and-herzegovina": ["Bosnia and Herzegovina", "BA", "Europe", 44, 18, "Sarajevo", 7, 7],
  "botswana": ["Botswana", "BW", "Africa", -22, 24, "Gaborone", 8, 6],
  "brazil": ["Brazil", "BR", "Americas", -10, -55, "Brasília", 7, 10],
  "brunei-darussalam": ["Brunei", "BN", "Asia", 4.5, 114.7, "Bandar Seri Begawan", 3, 19],
  "bulgaria": ["Bulgaria", "BG", "Europe", 43, 25, "Sofia", 4, 17],
  "burkina-faso": ["Burkina Faso", "BF", "Africa", 13, -2, "Ouagadougou", 8, 9],
  "burundi": ["Burundi", "BI", "Africa", -3.5, 30, "Gitega", 10, 1],
  "cambodia": ["Cambodia", "KH", "Asia", 13, 105, "Phnom Penh", 9, 5],
  "cameroon": ["Cameroon", "CM", "Africa", 6, 12, "Yaoundé", 5, 8],
  "canada": ["Canada", "CA", "Americas", 60, -95, "Ottawa", 4, 11],
  "cayman-islands": ["Cayman Islands", "KY", "Americas", 19.5, -80.5, "George Town", 7, 1],
  "central-african-republic": ["Central African Republic", "CF", "Africa", 7, 21, "Bangui", 0, 7],
  "chad": ["Chad", "TD", "Africa", 15, 19, "N'Djamena", 3, 4],
  "chile": ["Chile", "CL", "Americas", -30, -71, "Santiago", 5, 3],
  "china": ["China", "CN", "Asia", 35, 105, "Beijing", 10, 16],
  "colombia": ["Colombia", "CO", "Americas", 4, -72, "Bogotá", 0, 0],
  "costa-rica": ["Costa Rica", "CR", "Americas", 10, -84, "San José", 3, 13],
  "croatia": ["Croatia", "HR", "Europe", 45.2, 15.5, "Zagreb", 5, 4],
  "cyprus": ["Cyprus", "CY", "Europe", 35, 33, "Nicosia", 2, 5],
  "czech-republic": ["Czech Republic", "CZ", "Europe", 49.8, 15.5, "Prague", 2, 12],
  "democratic-republic-of-the-congo": ["DR Congo", "CD", "Africa", 0, 25, "Kinshasa", 3, 7],
  "denmark": ["Denmark", "DK", "Europe", 56, 10, "Copenhagen", 3, 15],
  "djibouti": ["Djibouti", "DJ", "Africa", 11.5, 43, "Djibouti", 5, 3],
  "dominican-republic": ["Dominican Republic", "DO", "Americas", 19, -70.7, "Santo Domingo", 4, 8],
  "east-timor-timor-leste": ["Timor-Leste", "TL", "Asia", -8.8, 125.9, "Dili", 3, 1],
  "ecuador": ["Ecuador", "EC", "Americas", -2, -77.5, "Quito", 8, 8],
  "egypt": ["Egypt", "EG", "Africa", 27, 30, "Cairo", 4, 5],
  "el-salvador": ["El Salvador", "SV", "Americas", 13.8, -88.9, "San Salvador", 4, 13],
  "equatorial-guinea": ["Equatorial Guinea", "GQ", "Africa", 2, 10, "Malabo", 5, 6],
  "estonia": ["Estonia", "EE", "Europe", 59, 26, "Tallinn", 3, 4],
  "ethiopia": ["Ethiopia", "ET", "Africa", 8, 38, "Addis Ababa", 6, 3],
  "fiji": ["Fiji", "FJ", "Oceania", -18, 175, "Suva", 10, 8],
  "finland": ["Finland", "FI", "Europe", 64, 26, "Helsinki", 4, 6],
  "france": ["France", "FR", "Europe", 46, 2, "Paris", 5, 11],
  "french-guiana": ["French Guiana", "GF", "Americas", 4, -53, "Cayenne", 2, 0],
  "french-polynesia": ["French Polynesia", "PF", "Oceania", -15, -140, "Papeetē", 2, 2],
  "gabon": ["Gabon", "GA", "Africa", -1, 11.8, "Libreville", 5, 7],
  "gambia": ["Gambia", "GM", "Africa", 13.5, -16.6, "Banjul", 9, 5],
  "georgia-country": ["Georgia", "GE", "Asia", 42, 43.5, "Tbilisi", 4, 5],
  "germany": ["Germany", "DE", "Europe", 51, 9, "Berlin", 9, 10],
  "ghana": ["Ghana", "GH", "Africa", 8, -2, "Accra", 11, 6],
  "greece": ["Greece", "GR", "Europe", 39, 22, "Athens", 8, 2],
  "guadeloupe": ["Guadeloupe", "GP", "Americas", 16.3, -61.6, "Basse-Terre", 2, 0],
  "guam": ["Guam", "GU", "Oceania", 13.5, 144.8, "Hagåtña", 15, 52],
  "guatemala": ["Guatemala", "GT", "Americas", 15.5, -90.3, "Guatemala City", 2, 4],
  "guinea": ["Guinea", "GN", "Africa", 11, -10, "Conakry", 2, 7],
  "guinea-bissau": ["Guinea-Bissau", "GW", "Africa", 12, -15, "Bissau", 7, 4],
  "guyana": ["Guyana", "GY", "Americas", 5, -59, "Georgetown", 4, 14],
  "haiti": ["Haiti", "HT", "Americas", 19, -72.4, "Port-au-Prince", 1, 5],
  "honduras": ["Honduras", "HN", "Americas", 15, -86.5, "Tegucigalpa", 5, 4],
  "hong-kong": ["Hong Kong", "HK", "Asia", 22.3, 114.2, "City of Victoria", 9, 12],
  "hungary": ["Hungary", "HU", "Europe", 47, 20, "Budapest", 4, 9],
  "iceland": ["Iceland", "IS", "Europe", 65, -18, "Reykjavik", 6, 24],
  "india": ["India", "IN", "Asia", 20, 77, "New Delhi", 4, 15],
  "indonesia": ["Indonesia", "ID", "Asia", -5, 120, "Jakarta", 7, 5],
  "iran": ["Iran", "IR", "Asia", 32, 53, "Tehran", 5, 3],
  "iraq": ["Iraq", "IQ", "Middle East", 33, 44, "Baghdad", 5, 2],
  "ireland": ["Ireland", "IE", "Europe", 53, -8, "Dublin", 8, 2],
  "israel": ["Israel", "IL", "Middle East", 31.5, 35.1, "Jerusalem", 9, 9],
  "italy": ["Italy", "IT", "Europe", 42.8, 12.8, "Rome", 7, 10],
  "ivory-coast": ["Côte d'Ivoire", "CI", "Africa", 8, -5, "Yamoussoukro", 7, 6],
  "jamaica": ["Jamaica", "JM", "Americas", 18.3, -77.5, "Kingston", 1, 2],
  "japan": ["Japan", "JP", "Asia", 36, 138, "Tokyo", 7, 5],
  "jordan": ["Jordan", "JO", "Middle East", 31, 36, "Amman", 10, 4],
  "kazakhstan": ["Kazakhstan", "KZ", "Asia", 48, 68, "Astana", 26, 2],
  "kenya": ["Kenya", "KE", "Africa", 1, 38, "Nairobi", 11, 8],
  "kosovo": ["Kosovo", "XK", "Europe", 42.7, 21.2, "Pristina", 4, 5],
  "kuwait": ["Kuwait", "KW", "Middle East", 29.5, 45.8, "Kuwait City", 8, 6],
  "kyrgyzstan": ["Kyrgyzstan", "KG", "Asia", 41, 75, "Bishkek", 4, 2],
  "laos": ["Laos", "LA", "Asia", 18, 105, "Vientiane", 6, 6],
  "latvia": ["Latvia", "LV", "Europe", 57, 25, "Riga", 3, 11],
  "lebanon": ["Lebanon", "LB", "Middle East", 33.8, 35.8, "Beirut", 5, 4],
  "lesotho": ["Lesotho", "LS", "Africa", -29.5, 28.5, "Maseru", 5, 5],
  "liberia": ["Liberia", "LR", "Africa", 6.5, -9.5, "Monrovia", 6, 8],
  "libya": ["Libya", "LY", "Africa", 25, 17, "Tripoli", 6, 2],
  "lithuania": ["Lithuania", "LT", "Europe", 56, 24, "Vilnius", 5, 10],
  "luxembourg": ["Luxembourg", "LU", "Europe", 49.8, 6.2, "Luxembourg", 4, 5],
  "macau": ["Macau", "MO", "Asia", 22.2, 113.5, "", 6, 14],
  "macedonia": ["North Macedonia", "MK", "Europe", 41.8, 22, "Skopje", 9, 6],
  "madagascar": ["Madagascar", "MG", "Africa", -20, 47, "Antananarivo", 2, 3],
  "malawi": ["Malawi", "MW", "Africa", -13.5, 34, "Lilongwe", 4, 4],
  "malaysia": ["Malaysia", "MY", "Asia", 2.5, 112.5, "Kuala Lumpur", 10, 14],
  "mali": ["Mali", "ML", "Africa", 17, -4, "Bamako", 3, 4],
  "malta": ["Malta", "MT", "Europe", 35.8, 14.6, "Valletta", 5, 2],
  "martinique": ["Martinique", "MQ", "Americas", 14.7, -61, "Fort-de-France", 3, 1],
  "mauritania": ["Mauritania", "MR", "Africa", 20, -12, "Nouakchott", 2, 4],
  "mauritius": ["Mauritius", "MU", "Africa", -20.3, 57.5, "Port Louis", 0, 0],
  "mexico": ["Mexico", "MX", "Americas", 23, -102, "Mexico City", 10, 4],
  "moldova": ["Moldova", "MD", "Europe", 47, 29, "Chișinău", 10, 8],
  "mongolia": ["Mongolia", "MN", "Asia", 46, 105, "Ulan Bator", 0, 0],
  "morocco": ["Morocco", "MA", "Africa", 32, -5, "Rabat", 2, 2],
  "mozambique": ["Mozambique", "MZ", "Africa", -18.3, 35, "Maputo", 2, 6],
  "myanmar": ["Myanmar", "MM", "Asia", 22, 98, "Naypyidaw", 3, 3],
  "namibia": ["Namibia", "NA", "Africa", -22, 17, "Windhoek", 6, 4],
  "nepal": ["Nepal", "NP", "Asia", 28, 84, "Kathmandu", 2, 2],
  "netherlands": ["Netherlands", "NL", "Europe", 52.5, 5.8, "Amsterdam", 2, 19],
  "new-caledonia": ["New Caledonia", "NC", "Oceania", -21.5, 165.5, "Nouméa", 0, 0],
  "new-zealand": ["New Zealand", "NZ", "Oceania", -41, 174, "Wellington", 5, 3],
  "nicaragua": ["Nicaragua", "NI", "Americas", 13, -85, "Managua", 5, 9],
  "niger": ["Niger", "NE", "Africa", 16, 8, "Niamey", 3, 3],
  "nigeria": ["Nigeria", "NG", "Africa", 10, 8, "Abuja", 7, 15],
  "norway": ["Norway", "NO", "Europe", 62, 10, "Oslo", 5, 15],
  "oman": ["Oman", "OM", "Middle East", 21, 57, "Muscat", 11, 1],
  "pakistan": ["Pakistan", "PK", "Asia", 30, 70, "Islamabad", 9, 4],
  "panama": ["Panama", "PA", "Americas", 9, -80, "Panama City", 9, 4],
  "papua-new-guinea": ["Papua New Guinea", "PG", "Oceania", -6, 147, "Port Moresby", 7, 2],
  "paraguay": ["Paraguay", "PY", "Americas", -23, -58, "Asunción", 3, 5],
  "peru": ["Peru", "PE", "Americas", -10, -76, "Lima", 4, 10],
  "philippines": ["Philippines", "PH", "Asia", 13, 122, "Manila", 7, 8],
  "poland": ["Poland", "PL", "Europe", 52, 20, "Warsaw", 10, 11],
  "portugal": ["Portugal", "PT", "Europe", 39.5, -8, "Lisbon", 9, 12],
  "puerto-rico": ["Puerto Rico", "PR", "Americas", 18.3, -66.5, "San Juan", 11, 28],
  "qatar": ["Qatar", "QA", "Middle East", 25.5, 51.3, "Doha", 8, 3],
  "republic-of-the-congo": ["Republic of the Congo", "CG", "Africa", -1, 15, "Brazzaville", 3, 7],
  "romania": ["Romania", "RO", "Europe", 46, 25, "Bucharest", 6, 2],
  "russia": ["Russia", "RU", "Europe", 60, 100, "Moscow", 6, 3],
  "rwanda": ["Rwanda", "RW", "Africa", -2, 30, "Kigali", 5, 9],
  "saint-lucia": ["Saint Lucia", "LC", "Americas", 13.9, -61, "Castries", 5, 10],
  "sao-tome-and-principe": ["São Tomé and Príncipe", "ST", "Africa", 1, 7, "São Tomé", 8, 0],
  "saudi-arabia": ["Saudi Arabia", "SA", "Middle East", 25, 45, "Riyadh", 12, 13],
  "senegal": ["Senegal", "SN", "Africa", 14, -14, "Dakar", 3, 7],
  "serbia": ["Serbia", "RS", "Europe", 44, 21, "Belgrade", 6, 4],
  "sierra-leone": ["Sierra Leone", "SL", "Africa", 8.5, -11.5, "Freetown", 2, 5],
  "singapore": ["Singapore", "SG", "Asia", 1.4, 103.8, "Singapore", 29, 4],
  "slovakia": ["Slovakia", "SK", "Europe", 48.7, 19.5, "Bratislava", 3, 4],
  "slovenia": ["Slovenia", "SI", "Europe", 46.1, 14.8, "Ljubljana", 3, 8],
  "south-africa": ["South Africa", "ZA", "Africa", -29, 24, "Pretoria", 6, 20],
  "south-korea": ["South Korea", "KR", "Asia", 37, 127.5, "Seoul", 4, 14],
  "spain": ["Spain", "ES", "Europe", 40, -4, "Madrid", 5, 7],
  "sri-lanka": ["Sri Lanka", "LK", "Asia", 7, 81, "Colombo", 3, 2],
  "sudan": ["Sudan", "SD", "Africa", 15, 30, "Khartoum", 8, 8],
  "swaziland": ["Eswatini", "SZ", "Africa", -26.5, 31.5, "Lobamba", 4, 8],
  "sweden": ["Sweden", "SE", "Europe", 62, 15, "Stockholm", 1, 11],
  "switzerland": ["Switzerland", "CH", "Europe", 47, 8, "Bern", 6, 14],
  "syria": ["Syria", "SY", "Middle East", 35, 38, "Damascus", 7, 5],
  "taiwan": ["Taiwan", "TW", "Asia", 23.5, 121, "Taipei", 4, 14],
  "tajikistan": ["Tajikistan", "TJ", "Asia", 39, 71, "Dushanbe", 4, 5],
  "tanzania": ["Tanzania", "TZ", "Africa", -6, 35, "Dodoma", 7, 9],
  "thailand": ["Thailand", "TH", "Asia", 15, 100, "Bangkok", 7, 13],
  "the-bahamas": ["The Bahamas", "BS", "Americas", 24.3, -76, "Nassau", 5, 5],
  "togo": ["Togo", "TG", "Africa", 8, 1.2, "Lomé", 2, 4],
  "trinidad-and-tobago": ["Trinidad and Tobago", "TT", "Americas", 11, -61, "Port of Spain", 2, 5],
  "tunisia": ["Tunisia", "TN", "Africa", 34, 9, "Tunis", 3, 8],
  "turkey": ["Turkey", "TR", "Middle East", 39, 35, "Ankara", 4, 2],
  "turkmenistan": ["Turkmenistan", "TM", "Asia", 40, 60, "Ashgabat", 4, 13],
  "turks-and-caicos-islands": ["Turks and Caicos", "TC", "Americas", 21.8, -71.6, "Cockburn Town", 4, 4],
  "uganda": ["Uganda", "UG", "Africa", 1, 32, "Kampala", 5, 9],
  "ukraine": ["Ukraine", "UA", "Europe", 49, 32, "Kyiv", 15, 2],
  "united-arab-emirates": ["United Arab Emirates", "AE", "Middle East", 24, 54, "Abu Dhabi", 16, 3],
  "united-kingdom": ["United Kingdom", "GB", "Europe", 54, -2, "London", 7, 13],
  "united-states": ["United States", "US", "Americas", 38, -97, "Washington D.C.", 9, 43],
  "uruguay": ["Uruguay", "UY", "Americas", -33, -56, "Montevideo", 5, 23],
  "us-virgin-islands": ["US Virgin Islands", "VI", "Americas", 18.4, -64.9, "Charlotte Amalie", 9, 34],
  "uzbekistan": ["Uzbekistan", "UZ", "Asia", 41, 64, "Tashkent", 4, 2],
  "venezuela": ["Venezuela", "VE", "Americas", 8, -66, "Caracas", 3, 3],
  "vietnam": ["Vietnam", "VN", "Asia", 16.2, 107.8, "Hanoi", 13, 6],
  "yemen": ["Yemen", "YE", "Middle East", 15, 48, "Sana'a", 5, 12],
  "zambia": ["Zambia", "ZM", "Africa", -15, 30, "Lusaka", 8, 8],
  "zimbabwe": ["Zimbabwe", "ZW", "Africa", -20, 30, "Harare", 7, 5]
};

export interface AtlasEntry {
  slug: string;
  name: string;
  iso: string;
  region: Region;
  lat: number;
  lon: number;
  capital: string;
  prohibited: number;
  restricted: number;
}

export const REGIONS: Region[] = ['Americas', 'Europe', 'Africa', 'Middle East', 'Asia', 'Oceania'];

/** Countries where IRP has its own team and country page. */
export const IRP_COUNTRIES: Record<string, string> = {
  'costa-rica': '/costa-rica',
  panama: '/panama',
  mexico: '/mexico',
  portugal: '/portugal',
  spain: '/spain',
  colombia: '/colombia'
};

/** The six chapters every guide carries, in reading order. */
export const CHAPTERS = [
  { title: 'Household goods', body: 'Documents customs asks for, and how clearance works for used personal effects.' },
  { title: 'Motor vehicles', body: 'Import duties, age limits and the papers a car needs to cross the border.' },
  { title: 'Pets', body: 'Vaccines, health certificates, permits and any quarantine on arrival.' },
  { title: 'Restricted items', body: 'What you can bring with a permit, a licence or a duty payment.' },
  { title: 'Prohibited items', body: 'What customs will seize, whatever the paperwork says.' },
  { title: 'Consignment', body: 'How to address the shipment so it clears without a hold.' }
];

export function atlasEntry(slug: string, fallbackName: string): AtlasEntry {
  const r = ATLAS[slug];
  if (!r) {
    return { slug, name: fallbackName, iso: '', region: 'Americas', lat: 0, lon: 0, capital: '', prohibited: 0, restricted: 0 };
  }
  return { slug, name: r[0], iso: r[1], region: r[2], lat: r[3], lon: r[4], capital: r[5], prohibited: r[6], restricted: r[7] };
}

/** Lower case, accents removed, for matching what people type. */
export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Initial used to file a guide under the A to Z. */
export const initial = (name: string) => fold(name).charAt(0).toUpperCase();

/**
 * Guides that match a typed query: names that start with it first, then names
 * that contain it, then guides whose capital matches ("Lisbon" finds Portugal).
 */
export function matchGuides(list: AtlasEntry[], q: string): AtlasEntry[] {
  const f = fold(q);
  if (!f) return list;
  const starts: AtlasEntry[] = [];
  const has: AtlasEntry[] = [];
  const cap: AtlasEntry[] = [];
  for (const g of list) {
    const n = fold(g.name);
    if (n.startsWith(f) || n.split(/[\s-]/).some((w) => w.startsWith(f))) starts.push(g);
    else if (n.includes(f) || fold(g.iso) === f) has.push(g);
    else if (fold(g.capital).startsWith(f)) cap.push(g);
  }
  return [...starts, ...has, ...cap];
}

/** Split a name around the typed query so the match can be marked. */
export function marks(name: string, q: string): { t: string; m: boolean }[] {
  const f = fold(q);
  if (!f) return [{ t: name, m: false }];
  const i = fold(name).indexOf(f);
  if (i < 0) return [{ t: name, m: false }];
  return [
    { t: name.slice(0, i), m: false },
    { t: name.slice(i, i + f.length), m: true },
    { t: name.slice(i + f.length), m: false }
  ].filter((p) => p.t);
}

/** "9.9°N · 84.1°W" */
export const coords = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} · ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
