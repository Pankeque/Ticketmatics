# Ticketmatics - Discord Ticket Bot

## Overview
Ticketmatics is a robust Discord ticket system that allows users to create support channels with a single button click. It features an administrative panel, ticket logging, and easy management for support teams.

## Features
- 🎫 **Quick Ticket Creation** - Create tickets with a single button click
- 🏢 **Organized Departments** - Multiple support departments (Billing, Technical Support, Reports, Feature Requests, Other)
- 🆔 **ID Tracking System** - Unique ticket IDs for easy reference
- 📋 **Complete Action Logs** - Full logging of all ticket actions
- 🎛️ **Full Ticket Control** - Close, reopen, add/remove users from tickets
- 📊 **Dashboard & Statistics** - Real-time ticket statistics and monitoring

## Requirements
- Node.js v16.9.0 or higher
- Discord.js v14
- A Discord bot token

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ticketmatics
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
```

4. Start the bot:
```bash
npm start
```

## Configuration

The bot uses the following default settings (configurable via `/config` command):
- **Max Tickets Per User:** 3
- **Ticket Category Name:** 🎫・Tickets
- **Logs Channel Name:** ticket-logs
- **Ticket Prefix:** ticket-

## Commands

### Admin Commands
| Command | Description |
|---------|-------------|
| `/setup` | Deploy the ticket creation panel in the current channel |
| `/addstaff <member>` | Add a member to the support team |
| `/removestaff <member>` | Remove a member from the support team |
| `/dashboard` | Create/update the ticket dashboard |
| `/stats` | Show server ticket statistics |
| `/config <setting> <value>` | Configure ticket system settings |

### Staff Commands
| Command | Description |
|---------|-------------|
| `/closeticket <channel> [reason]` | Close a ticket manually |
| `/adduser <member>` | Add a user to a ticket |
| `/removeuser <member>` | Remove a user from a ticket |
| `/reopen <ticketid>` | Reopen a closed ticket |

## Architecture
- **Framework:** Discord.js v14
- **Persistence:** JSON file storage (can be upgraded to database)
- **UI:** Discord Buttons, Modals, and Select Menus
- **Branding:** Yellow (#FFFF00)

## License
ISC

## Support
For support, please open an issue in the repository.
