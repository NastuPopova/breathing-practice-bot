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
    
    // Удаляем клавиатуру и показываем меню с inline-кнопками
    await ctx.reply(
      `👋 Приветствую, ${firstName}!\n\nЯ бот Анастасии Поповой, инструктора по дыхательным практикам. Через меня вы можете приобрести курсы и получить материалы.\n\nВыберите действие:`,
      {
        reply_markup: {
          ...mainKeyboard().reply_markup,
          remove_keyboard: true
        }
      }
    );

    // Уведомление администратору о новом пользователе, но только если это не сам админ
    const { bot, ADMIN_ID } = global.botData;
    
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
}

// Обработчик выбора продукта
async function handleBuyAction(ctx) {
  try {
    const productId = ctx.match[1];
    const userId = ctx.from.id;
    const product = products[productId];
    
    if (!product) {
      await ctx.answerCbQuery('❌ Продукт не найден');
      return;
    }

    // Редактируем существующее сообщение
    await ctx.editMessageText(
      product.fullDescription || product.productInfo,
      { 
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('💳 Оформить заказ', `confirm_buy_${productId}`)],
            [Markup.button.callback('◀️ Назад к списку', 'show_products')]
          ]
        }
      }
    );
    
    await ctx.answerCbQuery('✅ Загружаю информацию о продукте');
    
    logWithTime(`Пользователь ${userId} просматривает продукт: ${product.name}`);
  } catch (error) {
    console.error(`Ошибка при выборе продукта: ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
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
    
    // Сохраняем информацию о выбранном продукте
    global.botData.pendingOrders[userId] = {
      productId,
      status: 'waiting_email',
      timestamp: new Date().toISOString()
    };
    
    await ctx.answerCbQuery('✅ Начинаем оформление заказа');
    
    logWithTime(`Пользователь ${userId} начал оформление заказа: ${product.name}`);
  } catch (error) {
    console.error(`Полная ошибка при подтверждении покупки:`, error);
    
    try {
      // Пытаемся отправить более подробное сообщение об ошибке
      await ctx.reply(`❌ Произошла ошибка: ${error.message}`);
    } catch (replyError) {
      console.error('Не удалось отправить сообщение об ошибке:', replyError);
    }
    
    await ctx.answerCbQuery('Произошла ошибка');
  }
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
    
    // Сохраняем информацию о выбранном продукте
    global.botData.pendingOrders[userId] = {
      productId,
      status: 'waiting_email',
      timestamp: new Date().toISOString()
    };
    
    await ctx.answerCbQuery('✅ Начинаем оформление заказа');
    
    logWithTime(`Пользователь ${userId} начал оформление заказа: ${product.name}`);
  } catch (error) {
    console.error(`Ошибка при подтверждении покупки: ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
}

// Обработчик текстовых сообщений (для получения email и телефона)
async function handleTextInput(ctx) {
  try {
    const userId = ctx.from.id;
    const text = ctx.message.text;
    const { pendingOrders } = global.botData;
    
    // Если нет ожидающего заказа, возможно, нам нужно показать главное меню
    if (!pendingOrders[userId]) {
      // Если получена команда /start, не реагируем - она обрабатывается отдельно
      if (text === '/start') return;
      
      // Для любого другого текста показываем меню и подсказку, удаляем клавиатуру
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
      // Проверка формата email
      if (!validators.email(text)) {
        return await ctx.reply(messageTemplates.emailInvalid);
      }
      
      // Сохраняем email
      pendingOrders[userId].email = text;
      pendingOrders[userId].status = 'waiting_phone';
      
      // Запрашиваем номер телефона
      await ctx.reply(messageTemplates.phoneRequest);
      
      logWithTime(`Пользователь ${userId} ввел email: ${text}`);
    } 
    // Обработка номера телефона
    else if (pendingOrders[userId].status === 'waiting_phone') {
      // Проверка формата телефона
      const cleanedPhone = text.replace(/\s+/g, '');
      
      if (!validators.phone(cleanedPhone)) {
        return await ctx.reply(messageTemplates.phoneInvalid);
      }
      
      // Сохраняем телефон и обновляем статус
      pendingOrders[userId].phone = cleanedPhone;
      pendingOrders[userId].status = 'waiting_payment';
      
      const product = products[pendingOrders[userId].productId];
      
      // Отправляем информацию о заказе с inline-кнопками и удаляем клавиатуру
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
