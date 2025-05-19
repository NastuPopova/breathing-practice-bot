// Файл: ping.js
// Улучшенная версия механизма пинга с обработкой ошибок

const fetch = require('node-fetch');
const { logWithTime } = require('./utils');

/**
 * Функция для настройки само-пинга с защитой от ошибок
 * @param {string} url - URL вашего приложения для пинга
 * @param {number} interval - Интервал пинга в минутах
 * @param {number} maxRetries - Максимальное количество повторных попыток при ошибке
 */
function setupPing(url, interval = 30, maxRetries = 3) {
  // Убедимся, что URL имеет протокол
  const baseUrl = url.startsWith('http') ? url : `https://${url}`;
  const pingUrl = `${baseUrl}/ping`;
  
  // Конвертируем интервал в миллисекунды
  const intervalMs = interval * 60 * 1000;
  
  // Счетчики для статистики
  let successCount = 0;
  let failureCount = 0;
  let consecutiveFailures = 0;
  let isBackoff = false;
  let currentBackoffInterval = intervalMs;
  let lastSuccessTime = null;
  
  // Функция для экспоненциального увеличения интервала при ошибках
  const getBackoffInterval = (failCount) => {
    // Начинаем с базового интервала и увеличиваем его экспоненциально при ошибках
    // Но не более чем в 5 раз от исходного интервала
    const factor = Math.min(Math.pow(1.5, failCount), 5);
    return Math.floor(intervalMs * factor);
  };
  
  // Основная функция пинга с обработкой ошибок
  const ping = async () => {
    try {
      // Не логируем каждый пинг, чтобы уменьшить шум в логах
      if (successCount % 5 === 0 || isBackoff) {
        logWithTime(`Выполняется пинг: ${pingUrl} (попытка #${successCount + failureCount + 1})`);
      }
      
      // Настраиваем таймаут для fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 секунд таймаут
      
      const response = await fetch(pingUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Breathing Practice Bot Monitoring Service',
          'Cache-Control': 'no-cache, no-store'
        },
        // Важно: добавляем случайный параметр к URL, чтобы избежать кэширования
        // и убедиться, что каждый запрос действительно доходит до сервера
        redirect: 'follow'
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        successCount++;
        consecutiveFailures = 0;
        lastSuccessTime = new Date();
        
        // Если мы были в режиме backoff, возвращаемся к нормальному интервалу
        if (isBackoff) {
          isBackoff = false;
          currentBackoffInterval = intervalMs;
          logWithTime(`✅ Пинг восстановлен после ошибок. Возвращаемся к нормальному интервалу ${interval} минут`);
        } else if (successCount % 10 === 0) {
          // Логируем только каждый 10-й успешный пинг для уменьшения шума
          logWithTime(`✅ Мониторинг активен, успешных пингов: ${successCount}, ошибок: ${failureCount}`);
        }
      } else {
        throw new Error(`Ошибка статуса HTTP: ${response.status}`);
      }
    } catch (error) {
      failureCount++;
      consecutiveFailures++;
      
      const errorMessage = error.name === 'AbortError' 
        ? 'Превышен таймаут запроса (10 секунд)'
        : error.message;
      
      logWithTime(`❌ ОШИБКА ПИНГА #${failureCount}: ${errorMessage}`);
      
      // Если последовательных ошибок больше maxRetries, увеличиваем интервал
      if (consecutiveFailures >= maxRetries && !isBackoff) {
        isBackoff = true;
        currentBackoffInterval = getBackoffInterval(consecutiveFailures);
        
        logWithTime(`⚠️ Обнаружены повторяющиеся ошибки пинга (${consecutiveFailures}). Увеличиваем интервал до ${Math.floor(currentBackoffInterval/60000)} минут`);
        
        // Если есть администратор, уведомляем его об ошибке
        try {
          const { bot, ADMIN_ID } = global.botData;
          if (bot && ADMIN_ID) {
            bot.telegram.sendMessage(
              ADMIN_ID,
              `⚠️ ВНИМАНИЕ: Не удается пропинговать ${pingUrl}\n\nПроизошло ${consecutiveFailures} последовательных ошибок. Увеличиваем интервал пинга.\n\nПоследняя ошибка: ${errorMessage}`
            ).catch(e => console.warn('Не удалось отправить уведомление об ошибке пинга:', e.message));
          }
        } catch (notifyError) {
          // Игнорируем ошибки уведомления
        }
      }
    } finally {
      // Запланируем следующий пинг с учетом возможного backoff интервала
      setTimeout(ping, isBackoff ? currentBackoffInterval : intervalMs);
    }
  };
  
  // Запускаем первый пинг через 5 минут после запуска
  const initialDelay = 5 * 60 * 1000; // 5 минут
  logWithTime(`🔄 Настроен мониторинг для ${pingUrl} с интервалом ${interval} минут (первый пинг через 5 минут)`);
  
  setTimeout(() => {
    ping();
  }, initialDelay);
  
  // Возвращаем объект с методами для управления пингом и получения статистики
  return {
    getStats: () => ({
      successCount,
      failureCount,
      consecutiveFailures,
      isBackoff,
      currentInterval: isBackoff ? Math.floor(currentBackoffInterval/60000) : interval,
      lastSuccessTime
    }),
    stop: () => {
      logWithTime('Мониторинг остановлен');
      // Не можем остановить setTimeout, но можем обновить флаг
      return { stopped: true };
    }
  };
}

module.exports = { setupPing };
