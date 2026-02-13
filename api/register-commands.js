/**
 * Command Registration Endpoint for Vercel
 * Call this endpoint to register/update slash commands with Discord
 */

import { REST, Routes } from 'discord.js';
import { commands } from '../lib/commands.js';

export default async function handler(req, res) {
    // Only allow POST requests for security
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            error: 'Method not allowed',
            message: 'Use POST to register commands'
        });
    }
    
    // Verify authorization (optional but recommended)
    const authHeader = req.headers.authorization;
    if (process.env.REGISTER_SECRET && authHeader !== `Bearer ${process.env.REGISTER_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        const commandsJSON = commands.map(cmd => cmd.toJSON());
        
        console.log('🔄 Started refreshing application commands...');
        
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
        }
        
        return res.status(200).json({
            success: true,
            message: 'Commands registered successfully',
            count: commandsJSON.length,
            scope: process.env.GUILD_ID ? 'guild' : 'global'
        });
        
    } catch (error) {
        console.error('❌ Error registering commands:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
