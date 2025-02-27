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
    
    console.log(`[START] Обработка команды start для пользователя ${userId}`);
    
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
    console.error(`[ERROR] Ошибка в обработчике /start: ${error.message}`);
    console.error(`[ERROR] Стек ошибки: ${error.stack}`);
  }
}

// Обработчик выбора продукта
async function handleBuyAction(ctx) {
  console.log('=========== НАЧАЛО handleBuyAction ===========');
  console.log('Полный объект ctx:', JSON.stringify(ctx, null, 2));
  
  try {
    const productId = ctx.match[1];
    console.log(`[BUY] Пользователь ${ctx.from.id} выбрал продукт с ID: ${productId}`);
    console.log('[BUY] Полный match объект:', JSON.stringify(ctx.match, null, 2));
    
    const product = products[productId];
    
    if (!product) {
      console.log(`[BUY] Продукт с ID ${productId} не найден`);
      await ctx.reply('❌ Продукт не найден. Пожалуйста, выберите из доступных вариантов.', {
        reply_markup: {
          ...mainKeyboard().reply_markup,
          remove_keyboard: true
        }
      });
      return await ctx.answerCbQuery();
    }

    console.log(`[BUY] Найден продукт: ${product.name}`);
    
    const description = product.fullDescription || product.productInfo;
    const confirmCallbackData = `confirm_buy_${productId}`;
    
    console.log(`[BUY] Создан callback для кнопки оформления: ${confirmCallbackData}`);
    
    // Создаем расширенный набор кнопок для отладки
    const inlineKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('💳 Оформить заказ', confirmCallbackData)],
      [Markup.button.callback('💳 Прямая кнопка (starter)', `confirm_buy_starter`)],
      [Markup.button.callback('◀️ Назад к списку', 'show_products')]
    ]);
    
    console.log('[BUY] Отправка описания продукта');
    
    await ctx.reply(
      description,
      { 
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard.reply_markup
      }
    );
    
    await ctx.answerCbQuery('✅ Информация о продукте');
    
    logWithTime(`Пользователь ${ctx.from.id} просматривает продукт: ${product.name}`);
  } catch (error) {
    console.error(`[ERROR] Ошибка при выборе продукта: ${error.message}`);
    console.error(`[ERROR] Стек ошибки: ${error.stack}`);
    
    try {
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте еще раз.', {
        reply_markup: {
          ...mainKeyboard().reply_markup,
          remove_keyboard: true
        }
      });
      await ctx.answerCbQuery('Произошла ошибка');
    } catch (replyError) {
      console.error(`[ERROR] Не удалось отправить сообщение об ошибке: ${replyError.message}`);
    }
  }
}

// Обработчик подтверждения начала покупки
async function handleConfirmBuy(ctx) {
  console.log('=========== НАЧАЛО handleConfirmBuy ===========');
  console.log('Полный объект ctx:', JSON.stringify(ctx, null, 2));
  console.log('Тип контекста:', ctx.updateType);
  console.log('Callback query:', JSON.stringify(ctx.callbackQuery, null, 2));
  
  try {
    // Извлекаем ID продукта из callback data
    const actionParts = ctx.callbackQuery.data.split('_');
    const productId = actionParts[2]; // ['confirm', 'buy', 'starter']
    
    console.log('[CONFIRM_BUY] Разобранный callback:', actionParts);
    console.log('[CONFIRM_BUY] ID продукта:', productId);
    console.log('[CONFIRM_BUY] Полный список продуктов:', Object.keys(products));
    
    const product = products[productId];
    console.log('[CONFIRM_BUY] Найденный продукт:', product ? product.name : 'Не найден');
    
    if (!product) {
      console.log('[CONFIRM_BUY] ❌ Продукт не найден');
      await ctx.answerCbQuery('❌ Продукт не найден');
      return;
    }
    
    // Редактируем существующее сообщение
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
    
    // Сохраняем информацию о заказе
    const userId = ctx.from.id;
    
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
    
    console.log('[CONFIRM_BUY] Данные заказа:', 
      JSON.stringify(global.botData.pendingOrders[userId], null, 2)
    );
    
    await ctx.answerCbQuery('✅ Начинаем оформление заказа');
    
    logWithTime(`Пользователь ${userId} начал оформление заказа: ${product.name}`);
  } catch (error) {
    console.error('[CONFIRM_BUY] ПОЛНАЯ ОШИБКА:', error);
    console.error('[CONFIRM_BUY] Стек ошибки:', error.stack);
    
    try {
      await ctx.answerCbQuery('Произошла ошибка');
      await ctx.reply('❌ Не удалось начать оформление заказа. Попробуйте еще раз.', {
        reply_markup: {
          ...mainKeyboard().reply_markup,
          remove_keyboard: true
        }
      });
    } catch (secondaryError) {
      console.error('[CONFIRM_BUY] Дополнительная ошибка:', secondaryError);
    }
  }
}

// Обработчик текстовых сообщений (для получения email и телефона)
async function handleTextInput(ctx) {
  try {
    const userId = ctx.from.id;
    const text = ctx.message.text;
    const { pendingOrders } = global.botData;
    
    console.log(`[TEXT] Получено текстовое сообщение от пользователя ${userId}: "${text}"`);
    
    // Если нет ожидающего заказа, показываем главное меню
    if (!pendingOrders[userId]) {
      console.log(`[TEXT] У пользователя ${userId} нет ожидающего заказа`);
      
      // Если получена команда /start, не реагируем - она обрабатывается отдельно
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
    
    console.log(`[TEXT] Найден ожидающий заказ для пользователя ${userId}, статус: ${pendingOrders[userId].status}`);
    
    // Обработка email
    if (pendingOrders[userId].status === 'waiting_email') {
      console.log(`[TEXT] Обработка email от пользователя ${userId}`);
      
      if (!validators.email(text)) {
        console.log(`[TEXT] Некорректный email: ${text}`);
        return await ctx.reply(messageTemplates.emailInvalid);
      }
      
      pendingOrders[userId].email = text;
      pendingOrders[userId].status = 'waiting_phone';
      
      await ctx.reply(messageTemplates.phoneRequest);
      
      logWithTime(`Пользователь ${userId} ввел email: ${text}`);
    } 
    // Обработка номера телефона
    else if (pendingOrders[userId].status === 'waiting_phone') {
      console.log(`[TEXT] Обработка номера телефона от пользователя ${userId}`);
      
      const cleanedPhone = text.replace(/\s+/g, '');
      
      if (!validators.phone(cleanedPhone)) {
        console.log(`[TEXT] Некорректный номер телефона: ${cleanedPhone}`);
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
      try {
        const { notifyAdmin } = require('./admin');
        await notifyAdmin(userId);
      } catch (adminError) {
        console.error(`[ERROR] Ошибка при уведомлении администратора: ${adminError.message}`);
      }
    }
  } catch (error) {
    console.error(`[ERROR] Ошибка при обработке текстового сообщения: ${error.message}`);
    console.error(`[ERROR] Стек ошибки: ${error.stack}`);
    
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
