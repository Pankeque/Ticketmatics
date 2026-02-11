const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionsBitField,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    REST,
    Routes,
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits
} = require('discord.js');
require('dotenv').config();
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User],
});

// Ticketmatics Configuration
const TICKET_COLOR = 0xFFFF00;
const TICKET_CATEGORY_NAME = '🎫・Tickets';
const LOGS_CHANNEL_NAME = 'ticket-logs';
const DASHBOARD_CHANNEL_NAME = 'ticket-dashboard';
const MAX_TICKETS_PER_USER = 3;
const TICKET_PREFIX = 'ticket-';
const DATA_FILE = './ticket_data.json';

// Multi-Server Data Structure
let serverData = {};

// Load data from file
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const rawData = fs.readFileSync(DATA_FILE);            serverData = JSON.parse(rawData);
            console.log('✅ Data loaded successfully!');
        } else {
            serverData = {};
            saveData();
        }
    } catch (error) {
        console.error('❌ Error loading data:', error);
        serverData = {};
        saveData();
    }
}

// Save data to file
function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(serverData, null, 2));
    } catch (error) {
        console.error('❌ Error saving data:', error);
    }
}

// Initialize server data
function initializeServer(guildId) {
    if (!serverData[guildId]) {
        serverData[guildId] = {
            tickets: {},
            staffMembers: [],
            nextTicketNumber: 1,
            settings: {
                maxTicketsPerUser: MAX_TICKETS_PER_USER,
                ticketCategoryName: TICKET_CATEGORY_NAME,
                logsChannelName: LOGS_CHANNEL_NAME,
                dashboardChannelName: DASHBOARD_CHANNEL_NAME,
                ticketPrefix: TICKET_PREFIX
            }
        };
        saveData();
    }
    return serverData[guildId];
}

// Get server data
function getServerData(guildId) {
    if (!serverData[guildId]) {
        initializeServer(guildId);
    }
    return serverData[guildId];
}
// Generate unique ticket ID per server
function generateTicketId(guildId) {
    const server = getServerData(guildId);
    const id = server.nextTicketNumber.toString().padStart(4, '0');
    server.nextTicketNumber++;
    saveData();
    return id;
}

// Check if user is staff
function isStaff(guildId, userId) {
    const server = getServerData(guildId);
    return server.staffMembers.includes(userId);
}

// Register Slash Commands
const commands = [    
    new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Configure the main Ticketmatics panel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('addstaff')
        .setDescription('Add a member to the support team')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option => 
            option.setName('member')
                .setDescription('Member to add as staff')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('removestaff')
        .setDescription('Remove a member from the support team')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option => 
            option.setName('member')
                .setDescription('Member to remove from staff')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('dashboard')
        .setDescription('Create/update the ticket dashboard')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('closeticket')
        .setDescription('Close a ticket manually (staff only)')        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Ticket channel to close')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for closing')
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName('adduser')
        .setDescription('Add a user to a ticket (staff only)')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('Member to add')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('removeuser')
        .setDescription('Remove a user from a ticket (staff only)')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('Member to remove')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('reopen')
        .setDescription('Reopen a closed ticket (staff only)')
        .addStringOption(option =>
            option.setName('ticketid')
                .setDescription('Ticket ID to reopen')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Show server ticket statistics')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('config')
        .setDescription('Configure ticket system settings')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('setting')
                .setDescription('Setting to configure')                .setRequired(true)
                .addChoices(
                    { name: 'Max Tickets Per User', value: 'max_tickets' },
                    { name: 'Ticket Category Name', value: 'category_name' },
                    { name: 'Logs Channel Name', value: 'logs_channel' },
                    { name: 'Ticket Prefix', value: 'ticket_prefix' }
                )
        )
        .addIntegerOption(option =>
            option.setName('value_number')
                .setDescription('Numeric value for the setting')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('value_string')
                .setDescription('String value for the setting')
                .setRequired(false)
        ),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('🔄 Starting application (/) commands refresh...');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID || ''),
            { body: commands },
        );
        console.log('✅ Successfully reloaded application (/) commands!');
    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }
})();

// Function to get or create ticket category
async function getOrCreateTicketCategory(guild) {
    const server = getServerData(guild.id);
    const categoryName = server.settings.ticketCategoryName || TICKET_CATEGORY_NAME;

    let category = guild.channels.cache.find(
        c => c.name.toLowerCase() === categoryName.toLowerCase() && c.type === ChannelType.GuildCategory
    );

    if (!category) {
        category = await guild.channels.create({            
            name: categoryName,
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
                {                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: client.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels],
                },
            ],
        });
        console.log(`✅ Ticket category created: ${category.name}`);
    }

    return category;
}

// Function to get or create logs channel
async function getOrCreateLogsChannel(guild) {
    const server = getServerData(guild.id);
    const logsChannelName = server.settings.logsChannelName || LOGS_CHANNEL_NAME;

    let logsChannel = guild.channels.cache.find(
        c => c.name.toLowerCase() === logsChannelName.toLowerCase() && c.type === ChannelType.GuildText
    );

    if (!logsChannel) {
        const category = await getOrCreateTicketCategory(guild);
        logsChannel = await guild.channels.create({
            name: logsChannelName,
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: client.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                },
            ],
        });
        console.log(`✅ Logs channel created: ${logsChannel.name}`);
    }

    return logsChannel;
}

// Function to log ticket actions
async function logTicketAction(guild, action, ticketData) {
    const logsChannel = await getOrCreateLogsChannel(guild);    const embed = new EmbedBuilder()
        .setTitle(`📋 Ticket Action - ${action}`)
        .setColor(TICKET_COLOR)
        .addFields(
            { name: '🎫 Ticket ID', value: ticketData.id.toString(), inline: true },
            { name: '👤 User', value: `<@${ticketData.userId}> (${ticketData.userId})`, inline: true },
            { name: '🏢 Department', value: ticketData.dept.replace('_', ' '), inline: true },
            { name: '📅 Date', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true },
        )
        .setTimestamp();

    if (ticketData.reason) {
        embed.addFields({ name: '📝 Reason', value: ticketData.reason });
    }

    if (ticketData.channelId) {
        embed.addFields({ name: '💬 Channel', value: `<#${ticketData.channelId}>` });
    }

    await logsChannel.send({ embeds: [embed] }).catch(console.error);
}

client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} is online and ready!`);
    console.log(`📊 Servers: ${client.guilds.cache.size}`);
    client.user.setActivity('Tickets via /setup 🎫', { type: 3 });

    loadData();

    client.guilds.cache.forEach(guild => {
        initializeServer(guild.id);
    });

    console.log('✅ Ticketmatics started successfully!');
});

client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.guild) {
            initializeServer(interaction.guild.id);
        }

        if (interaction.isChatInputCommand()) {
            const { commandName } = interaction;
            const guildId = interaction.guild.id;
            const server = getServerData(guildId);

            if (commandName === 'setup') {
                const embed = new EmbedBuilder()
                    .setTitle('🎫 Ticketmatics Support Center')                    .setDescription(
                        'Welcome to the Ticketmatics support system!\n\n' +
                        '✨ **Main Features:**\n' +
                        '• Quick ticket creation\n' +
                        '• Organized departments\n' +
                        '• ID tracking system\n' +
                        '• Complete action logs\n' +
                        '• Full control over your tickets\n\n' +
                        'Click the button below to open a ticket and receive specialized help.'
                    )
                    .setColor(TICKET_COLOR)
                    .setThumbnail(client.user.displayAvatarURL())
                    .setFooter({ text: 'Ticketmatics - Professional 24/7 Support', iconURL: client.user.displayAvatarURL() })
                    .setTimestamp();

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('open_ticket_select')
                        .setLabel('Open Ticket')
                        .setEmoji('📩')
                        .setStyle(ButtonStyle.Primary)
                );

                await interaction.reply({ 
                    embeds: [embed], 
                    components: [row],
                    ephemeral: false
                });

                await interaction.followUp({
                    content: '✅ Ticket panel configured successfully!',
                    ephemeral: true
                });
            }

            if (commandName === 'addstaff') {
                const member = interaction.options.getMember('member');

                if (server.staffMembers.includes(member.id)) {
                    return interaction.reply({ 
                        content: '⚠️ This member is already part of the support team!',
                        ephemeral: true 
                    });
                }

                server.staffMembers.push(member.id);
                saveData();

                await interaction.reply({ 
                    content: `✅ ${member} has been added to the support team!`,                    ephemeral: true 
                });                
                console.log(`➕ Staff added: ${member.user.tag} (${member.id})`);
            }

            if (commandName === 'removestaff') {
                const member = interaction.options.getMember('member');

                const index = server.staffMembers.indexOf(member.id);
                if (index === -1) {
                    return interaction.reply({ 
                        content: '⚠️ This member is not part of the support team!',
                        ephemeral: true 
                    });
                }

                server.staffMembers.splice(index, 1);
                saveData();

                await interaction.reply({ 
                    content: `✅ ${member} has been removed from the support team!`,
                    ephemeral: true 
                });

                console.log(`➖ Staff removed: ${member.user.tag} (${member.id})`);
            }

            if (commandName === 'dashboard') {
                const tickets = Object.values(server.tickets);
                const activeTickets = tickets.filter(t => t.status === 'open');

                const embed = new EmbedBuilder()
                    .setTitle('📊 Ticket Dashboard - Ticketmatics')
                    .setDescription(`**Real-time Statistics**\n\n` +
                        `🎫 **Active Tickets:** ${activeTickets.length}\n` +
                        `👥 **Staff Members:** ${server.staffMembers.length}\n` +
                        `🆔 **Next ID:** ${server.nextTicketNumber.toString().padStart(4, '0')}\n` +
                        `📅 **Tickets Created Today:** ${activeTickets.filter(t => 
                            new Date(t.createdAt).toDateString() === new Date().toDateString()
                        ).length}`)
                    .setColor(TICKET_COLOR)
                    .addFields(
                        { name: '📥 Open Tickets', value: activeTickets.length.toString(), inline: true },
                        { name: '🔒 Closed Tickets', value: tickets.filter(t => t.status === 'closed').length.toString(), inline: true },
                        { name: '🔄 Reopened Tickets', value: tickets.filter(t => t.status === 'reopened').length.toString(), inline: true },
                    )
                    .setFooter({ text: 'Updated in real-time', iconURL: client.user.displayAvatarURL() })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], ephemeral: true });                
                const dashboardChannel = interaction.guild.channels.cache.find(
                    c => c.name.toLowerCase() === DASHBOARD_CHANNEL_NAME.toLowerCase()
                );

                if (dashboardChannel) {
                    const messages = await dashboardChannel.messages.fetch({ limit: 1 });
                    if (messages.size > 0) {
                        await messages.first().edit({ embeds: [embed] });
                    } else {
                        await dashboardChannel.send({ embeds: [embed] });
                    }
                }
            }

            if (commandName === 'closeticket') {
                if (!isStaff(guildId, interaction.user.id)) {
                    return interaction.reply({ 
                        content: '⚠️ Only staff members can use this command!',
                        ephemeral: true 
                    });
                }

                const channel = interaction.options.getChannel('channel');
                const reason = interaction.options.getString('reason') || 'Closed by staff';

                const ticket = server.tickets[channel.id];
                if (!ticket) {
                    return interaction.reply({ 
                        content: '⚠️ This channel is not a valid ticket!',
                        ephemeral: true 
                    });
                }

                if (ticket.status === 'closed') {
                    return interaction.reply({ 
                        content: '⚠️ This ticket is already closed!',
                        ephemeral: true 
                    });
                }

                const messages = await channel.messages.fetch({ limit: 100 });
                const transcript = messages.reverse().map(m => 
                    `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}`
                ).join('\n');

                console.log(`📝 Transcript of Ticket #${ticket.id}:\n${transcript}`);

                ticket.status = 'closed';
                ticket.closedAt = new Date().toISOString();                ticket.reason = reason;
                server.tickets[channel.id] = ticket;
                saveData();

                await logTicketAction(interaction.guild, 'Closed by Staff', {
                    ...ticket,
                    reason: `Staff: ${interaction.user.tag} - ${reason}`
                });

                const closeEmbed = new EmbedBuilder()
                    .setTitle('🔒 Ticket Closed')
                    .setDescription(
                        `This ticket has been closed by ${interaction.user}.\n\n` +
                        `**Reason:** ${reason}\n\n` +
                        `Thank you for using our support!`
                    )
                    .setColor(0xFF0000)
                    .setTimestamp();

                await channel.send({ embeds: [closeEmbed] });

                setTimeout(() => {
                    if (channel.deletable) {
                        channel.delete().catch(console.error);
                    }
                }, 3000);

                await interaction.reply({ 
                    content: `✅ Ticket #${ticket.id} closed successfully!`,
                    ephemeral: true 
                });
            }

            if (commandName === 'adduser') {
                if (!interaction.channel.name.startsWith(server.settings.ticketPrefix || TICKET_PREFIX)) {
                    return interaction.reply({ 
                        content: '⚠️ This command can only be used inside a ticket!',
                        ephemeral: true 
                    });
                }

                if (!isStaff(guildId, interaction.user.id)) {
                    return interaction.reply({ 
                        content: '⚠️ Only staff members can use this command!',
                        ephemeral: true 
                    });
                }

                const member = interaction.options.getMember('member');
                const channel = interaction.channel;                
                try {
                    await channel.permissionOverwrites.edit(member, {
                        ViewChannel: true,
                        SendMessages: true,
                        AttachFiles: true,
                    });

                    await interaction.reply({ 
                        content: `✅ ${member} has been added to this ticket!`,
                        ephemeral: true 
                    });

                    await channel.send({
                        content: `${member}, you have been added to this ticket by ${interaction.user}.`
                    });
                } catch (error) {
                    console.error('Error adding user:', error);
                    await interaction.reply({ 
                        content: '❌ An error occurred while adding the user!',
                        ephemeral: true 
                    });
                }
            }

            if (commandName === 'removeuser') {
                if (!interaction.channel.name.startsWith(server.settings.ticketPrefix || TICKET_PREFIX)) {
                    return interaction.reply({ 
                        content: '⚠️ This command can only be used inside a ticket!',
                        ephemeral: true 
                    });
                }

                if (!isStaff(guildId, interaction.user.id)) {
                    return interaction.reply({ 
                        content: '⚠️ Only staff members can use this command!',
                        ephemeral: true 
                    });
                }

                const member = interaction.options.getMember('member');
                const channel = interaction.channel;

                try {
                    await channel.permissionOverwrites.delete(member);

                    await interaction.reply({ 
                        content: `✅ ${member} has been removed from this ticket!`,
                        ephemeral: true 
                    });                    
                    await channel.send({
                        content: `${member} has been removed from this ticket by ${interaction.user}.`
                    });
                } catch (error) {
                    console.error('Error removing user:', error);
                    await interaction.reply({ 
                        content: '❌ An error occurred while removing the user!',
                        ephemeral: true 
                    });
                }
            }

            if (commandName === 'reopen') {
                if (!isStaff(guildId, interaction.user.id)) {
                    return interaction.reply({ 
                        content: '⚠️ Only staff members can use this command!',
                        ephemeral: true 
                    });
                }

                const ticketId = interaction.options.getString('ticketid');
                const ticket = Object.values(server.tickets).find(t => t.id === ticketId && t.status === 'closed');

                if (!ticket) {
                    return interaction.reply({ 
                        content: '⚠️ Ticket not found or already open!',
                        ephemeral: true 
                    });
                }

                const category = await getOrCreateTicketCategory(interaction.guild);
                const channel = await interaction.guild.channels.create({
                    name: `${server.settings.ticketPrefix || TICKET_PREFIX}${ticket.dept}-${ticket.userId.slice(0, 4)}`,
                    type: ChannelType.GuildText,
                    parent: category.id,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.id,
                            deny: [PermissionFlagsBits.ViewChannel],
                        },
                        {
                            id: ticket.userId,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles],
                        },
                        {
                            id: client.user.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                        },
                    ],                });

                ticket.status = 'reopened';
                ticket.channelId = channel.id;
                ticket.reopenedAt = new Date().toISOString();
                server.tickets[channel.id] = ticket;
                saveData();

                const reopenEmbed = new EmbedBuilder()
                    .setTitle('🔄 Ticket Reopened')
                    .setDescription(
                        `This ticket has been reopened by ${interaction.user}.\n\n` +
                        `**Original ID:** #${ticketId}\n` +
                        `**Department:** ${ticket.dept.replace('_', ' ')}\n\n` +
                        `The support team will be notified shortly.`
                    )
                    .setColor(0x00FFFF)
                    .setTimestamp();

                const row = createTicketControlButtons();

                await channel.send({ 
                    content: `<@${ticket.userId}>`,
                    embeds: [reopenEmbed],
                    components: [row]
                });

                await logTicketAction(interaction.guild, 'Reopened', ticket);

                await interaction.reply({ 
                    content: `✅ Ticket #${ticketId} reopened successfully! Channel: ${channel}`,
                    ephemeral: true 
                });
            }

            if (commandName === 'stats') {
                const tickets = Object.values(server.tickets);
                const activeTickets = tickets.filter(t => t.status === 'open');
                const closedTickets = tickets.filter(t => t.status === 'closed');
                const reopenedTickets = tickets.filter(t => t.status === 'reopened');

                const deptStats = {};
                tickets.forEach(t => {
                    deptStats[t.dept] = (deptStats[t.dept] || 0) + 1;
                });

                const embed = new EmbedBuilder()
                    .setTitle('📊 Ticket Statistics - Ticketmatics')
                    .setColor(TICKET_COLOR)
                    .addFields(                        { name: '🎫 Total Tickets', value: tickets.length.toString(), inline: true },
                        { name: '📥 Active', value: activeTickets.length.toString(), inline: true },
                        { name: '🔒 Closed', value: closedTickets.length.toString(), inline: true },
                        { name: '🔄 Reopened', value: reopenedTickets.length.toString(), inline: true },
                        { name: '\u200b', value: '\u200b' },
                        { name: '🏢 Department Statistics', value: 
                            Object.entries(deptStats)
                                .map(([dept, count]) => `• ${dept.replace('_', ' ')}: ${count}`)
                                .join('\n') || 'No tickets yet'
                        },
                        { name: '\u200b', value: '\u200b' },
                        { name: '👥 Registered Staff', value: server.staffMembers.length.toString(), inline: true },
                        { name: '🆔 Next ID', value: server.nextTicketNumber.toString().padStart(4, '0'), inline: true },
                    )
                    .setFooter({ text: 'Ticketmatics Analytics', iconURL: client.user.displayAvatarURL() })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (commandName === 'config') {
                const setting = interaction.options.getString('setting');
                const valueNumber = interaction.options.getInteger('value_number');
                const valueString = interaction.options.getString('value_string');

                switch(setting) {
                    case 'max_tickets':
                        if (valueNumber < 1 || valueNumber > 10) {
                            return interaction.reply({ 
                                content: '⚠️ Max tickets must be between 1 and 10!',
                                ephemeral: true 
                            });
                        }
                        server.settings.maxTicketsPerUser = valueNumber;
                        break;
                    case 'category_name':
                        if (!valueString || valueString.length > 50) {
                            return interaction.reply({ 
                                content: '⚠️ Category name must be between 1 and 50 characters!',
                                ephemeral: true 
                            });
                        }
                        server.settings.ticketCategoryName = valueString;
                        break;
                    case 'logs_channel':
                        if (!valueString || valueString.length > 50) {
                            return interaction.reply({ 
                                content: '⚠️ Logs channel name must be between 1 and 50 characters!',
                                ephemeral: true 
                            });                        }
                        server.settings.logsChannelName = valueString;
                        break;
                    case 'ticket_prefix':
                        if (!valueString || valueString.length > 20) {
                            return interaction.reply({ 
                                content: '⚠️ Ticket prefix must be between 1 and 20 characters!',
                                ephemeral: true 
                            });
                        }
                        server.settings.ticketPrefix = valueString;
                        break;
                    default:
                        return interaction.reply({ 
                            content: '⚠️ Invalid setting!',
                            ephemeral: true 
                        });
                }

                saveData();

                await interaction.reply({ 
                    content: `✅ Setting "${setting}" updated successfully!`,
                    ephemeral: true 
                });
            }
        }

        if (interaction.isButton()) {
            const { customId } = interaction;
            const guildId = interaction.guild.id;
            const server = getServerData(guildId);

            if (customId === 'open_ticket_select') {
                const select = new StringSelectMenuBuilder()
                    .setCustomId('ticket_dept')
                    .setPlaceholder('Select a department...')
                    .addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel('💳 Billing')
                            .setDescription('Payment and invoice issues')
                            .setEmoji('💳')
                            .setValue('billing'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('🔧 Technical Support')
                            .setDescription('Technical issues and bugs')
                            .setEmoji('🔧')
                            .setValue('tech_support'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('⚖️ Reports')                            .setDescription('Report inappropriate behavior')
                            .setEmoji('⚖️')
                            .setValue('reports'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('📝 Feature Requests')
                            .setDescription('Request new features')
                            .setEmoji('📝')
                            .setValue('feature_requests'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('❓ Other')
                            .setDescription('Other matters not listed')
                            .setEmoji('❓')
                            .setValue('others'),
                    );

                const row = new ActionRowBuilder().addComponents(select);

                await interaction.reply({
                    content: '📋 **Select the desired department:**',
                    components: [row],
                    ephemeral: true
                });
            }

            if (customId === 'close_ticket') {
                const ticket = server.tickets[interaction.channel.id];
                if (!ticket) {
                    return interaction.reply({ 
                        content: '⚠️ Error: Ticket not found!',
                        ephemeral: true 
                    });
                }

                const confirmEmbed = new EmbedBuilder()
                    .setTitle('🔒 Confirm Closure')
                    .setDescription(
                        'Are you sure you want to close this ticket?\n\n' +
                        '⚠️ **Warning:** This action cannot be undone.\n' +
                        '📋 A transcript will be generated before closing.'
                    )
                    .setColor(0xFFA500)
                    .setFooter({ text: 'Ticketmatics - Action Confirmation' });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('confirm_close')
                        .setLabel('Confirm Closure')
                        .setEmoji('✅')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()                        .setCustomId('cancel_close')
                        .setLabel('Cancel')
                        .setEmoji('❌')
                        .setStyle(ButtonStyle.Danger)
                );

                await interaction.reply({ 
                    embeds: [confirmEmbed], 
                    components: [row],
                    ephemeral: true 
                });
            }

            if (customId === 'close_with_reason') {
                const ticket = server.tickets[interaction.channel.id];
                if (!ticket) {
                    return interaction.reply({ 
                        content: '⚠️ Error: Ticket not found!',
                        ephemeral: true 
                    });
                }

                const modal = new ModalBuilder()
                    .setCustomId('close_ticket_modal')
                    .setTitle('Close Ticket with Reason');

                const reasonInput = new TextInputBuilder()
                    .setCustomId('close_reason')
                    .setLabel('Reason for Closure')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Describe the reason for closure...')
                    .setRequired(true)
                    .setMaxLength(500);

                const firstActionRow = new ActionRowBuilder().addComponents(reasonInput);
                modal.addComponents(firstActionRow);

                await interaction.showModal(modal);
            }

            if (customId === 'confirm_close') {
                const ticket = server.tickets[interaction.channel.id];
                if (!ticket) {
                    return interaction.update({ 
                        content: '⚠️ Error: Ticket not found!',
                        components: [],
                        ephemeral: true 
                    });
                }
                                const messages = await interaction.channel.messages.fetch({ limit: 100 });
                const transcript = messages.reverse().map(m => 
                    `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}`
                ).join('\n');

                console.log(`📝 Transcript of Ticket #${ticket.id}:\n${transcript}`);

                ticket.status = 'closed';
                ticket.closedAt = new Date().toISOString();
                ticket.reason = 'Closed by user';
                server.tickets[interaction.channel.id] = ticket;
                saveData();

                await logTicketAction(interaction.guild, 'Closed by User', ticket);

                const closeEmbed = new EmbedBuilder()
                    .setTitle('🔒 Ticket Closed')
                    .setDescription(
                        `Ticket **#${ticket.id}** has been closed successfully.\n\n` +
                        `**Department:** ${ticket.dept.replace('_', ' ')}\n` +
                        `**Closed by:** ${interaction.user.tag}\n` +
                        `**Date:** <t:${Math.floor(Date.now() / 1000)}:f>\n\n` +
                        `Thank you for using our support!`
                    )
                    .setColor(0xFF0000)
                    .setTimestamp();

                await interaction.update({ 
                    embeds: [closeEmbed],
                    components: [],
                    ephemeral: false 
                });

                setTimeout(() => {
                    if (interaction.channel.deletable) {
                        interaction.channel.delete().catch(console.error);
                    }
                }, 5000);
            }

            if (customId === 'cancel_close') {
                await interaction.update({ 
                    content: '✅ Closure cancelled!',
                    components: [],
                    ephemeral: true 
                });
            }

            if (customId === 'reopen_ticket') {
                const ticket = server.tickets[interaction.channel.id];                if (!ticket) {
                    return interaction.reply({ 
                        content: '⚠️ Error: Ticket not found!',
                        ephemeral: true 
                    });
                }

                if (ticket.status !== 'closed') {
                    return interaction.reply({ 
                        content: '⚠️ This ticket is already open!',
                        ephemeral: true 
                    });
                }

                if (!isStaff(guildId, interaction.user.id) && ticket.userId !== interaction.user.id) {
                    return interaction.reply({ 
                        content: '⚠️ Only staff or the ticket owner can reopen this ticket!',
                        ephemeral: true 
                    });
                }

                ticket.status = 'reopened';
                ticket.reopenedAt = new Date().toISOString();
                server.tickets[interaction.channel.id] = ticket;
                saveData();

                const reopenEmbed = new EmbedBuilder()
                    .setTitle('🔄 Ticket Reopened')
                    .setDescription(
                        `The ticket has been reopened by ${interaction.user}.\n\n` +
                        `The support team will be notified.`
                    )
                    .setColor(0x00FFFF)
                    .setTimestamp();

                await interaction.channel.send({ 
                    content: `🔔 ${interaction.user} reopened this ticket!`,
                    embeds: [reopenEmbed] 
                });

                await interaction.reply({ 
                    content: '✅ Ticket reopened successfully!',
                    ephemeral: true 
                });

                await logTicketAction(interaction.guild, 'Reopened by User', ticket);
            }
        }

        if (interaction.isStringSelectMenu()) {            if (interaction.customId === 'ticket_dept') {
                const dept = interaction.values[0];
                const userId = interaction.user.id;
                const guildId = interaction.guild.id;
                const server = getServerData(guildId);

                const userTickets = Object.values(server.tickets).filter(
                    t => t.userId === userId && t.status === 'open'
                );

                const maxTickets = server.settings.maxTicketsPerUser || MAX_TICKETS_PER_USER;
                if (userTickets.length >= maxTickets) {
                    return interaction.update({ 
                        content: `⚠️ You have reached the maximum limit of ${maxTickets} open tickets!\n\n` +
                               `Please close some tickets before opening new ones.`,
                        components: [],
                        ephemeral: true 
                    });
                }

                const ticketId = generateTicketId(guildId);

                try {
                    const category = await getOrCreateTicketCategory(interaction.guild);

                    const sanitizedUsername = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const ticketPrefix = server.settings.ticketPrefix || TICKET_PREFIX;
                    const ticketName = `${ticketPrefix}${dept}-${sanitizedUsername}-${ticketId}`;

                    const channel = await interaction.guild.channels.create({
                        name: ticketName,
                        type: ChannelType.GuildText,
                        parent: category.id,
                        permissionOverwrites: [
                            {
                                id: interaction.guild.id,
                                deny: [PermissionFlagsBits.ViewChannel],
                            },
                            {
                                id: userId,
                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.AttachFiles,
                                    PermissionFlagsBits.ReadMessageHistory
                                ],
                            },
                            {
                                id: client.user.id,
                                allow: [                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.EmbedLinks,
                                    PermissionFlagsBits.AttachFiles
                                ],
                            },
                        ],
                    });

                    const ticketData = {
                        id: ticketId,
                        userId: userId,
                        dept: dept,
                        channelId: channel.id,
                        status: 'open',
                        createdAt: new Date().toISOString(),
                        reason: null,
                        closedAt: null
                    };

                    server.tickets[channel.id] = ticketData;
                    saveData();

                    const welcomeEmbed = new EmbedBuilder()
                        .setTitle(`🎫 Ticket #${ticketId} - ${dept.replace('_', ' ')}`)
                        .setDescription(
                            `Hello ${interaction.user}, your ticket has been created successfully!\n\n` +
                            `**Department:** ${dept.replace('_', ' ')}\n` +
                            `**Ticket ID:** #${ticketId}\n` +
                            `**Created:** <t:${Math.floor(Date.now() / 1000)}:f>\n\n` +
                            `📋 **Instructions:**\n` +
                            `• Describe your problem or request\n` +
                            `• A team member will contact you shortly\n` +
                            `• Use the buttons below to manage this ticket`
                        )
                        .setColor(TICKET_COLOR)
                        .setThumbnail(interaction.user.displayAvatarURL())
                        .setFooter({ text: 'Ticketmatics - Professional Support', iconURL: client.user.displayAvatarURL() })
                        .setTimestamp();

                    const controlRow = createTicketControlButtons();

                    await channel.send({ 
                        content: `${interaction.user}`,
                        embeds: [welcomeEmbed],
                        components: [controlRow]
                    });

                    await logTicketAction(interaction.guild, 'Created', ticketData);
                                        await interaction.update({ 
                        content: `✅ Your ticket has been created successfully!\n\n` +
                               `**ID:** #${ticketId}\n` +
                               `**Channel:** ${channel}\n\n` +
                               `📋 Please check the ticket channel for further instructions.`,
                        components: [],
                        ephemeral: true 
                    });

                } catch (error) {
                    console.error('Error creating ticket:', error);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.update({ 
                            content: '❌ An error occurred while creating your ticket. Please try again.',
                            components: [],
                            ephemeral: true 
                        });
                    }
                }
            }
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'close_ticket_modal') {
                const guildId = interaction.guild.id;
                const server = getServerData(guildId);
                const reason = interaction.fields.getTextInputValue('close_reason');
                const ticket = server.tickets[interaction.channel.id];

                if (!ticket) {
                    return interaction.reply({ 
                        content: '⚠️ Error: Ticket not found!',
                        ephemeral: true 
                    });
                }

                const messages = await interaction.channel.messages.fetch({ limit: 100 });
                const transcript = messages.reverse().map(m => 
                    `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}`
                ).join('\n');

                console.log(`📝 Transcript of Ticket #${ticket.id}:\n${transcript}`);

                ticket.status = 'closed';
                ticket.closedAt = new Date().toISOString();
                ticket.reason = reason;
                server.tickets[interaction.channel.id] = ticket;
                saveData();

                await logTicketAction(interaction.guild, 'Closed with Reason', {                    ...ticket,
                    reason: `${interaction.user.tag}: ${reason}`
                });

                const closeEmbed = new EmbedBuilder()
                    .setTitle('🔒 Ticket Closed')
                    .setDescription(
                        `Ticket **#${ticket.id}** has been closed successfully.\n\n` +
                        `**Department:** ${ticket.dept.replace('_', ' ')}\n` +
                        `**Closed by:** ${interaction.user.tag}\n` +
                        `**Reason:** ${reason}\n` +
                        `**Date:** <t:${Math.floor(Date.now() / 1000)}:f>\n\n` +
                        `Thank you for using our support!`
                    )
                    .setColor(0xFF0000)
                    .setTimestamp();

                await interaction.reply({ 
                    embeds: [closeEmbed],
                    ephemeral: false 
                });

                setTimeout(() => {
                    if (interaction.channel.deletable) {
                        interaction.channel.delete().catch(console.error);
                    }
                }, 5000);
            }
        }

    } catch (err) {
        console.error('❌ Interaction error:', err);
        if (!interaction.replied && !interaction.deferred) {
            try {
                await interaction.reply({ 
                    content: '❌ An error occurred while processing your request.',
                    ephemeral: true 
                });
            } catch (e) {
                console.error('Error sending error message:', e);
            }
        }
    }
});

function createTicketControlButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Close Ticket')            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('close_with_reason')
            .setLabel('Close with Reason')
            .setEmoji('📝')
            .setStyle(ButtonStyle.Secondary)
    );
}

client.on('guildCreate', (guild) => {
    console.log(`➕ Joined new guild: ${guild.name} (${guild.id})`);
    initializeServer(guild.id);
});

client.on('guildDelete', (guild) => {
    console.log(`➖ Left guild: ${guild.name} (${guild.id})`);
});

client.login(process.env.DISCORD_TOKEN);

