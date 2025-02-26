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

module.exports = handleStart;

// Обработчик выбора продукта
async function handleBuyAction(ctx) {
  console.log('==== НАЧАЛО handleBuyAction ====');
  console.log('Тип контекста:', ctx.updateType);
  
  try {
    const productId = ctx.match[1];
    console.log('ID продукта:', productId);
    
    const product = products[productId];
    console.log('Найденный продукт:', product ? product.name : 'Не найден');
    
    if (!product) {
      console.log('❌ Продукт не найден');
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

    console.log('Содержимое сообщения:', messageContent);
    console.log('Опции сообщения:', JSON.stringify(messageOptions, null, 2));

    try {
      if (ctx.updateType === 'callback_query') {
        console.log('Попытка редактирования существующего сообщения');
        await ctx.editMessageText(messageContent, messageOptions);
        await ctx.answerCbQuery('✅ Информация о продукте');
        console.log('✅ Сообщение успешно отредактировано');
      } else {
        console.log('Отправка нового сообщения');
        await ctx.reply(messageContent, messageOptions);
        console.log('✅ Новое сообщение отправлено');
      }
    } catch (editError) {
      console.error('❌ Ошибка при обработке сообщения:', editError);

      // Обработка специфических ошибок
      if (editError.description === 'Bad Request: message is not modified') {
        console.log('ℹ️ Сообщение не требует изменений');
        await ctx.answerCbQuery('✅ Информация о продукте');
      } else {
        console.log('Попытка отправить новое сообщение');
        await ctx.reply(messageContent, messageOptions);
        await ctx.answerCbQuery('✅ Информация о продукте');
      }
    }
    
    logWithTime(`Пользователь ${ctx.from.id} просматривает продукт: ${product.name}`);
  } catch (error) {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА при выборе продукта:', error);
    
    try {
      if (ctx.updateType === 'callback_query') {
        await ctx.answerCbQuery('Не удалось загрузить информацию');
      }
      
      await ctx.reply('❌ Возникла проблема при загрузке информации о продукте. Попробуйте позже.');
    } catch (secondaryError) {
      console.error('❌ Критическая дополнительная ошибка:', secondaryError);
    }
  } finally {
    console.log('==== КОНЕЦ handleBuyAction ====');
  }
}

module.exports = handleBuyAction;

// Обработчик подтверждения начала покупки
async function handleConfirmBuy(ctx) {
  console.log('==== НАЧАЛО handleConfirmBuy ====');
  
  try {
    const productId = ctx.match[1];
    const userId = ctx.from.id;
    console.log(`Начало оформления заказа: UserID ${userId}, ProductID ${productId}`);
    
    const product = products[productId];
    
    if (!product) {
      console.log('❌ Продукт не найден');
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
    const previousOrdersCount = Object.keys(global.botData.pendingOrders)
      .filter(key => global.botData.pendingOrders[key].userId === userId)
      .length;
    
    console.log(`Количество предыдущих незавершенных заказов: ${previousOrdersCount}`);
    
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
    
    console.log('✅ Заказ сохранен в pendingOrders');
    
    await ctx.answerCbQuery('✅ Начинаем оформление заказа');
    
    logWithTime(`Пользователь ${userId} начал оформление заказа: ${product.name}`);
  } catch (error) {
    console.error('❌ Ошибка при подтверждении покупки:', error);
    
    try {
      await ctx.answerCbQuery('Произошла ошибка');
      await ctx.reply('❌ Не удалось начать оформление заказа. Попробуйте еще раз.');
    } catch (secondaryError) {
      console.error('❌ Дополнительная ошибка:', secondaryError);
    }
  } finally {
    console.log('==== КОНЕЦ handleConfirmBuy ====');
  }
}

module.exports = handleConfirmBuy;

// Обработчик текстовых сообщений (для получения email и телефона)
async function handleTextInput(ctx) {
  console.log('==== НАЧАЛО handleTextInput ====');
  
  try {
    const userId = ctx.from.id;
    const text = ctx.message.text;
    const { pendingOrders } = global.botData;
    
    console.log(`Получено текстовое сообщение от пользователя ${userId}: ${text}`);
    
    // Если нет ожидающего заказа, показываем главное меню
    if (!pendingOrders[userId]) {
      if (text === '/start') return;
      
      console.log('Нет ожидающего заказа, показываем главное меню');
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
      console.log('Ожидается ввод email');
      
      if (!validators.email(text)) {
        console.log('❌ Некорректный email');
        return await ctx.reply(messageTemplates.emailInvalid);
      }
      
      pendingOrders[userId].email = text;
      pendingOrders[userId].status = 'waiting_phone';
      
      console.log(`✅ Email сохранен: ${text}`);
      
      await ctx.reply(messageTemplates.phoneRequest);
      
      logWithTime(`Пользователь ${userId} ввел email: ${text}`);
    } 
    // Обработка номера телефона
    else if (pendingOrders[userId].status === 'waiting_phone') {
      console.log('Ожидается ввод телефона');
      
      const cleanedPhone = text.replace(/\s+/g, '');
      
      if (!validators.phone(cleanedPhone)) {
        console.log('❌ Некорректный номер телефона');
        return await ctx.reply(messageTemplates.phoneInvalid);
      }
      
      pendingOrders[userId].phone = cleanedPhone;
      pendingOrders[userId].status = 'waiting_payment';
      
      console.log(`✅ Телефон сохранен: ${cleanedPhone}`);
      
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
    console.error('❌ Ошибка при обработке текстового сообщения:', error);
    
    await ctx.reply(
      messageTemplates.errorMessage, 
      {
        reply_markup: {
          ...mainKeyboard().reply_markup,
          remove_keyboard: true
        }
      }
    );
  } finally {
    console.log('==== КОНЕЦ handleTextInput ====');
  }
}

module.exports = handleTextInput;

// Файл: handlers.js
// Обработчики основных сообщений пользователя

const { products, messageTemplates } = require('./data');
const { mainKeyboard, logWithTime, validators } = require('./utils');
const { Markup } = require('telegraf');

const handleStart = require('./handle-start');
const handleBuyAction = require('./handle-buy-action');
const handleConfirmBuy = require('./handle-confirm-buy');
const handleTextInput = require('./handle-text-input');

module.exports = {
  handleStart,
  handleBuyAction,
  handleConfirmBuy,
  handleTextInput
};
