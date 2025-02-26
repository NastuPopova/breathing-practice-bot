// Файл: admin.js
// Функции для административной части бота

const { products, messageTemplates } = require('./data');
const { fileExists, logWithTime } = require('./utils');

// Отправка уведомления администратору о новом заказе
async function notifyAdmin(userId) {
  try {
    const { bot, ADMIN_ID, pendingOrders } = global.botData;
    const order = pendingOrders[userId];
    const product = products[order.productId];
    
    // Более безопасное получение информации о пользователе
    let userInfo = { first_name: 'Пользователь', last_name: '' };
    try {
      userInfo = await bot.telegram.getChat(userId);
    } catch (error) {
      console.error(`Не удалось получить информацию о пользователе ${userId}: ${error.message}`);
    }
    
    // Формируем сообщение для админа
    const message = `
🔔 *НОВЫЙ ЗАКАЗ*
  
📦 Продукт: *${product.name}*
💰 Цена: *${product.price}*
  
👤 Клиент: ${userInfo.first_name} ${userInfo.last_name || ''}
🆔 ID: \`${userId}\`
📧 Email: ${order.email}
📱 Телефон: ${order.phone}
🕒 Время заказа: ${new Date().toLocaleString()}
  
Для подтверждения оплаты используйте команду:
\`/confirm_${userId}\`
`;
    
    // Отправляем сообщение администратору
    await bot.telegram.sendMessage(ADMIN_ID, message, { 
      parse_mode: 'Markdown',
    reply_markup: {
  inline_keyboard: [
    [{ text: '✅ Подтвердить оплату', callback_data: `confirm_payment_${userId}` }],
    [{ text: '❌ Отменить заказ', callback_data: `cancel_order_${userId}` }],
    [{ text: '💬 Открыть чат с клиентом', url: `tg://user?id=${userId}` }]
  ]
}
    });
    
    logWithTime(`Отправлено уведомление администратору о заказе пользователя ${userId}`);
  } catch (error) {
    console.error(`Ошибка при отправке уведомления администратору: ${error.message}`);
  }
}

// Функция подтверждения оплаты и отправки материалов
async function confirmPayment(clientId) {
  try {
    const { bot, ADMIN_ID, pendingOrders, completedOrders } = global.botData;
    const order = pendingOrders[clientId];
    
    if (!order) {
      await bot.telegram.sendMessage(ADMIN_ID, '❌ Заказ не найден.');
      return;
    }
    
    const product = products[order.productId];
    
    // Отправляем сообщение пользователю о подтверждении
    await bot.telegram.sendMessage(
      clientId,
      messageTemplates.paymentConfirmed(product.name),
      { parse_mode: 'Markdown' }
    );
    
    // Отправляем материалы последовательно с минимальной задержкой
    try {
      // Проверка существования файла
      const filePathExists = await fileExists(product.pdfFile);
      
      if (filePathExists) {
        await bot.telegram.sendDocument(
          clientId,
          { source: product.pdfFile },
          { 
            caption: '📚 Вот ваша PDF-инструкция по дыхательным практикам.\n\nСохраните ее для удобного доступа в любое время!' 
          }
        );
        logWithTime(`PDF отправлен пользователю ${clientId}`);
      } else {
        console.error(`PDF файл не найден: ${product.pdfFile}`);
        await bot.telegram.sendMessage(
          clientId,
          '❗ Возникла проблема при отправке PDF. Пожалуйста, напишите нам, и мы решим эту проблему.'
        );
        await bot.telegram.sendMessage(
          ADMIN_ID, 
          `❌ Ошибка: файл ${product.pdfFile} не найден`
        );
      }
      
      // Небольшая задержка между сообщениями для предотвращения флуда API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Отправляем информацию о видеоуроке
      await bot.telegram.sendMessage(
        clientId,
        `🎬 *Ваш видеоурок готов к просмотру!*\n\n${product.description}\n\n🔗 *Ссылка на видео*: ${product.videoLink}\n\nПриятного обучения!`,
        {
          parse_mode: 'Markdown',
          disable_web_page_preview: false,
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎬 Смотреть видеоурок', url: product.videoLink }]
            ]
          }
        }
      );
      
      logWithTime(`Видеоурок отправлен пользователю ${clientId}`);
      
      // Небольшая задержка между сообщениями
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Отправляем дополнительную информацию
      await bot.telegram.sendMessage(
        clientId,
        messageTemplates.orderComplete,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error(`Ошибка при отправке материалов: ${error.message}`);
      await bot.telegram.sendMessage(
        clientId,
        '❗ Возникла проблема при отправке материалов. Пожалуйста, напишите нам, и мы решим эту проблему.'
      );
      await bot.telegram.sendMessage(
        ADMIN_ID, 
        `❌ Ошибка при отправке материалов: ${error.message}`
      );
    }
    
    // Инициализируем массив заказов для пользователя, если его еще нет
    if (!completedOrders[clientId]) {
      completedOrders[clientId] = [];
    }
    
    // Добавляем заказ в историю завершенных
    completedOrders[clientId].push({
      ...order,
      completedAt: new Date().toISOString(),
      status: 'completed'
    });
    
    delete pendingOrders[clientId];
    
    // Уведомляем админа
    await bot.telegram.sendMessage(
      ADMIN_ID,
      `✅ Материалы успешно отправлены клиенту (ID: ${clientId}).\nПродукт: ${product.name}`
    );
    
    logWithTime(`Заказ пользователя ${clientId} завершен успешно`);
  } catch (error) {
    console.error(`Error in confirmPayment: ${error.message}`);
    await bot.telegram.sendMessage(
      ADMIN_ID,
      `❌ Ошибка при обработке подтверждения: ${error.message}`
    );
  }
}

module.exports = {
  notifyAdmin,
  confirmPayment
};
