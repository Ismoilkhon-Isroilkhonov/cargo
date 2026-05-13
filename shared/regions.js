// shared/regions.js
// Umumiy viloyat ma'lumotlari — reader-bot va sender-bot uchun

const REGIONS = {
  Sirdaryo: {
    id: 1,
    nameUz: "Sirdaryo",
    nameRu: "Сырдарья",
    keywords: [
      "zarbdor", "зарбдор", "guliston", "гулистон",
      "boyavut", "боявут", "bayavut", "savxoz",
      "sirdaryodan", "сирдарёдан", "sirdaryoga", "сирдарёга",
      "yangiyer", "янгиер", "sardoba", "сардоба", "sirdaryo",
    ],
  },
  Toshkent: {
    id: 2,
    nameUz: "Toshkent",
    nameRu: "Ташкент",
    keywords: [
      "toshkent", "ташкент", "angren", "ангрен",
      "chirchiq", "чирчик", "toshkentga", "ташкентга",
      "chirchiqdan", "чирчикдан", "chirchiqqa", "чирчикка",
      "begavot", "begavod", "boka", "бука", "bo'ka",
    ],
  },
  Samarqand: {
    id: 3,
    nameUz: "Samarqand",
    nameRu: "Самарканд",
    keywords: [
      "samarkand", "самарканд", "kattakurgan", "каттакурган",
      "urgut", "ургут", "samarqanddan", "самаркандан",
      "samarqandga", "самаркандга", "ishtixon", "иштихон",
      "samarqand",
    ],
  },
  Jizzax: {
    id: 4,
    nameUz: "Jizzax",
    nameRu: "Джизак",
    keywords: [
      "jizzax", "жиззах", "gagarin", "гагарин",
      "do'stlik", "дўстлик", "dustlik", "jizzaxdan",
      "жиззахдан", "jizzaxga", "жиззахга", "jizah",
    ],
  },
  Navoiy: {
    id: 5,
    nameUz: "Navoiy",
    nameRu: "Навои",
    keywords: [
      "navoiy", "навоий", "zarafshon", "зарафшон",
      "nurota", "нурота", "navoiydan", "навоийдан",
      "navoiyga", "навоийга", "navoi", "навои",
      "uchquduq", "qiziltepa", "konimex", "xatirchi",
    ],
  },
  Qashqadaryo: {
    id: 6,
    nameUz: "Qashqadaryo",
    nameRu: "Кашкадарья",
    keywords: [
      "qarshi", "қарши", "qashqadaryo", "кашкадарё",
      "shahrisabz", "шаҳрисабз", "guzor", "ғузор",
      "qashqadaryodan", "қашқадарёдан", "qashqadaryoga",
    ],
  },
  Surhondaryo: {
    id: 7,
    nameUz: "Surxondaryo",
    nameRu: "Сурхандарья",
    keywords: [
      "termiz", "термез", "denov", "денов",
      "surxondaryo", "сурхандарё", "surxondaryodan",
      "сурхандарёдан", "surxondaryoga", "сурхандарёга",
    ],
  },
  Xorazm: {
    id: 8,
    nameUz: "Xorazm",
    nameRu: "Хорезм",
    keywords: [
      "urgench", "урганч", "xiva", "хива",
      "xorazm", "хорезм", "pitnak", "питнак",
      "xorazmdan", "хорезмдан", "xorazmga", "хорезмга",
    ],
  },
  Buxoro: {
    id: 9,
    nameUz: "Buxoro",
    nameRu: "Бухара",
    keywords: [
      "bukhara", "бухара", "buxoro", "бухоро",
      "g'ijduvon", "ғиждувон", "buxorodan",
      "бухородан", "buxoroga", "бухорога",
    ],
  },
  Fargona: {
    id: 10,
    nameUz: "Farg'ona",
    nameRu: "Фергана",
    keywords: [
      "farg'ona", "фарғона", "qo'qon", "коканд",
      "margilan", "марғилон", "fargonadan", "фарғонадан",
      "fargonaga", "фарғонага", "fargona", "кукондан",
    ],
  },
  Andijon: {
    id: 11,
    nameUz: "Andijon",
    nameRu: "Андижан",
    keywords: [
      "andijon", "андижон", "asaka", "асака",
      "xonobod", "хонобод", "andijondan",
      "андижондан", "andijonga", "андижонга",
    ],
  },
  Namangan: {
    id: 12,
    nameUz: "Namangan",
    nameRu: "Наманган",
    keywords: [
      "namangan", "наманган", "pop", "поп",
      "chartak", "чартак", "chortoq", "чортоқ",
      "uchqorgon", "учқўрғон", "namangandan",
      "намангандан", "namanganga", "наманганга",
    ],
  },
};

// Chet el / filtr so'zlari — bu so'zlar bo'lsa xabar o'tkazib yuboriladi
const EXCLUDED_KEYWORDS = new Set([
  "газиантеп", "казань", "пермь", "польша", "алтайский", "тобольск",
  "бишкек", "санкт-петербург", "барнаул", "moskvaga", "масква", "шаря",
  "реф", "ref", "fura", "tent", "тент", "фура", "фуру", "киров",
  "кострома", "грузия", "moskva", "россия", "chakman", "плашадка",
  "tend", "kamaz", "тонар", "tonar", "чакман", "алматы", "алмата",
  "новосибирск", "истамбул", "истанбул", "смоленск", "turkiya", "москва",
  "красноярск", "свердловская", "шымкент", "furo", "уфа", "баку",
  "ростовская", "баку", "брянск", "афганистан", "ростов", "саратов",
  "тюмень", "паровоз", "хоргос", "новгород", "ашхабад", "нижний",
  "хоргос", "екатеринбург", "измир", "анкара", "сумгаит", "белгород",
  "омск", "минск", "almata", "xоргос", "salarka", "yekaterinburg",
]);

/**
 * Xabarda chet el so'zi borligini tekshiradi
 * @param {string} normalizedMsg - kichik harflarga o'tkazilgan xabar
 * @returns {boolean}
 */
const isExcluded = (normalizedMsg) => {
  for (const kw of EXCLUDED_KEYWORDS) {
    if (normalizedMsg.includes(kw)) return true;
  }
  return false;
};

/**
 * Kalit so'zlar orqali viloyatni aniqlaydi
 * @param {string} normalizedMsg - kichik harflarga o'tkazilgan xabar
 * @returns {{ regionKey: string, region: object } | null}
 */
const detectRegionByKeyword = (normalizedMsg) => {
  for (const [regionKey, data] of Object.entries(REGIONS)) {
    for (const kw of data.keywords) {
      if (normalizedMsg.includes(kw)) {
        return { regionKey, region: data };
      }
    }
  }
  return null;
};

module.exports = { REGIONS, EXCLUDED_KEYWORDS, isExcluded, detectRegionByKeyword };
