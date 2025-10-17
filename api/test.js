const express = require('express');

const app = express();

app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'API is working!',
    timestamp: new Date().toISOString()
  });
});

module.exports = app;
