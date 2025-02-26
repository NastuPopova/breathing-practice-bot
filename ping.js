// Файл: ping.js
// Модуль для поддержания бота активным на Render

const https = require('https');
const { logWithTime } = require('./utils');

/**
 * Функция для настройки само-пинга приложения
 * @param {string} url - URL вашего приложения для пинга
 * @param {number} interval - Интервал пинга в минутах (рекомендуется 14 минут для Render)
 */
function setupPing(url, interval = 14) {
  // Конвертируем интервал в миллисекунды
  const intervalMs = interval * 60 * 1000;
  
  // Функция пинга
  const ping = () => {
    logWithTime(`Выполняется пинг ${url}`);
    https.get(url, (res) => {
      const { statusCode } = res;
      if (statusCode === 200) {
        logWithTime(`Пинг успешен: ${url} (${statusCode})`);
      } else {
        logWithTime(`Пинг вернул статус ${statusCode}`);
      }
    }).on('error', (err) => {
      logWithTime(`Ошибка пинга: ${err.message}`);
    });
  };
  
  // Запускаем пинг с указанным интервалом
  setInterval(ping, intervalMs);
  logWithTime(`Настроен пинг для ${url} с интервалом ${interval} минут`);
  
  // Делаем первый пинг сразу
  ping();
}

module.exports = { setupPing };
