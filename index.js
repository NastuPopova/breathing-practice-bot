// Файл: index.js
// Основной файл Telegram-бота с inline-кнопками

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
bot.start(async (ctx) => {
  try {
    const userId = ctx.from.id;
    const firstName = ctx.from.first_name || 'друг';
    
    await ctx.reply(
      `👋 Приветствую, ${firstName}!\n\nЯ бот Анастасии Поповой, инструктора по дыхательным практикам. Через меня вы можете приобрести курсы и получить материалы.\n\nЧем могу помочь?`,
      mainKeyboard()
    );

    // Уведомление администратору о новом пользователе, но только если это не сам админ
    if (userId !== parseInt(ADMIN_ID)) {
      // Отправляем уведомление админу асинхронно
      bot.telegram.sendMessage(
        ADMIN_ID,
        `🆕 Новый пользователь:\n- Имя: ${firstName} ${ctx.from.last_name || ''}\n- Username: @${ctx.from.username || 'отсутствует'}\n- ID: ${userId}`
      ).catch(e => console.error(`Ошибка при уведомлении админа: ${e.message}`));
    }
    
    logWithTime(`Новый пользователь: ${userId}, ${ctx.from.username || 'без username'}`);
  } catch (error) {
    console.error(`Ошибка в обработчике /start: ${error.message}`);
  }
});

// Обработчики для inline-кнопок
bot.action('show_products', async (ctx) => {
  try {
    await ctx.reply(
      '📚 Выберите продукт:',
      Markup.inlineKeyboard([
        [Markup.button.callback('🔰 Стартовый комплект - 990 ₽', 'buy_starter')],
        [Markup.button.callback('👥 Индивидуальная консультация - 1500 ₽', 'buy_consultation')],
        [Markup.button.callback('🏆 Полный курс видеоуроков - 14 999 ₽', 'buy_course')],
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

bot.action('show_info', async (ctx) => {
  try {
    await ctx.reply(
      `ℹ️ *О курсах дыхательных практик*\n\n*Анастасия Попова* - сертифицированный инструктор по дыхательным практикам с опытом более 7 лет.\n\nНаши курсы помогут вам:\n\n• Повысить жизненную энергию\n• Снизить уровень стресса\n• Улучшить качество сна\n• Повысить иммунитет\n• Улучшить работу дыхательной системы\n\nВыберите "🛒 Купить курс" в меню, чтобы ознакомиться с доступными программами.`,
      { 
        parse_mode: 'Markdown',
        ...mainKeyboard()
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
        ...mainKeyboard()
      });
      
      await ctx.answerCbQuery();
      logWithTime(`Пользователь ${userId} просмотрел свои покупки`);
    } else {
      await ctx.reply(messageTemplates.noPurchases, mainKeyboard());
      await ctx.answerCbQuery('У вас пока нет покупок');
    }
  } catch (error) {
    console.error(`Ошибка при просмотре покупок: ${error.message}`);
    await ctx.reply('Произошла ошибка при загрузке ваших покупок. Пожалуйста, попробуйте позже.', mainKeyboard());
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

// Обработка покупок
bot.action(/buy_(.+)/, async (ctx) => {
  try {
    const productId = ctx.match[1];
    const userId = ctx.from.id;
    const product = products[productId];
    
    if (!product) {
      await ctx.reply('❌ Продукт не найден. Пожалуйста, выберите из доступных вариантов.', mainKeyboard());
      return await ctx.answerCbQuery();
    }

    // Используем шаблонное сообщение
    await ctx.reply(
      messageTemplates.emailRequest(product.name),
      { parse_mode: 'Markdown' }
    );
    
    // Сохраняем информацию о выбранном продукте
    pendingOrders[userId] = {
      productId,
      status: 'waiting_email',
      timestamp: new Date().toISOString()
    };
    
    // Сразу уведомляем пользователя о обработке запроса для лучшего UX
    await ctx.answerCbQuery('✅ Продукт выбран');
    
    logWithTime(`Пользователь ${userId} выбрал продукт: ${product.name}`);
  } catch (error) {
    console.error(`Ошибка при выборе продукта: ${error.message}`);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте еще раз.', mainKeyboard());
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

// Обработка текстовых сообщений для email и телефона
bot.on('text', handleTextInput);

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

// Этот обработчик больше не нужен, можно оставить для совместимости со старыми сообщениями
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

// Создаем Express сервер для поддержки хостинга
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
