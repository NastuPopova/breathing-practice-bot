// Файл: admin.js
// Функции для административной части бота

const { products, messageTemplates } = require('./data');
const { mainKeyboard, fileExists, logWithTime } = require('./utils');

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
    
    // Подготавливаем кнопки в зависимости от типа продукта
    const inlineButtons = [
      [{ text: '✅ Подтвердить оплату', callback_data: `confirm_payment_${userId}` }],
      [{ text: '❌ Отменить заказ', callback_data: `cancel_order_${userId}` }],
      [{ text: '💬 Открыть чат с клиентом', url: `tg://user?id=${userId}` }]
    ];
    
    // Добавляем для консультаций кнопку для отправки записи
    if (product.id === 'individual' || product.id === 'package') {
      inlineButtons.push([{ text: '🎥 Подготовить отправку записи', callback_data: `prepare_recording_${userId}` }]);
    }
    
    // Отправляем сообщение администратору с прямой ссылкой на чат с клиентом
    await bot.telegram.sendMessage(ADMIN_ID, message, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: inlineButtons
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
    const productId = order.productId;
    const orderId = Date.now().toString().slice(-6); // Последние 6 цифр timestamp как ID заказа
    const orderDate = new Date().toLocaleDateString();
    
    // Отправляем логотип с поздравлением
    await bot.telegram.sendPhoto(
      clientId,
      { source: 'files/logo.jpg' },
      { 
        caption: '🎉 Поздравляем! Ваша оплата подтверждена!',
        parse_mode: 'Markdown'
      }
    );
    
    // Небольшая задержка для лучшего UX
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Формируем сообщение в зависимости от типа продукта
    let confirmationMessage;
    
    // Для индивидуальных занятий и пакетов
    if (productId === 'individual' || productId === 'package') {
      confirmationMessage = `🎉 *Оплата подтверждена!*

Спасибо за ваш заказ. Для записи на индивидуальное занятие, пожалуйста, свяжитесь с Анастасией, нажав на кнопку ниже.

⏰ *Важная информация*:
• Занятие проводится онлайн через Zoom или при личной встрече
• Продолжительность занятия: 45 минут
• Для достижения наилучших результатов рекомендуем подготовить список ваших вопросов
• Запись на занятие производится в рабочие дни с 10:00 до 20:00 (МСК)

✅ *Ваш заказ*:
• ID заказа: #${orderId}
• Статус: Оплачено
• Дата заказа: ${orderDate}

Анастасия свяжется с вами в течение 24 часов.`;
    } else {
      // Для других продуктов (курсы, материалы)
      confirmationMessage = messageTemplates.paymentConfirmed(product.name);
    }
    
    // Отправляем сообщение пользователю о подтверждении
    await bot.telegram.sendMessage(
      clientId,
      confirmationMessage,
      { 
        parse_mode: 'Markdown',
        ...(productId === 'individual' || productId === 'package' ? {
          reply_markup: {
            inline_keyboard: [
              [{ text: '✉️ Связаться с Анастасией', url: 'https://t.me/NastuPopova' }]
            ]
          }
        } : {})
      }
    );
    
    // Для индивидуальных занятий и пакетов не отправляем файлы и видео
    if (productId === 'individual' || productId === 'package') {
      // Для индивидуальных занятий отправляем информацию о следующих шагах
      await bot.telegram.sendMessage(
        clientId,
        `Спасибо за заказ! Анастасия свяжется с Вами в ближайшее время для уточнения удобного времени проведения консультации. 

Вы также можете самостоятельно связаться с ней, нажав кнопку ниже.

В главном меню Вы можете ознакомиться с другими нашими предложениями.`,
        { 
          reply_markup: {
            ...mainKeyboard().reply_markup,
            remove_keyboard: true
          }
        }
      );
    } else {
      // Для курсов и материалов отправляем файлы
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
        
        // Отправляем дополнительную информацию с меню и удаляем клавиатуру
        await bot.telegram.sendMessage(
          clientId,
          messageTemplates.orderComplete,
          { 
            parse_mode: 'Markdown',
            reply_markup: {
              ...mainKeyboard().reply_markup,
              remove_keyboard: true
            }
          }
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
    }
    
    // Инициализируем массив заказов для пользователя, если его еще нет
    if (!completedOrders[clientId]) {
      completedOrders[clientId] = [];
    }
    
    // Добавляем заказ в историю завершенных
    completedOrders[clientId].push({
      ...order,
      completedAt: new Date().toISOString(),
      status: 'completed',
      orderId: orderId
    });
    
    delete pendingOrders[clientId];
    
    // Уведомляем админа
    await bot.telegram.sendMessage(
      ADMIN_ID,
      `✅ Оплата подтверждена для клиента (ID: ${clientId}).\nПродукт: ${product.name}\nID заказа: #${orderId}`
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

/**
 * Функция для отправки записи консультации клиенту
 * @param {string} clientId - ID клиента в Telegram
 * @param {string} recordingLink - Ссылка на запись консультации
 * @param {string} notes - Дополнительные заметки или рекомендации (опционально)
 */
async function sendConsultationRecording(clientId, recordingLink, notes = '') {
  try {
    const { bot, ADMIN_ID, completedOrders } = global.botData;
    
    // Находим последний заказ клиента с индивидуальным занятием или пакетом
    const clientOrders = completedOrders[clientId] || [];
    const consultationOrders = clientOrders.filter(order => 
      (order.productId === 'individual' || order.productId === 'package') && 
      order.status === 'completed'
    );
    
    if (consultationOrders.length === 0) {
      await bot.telegram.sendMessage(
        ADMIN_ID,
        `❌ Не найдено завершенных заказов с консультациями для клиента ${clientId}`
      );
      return false;
    }
    
    // Берем самый последний заказ
    const latestOrder = consultationOrders.sort((a, b) => 
      new Date(b.completedAt) - new Date(a.completedAt)
    )[0];
    
    // Отправляем логотип
    await bot.telegram.sendPhoto(
      clientId,
      { source: 'files/logo.jpg' },
      { 
        caption: '🎥 Запись вашей консультации готова!',
        parse_mode: 'Markdown'
      }
    );
    
    // Задержка
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Формируем сообщение с записью консультации
    const message = `
🎥 *Запись вашей консультации готова!*

Спасибо за прохождение индивидуального занятия! Как и обещали, отправляем вам запись вашей консультации. Вы можете вернуться к ней в любой момент и повторить упражнения.

🔗 *Ссылка на запись*: ${recordingLink}

${notes ? `📝 *Дополнительные рекомендации*:\n${notes}\n` : ''}

✅ *Информация о заказе*:
• ID заказа: #${latestOrder.orderId || 'N/A'}
• Дата заказа: ${new Date(latestOrder.completedAt).toLocaleDateString()}

Если у вас возникнут вопросы по материалам консультации, не стесняйтесь обращаться!
`;
    
    // Отправляем сообщение клиенту
    await bot.telegram.sendMessage(
      clientId,
      message,
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎬 Смотреть запись', url: recordingLink }],
            [{ text: '✉️ Связаться с Анастасией', url: 'https://t.me/NastuPopova' }]
          ]
        }
      }
    );
    
    // Обновляем статус заказа
    latestOrder.recordingSent = true;
    latestOrder.recordingLink = recordingLink;
    latestOrder.recordingSentDate = new Date().toISOString();
    
    // Уведомляем админа
    await bot.telegram.sendMessage(
      ADMIN_ID,
      `✅ Запись консультации успешно отправлена клиенту (ID: ${clientId}).\nID заказа: #${latestOrder.orderId || 'N/A'}`
    );
    
    logWithTime(`Запись консультации отправлена пользователю ${clientId}`);
    return true;
  } catch (error) {
    console.error(`Ошибка при отправке записи консультации: ${error.message}`);
    await bot.telegram.sendMessage(
      ADMIN_ID,
      `❌ Ошибка при отправке записи консультации: ${error.message}`
    );
    return false;
  }
}

module.exports = {
  notifyAdmin,
  confirmPayment,
  sendConsultationRecording
};
