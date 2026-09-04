import type { LandingContent } from "./landing";

/**
 * Узбекская версия лендинга (study.activesales.uz/uz, docs/MULTI-DOMAIN-PLAN.md).
 *
 * Структура повторяет русский landing.ts ключ в ключ — это проверяет тип
 * LandingContent. Язык — латиница (современная норма для веба в Узбекистане);
 * термины продаж даны так, как их говорят на тренингах («e'tirozlar bilan
 * ishlash», «sotuv skripti»), названия компаний и брендов не переводятся.
 */
export const landingUz = {
  hero: {
    badge: (geo: string) => `Sotuv bo'yicha onlayn treninglar va kurslar · ${geo}`,
    title: "Aynan sizning sohangizda ishlaydigan sotuv kurslari",
    subtitle:
      "20 yillik tajribaga ega amaldagi biznes-trenerning videokurslari. Har bir dars shunchaki video emas: yo'lda o'rganish uchun AI-podkast va audioversiya, konspekt, kartochkalar va e'tirozlar bilan ishlash trenajyorlari. Turizm, mebel, ko'chmas mulk, FMCG va B2B uchun real metodikalar.",
    primaryCta: "Kurs tanlash",
    secondaryCta: "Sohamga mos kurs tanlab bering",
    note: "Kursga umrbod kirish va yakunida sertifikat",
  },

  steps: [
    {
      icon: "play",
      title: "Darsni ko'rasiz yoki tinglaysiz",
      text: "4 tilda subtitrlari va tezlik sozlamasi bor himoyalangan video. Ko'rishga vaqt bo'lmasa — AI-podkastni yoki darsning audioversiyasini yo'lda tinglang.",
    },
    {
      icon: "bot",
      title: "AI-trenajyorlarda mashq qilasiz",
      text: "Chat-murabbiy, mijoz simulyatori va e'tirozlar trenajyori: «qimmat» va «o'ylab ko'raman» javoblarini suhbatda mashq qilasiz, qo'ng'iroq skriptini bosqichma-bosqich yig'asiz.",
    },
    {
      icon: "check",
      title: "Mustahkamlaysiz va tekshirasiz",
      text: "Takrorlash uchun konspekt, kartochkalar va chek-varaqlar, so'ngra xatolarni tahlil qiladigan va manbani keltiradigan test. Qayta topshirish cheklanmagan.",
    },
    {
      icon: "award",
      title: "Sertifikat olasiz",
      text: "Noyob raqami va tekshiruv sahifasi bo'lgan shaxsiy sertifikat. Progress, kunlar seriyasi va yutuqlar oxirigacha yetishga turtki beradi.",
    },
  ],

  voiceShowcase: {
    badge: "Yangi",
    title: "Mijoz bilan ovozli suhbat qiling",
    subtitle:
      "Haqiqiy uchrashuvga eng yaqin format: siz ovoz chiqarib gapirasiz, mijoz esa tabiiy ohangda javob beradi. Suhbatdan so'ng — nutqingizning trener metodikasi bo'yicha tahlili.",
    points: [
      "Mikrofonga gapirasiz — mijoz eshitadi va ovozda javob beradi",
      "Tabiiy ohang va pauzalari bo'lgan jonli ovoz",
      "Turli xarakterlar: ehtiyotkor xaridor, norozi mijoz",
      "Yakuniy tahlil: nima ishladi va nimani kuchaytirish kerak",
    ],
  },

  formats: {
    title: "Har bir darsning ichida nima bor",
    subtitle:
      "Bitta dars — o'qish uslubingizga va istalgan bo'sh daqiqangizga mos o'nlab format: rul ortida, uchrashuv oldidan yoki to'liq mashg'ulotda.",
    items: [
      {
        icon: "play",
        title: "Video darslar",
        text: "Haqiqiy treninglar yozuvi: RU/KK/EN/UZ subtitrlari, tezlikni sozlash, to'xtagan joyingizdan davom etish.",
      },
      {
        icon: "podcast",
        title: "Darsning AI-podkasti",
        text: "Material ikki boshlovchining jonli suhbati shaklida — darsni podkast kabi tinglang.",
      },
      {
        icon: "headphones",
        title: "Audioversiya",
        text: "Darsning to'liq ovozli varianti: rul ortida, sayrda yoki zalda — ekransiz o'rganasiz.",
      },
      {
        icon: "file",
        title: "Konspekt va slaydlar",
        text: "Darsning asosiysi matnda va kalit slaydlar — mijoz bilan uchrashuv oldidan tez takrorlash uchun.",
      },
      {
        icon: "cards",
        title: "Fleş-kartochkalar",
        text: "Usullar va iboralar kartochkalarda — ular suhbat paytida o'zi esga tushsin.",
      },
      {
        icon: "objections",
        title: "E'tirozlar trenajyori",
        text: "«Qimmat», «o'ylab ko'raman», «bizga kerak emas» javoblarini yodlamay, suhbatda mashq qilasiz.",
      },
      {
        icon: "simulation",
        title: "Mijoz simulyatori",
        text: "«Qiyin mijoz» bilan rolli suhbat va javoblaringizning trener metodikasi bo'yicha tahlili.",
      },
      {
        icon: "voice",
        title: "Mijoz bilan ovozli rolli o'yin",
        text: "Mijoz bilan ovoz chiqarib gaplashasiz: u tabiiy ohangda javob beradi, oxirida — nutqingiz tahlili. Deyarli haqiqiy uchrashuv.",
      },
      {
        icon: "script",
        title: "Bosqichma-bosqich skript",
        text: "O'z sohangiz uchun qo'ng'iroq va uchrashuv skriptini bosqichma-bosqich yig'asiz.",
      },
      {
        icon: "audit",
        title: "«Xatoni top» va chek-varaqlar",
        text: "Begona suhbatni tahlil qilasiz, xatolarni topasiz va bitim oldidan chek-varaq bilan solishtirasiz.",
      },
    ],
  },

  industries: [
    "Turizm",
    "Mebel va oshxonalar",
    "Poyabzal va kiyim",
    "Ko'chmas mulk",
    "Tibbiyot vakillari",
    "FMCG",
    "Chakana savdo",
    "B2B muzokaralar",
  ],

  clients: ["JTI", "Komatsu", "Bayan Sulu", "Chef Kitchen", "Megastroy Astana", "Condor"],

  trainer: {
    label: "Sizning treneringiz",
    name: "Vitaliy Dubovik",
    role: "Sotuv bo'yicha amaldagi biznes-trener",
    text: "Faol sotuv, muzokaralar va bo'limlarni o'qitishda 20 yildan ortiq tajriba. Dasturlar kitob qayta hikoya qilishga emas, real keyslarni tahlil qilish va biznes-o'yinlarga qurilgan. Platformadagi AI-murabbiy aynan shu metodika bo'yicha javob beradi.",
    bullets: [
      "Faol sotuv, muzokaralar va bo'limlarni o'qitishda 20 yil",
      "Biznes-o'yinlar va real keyslar tahlili orqali o'qitish, «quruq nazariyasiz»",
      "Sohaga moslashtirilgan mualliflik metodikalari: turizm, mebel, ko'chmas mulk, FMCG",
      "Korporativ treninglar va biznes-telekanaldagi chiqishlar tajribasi",
    ],
  },

  methodology: {
    title: "Jonli treninglar + kunu tun AI-murabbiy",
    points: [
      {
        title: "Nazariya emas, amaliyotchi metodikasi",
        text: "Barcha material — Vitaliy Dubovikning haqiqiy treninglari yozuvi: maydonda sinovdan o'tgan ishchi skriptlar va usullar, kitob qayta hikoyasi emas.",
      },
      {
        title: "AI faqat material bo'yicha javob beradi",
        text: "Murabbiy o'zidan to'qimaydi: faqat dars doirasida javob beradi va manba taymkodini ko'rsatadi.",
      },
      {
        title: "Sohangizga moslashtirish",
        text: "Keyslar va topshiriqlar siz sotayotgan sohaga qarab o'zgaradi: turizm, mebel, ko'chmas mulk va boshqalar.",
      },
    ],
  },

  stats: [
    { value: 20, suffix: "", label: "yil trener tajribasi" },
    { value: 24, suffix: "/7", label: "AI-murabbiy aloqada" },
    { value: 4, suffix: "", label: "subtitr tili" },
    { value: 9, suffix: "", label: "har darsdagi format" },
  ],

  aiDemo: {
    title: "AI-murabbiy",
    status: "demo · kurs materiali bo'yicha javob beradi",
    intro: {
      question: "Mijoz «qimmat» deydi. Nima deb javob berish kerak?",
      answer:
        "Narxni darrov tushirmang — avval suhbatni qiymatga qaytaring. Kurs metodikasi bo'yicha: «Nimaga nisbatan qimmat?» — shunda mijoz nima bilan solishtirayotganini tushunasiz va asl e'tiroz bilan ishlaysiz.",
      source: "3-dars · «Qimmat» e'tirozi · 12:40",
    },
    chips: [
      {
        question: "Mijoz: «o'ylab ko'raman»",
        answer:
          "«O'ylab ko'raman» — ko'pincha yashirin e'tiroz. Yumshoq aniqlang: «Aynan nimani o'ylaysiz — narxnimi yoki variantnimi?» Bu suhbatni qaytaradi va asl sababni ochadi.",
        source: "4-dars · Yashirin e'tirozlar · 08:15",
      },
      {
        question: "Qo'ng'iroqni nimadan boshlash kerak?",
        answer:
          "Birinchi 20 soniya hal qiladi: o'zingizni tanishtiring, qo'ng'iroq sababini ayting va mijoz foydasi haqida ilmoq savol bering. Birinchi aloqa skripti sohangiz misollarida bosqichma-bosqich tahlil qilinadi.",
        source: "1-dars · Birinchi aloqa · 03:02",
      },
      {
        question: "Chegirmasiz narxni qanday ushlab turish kerak?",
        answer:
          "Chegirma — oxirgi vosita. Avval: narxni foydalarga ajrating, mijoz xatosining qiymati bilan solishtiring va narx bo'yicha emas, to'plam bo'yicha muqobil taklif qiling.",
        source: "5-dars · Narxni himoya qilish · 17:30",
      },
    ],
    disclaimer:
      "Bu — demo. Kursda AI-murabbiy trener materiallari bo'yicha istalgan savolga javob beradi.",
  },

  faq: [
    {
      q: "Onlayn to'lash shartmi?",
      a: "Yo'q. Ariza qoldiring — biz bog'lanamiz, savollaringizga javob beramiz va qulay to'lov usulini aytamiz. To'lovdan so'ng administrator sizga kirish va login beradi.",
    },
    {
      q: "Kurslarni kim olib boradi?",
      a: "Kurslar Vitaliy Dubovik materiallariga qurilgan — u sotuv bo'yicha amaldagi biznes-trener, 20 yillik tajribaga hamda Belarus va MDH mamlakatlarida korporativ trening amaliyotiga ega.",
    },
    {
      q: "Bitta darsning ichida nima bor?",
      a: "Har bir dars faqat video emas. AI-podkast va audioversiya (yo'lda tinglash mumkin), takrorlash uchun konspekt va slaydlar, fleş-kartochkalar, e'tirozlar trenajyori, mijoz simulyatori, skript yig'ish, «xatoni top» mashqi va chek-varaq, oxirida esa — tahlilli test.",
    },
    {
      q: "AI-murabbiy nima?",
      a: "Bu — kurs materiallariga asoslangan chat: e'tirozga qanday javob berishni so'rash, «qiyin mijoz» bilan suhbatda mashq qilish va javoblaringizning trener metodikasi bo'yicha tahlilini olish mumkin.",
    },
    {
      q: "Videosiz, faqat tinglab o'rganish mumkinmi?",
      a: "Ha. Har bir darsning boshlovchilar suhbati shaklidagi AI-podkasti va to'liq audioversiyasi bor — rul ortida, sayrda yoki zalda o'rganish qulay.",
    },
    {
      q: "Materiallar qaysi tilda?",
      a: "Sayt interfeysi — o'zbek va rus tillarida, videolar — rus tilida. Subtitrlar rus, qozoq, ingliz va o'zbek tillarida, ularni pleyerda almashtirish mumkin.",
    },
    {
      q: "Sertifikat beriladimi?",
      a: "Ha. Barcha darslar va yakuniy testdan so'ng noyob raqami hamda haqiqiyligini tekshirish sahifasi bo'lgan shaxsiy sertifikat olasiz.",
    },
    {
      q: "Telefondan o'rganish mumkinmi?",
      a: "Ha, platforma birinchi navbatda smartfonga mo'ljallangan: video ham, test ham, AI-trenajyor ham mobilda qulay.",
    },
  ],
} as const satisfies LandingContent;
