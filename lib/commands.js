/**
 * Discord Slash Commands Definition
 * Used by both HTTP Interactions handler and command registration
 */

import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const commands = [
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
                .setDescription('Role to add as staff')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('removestaffrole')
        .setDescription('Remove a role from staff roles')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Role to remove from staff')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('liststaff')
        .setDescription('List all staff members and roles')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('transcript')
        .setDescription('Get transcript of a closed ticket')
        .addStringOption(option =>
            option.setName('ticketid')
                .setDescription('Ticket ID to get transcript')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show help information about Ticketmatics')
];

/**
 * Convert commands to JSON for registration
 */
export function getCommandsJSON() {
    return commands.map(cmd => cmd.toJSON());
}
