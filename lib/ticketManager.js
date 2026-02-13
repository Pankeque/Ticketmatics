/**
 * Ticket Manager - Core ticket system logic
 * Handles all ticket operations for the HTTP Interactions handler
 */

import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionFlagsBits,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    REST,
    Routes
} from 'discord.js';
import { getGuildData, saveGuildData, getTicketData, saveTicketData, deleteTicketData, storage } from './storage.js';

// Configuration constants
const TICKET_COLOR = 0xFFFF00;

/**
 * Check if user is staff
 */
export async function isStaff(guildId, userId, memberRoles = []) {
    const guildData = await getGuildData(guildId);
    
    // Check if user is in staff members list
    if (guildData.staffMembers.includes(userId)) {
        return true;
    }
    
    // Check if user has any staff role
    if (memberRoles && memberRoles.length > 0) {
        return guildData.staffRoles.some(roleId => memberRoles.includes(roleId));
    }
    
    return false;
}

/**
 * Generate unique ticket ID per server
 */
export async function generateTicketId(guildId) {
    const guildData = await getGuildData(guildId);
    const id = guildData.nextTicketNumber.toString().padStart(4, '0');
    guildData.nextTicketNumber++;
    await saveGuildData(guildId, guildData);
    return id;
}

/**
 * Create a new ticket
 */
export async function createTicket(guild, userId, reason = 'No reason provided') {
    const guildId = guild.id;
    const guildData = await getGuildData(guildId);
    const ticketId = await generateTicketId(guildId);
    
    // Find or create ticket category
    let category = guild.channels.cache.find(
        c => c.name === guildData.settings.ticketCategoryName && c.type === ChannelType.GuildCategory
    );
    
    if (!category) {
        category = await guild.channels.create({
            name: guildData.settings.ticketCategoryName,
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                }
            ]
        });
    }
    
    // Create ticket channel
    const channel = await guild.channels.create({
        name: `${guildData.settings.ticketPrefix}${ticketId}`,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
            {
                id: guild.roles.everyone.id,
                deny: [PermissionFlagsBits.ViewChannel]
            },
            {
                id: userId,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles
                ]
            }
        ]
    });
    
    // Add staff roles to channel
    for (const roleId of guildData.staffRoles) {
        await channel.permissionOverwrites.edit(roleId, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
        });
    }
    
    // Add staff members to channel
    for (const staffId of guildData.staffMembers) {
        await channel.permissionOverwrites.edit(staffId, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
        });
    }
    
    // Create ticket data
    const ticketData = {
        id: ticketId,
        channelId: channel.id,
        categoryId: category.id,
        userId: userId,
        reason: reason,
        status: 'open',
        createdAt: Date.now(),
        claimedBy: null,
        claimedAt: null,
        closedAt: null,
        closedBy: null,
        closeReason: null,
        messages: []
    };
    
    // Save ticket data
    guildData.tickets[ticketId] = ticketData;
    await saveGuildData(guildId, guildData);
    await saveTicketData(guildId, ticketId, ticketData);
    
    return { ticketId, channel, ticketData };
}

/**
 * Close a ticket
 */
export async function closeTicket(guild, ticketId, closedBy, reason = 'No reason provided') {
    const guildId = guild.id;
    const guildData = await getGuildData(guildId);
    
    if (!guildData.tickets[ticketId]) {
        return { success: false, error: 'Ticket not found' };
    }
    
    const ticket = guildData.tickets[ticketId];
    
    if (ticket.status === 'closed') {
        return { success: false, error: 'Ticket is already closed' };
    }
    
    // Update ticket status
    ticket.status = 'closed';
    ticket.closedAt = Date.now();
    ticket.closedBy = closedBy;
    ticket.closeReason = reason;
    
    await saveGuildData(guildId, guildData);
    await saveTicketData(guildId, ticketId, ticket);
    
    return { success: true, ticket };
}

/**
 * Claim a ticket
 */
export async function claimTicket(guild, ticketId, claimedBy) {
    const guildId = guild.id;
    const guildData = await getGuildData(guildId);
    
    if (!guildData.tickets[ticketId]) {
        return { success: false, error: 'Ticket not found' };
    }
    
    const ticket = guildData.tickets[ticketId];
    
    if (ticket.status !== 'open') {
        return { success: false, error: 'Ticket is not open' };
    }
    
    if (ticket.claimedBy) {
        return { success: false, error: 'Ticket is already claimed' };
    }
    
    ticket.claimedBy = claimedBy;
    ticket.claimedAt = Date.now();
    
    await saveGuildData(guildId, guildData);
    await saveTicketData(guildId, ticketId, ticket);
    
    return { success: true, ticket };
}

/**
 * Add user to ticket
 */
export async function addUserToTicket(guild, ticketId, userId) {
    const guildId = guild.id;
    const guildData = await getGuildData(guildId);
    
    if (!guildData.tickets[ticketId]) {
        return { success: false, error: 'Ticket not found' };
    }
    
    const ticket = guildData.tickets[ticketId];
    const channel = guild.channels.cache.get(ticket.channelId);
    
    if (!channel) {
        return { success: false, error: 'Ticket channel not found' };
    }
    
    await channel.permissionOverwrites.edit(userId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
    });
    
    return { success: true };
}

/**
 * Remove user from ticket
 */
export async function removeUserFromTicket(guild, ticketId, userId) {
    const guildId = guild.id;
    const guildData = await getGuildData(guildId);
    
    if (!guildData.tickets[ticketId]) {
        return { success: false, error: 'Ticket not found' };
    }
    
    const ticket = guildData.tickets[ticketId];
    const channel = guild.channels.cache.get(ticket.channelId);
    
    if (!channel) {
        return { success: false, error: 'Ticket channel not found' };
    }
    
    // Don't remove the ticket creator
    if (ticket.userId === userId) {
        return { success: false, error: 'Cannot remove the ticket creator' };
    }
    
    await channel.permissionOverwrites.edit(userId, {
        ViewChannel: false,
        SendMessages: false
    });
    
    return { success: true };
}

/**
 * Get ticket panel embed
 */
export function createTicketPanelEmbed() {
    return new EmbedBuilder()
        .setTitle('🎫 Ticketmatics - Support System')
        .setDescription('Need help? Create a ticket and our support team will assist you!')
        .addFields(
            { name: '📝 How to Create a Ticket', value: 'Click the button below or select a category to create a support ticket.', inline: false },
            { name: '⏰ Response Time', value: 'Our team typically responds within 24 hours.', inline: true },
            { name: '📋 Rules', value: 'Please be respectful and provide clear details about your issue.', inline: true }
        )
        .setColor(TICKET_COLOR)
        .setFooter({ text: 'Ticketmatics • Professional Ticket Management' })
        .setTimestamp();
}

/**
 * Get ticket panel components
 */
export function createTicketPanelComponents() {
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel('Create Ticket')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎫'),
            new ButtonBuilder()
                .setCustomId('my_tickets')
                .setLabel('My Tickets')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📋')
        );
    
    const row2 = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ticket_category')
                .setPlaceholder('Select a ticket category...')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('General Support')
                        .setValue('general')
                        .setDescription('General questions and assistance')
                        .setEmoji('❓'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Technical Support')
                        .setValue('technical')
                        .setDescription('Technical issues and bugs')
                        .setEmoji('🔧'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Billing')
                        .setValue('billing')
                        .setDescription('Payment and billing inquiries')
                        .setEmoji('💳'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Report User')
                        .setValue('report')
                        .setDescription('Report a user for rule violations')
                        .setEmoji('🚨'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Other')
                        .setValue('other')
                        .setDescription('Other inquiries')
                        .setEmoji('📨')
                )
        );
    
    return [row1, row2];
}

/**
 * Create ticket created embed
 */
export function createTicketCreatedEmbed(ticketId, reason) {
    return new EmbedBuilder()
        .setTitle(`🎫 Ticket #${ticketId} Created`)
        .setDescription('Your ticket has been created successfully!')
        .addFields(
            { name: '📋 Reason', value: reason, inline: false },
            { name: '⏰ Status', value: '🟢 Open - Waiting for support', inline: true }
        )
        .setColor(TICKET_COLOR)
        .setFooter({ text: 'Ticketmatics' })
        .setTimestamp();
}

/**
 * Create ticket control buttons
 */
export function createTicketControls(ticketId) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`close_ticket_${ticketId}`)
                .setLabel('Close Ticket')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒'),
            new ButtonBuilder()
                .setCustomId(`claim_ticket_${ticketId}`)
                .setLabel('Claim Ticket')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✋')
        );
}

/**
 * Register slash commands with Discord
 */
export async function registerCommands(client) {
    const { commands } = await import('./commands.js');
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    try {
        console.log('🔄 Started refreshing application commands...');
        
        // Register commands globally (or per-guild for faster updates during development)
        const commandsJSON = commands.map(cmd => cmd.toJSON());
        
        if (process.env.GUILD_ID) {
            // Guild-specific registration (faster for development)
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commandsJSON }
            );
            console.log('✅ Guild commands registered successfully!');
        } else {
            // Global registration (takes up to 1 hour to propagate)
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commandsJSON }
            );
            console.log('✅ Global commands registered successfully!');
        }
    } catch (error) {
        console.error('❌ Error registering commands:', error);
        throw error;
    }
}

/**
 * Get server statistics
 */
export async function getServerStats(guildId) {
    const guildData = await getGuildData(guildId);
    
    const totalTickets = Object.keys(guildData.tickets).length;
    const openTickets = Object.values(guildData.tickets).filter(t => t.status === 'open').length;
    const closedTickets = Object.values(guildData.tickets).filter(t => t.status === 'closed').length;
    const claimedTickets = Object.values(guildData.tickets).filter(t => t.claimedBy).length;
    
    return {
        totalTickets,
        openTickets,
        closedTickets,
        claimedTickets,
        staffCount: guildData.staffMembers.length,
        staffRoleCount: guildData.staffRoles.length
    };
}
