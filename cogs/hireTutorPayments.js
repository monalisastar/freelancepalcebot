// cogs/hireTutorPayments.js
const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const { Payment } = require('../database');

const ADMIN_ROLE_ID = '1125789773546659860';
const ADMIN_ROLE_TAG = '<@&1125789773546659860>';

const CRYPTO_ADDRESSES = {
  BTC: '1DVwEnVaHbM5PWLzPTVKd9tHn3Wcckw7Dh',
  ETH: '0xd11412def47a98eb1221b07a5400d9ff36e976de',
  USDT: '0xd11412def47a98eb1221b07a5400d9ff36e976de',
  TRX: 'TCW5k8N59vGPWFTvMufYw3h63HbTV6cWpr',
};

module.exports = {
  name: 'hireTutorPayments',

  event(client) {
    client.on('interactionCreate', async interaction => {
      if (!interaction.isButton()) return;
      const userId = interaction.user.id;
      const customId = interaction.customId;

      // --- Crypto
      if (customId.startsWith('crypto_')) {
        const coin = customId.split('_')[1];
        const address = CRYPTO_ADDRESSES[coin];

        const embed = new EmbedBuilder()
          .setTitle(`${coin} Payment`)
          .setDescription(
            `Send the agreed amount to:
\`${address}\`
\n📎 After payment, **use \`!submit-proof\` and attach your screenshot.**`
          )
          .setColor('#f4c542');

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // --- Admin Approval
      if (customId.startsWith('admin_')) {
        const [, action, studentId] = customId.split('_');
        const isAdmin = interaction.member.roles.cache.has(ADMIN_ROLE_ID);
        if (!isAdmin) return interaction.reply({ content: '⛔ Not authorized.', ephemeral: true });

        const payment = await Payment.findOne({ studentId, status: action === 'approve' ? 'pending' : 'approved' });
        if (!payment) return interaction.reply({ content: '❌ No payment found for action.', ephemeral: true });

        if (action === 'approve') {
          payment.status = 'approved';
          payment.approvedBy = userId;
          await payment.save();

          const embed = new EmbedBuilder()
            .setTitle('✅ Payment Approved')
            .setDescription(`Payment for <@${studentId}> has been approved.`)
            .setColor('#2ecc71');

          return interaction.reply({ embeds: [embed] });
        }

        if (action === 'release') {
          payment.status = 'released';
          payment.releasedBy = userId;
          payment.releasedAt = new Date();
          await payment.save();

          const embed = new EmbedBuilder()
            .setTitle('💸 Payment Released')
            .setDescription(`Funds released to tutor for <@${studentId}>.`)
            .setColor('#3498db');

          return interaction.reply({ embeds: [embed] });
        }
      }

      // --- Remitly or Help
      if (customId === 'remitly') {
        const embed = new EmbedBuilder()
          .setTitle('📲 Remitly (M-Pesa) Payment')
          .setDescription(
            '**Country:** Kenya\n**First Name:** Brian\n**Last Name:** Njata\n' +
            '**Number:** +254706472326\n\n' +
            '📎 After payment, **use `!submit-proof` and attach your screenshot.**'
          )
          .setColor('#8e44ad');

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (customId === 'need_help') {
        return interaction.reply({ content: `${ADMIN_ROLE_TAG} <@${userId}> needs help with payment.`, ephemeral: false });
      }
    });
  },

  command(client) {
    client.on('messageCreate', async message => {
      const userId = message.author.id;

      // --- INITIATE PAYMENT
      if (message.content === '!pay-hireatutor') {
        const embed = new EmbedBuilder()
          .setTitle('💰 Payment Options')
          .setDescription(
            'Select payment method below.\n\nAfter sending payment, **use `!submit-proof` and attach your screenshot.**'
          )
          .setColor('#f39c12');

        const cryptoRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`crypto_BTC`).setLabel('💰 BTC').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`crypto_ETH`).setLabel('💰 ETH').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`crypto_USDT`).setLabel('💰 USDT').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`crypto_TRX`).setLabel('💰 TRX').setStyle(ButtonStyle.Secondary)
        );

        const remitlyRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('remitly').setLabel('💸 Pay via Remitly').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('need_help').setLabel('❓ Need Help').setStyle(ButtonStyle.Danger)
        );

        await Payment.create({ studentId: userId, amount: 0, status: 'pending' });

        await message.channel.send({ content: `<@${userId}>`, embeds: [embed], components: [cryptoRow, remitlyRow] });

        const adminRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`admin_approve_${userId}`).setLabel('✅ Approve Payment').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`admin_release_${userId}`).setLabel('💸 Release Payment').setStyle(ButtonStyle.Primary)
        );

        const adminEmbed = new EmbedBuilder()
          .setTitle('Admin Controls')
          .setDescription(`Review payment for <@${userId}>.`)
          .setColor('#2ecc71');

        await message.channel.send({ content: `${ADMIN_ROLE_TAG} Payment queued for ${message.author}`, embeds: [adminEmbed], components: [adminRow] });
      }

      // --- SUBMIT PROOF
      if (message.content.startsWith('!submit-proof')) {
        const proof = message.content.replace('!submit-proof', '').trim();
        const attachment = message.attachments.first();

        const payment = await Payment.findOne({ studentId: userId, status: 'pending' });
        if (!payment) return message.reply('❌ No pending payment found.');

        payment.proofText = proof;
        if (attachment) payment.proofImage = attachment.url;
        await payment.save();

        const embed = new EmbedBuilder()
          .setTitle('📤 Payment Proof Submitted')
          .addFields({ name: 'Student', value: `<@${userId}>`, inline: true })
          .addFields({ name: 'Proof Text', value: proof || 'N/A', inline: false })
          .setColor('#95a5a6');

        if (attachment) embed.setImage(attachment.url);

        const adminRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`admin_approve_${userId}`).setLabel('✅ Approve').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`admin_release_${userId}`).setLabel('💸 Release').setStyle(ButtonStyle.Primary)
        );

        await message.channel.send({ content: `${ADMIN_ROLE_TAG} review <@${userId}>`, embeds: [embed], components: [adminRow] });
      }
    });
  }
};

