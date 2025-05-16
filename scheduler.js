// Файл: scheduler.js
// Планировщик задач, оптимизированный для Railway

const { logWithTime } = require('./utils');

/**
 * Настройка планировщика задач с поддержкой оптимизированного режима
 * @param {Object} bot - Экземпляр Telegram бота
 * @param {String} adminId - ID администратора
 * @param {Boolean} optimizedMode - Флаг оптимизированного режима
 */
function setupScheduler(bot, adminId, optimizedMode = false) {
  // Вывод информации о режиме работы
  logWithTime(`Настройка планировщика в ${optimizedMode ? 'оптимизированном' : 'стандартном'} режиме`);
  
  // Массив счетчиков для статистики
  const counters = {
    pingCount: 0,
    telegramApiCalls: 0,
    lastActivity: new Date(),
    consecutiveApiErrors: 0,
    restartAttempts: 0,
    memoryUsageHistory: []
  };
  
  // Расчет интервалов в зависимости от режима
  const intervals = {
    connectionCheck: optimizedMode ? 30 * 60 * 1000 : 15 * 60 * 1000, // 30 или 15 минут
    statusReport: optimizedMode ? 8 * 60 * 60 * 1000 : 4 * 60 * 60 * 1000, // 8 или 4 часа
    artificialActivity: optimizedMode ? 20 * 60 * 1000 : 10 * 60 * 1000, // 20 или 10 минут
    memoryMonitoring: 60 * 60 * 1000 // 1 час (независимо от режима)
  };
  
  // Настройка логгера памяти - сохраняем историю использования памяти
  const logMemoryUsage = () => {
    const memUsage = process.memoryUsage();
    const memoryInfo = {
      timestamp: new Date(),
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };
    
    // Ограничиваем массив до 24 записей (24 часа при часовом интервале)
    if (counters.memoryUsageHistory.length >= 24) {
      counters.memoryUsageHistory.shift();
    }
    
    counters.memoryUsageHistory.push(memoryInfo);
    
    // Проверка на утечки памяти - если рост более 20% за последние 3 часа
    if (counters.memoryUsageHistory.length >= 4) {
      const oldestEntry = counters.memoryUsageHistory[counters.memoryUsageHistory.length - 4];
      const latestEntry = counters.memoryUsageHistory[counters.memoryUsageHistory.length - 1];
      
      const memoryGrowthPercent = ((latestEntry.heapUsed - oldestEntry.heapUsed) / oldestEntry.heapUsed) * 100;
      
      if (memoryGrowthPercent > 20) {
        logWithTime(`⚠️ Обнаружен значительный рост использования памяти: ${memoryGrowthPercent.toFixed(2)}% за 3 часа`);
        
        // Уведомляем администратора о потенциальной утечке памяти
        try {
          bot.telegram.sendMessage(
            adminId,
            `⚠️ *Предупреждение о памяти*\n\nОбнаружен рост использования памяти на ${memoryGrowthPercent.toFixed(2)}% за последние 3 часа.\n\nТекущее использование:\nHeap: ${latestEntry.heapUsed} MB\nTotal: ${latestEntry.rss} MB`,
            { parse_mode: 'Markdown' }
          );
        } catch (error) {
          logWithTime(`Ошибка при отправке предупреждения о памяти: ${error.message}`);
        }
      }
    }
    
    logWithTime(`📊 Мониторинг памяти: RSS: ${memoryInfo.rss} MB, Heap Used: ${memoryInfo.heapUsed} MB`);
  };
  
  // Функция проверки соединения с Telegram API с механизмом возрастающих интервалов повторных попыток
  const checkConnection = () => {
    return new Promise((resolve, reject) => {
      bot.telegram.getMe()
        .then(botInfo => {
          counters.telegramApiCalls++;
          counters.consecutiveApiErrors = 0;
          
          // В оптимизированном режиме не логируем каждую успешную проверку
          if (!optimizedMode || counters.telegramApiCalls % 3 === 0) {
            logWithTime(`✅ Соединение с Telegram API активно (бот: ${botInfo.username})`);
          }
          
          resolve(true);
        })
        .catch(error => {
          counters.consecutiveApiErrors++;
          logWithTime(`❌ Ошибка соединения с Telegram API: ${error.message}`);
          reject(error);
        });
    });
  };
  
  // Функция для проведения мягкой очистки памяти
  const performMemoryCleanup = () => {
    try {
      const beforeCleanup = process.memoryUsage().heapUsed / 1024 / 1024;
      
      // Запускаем сборщик мусора если доступен
      if (global.gc) {
        global.gc();
        const afterCleanup = process.memoryUsage().heapUsed / 1024 / 1024;
        const freed = beforeCleanup - afterCleanup;
        
        if (freed > 1) { // Если освободили больше 1 МБ
          logWithTime(`🧹 Очистка памяти: освобождено ${freed.toFixed(2)} MB`);
        }
      }
    } catch (error) {
      logWithTime(`Ошибка при очистке памяти: ${error.message}`);
    }
  };
  
  // 1. Периодическая проверка API Telegram с адаптивным механизмом восстановления
  const connectionCheckInterval = setInterval(async () => {
    try {
      await checkConnection();
      
      // Если подряд более 3 ошибок - попытка перезапуска
      if (counters.consecutiveApiErrors >= 3) {
        logWithTime('КРИТИЧЕСКАЯ ОШИБКА: Множественные сбои соединения с Telegram API');
        
        // Увеличиваем счетчик попыток перезапуска
        counters.restartAttempts++;
        
        try {
          // Попытка остановки и перезапуска бота
          bot.stop('connection_error');
          await new Promise(resolve => setTimeout(resolve, 5000));
          bot.launch();
          
          // Уведомление администратора
          bot.telegram.sendMessage(
            adminId, 
            `❗️ Обнаружена проблема с подключением к Telegram API. Выполнена попытка перезапуска бота (#${counters.restartAttempts}).`
          );
          
          // Сбрасываем счетчик ошибок
          counters.consecutiveApiErrors = 0;
        } catch (restartError) {
          logWithTime(`Критическая ошибка при перезапуске: ${restartError.message}`);
        }
      }
      
      // Периодически выполняем мягкую очистку памяти
      if (counters.telegramApiCalls % 3 === 0) {
        performMemoryCleanup();
      }
    } catch (error) {
      // Обработка ошибок соединения
      logWithTime(`Ошибка проверки соединения: ${error.message}`);
    }
  }, intervals.connectionCheck);
  
  // 2. Статистика работы бота с адаптивной частотой
  const statusReportInterval = setInterval(() => {
    const now = new Date();
    const hours = now.getHours();
    
    // Отправляем статус только в рабочее время (с 9 до 21)
    if (hours >= 9 && hours < 21) {
      const uptimeSeconds = Math.floor((now - global.botData.startTime) / 1000);
      const memoryUsage = process.memoryUsage();
      
      // Формируем функцию для форматирования времени работы
      const formatUptime = (seconds) => {
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
      };
      
      // Расширенная статистика для администратора
      const message = `
📊 *Статистика работы бота*
${optimizedMode ? '🔋 Режим: Оптимизированный' : '⚡ Режим: Стандартный'}

⏱ Время работы: ${formatUptime(uptimeSeconds)}
🔄 Количество пингов: ${counters.pingCount}
📡 Вызовы API Telegram: ${counters.telegramApiCalls}
🕒 Последняя активность: ${counters.lastActivity.toLocaleString()}

💾 *Использование памяти*:
• RSS: ${Math.round(memoryUsage.rss / 1024 / 1024)} МБ
• Heap Total: ${Math.round(memoryUsage.heapTotal / 1024 / 1024)} МБ
• Heap Used: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)} МБ

🔁 Попытки перезапуска: ${counters.restartAttempts}
⚠️ Последовательных ошибок API: ${counters.consecutiveApiErrors}
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
  }, intervals.statusReport);
  
  // 3. Искусственная активность бота с оптимизированной частотой
  const artificialActivityInterval = setInterval(() => {
    counters.pingCount++;
    counters.lastActivity = new Date();
    
    // Логируем только каждый 5-й пинг в оптимизированном режиме
    if (!optimizedMode || counters.pingCount % 5 === 0) {
      logWithTime(`Искусственная активность бота (#${counters.pingCount})`);
    }
  }, intervals.artificialActivity);
  
  // 4. Мониторинг использования памяти
  const memoryMonitoringInterval = setInterval(() => {
    logMemoryUsage();
  }, intervals.memoryMonitoring);
  
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
    clearInterval(memoryMonitoringInterval);
    logWithTime('Интервалы планировщика остановлены');
  });
  
  process.on('SIGTERM', () => {
    clearInterval(connectionCheckInterval);
    clearInterval(statusReportInterval);
    clearInterval(artificialActivityInterval);
    clearInterval(memoryMonitoringInterval);
    logWithTime('Интервалы планировщика остановлены по SIGTERM');
  });
  
  // Инициализируем начальный мониторинг памяти
  logMemoryUsage();
  
  logWithTime(`Планировщик задач успешно настроен в ${optimizedMode ? 'оптимизированном' : 'стандартном'} режиме`);
  
  // Возвращаем информацию о настроенных интервалах
  return {
    intervals,
    stop: () => {
      clearInterval(connectionCheckInterval);
      clearInterval(statusReportInterval);
      clearInterval(artificialActivityInterval);
      clearInterval(memoryMonitoringInterval);
      logWithTime('Планировщик задач остановлен');
    }
  };
}

module.exports = { setupScheduler };
