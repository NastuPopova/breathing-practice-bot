// Файл: handlers.js
// Обработчики основных сообщений пользователя

const { products, messageTemplates } = require('./data');
const { mainKeyboard, logWithTime, validators } = require('./utils');

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
      
      // Для любого другого текста показываем меню и подсказку
      await ctx.reply(
        'Используйте кнопки меню ниже для навигации:',
        mainKeyboard()
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
      
      // Отправляем информацию о заказе
      await ctx.reply(
        messageTemplates.orderReady(product.name, product.price),
        { 
          parse_mode: 'Markdown',
          ...mainKeyboard() 
        }
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
  handleTextInput
};
