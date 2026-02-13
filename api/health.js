/**
 * Health Check Endpoint for Vercel
 * Returns the status of the bot and its services
 */

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'Ticketmatics',
        version: '2.0.0',
        architecture: 'HTTP Interactions (Serverless)',
        environment: process.env.NODE_ENV || 'development',
        features: {
            httpInteractions: true,
            persistentStorage: !!(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL),
            storageBackend: process.env.KV_REST_API_URL ? 'Vercel KV' : 
                           process.env.UPSTASH_REDIS_REST_URL ? 'Upstash Redis' : 'Memory (Ephemeral)'
        },
        config: {
            clientId: process.env.CLIENT_ID ? '✅ Set' : '❌ Missing',
            discordToken: process.env.DISCORD_TOKEN ? '✅ Set' : '❌ Missing',
            publicKey: process.env.DISCORD_PUBLIC_KEY ? '✅ Set' : '❌ Missing'
        }
    };
    
    return res.status(200).json(health);
}
