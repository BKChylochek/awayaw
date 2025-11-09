// === Импорт библиотек ===
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

// === ⚙️ Настройки ===
const TOKEN = "7562809822:AAH_z4iejnWardESYt6qv9qdiMIuyWcRFfs"; // токен из @BotFather
const ADMIN_IDS = [7923034220, 5874926994]; // ID админов

const DAY_SUPPORT = "@blockervddnet";   // дневной оператор
const NIGHT_SUPPORT = "@Sh1ncePr1nce";  // ночной оператор

// === Хранилища ===
const deniedUsers = new Map(); // userId -> текст анкеты
const formState = new Map();   // userId -> { step, answers }

// === Создание бота ===
const bot = new TelegramBot(TOKEN, { polling: true });
console.log("✅ Бот запущен и слушает сообщения...");

// === Главное меню ===
const mainMenu = {
  reply_markup: {
    keyboard: [["📝 Заполнить анкету", "🆘 Служба поддержки"]],
    resize_keyboard: true
  }
};

// === Команда /start ===
bot.onText(/\/start/, async (msg) => {
  await bot.sendMessage(msg.chat.id, "Привет! 👋 Выбери действие из меню:", mainMenu);
});

// === Служба поддержки ===
bot.on("message", async (msg) => {
  if (msg.text === "🆘 Служба поддержки") {
    const text = `
🧰 <b>Служба поддержки</b>

🕐 Дневная смена: ${DAY_SUPPORT}
🌙 Ночная смена: ${NIGHT_SUPPORT}

Пиши им по вопросам клана и игры 💬
`;
    await bot.sendMessage(msg.chat.id, text, { parse_mode: "HTML" });
  }
});

// === Вопросы анкеты ===
const questions = [
  "1️⃣ Твой ник в DDNet:",
  "2️⃣ Твоя роль в игре (когер или блокер):",
  "3️⃣ Активность в игре (как часто играешь? фото)вот гайд(Нужно перейти по своему нику, затем выбрать «Активность», далее «Игры». Здесь будет информация о недавно запущенных играх и количестве проведённого в них времени за указанный период):",
  "4️⃣ Количество часов в DDNet (фото):",
  "5️⃣ Играешь ли ты с читами? (честность важнее всего 😉):",
  "6️⃣ Почему хочешь вступить именно в наш клан BKWORLD? 💪:",
  "7️⃣ Устройство, с которого играешь (ПК, ноут и т.п.):",
  "8️⃣ Дополнительная информация (если есть):"
];

// === Обработка заполнения анкеты ===
bot.on("message", async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  // Старт анкеты
  if (msg.text === "📝 Заполнить анкету") {
    if (deniedUsers.has(userId)) {
      return bot.sendMessage(chatId, "🚫 Тебе было отказано. Повторно подать заявку нельзя.");
    }

    formState.set(userId, { step: 0, answers: [] });
    await bot.sendMessage(chatId, questions[0]);
    return;
  }

  // Если пользователь проходит анкету
  const state = formState.get(userId);
  if (!state) return;

  const step = state.step;
  const answers = state.answers;

  // Определяем тип ответа
  let userResponse = "";
  if (msg.text) {
    userResponse = msg.text;
  } else if (msg.photo) {
    const photoId = msg.photo[msg.photo.length - 1].file_id;
    userResponse = { type: "photo", file_id: photoId };
  } else if (msg.document) {
    userResponse = { type: "document", file_id: msg.document.file_id };
  } else {
    return; // игнорируем другие типы сообщений
  }

  // Сохраняем ответ
  answers.push(userResponse);
  state.step++;

  // Если есть следующий вопрос
  if (state.step < questions.length) {
    await bot.sendMessage(chatId, questions[state.step]);
  } else {
    // === Анкета готова ===
    formState.delete(userId);

    const textParts = [];
    const media = [];

    answers.forEach((ans, i) => {
      if (typeof ans === "string") {
        textParts.push(`${questions[i]}\n${ans}`);
      } else if (ans.type === "photo") {
        media.push({ type: "photo", media: ans.file_id, caption: questions[i] });
      } else if (ans.type === "document") {
        media.push({ type: "document", media: ans.file_id, caption: questions[i] });
      }
    });

    const text = `
📋 <b>Новая анкета!</b>

${textParts.join("\n\n")}
👤 От: @${msg.from.username || "Без ника"} (ID: ${userId})
`;

    const opts = {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Принять", callback_data: `accept_${userId}` },
            { text: "❌ Отказать", callback_data: `deny_${userId}` }
          ]
        ]
      }
    };

    // Отправляем анкету админам
    for (const adminId of ADMIN_IDS) {
      await bot.sendMessage(adminId, text, opts);

      if (media.length > 0) {
        // отправляем медиа по одному (чтобы не упало по ограничению)
        for (const m of media) {
          await bot.sendMediaGroup(adminId, [m]);
        }
      }
    }

    await bot.sendMessage(chatId, "✅ Анкета отправлена! Ожидай решения от администрации.");
  }
});

// === Обработка решений админов ===
bot.on("callback_query", async (query) => {
  try {
    const data = query.data;
    const msg = query.message;

    // --- Принять ---
    if (data.startsWith("accept_")) {
      const userId = parseInt(data.split("_")[1]);
      await bot.sendMessage(userId, "🎉 Поздравляем! Тебя приняли в клан BKWORLD!\nВступай в чат: https://t.me/+gpOWA5NeDBFmMDhi");
      await bot.answerCallbackQuery(query.id, { text: "✅ Принят!" });
      await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: msg.chat.id, message_id: msg.message_id });
      return;
    }

    // --- Отказать ---
    if (data.startsWith("deny_")) {
      const userId = parseInt(data.split("_")[1]);
      deniedUsers.set(userId, msg.text);
      await bot.sendMessage(userId, "😢 К сожалению, тебе отказано во вступлении.\nПовторно подать анкету нельзя.");
      await bot.answerCallbackQuery(query.id, { text: "❌ Отказано" });
      await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: msg.chat.id, message_id: msg.message_id });
      return;
    }

    // --- Повторно принять ---
    if (data.startsWith("mclick_accept_")) {
      const uid = parseInt(data.split("_")[2]);
      if (deniedUsers.has(uid)) {
        deniedUsers.delete(uid);
        await bot.sendMessage(uid, "🎉 Администрация пересмотрела решение — ты принят в клан BKWORLD!\nДобро пожаловать! https://t.me/+gpOWA5NeDBFmMDhi");
        await bot.answerCallbackQuery(query.id, { text: "✅ Принят повторно" });
        await bot.editMessageText("✅ Принят повторно!", { chat_id: msg.chat.id, message_id: msg.message_id });
      } else {
        await bot.answerCallbackQuery(query.id, { text: "⚠️ Эта анкета уже была удалена." });
      }
      return;
    }
  } catch (err) {
    console.error("Ошибка при обработке callback_query:", err);
  }
});

// === Команда /mclick (для админов) ===
bot.onText(/\/mclick/, async (msg) => {
  const userId = msg.from.id;

  if (!ADMIN_IDS.includes(userId)) {
    return bot.sendMessage(msg.chat.id, "🚫 У тебя недостаточно полномочий для этой команды.");
  }

  if (deniedUsers.size === 0) {
    return bot.sendMessage(msg.chat.id, "📭 Нет отказанных анкет на данный момент.");
  }

  for (const [uid, formText] of deniedUsers.entries()) {
    const opts = {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "✅ Принять повторно", callback_data: `mclick_accept_${uid}` }]]
      }
    };
    await bot.sendMessage(msg.chat.id, `📋 <b>Отказанная анкета:</b>\n\n${formText}`, opts);
  }
});

// === Команда /myid ===
bot.onText(/\/myid/, async (msg) => {
  const userId = msg.from.id;
  await bot.sendMessage(msg.chat.id, `🆔 Твой Telegram ID: <b>${userId}</b>`, { parse_mode: "HTML" });
});

// === Сервер для Render ===
const app = express();
app.get("/", (req, res) => res.send("🤖 Бот Telegram BKWORLD работает!"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Сервер запущен на порту ${PORT}`));