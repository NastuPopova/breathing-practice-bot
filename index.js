// Файл: index.js (Часть 1)
// Основной файл Telegram-бота с поддержкой вебхуков

const { Telegraf, Markup } = require('telegraf');
require('dotenv').config();
const express = require('express');
const fs = require('fs');

// Импортируем модули
const { products, messageTemplates } = require('./data');
const { mainKeyboard, consultationsKeyboard, removeKeyboard, sendMessageWithInlineKeyboard, fileExists, logWithTime } = require('./utils');
const { handleStart, handleBuyAction, handleConfirmBuy, handleTextInput } = require('./handlers');
const { notifyAdmin, confirmPayment, sendConsultationRecording } = require('./admin');
const { setupPing } = require('./ping');
const { setupScheduler } = require('./scheduler');

// Получаем токен бота и URL приложения из переменных окружения
const BOT_TOKEN = process.env.BOT_TOKEN;
const APP_URL = process.env.APP_URL;
const ADMIN_ID = process.env.ADMIN_ID;

// Проверка обязательных переменных окружения
if (!BOT_TOKEN) {
  console.error('ОШИБКА: BOT_TOKEN не найден в переменных окружения');
  process.exit(1);
}

if (!APP_URL) {
  console.warn('ПРЕДУПРЕЖДЕНИЕ: APP_URL не найден в переменных окружения. Вебхук не может быть настроен без URL.');
}

// Создание Express приложения
const app = express();
const PORT = process.env.PORT || 3000;

// Обработка JSON-данных для вебхука
app.use(express.json());

// Создание бота с токеном от BotFather
const bot = new Telegraf(BOT_TOKEN);

// Переменная для отслеживания времени запуска
const startTime = new Date();

// Хранение заказов
const pendingOrders = {};
const completedOrders = {};

// Экспортируем эти объекты для использования в других модулях
global.botData = {
  bot,
  ADMIN_ID,
  pendingOrders,
  completedOrders,
  adminState: null, // Для хранения состояния админа
  startTime: startTime, // Запоминаем время запуска
  lastPingTime: new Date()
};

// Настройка вебхука для Telegram бота
const setupWebhook = async () => {
  try {
    if (!APP_URL) {
      throw new Error('APP_URL не указан в переменных окружения');
    }

    // Определяем секретный путь для вебхука
    const secretPath = `/telegraf/${BOT_TOKEN}`;
    const webhookUrl = `${APP_URL}${secretPath}`;

    logWithTime(`Настройка вебхука на URL: ${webhookUrl}`);

    // Удаляем старый вебхук для уверенности
    await bot.telegram.deleteWebhook();
    logWithTime('Старый вебхук удален');

    // Устанавливаем новый вебхук
    await bot.telegram.setWebhook(webhookUrl);
    logWithTime('Вебхук успешно установлен');

    // Проверяем, что вебхук установлен
    const webhookInfo = await bot.telegram.getWebhookInfo();
    logWithTime(`Информация о вебхуке: ${JSON.stringify(webhookInfo)}`);

    if (webhookInfo.url !== webhookUrl) {
      logWithTime(`ПРЕДУПРЕЖДЕНИЕ: URL вебхука (${webhookInfo.url}) отличается от ожидаемого (${webhookUrl})`);
    }

    // Настройка обработки вебхука в Express
    app.use(bot.webhookCallback(secretPath));
    logWithTime(`Обработчик вебхука настроен на путь: ${secretPath}`);

    return true;
  } catch (error) {
    console.error(`Ошибка при настройке вебхука: ${error.message}`);
    logWithTime(`Ошибка при настройке вебхука: ${error.message}`);
    return false;
  }
};

// Логирование всех callback запросов
bot.on('callback_query', (ctx, next) => {
  console.log('=========== CALLBACK QUERY RECEIVED ===========');
  console.log('Data:', ctx.callbackQuery.data);
  console.log('From user:', ctx.from.id);
  console.log('Message ID:', ctx.callbackQuery.message.message_id);
  console.log('===============================================');
  
  // Продолжаем выполнение цепочки обработчиков
  return next();
});

// Обработчики команд
bot.start(handleStart);

// Обработчики для inline-кнопок
bot.action('show_products', async (ctx) => {
  try {
    await ctx.reply(
      '📚 Выберите продукт:',
      Markup.inlineKeyboard([
        [Markup.button.callback('🔰 Стартовый комплект - 990 ₽', 'buy_starter')],
        [Markup.button.callback('👤 Индивидуальное занятие - 2 000 ₽', 'buy_individual')],
        [Markup.button.callback('🎯 Пакет 3 занятия - 4500 ₽', 'buy_package')],
        [Markup.button.callback('🏆 Полный курс видеоуроков - 14 999 ₽ [🔄 В разработке]', 'product_in_development')],
        [Markup.button.callback('◀️ Назад', 'back_to_menu')]
      ])
    );
    
    await ctx.answerCbQuery();
    logWithTime(`Пользователь ${ctx.from.id} открыл меню выбора продукта`);
  } catch (error) {
    console.error(`Ошибка в обработчике "Купить курс": ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

// Обработчик для продуктов, которые в разработке
bot.action('product_in_development', async (ctx) => {
  try {
    await ctx.reply(
      '🔄 *Продукт находится в разработке*\n\nПолный курс видеоуроков в настоящее время дорабатывается, чтобы предоставить вам наилучший опыт обучения.\n\nМы уведомим вас, когда он будет доступен для покупки. В настоящее время вы можете приобрести другие наши продукты.',
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('🔙 Вернуться к списку продуктов', 'show_products')]
          ]
        }
      }
    );
    
    await ctx.answerCbQuery('Этот продукт пока в разработке');
    logWithTime(`Пользователь ${ctx.from.id} попытался выбрать продукт в разработке`);
  } catch (error) {
    console.error(`Ошибка при обработке продукта в разработке: ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

bot.action('back_to_menu', async (ctx) => {
  try {
    await ctx.editMessageText(
      'Выберите действие:',
      mainKeyboard()
    );
    await ctx.answerCbQuery();
  } catch (error) {
    console.error(`Ошибка при возврате в меню: ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

// Обработка покупок - ТОЛЬКО ОДИН обработчик для выбора продуктов
bot.action(/buy_(.+)/, handleBuyAction);

// Обработчик для простой кнопки оформления заказа - универсальный для всех продуктов
bot.action(/confirm_simple_(.+)/, async (ctx) => {
  console.log('========== УПРОЩЕННЫЙ ОБРАБОТЧИК ЗАПУЩЕН ==========');
  const productId = ctx.match[1];
  const userId = ctx.from.id;
  console.log(`Пользователь ${userId} нажал на простую кнопку для продукта ${productId}`);
  
  try {
    // Получаем выбранный продукт
    const product = products[productId];
    
    if (!product) {
      console.error(`Продукт с ID ${productId} не найден`);
      await ctx.answerCbQuery('Продукт не найден');
      return false;
    }
    
    // Отправляем запрос на email
    await ctx.reply(
      messageTemplates.emailRequest(product.name),
      { parse_mode: 'Markdown' }
    );
    
    // Сохраняем информацию о выбранном продукте
    global.botData.pendingOrders[userId] = {
      productId: productId,
      status: 'waiting_email',
      timestamp: new Date().toISOString(),
      simpleHandler: true
    };
    
    await ctx.answerCbQuery('✅ Начинаем оформление заказа');
    console.log(`Пользователь ${userId} начал оформление через простую кнопку для продукта ${productId}`);
    logWithTime(`[CONFIRM_SIMPLE] Начато оформление заказа для пользователя ${userId}, продукт: ${product.name}`);
    return true;
  } catch (error) {
    console.error(`Ошибка в простом обработчике: ${error.message}`);
    console.error(`Stack trace: ${error.stack}`);
    await ctx.answerCbQuery('Произошла ошибка');
    return false;
  }
});

// Продолжение в индекс2.js...
// В конце первой части (index.js) добавьте:

// Экспортируем необходимые объекты для index2.js
module.exports = {
  bot,
  app,
  ADMIN_ID,
  pendingOrders,
  completedOrders,
  startTime,
  setupWebhook
};

// И загружаем вторую часть
require('./index2');