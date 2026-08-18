-- Реальные отзывы с карточек организации на Яндекс и Google Картах.
-- Перенесены вручную из выгрузки владельца (docs/отзывы yandex, docs/отзывы google):
-- автопарсинг карт нарушает условия площадок. Оценка не заполняется — в выгрузке
-- её нет, а выдумывать звёзды нельзя. id детерминированные, повторный запуск
-- миграции ничего не задваивает.

INSERT INTO "ExternalReview" ("id", "source", "author", "text", "rating", "url", "sortOrder", "published", "createdAt", "updatedAt")
VALUES ('exr_ya_01', 'YANDEX'::"ReviewSource", 'Тамара Корзей', 'Благодарю за информацию, знания и бесценный опыт, которым поделился на курсе "Эффективные продажи мебели" практикующий специалист Виталий Дубовик. Курс был информативным и хорошо организован. Материал, поданный согласно программе, был четким и легким для восприятия и понимания.', NULL, 'https://yandex.by/maps/org/ektiv_seylz/225492259144/reviews/', 1, true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ExternalReview" ("id", "source", "author", "text", "rating", "url", "sortOrder", "published", "createdAt", "updatedAt")
VALUES ('exr_ya_02', 'YANDEX'::"ReviewSource", 'Айсулу Карымова', 'Выражаю благодарность бизнес-школе ACTIVE SALES и лично Дубовик Виталию за проведенный тренинг по продажам для нашей команды!!!! Узнали много трендовых новых фишек , будем тестировать и применять все на практике !!! Обязательно повторим обучение в следующем сезоне', NULL, 'https://yandex.by/maps/org/ektiv_seylz/225492259144/reviews/', 2, true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ExternalReview" ("id", "source", "author", "text", "rating", "url", "sortOrder", "published", "createdAt", "updatedAt")
VALUES ('exr_ya_03', 'YANDEX'::"ReviewSource", 'Алексей П.', 'Очень крутой тренинг! Все проходило в игровом формате. Вся информация объяснялась легко и доступно. Виталий, спасибо! 🔥', NULL, 'https://yandex.by/maps/org/ektiv_seylz/225492259144/reviews/', 3, true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ExternalReview" ("id", "source", "author", "text", "rating", "url", "sortOrder", "published", "createdAt", "updatedAt")
VALUES ('exr_go_04', 'GOOGLE'::"ReviewSource", 'Валентина Кудласевич', 'Для меня это первый опыт участия в тренинге. Понравилось безусловно: много практических примеров, а не просто теория. Иногда информация шла слишком быстро, но доступно. Сложные вещи объясняли на пальцах — это большой плюс. Тренинг полезный, есть что добавить в свой опыт. Спасибо!»', NULL, 'https://www.google.com/maps/place/?q=place_id:ChIJazavO42_20YRvqrgGRfAW1k', 4, true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ExternalReview" ("id", "source", "author", "text", "rating", "url", "sortOrder", "published", "createdAt", "updatedAt")
VALUES ('exr_go_05', 'GOOGLE'::"ReviewSource", 'Алеся Кулеш', 'В целом, тренинг оказался очень полезным. Особенно ценным было то, что Виталий делился не только теоретическими знаниями, но и реальными кейсами из своей практики. Понравился интерактивный формат, было много практических заданий и работы в группах, что позволило сразу же применить полученные знания на практике.', NULL, 'https://www.google.com/maps/place/?q=place_id:ChIJazavO42_20YRvqrgGRfAW1k', 5, true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ExternalReview" ("id", "source", "author", "text", "rating", "url", "sortOrder", "published", "createdAt", "updatedAt")
VALUES ('exr_go_06', 'GOOGLE'::"ReviewSource", 'Екатерина Старченко', 'Очень хороший тренинг. Тренера большие молодцы! Все очень доступно, понятно, системно! Интересные упражнения. Подкачали свои навыки. Зарядились на работу.Время пролетело очень быстро. Рекомендую!', NULL, 'https://www.google.com/maps/place/?q=place_id:ChIJazavO42_20YRvqrgGRfAW1k', 6, true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ExternalReview" ("id", "source", "author", "text", "rating", "url", "sortOrder", "published", "createdAt", "updatedAt")
VALUES ('exr_go_07', 'GOOGLE'::"ReviewSource", 'BURBONSHOW', 'Проходили тренинг Кухни 2.0 у Виталия. Всё очень понравилось: тренер профессионал своего дела, подача материала максимально легкая и всё легко усваивается за счет удачного сочетания теории с практикой. Так же очень понравились ролевые игры аля "Продавец-Покупатель". Узнали много нового! Рекомендую!)', NULL, 'https://www.google.com/maps/place/?q=place_id:ChIJazavO42_20YRvqrgGRfAW1k', 7, true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ExternalReview" ("id", "source", "author", "text", "rating", "url", "sortOrder", "published", "createdAt", "updatedAt")
VALUES ('exr_go_08', 'GOOGLE'::"ReviewSource", 'Вебер Сергей', 'Прекрасный тренинг по продажам кухонь , нацеленный на эффективные продажи, с элементами направленными на понимание психологии покупателя. Всё было круто, Виталий профессионал способный многому научить даже опытных продавцов.', NULL, 'https://www.google.com/maps/place/?q=place_id:ChIJazavO42_20YRvqrgGRfAW1k', 8, true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ExternalReview" ("id", "source", "author", "text", "rating", "url", "sortOrder", "published", "createdAt", "updatedAt")
VALUES ('exr_go_09', 'GOOGLE'::"ReviewSource", 'Ольга Мальченко', 'Мы проходили тренинг по тайм-менеджменту у Виталия дубовика. Виталий настоящий профессионал! Разработал для нас индивидуальную программу, учел все пожелания, нашу специфику, быстро нашел подход к аудитории. Было очень полезно, активно, позитивно!', NULL, 'https://www.google.com/maps/place/?q=place_id:ChIJazavO42_20YRvqrgGRfAW1k', 9, true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ExternalReview" ("id", "source", "author", "text", "rating", "url", "sortOrder", "published", "createdAt", "updatedAt")
VALUES ('exr_go_10', 'GOOGLE'::"ReviewSource", 'AlvaLine Кухни на заказ в Витебске', 'Рекомендую тренинги продаж этой бизнес школы. Заказываем уже второй раз. Виталий отличный специалист, умеющий объяснить и научить. Много нового узнали, как наши новые сотрудники, так те, что уже проходили обучение ранее. Кроме самого тренинга, мы получили видео-курс и книгу продаж, которые не позволят забыть изученный материал.', NULL, 'https://www.google.com/maps/place/?q=place_id:ChIJazavO42_20YRvqrgGRfAW1k', 10, true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ExternalReview" ("id", "source", "author", "text", "rating", "url", "sortOrder", "published", "createdAt", "updatedAt")
VALUES ('exr_go_11', 'GOOGLE'::"ReviewSource", 'Алина Чистякова', 'Проходили с коллегами тренинг по Управлению персоналом. Виталию хочется сказать огромное спасибо! За три дня раскрыли и применили на практике самые "наболевшие" темы. Много практики, конструктивной обратной связи, обмена опытом. Подача материала очень крутая!', NULL, 'https://www.google.com/maps/place/?q=place_id:ChIJazavO42_20YRvqrgGRfAW1k', 11, true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ExternalReview" ("id", "source", "author", "text", "rating", "url", "sortOrder", "published", "createdAt", "updatedAt")
VALUES ('exr_go_12', 'GOOGLE'::"ReviewSource", 'SerProkopik', 'Сразу поставил 5 звёзд, т.к действительно хороший тренинг. Чувствуется опыт в продажах у Виталия, а это всегда зачёт. Спасибо за хорошую подачу информации! Продолжим работать!', NULL, 'https://www.google.com/maps/place/?q=place_id:ChIJazavO42_20YRvqrgGRfAW1k', 12, true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ExternalReview" ("id", "source", "author", "text", "rating", "url", "sortOrder", "published", "createdAt", "updatedAt")
VALUES ('exr_go_13', 'GOOGLE'::"ReviewSource", 'Natallia Morskaya', 'Была на тренинге по жестким переговорам. у Виталия. Очень редкая и ценная информация. Отлично подана, максимум живой информации и минимум сухой теории. Прекрасная атмосфера, а также приятный бонус в конце) Спасибо школе и спасибо Виталию за прекрасный тренинг!', NULL, 'https://www.google.com/maps/place/?q=place_id:ChIJazavO42_20YRvqrgGRfAW1k', 13, true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ExternalReview" ("id", "source", "author", "text", "rating", "url", "sortOrder", "published", "createdAt", "updatedAt")
VALUES ('exr_go_14', 'GOOGLE'::"ReviewSource", 'Татьяна Солодкая', 'Сотрудничеством довольны. Тренинги интересные, познавательные. Живое общение, а не сухое вещание. Обратная связь есть. Тренинги построены с учетом специфики клиента, пожелания были учтены. Уверена, что сотрудничество продолжим ;)', NULL, 'https://www.google.com/maps/place/?q=place_id:ChIJazavO42_20YRvqrgGRfAW1k', 14, true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ExternalReview" ("id", "source", "author", "text", "rating", "url", "sortOrder", "published", "createdAt", "updatedAt")
VALUES ('exr_go_15', 'GOOGLE'::"ReviewSource", 'Алеся Примшиц', 'Виталий, спасибо за тренинг! Вся информация подавалась профессионально и интересно. Много юмора и жизненных примеров, сделали тренинг живым и нетривиальным. Успехов Вам Виталий и Вашей школе @activesales', NULL, 'https://www.google.com/maps/place/?q=place_id:ChIJazavO42_20YRvqrgGRfAW1k', 15, true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ExternalReview" ("id", "source", "author", "text", "rating", "url", "sortOrder", "published", "createdAt", "updatedAt")
VALUES ('exr_go_16', 'GOOGLE'::"ReviewSource", 'Daniil Ozimko', 'Не первый раз прохожу тренинг у Виталия, и как всегда он порадовал новыми интересными подходами и техниками. Спасибо за очередной интересный тренинг!', NULL, 'https://www.google.com/maps/place/?q=place_id:ChIJazavO42_20YRvqrgGRfAW1k', 16, true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ExternalReview" ("id", "source", "author", "text", "rating", "url", "sortOrder", "published", "createdAt", "updatedAt")
VALUES ('exr_go_17', 'GOOGLE'::"ReviewSource", 'Алена Терешко', 'Была слушателем у Виталия. Подача информации отличная, четко, с примерами. На все возникающие вопросы давались четкие ответы, были разбопы ситуаций. Осталась очень довольна. Рекомендую.', NULL, 'https://www.google.com/maps/place/?q=place_id:ChIJazavO42_20YRvqrgGRfAW1k', 17, true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ExternalReview" ("id", "source", "author", "text", "rating", "url", "sortOrder", "published", "createdAt", "updatedAt")
VALUES ('exr_go_18', 'GOOGLE'::"ReviewSource", 'Надежда Шпакович', 'Виталий, спасибо вам огромное за новые знания, за хорошие впечатления да и за проведенное время. Знания получили, впитали, практиковали и будем применять на своих продажах!!!!', NULL, 'https://www.google.com/maps/place/?q=place_id:ChIJazavO42_20YRvqrgGRfAW1k', 18, true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ExternalReview" ("id", "source", "author", "text", "rating", "url", "sortOrder", "published", "createdAt", "updatedAt")
VALUES ('exr_go_19', 'GOOGLE'::"ReviewSource", 'Марина Замулко', 'Была на тренинге по тайм-менеджменту. Живо, активно, позитивно, полезно. Рекомендую!', NULL, 'https://www.google.com/maps/place/?q=place_id:ChIJazavO42_20YRvqrgGRfAW1k', 19, true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;
