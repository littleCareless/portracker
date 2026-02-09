/**
 * Router Encryption Module
 * Provides AES-256-GCM encryption for router credentials
 */

const crypto = require('crypto');
const { Logger } = require('./logger');

const logger = new Logger('RouterEncryption');

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Get encryption key from environment or generate a derived key
 * @returns {Buffer} 32-byte encryption key
 */
function getEncryptionKey() {
  const envKey = process.env.ROUTER_ENCRYPTION_KEY;
  
  if (envKey) {
    // Use provided key (must be 32 bytes for aes-256)
    if (Buffer.byteLength(envKey) === 32) {
      return Buffer.from(envKey, 'utf-8');
    }
    // Derive a 32-byte key from the provided string
    return crypto.scryptSync(envKey, 'router-salt', KEY_LENGTH);
  }
  
  // Generate a key based on machine-specific values for development
  // In production, this should always come from ROUTER_ENCRYPTION_KEY env var
  const os = require('os');
  const machineId = os.hostname() + os.arch();
  const derivedKey = crypto.scryptSync(machineId, 'portracker-router-key', KEY_LENGTH);
  
  logger.warn('Using derived encryption key from system info. Set ROUTER_ENCRYPTION_KEY env var for production.');
  return derivedKey;
}

/**
 * Encrypt a plaintext string
 * @param {string} plaintext - The text to encrypt
 * @returns {object} - Object containing encrypted data, IV, and auth tag
 */
function encrypt(plaintext) {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty string');
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  } catch (error) {
    logger.error('Encryption failed:', error.message);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt an encrypted string
 * @param {string} encryptedData - The encrypted data (hex encoded)
 * @param {string} iv - The initialization vector (hex encoded)
 * @param {string} tag - The auth tag (hex encoded)
 * @returns {string} - The decrypted plaintext
 */
function decrypt(encryptedData, iv, tag) {
  if (!encryptedData || !iv || !tag) {
    throw new Error('Missing encryption parameters');
  }

  try {
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error('Decryption failed:', error.message);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Encrypt router password and return storage-ready object
 * @param {string} password - Plaintext password
 * @returns {object} - Storage-ready encrypted object
 */
function encryptPassword(password) {
  const result = encrypt(password);
  return {
    encryptedPassword: result.encrypted,
    encryptionIv: result.iv,
    encryptionTag: result.tag
  };
}

/**
 * Decrypt router password from storage object
 * @param {object} storageObj - Object with encryptedPassword, encryptionIv, encryptionTag
 * @returns {string} - Decrypted password
 */
function decryptPassword(storageObj) {
  return decrypt(
    storageObj.encryptedPassword,
    storageObj.encryptionIv,
    storageObj.encryptionTag
  );
}

module.exports = {
  encrypt,
  decrypt,
  encryptPassword,
  decryptPassword,
  ALGORITHM,
  IV_LENGTH,
  TAG_LENGTH
};
