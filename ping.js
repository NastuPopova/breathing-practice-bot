const fetch = require('node-fetch');
const { logWithTime } = require('./utils');

/**
 * Функция для настройки само-пинга приложения с расширенной обработкой ошибок
 * @param {string} url - URL вашего приложения для пинга
 * @param {number} interval - Интервал пинга в минутах (рекомендуется 14 минут для Render)
 */
function setupPing(url, interval = 14) {
  // Конвертируем интервал в миллисекунды
  const intervalMs = interval * 60 * 1000;
  
  // Счетчик неудачных попыток
  let failedAttempts = 0;
  const MAX_FAILED_ATTEMPTS = 3;
  
  // Функция пинга с использованием fetch
  const ping = async () => {
    try {
      logWithTime(`Выполняется пинг ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 секунд тайм-аут
      
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Breathing Practice Bot Ping Service'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        logWithTime(`Пинг успешен: ${url} (${response.status})`);
        failedAttempts = 0; // Сбрасываем счетчик неудач
      } else {
        failedAttempts++;
        logWithTime(`Пинг вернул статус ${response.status}. Попытка ${failedAttempts}`);
      }
    } catch (error) {
      failedAttempts++;
      logWithTime(`Ошибка пинга: ${error.message}. Попытка ${failedAttempts}`);
      
      // Если слишком много неудачных попыток, логируем критическую ошибку
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        logWithTime(`КРИТИЧЕСКАЯ ОШИБКА: Не удается пропинговать ${url} ${failedAttempts} раз(а)`);
        
        // Здесь можно добавить отправку аварийного уведомления в Telegram
        // Например, через глобальный объект бота, если он доступен
        try {
          const { bot, ADMIN_ID } = global.botData || {};
          if (bot && ADMIN_ID) {
            bot.telegram.sendMessage(
              ADMIN_ID, 
              `❗️ КРИТИЧЕСКАЯ ОШИБКА: Не удается пропинговать ${url} ${failedAttempts} раз(а)`
            );
          }
        } catch (notificationError) {
          console.error('Ошибка при отправке аварийного уведомления:', notificationError);
        }
      }
    }
  };
  
  // Запускаем пинг с указанным интервалом
  const pingInterval = setInterval(ping, intervalMs);
  logWithTime(`Настроен пинг для ${url} с интервалом ${interval} минут`);
  
  // Добавляем обработку завершения процесса
  process.on('SIGINT', () => {
    clearInterval(pingInterval);
    logWithTime('Интервал пинга остановлен');
  });
  
  // Делаем первый пинг сразу
  ping();
}

module.exports = { setupPing };
