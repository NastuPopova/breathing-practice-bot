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
    
    // Отправляем сообщение администратору с прямой ссылкой на чат с клиентом
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
