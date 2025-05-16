// Файл: ping.js
// Оптимизированная версия самопинга для Railway

const fetch = require('node-fetch');
const { logWithTime } = require('./utils');

/**
 * Функция для настройки само-пинга с оптимизированным интервалом для Railway
 * @param {string} url - URL вашего приложения для пинга
 * @param {number} interval - Интервал пинга в минутах (увеличен для Railway)
 */
function setupPing(url, interval = 30) { // Увеличиваем интервал до 30 минут
  // Убедимся, что URL имеет протокол
  const baseUrl = url.startsWith('http') ? url : `https://${url}`;
  const pingUrl = `${baseUrl}/ping`;
  
  // Конвертируем интервал в миллисекунды
  const intervalMs = interval * 60 * 1000;
  
  // Счетчик успешных пингов
  let successCount = 0;
  
  // Функция пинга с использованием fetch
  const ping = async () => {
    try {
      logWithTime(`Периодический пинг ${pingUrl}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 секунд тайм-аут
      
      const response = await fetch(pingUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Breathing Practice Bot Monitoring Service',
          'Cache-Control': 'no-cache, no-store'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        successCount++;
        // Логируем только каждый 5-й успешный пинг для уменьшения шума в логах
        if (successCount % 5 === 0) {
          logWithTime(`Мониторинг активен, успешных пингов: ${successCount}`);
        }
      } else {
        logWithTime(`Ping не удался со статусом ${response.status}`);
      }
    } catch (error) {
      logWithTime(`Ошибка мониторинга: ${error.message}`);
    } finally {
      // Планируем следующий пинг
      setTimeout(ping, intervalMs);
    }
  };
  
  // Запускаем первый пинг через 2 минуты после запуска
  // (даем приложению время полностью загрузиться)
  setTimeout(() => {
    ping();
    logWithTime(`Настроен мониторинг для ${pingUrl} с интервалом ${interval} минут`);
  }, 2 * 60 * 1000);
  
  return {
    stop: () => {
      logWithTime('Мониторинг остановлен');
    }
  };
}

module.exports = { setupPing };
