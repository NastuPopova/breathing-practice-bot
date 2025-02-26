const { Telegraf, Markup } = require('telegraf');
require('dotenv').config(); // Для загрузки переменных окружения

// Создание бота с токеном от BotFather
const bot = new Telegraf(process.env.BOT_TOKEN);

// ID администратора (ваш Telegram ID)
const ADMIN_ID = process.env.ADMIN_ID;

// Данные продуктов
const products = {
  'starter': {
    id: 'starter',
    name: 'Стартовый комплект дыхательных практик',
    price: '990 ₽',
    description: 'Видеоурок (20 минут) с базовыми техниками + PDF-инструкция + бонусные материалы',
    pdfFile: 'files/starter-kit-guide.pdf',
    videoLink: 'https://yourvideo.com/starter'
  },
  'consultation': {
    id: 'consultation',
    name: 'Индивидуальная консультация',
    price: '1500 ₽',
    description: 'Персональная 40-минутная консультация + разбор вашей техники дыхания',
    pdfFile: 'files/consultation-guide.pdf',
    videoLink: 'https://yourvideo.com/consultation-intro'
  },
  'course': {
    id: 'course',
    name: 'Полный курс видеоуроков',
    price: '14 999 ₽',
    description: '4 модуля с видеоуроками + персональные занятия + доступ к сообществу',
    pdfFile: 'files/full-course-guide.pdf',
    videoLink: 'https://yourvideo.com/course-intro'
  }
};

// Хранение текущих заказов
const pendingOrders = {};
const completedOrders = {};

// Предыдущие функции остаются без изменений...

// Продолжение кода (завершение функции confirmPayment и добавление остальных обработчиков)
    
    // Отправляем PDF-инструкции через 5 секунд
    setTimeout(async () => {
      try {
        await bot.telegram.sendDocument(
          clientId,
          { source: product.pdfFile },
          { 
            caption: '📚 Вот ваша PDF-инструкция по дыхательным практикам.\n\nСохраните ее для удобного доступа в любое время!' 
          }
        );
      } catch (error) {
        console.error(`Error sending PDF: ${error.message}`);
        await bot.telegram.sendMessage(
          clientId,
          '❗ Возникла проблема при отправке PDF. Пожалуйста, напишите нам, и мы решим эту проблему.'
        );
        await bot.telegram.sendMessage(ADMIN_ID, `❌ Ошибка при отправке PDF: ${error.message}`);
      }
    }, 5000);
    
    // Отправляем видеоурок через 10 секунд
    setTimeout(async () => {
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
      
      // Отправляем дополнительную информацию
      setTimeout(async () => {
        await bot.telegram.sendMessage(
          clientId,
          `📌 *Важная информация*:\n\n• Видео доступно без ограничений по времени\n• При возникновении вопросов пишите прямо в этот чат\n• Для максимальной пользы рекомендуем смотреть видео в спокойной обстановке\n\nВсего доброго! 🙏`,
          { parse_mode: 'Markdown' }
        );
      }, 5000);
    }, 10000);
    
    // Перемещаем заказ из ожидающих в завершенные
    completedOrders[clientId] = {
      ...order,
      completedAt: new Date().toISOString(),
      status: 'completed'
    };
    
    delete pendingOrders[clientId];
    
    // Уведомляем админа
    await bot.telegram.sendMessage(
      ADMIN_ID,
      `✅ Материалы успешно отправлены клиенту (ID: ${clientId}).\nПродукт: ${product.name}`
    );
  } catch (error) {
    console.error(`Error in confirmPayment: ${error.message}`);
    await bot.telegram.sendMessage(
      ADMIN_ID,
      `❌ Ошибка при обработке подтверждения: ${error.message}`
    );
  }
}

// Обработчик для просмотра покупок пользователем
bot.hears('📝 Мои покупки', async (ctx) => {
  const userId = ctx.from.id;
  
  // Проверяем, есть ли у пользователя завершенные заказы
  if (completedOrders[userId]) {
    const orders = [completedOrders[userId]].flat().filter(Boolean);
    
    if (orders.length > 0) {
      let message = '🛍 *Ваши покупки*:\n\n';
      
      orders.forEach((order, index) => {
        const product = products[order.productId];
        const date = new Date(order.completedAt).toLocaleDateString();
        
        message += `${index + 1}. *${product.name}*\n   Дата: ${date}\n   Статус: ✅ Оплачено\n\n`;
      });
      
      message += 'Если вам нужны повторно какие-то материалы, просто напишите в чат.';
      
      await ctx.reply(message, { parse_mode: 'Markdown' });
    } else {
      await ctx.reply('У вас пока нет завершенных покупок.');
    }
  } else {
    await ctx.reply('У вас пока нет завершенных покупок. Выберите "🛒 Купить курс", чтобы приобрести материалы.');
  }
});

// Обработчик для кнопки "Связаться с преподавателем"
bot.hears('☎️ Связаться с преподавателем', async (ctx) => {
  await ctx.reply(
    `👩‍🏫 *Анастасия Попова*\n\nЕсли у вас возникли вопросы о курсах, дыхательных практиках или вы хотите получить персональную консультацию, напишите мне напрямую.\n\nЯ отвечаю в течение 24 часов в рабочие дни.`,
    { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✉️ Написать преподавателю', url: 'https://t.me/NastuPopova' }]
        ]
      }
    }
  );
});

// Обработчик информации
bot.hears('❓ Информация', async (ctx) => {
  await ctx.reply(
    `ℹ️ *О курсах дыхательных практик*\n\n*Анастасия Попова* - сертифицированный инструктор по дыхательным практикам с опытом более 7 лет.\n\nНаши курсы помогут вам:\n\n• Повысить жизненную энергию\n• Снизить уровень стресса\n• Улучшить качество сна\n• Повысить иммунитет\n• Улучшить работу дыхательной системы\n\nВыберите "🛒 Купить курс" в меню, чтобы ознакомиться с доступными программами.`,
    { parse_mode: 'Markdown' }
  );
});

// Запуск бота
bot.launch()
  .then(() => console.log('Bot has been started'))
  .catch(err => console.error('Error starting bot:', err));

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Добавляем простой HTTP-сервер для Render
const http = require('http');
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running!');
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
