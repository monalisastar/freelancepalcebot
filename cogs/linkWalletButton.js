// cogs/linkWalletButton.js
const { Events, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const { ethers } = require('ethers');
const { connectDB, Wallet } = require('../database');  // ← updated import

module.exports = {
  name: 'linkWalletButton',
  once: false,

  async event(client) {
    client.on(Events.InteractionCreate, async interaction => {
      if (!interaction.isButton() || interaction.customId !== 'link_wallet') return;

      // 1️⃣ Ask for the address
      await interaction.reply({
        content: '📝 Please enter your Ethereum wallet address (0x…):',
        ephemeral: true
      });

      const filter = m => m.author.id === interaction.user.id;
      const collector = interaction.channel.createMessageCollector({
        filter, time: 30000, max: 1
      });

      collector.on('collect', async msg => {
        const addr = msg.content.trim();
        if (!ethers.utils.isAddress(addr)) {
          return interaction.followUp({
            content: '❌ That doesn’t look valid. Try again by clicking 🔗 Link Wallet.',
            ephemeral: true
          });
        }

        try {
          // 2️⃣ Persist in MongoDB
          await connectDB();
          await Wallet.findOneAndUpdate(
            { discordId: interaction.user.id },
            { address: addr },
            { upsert: true }
          );
          // 3️⃣ Confirm
          await interaction.followUp({
            content: `✅ Successfully linked to **${addr}**.`,
            ephemeral: true
          });
        } catch (err) {
          console.error('Error saving wallet:', err);
          await interaction.followUp({
            content: '❌ Could not save your address. Please try again later.',
            ephemeral: true
          });
        }
      });
    });
  }
};

