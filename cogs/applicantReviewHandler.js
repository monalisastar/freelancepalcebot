const { FreelancerApplication } = require('../database');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const staffRoleId = '1092426059137429545'; // Optional: Restrict button usage to staff only

module.exports = {
  name: 'applicantReviewHandler',
  description: 'Handles freelancer application review actions',

  async execute(interaction) {
    if (!interaction.isButton()) return;

    const [action, applicationId] = interaction.customId.split('_');

    if (!['approve', 'reject'].includes(action)) return; // Ignore unrelated buttons

    try {
      // (Optional) Staff Role Check
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) &&
          !interaction.member.roles.cache.has(staffRoleId)) {
        await interaction.reply({ content: '❌ You do not have permission to approve/reject applications.', ephemeral: true });
        return;
      }

      // Find the application
      const application = await FreelancerApplication.findById(applicationId);

      if (!application) {
        await interaction.reply({ content: '❌ Application not found. It may have been deleted.', ephemeral: true });
        return;
      }

      // Update status
      application.status = (action === 'approve') ? 'Approved' : 'Rejected';
      await application.save();

      console.log(`✅ Application ${applicationId} ${action}d by ${interaction.user.tag}`);

      // Disable buttons after decision
      const disabledRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('approved_disabled')
            .setLabel('Approved ✅')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('rejected_disabled')
            .setLabel('Rejected ❌')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true)
        );

      const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setFooter({ text: `Application ID: ${application._id} • Status: ${application.status}` });

      await interaction.update({
        embeds: [updatedEmbed],
        components: [disabledRow]
      });

      // Notify the applicant (Optional)
      const applicant = await interaction.guild.members.fetch(application.userId).catch(() => null);

      if (applicant) {
        await applicant.send(`📢 Your freelancer application for **${application.service}** has been **${application.status}**!`);
      }

    } catch (error) {
      console.error('❌ Error handling application decision:', error);
      if (!interaction.replied) {
        await interaction.reply({ content: '❌ An error occurred while processing the application.', ephemeral: true });
      }
    }
  }
};

