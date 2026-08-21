import { BarChart3, RefreshCw, Sparkles } from "lucide-react";
import type { BusinessContent } from "./business";

/**
 * Узбекская версия корпоративной страницы (/uz/business).
 * Структура повторяет business.ts — это проверяет тип BusinessContent.
 */
export const businessUz = {
  hero: {
    title: "Juma kuni tugamaydigan sotuv bo'limi o'quvi",
    subtitle:
      "Trening bir oyda unutiladi. Platformaga yillik kirish har bir xodimni — yarim yildan keyin keladiganlarni ham — o'qitadi va kim haqiqatan shug'ullanayotganini ko'rsatadi.",
    priceFrom: "dan",
    perSeatYear: "bir xodimga yiliga — bu",
    perMonth: "oyiga",
    entryNote: (seats: number, price: string) =>
      `20 kishidan boshlab jamoa uchun. ${seats} xodimga — har biriga ${price}.`,
    coursesWithCount: (count: number) =>
      `Sohalar va umumiy ko'nikmalar bo'yicha ${count} ta sotuv kursi`,
    coursesFallback: "Sohalar va umumiy ko'nikmalar bo'yicha sotuv kurslari",
    bulletCabinet: "Har bir xodim progressi ko'rinadigan kompaniya kabineti",
    bulletTrainers: "AI-trenajyorlar: mijoz simulyatori va e'tirozlarni mashq qilish",
    heroAlt: "Rahbar jamoa o'quvi bo'yicha hisobotni ko'rmoqda",
    howAlt: "Sotuv bo'limi xodimlari muzokara xonasida har biri o'z noutbukida o'qimoqda",
  },
  benefitsTitle: "Kompaniya nima oladi",
  benefits: [
    {
      icon: BarChart3,
      title: "Har bir xodimning progressi",
      body: "Kim o'qiyapti, kim yo'q — ko'rinib turadi: o'tilgan darslar ulushi, test natijalari, davr davomidagi faollik, bo'linmalar kesimi.",
    },
    {
      icon: Sparkles,
      title: "Kunu tun AI-murabbiy va trenajyorlar",
      body: "Bir martalik trening emas, kundalik amaliyot: mijoz simulyatori, e'tirozlarni mashq qilish, nutqni tahlil qiladigan ovozli rolli o'yin. Yangi xodim birinchi kunidan boshlaydi.",
    },
    {
      icon: RefreshCw,
      title: "O'rin boshqasiga o'tadi",
      body: "Xodim ishdan bo'shadi — bo'shagan o'rinni boshqasiga berasiz. Ikkinchi marta to'lash shart emas.",
    },
  ],
  howTitle: "Bu qanday ishlaydi",
  steps: [
    {
      title: "Nechta xodim ekanini aytasiz",
      body: "O'rinlar soniga qarab narxni hisoblaymiz va hisob-faktura beramiz. To'lov — bir yilga.",
    },
    {
      title: "Biz kompaniya kabinetini ochamiz",
      body: "O'quv uchun mas'ul shaxs bir ish kuni ichida kirish oladi.",
    },
    {
      title: "HR xodimlarga kodlarni tarqatadi",
      body: "Har biri o'z kodini kiritadi, parol o'ylab topadi — va darrov o'qishni boshlaydi.",
    },
    {
      title: "Siz har birining progressini ko'rasiz",
      body: "Kim tugatdi, kim boshlamadi, testlar uchun qanday ball. Hisobot fayl bilan yuklanadi.",
    },
  ],
  faqTitle: "Xaridorning savollari",
  faq: [
    {
      q: "«O'rin» nima degani?",
      a: "O'rin — bir xodimning bir yillik o'quvga kirishi. 10 ta o'rin oldingiz — bir vaqtda 10 kishi o'qiydi. Xodim ishdan bo'shasa, o'rin bo'shaydi va boshqasiga beriladi.",
    },
    {
      q: "Turli shaharlardagi xodimlarni o'qitish mumkinmi?",
      a: "Ha, o'quv to'liq onlayn: video darslar, testlar va trenajyorlar kompyuterdan ham, telefondan ham istalgan vaqtda ochiladi.",
    },
    {
      q: "Muddat tugagach nima bo'ladi?",
      a: "Darslarga kirish to'xtaydi, berilgan sertifikatlar kuchida qoladi. Litsenziyani keyingi yilga uzaytirish mumkin.",
    },
    {
      q: "Ta'lim to'g'risida hujjat berasizmi?",
      a: "Yo'q. Xizmatlar axborot xarakterida: biz ta'lim dasturlarini amalga oshirmaymiz va ta'lim to'g'risida hujjat bermaymiz. Xodim noyob raqami va haqiqiyligini tekshirish sahifasi bo'lgan o'z namunamizdagi shaxsiy sertifikat oladi.",
    },
    {
      q: "Qanday to'laymiz?",
      a: "Yuridik shaxs yoki YaTT hisob-fakturasi bo'yicha. To'lovdan so'ng dalolatnoma imzolaymiz. Barcha shartlar — tashkilotlar uchun ommaviy ofertada.",
    },
  ],
  quoteTitle: "Jamoangiz uchun hisoblab beramiz",
  quoteText:
    "Nechta xodim va qaysi mavzular kerakligini ayting — hisob-kitob va hisob-fakturani yuboramiz. Jamoa besh kishidan kam bo'lsa, oddiy kirishlarni tanlaymiz.",
  calculator: {
    seats: "Nechta xodimni o'qitamiz",
    seatsLess: "Xodimlar soni kamroq",
    seatsMore: "Xodimlar soni ko'proq",
    seatsInput: "Xodimlar soni",
    whatOpens: "Xodimlarga nimani ochamiz",
    byIndustry: "Sohangiz kursi",
    ownSet: "O'z to'plamim",
    industryHint: "Sotuv bo'limi sohasi",
    alwaysIncluded: (courses: string) =>
      `To'plamga sotuv bo'yicha umumiy kurslar doim kiradi: ${courses}.`,
    pickCourses: "Kurslarni belgilang — shular bo'yicha hisoblaymiz.",
    perSeatYear: "Bir xodimga — bir yillik kirish",
    totalYear: (seats: number) => `Butun jamoa uchun, ${seats} kishi`,
    perMonth: "Oyiga hisoblaganda, bir kishiga",
    paymentNote:
      "To'lov bir marta: butun jamoa uchun yiliga bitta hisob. Oylik to'lov yo'q — oy faqat taqqoslash uchun ko'rsatilgan. Yil kirish ochilgan kundan boshlanadi.",
    saving: (amount: string) => `Yiliga ${amount} tejaysiz.`,
    tierNote: (tier: string, discount: number) => `«${tier}» tarifi — ${discount} % chegirma.`,
    minSeatsNote: (seats: number) =>
      `Korporativ tarif ${seats} xodimdan boshlanadi. Kichikroq jamoaga oddiy kirishlar foydaliroq — yozing, tanlab beramiz.`,
    tierRow: (seats: number, discount: number) => `${seats} o'rindan — minus ${discount} %`,
    includesCourses: (count: number) =>
      `Narxga tanlangan kurslarga (${count}) bir yillik kirish, hisobotli kompaniya kabineti va har bir xodimga AI-trenajyorlar kiradi.`,
    includesAny:
      "Narxga tanlangan kurslarga bir yillik kirish, hisobotli kompaniya kabineti va har bir xodimga AI-trenajyorlar kiradi.",
  },
  cta: {
    format: "O'quv formati",
    online: "Onlayn kirish",
    offline: "Oflayn trening",
    offlineTitle: "Kompaniyangizda jonli trening",
    offlineText:
      "Trener sizga keladi yoki mashg'ulotni jonli efirda onlayn olib boradi: dastur mahsulotingiz va bitim sikliga qarab yig'iladi.",
    offlinePoints: [
      "Dastur va davomiylik — sizning vazifalaringizga qarab",
      "Menejerlaringiz qo'ng'iroqlari va uchrashuvlari tahlili",
      "Platformaga kirish bilan birga olib borish mumkin: trening ramka beradi, platforma mustahkamlaydi",
    ],
    offlinePrice:
      "Narx alohida hisoblanadi: u dastur, ishtirokchilar soni va formatga bog'liq. Ariza qoldiring — hisob-kitob bilan qaytamiz.",
    offlineRequest: "Treningga so'rov",
    offlineNote: "Vazifangizni ayting — dastur, sanalar va narx bilan qaytamiz.",
    onlineRequest: "Hisob-kitob va hisob-faktura olish",
    onlineNote: "Ish vaqtida javob beramiz, aniq narxni hisoblaymiz va hisob-faktura yuboramiz.",
  },
} as const satisfies BusinessContent;
