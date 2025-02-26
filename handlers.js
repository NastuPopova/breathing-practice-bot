// Файл: handlers.js
// Обработчики основных сообщений пользователя

const { products, messageTemplates } = require('./data');
const { mainKeyboard, logWithTime, validators } = require('./utils');

// Обработчик команды /start
async function handleStart(ctx) {
  try {
    const userId = ctx.from.id;
    const firstName = ctx.from.first_name || 'друг';
    
    // Используем шаблон приветствия
    await ctx.reply(
      messageTemplates.welcome(firstName),
      mainKeyboard()
    );

    // Уведомление администратору о новом пользователе, но только если это не сам админ
    const { bot, ADMIN_ID } = global.botData;
    
    if (userId !== parseInt(ADMIN_ID)) {
      // Отправляем уведомление админу асинхронно, не блокируя ответ пользователю
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
      await ctx.reply('❌ Продукт не найден. Пожалуйста, выберите из доступных вариантов.');
      return await ctx.answerCbQuery();
    }

    // Используем шаблонное сообщение
    await ctx.reply(
      messageTemplates.emailRequest(product.name),
      { parse_mode: 'Markdown' }
    );
    
    // Сохраняем информацию о выбранном продукте
    global.botData.pendingOrders[userId] = {
      productId,
      status: 'waiting_email',
      timestamp: new Date().toISOString()
    };
    
    // Сразу уведомляем пользователя о обработке запроса для лучшего UX
    await ctx.answerCbQuery('✅ Продукт выбран');
    
    logWithTime(`Пользователь ${userId} выбрал продукт: ${product.name}`);
  } catch (error) {
    console.error(`Ошибка при выборе продукта: ${error.message}`);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте еще раз.');
    await ctx.answerCbQuery('Произошла ошибка');
  }
}

// Обработчик текстовых сообщений (для получения email и телефона)
async function handleTextInput(ctx) {
  try {
    const userId = ctx.from.id;
    const text = ctx.message.text;
    const { pendingOrders } = global.botData;
    
    // Игнорируем команды и кнопки главного меню
    if (text.startsWith('/') || 
        ['🛒 Купить курс', '❓ Информация', '📝 Мои покупки', '☎️ Связаться с преподавателем'].includes(text)) {
      return;
    }
    
    // Обработка email
    if (pendingOrders[userId] && pendingOrders[userId].status === 'waiting_email') {
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
    else if (pendingOrders[userId] && pendingOrders[userId].status === 'waiting_phone') {
      // Проверка формата телефона
      const cleanedPhone = text.replace(/\s+/g, '');
      
      if (!validators.phone(cleanedPhone)) {
        return await ctx.reply(messageTemplates.phoneInvalid);
      }
      
      // Сохраняем телефон и обновляем статус
      pendingOrders[userId].phone = cleanedPhone;
      pendingOrders[userId].status = 'waiting_payment';
      
      const product = products[pendingOrders[userId].productId];
      
      // Отправляем информацию о заказе
      await ctx.reply(
        messageTemplates.orderReady(product.name, product.price),
        { parse_mode: 'Markdown', ...mainKeyboard() }
      );
      
      logWithTime(`Пользователь ${userId} ввел телефон: ${cleanedPhone}`);
      
      // Отправляем уведомление администратору
      const { notifyAdmin } = require('./admin');
      await notifyAdmin(userId);
    }
  } catch (error) {
    console.error(`Ошибка при обработке текстового сообщения: ${error.message}`);
    await ctx.reply(messageTemplates.errorMessage, mainKeyboard());
  }
}

module.exports = {
  handleStart,
  handleBuyAction,
  handleTextInput
};