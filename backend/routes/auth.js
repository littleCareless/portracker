/**
 * Authentication Routes
 * 
 * Handles user authentication including login, logout, and initial setup.
 * All endpoints use session-based authentication with bcrypt password hashing.
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const { Logger } = require('../lib/logger');
const { isAuthEnabled } = require('../middleware/auth');
const recoveryManager = require('../lib/recovery-manager');
const { getErrorMessage } = require('../lib/i18n');

const router = express.Router();
const logger = new Logger('AuthRoutes', { debug: process.env.DEBUG === 'true' });

router.get('/status', (req, res) => {
  try {
    if (!isAuthEnabled()) {
      return res.json({
        authEnabled: false,
        authenticated: true,
        setupRequired: false
      });
    }

    let userCount;
    try {
      userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    } catch (err) {
      logger.warn('Users table does not exist yet, setup required:', err.message);
      return res.json({
        authEnabled: true,
        authenticated: false,
        setupRequired: true
      });
    }

    const setupRequired = userCount.count === 0;
    const authenticated = !!(req.session && req.session.userId);

    res.json({
      authEnabled: true,
      authenticated,
      setupRequired,
      username: authenticated ? req.session.username : null
    });
  } catch (error) {
    logger.error('Error checking auth status:', error.message);
    res.status(500).json({ error: getErrorMessage('checkAuthStatusFailed') });
  }
});

router.post('/setup', async (req, res) => {
  try {
    if (!isAuthEnabled()) {
      return res.status(400).json({ error: getErrorMessage('authDisabled') });
    }

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: getErrorMessage('usernamePasswordRequired') });
    }

    if (typeof username !== 'string' || username.trim().length < 3) {
      return res.status(400).json({ error: getErrorMessage('usernameMinLength') });
    }

    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: getErrorMessage('passwordMinLength') });
    }

    let userCount;
    try {
      userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    } catch (dbError) {
      logger.error('Users table does not exist:', dbError.message);
      return res.status(500).json({ error: getErrorMessage('databaseNotInitialized') });
    }

    if (userCount.count > 0) {
      return res.status(400).json({ error: getErrorMessage('setupAlreadyCompleted') });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();
    const now = Date.now();

    db.prepare(
      'INSERT INTO users (id, username, password_hash, created_at, last_login) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, username.trim(), passwordHash, now, now);

    req.session.regenerate((err) => {
      if (err) {
        logger.error('Session regeneration failed:', err.message);
        return res.status(500).json({ error: 'Setup failed' });
      }

      req.session.userId = userId;
      req.session.username = username.trim();

      req.session.save((saveErr) => {
        if (saveErr) {
          logger.error('Session save failed:', saveErr.message);
          return res.status(500).json({ error: 'Setup failed' });
        }

        logger.info(`Initial admin user created: ${username.trim()}`);

        res.json({
          success: true,
          message: getErrorMessage('setupCompleted'),
          username: username.trim()
        });
      });
    });
  } catch (error) {
    logger.error('Error during setup:', error.message);
    res.status(500).json({ error: getErrorMessage('setupFailed') });
  }
});

router.post('/login', async (req, res) => {
  try {
    if (!isAuthEnabled()) {
      return res.status(400).json({ error: getErrorMessage('authDisabled') });
    }

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: getErrorMessage('usernamePasswordRequired') });
    }

    const trimmedUsername = typeof username === 'string' ? username.trim() : username;

    const isRecoveryKey = recoveryManager.validateKey(password);
    
    if (isRecoveryKey) {
      let user;
      try {
        user = db.prepare('SELECT * FROM users LIMIT 1').get();
      } catch (dbError) {
        logger.error('Database error during recovery:', dbError.message);
        return res.status(500).json({ error: getErrorMessage('recoveryFailed') });
      }

      if (!user) {
        return res.status(400).json({ error: getErrorMessage('noUsersFound') });
      }

      recoveryManager.markAsUsed();

      req.session.regenerate((err) => {
        if (err) {
          logger.error('Session regeneration failed:', err.message);
          return res.status(500).json({ error: getErrorMessage('recoveryFailed') });
        }

        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.requirePasswordChange = true;

        req.session.save((saveErr) => {
          if (saveErr) {
            logger.error('Session save failed:', saveErr.message);
            return res.status(500).json({ error: getErrorMessage('recoveryFailed') });
          }

          logger.info(`Recovery key used for user: ${user.username}`);

          return res.json({
            success: true,
            username: user.username,
            requirePasswordChange: true
          });
        });
      });
      return;
    }

    let user;
    try {
      user = db.prepare('SELECT * FROM users WHERE username = ?').get(trimmedUsername);
    } catch (dbError) {
      logger.error('Database error during login:', dbError.message);
      return res.status(500).json({ error: getErrorMessage('loginFailed') });
    }

    const hashToCompare = user ? user.password_hash : '$2a$10$AAAAAAAAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const isValid = await bcrypt.compare(password, hashToCompare);

    if (!user || !isValid) {
      logger.debug(`Failed login attempt for user: ${trimmedUsername}`);
      return res.status(401).json({ error: getErrorMessage('invalidCredentials') });
    }

    db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(Date.now(), user.id);

    req.session.regenerate((err) => {
      if (err) {
        logger.error('Session regeneration failed:', err.message);
        return res.status(500).json({ error: getErrorMessage('loginFailed') });
      }

      req.session.userId = user.id;
      req.session.username = user.username;

      req.session.save((saveErr) => {
        if (saveErr) {
          logger.error('Session save failed:', saveErr.message);
          return res.status(500).json({ error: getErrorMessage('loginFailed') });
        }

        logger.info(`User logged in: ${user.username}`);

        res.json({
          success: true,
          username: user.username
        });
      });
    });
  } catch (error) {
    logger.error('Error during login:', error.message);
    res.status(500).json({ error: getErrorMessage('loginFailed') });
  }
});

router.post('/logout', (req, res) => {
  const username = req.session?.username;
  
  req.session.destroy((err) => {
    if (err) {
      logger.error('Error destroying session:', err.message);
      return res.status(500).json({ error: getErrorMessage('logoutFailed') });
    }

    if (username) {
      logger.info(`User logged out: ${username}`);
    }

    res.json({ success: true, message: getErrorMessage('loggedOut') });
  });
});

router.post('/change-password', async (req, res) => {
  try {
    if (!isAuthEnabled()) {
      return res.status(400).json({ error: getErrorMessage('authDisabled') });
    }

    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: getErrorMessage('notAuthenticated') });
    }

    const { currentPassword, newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: getErrorMessage('newPasswordRequired') });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ error: getErrorMessage('passwordMinLength') });
    }

    const requirePasswordChange = req.session.requirePasswordChange;

    if (!requirePasswordChange && !currentPassword) {
      return res.status(400).json({ error: getErrorMessage('currentPasswordRequired') });
    }

    let user;
    try {
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
    } catch (dbError) {
      logger.error('Database error during password change:', dbError.message);
      return res.status(500).json({ error: getErrorMessage('passwordChangeFailed') });
    }

    if (!user) {
      return res.status(404).json({ error: getErrorMessage('userNotFound') });
    }

    if (!requirePasswordChange) {
      const isValidCurrent = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValidCurrent) {
        return res.status(401).json({ error: getErrorMessage('currentPasswordIncorrect') });
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, user.id);

    delete req.session.requirePasswordChange;

    req.session.save((saveErr) => {
      if (saveErr) {
        logger.error('Session save failed:', saveErr.message);
        return res.status(500).json({ error: getErrorMessage('passwordChangeFailed') });
      }

      logger.info(`Password changed for user: ${user.username}`);

      res.json({
        success: true,
        message: getErrorMessage('passwordChanged')
      });
    });
  } catch (error) {
    logger.error('Error during password change:', error.message);
    res.status(500).json({ error: getErrorMessage('passwordChangeFailed') });
  }
});

module.exports = router;
