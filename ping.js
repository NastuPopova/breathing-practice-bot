// Файл: ping.js
// Функция самопинга для предотвращения сна приложения

const fetch = require('node-fetch');
const { logWithTime } = require('./utils');

/**
 * Функция для настройки само-пинга приложения с расширенной обработкой ошибок
 * @param {string} url - URL вашего приложения для пинга
 * @param {number} interval - Интервал пинга в минутах (на Railway можно использовать больший интервал)
 */
function setupPing(url, interval = 10) {
  // Конвертируем интервал в миллисекунды
  const intervalMs = interval * 60 * 1000;
  
  // Счетчик успешных пингов
  let successCount = 0;
  // Счетчик неудачных попыток
  let failedAttempts = 0;
  const MAX_FAILED_ATTEMPTS = 3;
  
  // Функция пинга с использованием fetch
  const ping = async () => {
    try {
      // Railway не засыпает, поэтому пинг нужен в основном для мониторинга
      logWithTime(`Выполняется пинг ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 секунд тайм-аут
      
      const response = await fetch(url + '/ping', {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Breathing Practice Bot Ping Service',
          'Cache-Control': 'no-cache, no-store'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const text = await response.text();
        successCount++;
        failedAttempts = 0; // Сбрасываем счетчик неудач
        
        // Логируем, но реже
        if (successCount % 10 === 0) {
          logWithTime(`Пинг успешен (${successCount}): ${url}/ping (${response.status} ${text})`);
        }
      } else {
        failedAttempts++;
        logWithTime(`Пинг не удался со статусом ${response.status}. Неудачных попыток подряд: ${failedAttempts}`);
      }
    } catch (error) {
      failedAttempts++;
      logWithTime(`Ошибка пинга: ${error.message}. Неудачных попыток подряд: ${failedAttempts}`);
      
      // Если слишком много последовательных неудач, уведомляем админа
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        logWithTime(`КРИТИЧЕСКАЯ ОШИБКА: Не удается пропинговать ${url} ${failedAttempts} раз(а) подряд`);
        
        try {
          const { bot, ADMIN_ID } = global.botData || {};
          if (bot && ADMIN_ID) {
            bot.telegram.sendMessage(
              ADMIN_ID, 
              `❗️ КРИТИЧЕСКАЯ ОШИБКА: Не удается пропинговать ${url} ${failedAttempts} раз(а) подряд`
            ).catch(e => console.error('Не удалось отправить аварийное уведомление:', e.message));
          }
        } catch (notificationError) {
          console.error('Ошибка при отправке аварийного уведомления:', notificationError);
        }
      }
    } finally {
      // Планируем следующий пинг
      setTimeout(ping, intervalMs);
    }
  };
  
  // Запускаем первый пинг с задержкой в 30 секунд (дать приложению время запуститься)
  setTimeout(() => {
    ping();
    logWithTime(`Настроен пинг для ${url} с интервалом ${interval} минут`);
  }, 30 * 1000);
  
  return {
    stop: () => {
      logWithTime('Интервал пинга остановлен');
    }
  };
}

module.exports = { setupPing };
