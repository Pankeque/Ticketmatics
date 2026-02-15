# 🎫 Ticketmatics

A professional Discord ticket management bot with a modern interface and robust features.

## ✨ Features

- **Ticket System**: Create, manage, and track support tickets
- **Staff Management**: Add/remove staff members and roles
- **Categories**: Organize tickets by category (General, Technical, Billing, Report, Other)
- **Dashboard**: Real-time statistics and ticket overview
- **Transcripts**: View ticket history and details
- **Auto Channel Management**: Automatic channel creation and permission handling

## 🚀 Deployment (Discloud)

### Prerequisites

- Node.js 18.x or higher
- A Discord bot application
- Discloud account

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/ticketmatics.git
   cd ticketmatics
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your bot credentials:
   ```env
   DISCORD_TOKEN=your_bot_token
   CLIENT_ID=your_client_id
   DISCORD_PUBLIC_KEY=your_public_key
   ```

4. Deploy to Discloud:
   - Upload your project to Discloud
   - The `discloud.config` file contains the deployment settings

## 📋 Commands

### Admin Commands

| Command | Description |
|---------|-------------|
| `/setup` | Create the ticket panel in the current channel |
| `/addstaff @member` | Add a member to the staff team |
| `/removestaff @member` | Remove a member from the staff team |
| `/addstaffrole @role` | Add a role as staff |
| `/removestaffrole @role` | Remove a role from staff |
| `/liststaff` | List all staff members and roles |
| `/config <setting> <value>` | Configure ticket system settings |
| `/stats` | View server ticket statistics |
| `/dashboard` | View ticket dashboard |

### Staff Commands

| Command | Description |
|---------|-------------|
| `/closeticket #channel` | Close a ticket |
| `/adduser @member` | Add a user to a ticket |
| `/removeuser @member` | Remove a user from a ticket |
| `/reopen <ticketid>` | Reopen a closed ticket |
| `/transcript <ticketid>` | Get ticket transcript |

### User Commands

| Command | Description |
|---------|-------------|
| `/help` | Show help information |

## ⚙️ Configuration Options

| Setting | Description | Default |
|---------|-------------|---------|
| `max_tickets` | Maximum tickets per user | 3 |
| `category_name` | Ticket category name | 🎫・Tickets |
| `logs_channel` | Logs channel name | ticket-logs |
| `ticket_prefix` | Ticket channel prefix | ticket- |
| `staff_role_name` | Staff role name | Support Staff |
| `auto_create_staff_role` | Auto-create staff role | false |

## 📁 Project Structure

```
ticketmatics/
├── index.js              # Main entry point
├── handlers/
│   └── interactions.js   # Interaction handler
├── lib/
│   ├── commands.js       # Slash command definitions
│   ├── storage.js        # File-based storage
│   └── ticketManager.js  # Ticket management logic
├── data/                 # Data storage (auto-created)
├── .env                  # Environment variables
├── discloud.config       # Discloud configuration
├── package.json
└── README.md
```

## 🔧 Development

1. Start the bot:
   ```bash
   npm start
   ```

2. For development:
   ```bash
   npm run dev
   ```

## 📝 License

ISC License

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

If you need help with Ticketmatics, please open an issue on GitHub.
