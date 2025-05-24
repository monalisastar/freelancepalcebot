// cogs/escrowStart.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events } = require('discord.js');
const { escrowContract, tokenContract } = require('../ether');
const { ethers } = require('ethers');
const axios = require('axios');
const { Wallet } = require('../database');  // ← changed from require('../models/Wallet')

// Helper to map Discord IDs to on-chain wallet addresses
async function getUserWallet(discordId) {
    const rec = await Wallet.findOne({ discordId });
    return rec ? rec.address : null;
}

const supportedTokens = {
    MATIC: { name: "MATIC/ETH", address: ethers.constants.AddressZero, decimals: 18 },
    USDC:  { name: "USDC",        address: "0x6CaFd179B1ab5D9674A45FeA6D2D2B30fDd40f63", decimals: 6 },
    USDT:  { name: "USDT",        address: "0x3813e82e6f7098b9583FC0F33a962D02018B6803", decimals: 6 },
    DAI:   { name: "DAI",         address: "0x001B3B4d0F3714CA98ba10F6042daEbF0B1B7b6F", decimals: 18 },
    WBTC:  { name: "WBTC",        address: "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6", decimals: 8 }
};

const selectedCurrency = {}; // Store user currency choice

module.exports = {
    name: 'startEscrow',
    once: false,

    async execute(message) {
        try {
            console.log('Sending the initial button panel');
            
            // Fetch live prices
            const prices = await this.fetchCryptoPrices([
                'bitcoin','ethereum','usd-coin','matic-network'
            ]);

            // Build the embed
            const embed = new EmbedBuilder()
                .setTitle("🎛️ Escrow Service Panel")
                .setDescription("Please choose an action to proceed.")
                .setColor('#3498db')
                .setThumbnail('https://example.com/logo.png')
                .addFields(
                    { name: '💵 Start Escrow',    value: 'Create a new escrow.',            inline: true },
                    { name: '📜 View My Escrows', value: 'See your active and past escrows.', inline: true }
                )
                .setFooter({
                    text: `Powered by Your Escrow Service | BTC: $${prices.bitcoin} | ETH: $${prices.ethereum} | MATIC: $${prices.matic} | USDC: $${prices.usdc}`
                });

            // User action buttons (max 5)
            const userRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('start_escrow')
                    .setLabel('💵 Start New Escrow')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('view_my_escrows')
                    .setLabel('📜 View My Escrows')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('release_funds')
                    .setLabel('✅ Release Funds')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('check_flr')
                    .setLabel('💰 My FLR Balance')
                    .setStyle(ButtonStyle.Secondary),
                // 🔗 Link Wallet button
                new ButtonBuilder()
                    .setCustomId('link_wallet')
                    .setLabel('🔗 Link Wallet')
                    .setStyle(ButtonStyle.Primary)
            );

            const components = [userRow];

            // Admin buttons
            if (message.member?.permissions.has('ADMINISTRATOR')) {
                const adminRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('admin_force_release')
                        .setLabel('🔥 Admin Force Release')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('admin_emergency_withdraw')
                        .setLabel('🚨 Emergency Withdraw')
                        .setStyle(ButtonStyle.Danger)
                );
                components.push(adminRow);
            }

            await message.reply({ embeds: [embed], components });
        } catch (error) {
            console.error("Error in !start-escrow command execution:", error);
            message.channel.send("⚠️ An error occurred while processing the escrow command.");
        }
    },

    async event(client) {
        client.on(Events.InteractionCreate, async (interaction) => {
            try {
                if (!interaction.isButton()) return;
                const id = interaction.customId;
                console.log(`Interaction received: ${id}`);

                // ── Start Escrow Flow ──
                if (id === 'start_escrow') {
                    await interaction.deferUpdate();
                    const currencyRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('escrow_matic')
                            .setLabel('💰 MATIC/ETH')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('escrow_usdc')
                            .setLabel('💵 USDC')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('escrow_usdt')
                            .setLabel('💵 USDT')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('escrow_dai')
                            .setLabel('🪙 DAI')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('escrow_wbtc')
                            .setLabel('🪙 WBTC')
                            .setStyle(ButtonStyle.Secondary)
                    );
                    await interaction.followUp({
                        content: '💵 Choose the currency you want to use for escrow:',
                        components: [currencyRow],
                        ephemeral: true
                    });
                }

                // ── Currency Selection & TWO-STEP Prompt ──
                if (id.startsWith('escrow_')) {
                    // 1️⃣ Identify currency
                    const tokenKey = id.replace('escrow_', '').toUpperCase();
                    const selected = supportedTokens[tokenKey];
                    if (!selected) return;

                    // 2️⃣ Ask for freelancer address
                    await interaction.reply({
                        content: '📝 Please enter the **freelancer’s** Ethereum address (0x…):',
                        ephemeral: true
                    });
                    const filter = m => m.author.id === interaction.user.id;
                    const addrCollector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

                    addrCollector.on('collect', async addrMsg => {
                        const freelancerAddr = addrMsg.content.trim();
                        if (!ethers.utils.isAddress(freelancerAddr)) {
                            return interaction.followUp({
                                content: '❌ Invalid address! Start over with `!start-escrow`.',
                                ephemeral: true
                            });
                        }

                        // 3️⃣ Ask for amount
                        await interaction.followUp({
                            content: `📝 Enter the amount of **${selected.name}** to escrow **for ${freelancerAddr}**:`,
                            ephemeral: true
                        });
                        const amtCollector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

                        amtCollector.on('collect', async amtMsg => {
                            const amountInput = amtMsg.content.trim();
                            if (isNaN(amountInput)) {
                                return interaction.followUp({
                                    content: '❌ Invalid number! Start over with `!start-escrow`.',
                                    ephemeral: true
                                });
                            }
                            const amount = ethers.utils.parseUnits(amountInput, selected.decimals);

                            // 4️⃣ Instruct the client to deposit from THEIR wallet
                            const escrowAddr = escrowContract.address;
                            await interaction.followUp({
                                embeds: [
                                    new EmbedBuilder()
                                        .setTitle("💳 Deposit Instructions")
                                        .setDescription(
                                            `Please send **${amountInput} ${selected.name}** from your wallet to our Escrow contract:\n` +
                                            `\`${escrowAddr}\`\n\n` +
                                            `Once confirmed, click **🟢 I have paid** below and paste your TX hash.`
                                        )
                                        .setColor('#2ECC71')
                                ],
                                components: [
                                    new ActionRowBuilder().addComponents(
                                        new ButtonBuilder()
                                            .setCustomId('confirm_payment')
                                            .setLabel('🟢 I have paid')
                                            .setStyle(ButtonStyle.Success),
                                        new ButtonBuilder()
                                            .setCustomId('cancel_escrow')
                                            .setLabel('❌ Cancel Escrow')
                                            .setStyle(ButtonStyle.Danger)
                                    )
                                ],
                                ephemeral: true
                            });
                        });
                    });
                }

                // ── Admin Actions ──
                if (id === 'admin_force_release' || id === 'admin_emergency_withdraw') {
                    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
                        return interaction.reply({ content: '❌ You lack permissions.', ephemeral: true });
                    }
                    const action = id === 'admin_force_release' ? 'force release' : 'emergency withdraw';
                    console.log(`Admin action: ${action}`);
                    await interaction.reply({
                        content: `⚠️ Admin initiated: ${action}.`,
                        ephemeral: true
                    });
                }

                // ── Check FLR Balance ──
                if (id === 'check_flr') {
                    await interaction.deferUpdate();
                    const wallet = await getUserWallet(interaction.user.id);
                    if (!wallet) {
                        return interaction.followUp({
                            content: "❌ Please link your wallet first.",
                            ephemeral: true
                        });
                    }
                    const raw = await tokenContract.balanceOf(wallet);
                    const bal = ethers.utils.formatUnits(raw, 18);
                    const embedFlr = new EmbedBuilder()
                        .setTitle("💰 Your FLR Balance")
                        .setDescription(`You currently have **${bal}** FLR tokens.`)
                        .setColor('#F1C40F')
                        .setThumbnail('https://i.imgur.com/6M513B0.png');
                    await interaction.followUp({ embeds: [embedFlr], ephemeral: true });
                }

                // ── Link Wallet Flow ──
                if (id === 'link_wallet') {
                    await interaction.reply({
                        content: '📝 Please paste your Ethereum wallet address (0x…):',
                        ephemeral: true
                    });
                    const filter = m => m.author.id === interaction.user.id;
                    const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });
                    collector.on('collect', async m => {
                        const addr = m.content.trim();
                        if (!ethers.utils.isAddress(addr)) {
                            return interaction.followUp({
                                content: '❌ Invalid address! Please try again by clicking 🔗 Link Wallet.',
                                ephemeral: true
                            });
                        }
                        await Wallet.findOneAndUpdate(
                            { discordId: interaction.user.id },
                            { address: addr },
                            { upsert: true }
                        );
                        await interaction.followUp({
                            content: `✅ Wallet linked: \`${addr}\``,
                            ephemeral: true
                        });
                    });
                }

            } catch (error) {
                console.error("Error in interaction handling:", error);
                const reply = interaction.deferred || interaction.replied
                    ? interaction.followUp.bind(interaction)
                    : interaction.reply.bind(interaction);
                reply({ content: "⚠️ An error occurred.", ephemeral: true });
            }

            // ── Handle manual deposit confirmation ──
            if (interaction.isButton() && interaction.customId === 'confirm_payment') {
                const escrowAddr = escrowContract.address;
                await interaction.reply({
                    content: '📝 Paste your transaction hash (0x...):',
                    ephemeral: true
                });
                const filterTx = m => m.author.id === interaction.user.id;
                const txCollector = interaction.channel.createMessageCollector({
                    filter: filterTx,
                    time: 60000,
                    max: 1
                });
                txCollector.on('collect', async msg => {
                    const txHash = msg.content.trim();
                    if (!ethers.utils.isHexString(txHash, 32)) {
                        return interaction.followUp({
                            content: '❌ Invalid transaction hash!',
                            ephemeral: true
                        });
                    }
                    try {
                        const receipt = await escrowContract.provider.getTransactionReceipt(txHash);
                        if (!receipt?.status) throw new Error('Tx failed or not mined');

                        // Parse EscrowCreated event
                        const iface = new ethers.utils.Interface([
                            'event EscrowCreated(uint256 escrowId,address client,address freelancer,uint256 amount,address tokenAddress)'
                        ]);
                        const log = receipt.logs.find(l =>
                            l.address.toLowerCase() === escrowAddr.toLowerCase() &&
                            l.topics[0] === iface.getEventTopic('EscrowCreated')
                        );
                        if (!log) throw new Error('EscrowCreated event not found');
                        const parsed = iface.parseLog(log);
                        const escrowId = parsed.args.escrowId.toString();

                        await interaction.followUp({
                            content: `✅ Payment confirmed! Your Escrow ID is **${escrowId}**.`,
                            ephemeral: true
                        });
                    } catch (err) {
                        console.error('Error verifying payment:', err);
                        await interaction.followUp({
                            content: '❌ Could not verify payment on-chain.',
                            ephemeral: true
                        });
                    }
                });
            }

            // ── Handle manual deposit cancellation ──
            if (interaction.isButton() && interaction.customId === 'cancel_escrow') {
                await interaction.reply({
                    content: '❌ Escrow creation cancelled.',
                    ephemeral: true
                });
            }
        });
    },

    async fetchCryptoPrices(cryptoIds) {
        try {
            const response = await axios.get(
                `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoIds.join(',')}&vs_currencies=usd`
            );
            return {
                bitcoin:  response.data.bitcoin.usd,
                ethereum: response.data.ethereum.usd,
                matic:    response.data['matic-network'].usd,
                usdc:     response.data['usd-coin'].usd
            };
        } catch (error) {
            console.error('Error fetching crypto prices:', error);
            return { bitcoin:'N/A', ethereum:'N/A', matic:'N/A', usdc:'N/A' };
        }
    }
};












