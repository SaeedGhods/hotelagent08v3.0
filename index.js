const express = require('express');
const twilio = require('twilio');
const xaiService = require('./xai-service');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Basic health check
app.get('/', (req, res) => {
  res.send('AI Voice Agent is running!');
});

// TwiML endpoint for handling incoming calls
app.post('/voice', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  // Connect to xAI voice agent
  twiml.say('Hello! Connecting you to our AI assistant...');

  // For now, we'll use a simple gathering to collect speech
  const gather = twiml.gather({
    input: 'speech',
    action: '/process-speech',
    timeout: 3,
    speechTimeout: 'auto'
  });

  gather.say('Please speak your message after the beep.');

  // If no speech detected, end call
  twiml.say('We didn\'t hear anything. Goodbye!');
  twiml.hangup();

  res.type('text/xml');
  res.send(twiml.toString());
});

// Process speech input with xAI
app.post('/process-speech', async (req, res) => {
  const speechResult = req.body.SpeechResult;
  console.log('Speech received:', speechResult);

  const twiml = new twilio.twiml.VoiceResponse();

  try {
    if (speechResult) {
      // Get AI response from xAI
      const aiResponse = await xaiService.generateResponse(speechResult);

      // Speak the AI response
      twiml.say(aiResponse);
    } else {
      twiml.say('I didn\'t catch that. Could you please repeat?');
    }

    // Continue the conversation
    const gather = twiml.gather({
      input: 'speech',
      action: '/process-speech',
      timeout: 3,
      speechTimeout: 'auto'
    });

    gather.say('What else can I help you with?');

  } catch (error) {
    console.error('Error processing speech:', error);
    twiml.say('I apologize, but I\'m having technical difficulties. Please try calling back later.');
  }

  twiml.say('Thank you for calling. Goodbye!');
  twiml.hangup();

  res.type('text/xml');
  res.send(twiml.toString());
});

app.listen(port, () => {
  console.log(`AI Voice Agent listening on port ${port}`);
});
