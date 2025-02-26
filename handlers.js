// Файл: handlers.js
// Обработчики основных сообщений пользователя

const { products, messageTemplates } = require('./data');
const { mainKeyboard, logWithTime, validators } = require('./utils');
const { Markup } = require('telegraf');

// Обработчик команды start
async function handleStart(ctx) {
  try {
    const userId = ctx.from.id;
    const firstName = ctx.from.first_name || 'друг';
    
    await ctx.reply(
      `👋 Приветствую, ${firstName}!\n\nЯ бот Анастасии Поповой, инструктора по дыхательным практикам. Через меня вы можете приобрести курсы и получить материалы.\n\nВыберите действие:`,
      {
        reply_markup: {
          ...mainKeyboard().reply_markup,
          remove_keyboard: true
        }
      }
    );

    const { bot, ADMIN_ID } = global.botData;
    
    if (userId !== parseInt(ADMIN_ID)) {
      bot.telegram.sendMessage(
        ADMIN_ID,
        `🆕 Новый пользователь:\n- Имя: ${firstName} ${ctx.from.last_name || ''}\n- Username: @${ctx.from.username || 'отсутствует'}\n- ID: ${userId}`
      ).catch(e => console.error(`Ошибка при уведомлении админа: ${e.message}`));
    }
    
    logWithTime(`Новый пользователь: ${userId}, ${ctx.from.username || 'без username'}`);
  } catch (error) {
    console.error(`Ошибка в обработчике /start: ${error.message}`);
  }
}

async function handleBuyAction(ctx) {
  try {
    const productId = ctx.match[1];
    const product = products[productId];
    
    if (!product) {
      await ctx.answerCbQuery('❌ Продукт не найден');
      return;
    }

    const messageContent = product.fullDescription || product.productInfo;
    const messageOptions = { 
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [Markup.button.callback('💳 Оформить заказ', `confirm_buy_${productId}`)],
          [Markup.button.callback('◀️ Назад к списку', 'show_products')]
        ]
      }
    };

    // Отладочные логи
    console.log('Тип контекста:', ctx.updateType);
    console.log('Callback query:', ctx.callbackQuery);

    if (ctx.updateType === 'callback_query') {
      try {
        await ctx.editMessageText(messageContent, messageOptions);
        await ctx.answerCbQuery('✅ Информация о продукте');
      } catch (editError) {
        console.error('Ошибка редактирования:', editError);

        // Более детальная обработка ошибок
        if (editError.description === 'Bad Request: message is not modified') {
          await ctx.answerCbQuery('✅ Информация о продукте');
        } else {
          // Если редактирование не удалось, отправляем новое сообщение
          await ctx.reply(messageContent, messageOptions);
          await ctx.answerCbQuery('✅ Информация о продукте');
        }
      }
    } else {
      // Для других типов контекста просто отправляем сообщение
      await ctx.reply(messageContent, messageOptions);
    }
    
    logWithTime(`Пользователь ${ctx.from.id} просматривает продукт: ${product.name}`);
  } catch (error) {
    console.error(`Полная ошибка при выборе продукта:`, error);
    
    try {
      if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery('Не удалось загрузить информацию');
      }
      
      await ctx.reply('❌ Возникла проблема при загрузке информации о продукте. Попробуйте позже.');
    } catch (secondaryError) {
      console.error('Дополнительная ошибка:', secondaryError);
    }
  }
}
// Обработчик подтверждения начала покупки
async function handleConfirmBuy(ctx) {
  try {
    const productId = ctx.match[1];
    const userId = ctx.from.id;
    const product = products[productId];
    
    if (!product) {
      await ctx.answerCbQuery('❌ Продукт не найден');
      return;
    }
    
    await ctx.editMessageText(
      messageTemplates.emailRequest(product.name),
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '◀️ Назад', callback_data: 'show_products' }]
          ]
        }
      }
    );
    
    // Очищаем предыдущие незавершенные заказы пользователя
    Object.keys(global.botData.pendingOrders)
      .filter(key => global.botData.pendingOrders[key].userId === userId)
      .forEach(key => delete global.botData.pendingOrders[key]);
    
    // Сохраняем новый заказ
    global.botData.pendingOrders[userId] = {
      userId,
      productId,
      status: 'waiting_email',
      timestamp: new Date().toISOString()
    };
    
    await ctx.answerCbQuery('✅ Начинаем оформление заказа');
    
    logWithTime(`Пользователь ${userId} начал оформление заказа: ${product.name}`);
  } catch (error) {
    console.error(`Ошибка при подтверждении покупки: ${error.message}`);
    
    try {
      await ctx.answerCbQuery('Произошла ошибка');
      await ctx.reply('❌ Не удалось начать оформление заказа. Попробуйте еще раз.');
    } catch (secondaryError) {
      console.error('Дополнительная ошибка:', secondaryError);
    }
  }
}

// Обработчик текстовых сообщений (для получения email и телефона)
async function handleTextInput(ctx) {
  try {
    const userId = ctx.from.id;
    const text = ctx.message.text;
    const { pendingOrders } = global.botData;
    
    // Если нет ожидающего заказа, показываем главное меню
    if (!pendingOrders[userId]) {
      if (text === '/start') return;
      
      await ctx.reply(
        'Используйте кнопки меню ниже для навигации:',
        {
          reply_markup: {
            ...mainKeyboard().reply_markup,
            remove_keyboard: true
          }
        }
      );
      return;
    }
    
    // Обработка email
    if (pendingOrders[userId].status === 'waiting_email') {
      if (!validators.email(text)) {
        return await ctx.reply(messageTemplates.emailInvalid);
      }
      
      pendingOrders[userId].email = text;
      pendingOrders[userId].status = 'waiting_phone';
      
      await ctx.reply(messageTemplates.phoneRequest);
      
      logWithTime(`Пользователь ${userId} ввел email: ${text}`);
    } 
    // Обработка номера телефона
    else if (pendingOrders[userId].status === 'waiting_phone') {
      const cleanedPhone = text.replace(/\s+/g, '');
      
      if (!validators.phone(cleanedPhone)) {
        return await ctx.reply(messageTemplates.phoneInvalid);
      }
      
      pendingOrders[userId].phone = cleanedPhone;
      pendingOrders[userId].status = 'waiting_payment';
      
      const product = products[pendingOrders[userId].productId];
      
      await ctx.reply(
        messageTemplates.orderReady(product.name, product.price),
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            ...mainKeyboard().reply_markup,
            remove_keyboard: true
          }
        }
      );
      
      logWithTime(`Пользователь ${userId} ввел телефон: ${cleanedPhone}`);
      
      // Отправляем уведомление администратору
      const { notifyAdmin } = require('./admin');
      await notifyAdmin(userId);
    }
  } catch (error) {
    console.error(`Ошибка при обработке текстового сообщения: ${error.message}`);
    
    await ctx.reply(
      messageTemplates.errorMessage, 
      {
        reply_markup: {
          ...mainKeyboard().reply_markup,
          remove_keyboard: true
        }
      }
    );
  }
}

module.exports = {
  handleStart,
  handleBuyAction,
  handleConfirmBuy,
  handleTextInput
};
