const languages = [
  { code: "ab", name: "Abkhazian", flag: null }, // No single country association is accurate
  { code: "aa", name: "Afar", flag: "🇪🇹" }, // Ethiopia, Eritrea, Djibouti
  { code: "af", name: "Afrikaans", flag: "🇿🇦" }, // South Africa
  { code: "ak", name: "Akan", flag: "🇬🇭" }, // Ghana
  { code: "sq", name: "Albanian", flag: "🇦🇱" }, // Albania
  { code: "am", name: "Amharic", flag: "🇪🇹" }, // Ethiopia
  { code: "ar", name: "Arabic", flag: "🇸🇦" }, // Widespread, Saudi flag is symbolic
  { code: "an", name: "Aragonese", flag: "🇪🇸" }, // Spain (region)
  { code: "hy", name: "Armenian", flag: "🇦🇲" }, // Armenia
  { code: "as", name: "Assamese", flag: "🇮🇳" }, // India (Assam)
  { code: "av", name: "Avaric", flag: "🇷🇺" }, // Russia (Dagestan)
  { code: "ae", name: "Avestan", flag: null }, // Ancient Iranian language
  { code: "ay", name: "Aymara", flag: "🇧🇴" }, // Bolivia, Peru
  { code: "az", name: "Azerbaijani", flag: "🇦🇿" }, // Azerbaijan
  { code: "bm", name: "Bambara", flag: "🇲🇱" }, // Mali
  { code: "ba", name: "Bashkir", flag: "🇷🇺" }, // Russia (Bashkortostan)
  { code: "eu", name: "Basque", flag: "🇪🇸" }, // Spain/France (Basque Country)
  { code: "be", name: "Belarusian", flag: "🇧🇾" }, // Belarus
  { code: "bn", name: "Bengali", flag: "🇧🇩" }, // Bangladesh, India (West Bengal)
  { code: "bi", name: "Bislama", flag: "🇻🇺" }, // Vanuatu
  { code: "bs", name: "Bosnian", flag: "🇧🇦" }, // Bosnia and Herzegovina
  { code: "br", name: "Breton", flag: "🇫🇷" }, // France (Brittany)
  { code: "bg", name: "Bulgarian", flag: "🇧🇬" }, // Bulgaria
  { code: "my", name: "Burmese", flag: "🇲🇲" }, // Myanmar
  { code: "ca", name: "Catalan", flag: "🇦🇩" }, // Andorra, Spain (Catalonia)
  { code: "ch", name: "Chamorro", flag: "🇬🇺" }, // Guam
  { code: "ce", name: "Chechen", flag: "🇷🇺" }, // Russia (Chechnya)
  { code: "ny", name: "Chichewa", flag: "🇲🇼" }, // Malawi
  { code: "zh", name: "Chinese", flag: "🇨🇳" }, // China, Taiwan, Singapore etc. (Mandarin is most common)
  { code: "cu", name: "Church Slavic", flag: null }, // Liturgical language
  { code: "cv", name: "Chuvash", flag: "🇷🇺" }, // Russia (Chuvashia)
  { code: "kw", name: "Cornish", flag: "🇬🇧" }, // UK (Cornwall)
  { code: "co", name: "Corsican", flag: "🇫🇷" }, // France (Corsica)
  { code: "cr", name: "Cree", flag: "🇨🇦" }, // Canada
  { code: "hr", name: "Croatian", flag: "🇭🇷" }, // Croatia
  { code: "cs", name: "Czech", flag: "🇨🇿" }, // Czechia
  { code: "da", name: "Danish", flag: "🇩🇰" }, // Denmark
  { code: "dv", name: "Divehi", flag: "🇲🇻" }, // Maldives
  { code: "nl", name: "Dutch", flag: "🇳🇱" }, // Netherlands, Belgium
  { code: "dz", name: "Dzongkha", flag: "🇧🇹" }, // Bhutan
  { code: "en", name: "English", flag: "🇬🇧" }, // Widespread, UK flag often used
  { code: "eo", name: "Esperanto", flag: "🏳️" }, // Constructed language, unofficial flag often used
  { code: "et", name: "Estonian", flag: "🇪🇪" }, // Estonia
  { code: "ee", name: "Ewe", flag: "🇬🇭" }, // Ghana, Togo
  { code: "fo", name: "Faroese", flag: "🇫🇴" }, // Faroe Islands
  { code: "fj", name: "Fijian", flag: "🇫🇯" }, // Fiji
  { code: "fi", name: "Finnish", flag: "🇫🇮" }, // Finland
  { code: "fr", name: "French", flag: "🇫🇷" }, // Widespread, France flag often used
  { code: "fy", name: "Western Frisian", flag: "🇳🇱" }, // Netherlands (Friesland)
  { code: "ff", name: "Fulah", flag: "🇬🇳" }, // Widespread in West Africa, Guinea flag symbolic
  { code: "gd", name: "Scottish Gaelic", flag: "🇬🇧" }, // UK (Scotland)
  { code: "gl", name: "Galician", flag: "🇪🇸" }, // Spain (Galicia)
  { code: "lg", name: "Ganda", flag: "🇺🇬" }, // Uganda
  { code: "ka", name: "Georgian", flag: "🇬🇪" }, // Georgia
  { code: "de", name: "German", flag: "🇩🇪" }, // Germany, Austria, Switzerland etc.
  { code: "el", name: "Greek", flag: "🇬🇷" }, // Greece, Cyprus
  { code: "kl", name: "Kalaallisut (Greenlandic)", flag: "🇬🇱" }, // Greenland
  { code: "gn", name: "Guarani", flag: "🇵🇾" }, // Paraguay
  { code: "gu", name: "Gujarati", flag: "🇮🇳" }, // India (Gujarat)
  { code: "ht", name: "Haitian Creole", flag: "🇭🇹" }, // Haiti
  { code: "ha", name: "Hausa", flag: "🇳🇬" }, // Nigeria, Niger etc.
  { code: "he", name: "Hebrew", flag: "🇮🇱" }, // Israel
  { code: "hz", name: "Herero", flag: "🇳🇦" }, // Namibia, Botswana
  { code: "hi", name: "Hindi", flag: "🇮🇳" }, // India
  { code: "ho", name: "Hiri Motu", flag: "🇵🇬" }, // Papua New Guinea
  { code: "hu", name: "Hungarian", flag: "🇭🇺" }, // Hungary
  { code: "is", name: "Icelandic", flag: "🇮🇸" }, // Iceland
  { code: "io", name: "Ido", flag: null }, // Constructed language
  { code: "ig", name: "Igbo", flag: "🇳🇬" }, // Nigeria
  { code: "id", name: "Indonesian", flag: "🇮🇩" }, // Indonesia
  { code: "ia", name: "Interlingua", flag: null }, // Constructed language
  { code: "ie", name: "Interlingue", flag: null }, // Constructed language
  { code: "iu", name: "Inuktitut", flag: "🇨🇦" }, // Canada
  { code: "ik", name: "Inupiaq", flag: "🇺🇸" }, // USA (Alaska)
  { code: "ga", name: "Irish", flag: "🇮🇪" }, // Ireland
  { code: "it", name: "Italian", flag: "🇮🇹" }, // Italy
  { code: "ja", name: "Japanese", flag: "🇯🇵" }, // Japan
  { code: "jv", name: "Javanese", flag: "🇮🇩" }, // Indonesia (Java)
  { code: "kn", name: "Kannada", flag: "🇮🇳" }, // India (Karnataka)
  { code: "kr", name: "Kanuri", flag: "🇳🇬" }, // Nigeria, Niger, Chad
  { code: "ks", name: "Kashmiri", flag: "🇮🇳" }, // India/Pakistan (Kashmir)
  { code: "kk", name: "Kazakh", flag: "🇰🇿" }, // Kazakhstan
  { code: "km", name: "Khmer", flag: "🇰🇭" }, // Cambodia
  { code: "ki", name: "Kikuyu", flag: "🇰🇪" }, // Kenya
  { code: "rw", name: "Kinyarwanda", flag: "🇷🇼" }, // Rwanda
  { code: "ky", name: "Kyrgyz", flag: "🇰🇬" }, // Kyrgyzstan
  { code: "kv", name: "Komi", flag: "🇷🇺" }, // Russia (Komi Republic)
  { code: "kg", name: "Kongo", flag: "🇨🇩" }, // DRC, ROC, Angola
  { code: "ko", name: "Korean", flag: "🇰🇷" }, // South Korea, North Korea
  { code: "kj", name: "Kuanyama", flag: "🇦🇴" }, // Angola, Namibia
  { code: "ku", name: "Kurdish", flag: "🇮🇶" }, // Iraq, Turkey, Syria, Iran (flag choice is complex/political)
  { code: "lo", name: "Lao", flag: "🇱🇦" }, // Laos
  { code: "la", name: "Latin", flag: "🇻🇦" }, // Vatican City (official), historical/liturgical
  { code: "lv", name: "Latvian", flag: "🇱🇻" }, // Latvia
  { code: "li", name: "Limburgish", flag: "🇳🇱" }, // Netherlands, Belgium, Germany
  { code: "ln", name: "Lingala", flag: "🇨🇩" }, // DRC, ROC
  { code: "lt", name: "Lithuanian", flag: "🇱🇹" }, // Lithuania
  { code: "lu", name: "Luba-Katanga", flag: "🇨🇩" }, // DRC
  { code: "lb", name: "Luxembourgish", flag: "🇱🇺" }, // Luxembourg
  { code: "mk", name: "Macedonian", flag: "🇲🇰" }, // North Macedonia
  { code: "mg", name: "Malagasy", flag: "🇲🇬" }, // Madagascar
  { code: "ms", name: "Malay", flag: "🇲🇾" }, // Malaysia, Indonesia, Brunei, Singapore
  { code: "ml", name: "Malayalam", flag: "🇮🇳" }, // India (Kerala)
  { code: "mt", name: "Maltese", flag: "🇲🇹" }, // Malta
  { code: "gv", name: "Manx", flag: "🇮🇲" }, // Isle of Man
  { code: "mi", name: "Maori", flag: "🇳🇿" }, // New Zealand
  { code: "mr", name: "Marathi", flag: "🇮🇳" }, // India (Maharashtra)
  { code: "mh", name: "Marshallese", flag: "🇲🇭" }, // Marshall Islands
  { code: "mn", name: "Mongolian", flag: "🇲🇳" }, // Mongolia
  { code: "na", name: "Nauru", flag: "🇳🇷" }, // Nauru
  { code: "nv", name: "Navajo", flag: "🇺🇸" }, // USA (Navajo Nation)
  { code: "nd", name: "North Ndebele", flag: "🇿🇼" }, // Zimbabwe
  { code: "nr", name: "South Ndebele", flag: "🇿🇦" }, // South Africa
  { code: "ng", name: "Ndonga", flag: "🇳🇦" }, // Namibia
  { code: "ne", name: "Nepali", flag: "🇳🇵" }, // Nepal
  { code: "no", name: "Norwegian", flag: "🇳🇴" }, // Norway
  { code: "nb", name: "Norwegian Bokmål", flag: "🇳🇴" }, // Norway
  { code: "nn", name: "Norwegian Nynorsk", flag: "🇳🇴" }, // Norway
  { code: "oc", name: "Occitan", flag: "🇫🇷" }, // France, Spain, Italy
  { code: "oj", name: "Ojibwa", flag: "🇨🇦" }, // Canada, USA
  { code: "or", name: "Oriya", flag: "🇮🇳" }, // India (Odisha)
  { code: "om", name: "Oromo", flag: "🇪🇹" }, // Ethiopia, Kenya
  { code: "os", name: "Ossetian", flag: "🇬🇪" }, // Georgia (South Ossetia), Russia (North Ossetia)
  { code: "pi", name: "Pali", flag: null }, // Liturgical language (Theravada Buddhism)
  { code: "ps", name: "Pashto", flag: "🇦🇫" }, // Afghanistan, Pakistan
  { code: "fa", name: "Persian (Farsi)", flag: "🇮🇷" }, // Iran, Afghanistan (Dari), Tajikistan (Tajik)
  { code: "pl", name: "Polish", flag: "🇵🇱" }, // Poland
  { code: "pt", name: "Portuguese", flag: "🇵🇹" }, // Portugal, Brazil, Angola etc.
  { code: "pa", name: "Punjabi", flag: "🇮🇳" }, // India (Punjab), Pakistan (Punjab)
  { code: "qu", name: "Quechua", flag: "🇵🇪" }, // Peru, Bolivia, Ecuador etc.
  { code: "ro", name: "Romanian", flag: "🇷🇴" }, // Romania, Moldova
  { code: "rm", name: "Romansh", flag: "🇨🇭" }, // Switzerland
  { code: "rn", name: "Rundi", flag: "🇧🇮" }, // Burundi
  { code: "ru", name: "Russian", flag: "🇷🇺" }, // Russia and many former Soviet states
  { code: "se", name: "Northern Sami", flag: "🇳🇴" }, // Norway, Sweden, Finland
  { code: "sm", name: "Samoan", flag: "🇼🇸" }, // Samoa
  { code: "sg", name: "Sango", flag: "🇨🇫" }, // Central African Republic
  { code: "sa", name: "Sanskrit", flag: "🇮🇳" }, // Ancient/liturgical language of India
  { code: "sc", name: "Sardinian", flag: "🇮🇹" }, // Italy (Sardinia)
  { code: "sr", name: "Serbian", flag: "🇷🇸" }, // Serbia
  { code: "sn", name: "Shona", flag: "🇿🇼" }, // Zimbabwe
  { code: "ii", name: "Sichuan Yi", flag: "🇨🇳" }, // China
  { code: "sd", name: "Sindhi", flag: "🇵🇰" }, // Pakistan (Sindh), India
  { code: "si", name: "Sinhala", flag: "🇱🇰" }, // Sri Lanka
  { code: "sk", name: "Slovak", flag: "🇸🇰" }, // Slovakia
  { code: "sl", name: "Slovenian", flag: "🇸🇮" }, // Slovenia
  { code: "so", name: "Somali", flag: "🇸🇴" }, // Somalia
  { code: "st", name: "Southern Sotho", flag: "🇱🇸" }, // Lesotho, South Africa
  { code: "es", name: "Spanish", flag: "🇪🇸" }, // Widespread, Spain flag often used
  { code: "su", name: "Sundanese", flag: "🇮🇩" }, // Indonesia (Java)
  { code: "sw", name: "Swahili", flag: "🇹🇿" }, // Tanzania, Kenya, Uganda etc. (TZ flag symbolic)
  { code: "ss", name: "Swati", flag: "🇸🇿" }, // Eswatini, South Africa
  { code: "sv", name: "Swedish", flag: "🇸🇪" }, // Sweden, Finland
  { code: "tl", name: "Tagalog (Filipino)", flag: "🇵🇭" }, // Philippines
  { code: "ty", name: "Tahitian", flag: "🇵🇫" }, // French Polynesia
  { code: "tg", name: "Tajik", flag: "🇹🇯" }, // Tajikistan
  { code: "ta", name: "Tamil", flag: "🇮🇳" }, // India (Tamil Nadu), Sri Lanka, Singapore
  { code: "tt", name: "Tatar", flag: "🇷🇺" }, // Russia (Tatarstan)
  { code: "te", name: "Telugu", flag: "🇮🇳" }, // India (Andhra Pradesh, Telangana)
  { code: "th", name: "Thai", flag: "🇹🇭" }, // Thailand
  { code: "bo", name: "Tibetan", flag: "🇨🇳" }, // China (Tibet)
  { code: "ti", name: "Tigrinya", flag: "🇪🇷" }, // Eritrea, Ethiopia
  { code: "to", name: "Tonga", flag: "🇹🇴" }, // Tonga
  { code: "ts", name: "Tsonga", flag: "🇿🇦" }, // South Africa, Mozambique
  { code: "tn", name: "Tswana", flag: "🇧🇼" }, // Botswana, South Africa
  { code: "tr", name: "Turkish", flag: "🇹🇷" }, // Turkey
  { code: "tk", name: "Turkmen", flag: "🇹🇲" }, // Turkmenistan
  { code: "tw", name: "Twi", flag: "🇬🇭" }, // Ghana
  { code: "ug", name: "Uighur", flag: "🇨🇳" }, // China (Xinjiang)
  { code: "uk", name: "Ukrainian", flag: "🇺🇦" }, // Ukraine
  { code: "ur", name: "Urdu", flag: "🇵🇰" }, // Pakistan, India
  { code: "uz", name: "Uzbek", flag: "🇺🇿" }, // Uzbekistan
  { code: "ve", name: "Venda", flag: "🇿🇦" }, // South Africa
  { code: "vi", name: "Vietnamese", flag: "🇻🇳" }, // Vietnam
  { code: "vo", name: "Volapük", flag: null }, // Constructed language
  { code: "wa", name: "Walloon", flag: "🇧🇪" }, // Belgium (Wallonia)
  { code: "cy", name: "Welsh", flag: "🇬🇧" }, // UK (Wales)
  { code: "wo", name: "Wolof", flag: "🇸🇳" }, // Senegal, Gambia, Mauritania
  { code: "xh", name: "Xhosa", flag: "🇿🇦" }, // South Africa
  { code: "yi", name: "Yiddish", flag: null }, // Historically widespread Ashkenazi Jewish language
  { code: "yo", name: "Yoruba", flag: "🇳🇬" }, // Nigeria, Benin, Togo
  { code: "za", name: "Zhuang", flag: "🇨🇳" }, // China (Guangxi)
  { code: "zu", name: "Zulu", flag: "🇿🇦" }, // South Africa
];

export default languages;
