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
    lastActivity: new Date()
  };
  
  // 1. Проверка API Telegram каждые 30 минут
  setInterval(() => {
    logWithTime('Проверка соединения с API Telegram');
    
    bot.telegram.getMe()
      .then(botInfo => {
        counters.telegramApiCalls++;
        logWithTime(`✅ Соединение с Telegram API активно (бот: ${botInfo.username})`);
      })
      .catch(error => {
        logWithTime(`❌ Ошибка соединения с Telegram API: ${error.message}`);
      });
  }, 30 * 60 * 1000);
  
  // 2. Каждые 4 часа отправлять админу статус бота (только в рабочее время)
  setInterval(() => {
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
  setInterval(() => {
    counters.pingCount++;
    counters.lastActivity = new Date();
    logWithTime(`Искусственная активность бота (#${counters.pingCount})`);
  }, 10 * 60 * 1000);
  
  // Обработчик события для отслеживания активности бота
  bot.use((ctx, next) => {
    counters.lastActivity = new Date();
    return next();
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
