// Файл: data.js
// Данные о продуктах и шаблоны сообщений

// Данные продуктов
const products = {
  'starter': {
    id: 'starter',
    name: 'Стартовый комплект дыхательных практик',
    price: '990 ₽',
    description: 'Видеоурок (40 минут) с базовыми техниками + PDF-инструкция + бонусные материалы',
    fullDescription: `<b>🔰 Стартовый комплект дыхательных практик</b>

<b>Для кого:</b> Базовый набор для начинающих

<b>Что входит:</b>
• Видеоурок длительностью 40 минут
• PDF-инструкция для самостоятельной практики
• Мгновенный доступ после оплаты

<b>Бонусы:</b>
• Урок по замеру контрольной паузы
• Аудиозапись для медитативного дыхания (15 минут)

<b>Стоимость:</b> <b>990 ₽</b> (вместо 2600 ₽)`,
    pdfFile: 'files/starter-kit-guide.pdf',
    videoLink: 'https://rutube.ru/video/private/ee9b54060c99464e3b283beab77e9c68/?p=l2hPoyjux4Q8SHJnv7x4Sg',
    // Предподготовленные сообщения для ускорения
    productInfo: '<b>Стартовый комплект дыхательных практик</b>\n\nВидеоурок (40 минут) с базовыми техниками + PDF-инструкция + бонусные материалы\n\nЦена: <b>990 ₽</b>'
  },
  'individual': {
    id: 'individual',
    name: 'Индивидуальное занятие',
    price: '2 000 ₽',
    description: 'Персональное 60-минутное занятие с разбором вашей техники дыхания и индивидуальными рекомендациями',
    fullDescription: `<b>👤 Индивидуальные консультации</b>

<b>Для кого:</b> Для тех, кто хочет разобрать свою технику и получить персональные рекомендации

<b>Что входит:</b>
• 1 консультации 60 минут
• Разбор вашей техники дыхания
• Работа с вашими запросами
• Видеозапись консультаций для повторного просмотра

<b>Бонус:</b>
• Бесплатный краткий анализ вашего дыхания перед первой консультацией

<b>Стоимость:</b> <b>2 000 ₽</b> (вместо 2 500 ₽)`,
    pdfFile: 'files/individual-session-guide.pdf',
    videoLink: 'https://yourvideo.com/individual',
    // Предподготовленные сообщения для ускорения
    productInfo: '<b>Индивидуальное занятие</b>\n\nПерсональное 60-минутное занятие с разбором вашей техники дыхания и индивидуальными рекомендациями\n\nЦена: <b>2 000 ₽</b>'
  },
  'package': {
    id: 'package',
    name: 'Пакет из 3-х индивидуальных занятий',
    price: '4500 ₽',
    description: 'Три персональных 45-минутных занятия + бесплатный доступ к базовым видеоурокам + индивидуальная программа тренировок',
    fullDescription: `<b>🎯 Пакет из 3-х индивидуальных занятий</b>

<b>Для кого:</b> Для тех, кто хочет достичь устойчивых результатов и получить полноценную программу

<b>Что входит:</b>
• 3 персональных 45-минутных занятия
• Оценка состояния дыхания
• Индивидуальная программа тренировок
• Видеозаписи всех занятий

<b>Преимущества:</b>
• Экономия 1500 ₽ по сравнению с покупкой отдельных занятий
• Возможность распределить занятия в течение 1 месяца
• Отслеживание прогресса с корректировкой программы

<b>Стоимость:</b> <b>4500 ₽</b> (экономия 1500 ₽!)`,
    pdfFile: 'files/package-sessions-guide.pdf',
    videoLink: 'https://yourvideo.com/package',
    // Предподготовленные сообщения для ускорения
    productInfo: '<b>Пакет из 3-х индивидуальных занятий</b>\n\nТри персональных 45-минутных занятия + Видеозаписи всех занятий + индивидуальная программа тренировок\n\nЦена: <b>4500 ₽</b> (экономия 1500 ₽!)'
  },
  'course': {
    id: 'course',
    name: 'Полный курс видеоуроков',
    price: '14 999 ₽',
    description: '4 модуля с видеоуроками + персональные занятия + доступ к сообществу',
    fullDescription: `<b>🏆 Полный курс видеоуроков</b>

<b>Для кого:</b> Для тех, кто хочет комплексно освоить дыхательные практики и добиться максимальных результатов

<b>Что входит:</b>
• 4 модуля с видеоуроками общей продолжительностью более 8 часов
• Комплексное обучение с записями всех уроков
• Доступ к закрытому сообществу практикующих
• 2 бесплатные персональные консультации

<b>Модули курса:</b>
• Модуль 1: Основы дыхания - изучение базовых принципов правильного дыхания
• Модуль 2: Оздоравливающие практики - техники для профилактики более 100 заболеваний
• Модуль 3: Энергетические практики - методы для повышения энергии и работоспособности
• Модуль 4: Правильные привычки - интеграция техник в повседневную жизнь

<b>Бонус:</b>
• Урок по дыхательным практикам для детей

<b>Стоимость:</b> <b>14 999 ₽</b>`,
    pdfFile: 'files/full-course-guide.pdf',
    videoLink: 'https://yourvideo.com/course-intro',
    // Предподготовленные сообщения для ускорения
    productInfo: '<b>Полный курс видеоуроков</b>\n\n4 модуля с видеоуроками + персональные занятия + доступ к сообществу\n\nЦена: <b>14 999 ₽</b>'
  }
};

// Общие шаблоны сообщений для переиспользования
const messageTemplates = {
  welcome: (firstName) => `👋 Приветствую, ${firstName}!\n\nЯ бот Анастасии Поповой, инструктора по дыхательным практикам. Через меня вы можете приобрести курсы и получить материалы.\n\nЧем могу помочь?`,
  emailRequest: (productName) => `📋 Вы выбрали: *${productName}*\n\nДля оформления заказа, пожалуйста, введите ваш email.\n\nПример: email@example.com`,
  phoneRequest: '📱 Теперь, пожалуйста, введите ваш номер телефона для связи.\n\nПример: +7XXXXXXXXXX',
  orderComplete: `📌 *Важная информация*:\n\n• Материалы доступны без ограничений по времени\n• При возникновении вопросов пишите прямо в этот чат\n• Для максимальной пользы рекомендуем заниматься в спокойной обстановке\n\nВсего доброго! 🙏`,
  noPurchases: 'У вас пока нет завершенных покупок. Выберите "🛒 Купить курс", чтобы приобрести материалы.',
  paymentConfirmed: (productName) => `🎉 *Оплата подтверждена!*\n\nСпасибо за покупку "*${productName}*". Ваши материалы будут отправлены через несколько секунд.`,
  errorMessage: 'Произошла ошибка. Пожалуйста, попробуйте позже или свяжитесь с нами напрямую.',
  emailInvalid: '❌ Пожалуйста, введите корректный email адрес.',
  phoneInvalid: '❌ Пожалуйста, введите корректный номер телефона.',
  orderReady: (productName, price) => `✅ Спасибо! Ваш заказ почти готов.\n\n*${productName}*\nСтоимость: *${price}*\n\nОжидайте информацию об оплате от Анастасии в ближайшее время.`
};

module.exports = {
  products,
  messageTemplates
};
