const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { Ticket } = require('../database');
const freelancerMatching = require('./freelanceMatching');

module.exports = {
  name: 'orders',
  description: 'Handles order creation with personalized flow',

  handleOrder: async function(interaction, ticketChannel) {
    const services = [
      { id: 'academic_writing', label: '📄 Academic Writing' },
      { id: 'exam_help', label: '🧪 Exam Help' },
      { id: 'tutoring', label: '🎓 Tutoring Session' },
      { id: 'graphic_design', label: '🎨 Graphic Design' },
      { id: 'web_dev', label: '💻 Web Development' },
      { id: 'uiux', label: '🧠 UI/UX Design' },
      { id: 'writing', label: '✍️ Writing' },
      { id: 'mobile_app', label: '📱 Mobile App Dev' },
      { id: 'anime_art', label: '🧚 Anime/Character Art' },
      { id: 'marketing', label: '📢 Marketing & SEO' },
      { id: 'video_editing', label: '🎬 Video Editing' }
    ];

    const rows = [];
    for (let i = 0; i < services.length; i += 5) {
      const row = new ActionRowBuilder();
      services.slice(i, i + 5).forEach(service => {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`service_${service.id}`)
            .setLabel(service.label)
            .setStyle(ButtonStyle.Primary)
        );
      });
      rows.push(row);
    }

    await ticketChannel.send({ content: '✨ Please select the service you need:', components: rows });

    const filter = i => i.user.id === interaction.user.id;
    const collector = ticketChannel.createMessageComponentCollector({ filter, time: 3600000 });

    collector.on('collect', async buttonInteraction => {
      const selected = services.find(s => buttonInteraction.customId === `service_${s.id}`);
      if (!selected) return;

      try {
        await buttonInteraction.update({ content: `✅ You selected **${selected.label}**`, components: [] });
      } catch (err) {
        console.warn('⚠️ Interaction already acknowledged or expired:', err.code);
      }

      await module.exports.askQuestions(ticketChannel, interaction, selected.id, selected.label);
      collector.stop();
    });
  },

  askQuestions: async function(channel, interaction, serviceId, serviceLabel) {
    const userId = interaction.user.id;
    const questionsMap = {
      academic_writing: [
        'What subject or topic is the writing task about?',
        'What type of academic paper is it? (e.g., essay, research paper, report)',
        'What citation style is required? (e.g., APA, MLA, Chicago)',
        'How many words or pages should it be?',
        'Do you need any references or research included?'
      ],
      exam_help: [
        'What subject is the exam for?',
        'Is it timed or take-home?',
        'What format is the exam? (e.g., multiple choice, essays, calculations)',
        'What are your weak areas you’d like help with?',
        'When is the exam scheduled?'
      ],
      tutoring: [
        'What subject or topic do you need tutoring in?',
        'What is your current level or understanding of the topic?',
        'Do you prefer a live session or recorded materials?',
        'What is your availability for the tutoring session?',
        'Do you have specific questions or problem sets to work on?'
      ],
      graphic_design: [
        'What type of design do you need? (e.g., logo, banner, flyer)',
        'What message/emotion should your design convey?',
        'Where will this design be used? (e.g., print, web, social media)'
      ],
      web_dev: [
        'What kind of website do you want? (e.g., e-commerce, blog)',
        'Do you have a preferred tech stack or CMS?',
        'Do you need backend functionality as well?'
      ],
      uiux: [
        'Are you looking for UI, UX or both?',
        'What platform is this for? (e.g., mobile, web)',
        'Do you have wireframes or branding guidelines?'
      ],
      writing: [
        'What type of writing is this? (e.g., article, ad copy, technical)',
        'Who is the target audience?',
        'Do you have any references or tone preferences?'
      ],
      mobile_app: [
        'Do you need an app for Android, iOS or both?',
        'What core features should it include?',
        'Do you have UI designs already?'
      ],
      anime_art: [
        'What style of anime art do you want?',
        'Is this for personal use, merch, or promotion?',
        'Describe your character or idea.'
      ],
      marketing: [
        'What’s your marketing goal? (e.g., traffic, conversions)',
        'Which platforms are you targeting?',
        'Do you need content creation, strategy, or both?'
      ],
      video_editing: [
        'What kind of video is this? (e.g., promo, vlog, explainer)',
        'How long is the raw footage?',
        'Do you need captions, effects, or background music?'
      ]
    };

    const orderAnswers = {};
    const questions = questionsMap[serviceId] || [];

    for (let q of questions) {
      await channel.send(`💬 ${q}`);
      const collected = await channel.awaitMessages({ filter: m => m.author.id === userId, max: 1, time: 90000 });
      if (!collected.size) return channel.send('❌ Timed out waiting for response.');
      orderAnswers[q] = collected.first().content;
    }

    await channel.send('💰 What is your estimated budget (USD)?');
    const budgetResponse = await channel.awaitMessages({ filter: m => m.author.id === userId, max: 1, time: 90000 });
    const budget = budgetResponse.first()?.content;

    await channel.send('📆 When is your ideal deadline?');
    const deadlineResponse = await channel.awaitMessages({ filter: m => m.author.id === userId, max: 1, time: 90000 });
    const deadline = deadlineResponse.first()?.content;

    const summary = new EmbedBuilder()
      .setTitle('📝 Order Summary')
      .setColor('#00b894')
      .setDescription(`**Service:** ${serviceLabel}\n**Budget:** $${budget}\n**Deadline:** ${deadline}`)
      .setTimestamp();

    Object.entries(orderAnswers).forEach(([q, a]) => {
      summary.addFields({ name: q, value: a });
    });

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('confirm_order').setLabel('✅ Confirm Order').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('edit_order').setLabel('🔁 Edit Order').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('cancel_order').setLabel('❌ Cancel Order').setStyle(ButtonStyle.Danger)
    );

    await channel.send({ embeds: [summary], components: [confirmRow] });

    const updatedTicket = await Ticket.findOneAndUpdate(
      { ticketName: channel.name },
      {
        $set: {
          order: {
            service: serviceLabel,
            answers: orderAnswers,
            budget,
            deadline
          }
        }
      },
      { new: true }
    );

    const collector = channel.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 60000 });
    collector.on('collect', async i => {
      if (i.customId === 'confirm_order') {
        try {
          if (i.deferred || i.replied) {
            await i.followUp({ content: '✅ Order confirmed. We are now matching you with a freelancer!', ephemeral: true });
          } else {
            await i.reply({ content: '✅ Order confirmed. We are now matching you with a freelancer!', flags: 64 });
          }
        } catch (err) {
          console.warn('⚠️ Could not reply to interaction:', err.message);
        }
        await freelancerMatching.execute(interaction, channel.name);
      } else if (i.customId === 'edit_order') {
        try {
          if (i.deferred || i.replied) {
            await i.followUp({ content: '🔁 Restarting order process...', ephemeral: true });
          } else {
            await i.reply({ content: '🔁 Restarting order process...', flags: 64 });
          }
        } catch (err) {
          console.warn('⚠️ Could not reply to interaction:', err.message);
        }
        module.exports.handleOrder(interaction, channel);
      } else if (i.customId === 'cancel_order') {
        try {
          if (i.deferred || i.replied) {
            await i.followUp({ content: '⚠️ Are you sure you want to cancel this order and close the ticket? Reply with `yes` or `no`.', ephemeral: true });
          } else {
            await i.reply({ content: '⚠️ Are you sure you want to cancel this order and close the ticket? Reply with `yes` or `no`.', flags: 64 });
          }
        } catch (err) {
          console.warn('⚠️ Could not reply to interaction:', err.message);
        }

        const confirm = await channel.awaitMessages({ filter: m => m.author.id === userId, max: 1, time: 30000 });
        if (confirm.first()?.content.toLowerCase() === 'yes') {
          await channel.send('❌ Order cancelled. This ticket will now be closed.');
          await Ticket.findOneAndDelete({ ticketName: channel.name });
          setTimeout(() => channel.delete().catch(() => {}), 3000);
        } else {
          await channel.send('✅ Cancellation aborted. Returning to order summary.');
        }
      }
    });
  }
};

