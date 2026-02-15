/**
 * Ticketmatics - Discord Ticket Bot
 * Main entry point for standard Discord.js bot
 */

import 'dotenv/config';
import { Client, GatewayIntentBits, Events, Collection, ActivityType } from 'discord.js';
import { registerCommands } from './lib/ticketManager.js';
import { handleInteraction } from './handlers/interactions.js';

// Create client with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ]
});

// Store commands
client.commands = new Collection();

// Ready event
client.once(Events.ClientReady, async (c) => {
    console.log(`✅ Logged in as ${c.user.tag}`);
    
    // Set bot status
    client.user.setActivity('🎫 Managing Tickets', { type: ActivityType.Watching });
    
    // Register slash commands
    try {
        await registerCommands(client);
        console.log('✅ Slash commands registered');
    } catch (error) {
        console.error('❌ Failed to register commands:', error);
    }
});

// Interaction create event
client.on(Events.InteractionCreate, async (interaction) => {
    try {
        await handleInteraction(interaction);
    } catch (error) {
        console.error('❌ Error handling interaction:', error);
        
        const errorMessage = 'There was an error processing your request.';
        
        if (interaction.isChatInputCommand()) {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    }
});

// Guild join event
client.on(Events.GuildCreate, async (guild) => {
    console.log(`📥 Joined guild: ${guild.name} (${guild.id})`);
});

// Guild leave event
client.on(Events.GuildDelete, async (guild) => {
    console.log(`📤 Left guild: ${guild.name} (${guild.id})`);
});

// Error handling
client.on(Events.Error, (error) => {
    console.error('❌ Client error:', error);
});

// Warn handling
client.on(Events.Warn, (warn) => {
    console.warn('⚠️ Client warning:', warn);
});

// Login
client.login(process.env.DISCORD_TOKEN).catch((error) => {
    console.error('❌ Failed to login:', error);
    process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('🛑 Shutting down...');
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 Shutting down...');
    client.destroy();
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
});