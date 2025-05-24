const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const ticketHandler = require('./ticketHandler'); // Ensure the file path is correct

module.exports = {
  name: 'ticket',
  description: 'Ticket creation and management for Freelancers Palace',

  async execute(interaction) {
    if (!interaction.isButton()) return;  // Ensure the interaction is a button click

    // Pass the interaction to the ticketHandler to manage ticket creation and flow
    await ticketHandler.execute(interaction); 
  },

  async sendTicketButtons(channel) {
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Welcome to Freelancers Palace — Web3 Talent Hub')
      .setDescription('Choose an action to interact with our decentralized freelance ecosystem:')
      .setTimestamp();

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('ticketOrderHere')
          .setLabel('Order Here')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📝'),
        new ButtonBuilder()
          .setCustomId('ticketFreelancerApply')
          .setLabel('Apply as Freelancer')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('💼'),
        new ButtonBuilder()
          .setCustomId('ticketReportIssue')
          .setLabel('Report an Issue')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('⚠️')
      );

    await channel.send({ embeds: [embed], components: [row] });
  },
};








