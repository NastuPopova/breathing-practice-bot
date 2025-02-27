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
    
    logWithTime(`[START] Обработка команды start от пользователя ${userId} (${firstName})`);
    
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
    logWithTime(`[START] Отправлено приветственное сообщение пользователю ${userId}`);

    // Уведомление администратору о новом пользователе, но только если это не сам админ
    const { bot, ADMIN_ID } = global.botData;
    
    if (userId !== parseInt(ADMIN_ID)) {
      // Отправляем уведомление админу асинхронно
      bot.telegram.sendMessage(
        ADMIN_ID,
        `🆕 Новый пользователь:\n- Имя: ${firstName} ${ctx.from.last_name || ''}\n- Username: @${ctx.from.username || 'отсутствует'}\n- ID: ${userId}`
      )
      .then(() => logWithTime(`[START] Администратор уведомлен о новом пользователе ${userId}`))
      .catch(e => console.error(`[ERROR] Ошибка при уведомлении админа: ${e.message}, stack: ${e.stack}`));
    }
    
    logWithTime(`[START] Команда start успешно обработана для пользователя ${userId}, ${ctx.from.username || 'без username'}`);
  } catch (error) {
    console.error(`[ERROR] Ошибка в обработчике /start: ${error.message}`);
    console.error(`[ERROR] Stack trace: ${error.stack}`);
  }
}

// Обработчик выбора продукта
async function handleBuyAction(ctx) {
  try {
    const productId = ctx.match[1];
    const userId = ctx.from.id;
    
    logWithTime(`[BUY] Пользователь ${userId} выбрал продукт с ID: ${productId}`);
    console.log(`[BUY] Полный match объект:`, JSON.stringify(ctx.match, null, 2));
    
    const product = products[productId];
    
    if (!product) {
      logWithTime(`[BUY] Продукт с ID ${productId} не найден`);
      await ctx.reply('❌ Продукт не найден. Пожалуйста, выберите из доступных вариантов.', {
        reply_markup: {
          ...mainKeyboard().reply_markup,
          remove_keyboard: true
        }
      });
      return await ctx.answerCbQuery();
    }

    logWithTime(`[BUY] Найден продукт: ${product.name}`);
    
    // Сначала показываем полное описание с кнопкой покупки
    // Используем fullDescription если доступно, иначе используем productInfo
    const description = product.fullDescription || product.productInfo;
    logWithTime(`[BUY] Подготовка к отправке описания продукта с кнопками`);
    
    // Создаем callback data для кнопки оформления заказа
    const confirmCallbackData = `confirm_buy_${productId}`;
    logWithTime(`[BUY] Создан callback для кнопки оформления: ${confirmCallbackData}`);
    
    // Создаем inline клавиатуру
    const inlineKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('💳 Оформить заказ', confirmCallbackData)],
      [Markup.button.callback('◀️ Назад к списку', 'show_products')]
    ]);
    
    logWithTime(`[BUY] Отправка описания продукта пользователю ${userId}`);
    
    // Отправляем сообщение с описанием и кнопками
    await ctx.reply(
      description,
      { 
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard.reply_markup
      }
    );
    
    logWithTime(`[BUY] Описание продукта успешно отправлено пользователю ${userId}`);
    await ctx.answerCbQuery('✅ Загружаю информацию о продукте');
    
    logWithTime(`[BUY] Пользователь ${userId} успешно просмотрел продукт: ${product.name}`);
  } catch (error) {
    console.error(`[ERROR] Ошибка при выборе продукта: ${error.message}`);
    console.error(`[ERROR] Stack trace: ${error.stack}`);
    
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
  try {
    console.log('[CONFIRM_BUY] ====== НАЧАЛО ОБРАБОТКИ ПОДТВЕРЖДЕНИЯ ПОКУПКИ ======');
    console.log('[CONFIRM_BUY] Полный контекст callback_query:', JSON.stringify(ctx.callbackQuery, null, 2));
    
    const productId = ctx.match[1];
    const userId = ctx.from.id;
    
    logWithTime(`[CONFIRM_BUY] Пользователь ${userId} подтвердил покупку продукта с ID: ${productId}`);
    console.log(`[CONFIRM_BUY] Полный match объект:`, JSON.stringify(ctx.match, null, 2));
    
    const product = products[productId];
    
    if (!product) {
      logWithTime(`[CONFIRM_BUY] Продукт с ID ${productId} не найден`);
      await ctx.reply('❌ Продукт не найден. Пожалуйста, выберите из доступных вариантов.', {
        reply_markup: {
          ...mainKeyboard().reply_markup,
          remove_keyboard: true
        }
      });
      return await ctx.answerCbQuery('Продукт не найден');
    }
    
    logWithTime(`[CONFIRM_BUY] Найден продукт: ${product.name}, подготовка к запросу email`);
    
    // Подготавливаем шаблонное сообщение для запроса email
    const emailRequestMessage = messageTemplates.emailRequest(product.name);
    logWithTime(`[CONFIRM_BUY] Подготовлено сообщение запроса email: ${emailRequestMessage}`);
    
    // Отправляем запрос email
    await ctx.reply(
      emailRequestMessage,
      { parse_mode: 'Markdown' }
    );
    logWithTime(`[CONFIRM_BUY] Запрос email отправлен пользователю ${userId}`);
    
    // Сохраняем информацию о выбранном продукте
    const orderData = {
      productId,
      status: 'waiting_email',
      timestamp: new Date().toISOString()
    };
    
    logWithTime(`[CONFIRM_BUY] Сохранение данных заказа: ${JSON.stringify(orderData, null, 2)}`);
    global.botData.pendingOrders[userId] = orderData;
    
    // Проверяем, что заказ сохранен правильно
    console.log(`[CONFIRM_BUY] Проверка сохраненного заказа:`, 
      JSON.stringify(global.botData.pendingOrders[userId], null, 2));
    
    // Сразу уведомляем пользователя о обработке запроса для лучшего UX
    await ctx.answerCbQuery('✅ Начинаем оформление заказа');
    
    logWithTime(`[CONFIRM_BUY] Пользователь ${userId} успешно начал оформление заказа: ${product.name}`);
    console.log('[CONFIRM_BUY] ====== КОНЕЦ ОБРАБОТКИ ПОДТВЕРЖДЕНИЯ ПОКУПКИ ======');
  } catch (error) {
    console.error(`[ERROR] Ошибка при подтверждении покупки: ${error.message}`);
    console.error(`[ERROR] Stack trace: ${error.stack}`);
    
    try {
      const userId = ctx.from ? ctx.from.id : 'неизвестный ID';
      logWithTime(`[ERROR] Произошла ошибка при обработке подтверждения покупки от пользователя ${userId}`);
      
      await ctx.reply('Произошла ошибка при оформлении заказа. Пожалуйста, попробуйте еще раз или свяжитесь с нами для помощи.', {
        reply_markup: {
          ...mainKeyboard().reply_markup,
          remove_keyboard: true
        }
      });
      await ctx.answerCbQuery('Произошла ошибка при оформлении');
    } catch (replyError) {
      console.error(`[ERROR] Не удалось отправить сообщение об ошибке: ${replyError.message}`);
    }
  }
}

// Обработчик текстовых сообщений (для получения email и телефона)
async function handleTextInput(ctx) {
  try {
    const userId = ctx.from.id;
    const text = ctx.message.text;
    
    logWithTime(`[TEXT] Получено текстовое сообщение от пользователя ${userId}: "${text}"`);
    
    const { pendingOrders } = global.botData;
    
    // Если нет ожидающего заказа, возможно, нам нужно показать главное меню
    if (!pendingOrders[userId]) {
      logWithTime(`[TEXT] У пользователя ${userId} нет ожидающего заказа`);
      
      // Если получена команда /start, не реагируем - она обрабатывается отдельно
      if (text === '/start') {
        logWithTime(`[TEXT] Получена команда /start, пропускаем обработку текста`);
        return;
      }
      
      // Для любого другого текста показываем меню и подсказку, удаляем клавиатуру
      logWithTime(`[TEXT] Отправка подсказки с меню пользователю ${userId}`);
      await ctx.reply(
        'Используйте кнопки меню ниже для навигации:',
        {
          reply_markup: {
            ...mainKeyboard().reply_markup,
            remove_keyboard: true
          }
        }
      );
      logWithTime(`[TEXT] Подсказка отправлена пользователю ${userId}`);
      return;
    }
    
    logWithTime(`[TEXT] Найден ожидающий заказ для пользователя ${userId}, статус: ${pendingOrders[userId].status}`);
    console.log(`[TEXT] Данные заказа:`, JSON.stringify(pendingOrders[userId], null, 2));
    
    // Обработка email
    if (pendingOrders[userId].status === 'waiting_email') {
      logWithTime(`[TEXT] Обработка email от пользователя ${userId}`);
      
      // Проверка формата email
      if (!validators.email(text)) {
        logWithTime(`[TEXT] Некорректный формат email: ${text}`);
        return await ctx.reply(messageTemplates.emailInvalid);
      }
      
      // Сохраняем email
      pendingOrders[userId].email = text;
      pendingOrders[userId].status = 'waiting_phone';
      
      logWithTime(`[TEXT] Email сохранен, новый статус: waiting_phone`);
      console.log(`[TEXT] Обновленные данные заказа:`, JSON.stringify(pendingOrders[userId], null, 2));
      
      // Запрашиваем номер телефона
      await ctx.reply(messageTemplates.phoneRequest);
      
      logWithTime(`[TEXT] Запрос телефона отправлен пользователю ${userId}`);
    } 
    // Обработка номера телефона
    else if (pendingOrders[userId].status === 'waiting_phone') {
      logWithTime(`[TEXT] Обработка номера телефона от пользователя ${userId}`);
      
      // Проверка формата телефона
      const cleanedPhone = text.replace(/\s+/g, '');
      
      if (!validators.phone(cleanedPhone)) {
        logWithTime(`[TEXT] Некорректный формат телефона: ${cleanedPhone}`);
        return await ctx.reply(messageTemplates.phoneInvalid);
      }
      
      // Сохраняем телефон и обновляем статус
      pendingOrders[userId].phone = cleanedPhone;
      pendingOrders[userId].status = 'waiting_payment';
      
      const product = products[pendingOrders[userId].productId];
      
      logWithTime(`[TEXT] Телефон сохранен, новый статус: waiting_payment`);
      console.log(`[TEXT] Обновленные данные заказа:`, JSON.stringify(pendingOrders[userId], null, 2));
      
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
      
      logWithTime(`[TEXT] Информация о заказе отправлена пользователю ${userId}`);
      
      // Отправляем уведомление администратору
      try {
        logWithTime(`[TEXT] Отправка уведомления администратору о новом заказе`);
        const { notifyAdmin } = require('./admin');
        await notifyAdmin(userId);
        logWithTime(`[TEXT] Уведомление успешно отправлено администратору`);
      } catch (adminError) {
        console.error(`[ERROR] Ошибка при уведомлении администратора: ${adminError.message}`);
        console.error(`[ERROR] Stack trace: ${adminError.stack}`);
      }
    }
  } catch (error) {
    console.error(`[ERROR] Ошибка при обработке текстового сообщения: ${error.message}`);
    console.error(`[ERROR] Stack trace: ${error.stack}`);
    
    try {
      await ctx.reply(
        messageTemplates.errorMessage, 
        {
          reply_markup: {
            ...mainKeyboard().reply_markup,
            remove_keyboard: true
          }
        }
      );
    } catch (replyError) {
      console.error(`[ERROR] Не удалось отправить сообщение об ошибке: ${replyError.message}`);
    }
  }
}

module.exports = {
  handleStart,
  handleBuyAction,
  handleConfirmBuy,
  handleTextInput
};
