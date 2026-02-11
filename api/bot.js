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
const path = require('path');
const https = require('https');

// Create transcripts directory if it doesn't exist
const TRANSCRIPTS_DIR = path.join(process.cwd(), 'transcripts');
if (!fs.existsSync(TRANSCRIPTS_DIR)) {
    fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
}

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
const DATA_FILE = path.join(process.cwd(), 'ticket_data.json');

// Multi-Server Data Structure
let serverData = {};

// Load data from file
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const rawData = fs.readFileSync(DATA_FILE);
            serverData = JSON.parse(rawData);
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
            staffRoles: [],
            nextTicketNumber: 1,
            settings: {
                maxTicketsPerUser: MAX_TICKETS_PER_USER,
                ticketCategoryName: TICKET_CATEGORY_NAME,
                logsChannelName: LOGS_CHANNEL_NAME,
                dashboardChannelName: DASHBOARD_CHANNEL_NAME,
                ticketPrefix: TICKET_PREFIX,
                autoCreateStaffRole: false,
                staffRoleName: 'Support Staff'
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
function isStaff(guildId, userId, guild) {
    const server = getServerData(guildId);
    
    // Check if user is in staff members list
    if (server.staffMembers.includes(userId)) {
        return true;
    }
    
    // Check if user has any staff role
    if (guild) {
        const member = guild.members.cache.get(userId);
        if (member) {
            return server.staffRoles.some(roleId => member.roles.cache.has(roleId));
        }
    }
    
    return false;
}

// Generate and save transcript
async function generateTranscript(channel, ticketId) {
    try {
        const messages = await channel.messages.fetch({ limit: 1000 });
        const sortedMessages = messages.sort((a, b) => a.createdAt - b.createdAt);
        
        let transcript = `📝 Ticket Transcript - #${ticketId}\n`;
        transcript += `📅 Generated: ${new Date().toLocaleString()}\n`;
        transcript += `💬 Channel: ${channel.name} (${channel.id})\n`;
        transcript += `===============================================\n\n`;
        
        sortedMessages.forEach(msg => {
            const timestamp = msg.createdAt.toLocaleString();
            const author = msg.author.tag;
            let content = msg.content;
            
            // Handle attachments
            if (msg.attachments.size > 0) {
                const attachments = msg.attachments.map(att => att.url).join('\n');
                content += `\n📎 Attachments:\n${attachments}`;
            }
            
            // Handle embeds
            if (msg.embeds.length > 0) {
                const embedCount = msg.embeds.length;
                content += `\n📄 ${embedCount} embed${embedCount > 1 ? 's' : ''} included`;
            }
            
            transcript += `[${timestamp}] ${author}: ${content}\n`;
        });
        
        // Save transcript file
        const fileName = `transcript-${ticketId}-${Date.now()}.txt`;
        const filePath = path.join(TRANSCRIPTS_DIR, fileName);
        fs.writeFileSync(filePath, transcript, 'utf8');
        
        return {
            content: transcript,
            fileName: fileName,
            filePath: filePath,
            messageCount: messages.size
        };
    } catch (error) {
        console.error('❌ Error generating transcript:', error);
        return null;
    }
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
        .setDescription('Close a ticket manually (staff only)')
        .addChannelOption(option =>
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
                .setDescription('Setting to configure')
                .setRequired(true)
                .addChoices(
                    { name: 'Max Tickets Per User', value: 'max_tickets' },
                    { name: 'Ticket Category Name', value: 'category_name' },
                    { name: 'Logs Channel Name', value: 'logs_channel' },
                    { name: 'Ticket Prefix', value: 'ticket_prefix' },
                    { name: 'Staff Role Name', value: 'staff_role_name' },
                    { name: 'Auto-Create Staff Role', value: 'auto_create_staff_role' }
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
        )
        .addBooleanOption(option =>
            option.setName('value_boolean')
                .setDescription('Boolean value for the setting')
                .setRequired(false)
        ),
    new SlashCommandBuilder()
        .setName('addstaffrole')
        .setDescription('Add a role as a staff role for ticket access')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Role to add as staff role')
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('removestaffrole')
        .setDescription('Remove a role from the staff roles list')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Role to remove from staff roles')
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('transcript')
        .setDescription('Get transcript of a ticket (staff only)')
        .addStringOption(option =>
            option.setName('ticketid')
                .setDescription('Ticket ID to get transcript for')
                .setRequired(true)
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
                {
                    id: guild.id,
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
    const logsChannel = await getOrCreateLogsChannel(guild);
    const embed = new EmbedBuilder()
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

// Add the rest of the interactionCreate listener from index.js
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
                    .setTitle('🎫 Ticketmatics Support Center')
                    .setDescription(
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
                    content: `✅ ${member} has been added to the support team!`,
                    ephemeral: true 
                });
            }

            if (commandName === 'removestaff') {
                const member = interaction.options.getMember('member');

                if (!server.staffMembers.includes(member.id)) {
                    return interaction.reply({ 
                        content: '⚠️ This member is not part of the support team!',
                        ephemeral: true 
                    });
                }

                server.staffMembers = server.staffMembers.filter(id => id !== member.id);
                saveData();

                await interaction.reply({ 
                    content: `✅ ${member} has been removed from the support team!`,
                    ephemeral: true 
                });
            }

            if (commandName === 'dashboard') {
                const embed = new EmbedBuilder()
                    .setTitle('🎫 Ticketmatics Dashboard')
                    .setDescription('Real-time ticket statistics and monitoring')
                    .setColor(TICKET_COLOR)
                    .setTimestamp();

                const activeTickets = Object.values(server.tickets).filter(t => t.status === 'open').length;
                const closedTickets = Object.values(server.tickets).filter(t => t.status === 'closed').length;
                const totalTickets = Object.values(server.tickets).length;

                embed.addFields(
                    { name: '🔴 Active Tickets', value: activeTickets.toString(), inline: true },
                    { name: '🟢 Closed Tickets', value: closedTickets.toString(), inline: true },
                    { name: '📊 Total Tickets', value: totalTickets.toString(), inline: true }
                );

                await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (commandName === 'stats') {
                const embed = new EmbedBuilder()
                    .setTitle('📊 Ticket Statistics')
                    .setColor(TICKET_COLOR)
                    .setTimestamp();

                const activeTickets = Object.values(server.tickets).filter(t => t.status === 'open').length;
                const closedTickets = Object.values(server.tickets).filter(t => t.status === 'closed').length;
                const totalTickets = Object.values(server.tickets).length;

                embed.addFields(
                    { name: '🔴 Active Tickets', value: activeTickets.toString(), inline: true },
                    { name: '🟢 Closed Tickets', value: closedTickets.toString(), inline: true },
                    { name: '📊 Total Tickets', value: totalTickets.toString(), inline: true }
                );

                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }

        // Handle button interactions
        if (interaction.isButton()) {
            const { customId } = interaction;

            if (customId === 'open_ticket_select') {
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('ticket_department')
                    .setPlaceholder('Select a department')
                    .addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Billing')
                            .setDescription('Issues related to payments and billing')
                            .setValue('billing'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Technical Support')
                            .setDescription('Technical issues and troubleshooting')
                            .setValue('technical'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Reports')
                            .setDescription('Report issues or bugs')
                            .setValue('reports'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Feature Requests')
                            .setDescription('Suggest new features')
                            .setValue('feature_requests'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Other')
                            .setDescription('Other issues not listed above')
                            .setValue('other')
                    );

                const row = new ActionRowBuilder().addComponents(selectMenu);

                await interaction.reply({
                    content: 'Please select a department for your ticket:',
                    components: [row],
                    ephemeral: true
                });
            }
        }

        // Handle select menu interactions
        if (interaction.isStringSelectMenu()) {
            const { customId, values } = interaction;

            if (customId === 'ticket_department') {
                const department = values[0];
                const guildId = interaction.guild.id;
                const server = getServerData(guildId);

                // Check if user has reached max tickets
                const userTickets = Object.values(server.tickets).filter(
                    t => t.userId === interaction.user.id && t.status === 'open'
                ).length;

                if (userTickets >= server.settings.maxTicketsPerUser) {
                    return interaction.reply({
                        content: `⚠️ You have reached the maximum number of open tickets (${server.settings.maxTicketsPerUser})!`,
                        ephemeral: true
                    });
                }

                // Generate ticket ID
                const ticketId = generateTicketId(guildId);

                // Create ticket channel
                const category = await getOrCreateTicketCategory(interaction.guild);
                const channel = await interaction.guild.channels.create({
                    name: `${server.settings.ticketPrefix}${ticketId}`,
                    type: ChannelType.GuildText,
                    parent: category.id,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.id,
                            deny: [PermissionFlagsBits.ViewChannel],
                        },
                        {
                            id: interaction.user.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                        },
                        {
                            id: client.user.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels],
                        }
                    ],
                });

                // Save ticket data
                server.tickets[ticketId] = {
                    id: ticketId,
                    userId: interaction.user.id,
                    channelId: channel.id,
                    dept: department,
                    status: 'open',
                    createdAt: Date.now(),
                    closedAt: null,
                    closedBy: null,
                    reason: null
                };
                saveData();

                // Send welcome message
                const embed = new EmbedBuilder()
                    .setTitle(`🎫 Ticket #${ticketId} - ${department}`)
                    .setDescription('Welcome to your ticket! Please describe your issue in detail.')
                    .setColor(TICKET_COLOR)
                    .setTimestamp();

                const closeButton = new ButtonBuilder()
                    .setCustomId(`close_ticket_${ticketId}`)
                    .setLabel('Close Ticket')
                    .setStyle(ButtonStyle.Danger);

                const row = new ActionRowBuilder().addComponents(closeButton);

                await channel.send({
                    content: `<@${interaction.user.id}>`,
                    embeds: [embed],
                    components: [row]
                });

                // Log ticket creation
                await logTicketAction(interaction.guild, 'Created', server.tickets[ticketId]);

                await interaction.reply({
                    content: `✅ Ticket created! Please check ${channel}`,
                    ephemeral: true
                });
            }
        }

        // Handle close ticket button
        if (interaction.isButton() && interaction.customId.startsWith('close_ticket_')) {
            const ticketId = interaction.customId.replace('close_ticket_', '');
            const guildId = interaction.guild.id;
            const server = getServerData(guildId);

            if (!server.tickets[ticketId]) {
                return interaction.reply({
                    content: '❌ Ticket not found!',
                    ephemeral: true
                });
            }

            const ticket = server.tickets[ticketId];
            if (ticket.status === 'closed') {
                return interaction.reply({
                    content: '❌ Ticket is already closed!',
                    ephemeral: true
                });
            }

            // Generate transcript
            const channel = interaction.guild.channels.cache.get(ticket.channelId);
            const transcript = await generateTranscript(channel, ticketId);

            // Update ticket status
            ticket.status = 'closed';
            ticket.closedAt = Date.now();
            ticket.closedBy = interaction.user.id;
            saveData();

            // Send transcript to logs
            const logsChannel = await getOrCreateLogsChannel(interaction.guild);
            if (transcript) {
                await logsChannel.send({
                    content: `📄 Transcript for Ticket #${ticketId}`,
                    files: [transcript.filePath]
                });
            }

            // Log ticket closure
            await logTicketAction(interaction.guild, 'Closed', ticket);

            // Delete channel after delay
            setTimeout(async () => {
                try {
                    await channel.delete();
                } catch (error) {
                    console.error('❌ Error deleting channel:', error);
                }
            }, 5000);

            await interaction.reply({
                content: '✅ Ticket closed! Channel will be deleted in 5 seconds.',
                ephemeral: true
            });
        }

    } catch (error) {
        console.error('❌ Interaction error:', error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                content: '❌ An error occurred while handling your request.',
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: '❌ An error occurred while handling your request.',
                ephemeral: true
            });
        }
    }
});

// Keep the connection alive
function keepAlive() {
    const server = https.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Ticketmatics Bot is running!');
    });
    server.listen(3000, () => {
        console.log('✅ Keep-alive server running on port 3000');
    });
}

// Start the bot
client.login(process.env.DISCORD_TOKEN);

// Vercel serverless function handler
module.exports = async (req, res) => {
    // Check if bot is ready
    if (!client.isReady()) {
        await new Promise(resolve => client.once('ready', resolve));
    }

    // Handle different HTTP methods
    if (req.method === 'GET') {
        res.status(200).json({
            status: 'online',
            bot: client.user.tag,
            guilds: client.guilds.cache.size,
            uptime: client.uptime
        });
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
};
