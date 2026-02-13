/**
 * Script to register Discord slash commands
 * Run with: npm run register
 */

import { REST, Routes } from 'discord.js';
import { commands } from '../lib/commands.js';
import 'dotenv/config';

async function registerCommands() {
    if (!process.env.DISCORD_TOKEN) {
        console.error('❌ DISCORD_TOKEN is required');
        process.exit(1);
    }
    
    if (!process.env.CLIENT_ID) {
        console.error('❌ CLIENT_ID is required');
        process.exit(1);
    }
    
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        const commandsJSON = commands.map(cmd => cmd.toJSON());
        
        console.log('🔄 Started refreshing application commands...');
        console.log(`📋 Registering ${commandsJSON.length} commands...`);
        
        if (process.env.GUILD_ID) {
            // Guild-specific registration (faster for development)
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commandsJSON }
            );
            console.log(`✅ Guild commands registered for guild ${process.env.GUILD_ID}!`);
        } else {
            // Global registration (takes up to 1 hour to propagate)
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commandsJSON }
            );
            console.log('✅ Global commands registered successfully!');
            console.log('⏳ Note: Global commands can take up to 1 hour to propagate.');
        }
        
        console.log('\n📝 Registered commands:');
        commandsJSON.forEach(cmd => {
            console.log(`   /${cmd.name} - ${cmd.description}`);
        });
        
    } catch (error) {
        console.error('❌ Error registering commands:', error);
        process.exit(1);
    }
}

registerCommands();
