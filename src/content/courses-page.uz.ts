import type { CoursesPageContent } from "./courses-page";

/**
 * Узбекская версия текстов каталога (/uz/courses).
 * Структура повторяет courses-page.ts — это проверяет тип CoursesPageContent.
 */
export const coursesPageUz = {
  audience: {
    title: "Bu kurslar kimga mos",
    intro:
      "Kurslar o'zi sotadiganlar va sotadiganlar uchun javob beradiganlarga mo'ljallangan. Material umumiy sotuv nazariyasi atrofida emas, aniq ish holatlari — qo'ng'iroq, uchrashuv, e'tiroz, savdolashuv — atrofida qurilgan.",
    items: [
      {
        title: "Sotuv menejerlariga",
        text: "Siz har kuni «qimmat» va «o'ylab ko'raman» eshitasiz, lekin ularga har xil javob berasiz va har doim ham nishonga tegmaysiz. Kurs replikagacha tahlil qilingan algoritm beradi: suhbatni qanday boshlash, chegirma o'rniga uni qiymatga qanday qaytarish, kelishuvni qanday qayd etishga olib borish.",
      },
      {
        title: "Sotuv bo'limi rahbarlariga",
        text: "Jamoani o'qitish odatda bitta narsaga taqaladi: trening bir marta bo'ladi, ko'nikma esa doim kerak. Bu yerda material xodim bilan qoladi: u darsga qayta murojaat qiladi, AI-mijoz bilan suhbatda mashq qiladi va natijasi ko'rinadigan test topshiradi.",
      },
      {
        title: "Kichik biznes egalariga",
        text: "Sotuv bilan egasining o'zi shug'ullanganda, uzoq dasturlarga vaqt bo'lmaydi. Darslar qisqa, telefondan ochiladi, ularni podkast kabi — yo'lda yoki uchrashuvlar orasida tinglash mumkin.",
      },
      {
        title: "Sotuvga endi kirib kelayotganlarga",
        text: "Umumiy kitoblardan boshlash qiyin: aniq suhbatda nima qilish noaniq. Kurs oddiydan — birinchi aloqa, savollar, shubhalar bilan ishlash — muzokaralar va narxni himoya qilishgacha, sizning sohangiz misollari bilan boradi.",
      },
    ],
  },

  howItWorks: {
    title: "O'qish qanday tashkil etilgan",
    intro:
      "Bitta dars — bitta video emas, bitta mavzu atrofidagi formatlar to'plami. Ketma-ket ko'rish shart emas: aniq uchrashuv oldidan faqat keragini olish mumkin.",
    steps: [
      {
        title: "Video, podkast yoki audio — tanlovingizga ko'ra",
        text: "Darsning asosida haqiqiy trening yozuvi yotadi: rus, qozoq, ingliz va o'zbek tilidagi subtitrlar bilan, tezlikni sozlash va to'xtagan joyingizdan davom etish imkoni bilan. Ko'rishga vaqt bo'lmasa, o'sha darsning ikki boshlovchi suhbati shaklidagi AI-podkasti va to'liq audioversiyasi bor — yo'lga, sayrga yoki zalga.",
      },
      {
        title: "AI-murabbiy bilan mashq",
        text: "Materialdan so'ng amaliyot boshlanadi. Chat-murabbiy faqat dars mazmuni bo'yicha javob beradi va javob olingan taymkodni ko'rsatadi — u o'zidan to'qimaydi va internetni qayta hikoya qilmaydi. Mijoz simulyatori va e'tirozlar trenajyori «qimmat», «o'ylab ko'raman» va «bizga kerak emas» javoblarini jonli suhbatda mashq qilish imkonini beradi, ovozli rolli o'yin esa suhbatni ovoz chiqarib aytib, nutqingiz tahlilini olishga yordam beradi.",
      },
      {
        title: "Mustahkamlash va tekshirish",
        text: "Har bir dars bilan konspekt, kalit slaydlar, iboralari bo'lgan fleş-kartochkalar va bitim oldidan solishtirish qulay bo'lgan chek-varaq beriladi. Bilimni test tekshiradi: u faqat xatoni emas, to'g'ri qadam tahlil qilingan materialdan iqtibosni ham ko'rsatadi. Qayta topshirish cheklanmagan.",
      },
      {
        title: "Kurs yakunida sertifikat",
        text: "Barcha darslar va yakuniy testdan so'ng noyob raqami va haqiqiyligini tekshirish sahifasi bo'lgan shaxsiy sertifikat beriladi — uni ish beruvchiga ko'rsatish mumkin. Progress, kunlar seriyasi va yutuqlar kabinetda ko'rinadi va oxirigacha yetishga yordam beradi.",
      },
    ],
  },

  difference: {
    title: "Bu vebinarlar va kitoblardan nimasi bilan farq qiladi",
    items: [
      {
        title: "Kitob qayta hikoyasi emas, amaliyotchi metodikasi",
        text: "Barcha material — faol sotuv va muzokaralarda yigirma yillik tajribaga ega amaldagi biznes-trener Vitaliy Dubovik treninglarining yozuvi. Undagi usullar begona darsliklardan yig'ilmagan, maydonda va korporativ dasturlarda sinovdan o'tgan.",
      },
      {
        title: "«Umumiy sotuv» o'rniga aniq soha",
        text: "Ko'pchilik dasturlar mavhum texnikaga o'rgatadi, keyin uni o'z mahsulotingizga o'zingiz ko'chirishingiz kerak. Bu yerda kurslar sohalar bo'yicha bo'lingan, AI-trenajyor keyslari va topshiriqlari esa siz ishlayotgan sohaga moslashadi.",
      },
      {
        title: "Tomosha emas, amaliyot",
        text: "Vebinar efir tugashi bilan tugaydi. Trenajyorlar qoladi: qiyin mijoz bilan suhbatni ibora erkin chiqa boshlaguncha necha marta kerak bo'lsa, shuncha marta o'tish mumkin.",
      },
      {
        title: "Kirish abadiy qoladi",
        text: "Sotib olingan kursga yarim yildan keyin — murakkab muzokaralar oldidan yoki bo'limga yangi vazifa kelganda — qayta murojaat qilish mumkin. Kirish abadiy, qayta to'lash shart emas.",
      },
    ],
  },

  faq: [
    {
      q: "Ro'yxatda mening soham bo'lmasa, kursni qanday tanlayman?",
      a: "«Hamma uchun» turkumidagi kurslardan boshlang — muzokara texnikasi, SPIN va taym-menejment istalgan sohada ishlaydi. Shubhalansangiz, ariza qoldiring: vazifangizni tahlil qilib, aynan nimadan boshlash kerakligini aytamiz.",
    },
    {
      q: "Sotib olishdan oldin kursni ko'rish mumkinmi?",
      a: "Ha. Har bir kursning birinchi darsi bepul ochiq — to'lovgacha trenerning berilishini ham, trenajyorlar qanday tuzilganini ham baholash mumkin.",
    },
    {
      q: "O'qish qancha vaqt oladi?",
      a: "Davomiyligi va darslar soni har bir kurs kartochkasida ko'rsatilgan. Qattiq muddat va dedlayn yo'q: kirish abadiy, materialni o'z sur'atingizda o'tasiz va kerak bo'lganda qaytasiz.",
    },
    {
      q: "Onlayn to'lash shartmi?",
      a: "Yo'q. Ariza qoldiring — biz bog'lanamiz, savollaringizga javob beramiz va qulay to'lov usulini aytamiz. To'lovdan so'ng administrator kirish va login beradi.",
    },
    {
      q: "Sertifikat beriladimi?",
      a: "Ha. Barcha darslar va yakuniy testdan so'ng noyob raqami va haqiqiyligini tekshirish sahifasi bo'lgan shaxsiy sertifikat olasiz.",
    },
    {
      q: "Telefondan o'qish mumkinmi?",
      a: "Ha, platforma birinchi navbatda smartfonga mo'ljallangan: video, konspekt, test va AI-trenajyor mobilda bir xil qulay.",
    },
    {
      q: "O'qish butun sotuv bo'limiga mos keladimi?",
      a: "Ha. Ariza qoldiring va jamoa tarkibi hamda vazifalarni yozing — bo'lim sohasiga mos dastur tanlaymiz va xodimlarga kirishni qanday tashkil qilishni aytamiz.",
    },
  ],
} as const satisfies CoursesPageContent;
