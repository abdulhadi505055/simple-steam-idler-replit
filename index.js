const { Client, IntentsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, StringSelectMenuBuilder } = require('discord.js');
const Enmap = require('enmap');

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildMembers
  ]
});

// ============ قواعد البيانات ============
const users = new Enmap({ name: 'users' });
const cardsDB = new Enmap({ name: 'cards' });
const shopDB = new Enmap({ name: 'shop' });
let globalCardID = 0;

// ============ إعدادات النظام ============
const rarities = [
  { name: 'عادي', price: 10, sell: 5, color: '#808080' },
  { name: 'نادر', price: 50, sell: 25, color: '#008000' },
  { name: 'أسطوري', price: 100, sell: 50, color: '#0000FF' },
  { name: 'ملحمي', price: 500, sell: 250, color: '#800080' },
  { name: 'أسطوري+', price: 1000, sell: 500, color: '#FFD700' }
];

const IMAGES = {
  pull: 'https://cdn.discordapp.com/attachments/1367489226098085949/1371209908384432128/IMG_5413.jpg',
  drop: 'https://cdn.discordapp.com/attachments/1367489226098085949/1371209928689061898/0501411A-A37B-45BF-B999-751CEC6EF122.png',
  shop: 'https://cdn.discordapp.com/attachments/1308753803213799444/1371396685518864445/IMG_5468.png',
  cardsThumb: 'https://cdn.discordapp.com/attachments/1308753803213799444/1371396928616792195/cards_text_glow_Cards.jpg',
  balanceThumb: 'https://media.discordapp.net/attachments/1367489226098085949/1371088958062202891/IMG_5411.gif'
};

// ============ وظائف مساعدة ============
function generateShop() {
  shopDB.clear();
  const availableCards = [...cardsDB.values()].filter(c => c.owner === null);
  for (let i = 0; i < 4; i++) {
    const randomCard = availableCards[Math.floor(Math.random() * availableCards.length)];
    if (!randomCard) break;
    const price = rarities[randomCard.rarity].price * 1.5;
    shopDB.set(randomCard.id, { cardID: randomCard.id, price });
  }
}

// ============ أوامر الإدارة ============
async function handleAdminCommands(message, args, command) {
  if (!message.member.permissions.has('Administrator')) return;

  // !اضف [أنمي] [شخصية] [ندرة]
  if (command === '!اضف') {
    const [anime, character, rarity] = args;
    const card = {
      id: globalCardID++,
      anime,
      character,
      rarity: parseInt(rarity),
      owner: null,
      createdAt: Date.now()
    };
    cardsDB.set(card.id, card);
    message.reply(`تم إضافة بطاقة **${character}** (${rarities[rarity].name})`);
  }

  // !دروب [قناة] [مبلغ]
  if (command === '!دروب') {
    const [channelID, amount] = args;
    const channel = message.guild.channels.cache.get(channelID.replace(/[<#>]/g, ''));
    if (!channel) return message.reply('❌ قناة غير صالحة!');

    const embed = new EmbedBuilder()
      .setTitle(`🎉 دروب بقيمة ${amount} جوهرة!`)
      .setDescription('اضغط على الزر خلال 60 ثانية لتحصل على الجائزة!')
      .setImage(IMAGES.drop)
      .setColor('#FFD700');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`drop_${message.author.id}`)
        .setLabel('أخذ الجائزة')
        .setStyle(ButtonStyle.Success)
        .setEmoji('💰')
    );

    const msg = await channel.send({ embeds: [embed], components: [row] });
    
    const collector = msg.createMessageComponentCollector({ 
      componentType: ComponentType.Button, 
      time: 60000 
    });

    let claimed = false;
    collector.on('collect', async i => {
      if (i.user.bot || claimed) return;
      claimed = true;

      const userData = users.ensure(i.user.id, { balance: 0, cards: [] });
      userData.balance += parseInt(amount);
      users.set(i.user.id, userData);
      
      await i.reply({ 
        content: `✅ حصلت على ${amount} جوهرة!`, 
        ephemeral: true 
      });
      collector.stop();
    });

    collector.on('end', () => msg.edit({ components: [] }));
  }

  // !مسح [معرف]
  if (command === '!مسح') {
    const target = args[0];
    if (!users.has(target)) return message.reply('❌ المستخدم غير موجود!');
    users.delete(target);
    message.reply(`✅ تم مسح بيانات ${target}`);
  }

  // !اعطاء [مبلغ] [معرف]
  if (command === '!اعطاء') {
    const [amount, target] = args;
    const userData = users.ensure(target, { balance: 0, cards: [] });
    userData.balance += parseInt(amount);
    users.set(target, userData);
    message.reply(`✅ تم إعطاء ${amount} جوهرة لـ <@${target}>`);
  }

  // !مسح_البطاقات
  if (command === '!مسح_البطاقات') {
    cardsDB.clear();
    message.reply('✅ تم مسح جميع البطاقات!');
  }

  // !اعادة_متجر
  if (command === '!اعادة_متجر') {
    shopDB.clear();
    generateShop();
    message.reply('✅ تم تحديث متجر البطاقات!');
  }
}

// ============ أوامر البطاقات ============
async function handleCardCommands(message, args, command) {
  const userData = users.ensure(message.author.id, { balance: 0, cards: [] });

  // !بطاقة
  if (command === '!بطاقة') {
    const embed = new EmbedBuilder()
      .setTitle('🎴 لوحة السحب')
      .setDescription('**تكلفة السحب: 100 جوهرة**\nاضغط الزر لسحب بطاقة')
      .setImage(IMAGES.pull)
      .setColor('#FF69B4');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pull_${message.author.id}`)
        .setLabel('سحب بطاقة')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎴')
    );

    message.reply({ embeds: [embed], components: [row] });
  }

  // !بطاقاتي
  if (command === '!بطاقاتي') {
    const userCards = userData.cards.map(id => cardsDB.get(id)).filter(c => c);
    if (userCards.length === 0) return message.reply('❌ لا تمتلك أي بطاقات!');

    let page = 0;
    const maxPage = Math.ceil(userCards.length / 5);

    const generateEmbed = () => {
      const embed = new EmbedBuilder()
        .setTitle(`📚 بطاقات ${message.author.username}`)
        .setThumbnail(IMAGES.cardsThumb)
        .setColor('#00BFFF');

      userCards.slice(page * 5, (page + 1) * 5).forEach(card => {
        embed.addFields({
          name: `${card.character} (${rarities[card.rarity].name})`,
          value: `الأنمي: ${card.anime}\nالتاريخ: <t:${Math.floor(card.createdAt/1000)}:R>\nID: ${card.id}`
        });
      });

      embed.setFooter({ text: `الصفحة ${page + 1}/${maxPage} | إجمالي البطاقات: ${userCards.length}` });
      return embed;
    };

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('prev')
        .setLabel('السابق')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId('next')
        .setLabel('التالي')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === maxPage - 1)
    );

    const msg = await message.reply({ 
      embeds: [generateEmbed()], 
      components: [buttons] 
    });
    
    const collector = msg.createMessageComponentCollector({ 
      componentType: ComponentType.Button, 
      time: 60000 
    });

    collector.on('collect', async i => {
      if (i.user.id !== message.author.id) return;

      if (i.customId === 'prev' && page > 0) page--;
      if (i.customId === 'next' && page < maxPage - 1) page++;

      await i.update({
        embeds: [generateEmbed()],
        components: [buttons.setComponents(
          buttons.components[0].setDisabled(page === 0),
          buttons.components[1].setDisabled(page === maxPage - 1)
        )]
      });
    });
  }

  // !بيع
  if (command === '!بيع') {
    const userCards = userData.cards.map(id => cardsDB.get(id)).filter(c => c);
    if (userCards.length === 0) return message.reply('❌ لا يوجد لديك بطاقات للبيع!');

    const embed = new EmbedBuilder()
      .setTitle('💰 بيع البطاقات')
      .setDescription('اختر البطاقات التي تريد بيعها')
      .setColor('#FFA500');

    const options = userCards.slice(0, 25).map(card => ({
      label: `${card.character} (${rarities[card.rarity].name})`,
      value: card.id.toString(),
      description: `القيمة: ${rarities[card.rarity].sell} جوهرة`
    }));

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('sell_menu')
        .setPlaceholder('اختر البطاقات')
        .setMinValues(1)
        .setMaxValues(options.length)
        .addOptions(options)
    );

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('confirm_sell')
        .setLabel('تأكيد البيع')
        .setStyle(ButtonStyle.Success)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('cancel_sell')
        .setLabel('إلغاء العملية')
        .setStyle(ButtonStyle.Danger)
    );

    const msg = await message.reply({ 
      embeds: [embed], 
      components: [row, confirmRow] 
    });

    const filter = i => i.user.id === message.author.id;
    const collector = msg.createMessageComponentCollector({ filter, time: 60000 });

    let selectedCards = [];
    collector.on('collect', async i => {
      if (i.isStringSelectMenu()) {
        selectedCards = i.values;
        confirmRow.components[0].setDisabled(false);
        await i.update({ components: [row, confirmRow] });
      }
      
      if (i.isButton()) {
        if (i.customId === 'confirm_sell') {
          const total = selectedCards.reduce((sum, id) => {
            const card = cardsDB.get(parseInt(id));
            return sum + rarities[card.rarity].sell;
          }, 0);
          
          userData.balance += total;
          userData.cards = userData.cards.filter(id => !selectedCards.includes(id.toString()));
          users.set(message.author.id, userData);
          
          await i.update({ 
            content: `✅ تم بيع ${selectedCards.length} بطاقة وحصلت على ${total} جوهرة!`,
            components: [] 
          });
        } else {
          await i.update({ 
            content: '❌ تم إلغاء عملية البيع', 
            components: [] 
          });
        }
        collector.stop();
      }
    });
  }

  // !متجر
  if (command === '!متجر') {
    if (shopDB.size === 0) generateShop();
    
    const shopItems = [...shopDB.values()].slice(0, 4);
    const embed = new EmbedBuilder()
      .setTitle('🏪 متجر البطاقات')
      .setImage(IMAGES.shop)
      .setColor('#FF69B4');

    shopItems.forEach((item, index) => {
      const card = cardsDB.get(item.cardID);
      embed.addFields({
        name: `#${index + 1} ${card.character} (${rarities[card.rarity].name})`,
        value: `السعر: ${item.price} جوهرة\nالأنمي: ${card.anime}`
      });
    });

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('shop_buy')
        .setPlaceholder('اختر البطاقة للشراء')
        .addOptions(shopItems.map((item, index) => ({
          label: `البطاقة #${index + 1}`,
          value: item.cardID.toString(),
          description: `السعر: ${item.price} جوهرة`
        }))
    );

    const msg = await message.reply({ embeds: [embed], components: [row] });
    
    const collector = msg.createMessageComponentCollector({ 
      componentType: ComponentType.StringSelect, 
      time: 60000 
    });

    collector.on('collect', async i => {
      const item = shopItems.find(x => x.cardID === parseInt(i.values[0]));
      if (!item) return;
      
      if (userData.balance < item.price) {
        return i.reply({ content: '❌ رصيدك غير كافي!', ephemeral: true });
      }
      
      userData.balance -= item.price;
      userData.cards.push(item.cardID);
      users.set(i.user.id, userData);
      
      await i.reply({ 
        content: `✅ تم شراء بطاقة ${cardsDB.get(item.cardID).character} بـ ${item.price} جوهرة!`, 
        ephemeral: true 
      });
    });
  }
}

// ============ الأوامر الاقتصادية ============
function handleEconomyCommands(message) {
  const userData = users.ensure(message.author.id, { balance: 0, cards: [] });

  // !رصيد
  if (message.content.startsWith('!رصيد')) {
    const embed = new EmbedBuilder()
      .setTitle('💎 رصيدك الحالي')
      .setDescription(`**${userData.balance.toLocaleString()} جوهرة**`)
      .setThumbnail(IMAGES.balanceThumb)
      .setColor('#00FF00');

    message.reply({ embeds: [embed] });
  }
}

// ============ تشغيل البوت ============
client.on('ready', () => {
  console.log(`${client.user.tag} جاهز!`);
  if (shopDB.size === 0) generateShop();
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  
  const args = message.content.split(/ +/);
  const command = args.shift().toLowerCase();

  try {
    if (command.startsWith('!اضف') || command.startsWith('!دروب') || 
        command.startsWith('!مسح') || command.startsWith('!اعادة')) {
      await handleAdminCommands(message, args, command);
    }
    else if (command.startsWith('!بطاقة') || command.startsWith('!بطاقاتي') || 
             command.startsWith('!بيع') || command.startsWith('!متجر')) {
      await handleCardCommands(message, args, command);
    }
    else if (command.startsWith('!رصيد')) {
      handleEconomyCommands(message);
    }
  } catch (error) {
    console.error(error);
    message.reply('❌ حدث خطأ أثناء تنفيذ الأمر!');
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  // سحب البطاقات
  if (interaction.customId.startsWith('pull_')) {
    const userId = interaction.customId.split('_')[1];
    if (interaction.user.id !== userId) return;

    const userData = users.get(userId);
    if (userData.balance < 100) {
      return interaction.reply({ content: '❌ رصيدك غير كافي!', ephemeral: true });
    }

    userData.balance -= 100;
    const availableCards = [...cardsDB.values()].filter(c => c.owner === null);
    if (availableCards.length === 0) {
      return interaction.reply({ content: '❌ لا توجد بطاقات متاحة!', ephemeral: true });
    }

    const randomCard = availableCards[Math.floor(Math.random() * availableCards.length)];
    randomCard.owner = userId;
    userData.cards.push(randomCard.id);
    
    users.set(userId, userData);
    cardsDB.set(randomCard.id, randomCard);

    const embed = new EmbedBuilder()
      .setTitle('🎉 بطاقة جديدة!')
      .addFields(
        { name: 'الشخصية', value: randomCard.character, inline: true },
        { name: 'الأنمي', value: randomCard.anime, inline: true },
        { name: 'الندرة', value: rarities[randomCard.rarity].name, inline: true }
      )
      .setThumbnail(IMAGES.cardsThumb)
      .setColor(rarities[randomCard.rarity].color);

    await interaction.reply({ embeds: [embed] });
  }
});

client.login(process.env.TOKEN);