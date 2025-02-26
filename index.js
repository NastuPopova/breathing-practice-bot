// Файл: semi-auto-telegram-bot.js
// Оптимизированный полуавтоматический бот для обработки заказов курсов

const { Telegraf, Markup } = require('telegraf');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

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
// Изменено: хранение завершенных заказов как массивов для каждого пользователя
const completedOrders = {};

// Функция для создания основной клавиатуры
function mainKeyboard() {
  return Markup.keyboard([
    ['🛒 Купить курс', '❓ Информация'],
    ['📝 Мои покупки', '☎️ Связаться с преподавателем']
  ]).resize();
}

// Функция для проверки существования файла
function fileExists(filePath) {
  return new Promise(resolve => {
    fs.access(filePath, fs.constants.F_OK, err => {
      resolve(!err);
    });
  });
}

// Функция логирования с датой и временем
function logWithTime(message) {
  const now = new Date().toISOString();
  console.log(`[${now}] ${message}`);
}

// Приветственное сообщение
bot.start(async (ctx) => {
  try {
    const userId = ctx.from.id;
    
    await ctx.reply(
      `👋 Приветствую, ${ctx.from.first_name}!\n\nЯ бот Анастасии Поповой, инструктора по дыхательным практикам. Через меня вы можете приобрести курсы и получить материалы.\n\nЧем могу помочь?`,
      mainKeyboard()
    );

    // Уведомление администратору о новом пользователе
    if (userId !== parseInt(ADMIN_ID)) {
      await bot.telegram.sendMessage(
        ADMIN_ID,
        `🆕 Новый пользователь:\n- Имя: ${ctx.from.first_name} ${ctx.from.last_name || ''}\n- Username: @${ctx.from.username || 'отсутствует'}\n- ID: ${userId}`
      );
    }
    
    logWithTime(`Новый пользователь: ${userId}, ${ctx.from.username || 'без username'}`);
  } catch (error) {
    console.error(`Ошибка в обработчике /start: ${error.message}`);
  }
});

// Обработчик кнопки "Купить курс"
bot.hears('🛒 Купить курс', async (ctx) => {
  try {
    await ctx.reply(
      '📚 Выберите продукт:',
      Markup.inlineKeyboard([
        [Markup.button.callback('🔰 Стартовый комплект - 990 ₽', 'buy_starter')],
        [Markup.button.callback('👥 Индивидуальная консультация - 1500 ₽', 'buy_consultation')],
        [Markup.button.callback('🏆 Полный курс видеоуроков - 14 999 ₽', 'buy_course')]
      ])
    );
    
    logWithTime(`Пользователь ${ctx.from.id} открыл меню выбора продукта`);
  } catch (error) {
    console.error(`Ошибка в обработчике "Купить курс": ${error.message}`);
  }
});

// Обработчики для покупки различных продуктов
bot.action(/buy_(.+)/, async (ctx) => {
  try {
    const productId = ctx.match[1];
    const userId = ctx.from.id;
    const product = products[productId];
    
    if (!product) {
      await ctx.reply('❌ Продукт не найден. Пожалуйста, выберите из доступных вариантов.');
      return await ctx.answerCbQuery();
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
    
    logWithTime(`Пользователь ${userId} выбрал продукт: ${product.name}`);
    await ctx.answerCbQuery();
  } catch (error) {
    console.error(`Ошибка при выборе продукта: ${error.message}`);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте еще раз.');
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

// Обработчик для получения email
bot.on('text', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const text = ctx.message.text;
    
    // Игнорируем команды и кнопки главного меню
    if (text.startsWith('/') || 
        ['🛒 Купить курс', '❓ Информация', '📝 Мои покупки', '☎️ Связаться с преподавателем'].includes(text)) {
      return;
    }
    
    // Обработка email
    if (pendingOrders[userId] && pendingOrders[userId].status === 'waiting_email') {
      // Проверка формата email
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
      
      logWithTime(`Пользователь ${userId} ввел email: ${text}`);
    } 
    // Обработка номера телефона
    else if (pendingOrders[userId] && pendingOrders[userId].status === 'waiting_phone') {
      // Проверка формата телефона
      const phoneRegex = /^\+?[0-9]{10,15}$/;
      const cleanedPhone = text.replace(/\s+/g, '');
      
      if (!phoneRegex.test(cleanedPhone)) {
        return await ctx.reply('❌ Пожалуйста, введите корректный номер телефона.');
      }
      
      // Сохраняем телефон и обновляем статус
      pendingOrders[userId].phone = cleanedPhone;
      pendingOrders[userId].status = 'waiting_payment';
      
      const product = products[pendingOrders[userId].productId];
      
      // Отправляем инструкции по оплате
      await ctx.reply(
        `✅ Спасибо! Ваш заказ почти готов.\n\n*${product.name}*\nСтоимость: *${product.price}*\n\nОжидайте информацию об оплате от Анастасии в ближайшее время.`,
        { parse_mode: 'Markdown', ...mainKeyboard() }
      );
      
      logWithTime(`Пользователь ${userId} ввел телефон: ${cleanedPhone}`);
      
      // Отправляем уведомление администратору
      await notifyAdmin(userId);
    }
  } catch (error) {
    console.error(`Ошибка при обработке текстового сообщения: ${error.message}`);
  }
});

// Отдельный обработчик для команд администратора
bot.hears(/^\/confirm_(\d+)$/, async (ctx) => {
  try {
    if (ctx.from.id.toString() !== ADMIN_ID.toString()) {
      return;
    }
    
    const clientId = ctx.match[1];
    await confirmPayment(clientId);
    
    logWithTime(`Администратор подтвердил оплату для пользователя ${clientId}`);
  } catch (error) {
    console.error(`Ошибка при подтверждении оплаты: ${error.message}`);
    await ctx.reply(`❌ Ошибка: ${error.message}`);
  }
});

// Отправка уведомления администратору о новом заказе
async function notifyAdmin(userId) {
  try {
    const order = pendingOrders[userId];
    const product = products[order.productId];
    
    // Более безопасное получение информации о пользователе
    let userInfo = { first_name: 'Пользователь', last_name: '' };
    try {
      userInfo = await bot.telegram.getChat(userId);
    } catch (error) {
      console.error(`Не удалось получить информацию о пользователе ${userId}: ${error.message}`);
    }
    
    // Формируем сообщение для админа
    const message = `
🔔 *НОВЫЙ ЗАКАЗ*
  
📦 Продукт: *${product.name}*
💰 Цена: *${product.price}*
  
👤 Клиент: ${userInfo.first_name} ${userInfo.last_name || ''}
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
    
    logWithTime(`Отправлено уведомление администратору о заказе пользователя ${userId}`);
  } catch (error) {
    console.error(`Ошибка при отправке уведомления администратору: ${error.message}`);
  }
}

// Обработчик подтверждения оплаты через кнопку
bot.action(/confirm_payment_(\d+)/, async (ctx) => {
  try {
    // Проверка прав администратора
    if (ctx.from.id.toString() !== ADMIN_ID.toString()) {
      return await ctx.answerCbQuery('⛔ У вас нет доступа к этой функции');
    }
    
    const clientId = ctx.match[1];
    await confirmPayment(clientId);
    await ctx.answerCbQuery('✅ Оплата подтверждена. Материалы отправлены клиенту.');
    
    logWithTime(`Администратор подтвердил оплату через кнопку для пользователя ${clientId}`);
  } catch (error) {
    console.error(`Ошибка при подтверждении оплаты через кнопку: ${error.message}`);
    await ctx.answerCbQuery(`❌ Ошибка: ${error.message.substring(0, 50)}`);
  }
});

// Обработчик отмены заказа
bot.action(/cancel_order_(\d+)/, async (ctx) => {
  try {
    // Проверка прав администратора
    if (ctx.from.id.toString() !== ADMIN_ID.toString()) {
      return await ctx.answerCbQuery('⛔ У вас нет доступа к этой функции');
    }
    
    const clientId = ctx.match[1];
    
    if (pendingOrders[clientId]) {
      const product = products[pendingOrders[clientId].productId];
      
      // Уведомляем клиента
      await bot.telegram.sendMessage(
        clientId,
        `❌ Ваш заказ "${product.name}" был отменен.\n\nЕсли у вас возникли вопросы, пожалуйста, свяжитесь с Анастасией.`,
        mainKeyboard()
      );
      
      // Удаляем заказ из ожидающих
      delete pendingOrders[clientId];
      
      await ctx.reply(`✅ Заказ клиента ${clientId} отменен.`);
      logWithTime(`Заказ пользователя ${clientId} отменен администратором`);
    } else {
      await ctx.reply('❌ Заказ не найден.');
    }
    
    await ctx.answerCbQuery();
  } catch (error) {
    console.error(`Ошибка при отмене заказа: ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

// Обработчик для отправки сообщения клиенту
bot.action(/message_client_(\d+)/, async (ctx) => {
  try {
    // Проверка прав администратора
    if (ctx.from.id.toString() !== ADMIN_ID.toString()) {
      return await ctx.answerCbQuery('⛔ У вас нет доступа к этой функции');
    }
    
    const clientId = ctx.match[1];
    
    await ctx.reply(
      `✏️ Введите сообщение для клиента ID: ${clientId}\n\nФормат:\n/msg_${clientId} Текст сообщения`
    );
    
    await ctx.answerCbQuery();
  } catch (error) {
    console.error(`Ошибка при подготовке сообщения клиенту: ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

// Обработчик для отправки сообщения клиенту
bot.hears(/^\/msg_(\d+) (.+)$/, async (ctx) => {
  try {
    // Проверка прав администратора
    if (ctx.from.id.toString() !== ADMIN_ID.toString()) {
      return;
    }
    
    const clientId = ctx.match[1];
    const message = ctx.match[2];
    
    await bot.telegram.sendMessage(
      clientId,
      `📬 *Сообщение от Анастасии*:\n\n${message}`,
      { parse_mode: 'Markdown' }
    );
    
    await ctx.reply('✅ Сообщение успешно отправлено клиенту.');
    logWithTime(`Администратор отправил сообщение пользователю ${clientId}`);
  } catch (error) {
    console.error(`Ошибка при отправке сообщения клиенту: ${error.message}`);
    await ctx.reply(`❌ Ошибка при отправке сообщения: ${error.message}`);
  }
});

// Функция подтверждения оплаты и отправки материалов
async function confirmPayment(clientId) {
  try {
    const order = pendingOrders[clientId];
    
    if (!order) {
      await bot.telegram.sendMessage(ADMIN_ID, '❌ Заказ не найден.');
      return;
    }
    
    const product = products[order.productId];
    
    // Отправляем сообщение пользователю о подтверждении
    await bot.telegram.sendMessage(
      clientId,
      `🎉 *Оплата подтверждена!*\n\nСпасибо за покупку "*${product.name}*". Ваши материалы будут отправлены через несколько секунд.`,
      { parse_mode: 'Markdown' }
    );
    
    // Отправляем PDF-инструкции через 5 секунд
    setTimeout(async () => {
      try {
        // Проверка существования файла
        const filePathExists = await fileExists(product.pdfFile);
        
        if (filePathExists) {
          await bot.telegram.sendDocument(
            clientId,
            { source: product.pdfFile },
            { 
              caption: '📚 Вот ваша PDF-инструкция по дыхательным практикам.\n\nСохраните ее для удобного доступа в любое время!' 
            }
          );
          logWithTime(`PDF отправлен пользователю ${clientId}`);
        } else {
          console.error(`PDF файл не найден: ${product.pdfFile}`);
          await bot.telegram.sendMessage(
            clientId,
            '❗ Возникла проблема при отправке PDF. Пожалуйста, напишите нам, и мы решим эту проблему.'
          );
          await bot.telegram.sendMessage(
            ADMIN_ID, 
            `❌ Ошибка: файл ${product.pdfFile} не найден`
          );
        }
      } catch (error) {
        console.error(`Error sending PDF: ${error.message}`);
        await bot.telegram.sendMessage(
          clientId,
          '❗ Возникла проблема при отправке PDF. Пожалуйста, напишите нам, и мы решим эту проблему.'
        );
        await bot.telegram.sendMessage(
          ADMIN_ID, 
          `❌ Ошибка при отправке PDF: ${error.message}`
        );
      }
    }, 5000);
    
    // Отправляем видеоурок через 10 секунд
    setTimeout(async () => {
      try {
        await bot.telegram.sendMessage(
          clientId,
          `🎬 *Ваш видеоурок готов к просмотру!*\n\n${product.description}\n\n🔗 *Ссылка на видео*: ${product.videoLink}\n\nПриятного обучения!`,
          {
            parse_mode: 'Markdown',
            disable_web_page_preview: false,
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎬 Смотреть видеоурок', url: product.videoLink }]
              ]
            }
          }
        );
        
        logWithTime(`Видеоурок отправлен пользователю ${clientId}`);
        
        // Отправляем дополнительную информацию
        setTimeout(async () => {
          await bot.telegram.sendMessage(
            clientId,
            `📌 *Важная информация*:\n\n• Видео доступно без ограничений по времени\n• При возникновении вопросов пишите прямо в этот чат\n• Для максимальной пользы рекомендуем смотреть видео в спокойной обстановке\n\nВсего доброго! 🙏`,
            { parse_mode: 'Markdown' }
          );
        }, 5000);
      } catch (error) {
        console.error(`Ошибка при отправке видеоурока: ${error.message}`);
        await bot.telegram.sendMessage(
          ADMIN_ID, 
          `❌ Ошибка при отправке видеоурока: ${error.message}`
        );
      }
    }, 10000);
    
    // Инициализируем массив заказов для пользователя, если его еще нет
    if (!completedOrders[clientId]) {
      completedOrders[clientId] = [];
    }
    
    // Добавляем заказ в историю завершенных
    completedOrders[clientId].push({
      ...order,
      completedAt: new Date().toISOString(),
      status: 'completed'
    });
    
    delete pendingOrders[clientId];
    
    // Уведомляем админа
    await bot.telegram.sendMessage(
      ADMIN_ID,
      `✅ Материалы успешно отправлены клиенту (ID: ${clientId}).\nПродукт: ${product.name}`
    );
    
    logWithTime(`Заказ пользователя ${clientId} завершен успешно`);
  } catch (error) {
    console.error(`Error in confirmPayment: ${error.message}`);
    await bot.telegram.sendMessage(
      ADMIN_ID,
      `❌ Ошибка при обработке подтверждения: ${error.message}`
    );
  }
}

// Обработчик для просмотра покупок пользователем
bot.hears('📝 Мои покупки', async (ctx) => {
  try {
    const userId = ctx.from.id;
    
    // Проверяем, есть ли у пользователя завершенные заказы
    if (completedOrders[userId] && completedOrders[userId].length > 0) {
      let message = '🛍 *Ваши покупки*:\n\n';
      
      completedOrders[userId].forEach((order, index) => {
        const product = products[order.productId];
        const date = new Date(order.completedAt).toLocaleDateString();
        
        message += `${index + 1}. *${product.name}*\n   Дата: ${date}\n   Статус: ✅ Оплачено\n\n`;
      });
      
      message += 'Если вам нужны повторно какие-то материалы, просто напишите в чат.';
      
      await ctx.reply(message, { parse_mode: 'Markdown' });
      logWithTime(`Пользователь ${userId} просмотрел свои покупки`);
    } else {
      await ctx.reply('У вас пока нет завершенных покупок. Выберите "🛒 Купить курс", чтобы приобрести материалы.');
    }
  } catch (error) {
    console.error(`Ошибка при просмотре покупок: ${error.message}`);
    await ctx.reply('Произошла ошибка при загрузке ваших покупок. Пожалуйста, попробуйте позже.');
  }
});

// Обработчик для кнопки "Связаться с преподавателем"
bot.hears('☎️ Связаться с преподавателем', async (ctx) => {
  try {
    await ctx.reply(
      `👩‍🏫 *Анастасия Попова*\n\nЕсли у вас возникли вопросы о курсах, дыхательных практиках или вы хотите получить персональную консультацию, напишите мне напрямую.\n\nЯ отвечаю в течение 24 часов в рабочие дни.`,
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✉️ Написать преподавателю', url: 'https://t.me/NastuPopova' }]
          ]
        }
      }
    );
    
    logWithTime(`Пользователь ${ctx.from.id} нажал "Связаться с преподавателем"`);
  } catch (error) {
    console.error(`Ошибка при обработке "Связаться с преподавателем": ${error.message}`);
  }
});
  
// Обработчик информации
bot.hears('❓ Информация', async (ctx) => {
  try {
    await ctx.reply(
      `ℹ️ *О курсах дыхательных практик*\n\n*Анастасия Попова* - сертифицированный инструктор по дыхательным практикам с опытом более 7 лет.\n\nНаши курсы помогут вам:\n\n• Повысить жизненную энергию\n• Снизить уровень стресса\n• Улучшить качество сна\n• Повысить иммунитет\n• Улучшить работу дыхательной системы\n\nВыберите "🛒 Купить курс" в меню, чтобы ознакомиться с доступными программами.`,
      { parse_mode: 'Markdown' }
    );
    
    logWithTime(`Пользователь ${ctx.from.id} запросил информацию`);
  } catch (error) {
    console.error(`Ошибка при обработке "Информация": ${error.message}`);
  }
});

// Обработчик неизвестных команд
bot.on('message', async (ctx) => {
  try {
    // Пропускаем обработанные сообщения
    if (ctx.message.text && (
      ctx.message.text.startsWith('/') || 
      ['🛒 Купить курс', '❓ Информация', '📝 Мои покупки', '☎️ Связаться с преподавателем'].includes(ctx.message.text) ||
      (pendingOrders[ctx.from.id] && 
       (pendingOrders[ctx.from.id].status === 'waiting_email' || 
        pendingOrders[ctx.from.id].status === 'waiting_phone')
      )
    )) {
      return;
    }
    
    // Для остальных сообщений показываем подсказку
    await ctx.reply(
      'Используйте кнопки меню для навигации или напишите /start, чтобы начать заново.',
      mainKeyboard()
    );
  } catch (error) {
    console.error(`Ошибка при обработке неизвестного сообщения: ${error.message}`);
  }
});

// Запуск бота
bot.launch()
  .then(() => {
    console.log('Bot has been started');
    logWithTime('Бот запущен');
  })
  .catch(err => {
    console.error('Error starting bot:', err);
    logWithTime(`Ошибка при запуске бота: ${err.message}`);
  });

// Enable graceful stop
process.once('SIGINT', () => {
  bot.stop('SIGINT');
  logWithTime('Бот остановлен по SIGINT');
});
process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  logWithTime('Бот остановлен по SIGTERM');
});

// Добавляем простой HTTP-сервер для Render
const http = require('http');
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running!');
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  logWithTime(`HTTP-сервер запущен на порту ${PORT}`);
});
