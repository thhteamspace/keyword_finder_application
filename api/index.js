const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// MongoDB connection
const dbURI = "mongodb+srv://Jitesh001:Jitesh001@twicky.fxotzly.mongodb.net/?retryWrites=true&w=majority";

// User Schema
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Message Schema
const MessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'bot', 'system'], required: true },
  content: { type: String, required: true },
  contentType: { type: String, enum: ['news', 'linkedin', null], default: null },
  feedback: {
    isDeclined: { type: Boolean, default: false },
    text: { type: String, default: '' },
    refinedContent: { type: String, default: '' }
  }
}, { timestamps: true });

// Chat Session Schema
const ChatSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  messages: [MessageSchema],
  isProcessing: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const ChatSession = mongoose.model('ChatSession', ChatSessionSchema);

// Connect to MongoDB with error handling
mongoose.connect(dbURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ MongoDB Connected..."))
  .catch(err => {
    console.error("❌ MongoDB connection error:", err);
  });

// Webhook URLs
const WEBHOOKS = {
  NEWS_FINDER: process.env.WEBHOOK_NEWS_FINDER || 'https://mockapi.io/api/v1/research/news',
  CONTENT_CREATION: process.env.WEBHOOK_CONTENT_CREATION || 'https://mockapi.io/api/v1/research/content',
  NEWS_REJECTION: process.env.WEBHOOK_NEWS_REJECTION || 'https://mockapi.io/api/v1/research/rejection',
  LINKEDIN_REMAKING: process.env.WEBHOOK_LINKEDIN_REMAKING || 'https://mockapi.io/api/v1/research/linkedin'
};

// Helper to format responses from webhooks
const formatWebhookResponse = (data) => {
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    if (data.output) return formatWebhookResponse(data.output);
    if (data.news) return formatWebhookResponse(data.news);
    if (data.post) return formatWebhookResponse(data.post);
    return JSON.stringify(data, null, 2);
  }
  return 'Invalid response format';
};

// API Routes

// User Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ msg: 'Please enter all fields' });
    }
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }
    user = new User({ email, password });
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();
    
    const payload = { user: { id: user.id } };
    jwt.sign(payload, process.env.JWT_SECRET || 'your_jwt_secret', { expiresIn: 3600 }, (err, token) => {
      if (err) throw err;
      res.json({ token });
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ msg: 'Please enter all fields' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }
    
    const payload = { user: { id: user.id } };
    jwt.sign(payload, process.env.JWT_SECRET || 'your_jwt_secret', { expiresIn: '1d' }, (err, token) => {
      if (err) throw err;
      res.json({ token });
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// Chat initiate
app.post('/api/chat/initiate', async (req, res) => {
  try {
    const { keywords, userId } = req.body;
    
    const response = await axios.post(WEBHOOKS.NEWS_FINDER, { keywords });
    const newsContent = formatWebhookResponse(response.data);

    const newChat = new ChatSession({
      userId,
      title: `Research on: ${keywords}`,
      isProcessing: true,
      messages: [
        { role: 'user', content: keywords },
        { role: 'bot', content: newsContent, contentType: 'news' }
      ]
    });
    await newChat.save();

    res.json(newChat);
  } catch (error) {
    console.error('Chat initiate error:', error);
    res.status(500).json({ msg: 'Error fetching news insights', error: error.message });
  }
});

// Chat accept
app.post('/api/chat/accept', async (req, res) => {
  try {
    const { sessionId, lastMessageContent } = req.body;

    const response = await axios.post(WEBHOOKS.CONTENT_CREATION, { news: lastMessageContent });
    const postContent = formatWebhookResponse(response.data);

    const updatedChat = await ChatSession.findByIdAndUpdate(
      sessionId,
      { 
        $push: { 
          messages: { role: 'bot', content: postContent, contentType: 'linkedin' } 
        },
        isProcessing: false
      },
      { new: true }
    );
    res.json(updatedChat);

  } catch (error) {
    console.error('Chat accept error:', error);
    res.status(500).json({ msg: 'Error creating LinkedIn post', error: error.message });
  }
});

// Chat decline
app.post('/api/chat/decline', async (req, res) => {
  try {
    const { sessionId, feedback, lastMessage, messageId } = req.body;

    let webhookUrl;
    let payload;

    if (lastMessage.contentType === 'news') {
      webhookUrl = WEBHOOKS.NEWS_REJECTION;
      payload = { news: lastMessage.content, feedback };
    } else {
      webhookUrl = WEBHOOKS.LINKEDIN_REMAKING;
      payload = { post: lastMessage.content, feedback };
    }

    const response = await axios.post(webhookUrl, payload);
    const refinedContent = formatWebhookResponse(response.data);

    const chat = await ChatSession.findById(sessionId);
    const messageToUpdate = chat.messages.id(messageId);
    if (messageToUpdate) {
      messageToUpdate.feedback.isDeclined = true;
      messageToUpdate.feedback.text = feedback;
      messageToUpdate.feedback.refinedContent = refinedContent;
    }

    chat.messages.push({
      role: 'bot',
      content: refinedContent,
      contentType: lastMessage.contentType
    });
    
    await chat.save();
    res.json(chat);

  } catch (error) {
    console.error('Chat decline error:', error);
    res.status(500).json({ msg: 'Error processing feedback', error: error.message });
  }
});

// Serve HTML pages
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'register.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Catch-all handler
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

module.exports = app;