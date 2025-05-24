// bot.js
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { connectDB } = require('./database');
const { loadedContracts } = require('./contracts/loader');  // loadAllContracts now runs inside loader.js

connectDB();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const ticketRegistryContract = loadedContracts.TicketRegistry;
const escrowContract = loadedContracts.EscrowService;

const cogsFolder = path.join(__dirname, 'cogs');
fs.readdirSync(cogsFolder).forEach(file => {
  if (!file.endsWith('.js')) return;
  const cog = require(path.join(cogsFolder, file));
  console.log(`Loaded cog: ${file}`);

  if (typeof cog.event === 'function') {
    cog.event(client);
  }
});

client.on('messageCreate', async message => {
  if (message.content === '!start-escrow') {
    try {
      const startEscrowCog = require(path.join(__dirname, 'cogs', 'escrowStart'));
      await startEscrowCog.execute(message);
    } catch (error) {
      console.error("Error executing !start-escrow:", error);
      message.channel.send("An error occurred while processing the escrow command.");
    }
  }

  if (message.content === '!sendTicketButtons') {
    try {
      const ticketCog = require('./cogs/ticket');
      await ticketCog.sendTicketButtons(message.channel);
    } catch (error) {
      console.error("Error sending ticket buttons:", error);
      message.channel.send("An error occurred while sending the ticket creation buttons.");
    }
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  // Only handle specific ticket creation buttons
  const validTicketButtons = ['ticketOrderHere', 'ticketFreelancerApply', 'ticketReportIssue'];
  if (validTicketButtons.includes(interaction.customId)) {
    const ticketCog = require('./cogs/ticket');
    try {
      await ticketCog.execute(interaction);
    } catch (err) {
      console.error('❌ Error handling ticket interaction:', err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Something went wrong handling your ticket.', ephemeral: true });
      }
    }
  }
});

const app = express();
app.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.send('No code received!');

  try {
    const tokenResponse = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        'client_id': process.env.CLIENT_ID,
        'client_secret': process.env.CLIENT_SECRET,
        code,
        'grant_type': 'authorization_code',
        'redirect_uri': process.env.REDIRECT_URI
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    console.log('Access Token:', tokenResponse.data.access_token);
    res.send('OAuth callback successful!');
  } catch (error) {
    res.send('Error exchanging code for token: ' + error.message);
  }
});

client.once('ready', () => {
  console.log('🤖 Bot is online!');
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🌐 Server is running on http://localhost:${PORT}`);
});

client.login(process.env.DISCORD_BOT_TOKEN);
























