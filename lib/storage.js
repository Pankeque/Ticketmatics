/**
 * Storage Abstraction Layer for Local File System
 * Uses JSON files for persistent storage
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data directory
const DATA_DIR = path.join(__dirname, '..', 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Storage class using local file system
 */
class Storage {
    constructor() {
        this.type = 'file';
        console.log('📁 Using local file storage');
    }

    /**
     * Get a value from storage
     * @param {string} key - Storage key
     * @returns {Promise<any>} - Stored value or null
     */
    async get(key) {
        try {
            const filePath = this.getFilePath(key);
            
            if (!fs.existsSync(filePath)) {
                return null;
            }
            
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`❌ Storage get error for key ${key}:`, error);
            return null;
        }
    }

    /**
     * Set a value in storage
     * @param {string} key - Storage key
     * @param {any} value - Value to store
     * @param {number} [ttl] - Time to live in seconds (not used in file storage)
     * @returns {Promise<boolean>} - Success status
     */
    async set(key, value, ttl = null) {
        try {
            const filePath = this.getFilePath(key);
            const dir = path.dirname(filePath);
            
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
            return true;
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
            const filePath = this.getFilePath(key);
            
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            
            return true;
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
            const keys = [];
            this.scanDirectory(DATA_DIR, '', keys, pattern);
            return keys;
        } catch (error) {
            console.error(`❌ Storage keys error for pattern ${pattern}:`, error);
            return [];
        }
    }

    /**
     * Get file path for a key
     * @param {string} key - Storage key
     * @returns {string} - File path
     */
    getFilePath(key) {
        return path.join(DATA_DIR, `${key}.json`);
    }

    /**
     * Scan directory for matching keys
     * @param {string} dir - Directory to scan
     * @param {string} prefix - Key prefix
     * @param {string[]} keys - Array to collect keys
     * @param {string} pattern - Pattern to match
     */
    scanDirectory(dir, prefix, keys, pattern) {
        if (!fs.existsSync(dir)) return;
        
        const items = fs.readdirSync(dir);
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        
        for (const item of items) {
            const itemPath = path.join(dir, item);
            const stat = fs.statSync(itemPath);
            
            if (stat.isDirectory()) {
                this.scanDirectory(itemPath, `${prefix}${item}:`, keys, pattern);
            } else if (item.endsWith('.json')) {
                const key = `${prefix}${item.slice(0, -5)}`;
                if (regex.test(key)) {
                    keys.push(key);
                }
            }
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
