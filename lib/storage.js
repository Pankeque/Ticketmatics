/**
 * Storage Abstraction Layer for Vercel Serverless
 * Supports multiple backends: Vercel KV, Upstash Redis, or in-memory fallback
 */

// Memory fallback for development
const memoryStore = new Map();

/**
 * Storage class that abstracts different storage backends
 */
class Storage {
    constructor() {
        this.backend = this.detectBackend();
    }

    /**
     * Detect available storage backend
     */
    detectBackend() {
        // Check for Vercel KV
        if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
            return 'vercel-kv';
        }
        // Check for Upstash Redis
        if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
            return 'upstash';
        }
        // Fallback to memory (not persistent in serverless!)
        console.warn('⚠️ No persistent storage configured. Using in-memory storage (data will be lost between invocations).');
        console.warn('⚠️ Set up Vercel KV or Upstash Redis for persistent storage.');
        return 'memory';
    }

    /**
     * Get a value from storage
     * @param {string} key - Storage key
     * @returns {Promise<any>} - Stored value or null
     */
    async get(key) {
        try {
            switch (this.backend) {
                case 'vercel-kv':
                    const { kv } = await import('@vercel/kv');
                    return await kv.get(key);
                
                case 'upstash':
                    const { Redis } = await import('@upstash/redis');
                    const redis = new Redis({
                        url: process.env.UPSTASH_REDIS_REST_URL,
                        token: process.env.UPSTASH_REDIS_REST_TOKEN,
                    });
                    return await redis.get(key);
                
                case 'memory':
                default:
                    const data = memoryStore.get(key);
                    return data ? JSON.parse(data) : null;
            }
        } catch (error) {
            console.error(`❌ Storage get error for key ${key}:`, error);
            return null;
        }
    }

    /**
     * Set a value in storage
     * @param {string} key - Storage key
     * @param {any} value - Value to store
     * @param {number} [ttl] - Time to live in seconds (optional)
     * @returns {Promise<boolean>} - Success status
     */
    async set(key, value, ttl = null) {
        try {
            switch (this.backend) {
                case 'vercel-kv':
                    const { kv } = await import('@vercel/kv');
                    if (ttl) {
                        await kv.set(key, value, { ex: ttl });
                    } else {
                        await kv.set(key, value);
                    }
                    return true;
                
                case 'upstash':
                    const { Redis } = await import('@upstash/redis');
                    const redis = new Redis({
                        url: process.env.UPSTASH_REDIS_REST_URL,
                        token: process.env.UPSTASH_REDIS_REST_TOKEN,
                    });
                    if (ttl) {
                        await redis.set(key, value, { ex: ttl });
                    } else {
                        await redis.set(key, value);
                    }
                    return true;
                
                case 'memory':
                default:
                    memoryStore.set(key, JSON.stringify(value));
                    return true;
            }
        } catch (error) {
            console.error(`❌ Storage set error for key ${key}:`, error);
            return false;
        }
    }

    /**
     * Delete a value from storage
     * @param {string} key - Storage key
     * @returns {Promise<boolean>} - Success status
     */
    async delete(key) {
        try {
            switch (this.backend) {
                case 'vercel-kv':
                    const { kv } = await import('@vercel/kv');
                    await kv.del(key);
                    return true;
                
                case 'upstash':
                    const { Redis } = await import('@upstash/redis');
                    const redis = new Redis({
                        url: process.env.UPSTASH_REDIS_REST_URL,
                        token: process.env.UPSTASH_REDIS_REST_TOKEN,
                    });
                    await redis.del(key);
                    return true;
                
                case 'memory':
                default:
                    memoryStore.delete(key);
                    return true;
            }
        } catch (error) {
            console.error(`❌ Storage delete error for key ${key}:`, error);
            return false;
        }
    }

    /**
     * Get all keys matching a pattern
     * @param {string} pattern - Key pattern (e.g., "guild:*")
     * @returns {Promise<string[]>} - Array of matching keys
     */
    async keys(pattern) {
        try {
            switch (this.backend) {
                case 'vercel-kv':
                    const { kv } = await import('@vercel/kv');
                    // Vercel KV doesn't support pattern matching directly
                    // We'll use a workaround with scan
                    const keys = [];
                    let cursor = 0;
                    do {
                        const result = await kv.scan(cursor, { match: pattern });
                        cursor = result[0];
                        keys.push(...result[1]);
                    } while (cursor !== 0);
                    return keys;
                
                case 'upstash':
                    const { Redis } = await import('@upstash/redis');
                    const redis = new Redis({
                        url: process.env.UPSTASH_REDIS_REST_URL,
                        token: process.env.UPSTASH_REDIS_REST_TOKEN,
                    });
                    return await redis.keys(pattern);
                
                case 'memory':
                default:
                    const allKeys = Array.from(memoryStore.keys());
                    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
                    return allKeys.filter(k => regex.test(k));
            }
        } catch (error) {
            console.error(`❌ Storage keys error for pattern ${pattern}:`, error);
            return [];
        }
    }
}

// Export singleton instance
export const storage = new Storage();

// Helper functions for guild data
const GUILD_KEY_PREFIX = 'guild:';
const TICKET_KEY_PREFIX = 'ticket:';

/**
 * Get guild data
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object>} - Guild data object
 */
export async function getGuildData(guildId) {
    const key = `${GUILD_KEY_PREFIX}${guildId}`;
    const data = await storage.get(key);
    
    if (!data) {
        return initializeGuildData(guildId);
    }
    
    return data;
}

/**
 * Save guild data
 * @param {string} guildId - Discord guild ID
 * @param {Object} data - Guild data to save
 * @returns {Promise<boolean>} - Success status
 */
export async function saveGuildData(guildId, data) {
    const key = `${GUILD_KEY_PREFIX}${guildId}`;
    return await storage.set(key, data);
}

/**
 * Initialize default guild data
 * @param {string} guildId - Discord guild ID
 * @returns {Object} - Initialized guild data
 */
export async function initializeGuildData(guildId) {
    const defaultData = {
        guildId,
        tickets: {},
        staffMembers: [],
        staffRoles: [],
        nextTicketNumber: 1,
        settings: {
            maxTicketsPerUser: 3,
            ticketCategoryName: '🎫・Tickets',
            logsChannelName: 'ticket-logs',
            dashboardChannelName: 'ticket-dashboard',
            ticketPrefix: 'ticket-',
            autoCreateStaffRole: false,
            staffRoleName: 'Support Staff'
        },
        createdAt: Date.now()
    };
    
    await saveGuildData(guildId, defaultData);
    return defaultData;
}

/**
 * Get ticket data
 * @param {string} guildId - Discord guild ID
 * @param {string} ticketId - Ticket ID
 * @returns {Promise<Object|null>} - Ticket data or null
 */
export async function getTicketData(guildId, ticketId) {
    const key = `${TICKET_KEY_PREFIX}${guildId}:${ticketId}`;
    return await storage.get(key);
}

/**
 * Save ticket data
 * @param {string} guildId - Discord guild ID
 * @param {string} ticketId - Ticket ID
 * @param {Object} data - Ticket data to save
 * @returns {Promise<boolean>} - Success status
 */
export async function saveTicketData(guildId, ticketId, data) {
    const key = `${TICKET_KEY_PREFIX}${guildId}:${ticketId}`;
    return await storage.set(key, data);
}

/**
 * Delete ticket data
 * @param {string} guildId - Discord guild ID
 * @param {string} ticketId - Ticket ID
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteTicketData(guildId, ticketId) {
    const key = `${TICKET_KEY_PREFIX}${guildId}:${ticketId}`;
    return await storage.delete(key);
}
