// Файл: utils.js
// Вспомогательные функции для бота

const fs = require('fs');
const { Markup } = require('telegraf');

// Функция для создания основной клавиатуры
function mainKeyboard() {
  return Markup.keyboard([
    ['🛒 Купить курс', '❓ Информация'],
    ['📝 Мои покупки', '☎️ Связаться с преподавателем']
  ]).resize();
}

// Кэш для существования файлов (чтобы не проверять один и тот же файл многократно)
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