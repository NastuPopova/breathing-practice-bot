// Файл: utils.js
// Вспомогательные функции для бота

const fs = require('fs');
const { Markup } = require('telegraf');

// Функция для создания основной клавиатуры с использованием inline-кнопок
function mainKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🛒 Купить курс', 'show_products'),
      Markup.button.callback('❓ Информация', 'show_info')
    ],
    [
      Markup.button.callback('📝 Мои покупки', 'show_purchases'),
      Markup.button.url('☎️ Связаться с преподавателем', 'https://t.me/NastuPopova')
    ]
  ]);
}

// Кэш для существования файлов
const fileExistsCache = new Map();

// Функция для проверки существования файла с кэшированием
function fileExists(filePath) {
  // Если результат уже в кэше, используем его
  if (fileExistsCache.has(filePath)) {
    return Promise.resolve(fileExistsCache.get(filePath));
  }
  
  return new Promise(resolve => {
    fs.access(filePath, fs.constants.F_OK, err => {
      const exists = !err;
      // Сохраняем результат в кэше
      fileExistsCache.set(filePath, exists);
      resolve(exists);
    });
  });
}

// Функция логирования с датой и временем
function logWithTime(message) {
  const now = new Date().toISOString();
  console.log(`[${now}] ${message}`);
}

// Валидаторы для ввода пользователя
const validators = {
  email: (text) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(text);
  },
  
  phone: (text) => {
    const phoneRegex = /^\+?[0-9]{10,15}$/;
    return phoneRegex.test(text.replace(/\s+/g, ''));
  }
};

module.exports = {
  mainKeyboard,
  fileExists,
  logWithTime,
  validators
};
