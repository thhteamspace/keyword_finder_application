const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');

// Connect to MongoDB
const dbURI = "mongodb+srv://Jitesh001:Jitesh001@twicky.fxotzly.mongodb.net/?retryWrites=true&w=majority";
mongoose.connect(dbURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
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

const ChatSession = mongoose.model('ChatSession', ChatSessionSchema);

const app = express();
app.use(express.json());

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

// Route to handle the initial user message
app.post('/initiate', async (req, res) => {
  const { keywords, userId } = req.body;
  
  try {
    const response = await axios.post(WEBHOOKS.NEWS_FINDER, { keywords });
    const newsContent = formatWebhookResponse(response.data);

    // Create and save the new chat session
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
    res.status(500).json({ msg: 'Error fetching news insights', error: error.message });
  }
});

// Route to handle accepting content
app.post('/accept', async (req, res) => {
  const { sessionId, lastMessageContent } = req.body;

  try {
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
    res.status(500).json({ msg: 'Error creating LinkedIn post', error: error.message });
  }
});

// Route to handle declining content and providing feedback
app.post('/decline', async (req, res) => {
  const { sessionId, feedback, lastMessage, messageId } = req.body;

  try {
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

    // Update the original message with feedback and add the new bot response
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
    res.status(500).json({ msg: 'Error processing feedback', error: error.message });
  }
});

module.exports = app;
