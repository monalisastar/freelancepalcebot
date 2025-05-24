const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
  } = require('discord.js');
  
  const { FreelancerApplication } = require('../database'); // 🆕 Import freelancer model
  const staffRoleId = '1092426059137429545';
  
  module.exports = {
    // Utility function to finalize the application
    async finalizeInterview(channel, user, service, answers) {
      try {
        // 🛠️ Save application to database
        const application = await FreelancerApplication.create({
          userId: user.id,
          username: user.username,
          service: service,
          answers: answers,
          status: 'Pending'
        });
  
        console.log(`📦 Application saved to DB: ${application._id}`);
  
        const summaryEmbed = new EmbedBuilder()
          .setTitle(`✅ Freelancer Interview Submitted`)
          .setDescription(`**Applicant:** <@${user.id}>\n**Service:** ${service}`)
          .addFields(
            { name: 'Experience', value: answers[0] || 'N/A' },
            { name: 'Tools/Tech Used', value: answers[1] || 'N/A' },
            { name: 'Challenge Solved', value: answers[2] || 'N/A' },
            { name: 'Portfolio', value: answers[3] || 'N/A' },
            { name: 'Availability', value: answers[4] || 'N/A' },
            { name: 'Rates', value: answers[5] || 'N/A' },
          )
          .setColor('#00cc66')
          .setFooter({ text: `Application ID: ${application._id}` }) // Show ID for reference
          .setTimestamp();
  
        // 🔘 Create Approve/Reject buttons
        const actionRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`approve_${application._id}`)
              .setLabel('Approve ✅')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`reject_${application._id}`)
              .setLabel('Reject ❌')
              .setStyle(ButtonStyle.Danger)
          );
  
        await channel.send({
          content: `<@&${staffRoleId}> 📢 **New Freelancer Interview Submitted**`,
          embeds: [summaryEmbed],
          components: [actionRow]
        });
  
      } catch (err) {
        console.error('❌ Error finalizing freelancer interview:', err);
        await channel.send({
          content: '❌ There was an error saving the application. Please try again later.'
        });
      }
    },
  
    // Step 1: Show service selection buttons
    async handleFreelancerApplication(interaction, ticketChannel) {
      const services = [
        'Graphic Design', 'Web Development', 'Full-stack Development',
        'Programming (Backend)', 'UI/UX Design', 'Mobile App Development',
        'Anime Art / Character Design', 'Writing (Content Writing, Copywriting, etc.)',
        'Video Editing', 'Marketing (Social Media, SEO, etc.)'
      ];
  
      const rows = [];
      for (let i = 0; i < services.length; i += 5) {
        const row = new ActionRowBuilder();
        services.slice(i, i + 5).forEach(service => {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`service_${service.toLowerCase().replace(/\s+/g, '_')}`)
              .setLabel(service)
              .setStyle(ButtonStyle.Primary)
          );
        });
        rows.push(row);
      }
  
      await ticketChannel.send({
        content: '🛠️ **Select the service you’re applying for:**',
        components: rows,
      });
  
      const filter = i => i.user.id === interaction.user.id;
      const collector = ticketChannel.createMessageComponentCollector({ filter, time: 10 * 60 * 1000 });
  
      collector.on('collect', async selectInteraction => {
        await selectInteraction.deferUpdate(); // Acknowledge button press
  
        const selectedService = selectInteraction.customId.replace('service_', '').replace(/_/g, ' ');
  
        const introEmbed = new EmbedBuilder()
          .setTitle(`📝 Interview: ${selectedService}`)
          .setDescription(`You're applying as a **${selectedService}** freelancer.\nLet’s begin your interview.`)
          .setColor('#0066ff');
  
        await selectInteraction.editReply({ embeds: [introEmbed], components: [] });
  
        const questions = [
          `Describe your experience with **${selectedService}**.`,
          'What tools or technologies do you commonly use?',
          'Share a challenge you solved in a past project.',
          'Paste your **portfolio links** (GitHub, Behance, etc.)',
          'How many hours per week can you commit? (Include your timezone)',
          'What are your expected **rates**? (Hourly or Fixed)'
        ];
  
        const answers = [];
  
        // ⚡ Ask questions one by one
        const askQuestion = async (currentQuestionIndex = 0) => {
          if (currentQuestionIndex >= questions.length) {
            await module.exports.finalizeInterview(ticketChannel, selectInteraction.user, selectedService, answers);
            return;
          }
  
          await ticketChannel.send({
            content: `<@${selectInteraction.user.id}> **${questions[currentQuestionIndex]}**`
          });
  
          const messageCollector = ticketChannel.createMessageCollector({
            filter: m => m.author.id === selectInteraction.user.id,
            max: 1,
            time: 60000
          });
  
          messageCollector.on('collect', msg => {
            answers.push(msg.content);
            askQuestion(currentQuestionIndex + 1);
          });
  
          messageCollector.on('end', collected => {
            if (collected.size === 0) {
              ticketChannel.send({ content: '⏱️ Interview timed out. Please try again later.' });
            }
          });
        };
  
        await askQuestion(0); // Start interview
      });
  
      collector.on('end', collected => {
        if (collected.size === 0) {
          ticketChannel.send({ content: '⏱️ Time’s up! The service selection has expired.' });
        }
      });
    }
  };
  
  
  
  
  
  
  

