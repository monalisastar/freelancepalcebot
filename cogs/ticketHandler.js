const { loadedContracts } = require('../contracts/loader');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');
const { Ticket } = require('../database');
const orders = require('./orders');
const freelancerApp = require('./freelancerApplication');
const reportHandler = require('./reportIssue');

module.exports = {
  name: 'ticketHandler',
  description: 'Handles private ticket creation for specific buttons',

  async execute(interaction) {
    if (!interaction.isButton()) return;

    const userId = interaction.user.id;
    const guild = interaction.guild;
    const botId = interaction.client.user.id;
    const ticketRegistryContract = loadedContracts.TicketRegistry;

    // ✅ Correct mapping: guild ID => category ID
    const categoryMap = {
  '1053975227459178547': '1053975227459178547', // Freelancers Palace category
  '1346355213358862397': '1346355213358862397', // Hire a Tutor: valid category ID
  '1046683041675870278': '1346355213358862397'   // Map this guild to same valid category
};
    const categoryId = categoryMap[guild.id];
    if (!categoryId) {
      console.error('❌ No valid category ID for guild:', guild.id);
      return interaction.editReply({ content: '❌ Ticket creation failed: no valid category configured.', ephemeral: true });
    }

    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true });
      }
    } catch (err) {
      if (err.code === 10062) {
        console.warn('⚠️ Interaction expired before bot could defer. Skipping.');
        return;
      } else {
        console.error('❌ Failed to defer reply:', err);
        return;
      }
    }

    const ticketName = `ticket-${interaction.customId.toLowerCase()}-${userId}-${new Date().toISOString().split('T')[0]}`;
    let ticketChannel;
    try {
      ticketChannel = await guild.channels.create({
        name: ticketName,
        type: 0,
        parent: categoryId,
        permissionOverwrites: [
          {
            id: userId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.UseApplicationCommands,
            ]
          },
          {
            id: botId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.UseApplicationCommands,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.AttachFiles
            ]
          },
          {
            id: guild.roles.everyone,
            deny: [PermissionFlagsBits.ViewChannel]
          }
        ],
      });
    } catch (err) {
      console.error('🚨 Failed to create ticket channel:', err);
      return interaction.editReply({ content: '❌ Failed to create ticket channel. Please try again later.' });
    }

    const ticketData = {
      userId,
      ticketName,
      createdAt: new Date().toISOString(),
      status: 'Created',
      description: `${interaction.customId.toLowerCase()} ticket for user ${interaction.user.username}`,
    };

    let savedTicket;
    let txHash = 'pending';

    const embedTemplates = {
      ticketOrderHere: {
        title: 'Order Ticket Created',
        desc: 'A **Smart Contract Ticket** has been created for your order request! 🎉\n\nWe’ll guide you through your order step by step.',
      },
      ticketFreelancerApply: {
        title: 'Freelancer Application Ticket Created',
        desc: 'A **Smart Contract Ticket** has been created for your application! 🌟\n\nFollow the steps to complete your profile.',
      },
      ticketReportIssue: {
        title: 'Complaint Ticket Created',
        desc: 'A **Smart Contract Ticket** has been created for your complaint! 📝\n\nPlease describe your issue in detail so we can resolve it.',
      },
    };

    const embedContent = embedTemplates[interaction.customId] || {
      title: 'Ticket Created',
      desc: 'A **Smart Contract Ticket** has been created for you! Please follow the instructions inside the ticket.',
    };

    const initialEmbed = new EmbedBuilder()
      .setColor('#4B9CD3')
      .setTitle(embedContent.title)
      .setDescription(`${embedContent.desc}\n\n**Transaction Status:** *Pending Escrow Agreement*`)
      .setFooter({ text: 'Smart Contract Ticketing System' })
      .setTimestamp();

    let sentMessage;
    try {
      sentMessage = await ticketChannel.send({
        content: `<@${userId}>`,
        embeds: [initialEmbed],
      });
    } catch (err) {
      console.error('🚨 Failed to send initial embed to ticket channel:', err);
    }

    try {
      savedTicket = await saveTicketToDatabase(ticketData);

      if (!ticketRegistryContract) {
        throw new Error('TicketRegistry contract not loaded.');
      }

      const gasEstimate = await ticketRegistryContract.estimateGas.logTicket(savedTicket._id.toString(), txHash);
      const tx = await ticketRegistryContract.logTicket(savedTicket._id.toString(), txHash, { gasLimit: gasEstimate });
      const receipt = await tx.wait();
      txHash = receipt.transactionHash;

      console.log('✅ Ticket logged on-chain with ID:', savedTicket._id);

      if (sentMessage) {
        const updatedEmbed = EmbedBuilder.from(initialEmbed)
          .setDescription(`${embedContent.desc}\n\n**Transaction Status:** [View on Explorer](https://sepolia.etherscan.io/tx/${txHash})`);
        await sentMessage.edit({ embeds: [updatedEmbed] });
      }

    } catch (error) {
      console.error('🚨 Blockchain logging error:', error);
      return interaction.editReply({ content: `❌ Blockchain error: ${error.message || 'Unknown error.'}` });
    }

    try {
      await interaction.editReply({
        content: `✅ A **Smart Contract Ticket** has been created. Check <#${ticketChannel.id}> to proceed.`,
      });
    } catch (error) {
      console.error('🚨 Failed to send confirmation reply:', error);
    }

    if (interaction.customId === 'ticketOrderHere') {
      await orders.handleOrder(interaction, ticketChannel);
    } else if (interaction.customId === 'ticketFreelancerApply') {
      await freelancerApp.handleFreelancerApplication(interaction, ticketChannel);
    } else if (interaction.customId === 'ticketReportIssue') {
      await reportHandler.handleReportIssue(interaction, ticketChannel);
    }
  },
};

async function saveTicketToDatabase(ticketData) {
  const newTicket = new Ticket(ticketData);
  const saved = await newTicket.save();
  console.log('📦 Ticket saved to DB:', saved._id);
  return saved;
}











