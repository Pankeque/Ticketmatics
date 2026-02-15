/**
 * Interaction Handler for Discord.js Bot
 * Handles slash commands, buttons, select menus, and modals
 */

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
    getServerStats
} from '../lib/ticketManager.js';

/**
 * Main interaction handler
 */
export async function handleInteraction(interaction) {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
        return await handleSlashCommand(interaction);
    }
    
    // Handle button interactions
    if (interaction.isButton()) {
        return await handleButton(interaction);
    }
    
    // Handle select menu interactions
    if (interaction.isStringSelectMenu()) {
        return await handleSelectMenu(interaction);
    }
    
    // Handle modal submissions
    if (interaction.isModalSubmit()) {
        return await handleModalSubmit(interaction);
    }
}

/**
 * Handle slash commands
 */
async function handleSlashCommand(interaction) {
    const { commandName, guild, member } = interaction;
    const userId = interaction.user.id;
    const memberRoles = member.roles.cache.map(r => r.id);
    
    switch (commandName) {
        case 'setup':
            return await handleSetup(interaction);
        
        case 'addstaff':
            return await handleAddStaff(interaction);
        
        case 'removestaff':
            return await handleRemoveStaff(interaction);
        
        case 'addstaffrole':
            return await handleAddStaffRole(interaction);
        
        case 'removestaffrole':
            return await handleRemoveStaffRole(interaction);
        
        case 'liststaff':
            return await handleListStaff(interaction);
        
        case 'dashboard':
            return await handleDashboard(interaction);
        
        case 'stats':
            return await handleStats(interaction);
        
        case 'config':
            return await handleConfig(interaction);
        
        case 'closeticket':
            return await handleCloseTicket(interaction);
        
        case 'adduser':
            return await handleAddUser(interaction);
        
        case 'removeuser':
            return await handleRemoveUser(interaction);
        
        case 'reopen':
            return await handleReopen(interaction);
        
        case 'transcript':
            return await handleTranscript(interaction);
        
        case 'help':
            return await handleHelp(interaction);
        
        default:
            return await interaction.reply({
                content: '❌ Unknown command',
                ephemeral: true
            });
    }
}

/**
 * Handle button interactions
 */
async function handleButton(interaction) {
    const { customId, guild, member } = interaction;
    const userId = interaction.user.id;
    const memberRoles = member.roles.cache.map(r => r.id);
    const guildId = guild.id;
    
    // Handle create ticket button
    if (customId === 'create_ticket') {
        const modal = new ModalBuilder()
            .setCustomId('create_ticket_modal')
            .setTitle('Create New Ticket')
            .addComponents(
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
                    )
            );
        
        return await interaction.showModal(modal);
    }
    
    // Handle my tickets button
    if (customId === 'my_tickets') {
        const guildData = await getGuildData(guildId);
        const userTickets = Object.values(guildData.tickets)
            .filter(t => t.userId === userId)
            .slice(0, 5);
        
        if (userTickets.length === 0) {
            return await interaction.reply({
                content: '📋 You have no tickets.',
                ephemeral: true
            });
        }
        
        const ticketsList = userTickets.map(t => 
            `**Ticket #${t.id}** - ${t.status === 'open' ? '🟢 Open' : '🔴 Closed'}\nCreated: <t:${Math.floor(t.createdAt / 1000)}:R>`
        ).join('\n\n');
        
        const embed = new EmbedBuilder()
            .setTitle('📋 Your Tickets')
            .setDescription(ticketsList)
            .setColor(0xFFFF00);
        
        return await interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    }
    
    // Handle close ticket button
    if (customId.startsWith('close_ticket_')) {
        const ticketId = customId.replace('close_ticket_', '');
        const guildData = await getGuildData(guildId);
        const isStaffMember = await isStaff(guildId, userId, memberRoles);
        const ticket = guildData.tickets[ticketId];
        
        if (!ticket) {
            return await interaction.reply({
                content: '❌ Ticket not found!',
                ephemeral: true
            });
        }
        
        if (!isStaffMember && ticket.userId !== userId) {
            return await interaction.reply({
                content: '❌ You do not have permission to close this ticket.',
                ephemeral: true
            });
        }
        
        const result = await closeTicket(guild, ticketId, userId, 'Closed via button');
        
        if (result.success) {
            const channel = guild.channels.cache.get(ticket.channelId);
            if (channel) {
                await channel.send(`🔒 Ticket #${ticketId} has been closed by <@${userId}>.`);
                setTimeout(() => channel.delete().catch(() => {}), 5000);
            }
            
            return await interaction.reply({
                content: `✅ Ticket #${ticketId} has been closed. The channel will be deleted shortly.`,
                ephemeral: true
            });
        } else {
            return await interaction.reply({
                content: `❌ ${result.error}`,
                ephemeral: true
            });
        }
    }
    
    // Handle claim ticket button
    if (customId.startsWith('claim_ticket_')) {
        const ticketId = customId.replace('claim_ticket_', '');
        const isStaffMember = await isStaff(guildId, userId, memberRoles);
        
        if (!isStaffMember) {
            return await interaction.reply({
                content: '❌ Only staff members can claim tickets.',
                ephemeral: true
            });
        }
        
        const result = await claimTicket(guild, ticketId, userId);
        
        if (result.success) {
            const guildData = await getGuildData(guildId);
            const ticket = guildData.tickets[ticketId];
            const channel = guild.channels.cache.get(ticket.channelId);
            
            if (channel) {
                await channel.send(`✋ Ticket #${ticketId} has been claimed by <@${userId}>.`);
            }
            
            // Update button to show claimed
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`close_ticket_${ticketId}`)
                        .setLabel('Close Ticket')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒'),
                    new ButtonBuilder()
                        .setCustomId(`claimed_${ticketId}`)
                        .setLabel(`Claimed by ${interaction.user.username}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('✅')
                        .setDisabled(true)
                );
            
            return await interaction.update({ components: [row] });
        } else {
            return await interaction.reply({
                content: `❌ ${result.error}`,
                ephemeral: true
            });
        }
    }
    
    return await interaction.reply({
        content: '❌ Unknown button interaction',
        ephemeral: true
    });
}

/**
 * Handle select menu interactions
 */
async function handleSelectMenu(interaction) {
    const { customId, values, guild, member } = interaction;
    const category = values[0];
    
    if (customId === 'ticket_category') {
        const categoryNames = {
            general: 'General Support',
            technical: 'Technical Support',
            billing: 'Billing',
            report: 'User Report',
            other: 'Other'
        };
        
        const modal = new ModalBuilder()
            .setCustomId(`create_ticket_modal_${category}`)
            .setTitle(`Create ${categoryNames[category]} Ticket`)
            .addComponents(
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
                    )
            );
        
        return await interaction.showModal(modal);
    }
    
    return await interaction.reply({
        content: '❌ Unknown select menu interaction',
        ephemeral: true
    });
}

/**
 * Handle modal submissions
 */
async function handleModalSubmit(interaction) {
    const { customId, guild, member } = interaction;
    const userId = interaction.user.id;
    
    if (customId.startsWith('create_ticket_modal')) {
        const reason = interaction.fields.getTextInputValue('ticket_reason');
        const category = customId.includes('_') && customId.split('_').length > 3 
            ? customId.split('_').pop() 
            : 'general';
        
        try {
            const result = await createTicket(guild, userId, reason);
            
            // Send ticket panel to the new channel
            const embed = createTicketCreatedEmbed(result.ticketId, reason);
            const controls = createTicketControls(result.ticketId);
            
            await result.channel.send({
                content: `<@${userId}>`,
                embeds: [embed],
                components: [controls]
            });
            
            return await interaction.reply({
                content: `✅ Your ticket has been created: <#${result.channel.id}>`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Error creating ticket:', error);
            return await interaction.reply({
                content: '❌ Failed to create ticket. Please try again.',
                ephemeral: true
            });
        }
    }
    
    return await interaction.reply({
        content: '❌ Unknown modal submission',
        ephemeral: true
    });
}

// ============================================
// Command Handlers
// ============================================

async function handleSetup(interaction) {
    const embed = createTicketPanelEmbed();
    const components = createTicketPanelComponents();
    
    await interaction.channel.send({
        embeds: [embed],
        components: components
    });
    
    return await interaction.reply({
        content: '✅ Ticket panel created!',
        ephemeral: true
    });
}

async function handleAddStaff(interaction) {
    const targetUser = interaction.options.getUser('member');
    const guildId = interaction.guild.id;
    const guildData = await getGuildData(guildId);
    
    if (guildData.staffMembers.includes(targetUser.id)) {
        return await interaction.reply({
            content: '❌ This user is already a staff member.',
            ephemeral: true
        });
    }
    
    guildData.staffMembers.push(targetUser.id);
    await saveGuildData(guildId, guildData);
    
    return await interaction.reply({
        content: `✅ <@${targetUser.id}> has been added to the staff team.`,
        ephemeral: true
    });
}

async function handleRemoveStaff(interaction) {
    const targetUser = interaction.options.getUser('member');
    const guildId = interaction.guild.id;
    const guildData = await getGuildData(guildId);
    const index = guildData.staffMembers.indexOf(targetUser.id);
    
    if (index === -1) {
        return await interaction.reply({
            content: '❌ This user is not a staff member.',
            ephemeral: true
        });
    }
    
    guildData.staffMembers.splice(index, 1);
    await saveGuildData(guildId, guildData);
    
    return await interaction.reply({
        content: `✅ <@${targetUser.id}> has been removed from the staff team.`,
        ephemeral: true
    });
}

async function handleAddStaffRole(interaction) {
    const targetRole = interaction.options.getRole('role');
    const guildId = interaction.guild.id;
    const guildData = await getGuildData(guildId);
    
    if (guildData.staffRoles.includes(targetRole.id)) {
        return await interaction.reply({
            content: '❌ This role is already a staff role.',
            ephemeral: true
        });
    }
    
    guildData.staffRoles.push(targetRole.id);
    await saveGuildData(guildId, guildData);
    
    return await interaction.reply({
        content: `✅ <@&${targetRole.id}> has been added as a staff role.`,
        ephemeral: true
    });
}

async function handleRemoveStaffRole(interaction) {
    const targetRole = interaction.options.getRole('role');
    const guildId = interaction.guild.id;
    const guildData = await getGuildData(guildId);
    const index = guildData.staffRoles.indexOf(targetRole.id);
    
    if (index === -1) {
        return await interaction.reply({
            content: '❌ This role is not a staff role.',
            ephemeral: true
        });
    }
    
    guildData.staffRoles.splice(index, 1);
    await saveGuildData(guildId, guildData);
    
    return await interaction.reply({
        content: `✅ <@&${targetRole.id}> has been removed from staff roles.`,
        ephemeral: true
    });
}

async function handleListStaff(interaction) {
    const guildId = interaction.guild.id;
    const guildData = await getGuildData(guildId);
    
    const staffMembersList = guildData.staffMembers.length > 0 
        ? guildData.staffMembers.map(id => `<@${id}>`).join('\n')
        : 'No staff members';
    
    const staffRolesList = guildData.staffRoles.length > 0
        ? guildData.staffRoles.map(id => `<@&${id}>`).join('\n')
        : 'No staff roles';
    
    const embed = new EmbedBuilder()
        .setTitle('👥 Staff List')
        .addFields(
            { name: 'Staff Members', value: staffMembersList, inline: true },
            { name: 'Staff Roles', value: staffRolesList, inline: true }
        )
        .setColor(0xFFFF00)
        .setTimestamp();
    
    return await interaction.reply({
        embeds: [embed],
        ephemeral: true
    });
}

async function handleDashboard(interaction) {
    const guildId = interaction.guild.id;
    const stats = await getServerStats(guildId);
    
    const embed = new EmbedBuilder()
        .setTitle('📊 Ticket Dashboard')
        .setDescription('Real-time ticket statistics')
        .addFields(
            { name: 'Total Tickets', value: `${stats.totalTickets}`, inline: true },
            { name: 'Open Tickets', value: `${stats.openTickets}`, inline: true },
            { name: 'Closed Tickets', value: `${stats.closedTickets}`, inline: true },
            { name: 'Claimed Tickets', value: `${stats.claimedTickets}`, inline: true },
            { name: 'Staff Members', value: `${stats.staffCount}`, inline: true },
            { name: 'Staff Roles', value: `${stats.staffRoleCount}`, inline: true }
        )
        .setColor(0xFFFF00)
        .setTimestamp();
    
    return await interaction.reply({
        embeds: [embed],
        ephemeral: true
    });
}

async function handleStats(interaction) {
    return await handleDashboard(interaction);
}

async function handleConfig(interaction) {
    const setting = interaction.options.getString('setting');
    const valueNumber = interaction.options.getInteger('value_number');
    const valueString = interaction.options.getString('value_string');
    const valueBoolean = interaction.options.getBoolean('value_boolean');
    
    const guildId = interaction.guild.id;
    const guildData = await getGuildData(guildId);
    
    let value;
    let settingName;
    
    switch (setting) {
        case 'max_tickets':
            value = valueNumber ?? 3;
            guildData.settings.maxTicketsPerUser = value;
            settingName = 'Max Tickets Per User';
            break;
        case 'category_name':
            value = valueString ?? '🎫・Tickets';
            guildData.settings.ticketCategoryName = value;
            settingName = 'Ticket Category Name';
            break;
        case 'logs_channel':
            value = valueString ?? 'ticket-logs';
            guildData.settings.logsChannelName = value;
            settingName = 'Logs Channel Name';
            break;
        case 'ticket_prefix':
            value = valueString ?? 'ticket-';
            guildData.settings.ticketPrefix = value;
            settingName = 'Ticket Prefix';
            break;
        case 'staff_role_name':
            value = valueString ?? 'Support Staff';
            guildData.settings.staffRoleName = value;
            settingName = 'Staff Role Name';
            break;
        case 'auto_create_staff_role':
            value = valueBoolean ?? false;
            guildData.settings.autoCreateStaffRole = value;
            settingName = 'Auto-Create Staff Role';
            break;
        default:
            return await interaction.reply({
                content: '❌ Unknown setting.',
                ephemeral: true
            });
    }
    
    await saveGuildData(guildId, guildData);
    
    return await interaction.reply({
        content: `✅ **${settingName}** has been set to: \`${value}\``,
        ephemeral: true
    });
}

async function handleCloseTicket(interaction) {
    const channel = interaction.options.getChannel('channel');
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const memberRoles = interaction.member.roles.cache.map(r => r.id);
    
    const guildData = await getGuildData(guildId);
    
    // Find ticket by channel
    const ticket = Object.values(guildData.tickets).find(t => t.channelId === channel.id);
    
    if (!ticket) {
        return await interaction.reply({
            content: '❌ This channel is not a ticket.',
            ephemeral: true
        });
    }
    
    const isStaffMember = await isStaff(guildId, userId, memberRoles);
    
    if (!isStaffMember && ticket.userId !== userId) {
        return await interaction.reply({
            content: '❌ You do not have permission to close this ticket.',
            ephemeral: true
        });
    }
    
    const result = await closeTicket(interaction.guild, ticket.id, userId, reason);
    
    if (result.success) {
        await channel.send(`🔒 Ticket #${ticket.id} has been closed by <@${userId}>.\n**Reason:** ${reason}`);
        setTimeout(() => channel.delete().catch(() => {}), 5000);
        
        return await interaction.reply({
            content: `✅ Ticket #${ticket.id} has been closed.`,
            ephemeral: true
        });
    } else {
        return await interaction.reply({
            content: `❌ ${result.error}`,
            ephemeral: true
        });
    }
}

async function handleAddUser(interaction) {
    const targetUser = interaction.options.getUser('member');
    const guildId = interaction.guild.id;
    const channel = interaction.channel;
    const guildData = await getGuildData(guildId);
    
    // Find ticket by current channel
    const ticket = Object.values(guildData.tickets).find(t => t.channelId === channel.id);
    
    if (!ticket) {
        return await interaction.reply({
            content: '❌ This channel is not a ticket.',
            ephemeral: true
        });
    }
    
    const result = await addUserToTicket(interaction.guild, ticket.id, targetUser.id);
    
    if (result.success) {
        return await interaction.reply({
            content: `✅ <@${targetUser.id}> has been added to this ticket.`,
            ephemeral: true
        });
    } else {
        return await interaction.reply({
            content: `❌ ${result.error}`,
            ephemeral: true
        });
    }
}

async function handleRemoveUser(interaction) {
    const targetUser = interaction.options.getUser('member');
    const guildId = interaction.guild.id;
    const channel = interaction.channel;
    const guildData = await getGuildData(guildId);
    
    // Find ticket by current channel
    const ticket = Object.values(guildData.tickets).find(t => t.channelId === channel.id);
    
    if (!ticket) {
        return await interaction.reply({
            content: '❌ This channel is not a ticket.',
            ephemeral: true
        });
    }
    
    const result = await removeUserFromTicket(interaction.guild, ticket.id, targetUser.id);
    
    if (result.success) {
        return await interaction.reply({
            content: `✅ <@${targetUser.id}> has been removed from this ticket.`,
            ephemeral: true
        });
    } else {
        return await interaction.reply({
            content: `❌ ${result.error}`,
            ephemeral: true
        });
    }
}

async function handleReopen(interaction) {
    const ticketId = interaction.options.getString('ticketid');
    const guildId = interaction.guild.id;
    const guildData = await getGuildData(guildId);
    
    const ticket = guildData.tickets[ticketId];
    
    if (!ticket) {
        return await interaction.reply({
            content: '❌ Ticket not found.',
            ephemeral: true
        });
    }
    
    if (ticket.status === 'open') {
        return await interaction.reply({
            content: '❌ This ticket is already open.',
            ephemeral: true
        });
    }
    
    ticket.status = 'open';
    ticket.closedAt = null;
    ticket.closedBy = null;
    ticket.closeReason = null;
    
    await saveGuildData(guildId, guildData);
    
    return await interaction.reply({
        content: `✅ Ticket #${ticketId} has been reopened.`,
        ephemeral: true
    });
}

async function handleTranscript(interaction) {
    const ticketId = interaction.options.getString('ticketid');
    const guildId = interaction.guild.id;
    const guildData = await getGuildData(guildId);
    
    const ticket = guildData.tickets[ticketId];
    
    if (!ticket) {
        return await interaction.reply({
            content: '❌ Ticket not found.',
            ephemeral: true
        });
    }
    
    // Create a simple transcript embed
    const embed = new EmbedBuilder()
        .setTitle(`📜 Ticket #${ticketId} Transcript`)
        .addFields(
            { name: 'Created By', value: `<@${ticket.userId}>`, inline: true },
            { name: 'Status', value: ticket.status === 'open' ? '🟢 Open' : '🔴 Closed', inline: true },
            { name: 'Created At', value: `<t:${Math.floor(ticket.createdAt / 1000)}:F>`, inline: true },
            { name: 'Reason', value: ticket.reason ?? 'No reason provided' }
        )
        .setColor(0xFFFF00)
        .setTimestamp();
    
    if (ticket.claimedBy) {
        embed.addFields({ name: 'Claimed By', value: `<@${ticket.claimedBy}>`, inline: true });
    }
    
    if (ticket.closedBy) {
        embed.addFields(
            { name: 'Closed By', value: `<@${ticket.closedBy}>`, inline: true },
            { name: 'Close Reason', value: ticket.closeReason ?? 'No reason provided' }
        );
    }
    
    return await interaction.reply({
        embeds: [embed],
        ephemeral: true
    });
}

async function handleHelp(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('🎫 Ticketmatics Help')
        .setDescription('A professional Discord ticket management system')
        .addFields(
            { name: '📝 Setup', value: 'Use `/setup` to create a ticket panel in the current channel.', inline: false },
            { name: '👥 Staff Management', value: '`/addstaff` - Add a staff member\n`/removestaff` - Remove a staff member\n`/addstaffrole` - Add a staff role\n`/removestaffrole` - Remove a staff role\n`/liststaff` - List all staff', inline: false },
            { name: '🎫 Ticket Management', value: '`/closeticket` - Close a ticket\n`/adduser` - Add user to ticket\n`/removeuser` - Remove user from ticket\n`/reopen` - Reopen a closed ticket\n`/transcript` - Get ticket transcript', inline: false },
            { name: '⚙️ Configuration', value: '`/config` - Configure ticket settings\n`/stats` - View server statistics\n`/dashboard` - View ticket dashboard', inline: false },
            { name: '💡 Tips', value: '• Users can create tickets by clicking the button on the panel\n• Staff can claim tickets to take ownership\n• All tickets are logged and tracked', inline: false }
        )
        .setColor(0xFFFF00)
        .setFooter({ text: 'Ticketmatics • Professional Ticket Management' })
        .setTimestamp();
    
    return await interaction.reply({
        embeds: [embed],
        ephemeral: true
    });
}