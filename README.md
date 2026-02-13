# Ticketmatics

A professional Discord ticket management system built for Vercel serverless deployment using HTTP Interactions.

## 🚀 Features

- **Serverless Architecture**: Fully compatible with Vercel's serverless functions
- **HTTP Interactions**: Uses Discord's HTTP-based interactions instead of WebSocket connections
- **Persistent Storage**: Supports Vercel KV, Upstash Redis, or in-memory fallback
- **Multi-Server Support**: Each Discord server has its own isolated configuration
- **Staff Management**: Add/remove staff members and roles
- **Ticket Categories**: Organize tickets by category (General, Technical, Billing, etc.)
- **Dashboard & Statistics**: Real-time ticket statistics and management

## 📋 Prerequisites

- Node.js 18.x or higher
- A Discord Application (Bot)
- Vercel account (for deployment)
- (Optional) Vercel KV or Upstash Redis for persistent storage

## 🔧 Environment Variables

Create a `.env` file with the following variables:

```env
# Required
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_id_here
DISCORD_PUBLIC_KEY=your_public_key_here

# Optional - For persistent storage
KV_REST_API_URL=your_vercel_kv_url
KV_REST_API_TOKEN=your_vercel_kv_token

# OR use Upstash Redis
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token

# Optional - For faster command registration during development
GUILD_ID=your_test_guild_id

# Optional - Security for command registration endpoint
REGISTER_SECRET=your_secret_here
```

## 🏗️ Architecture

### HTTP Interactions vs WebSocket

This bot uses Discord's HTTP Interactions endpoint instead of maintaining a persistent WebSocket connection. This is essential for serverless platforms like Vercel because:

1. **No Persistent Connections**: Serverless functions are ephemeral and can't maintain WebSocket connections
2. **Request-Response Model**: Discord sends interactions via HTTP POST requests
3. **Stateless Design**: Each request is handled independently

### File Structure

```
Ticketmatics/
├── api/
│   ├── interactions.js    # Main Discord interactions handler
│   ├── register-commands.js # Command registration endpoint
│   └── health.js          # Health check endpoint
├── lib/
│   ├── commands.js        # Slash command definitions
│   ├── storage.js         # Storage abstraction layer
│   └── ticketManager.js   # Core ticket logic
├── scripts/
│   └── register-commands.js # Local command registration script
├── vercel.json            # Vercel configuration
├── package.json
└── README.md
```

## 🚀 Deployment

### 1. Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "Bot" section and create a bot
4. Copy the token to `DISCORD_TOKEN`
5. Go to "General Information" and copy:
   - Application ID → `CLIENT_ID`
   - Public Key → `DISCORD_PUBLIC_KEY`

### 2. Enable Interactions Endpoint

1. In Discord Developer Portal, go to "General Information"
2. Scroll to "Interactions Endpoint URL"
3. Enter your Vercel deployment URL: `https://your-app.vercel.app/api/interactions`
4. Save changes

### 3. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### 4. Register Commands

After deployment, register your slash commands:

```bash
# Using the API endpoint
curl -X POST https://your-app.vercel.app/api/register-commands

# Or locally
npm run register
```

## 💻 Local Development

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Register commands
npm run register
```

## 📝 Commands

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/setup` | Create the ticket panel | Administrator |
| `/dashboard` | View ticket statistics | Administrator |
| `/stats` | View server statistics | Administrator |
| `/addstaff` | Add a staff member | Administrator |
| `/removestaff` | Remove a staff member | Administrator |
| `/addstaffrole` | Add a staff role | Administrator |
| `/removestaffrole` | Remove a staff role | Administrator |
| `/liststaff` | List all staff | Administrator |
| `/config` | Configure settings | Administrator |
| `/help` | Show help information | Everyone |

## 🔒 Security

- All requests are verified using Discord's Ed25519 signature verification
- Command registration endpoint can be protected with a secret
- Staff-only actions are properly permission-checked

## 📦 Storage Options

### Vercel KV (Recommended for Vercel)

1. Create a KV database in your Vercel project
2. The environment variables are automatically set

### Upstash Redis

1. Create a Redis database at [Upstash](https://upstash.com)
2. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

### In-Memory (Development Only)

Without a persistent storage backend, data will be lost between function invocations. This is only suitable for development.

## 🔄 Migration from WebSocket Bot

If migrating from a traditional WebSocket-based bot:

1. Remove all `client.on()` event listeners
2. Convert interaction handlers to HTTP response format
3. Replace file system storage with the storage abstraction layer
4. Update command registration to use the new endpoint

## 📄 License

ISC

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
