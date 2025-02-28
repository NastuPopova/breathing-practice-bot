// Файл: scheduler.js
// Планировщик задач для предотвращения сна бота на Render

const { logWithTime } = require('./utils');

/**
 * Настройка планировщика задач
 * @param {Object} bot - Экземпляр Telegram бота
 * @param {String} adminId - ID администратора
 */
function setupScheduler(bot, adminId) {
  // Массив счетчиков для статистики
  const counters = {
    pingCount: 0,
    telegramApiCalls: 0,
    lastActivity: new Date(),
    consecutiveApiErrors: 0
  };
  
  // Функция проверки соединения с Telegram API
  const checkConnection = () => {
    return new Promise((resolve, reject) => {
      bot.telegram.getMe()
        .then(botInfo => {
          counters.telegramApiCalls++;
          counters.consecutiveApiErrors = 0;
          logWithTime(`✅ Соединение с Telegram API активно (бот: ${botInfo.username})`);
          resolve(true);
        })
        .catch(error => {
          counters.consecutiveApiErrors++;
          logWithTime(`❌ Ошибка соединения с Telegram API: ${error.message}`);
          reject(error);
        });
    });
  };
  
  // 1. Периодическая проверка API Telegram с механизмом восстановления
  const connectionCheckInterval = setInterval(async () => {
    try {
      await checkConnection();
      
      // Если подряд более 3 ошибок - попытка перезапуска
      if (counters.consecutiveApiErrors >= 3) {
        logWithTime('КРИТИЧЕСКАЯ ОШИБКА: Множественные сбои соединения с Telegram API');
        
        try {
          // Попытка остановки и перезапуска бота
          bot.stop('connection_error');
          await new Promise(resolve => setTimeout(resolve, 5000));
          bot.launch();
          
          // Уведомление администратора
          bot.telegram.sendMessage(
            adminId, 
            '❗️ Обнаружена проблема с подключением к Telegram API. Выполнена попытка перезапуска бота.'
          );
        } catch (restartError) {
          logWithTime(`Критическая ошибка при перезапуске: ${restartError.message}`);
        }
      }
    } catch (error) {
      // Обработка ошибок соединения
      logWithTime(`Ошибка проверки соединения: ${error.message}`);
    }
  }, 15 * 60 * 1000); // Каждые 15 минут
  
  // 2. Статистика работы бота каждые 4 часа
  const statusReportInterval = setInterval(() => {
    const now = new Date();
    const hours = now.getHours();
    
    // Отправляем статус только в рабочее время (с 9 до 21)
    if (hours >= 9 && hours < 21) {
      const uptime = Math.floor((now - counters.lastActivity) / 1000 / 60);
      const message = `
📊 *Статистика работы бота*

⏱ Время работы: ${formatUptime(process.uptime())}
🔄 Количество пингов: ${counters.pingCount}
📡 Вызовы API Telegram: ${counters.telegramApiCalls}
🕒 Последняя активность: ${counters.lastActivity.toLocaleString()}

💾 Использование памяти: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} МБ
`;
      
      // Отправляем сообщение администратору
      bot.telegram.sendMessage(adminId, message, { parse_mode: 'Markdown' })
        .then(() => {
          logWithTime('Отправлена статистика работы бота администратору');
        })
        .catch(error => {
          logWithTime(`Ошибка отправки статистики: ${error.message}`);
        });
    }
  }, 4 * 60 * 60 * 1000);
  
  // 3. Искусственная активность бота каждые 10 минут
  const artificialActivityInterval = setInterval(() => {
    counters.pingCount++;
    counters.lastActivity = new Date();
    logWithTime(`Искусственная активность бота (#${counters.pingCount})`);
  }, 10 * 60 * 1000);
  
  // Обработчик события для отслеживания активности бота
  bot.use((ctx, next) => {
    counters.lastActivity = new Date();
    return next();
  });
  
  // Обработка завершения процесса
  process.on('SIGINT', () => {
    clearInterval(connectionCheckInterval);
    clearInterval(statusReportInterval);
    clearInterval(artificialActivityInterval);
    logWithTime('Интервалы планировщика остановлены');
  });
  
  logWithTime('Планировщик задач успешно настроен');
}

/**
 * Форматирование времени работы
 * @param {Number} seconds - время в секундах
 * @returns {String} отформатированное время
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / (3600 * 24));
  seconds -= days * 3600 * 24;
  const hours = Math.floor(seconds / 3600);
  seconds -= hours * 3600;
  const minutes = Math.floor(seconds / 60);
  seconds -= minutes * 60;
  seconds = Math.floor(seconds);
  
  let result = '';
  if (days > 0) result += `${days}д `;
  if (hours > 0) result += `${hours}ч `;
  if (minutes > 0) result += `${minutes}м `;
  result += `${seconds}с`;
  
  return result;
}

module.exports = { setupScheduler };
