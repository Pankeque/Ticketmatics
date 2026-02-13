/**
 * Discord HTTP Interactions Handler for Vercel Serverless
 * 
 * This handler receives Discord interactions via HTTP webhooks instead of
 * maintaining a persistent WebSocket connection, making it fully compatible
 * with Vercel's serverless architecture.
 */

import { verifyKey } from 'discord-interactions';
import {
    InteractionType,
    InteractionResponseType,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} from 'discord.js';
import { getGuildData, saveGuildData } from '../lib/storage.js';
import {
    isStaff,
    createTicket,
    closeTicket,
    claimTicket,
    addUserToTicket,
    removeUserFromTicket,
    createTicketPanelEmbed,
    createTicketPanelComponents,
    createTicketCreatedEmbed,
    createTicketControls,
    getServerStats,
    registerCommands
} from '../lib/ticketManager.js';

/**
 * Verify Discord request signature
 */
function verifyDiscordRequest(req) {
    const signature = req.headers['x-signature-ed25519'];
    const timestamp = req.headers['x-signature-timestamp'];
    const rawBody = JSON.stringify(req.body);
    
    if (!signature || !timestamp) {
        return false;
    }
    
    return verifyKey(rawBody, signature, timestamp, process.env.DISCORD_PUBLIC_KEY);
}

/**
 * Main handler for Discord Interactions
 */
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Signature-Ed25519, X-Signature-Timestamp');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Only accept POST requests for interactions
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // Verify request is from Discord
    if (!verifyDiscordRequest(req)) {
        return res.status(401).json({ error: 'Invalid request signature' });
    }
    
    const interaction = req.body;
    
    try {
        // Handle PING from Discord
        if (interaction.type === InteractionType.Ping) {
            return res.status(200).json({ type: InteractionResponseType.Pong });
        }
        
        // Handle application commands (slash commands)
        if (interaction.type === InteractionType.ApplicationCommand) {
            return await handleSlashCommand(interaction, res);
        }
        
        // Handle message components (buttons, select menus)
        if (interaction.type === InteractionType.MessageComponent) {
            return await handleComponent(interaction, res);
        }
        
        // Handle modal submissions
        if (interaction.type === InteractionType.ModalSubmit) {
            return await handleModalSubmit(interaction, res);
        }
        
        // Unknown interaction type
        return res.status(400).json({ error: 'Unknown interaction type' });
        
    } catch (error) {
        console.error('❌ Interaction handler error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Handle slash commands
 */
async function handleSlashCommand(interaction, res) {
    const { data, guild_id, member, user } = interaction;
    const commandName = data.name;
    const userId = user?.id || member?.user?.id;
    const memberRoles = member?.roles || [];
    
    switch (commandName) {
        case 'setup':
            return await handleSetup(interaction, res);
        
        case 'addstaff':
            return await handleAddStaff(interaction, res);
        
        case 'removestaff':
            return await handleRemoveStaff(interaction, res);
        
        case 'addstaffrole':
            return await handleAddStaffRole(interaction, res);
        
        case 'removestaffrole':
            return await handleRemoveStaffRole(interaction, res);
        
        case 'liststaff':
            return await handleListStaff(interaction, res);
        
        case 'dashboard':
            return await handleDashboard(interaction, res);
        
        case 'stats':
            return await handleStats(interaction, res);
        
        case 'config':
            return await handleConfig(interaction, res);
        
        case 'help':
            return await handleHelp(interaction, res);
        
        default:
            return res.status(200).json({
                type: InteractionResponseType.ChannelMessageWithSource,
                data: {
                    content: '❌ Unknown command',
                    flags: 64 // Ephemeral
                }
            });
    }
}

/**
 * Handle message components (buttons, select menus)
 */
async function handleComponent(interaction, res) {
    const { data, guild_id, member, message } = interaction;
    const customId = data.custom_id;
    const userId = member?.user?.id;
    const memberRoles = member?.roles || [];
    
    // Handle create ticket button
    if (customId === 'create_ticket') {
        // Show modal for ticket reason
        return res.status(200).json({
            type: InteractionResponseType.Modal,
            data: {
                custom_id: 'create_ticket_modal',
                title: 'Create New Ticket',
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new TextInputBuilder()
                                .setCustomId('ticket_reason')
                                .setLabel('Reason for creating ticket')
                                .setStyle(TextInputStyle.Paragraph)
                                .setRequired(true)
                                .setMinLength(10)
                                .setMaxLength(1000)
                                .setPlaceholder('Please describe your issue in detail...')
                        ).toJSON()
                ]
            }
        });
    }
    
    // Handle ticket category selection
    if (customId === 'ticket_category') {
        const category = data.values[0];
        const categoryNames = {
            general: 'General Support',
            technical: 'Technical Support',
            billing: 'Billing',
            report: 'User Report',
            other: 'Other'
        };
        
        // Show modal with pre-filled category
        return res.status(200).json({
            type: InteractionResponseType.Modal,
            data: {
                custom_id: `create_ticket_modal_${category}`,
                title: `Create ${categoryNames[category]} Ticket`,
                components: [
                    new ActionRowBuilder()
                        .addComponents(
                            new TextInputBuilder()
                                .setCustomId('ticket_reason')
                                .setLabel('Reason for creating ticket')
                                .setStyle(TextInputStyle.Paragraph)
                                .setRequired(true)
                                .setMinLength(10)
                                .setMaxLength(1000)
                                .setPlaceholder(`Please describe your ${categoryNames[category].toLowerCase()} issue...`)
                        ).toJSON()
                ]
            }
        });
    }
    
    // Handle my tickets button
    if (customId === 'my_tickets') {
        const guildData = await getGuildData(guild_id);
        const userTickets = Object.values(guildData.tickets)
            .filter(t => t.userId === userId)
            .slice(0, 5);
        
        if (userTickets.length === 0) {
            return res.status(200).json({
                type: InteractionResponseType.ChannelMessageWithSource,
                data: {
                    content: '📋 You have no tickets.',
                    flags: 64
                }
            });
        }
        
        const ticketsList = userTickets.map(t => 
            `**Ticket #${t.id}** - ${t.status === 'open' ? '🟢 Open' : '🔴 Closed'}\nCreated: <t:${Math.floor(t.createdAt / 1000)}:R>`
        ).join('\n\n');
        
        return res.status(200).json({
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('📋 Your Tickets')
                        .setDescription(ticketsList)
                        .setColor(0xFFFF00)
                        .toJSON()
                ],
                flags: 64
            }
        });
    }
    
    // Handle close ticket button
    if (customId.startsWith('close_ticket_')) {
        const ticketId = customId.replace('close_ticket_', '');
        const guildData = await getGuildData(guild_id);
        
        // Check if user is staff or ticket creator
        const isStaffMember = await isStaff(guild_id, userId, memberRoles);
        const ticket = guildData.tickets[ticketId];
        
        if (!ticket) {
            return res.status(200).json({
                type: InteractionResponseType.ChannelMessageWithSource,
                data: {
                    content: '❌ Ticket not found!',
                    flags: 64
                }
            });
        }
        
        if (!isStaffMember && ticket.userId !== userId) {
            return res.status(200).json({
                type: InteractionResponseType.ChannelMessageWithSource,
                data: {
                    content: '❌ You do not have permission to close this ticket.',
                    flags: 64
                }
            });
        }
        
        // Note: In HTTP interactions, we can't directly access the guild object
        // We need to use Discord API REST calls to close the ticket
        // For now, just update the status and inform the user
        
        ticket.status = 'closed';
        ticket.closedAt = Date.now();
        ticket.closedBy = userId;
        await saveGuildData(guild_id, guildData);
        
        return res.status(200).json({
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                content: `✅ Ticket #${ticketId} has been closed. The channel will be deleted shortly.`,
                flags: 64
            }
        });
    }
    
    // Handle claim ticket button
    if (customId.startsWith('claim_ticket_')) {
        const ticketId = customId.replace('claim_ticket_', '');
        const isStaffMember = await isStaff(guild_id, userId, memberRoles);
        
        if (!isStaffMember) {
            return res.status(200).json({
                type: InteractionResponseType.ChannelMessageWithSource,
                data: {
                    content: '❌ Only staff members can claim tickets.',
                    flags: 64
                }
            });
        }
        
        const guildData = await getGuildData(guild_id);
        const ticket = guildData.tickets[ticketId];
        
        if (!ticket) {
            return res.status(200).json({
                type: InteractionResponseType.ChannelMessageWithSource,
                data: {
                    content: '❌ Ticket not found!',
                    flags: 64
                }
            });
        }
        
        if (ticket.claimedBy) {
            return res.status(200).json({
                type: InteractionResponseType.ChannelMessageWithSource,
                data: {
                    content: `❌ This ticket is already claimed by <@${ticket.claimedBy}>.`,
                    flags: 64
                }
            });
        }
        
        ticket.claimedBy = userId;
        ticket.claimedAt = Date.now();
        await saveGuildData(guild_id, guildData);
        
        return res.status(200).json({
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                content: `✅ You have claimed Ticket #${ticketId}.`,
                flags: 64
            }
        });
    }
    
    // Unknown component
    return res.status(200).json({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
            content: '❌ Unknown component interaction',
            flags: 64
        }
    });
}

/**
 * Handle modal submissions
 */
async function handleModalSubmit(interaction, res) {
    const { data, guild_id, member, channel } = interaction;
    const customId = data.custom_id;
    const userId = member?.user?.id;
    
    // Handle create ticket modal
    if (customId.startsWith('create_ticket_modal')) {
        const reasonInput = data.components[0].components.find(c => c.custom_id === 'ticket_reason');
        const reason = reasonInput?.value || 'No reason provided';
        const category = customId.includes('_') ? customId.split('_').pop() : 'general';
        
        // Note: In HTTP interactions, we can't directly create channels
        // We need to use Discord API REST calls
        // For now, return a message indicating the ticket creation
        
        // In a full implementation, you would:
        // 1. Use Discord REST API to create the channel
        // 2. Set up permissions
        // 3. Send the initial message
        
        return res.status(200).json({
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                content: `✅ Your ticket has been submitted!\n**Category:** ${category}\n**Reason:** ${reason}\n\nA support team member will respond shortly.`,
                flags: 64
            }
        });
    }
    
    return res.status(200).json({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
            content: '❌ Unknown modal submission',
            flags: 64
        }
    });
}

// ============================================
// Command Handlers
// ============================================

async function handleSetup(interaction, res) {
    return res.status(200).json({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
            embeds: [createTicketPanelEmbed().toJSON()],
            components: createTicketPanelComponents().map(row => row.toJSON()),
            flags: 0
        }
    });
}

async function handleAddStaff(interaction, res) {
    const { data, guild_id } = interaction;
    const targetUser = data.options.find(o => o.name === 'member')?.value;
    
    const guildData = await getGuildData(guild_id);
    
    if (guildData.staffMembers.includes(targetUser)) {
        return res.status(200).json({
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                content: '❌ This user is already a staff member.',
                flags: 64
            }
        });
    }
    
    guildData.staffMembers.push(targetUser);
    await saveGuildData(guild_id, guildData);
    
    return res.status(200).json({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
            content: `✅ <@${targetUser}> has been added to the staff team.`,
            flags: 64
        }
    });
}

async function handleRemoveStaff(interaction, res) {
    const { data, guild_id } = interaction;
    const targetUser = data.options.find(o => o.name === 'member')?.value;
    
    const guildData = await getGuildData(guild_id);
    const index = guildData.staffMembers.indexOf(targetUser);
    
    if (index === -1) {
        return res.status(200).json({
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                content: '❌ This user is not a staff member.',
                flags: 64
            }
        });
    }
    
    guildData.staffMembers.splice(index, 1);
    await saveGuildData(guild_id, guildData);
    
    return res.status(200).json({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
            content: `✅ <@${targetUser}> has been removed from the staff team.`,
            flags: 64
        }
    });
}

async function handleAddStaffRole(interaction, res) {
    const { data, guild_id } = interaction;
    const targetRole = data.options.find(o => o.name === 'role')?.value;
    
    const guildData = await getGuildData(guild_id);
    
    if (guildData.staffRoles.includes(targetRole)) {
        return res.status(200).json({
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                content: '❌ This role is already a staff role.',
                flags: 64
            }
        });
    }
    
    guildData.staffRoles.push(targetRole);
    await saveGuildData(guild_id, guildData);
    
    return res.status(200).json({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
            content: `✅ <@&${targetRole}> has been added as a staff role.`,
            flags: 64
        }
    });
}

async function handleRemoveStaffRole(interaction, res) {
    const { data, guild_id } = interaction;
    const targetRole = data.options.find(o => o.name === 'role')?.value;
    
    const guildData = await getGuildData(guild_id);
    const index = guildData.staffRoles.indexOf(targetRole);
    
    if (index === -1) {
        return res.status(200).json({
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                content: '❌ This role is not a staff role.',
                flags: 64
            }
        });
    }
    
    guildData.staffRoles.splice(index, 1);
    await saveGuildData(guild_id, guildData);
    
    return res.status(200).json({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
            content: `✅ <@&${targetRole}> has been removed from staff roles.`,
            flags: 64
        }
    });
}

async function handleListStaff(interaction, res) {
    const { guild_id } = interaction;
    const guildData = await getGuildData(guild_id);
    
    const staffMembers = guildData.staffMembers.length > 0 
        ? guildData.staffMembers.map(id => `<@${id}>`).join('\n')
        : 'No staff members';
    
    const staffRoles = guildData.staffRoles.length > 0
        ? guildData.staffRoles.map(id => `<@&${id}>`).join('\n')
        : 'No staff roles';
    
    return res.status(200).json({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
            embeds: [
                new EmbedBuilder()
                    .setTitle('👥 Staff List')
                    .addFields(
                        { name: '👤 Staff Members', value: staffMembers, inline: true },
                        { name: '🏷️ Staff Roles', value: staffRoles, inline: true }
                    )
                    .setColor(0xFFFF00)
                    .toJSON()
            ],
            flags: 64
        }
    });
}

async function handleDashboard(interaction, res) {
    const { guild_id } = interaction;
    const stats = await getServerStats(guild_id);
    
    return res.status(200).json({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
            embeds: [
                new EmbedBuilder()
                    .setTitle('📊 Ticket Dashboard')
                    .setDescription('Real-time ticket statistics')
                    .addFields(
                        { name: '🎫 Total Tickets', value: `${stats.totalTickets}`, inline: true },
                        { name: '🟢 Open Tickets', value: `${stats.openTickets}`, inline: true },
                        { name: '🔴 Closed Tickets', value: `${stats.closedTickets}`, inline: true },
                        { name: '✋ Claimed Tickets', value: `${stats.claimedTickets}`, inline: true },
                        { name: '👥 Staff Members', value: `${stats.staffCount}`, inline: true },
                        { name: '🏷️ Staff Roles', value: `${stats.staffRoleCount}`, inline: true }
                    )
                    .setColor(0xFFFF00)
                    .setTimestamp()
                    .toJSON()
            ],
            components: createTicketPanelComponents().map(row => row.toJSON()),
            flags: 0
        }
    });
}

async function handleStats(interaction, res) {
    const { guild_id } = interaction;
    const stats = await getServerStats(guild_id);
    
    return res.status(200).json({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
            embeds: [
                new EmbedBuilder()
                    .setTitle('📈 Server Statistics')
                    .addFields(
                        { name: '🎫 Total Tickets', value: `${stats.totalTickets}`, inline: true },
                        { name: '🟢 Open', value: `${stats.openTickets}`, inline: true },
                        { name: '🔴 Closed', value: `${stats.closedTickets}`, inline: true },
                        { name: '✋ Claimed', value: `${stats.claimedTickets}`, inline: true },
                        { name: '👥 Staff', value: `${stats.staffCount}`, inline: true },
                        { name: '🏷️ Roles', value: `${stats.staffRoleCount}`, inline: true }
                    )
                    .setColor(0xFFFF00)
                    .setTimestamp()
                    .toJSON()
            ],
            flags: 64
        }
    });
}

async function handleConfig(interaction, res) {
    const { data, guild_id } = interaction;
    const setting = data.options.find(o => o.name === 'setting')?.value;
    const valueNumber = data.options.find(o => o.name === 'value_number')?.value;
    const valueString = data.options.find(o => o.name === 'value_string')?.value;
    const valueBoolean = data.options.find(o => o.name === 'value_boolean')?.value;
    
    const guildData = await getGuildData(guild_id);
    
    const settingMap = {
        max_tickets: { key: 'maxTicketsPerUser', value: valueNumber, type: 'number' },
        category_name: { key: 'ticketCategoryName', value: valueString, type: 'string' },
        logs_channel: { key: 'logsChannelName', value: valueString, type: 'string' },
        ticket_prefix: { key: 'ticketPrefix', value: valueString, type: 'string' },
        staff_role_name: { key: 'staffRoleName', value: valueString, type: 'string' },
        auto_create_staff_role: { key: 'autoCreateStaffRole', value: valueBoolean, type: 'boolean' }
    };
    
    const config = settingMap[setting];
    if (!config) {
        return res.status(200).json({
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                content: '❌ Invalid setting.',
                flags: 64
            }
        });
    }
    
    if (config.value === undefined || config.value === null) {
        return res.status(200).json({
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                content: `❌ Please provide a value for this setting.`,
                flags: 64
            }
        });
    }
    
    guildData.settings[config.key] = config.value;
    await saveGuildData(guild_id, guildData);
    
    return res.status(200).json({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
            content: `✅ Setting **${setting}** has been updated to: ${config.value}`,
            flags: 64
        }
    });
}

async function handleHelp(interaction, res) {
    return res.status(200).json({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
            embeds: [
                new EmbedBuilder()
                    .setTitle('🎫 Ticketmatics Help')
                    .setDescription('A professional Discord ticket management system')
                    .addFields(
                        { name: '📝 Commands', value: 
                            '`/setup` - Create the ticket panel\n' +
                            '`/dashboard` - View ticket statistics\n' +
                            '`/stats` - View server statistics\n' +
                            '`/addstaff` - Add a staff member\n' +
                            '`/removestaff` - Remove a staff member\n' +
                            '`/addstaffrole` - Add a staff role\n' +
                            '`/removestaffrole` - Remove a staff role\n' +
                            '`/liststaff` - List all staff\n' +
                            '`/config` - Configure settings',
                            inline: false
                        },
                        { name: '🎫 Creating Tickets', value: 'Click the "Create Ticket" button or select a category from the dropdown.', inline: false },
                        { name: '🔒 Closing Tickets', value: 'Use the "Close Ticket" button inside the ticket channel.', inline: false }
                    )
                    .setColor(0xFFFF00)
                    .setFooter({ text: 'Ticketmatics • Professional Ticket Management' })
                    .toJSON()
            ],
            flags: 64
        }
    });
}
