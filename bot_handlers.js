// Файл: bot_handlers.js
// Дополнительные обработчики и запуск сервера с оптимизацией для Railway

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

// Флаг оптимизации для Railway
const RAILWAY_OPTIMIZED_MODE = true;

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

// Другие обработчики действий
bot.action('show_purchases', async (ctx) => {
  // Код обработчика (без изменений)...
});

// ... другие обработчики ...

// Настройка маршрутов Express

// Главная страница с расширенной информацией для Railway
app.get('/', (req, res) => {
  const uptime = Math.floor((new Date() - startTime) / 1000);
  const uptimeFormatted = formatUptime(uptime);
  const memoryUsage = process.memoryUsage();
  
  res.send(`
    <html>
      <head>
        <title>Breathing Practice Bot - Railway Edition</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
          .status { padding: 10px; border-radius: 5px; margin-bottom: 10px; }
          .online { background-color: #d4edda; color: #155724; }
          .railway { background-color: #e3f2fd; color: #0d47a1; }
          h1 { color: #5682a3; }
          .info { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 15px; }
          .memory { background-color: #fff3cd; padding: 15px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <h1>Breathing Practice Bot</h1>
        <div class="status online">
          <strong>Status:</strong> Bot is running on Railway!
        </div>
        <div class="status railway">
          <strong>Mode:</strong> Railway Optimized (${RAILWAY_OPTIMIZED_MODE ? 'Enabled' : 'Disabled'})
        </div>
        <div class="info">
          <p><strong>Uptime:</strong> ${uptimeFormatted}</p>
          <p><strong>Started:</strong> ${startTime.toLocaleString()}</p>
          <p><strong>Last ping:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Port:</strong> ${PORT}</p>
          <p><strong>Webhook URL:</strong> ${APP_URL}</p>
        </div>
        <div class="memory">
          <p><strong>Memory Usage:</strong></p>
          <p>RSS: ${Math.round(memoryUsage.rss / 1024 / 1024)} MB</p>
          <p>Heap Total: ${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB</p>
          <p>Heap Used: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB</p>
        </div>
      </body>
    </html>
  `);
  logWithTime(`Запрос к главной странице (uptime: ${uptimeFormatted})`);
});

// Маршрут для проверки здоровья (важно для Railway)
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

// Расширенный маршрут для статуса с дополнительной информацией для Railway
app.get('/status', (req, res) => {
  try {
    const uptimeSeconds = Math.floor((new Date() - startTime) / 1000);
    const status = {
      status: 'ok',
      railway_optimized: RAILWAY_OPTIMIZED_MODE,
      uptime: uptimeSeconds,
      uptime_formatted: formatUptime(uptimeSeconds),
      startTime: startTime.toISOString(),
      currentTime: new Date().toISOString(),
      webhookMode: true,
      webhookUrl: APP_URL,
      port: PORT,
      platform: 'Railway',
      lastPingTime: global.botData.lastPingTime.toISOString(),
      memory: process.memoryUsage(),
      memory_mb: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
      },
      environment: {
        node_version: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };
    
    res.json(status);
    logWithTime('Запрос статуса бота');
  } catch (error) {
    console.error(`Ошибка при обработке status-запроса: ${error.message}`);
    res.status(200).json({ status: 'error', message: error.message });
  }
});

// Запуск приложения и настройка вебхука с оптимизациями для Railway
async function startApp() {
  try {
    // Запускаем Express сервер
    console.log(`Запуск Express сервера на порту ${PORT}...`);
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
          // Если вебхук не настроен, ждем перед следующей попыткой
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (error) {
        logWithTime(`Ошибка при настройке вебхука (попытка ${attempts}/${maxAttempts}): ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    if (webhookSetup) {
      logWithTime('Бот успешно настроен в режиме вебхука');
      
      // Настройка самопинга с увеличенным интервалом для Railway
      if (APP_URL) {
        const pingInterval = RAILWAY_OPTIMIZED_MODE ? 30 : 15; // 30 минут в оптимизированном режиме
        setupPing(APP_URL, pingInterval);
        logWithTime(`Настроен самопинг для ${APP_URL} с интервалом ${pingInterval} минут`);
      }
      
      // Настройка планировщика задач с оптимизациями для Railway
      setupScheduler(bot, ADMIN_ID, RAILWAY_OPTIMIZED_MODE);
      
      // Уведомляем админа о запуске
      if (ADMIN_ID) {
        try {
          const botInfo = await bot.telegram.getMe();
          const memoryInfo = `Память: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`;
          
          bot.telegram.sendMessage(
            ADMIN_ID,
            `🤖 Бот запущен на Railway!\n\nВремя запуска: ${new Date().toLocaleString()}\nИмя бота: @${botInfo.username}\nID бота: ${botInfo.id}\nURL: ${APP_URL}\nPORT: ${PORT}\nРежим оптимизации: ${RAILWAY_OPTIMIZED_MODE ? 'Включен ✅' : 'Выключен ❌'}\n${memoryInfo}`
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

// Настройка graceful shutdown с логированием памяти
process.once('SIGINT', () => {
  logWithTime('Получен сигнал SIGINT, останавливаем бота...');
  const memoryInfo = `Память при остановке: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`;
  logWithTime(memoryInfo);
  
  bot.telegram.deleteWebhook().then(() => {
    logWithTime('Вебхук удален');
  });
  logWithTime('Бот остановлен по SIGINT');
});

process.once('SIGTERM', () => {
  logWithTime('Получен сигнал SIGTERM, останавливаем бота...');
  const memoryInfo = `Память при остановке: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`;
  logWithTime(memoryInfo);
  
  bot.telegram.deleteWebhook().then(() => {
    logWithTime('Вебхук удален');
  });
  logWithTime('Бот остановлен по SIGTERM');
});

// Запускаем приложение
startApp();
