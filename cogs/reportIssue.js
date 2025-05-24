const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { Report } = require('../database'); // 🆕 import report model
const staffRoleId = '1092426059137429545'; // Your staff role ID

// Helper to generate Report ID
async function generateReportId() {
  const count = await Report.countDocuments();
  const paddedNumber = String(count + 1).padStart(6, '0');
  return `REP-${paddedNumber}`;
}

module.exports = {
  async handleReportIssue(interaction, ticketChannel) {
    const embed = new EmbedBuilder()
      .setTitle('🛡️ File a Report')
      .setColor('#FF4444')
      .setDescription(`Hello <@${interaction.user.id}>! Please choose the type of report you want to file:`)
      .setFooter({ text: 'Issue Reporting System' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('report_freelancer_scam').setLabel('Freelancer Scammed Me').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('report_client_nonpay').setLabel('Client Refused to Pay').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('report_harassment').setLabel('Harassment').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('report_spam').setLabel('Spam').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('report_service_fail').setLabel('Service Not Delivered').setStyle(ButtonStyle.Danger)
    );

    await ticketChannel.send({ embeds: [embed], components: [row] });
  },

  async handleStartReport(interaction) {
    if (!interaction.isButton()) return;

    const reportReasons = {
      'report_freelancer_scam': 'Freelancer Scammed Me',
      'report_client_nonpay': 'Client Refused to Pay',
      'report_harassment': 'Harassment',
      'report_spam': 'Spam',
      'report_service_fail': 'Service Not Delivered'
    };

    const reason = reportReasons[interaction.customId];
    if (!reason) return;

    await interaction.update({ components: [], embeds: [new EmbedBuilder().setDescription(`Starting report for: **${reason}**`).setColor('#FF6666')] });

    const questions = [
      '📄 **Order ID / Ticket ID** (if available):',
      '📝 **Describe what happened**:',
      '👥 **Mention the users involved (if any)**:',
      '⏰ **When did it happen? (Date & Time)**:',
      '📎 **Upload any proof (screenshots, links, etc.)**:',
      '🎯 **What resolution are you seeking? (refund, warning, etc.)**:'
    ];

    const answers = [];
    const files = [];

    const askQuestion = async (i = 0) => {
      if (i >= questions.length) {
        await finalizeReport(interaction, reason, answers, files);
        return;
      }

      await interaction.followUp({ content: `${questions[i]}`, ephemeral: true });

      const filter = m => m.author.id === interaction.user.id;
      const collector = interaction.channel.createMessageCollector({ filter, max: 1, time: 120000 });

      collector.on('collect', async msg => {
        answers.push(msg.content);

        // Capture attachments if any
        if (msg.attachments.size > 0) {
          msg.attachments.forEach(att => files.push(att.url));
        }

        askQuestion(i + 1);
      });

      collector.on('end', collected => {
        if (collected.size === 0) {
          interaction.followUp({ content: '⏱️ Report timed out. Please start again.', ephemeral: true });
        }
      });
    };

    askQuestion();
  }
};

// Utility to finalize and save the report
async function finalizeReport(interaction, reason, answers, files) {
  try {
    const reportId = await generateReportId();

    const involvedUsers = (answers[2].match(/<@!?(\d+)>/g) || []).map(m => m.replace(/\D/g, ''));

    const report = await Report.create({
      reportId,
      reporterId: interaction.user.id,
      reporterUsername: interaction.user.username,
      reportedUserIds: involvedUsers,
      orderIdOrTicketId: answers[0] || 'N/A',
      description: `${reason}\n\n${answers[1]}`,
      proofLinks: files,
      expectedResolution: answers[5] || 'N/A',
      status: 'Open'
    });

    const reportEmbed = new EmbedBuilder()
      .setTitle('🚨 New Report Submitted')
      .setColor('#FF5555')
      .setDescription(`**Reporter:** <@${interaction.user.id}>\n**Reason:** ${reason}`)
      .addFields(
        { name: 'Order ID / Ticket ID', value: answers[0] || 'N/A' },
        { name: 'What Happened?', value: answers[1] || 'N/A' },
        { name: 'Involved Users', value: answers[2] || 'N/A' },
        { name: 'When It Happened', value: answers[3] || 'N/A' },
        { name: 'Expected Resolution', value: answers[5] || 'N/A' }
      )
      .setFooter({ text: `Report ID: ${reportId} | Status: Open` })
      .setTimestamp();

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`report_underreview_${reportId}`).setLabel('🔎 Under Review').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`report_resolved_${reportId}`).setLabel('✅ Resolved').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`report_dismiss_${reportId}`).setLabel('❌ Dismiss').setStyle(ButtonStyle.Danger)
    );

    await interaction.channel.send({
      content: `<@&${staffRoleId}> 📢 **New report received!**`,
      embeds: [reportEmbed],
      components: [actionRow]
    });

    await interaction.followUp({ content: '✅ Your report has been submitted and is under review!', ephemeral: true });

  } catch (err) {
    console.error('❌ Error finalizing report:', err);
    await interaction.followUp({ content: '❌ Error saving report. Please try again.', ephemeral: true });
  }
}


