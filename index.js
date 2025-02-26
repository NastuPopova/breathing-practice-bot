// Файл: index.js
// Основной файл Telegram-бота для продажи курсов по дыхательным практикам

const { Telegraf, Markup } = require('telegraf');
require('dotenv').config();
const express = require('express');
const fs = require('fs');

// Импортируем модули
const { products, messageTemplates } = require('./data');
const { mainKeyboard, fileExists, logWithTime } = require('./utils');
const { handleStart, handleBuyAction, handleTextInput } = require('./handlers');
const { notifyAdmin, confirmPayment } = require('./admin');

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
  completedOrders
};

// Обработчики команд
bot.start(handleStart);
bot.hears('🛒 Купить курс', async (ctx) => {
  try {
    await ctx.reply(
      '📚 Выберите продукт:',
      Markup.inlineKeyboard([
        [Markup.button.callback('🔰 Стартовый комплект - 990 ₽', 'buy_starter')],
        [Markup.button.callback('👥 Индивидуальная консультация - 1500 ₽', 'buy_consultation')],
        [Markup.button.callback('🏆 Полный курс видеоуроков - 14 999 ₽', 'buy_course')]
      ])
    );
    
    logWithTime(`Пользователь ${ctx.from.id} открыл меню выбора продукта`);
  } catch (error) {
    console.error(`Ошибка в обработчике "Купить курс": ${error.message}`);
  }
});

bot.action(/buy_(.+)/, handleBuyAction);
bot.on('text', handleTextInput);

// Обработчик для просмотра покупок пользователем
bot.hears('📝 Мои покупки', async (ctx) => {
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
      
      await ctx.reply(message, { parse_mode: 'Markdown' });
      logWithTime(`Пользователь ${userId} просмотрел свои покупки`);
    } else {
      await ctx.reply(messageTemplates.noPurchases);
    }
  } catch (error) {
    console.error(`Ошибка при просмотре покупок: ${error.message}`);
    await ctx.reply('Произошла ошибка при загрузке ваших покупок. Пожалуйста, попробуйте позже.');
  }
});

// Обработчик для кнопки "Связаться с преподавателем"
bot.hears('☎️ Связаться с преподавателем', async (ctx) => {
  try {
    await ctx.reply(
      `👩‍🏫 *Анастасия Попова*\n\nЕсли у вас возникли вопросы о курсах, дыхательных практиках или вы хотите получить персональную консультацию, напишите мне напрямую.\n\nЯ отвечаю в течение 24 часов в рабочие дни.`,
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✉️ Написать преподавателю', url: 'https://t.me/NastuPopova' }]
          ]
        }
      }
    );
    
    logWithTime(`Пользователь ${ctx.from.id} нажал "Связаться с преподавателем"`);
  } catch (error) {
    console.error(`Ошибка при обработке "Связаться с преподавателем": ${error.message}`);
  }
});
  
// Обработчик информации
bot.hears('❓ Информация', async (ctx) => {
  try {
    await ctx.reply(
      `ℹ️ *О курсах дыхательных практик*\n\n*Анастасия Попова* - сертифицированный инструктор по дыхательным практикам с опытом более 7 лет.\n\nНаши курсы помогут вам:\n\n• Повысить жизненную энергию\n• Снизить уровень стресса\n• Улучшить качество сна\n• Повысить иммунитет\n• Улучшить работу дыхательной системы\n\nВыберите "🛒 Купить курс" в меню, чтобы ознакомиться с доступными программами.`,
      { parse_mode: 'Markdown' }
    );
    
    logWithTime(`Пользователь ${ctx.from.id} запросил информацию`);
  } catch (error) {
    console.error(`Ошибка при обработке "Информация": ${error.message}`);
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
        mainKeyboard()
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
    
    await ctx.reply(
      `✏️ Введите сообщение для клиента ID: ${clientId}\n\nФормат:\n/msg_${clientId} Текст сообщения`
    );
    
    await ctx.answerCbQuery();
  } catch (error) {
    console.error(`Ошибка при подготовке сообщения клиенту: ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

bot.hears(/^\/msg_(\d+) (.+)$/, async (ctx) => {
  try {
    // Проверка прав администратора
    if (ctx.from.id.toString() !== ADMIN_ID.toString()) {
      return;
    }
    
    const clientId = ctx.match[1];
    const message = ctx.match[2];
    
    await bot.telegram.sendMessage(
      clientId,
      `📬 *Сообщение от Анастасии*:\n\n${message}`,
      { parse_mode: 'Markdown' }
    );
    
    await ctx.reply('✅ Сообщение успешно отправлено клиенту.');
    logWithTime(`Администратор отправил сообщение пользователю ${clientId}`);
  } catch (error) {
    console.error(`Ошибка при отправке сообщения клиенту: ${error.message}`);
    await ctx.reply(`❌ Ошибка при отправке сообщения: ${error.message}`);
  }
});

// Обработчик неизвестных команд
bot.on('message', async (ctx) => {
  try {
    // Пропускаем обработанные сообщения
    if (ctx.message.text && (
      ctx.message.text.startsWith('/') || 
      ['🛒 Купить курс', '❓ Информация', '📝 Мои покупки', '☎️ Связаться с преподавателем'].includes(ctx.message.text) ||
      (pendingOrders[ctx.from.id] && 
       (pendingOrders[ctx.from.id].status === 'waiting_email' || 
        pendingOrders[ctx.from.id].status === 'waiting_phone')
      )
    )) {
      return;
    }
    
    // Для остальных сообщений показываем подсказку
    await ctx.reply(
      'Используйте кнопки меню для навигации или напишите /start, чтобы начать заново.',
      mainKeyboard()
    );
  } catch (error) {
    console.error(`Ошибка при обработке неизвестного сообщения: ${error.message}`);
  }
});

// Запуск бота
bot.launch()
  .then(() => {
    console.log('Bot has been started');
    logWithTime('Бот запущен');
  })
  .catch(err => {
    console.error('Error starting bot:', err);
    logWithTime(`Ошибка при запуске бота: ${err.message}`);
  });

// Enable graceful stop
process.once('SIGINT', () => {
  bot.stop('SIGINT');
  logWithTime('Бот остановлен по SIGINT');
});
process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  logWithTime('Бот остановлен по SIGTERM');
});

// Создаем Express сервер для поддержки хостинга (Render, Heroku и т.д.)
const app = express();
const PORT = process.env.PORT || 3000;

// Простой роут для проверки работоспособности
app.get('/', (req, res) => {
  res.send('Bot is running!');
});

// Запускаем сервер
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  logWithTime(`Express сервер запущен на порту ${PORT}`);
});