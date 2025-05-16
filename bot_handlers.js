// Файл: bot_handlers.js
// Дополнительные обработчики и запуск сервера

// Импортируем общую конфигурацию
const { 
  app, 
  bot, 
  PORT, 
  APP_URL, 
  ADMIN_ID, 
  pendingOrders, 
  completedOrders,
  startTime,
  setupWebhook,
  logWithTime,
  formatUptime
} = require('./config');

// Импортируем модули
const { products, messageTemplates } = require('./data');
const { mainKeyboard, consultationsKeyboard, removeKeyboard } = require('./utils');
const { handleTextInput } = require('./handlers');
const { confirmPayment, sendConsultationRecording } = require('./admin');
const { setupPing } = require('./ping');
const { setupScheduler } = require('./scheduler');

// Обновленный обработчик для информационного раздела
bot.action('show_info', async (ctx) => {
  try {
    // Сначала отправляем логотип с подписью
    await ctx.replyWithPhoto(
      { source: 'files/logo.jpg' },
      { caption: '🌬️ Дыхательные практики Анастасии Поповой - Информация о курсах' }
    );
    
    // Небольшая задержка для лучшего UX
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Отправляем основной текст
    await ctx.reply(
      `ℹ️ *О курсах дыхательных практик*\n\n*Анастасия Попова* - сертифицированный инструктор по дыхательным практикам.\n\nНаши курсы помогут вам:\n\n• Повысить жизненную энергию\n• Снизить уровень стресса\n• Улучшить качество сна\n• Повысить иммунитет\n• Улучшить работу дыхательной системы\n\nВыберите "🛒 Купить курс" в меню, чтобы ознакомиться с доступными программами.`,
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          ...mainKeyboard().reply_markup,
          remove_keyboard: true
        }
      }
    );
    
    await ctx.answerCbQuery();
    logWithTime(`Пользователь ${ctx.from.id} запросил информацию`);
  } catch (error) {
    console.error(`Ошибка при обработке "Информация": ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

bot.action('show_purchases', async (ctx) => {
  try {
    const userId = ctx.from.id;
    
    // Проверяем, есть ли у пользователя завершенные заказы
    if (completedOrders[userId] && completedOrders[userId].length > 0) {
      // Подготавливаем сообщение заранее для улучшения производительности
      const purchaseLines = completedOrders[userId].map((order, index) => {
        const product = products[order.productId];
        const date = new Date(order.completedAt).toLocaleDateString();
        return `${index + 1}. *${product.name}*\n   Дата: ${date}\n   Статус: ✅ Оплачено`;
      });
      
      const message = '🛍 *Ваши покупки*:\n\n' + 
                      purchaseLines.join('\n\n') + 
                      '\n\nЕсли вам нужны повторно какие-то материалы, просто напишите в чат.';
      
      await ctx.reply(message, { 
        parse_mode: 'Markdown',
        reply_markup: {
          ...mainKeyboard().reply_markup,
          remove_keyboard: true
        }
      });
      
      await ctx.answerCbQuery();
      logWithTime(`Пользователь ${userId} просмотрел свои покупки`);
    } else {
      await ctx.reply(messageTemplates.noPurchases, {
        reply_markup: {
          ...mainKeyboard().reply_markup,
          remove_keyboard: true
        }
      });
      await ctx.answerCbQuery('У вас пока нет покупок');
    }
  } catch (error) {
    console.error(`Ошибка при просмотре покупок: ${error.message}`);
    await ctx.reply('Произошла ошибка при загрузке ваших покупок. Пожалуйста, попробуйте позже.', {
      reply_markup: {
        ...mainKeyboard().reply_markup,
        remove_keyboard: true
      }
    });
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

// ... Другие обработчики из index2.js ...
// Вставьте сюда остальные обработчики из index2.js

// Настройка маршрутов Express

// Главная страница
app.get('/', (req, res) => {
  const uptime = Math.floor((new Date() - startTime) / 1000);
  const uptimeFormatted = formatUptime(uptime);
  
  res.send(`
    <html>
      <head>
        <title>Breathing Practice Bot</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
          .status { padding: 10px; border-radius: 5px; margin-bottom: 10px; }
          .online { background-color: #d4edda; color: #155724; }
          h1 { color: #5682a3; }
          .info { background-color: #f8f9fa; padding: 15px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <h1>Breathing Practice Bot</h1>
        <div class="status online">
          <strong>Status:</strong> Bot is running in webhook mode!
        </div>
        <div class="info">
          <p><strong>Uptime:</strong> ${uptimeFormatted}</p>
          <p><strong>Started:</strong> ${startTime.toLocaleString()}</p>
          <p><strong>Last ping:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Port:</strong> ${PORT}</p>
        </div>
      </body>
    </html>
  `);
  logWithTime(`Запрос к главной странице (uptime: ${uptimeFormatted})`);
});

// Маршрут для проверки здоровья (важно для Render)
app.get('/ping', (req, res) => {
  try {
    // Отправляем простой текстовый ответ с HTTP кодом 200
    res.status(200).set('Content-Type', 'text/plain').send('pong');
    
    // Обновляем метку времени последней активности
    global.botData.lastPingTime = new Date();
  } catch (error) {
    console.error(`Ошибка при обработке ping-запроса: ${error.message}`);
    // Даже при ошибке отправляем успешный ответ
    res.status(200).send('error, but still alive');
  }
});

// Маршрут для статуса
app.get('/status', (req, res) => {
  try {
    const status = {
      status: 'ok',
      uptime: Math.floor((new Date() - startTime) / 1000),
      startTime: startTime.toISOString(),
      currentTime: new Date().toISOString(),
      webhookMode: true,
      port: PORT,
      lastPingTime: global.botData.lastPingTime.toISOString(),
      memory: process.memoryUsage()
    };
    
    res.json(status);
    logWithTime('Запрос статуса бота');
  } catch (error) {
    console.error(`Ошибка при обработке status-запроса: ${error.message}`);
    res.status(200).json({ status: 'error', message: error.message });
  }
});

// Запуск приложения и настройка вебхука
async function startApp() {
  try {
    // Запускаем Express сервер
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      logWithTime(`Express сервер запущен на порту ${PORT} и адресе 0.0.0.0`);
    });
    
    // Настраиваем вебхук с несколькими попытками
    let webhookSetup = false;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (!webhookSetup && attempts < maxAttempts) {
      attempts++;
      try {
        logWithTime(`Попытка настройки вебхука ${attempts}/${maxAttempts}`);
        webhookSetup = await setupWebhook();
        
        if (webhookSetup) {
          logWithTime(`Вебхук успешно настроен с ${attempts} попытки`);
        } else {
          logWithTime(`Не удалось настроить вебхук (попытка ${attempts}/${maxAttempts})`);
          // Если не вебхук не настроен, ждем перед следующей попыткой
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (error) {
        logWithTime(`Ошибка при настройке вебхука (попытка ${attempts}/${maxAttempts}): ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    if (webhookSetup) {
      logWithTime('Бот успешно настроен в режиме вебхука');
      
      // Настройка самопинга (если указан URL приложения)
      if (APP_URL) {
        setupPing(APP_URL, 5); // пинг каждые 5 минут
        logWithTime(`Настроен самопинг для ${APP_URL}`);
      }
      
      // Настройка планировщика задач
      setupScheduler(bot, ADMIN_ID);
      
      // Уведомляем админа о запуске
      if (ADMIN_ID) {
        try {
          const botInfo = await bot.telegram.getMe();
          bot.telegram.sendMessage(
            ADMIN_ID,
            `🤖 Бот запущен в режиме вебхука!\n\nВремя запуска: ${new Date().toLocaleString()}\nИмя бота: @${botInfo.username}\nID бота: ${botInfo.id}\nPORT: ${PORT}`
          ).catch(e => console.warn('Не удалось отправить уведомление:', e.message));
        } catch (error) {
          console.error('Ошибка при отправке уведомления админу:', error.message);
        }
      }
    } else {
      logWithTime('Не удалось настроить вебхук после нескольких попыток');
      console.error('Не удалось настроить вебхук после нескольких попыток');
    }
  } catch (error) {
    console.error('Ошибка при запуске приложения:', error);
    logWithTime(`Ошибка при запуске приложения: ${error.message}`);
  }
}

// Настройка graceful shutdown
process.once('SIGINT', () => {
  logWithTime('Получен сигнал SIGINT, останавливаем бота...');
  bot.telegram.deleteWebhook().then(() => {
    logWithTime('Вебхук удален');
  });
  logWithTime('Бот остановлен по SIGINT');
});

process.once('SIGTERM', () => {
  logWithTime('Получен сигнал SIGTERM, останавливаем бота...');
  bot.telegram.deleteWebhook().then(() => {
    logWithTime('Вебхук удален');
  });
  logWithTime('Бот остановлен по SIGTERM');
});

// Запускаем приложение
startApp();
