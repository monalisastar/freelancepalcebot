const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const { Ticket } = require('../database');
const orderStatus = require('./orderStatus');

module.exports = {
  name: 'freelanceMatching',
  description: 'Handles sending tickets to freelancers and claim/reject logic',

  execute: async function(interaction, ticketName) {
    const guild = interaction.guild;

    // ✅ Use only the current guild's configured post channel
    const channelMap = {
  '1053975227459178547': '1363025319912804573', // Freelancers Palace
  '1346355213358862397': '1295087215524712518', // Hire a Tutor
  '1046683041675870278': '1295087215524712518'  // Active guild posting to tutor-chat
};

    const postChannelId = channelMap[guild.id];
    const postChannel = guild.channels.cache.get(postChannelId);
    const supportRoleId = '1073480619318837268';

    let ticket = null;
    for (let i = 0; i < 5; i++) {
      ticket = await Ticket.findOne({ ticketName }).lean();
      if (ticket?.order) break;
      await new Promise(res => setTimeout(res, 100));
    }

    if (!ticket || !ticket.order) {
      console.error('❌ No ticket or order data found');
      const channel = interaction.channel;
      await channel.send('⚠️ Order not found. Please try confirming again or contact support.');
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📥 New Order Available')
      .setColor('#4B9CD3')
      .setDescription(`**Service:** ${ticket.order.service}\n**Budget:** $${ticket.order.budget}\n**Deadline:** ${ticket.order.deadline}`)
      .setFooter({ text: 'React within 24 hours to claim this job.' })
      .setTimestamp();

    for (const [question, answer] of Object.entries(ticket.order.answers || {})) {
      embed.addFields({ name: question, value: answer });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('claim_order').setLabel('✅ Claim').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('reject_order').setLabel('❌ Reject').setStyle(ButtonStyle.Danger)
    );

    if (postChannel) {
      const post = await postChannel.send({
        content: `<@&${supportRoleId}> A new order is available for claiming:`,
        embeds: [embed],
        components: [row]
      });

      const collector = post.createMessageComponentCollector({ time: 24 * 60 * 60 * 1000 });

      collector.on('collect', async (i) => {
        const freelancer = i.user;
        if (i.customId === 'claim_order') {
          await i.reply({ content: `🎉 You have claimed this ticket!`, flags: 64 });

          const claimedTicket = guild.channels.cache.find(c => c.name === ticketName && c.type === 0);
          if (claimedTicket) {
            await claimedTicket.permissionOverwrites.edit(freelancer.id, {
              ViewChannel: true,
              SendMessages: true,
              ReadMessageHistory: true
            });
            await claimedTicket.send(`👋 <@${freelancer.id}> has claimed this order! You now have access to this ticket.`);

            await orderStatus.deployStatusButtons(claimedTicket, ticket.userId, freelancer.id);
          }

          await post.edit({
            content: `✅ Claimed by <@${freelancer.id}>`,
            components: []
          });

          collector.stop();
        } else if (i.customId === 'reject_order') {
          await i.reply({ content: `No worries! We'll notify others.`, flags: 64 });
          await post.edit({
            content: `📢 The previous freelancer passed on the order. <@&${supportRoleId}>, it's still up for grabs!`,
            components: [row]
          });
        }
      });

      collector.on('end', async () => {
        try {
          await post.edit({ components: [] });
          await postChannel.send('⏰ The order post has expired after 24 hours.');
        } catch (err) {
          console.error('Error editing post after expiration:', err);
        }
      });
    } else {
      console.warn(`⚠️ No configured post channel for guild: ${guild.id}`);
    }
  }
};

