const { Report } = require('../database');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const staffRoleId = '1092426059137429545'; // Staff/Admin role ID

module.exports = {
  name: 'reportReviewHandler',
  description: 'Handles staff actions on reports (Under Review, Resolved, Dismiss)',

  async execute(interaction) {
    if (!interaction.isButton()) return;

    // Check if this button is related to report handling
    if (!interaction.customId.startsWith('report_')) return;

    const [_, action, reportId] = interaction.customId.split('_');

    if (!['underreview', 'resolved', 'dismiss'].includes(action)) return;

    try {
      // Permission check
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) &&
          !interaction.member.roles.cache.has(staffRoleId)) {
        return await interaction.reply({ content: '❌ You do not have permission to manage reports.', ephemeral: true });
      }

      const report = await Report.findOne({ reportId });

      if (!report) {
        return await interaction.reply({ content: '❌ Report not found in database.', ephemeral: true });
      }

      // Update report status
      if (action === 'underreview') report.status = 'Under Review';
      if (action === 'resolved') report.status = 'Resolved';
      if (action === 'dismiss') report.status = 'Dismissed';

      await report.save();

      console.log(`✅ Report ${reportId} marked as ${report.status} by ${interaction.user.tag}`);

      // Build disabled action row
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('report_underreview_disabled').setLabel('🔎 Under Review').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('report_resolved_disabled').setLabel('✅ Resolved').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId('report_dismiss_disabled').setLabel('❌ Dismissed').setStyle(ButtonStyle.Danger).setDisabled(true)
      );

      // Update the embed
      const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setFooter({ text: `Report ID: ${reportId} | Status: ${report.status}` });

      await interaction.update({
        embeds: [updatedEmbed],
        components: [disabledRow]
      });

      // (Optional) Notify reporter if resolved or dismissed
      if (['resolved', 'dismiss'].includes(action)) {
        const reporter = await interaction.guild.members.fetch(report.reporterId).catch(() => null);
        if (reporter) {
          await reporter.send(`📢 Your report **${reportId}** has been marked as **${report.status}** by the staff.`);
        }
      }

    } catch (error) {
      console.error('❌ Error handling report action:', error);
      if (!interaction.replied) {
        await interaction.reply({ content: '❌ Error processing the report.', ephemeral: true });
      }
    }
  }
};

