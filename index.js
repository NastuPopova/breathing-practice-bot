// Файл: semi-auto-telegram-bot.js
// Простой бот для обработки заказов без прямой интеграции с платежными системами

const { Telegraf, Markup } = require('telegraf');
require('dotenv').config(); // Для загрузки переменных окружения

// Создание бота с токеном от BotFather
const bot = new Telegraf(process.env.BOT_TOKEN);

// ID администратора (ваш Telegram ID)
const ADMIN_ID = process.env.ADMIN_ID;

// Данные продуктов
const products = {
  'starter': {
    id: 'starter',
    name: 'Стартовый комплект дыхательных практик',
    price: '990 ₽',
    description: 'Видеоурок (20 минут) с базовыми техниками + PDF-инструкция + бонусные материалы',
    pdfFile: 'files/starter-kit-guide.pdf',
    videoLink: 'https://yourvideo.com/starter'
  },
  'consultation': {
    id: 'consultation',
    name: 'Индивидуальная консультация',
    price: '1500 ₽',
    description: 'Персональная 40-минутная консультация + разбор вашей техники дыхания',
    pdfFile: 'files/consultation-guide.pdf',
    videoLink: 'https://yourvideo.com/consultation-intro'
  },
  'course': {
    id: 'course',
    name: 'Полный курс видеоуроков',
    price: '14 999 ₽',
    description: '4 модуля с видеоуроками + персональные занятия + доступ к сообществу',
    pdfFile: 'files/full-course-guide.pdf',
    videoLink: 'https://yourvideo.com/course-intro'
  }
};

// Хранение текущих заказов
const pendingOrders = {};
const completedOrders = {};

// Приветственное сообщение
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  
  await ctx.reply(
    `👋 Приветствую, ${ctx.from.first_name}!\n\nЯ бот Анастасии Поповой, инструктора по дыхательным практикам. Через меня вы можете приобрести курсы и получить материалы.\n\nЧем могу помочь?`,
    Markup.keyboard([
      ['🛒 Купить курс', '❓ Информация'],
      ['📝 Мои покупки', '☎️ Связаться с преподавателем']
    ]).resize()
  );

  // Уведомление администратору о новом пользователе
  if (userId !== parseInt(ADMIN_ID)) {
    await bot.telegram.sendMessage(
      ADMIN_ID,
      `🆕 Новый пользователь:\n- Имя: ${ctx.from.first_name} ${ctx.from.last_name || ''}\n- Username: @${ctx.from.username || 'отсутствует'}\n- ID: ${userId}`
    );
  }
});

// Обработчик кнопки "Купить курс"
bot.hears('🛒 Купить курс', async (ctx) => {
  await ctx.reply(
    '📚 Выберите продукт:',
    Markup.inlineKeyboard([
      [Markup.button.callback('🔰 Стартовый комплект - 990 ₽', 'buy_starter')],
      [Markup.button.callback('👥 Индивидуальная консультация - 1500 ₽', 'buy_consultation')],
      [Markup.button.callback('🏆 Полный курс видеоуроков - 14 999 ₽', 'buy_course')]
    ])
  );
});

// Обработчики для покупки различных продуктов
bot.action(/buy_(.+)/, async (ctx) => {
  const productId = ctx.match[1];
  const userId = ctx.from.id;
  const product = products[productId];
  
  if (!product) {
    return await ctx.reply('❌ Продукт не найден. Пожалуйста, выберите из доступных вариантов.');
  }

  // Запрос контактной информации
  await ctx.reply(
    `📋 Вы выбрали: *${product.name}*\n\nДля оформления заказа, пожалуйста, введите ваш email.\n\nПример: email@example.com`,
    { parse_mode: 'Markdown' }
  );
  
  // Сохраняем информацию о выбранном продукте
  pendingOrders[userId] = {
    productId,
    status: 'waiting_email',
    timestamp: new Date().toISOString()
  };
  
  await ctx.answerCbQuery();
});

// Обработчик для получения email
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text;
  
  // Игнорируем команды и кнопки главного меню
  if (text.startsWith('/') || 
      ['🛒 Купить курс', '❓ Информация', '📝 Мои покупки', '☎️ Связаться с преподавателем'].includes(text)) {
    return;
  }
  
  // Проверяем, есть ли ожидающий заказ
  if (pendingOrders[userId] && pendingOrders[userId].status === 'waiting_email') {
    // Проверка формата email (простая)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(text)) {
      return await ctx.reply('❌ Пожалуйста, введите корректный email адрес.');
    }
    
    // Сохраняем email
    pendingOrders[userId].email = text;
    pendingOrders[userId].status = 'waiting_phone';
    
    // Запрашиваем номер телефона
    await ctx.reply(
      '📱 Теперь, пожалуйста, введите ваш номер телефона для связи.\n\nПример: +7XXXXXXXXXX'
    );
  } 
  // Проверяем, ожидается ли номер телефона
  else if (pendingOrders[userId] && pendingOrders[userId].status === 'waiting_phone') {
    // Проверка формата телефона (простая)
    const phoneRegex = /^\+?[0-9]{10,15}$/;
    if (!phoneRegex.test(text.replace(/\s+/g, ''))) {
      return await ctx.reply('❌ Пожалуйста, введите корректный номер телефона.');
    }
    
    // Сохраняем телефон и обновляем статус
    pendingOrders[userId].phone = text;
    pendingOrders[userId].status = 'waiting_payment';
    
    const product = products[pendingOrders[userId].productId];
    
    // Отправляем инструкции по оплате
    await ctx.reply(
      `✅ Спасибо! Ваш заказ почти готов.\n\n*${product.name}*\nСтоимость: *${product.price}*\n\nОжидайте информацию об оплате от Анастасии в ближайшее время.`,
      { parse_mode: 'Markdown' }
    );
    
    // Отправляем уведомление администратору
    await notifyAdmin(userId);
  }
  // Обработка сообщений для администратора (проверяем, является ли отправитель админом)
  else if (userId.toString() === ADMIN_ID.toString()) {
    // Проверяем, является ли сообщение командой подтверждения оплаты
    const paymentConfirmRegex = /^\/confirm_(\d+)$/;
    const match = text.match(paymentConfirmRegex);
    
    if (match) {
      const clientId = match[1];
      // Обрабатываем подтверждение оплаты
      await confirmPayment(clientId);
    }
  }
});

// Отправка уведомления администратору о новом заказе
async function notifyAdmin(userId) {
  const order = pendingOrders[userId];
  const product = products[order.productId];
  const user = await bot.telegram.getChat(userId);
  
  // Формируем сообщение для админа
  const message = `
🔔 *НОВЫЙ ЗАКАЗ*
  
📦 Продукт: *${product.name}*
💰 Цена: *${product.price}*
  
👤 Клиент: ${user.first_name} ${user.last_name || ''}
🆔 ID: \`${userId}\`
📧 Email: ${order.email}
📱 Телефон: ${order.phone}
🕒 Время заказа: ${new Date().toLocaleString()}
  
Для подтверждения оплаты используйте команду:
\`/confirm_${userId}\`
`;
  
  // Отправляем сообщение администратору
  await bot.telegram.sendMessage(ADMIN_ID, message, { 
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ Подтвердить оплату', callback_data: `confirm_payment_${userId}` }],
        [{ text: '❌ Отменить заказ', callback_data: `cancel_order_${userId}` }],
        [{ text: '💬 Написать клиенту', callback_data: `message_client_${userId}` }]
      ]
    }
  });
}

// Обработчик подтверждения оплаты через кнопку
bot.action(/confirm_payment_(\d+)/, async (ctx) => {
  const clientId = ctx.match[1];
  await confirmPayment(clientId);
  await ctx.answerCbQuery('✅ Оплата подтверждена. Материалы отправлены клиенту.');
});

// Обработчик отмены заказа
bot.action(/cancel_order_(\d+)/, async (ctx) => {
  const clientId = ctx.match[1];
  
  if (pendingOrders[clientId]) {
    const product = products[pendingOrders[clientId].productId];
    
    // Уведомляем клиента
    await bot.telegram.sendMessage(
      clientId,
      `❌ Ваш заказ "${product.name}" был отменен.\n\nЕсли у вас возникли вопросы, пожалуйста, свяжитесь с Анастасией.`
    );
    
    // Удаляем заказ из ожидающих
    delete pendingOrders[clientId];
    
    await ctx.reply(`✅ Заказ клиента ${clientId} отменен.`);
  } else {
    await ctx.reply('❌ Заказ не найден.');
  }
  
  await ctx.answerCbQuery();
});

// Обработчик для отправки сообщения клиенту
bot.action(/message_client_(\d+)/, async (ctx) => {
  const clientId = ctx.match[1];
  
  await ctx.reply(
    `✏️ Введите сообщение для клиента ID: ${clientId}\n\nФормат:\n/msg_${clientId} Текст сообщения`
  );
  
  await ctx.answerCbQuery();
});

// Обработчик для отправки сообщения клиенту
bot.hears(/^\/msg_(\d+) (.+)$/, async (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID.toString()) return;
  
  const clientId = ctx.match[1];
  const message = ctx.match[2];
  
  try {
    await bot.telegram.sendMessage(
      clientId,
      `📬 *Сообщение от Анастасии*:\n\n${message}`,
      { parse_mode: 'Markdown' }
    );
    
    await ctx.reply('✅ Сообщение успешно отправлено клиенту.');
  } catch (error) {
    await ctx.reply(`❌ Ошибка при отправке сообщения: ${error.message}`);
  }
});

// Функция подтверждения оплаты и отправки материалов
async function confirmPayment(clientId) {
  const order = pendingOrders[clientId];
  
  if (!order) {
    await bot.telegram.sendMessage(ADMIN_ID, '❌ Заказ не найден.');
    return;
  }
  
  const product = products[order.productId];
  
  try {
    // Отправляем сообщение пользователю о подтверждении
    await bot.telegram.sendMessage(
      clientId,
      `🎉 *Оплата подтверждена!*\n\nСпасибо за покупку "*${product.name}*". Ваши материалы будут отправлены через несколько секунд.`,
      { parse_mode: 'Markdown' }
    );
    
    // Отправляем PDF-инструкции через 5 секунд
    setTimeout(async () => {
      try {
        await bot.telegram.sendDocument(
          clientId,
          { source: product.pdfFile },
          { 
            caption: '📚 Вот ваша PDF-инструкция по дыхательным практикам.\n\nСохраните ее для удобного доступа в любое время!' 
          }
        );
      } catch (error) {
        console.error(`Error sending PDF: ${error.message}`);
        await bot.telegram.sendMessage(
          clientId,
          '❗ Возникла проблема при отправке PDF. Пожалуйста, напишите нам, и мы решим эту проблему.'
        );
        await bot.telegram.sendMessage(ADMIN_ID, `❌ Ошибка при отправке PDF: ${error.message}`);
      }
    }, 5000);
    
    // Отправляем видеоурок через 10 секунд
    setTimeout(async () => {
      await bot.telegram.sendMessage(
        clientId,
        `🎬 *Ваш видеоурок готов к просмотру!*\
