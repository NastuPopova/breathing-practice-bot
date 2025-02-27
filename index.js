// Файл: index.js
// Основной файл Telegram-бота с inline-кнопками

const { Telegraf, Markup } = require('telegraf');
require('dotenv').config();
const express = require('express');
const fs = require('fs');

// Импортируем модули
const { products, messageTemplates } = require('./data');
const { mainKeyboard, consultationsKeyboard, removeKeyboard, sendMessageWithInlineKeyboard, fileExists, logWithTime } = require('./utils');
const { handleStart, handleBuyAction, handleConfirmBuy, handleTextInput } = require('./handlers');
const { notifyAdmin, confirmPayment, sendConsultationRecording } = require('./admin');
const { setupPing } = require('./ping');
const { setupScheduler } = require('./scheduler');

// Создание бота с токеном от BotFather
const bot = new Telegraf(process.env.BOT_TOKEN);

// ID администратора (из переменных окружения)
const ADMIN_ID = process.env.ADMIN_ID;

// Хранение заказов
const pendingOrders = {};
const completedOrders = {};

// Экспортируем эти объекты для использования в других модулях
global.botData = {
  bot,
  ADMIN_ID,
  pendingOrders,
  completedOrders,
  adminState: null // Для хранения состояния админа
};

// Логирование всех callback запросов
bot.on('callback_query', (ctx, next) => {
  console.log('=========== CALLBACK QUERY RECEIVED ===========');
  console.log('Data:', ctx.callbackQuery.data);
  console.log('From user:', ctx.from.id);
  console.log('Message ID:', ctx.callbackQuery.message.message_id);
  console.log('===============================================');
  
  // Продолжаем выполнение цепочки обработчиков
  return next();
});

// Обработчики команд
bot.start(handleStart);

// Обработчики для inline-кнопок
bot.action('show_products', async (ctx) => {
  try {
    await ctx.reply(
      '📚 Выберите продукт:',
      Markup.inlineKeyboard([
        [Markup.button.callback('🔰 Стартовый комплект - 990 ₽', 'buy_starter')],
        [Markup.button.callback('👤 Индивидуальное занятие - 2 000 ₽', 'buy_individual')],
        [Markup.button.callback('🎯 Пакет 3 занятия - 4500 ₽', 'buy_package')],
        [Markup.button.callback('🏆 Полный курс видеоуроков - 14 999 ₽ [🔄 В разработке]', 'product_in_development')],
        [Markup.button.callback('◀️ Назад', 'back_to_menu')]
      ])
    );
    
    await ctx.answerCbQuery();
    logWithTime(`Пользователь ${ctx.from.id} открыл меню выбора продукта`);
  } catch (error) {
    console.error(`Ошибка в обработчике "Купить курс": ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

// Обработчик для продуктов, которые в разработке
bot.action('product_in_development', async (ctx) => {
  try {
    await ctx.reply(
      '🔄 *Продукт находится в разработке*\n\nПолный курс видеоуроков в настоящее время дорабатывается, чтобы предоставить вам наилучший опыт обучения.\n\nМы уведомим вас, когда он будет доступен для покупки. В настоящее время вы можете приобрести другие наши продукты.',
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('🔙 Вернуться к списку продуктов', 'show_products')]
          ]
        }
      }
    );
    
    await ctx.answerCbQuery('Этот продукт пока в разработке');
    logWithTime(`Пользователь ${ctx.from.id} попытался выбрать продукт в разработке`);
  } catch (error) {
    console.error(`Ошибка при обработке продукта в разработке: ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

bot.action('back_to_menu', async (ctx) => {
  try {
    await ctx.editMessageText(
      'Выберите действие:',
      mainKeyboard()
    );
    await ctx.answerCbQuery();
  } catch (error) {
    console.error(`Ошибка при возврате в меню: ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

// Обработка покупок - ТОЛЬКО ОДИН обработчик для выбора продуктов
bot.action(/buy_(.+)/, handleBuyAction);

// Обработчик для простой кнопки оформления заказа - универсальный для всех продуктов
bot.action(/confirm_simple_(.+)/, async (ctx) => {
  console.log('========== УПРОЩЕННЫЙ ОБРАБОТЧИК ЗАПУЩЕН ==========');
  const productId = ctx.match[1];
  const userId = ctx.from.id;
  console.log(`Пользователь ${userId} нажал на простую кнопку для продукта ${productId}`);
  
  try {
    // Получаем выбранный продукт
    const product = products[productId];
    
    if (!product) {
      console.error(`Продукт с ID ${productId} не найден`);
      await ctx.answerCbQuery('Продукт не найден');
      return false;
    }
    
    // Отправляем запрос на email
    await ctx.reply(
      messageTemplates.emailRequest(product.name),
      { parse_mode: 'Markdown' }
    );
    
    // Сохраняем информацию о выбранном продукте
    global.botData.pendingOrders[userId] = {
      productId: productId,
      status: 'waiting_email',
      timestamp: new Date().toISOString(),
      simpleHandler: true
    };
    
    await ctx.answerCbQuery('✅ Начинаем оформление заказа');
    console.log(`Пользователь ${userId} начал оформление через простую кнопку для продукта ${productId}`);
    logWithTime(`[CONFIRM_SIMPLE] Начато оформление заказа для пользователя ${userId}, продукт: ${product.name}`);
    return true;
  } catch (error) {
    console.error(`Ошибка в простом обработчике: ${error.message}`);
    console.error(`Stack trace: ${error.stack}`);
    await ctx.answerCbQuery('Произошла ошибка');
    return false;
  }
});

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

bot.action('show_consultations', async (ctx) => {
  try {
    const userId = ctx.from.id;
    
    if (completedOrders[userId]) {
      // Фильтруем только заказы с консультациями
      const consultations = completedOrders[userId].filter(
        order => order.productId === 'individual' || order.productId === 'package'
      );
      
      if (consultations.length > 0) {
        // Сначала отправляем логотип
        await ctx.replyWithPhoto(
          { source: 'files/logo.jpg' },
          { caption: '🎬 Ваши индивидуальные консультации' }
        );
        
        // Небольшая задержка для лучшего UX
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const consultationLines = consultations.map((order, index) => {
          const product = products[order.productId];
          const date = new Date(order.completedAt).toLocaleDateString();
          const recordingStatus = order.recordingSent 
            ? `\n   Запись: ✅ Отправлена ${new Date(order.recordingSentDate).toLocaleDateString()}`
            : '\n   Запись: ⏳ Ожидается';
          
          return `${index + 1}. *${product.name}*\n   Дата: ${date}${recordingStatus}`;
        });
        
        const message = '🎬 *Ваши консультации*:\n\n' + 
                      consultationLines.join('\n\n') + 
                      '\n\nЗаписи консультаций будут отправлены вам после проведения занятия.';
        
        await ctx.reply(message, { 
          parse_mode: 'Markdown',
          reply_markup: {
            ...consultationsKeyboard().reply_markup
          }
        });
        
      } else {
        await ctx.reply(
          'У вас пока нет заказанных консультаций. Выберите "🛒 Купить курс", чтобы приобрести индивидуальное занятие.',
          {
            reply_markup: {
              ...mainKeyboard().reply_markup,
              remove_keyboard: true
            }
          }
        );
      }
    } else {
      await ctx.reply(
        'У вас пока нет заказанных консультаций. Выберите "🛒 Купить курс", чтобы приобрести индивидуальное занятие.',
        {
          reply_markup: {
            ...mainKeyboard().reply_markup,
            remove_keyboard: true
          }
        }
      );
    }
    
    await ctx.answerCbQuery();
    logWithTime(`Пользователь ${userId} просмотрел свои консультации`);
  } catch (error) {
    console.error(`Ошибка при просмотре консультаций: ${error.message}`);
    await ctx.reply('Произошла ошибка при загрузке ваших консультаций. Пожалуйста, попробуйте позже.', {
      reply_markup: {
        ...mainKeyboard().reply_markup,
        remove_keyboard: true
      }
    });
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

bot.action('refresh_consultations', async (ctx) => {
  try {
    // Просто перезагружаем экран консультаций
    await ctx.deleteMessage();
    await ctx.answerCbQuery('Обновляем список...');
    
    // Эмулируем нажатие на кнопку "Мои консультации"
    const fakeContext = {...ctx};
    await bot.action('show_consultations')(fakeContext);
  } catch (error) {
    console.error(`Ошибка при обновлении консультаций: ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка при обновлении');
  }
});

// Обработка текстовых сообщений для email и телефона
bot.on('text', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const text = ctx.message.text;
    
    // Если это админ и мы ждем ссылку на запись
    if (userId.toString() === ADMIN_ID.toString() && 
        global.botData.adminState && 
        global.botData.adminState.action === 'waiting_recording_link') {
      
      // Сохраняем ссылку
      global.botData.adminState.recordingLink = text;
      global.botData.adminState.action = 'waiting_recording_notes';
      
      await ctx.reply(
        '✅ Ссылка сохранена.\n\nТеперь вы можете добавить заметки или рекомендации, которые будут отправлены вместе с записью (или отправьте "нет" чтобы пропустить этот шаг).'
      );
      
      return;
    }
    
    // Если это админ и мы ждем заметки к записи
    if (userId.toString() === ADMIN_ID.toString() && 
        global.botData.adminState && 
        global.botData.adminState.action === 'waiting_recording_notes') {
      
      const { adminState } = global.botData;
      const notes = text.toLowerCase() === 'нет' ? '' : text;
      
      const success = await sendConsultationRecording(
        adminState.clientId, 
        adminState.recordingLink,
        notes
      );
      
      if (success) {
        await ctx.reply('✅ Запись консультации успешно отправлена клиенту!');
      } else {
        await ctx.reply('❌ Не удалось отправить запись. Проверьте логи для деталей.');
      }
      
      // Очищаем состояние
      global.botData.adminState = null;
      
      return;
    }
    
    // Другие обработчики текста (для email и телефона)
    await handleTextInput(ctx);
  } catch (error) {
    console.error(`Ошибка при обработке текстового ввода: ${error.message}`);
    if (ctx.from.id.toString() === ADMIN_ID.toString()) {
      await ctx.reply(`❌ Ошибка: ${error.message}`);
    } else {
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте еще раз.');
    }
  }
});

// Обработчики для администратора
bot.hears(/^\/confirm_(\d+)$/, async (ctx) => {
  try {
    if (ctx.from.id.toString() !== ADMIN_ID.toString()) {
      return;
    }
    
    const clientId = ctx.match[1];
    await confirmPayment(clientId);
    
    logWithTime(`Администратор подтвердил оплату для пользователя ${clientId}`);
  } catch (error) {
    console.error(`Ошибка при подтверждении оплаты: ${error.message}`);
    await ctx.reply(`❌ Ошибка: ${error.message}`);
  }
});

bot.action(/confirm_payment_(\d+)/, async (ctx) => {
  try {
    // Проверка прав администратора
    if (ctx.from.id.toString() !== ADMIN_ID.toString()) {
      return await ctx.answerCbQuery('⛔ У вас нет доступа к этой функции');
    }
    
    const clientId = ctx.match[1];
    await confirmPayment(clientId);
    await ctx.answerCbQuery('✅ Оплата подтверждена. Материалы отправлены клиенту.');
    
    logWithTime(`Администратор подтвердил оплату через кнопку для пользователя ${clientId}`);
  } catch (error) {
    console.error(`Ошибка при подтверждении оплаты через кнопку: ${error.message}`);
    await ctx.answerCbQuery(`❌ Ошибка: ${error.message.substring(0, 50)}`);
  }
});

bot.action(/prepare_recording_(\d+)/, async (ctx) => {
  try {
    // Проверка прав администратора
    if (ctx.from.id.toString() !== ADMIN_ID.toString()) {
      return await ctx.answerCbQuery('⛔ У вас нет доступа к этой функции');
    }
    
    const clientId = ctx.match[1];
    
    // Сохраняем состояние для последующего ввода ссылки
    global.botData.adminState = {
      action: 'waiting_recording_link',
      clientId
    };
    
    await ctx.reply(
      `🎥 Подготовка к отправке записи консультации клиенту (ID: ${clientId}).\n\nПожалуйста, отправьте ссылку на запись консультации.`
    );
    
    await ctx.answerCbQuery('Подготовка к отправке записи');
  } catch (error) {
    console.error(`Ошибка при подготовке отправки записи: ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

bot.action(/cancel_order_(\d+)/, async (ctx) => {
  try {
    // Проверка прав администратора
    if (ctx.from.id.toString() !== ADMIN_ID.toString()) {
      return await ctx.answerCbQuery('⛔ У вас нет доступа к этой функции');
    }
    
    const clientId = ctx.match[1];
    
    if (pendingOrders[clientId]) {
      const product = products[pendingOrders[clientId].productId];
      
      // Уведомляем клиента
      await bot.telegram.sendMessage(
        clientId,
        `❌ Ваш заказ "${product.name}" был отменен.\n\nЕсли у вас возникли вопросы, пожалуйста, свяжитесь с Анастасией.`,
        {
          reply_markup: {
            ...mainKeyboard().reply_markup,
            remove_keyboard: true
          }
        }
      );
      
      // Удаляем заказ из ожидающих
      delete pendingOrders[clientId];
      
      await ctx.reply(`✅ Заказ клиента ${clientId} отменен.`);
      logWithTime(`Заказ пользователя ${clientId} отменен администратором`);
    } else {
      await ctx.reply('❌ Заказ не найден.');
    }
    
    await ctx.answerCbQuery();
  } catch (error) {
    console.error(`Ошибка при отмене заказа: ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

bot.action(/message_client_(\d+)/, async (ctx) => {
  try {
    // Проверка прав администратора
    if (ctx.from.id.toString() !== ADMIN_ID.toString()) {
      return await ctx.answerCbQuery('⛔ У вас нет доступа к этой функции');
    }
    
    const clientId = ctx.match[1];
    
    // Создаем прямую ссылку на чат с клиентом
    await ctx.reply(
      `✏️ Нажмите на кнопку ниже, чтобы открыть диалог с клиентом ID: ${clientId}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '💬 Открыть чат с клиентом', url: `tg://user?id=${clientId}` }]
          ]
        }
      }
    );
    
    await ctx.answerCbQuery('Создаю ссылку на чат');
  } catch (error) {
    console.error(`Ошибка при подготовке сообщения клиенту: ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

// Обработчик неизвестных команд
bot.on('message', async (ctx) => {
  try {
    // Пропускаем обработанные сообщения
    if (ctx.message.text && (
      ctx.message.text.startsWith('/') || 
      (pendingOrders[ctx.from.id] && 
       (pendingOrders[ctx.from.id].status === 'waiting_email' || 
        pendingOrders[ctx.from.id].status === 'waiting_phone')
      )
    )) {
      return;
    }
    
    // Для остальных сообщений показываем подсказку и удаляем клавиатуру
    await ctx.reply(
      'Используйте кнопки меню для навигации или напишите /start, чтобы начать заново.',
      {
        reply_markup: {
          ...mainKeyboard().reply_markup,
          remove_keyboard: true
        }
      }
    );
  } catch (error) {
    console.error(`Ошибка при обработке неизвестного сообщения: ${error.message}`);
  }
});

// Запуск бота
bot.launch()
  .then(() => {
    console.log('Bot has been started');
    logWithTime('Бот успешно запущен');
    
    // Настройка планировщика задач
    setupScheduler(bot, ADMIN_ID);
    
    // Настройка самопинга (если указан URL приложения)
    const appUrl = process.env.APP_URL;
    if (appUrl) {
      setupPing(appUrl, 14); // пинг каждые 14 минут (меньше 15 мин для Render)
      logWithTime(`Настроен самопинг для ${appUrl}`);
    } else {
      logWithTime('APP_URL не указан в .env, самопинг не настроен');
    }
  })
  .catch(err => {
    console.error('Error starting bot:', err);
    logWithTime(`Ошибка при запуске бота: ${err.message}`);
  });

// Настройка graceful shutdown
process.once('SIGINT', () => {
  logWithTime('Получен сигнал SIGINT, останавливаем бота...');
  bot.stop('SIGINT');
  logWithTime('Бот остановлен по SIGINT');
});

process.once('SIGTERM', () => {
  logWithTime('Получен сигнал SIGTERM, останавливаем бота...');
  bot.stop('SIGTERM');
  logWithTime('Бот остановлен по SIGTERM');
});

// НАСТРОЙКА EXPRESS СЕРВЕРА

// Создаем Express сервер для поддержки хостинга
const app = express();
const PORT = process.env.PORT || 3000;

// Переменная для отслеживания времени запуска
const startTime = new Date();

// Простой роут для проверки работоспособности
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
          <strong>Status:</strong> Bot is running!
        </div>
        <div class="info">
          <p><strong>Uptime:</strong> ${uptimeFormatted}</p>
          <p><strong>Started:</strong> ${startTime.toLocaleString()}</p>
          <p><strong>Last ping:</strong> ${new Date().toLocaleString()}</p>
        </div>
      </body>
    </html>
  `);
  logWithTime(`Запрос к главной странице (uptime: ${uptimeFormatted})`);
});

// Добавляем эндпоинт для пинга (чистый текст для быстрого ответа)
app.get('/ping', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send('pong');
  logWithTime('Получен пинг-запрос');
});

// Добавляем маршрут для мониторинга статуса (JSON для автоматического мониторинга)
app.get('/status', (req, res) => {
  const status = {
    status: 'ok',
    uptime: Math.floor((new Date() - startTime) / 1000),
    startTime: startTime.toISOString(),
    currentTime: new Date().toISOString(),
    memory: process.memoryUsage()
  };
  
  res.json(status);
  logWithTime('Запрос статуса бота');
});

// Форматирование времени работы
function formatUptime(seconds) {
  const days = Math.floor(seconds / (3600 * 24));
  seconds -= days * 3600 * 24;
  const hours = Math.floor(seconds / 3600);
  seconds -= hours * 3600;
  const minutes = Math.floor(seconds / 60);
  seconds -= minutes * 60;
  
  let result = '';
  if (days > 0) result += `${days}d `;
  if (hours > 0) result += `${hours}h `;
  if (minutes > 0) result += `${minutes}m `;
  result += `${seconds}s`;
  
  return result;
}

// Запускаем сервер
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  logWithTime(`Express сервер запущен на порту ${PORT}`);
});
