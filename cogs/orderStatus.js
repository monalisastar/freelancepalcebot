const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionsBitField, Events } = require('discord.js');
const { Ticket } = require('../database');

const REVIEW_CHANNEL_ID = '1088357730676391936';

/**
 * Inject status buttons into the claimed ticket channel.
 * @param {TextChannel} ticketChannel
 * @param {string} clientId
 * @param {string} freelancerId
 */
async function deployStatusButtons(ticketChannel, clientId, freelancerId) {
  const statusRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('order_in_progress')
      .setLabel('✅ Order In Progress')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('order_distress')
      .setLabel('🚨 Order Distress')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('order_submitted')
      .setLabel('📦 Order Submitted')
      .setStyle(ButtonStyle.Primary)
  );

  await ticketChannel.send({ content: '🔧 **Manage order status:**', components: [statusRow] });

  const collector = ticketChannel.createMessageComponentCollector({ time: 3600000 });
  collector.on('collect', async interaction => {
    const { customId, user } = interaction;
    // Only allow freelancer for all except distress
    if (customId !== 'order_distress' && user.id !== freelancerId) {
      return interaction.reply({ content: '❌ Only the assigned freelancer can do that.', ephemeral: true });
    }
    if (customId === 'order_in_progress') {
      await interaction.reply(`🟢 <@${clientId}>, your freelancer has marked the order as in progress.`);
    } else if (customId === 'order_distress') {
      if (user.id !== clientId) {
        return interaction.reply({ content: '❌ Only the client can flag distress.', ephemeral: true });
      }
      await interaction.reply(`🚨 <@${freelancerId}>, the client is concerned about the deadline. Please respond.`);
    } else if (customId === 'order_submitted') {
      await interaction.reply(`📦 <@${clientId}>, your freelancer has submitted the order.`);
      // Show final actions
      const finalRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('submit_review')
          .setLabel('✍️ Submit Review')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('🛑 Close Ticket')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('escalate')
          .setLabel('⚖️ Escalate')
          .setStyle(ButtonStyle.Secondary)
      );
      await ticketChannel.send({ content: '📌 **Final actions:**', components: [finalRow] });
    }
  });
}

/**
 * Handle interaction events for final action buttons.
 * @param {Interaction} interaction
 */
async function handleInteraction(interaction) {
  if (!interaction.isButton()) return;
  const { customId, user, channel, guild } = interaction;
  const ticketName = channel.name;
  const ticket = await Ticket.findOne({ ticketName }).lean();
  if (!ticket) return interaction.reply({ content: '⚠️ Ticket data not found.', ephemeral: true });
  const clientId = ticket.userId;
  const freelancerId = ticket.freelancerId;

  // Final actions
  if (customId === 'submit_review') {
    if (user.id !== clientId) return interaction.reply({ content: '❌ Only the client can submit a review.', ephemeral: true });
    // Send star rating buttons
    const stars = Array.from({ length: 10 }, (_, i) =>
      new ButtonBuilder()
        .setCustomId(`rate_${i+1}`)
        .setLabel(`${i+1}`)
        .setEmoji('⭐')
        .setStyle(ButtonStyle.Primary)
    );
    const rowA = new ActionRowBuilder().addComponents(stars.slice(0,5));
    const rowB = new ActionRowBuilder().addComponents(stars.slice(5));
    await interaction.reply({ content: '⭐️ Please rate the freelancer (1–10):', components: [rowA, rowB] });
  }

  else if (customId.startsWith('rate_')) {
    const rating = parseInt(customId.split('_')[1], 10);
    await interaction.reply({ content: `⭐ You rated **${rating}/10**. Now type your review (3 min):` });
    const filter = m => m.author.id === ticket.userId;
    const msgCollector = channel.createMessageCollector({ filter, max: 1, time: 180000 });
    msgCollector.on('collect', async msg => {
      const embed = new EmbedBuilder()
        .setTitle('📝 New Client Review')
        .setColor('#00b894')
        .addFields(
          { name: 'Client', value: `<@${clientId}>`, inline: true },
          { name: 'Freelancer', value: `<@${freelancerId}>`, inline: true },
          { name: 'Rating', value: `${'⭐'.repeat(rating)} (${rating}/10)` },
          { name: 'Review', value: msg.content }
        )
        .setTimestamp();
      const reviewCh = guild.channels.cache.get(REVIEW_CHANNEL_ID);
      if (reviewCh) await reviewCh.send({ embeds: [embed] });
      await channel.send('✅ Thank you! Your review has been posted.');
    });
  }

  else if (customId === 'close_ticket') {
    const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
    if (user.id !== clientId && !isAdmin) {
      return interaction.reply({ content: '❌ Only the client or an admin can close this ticket.', ephemeral: true });
    }
    await interaction.reply('🛑 Ticket will now close...');
    setTimeout(() => channel.delete().catch(() => {}), 3000);
  }

  else if (customId === 'escalate') {
    await interaction.reply('⚠️ Ticket escalated. A moderator will assist shortly.');
    // Optionally ping a mod role here
  }
}

module.exports = {
  deployStatusButtons,
  handleInteraction
};



