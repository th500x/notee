/**
 * Life resume API routes (prefix mounted in server.js).
 */

const express = require('express');
const { testConnection, dbConfig } = require('../database/connection');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'life-resume',
    phase: 'P7',
    apiPrefix: '/api/life-resume',
  });
});

router.get('/health', async (req, res) => {
  const dbConnected = await testConnection();
  res.json({
    success: true,
    status: dbConnected ? 'ok' : 'degraded',
    service: 'life-resume',
    phase: 'P7',
    database: dbConnected ? 'connected' : 'disconnected',
    databaseName: dbConfig.database,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
