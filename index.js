const express = require('express');
const twilio = require('twilio');
const xaiService = require('./xai-service');
const elevenlabsService = require('./elevenlabs-service');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize cached greeting on startup
async function initializeServices() {
  await elevenlabsService.initializeGreeting();
}

initializeServices();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Basic health check
app.get('/', (req, res) => {
  res.send('AI Voice Agent is running!');
});

// TwiML endpoint for handling incoming calls
app.post('/voice', async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  try {
    // Use pre-cached greeting audio for instant response
    const greetingAudioId = elevenlabsService.getGreetingAudioId();
    if (greetingAudioId) {
      const greetingUrl = `${req.protocol}://${req.get('host')}/audio/${greetingAudioId}`;
      twiml.play(greetingUrl);
    } else {
      // Fallback to Twilio TTS if greeting not cached
      twiml.say('Hello, this is Saeed. What would you like to talk about?');
    }

    // Gather speech input naturally with optimized timing for faster response
    console.log('Initial call setup - creating gather for first speech input');
    const gather = twiml.gather({
      input: 'speech',
      action: '/process-speech',
      timeout: 5, // Increased to 5 seconds for better user experience
      speechTimeout: 'auto',
      speechModel: 'default' // Changed to default for stability
    });

    // No additional prompts needed - keep it natural

    // If no speech detected, end call naturally
    twiml.hangup();

  } catch (error) {
    console.error('Error in voice endpoint:', error);
    // Fallback - keep it friendly
    twiml.say('Hello, this is Saeed. What would you like to talk about?');
    const gather = twiml.gather({
      input: 'speech',
      action: '/process-speech',
      timeout: 3,
      speechTimeout: 'auto',
      speechModel: 'experimental_conversations'
    });
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

// Process speech input with xAI and ElevenLabs
app.post('/process-speech', async (req, res) => {
  const speechResult = req.body.SpeechResult;
  console.log('Speech received:', speechResult);

  const twiml = new twilio.twiml.VoiceResponse();

  try {
    let audioUrl = null;
    console.log('Processing speech result, length:', speechResult ? speechResult.length : 0);

    if (speechResult) {
      // Start xAI response generation (async)
      const aiResponsePromise = xaiService.generateResponse(speechResult);

      // Wait for AI response
      const aiResponse = await aiResponsePromise;

      if (aiResponse) {
        // Generate audio with ElevenLabs (parallel processing already optimized)
        const audioId = await elevenlabsService.generateSpeech(aiResponse);
        if (audioId) {
          audioUrl = `${req.protocol}://${req.get('host')}/audio/${audioId}`;
        }
      }
    } else {
      console.log('No speech result received - gather timeout or silence detected');
    }

    if (audioUrl) {
      console.log('Playing ElevenLabs audio:', audioUrl);
      // Play the ElevenLabs audio
      twiml.play(audioUrl);
    } else {
      console.log('ElevenLabs failed, using Twilio TTS fallback');
      // Fallback to Twilio TTS if ElevenLabs fails
      const fallbackText = speechResult ?
        'I apologize, but I\'m having trouble generating audio right now. Please try again.' :
        'I didn\'t catch that. Could you please repeat?';
      twiml.say(fallbackText);
    }

    // Continue the conversation naturally - gather speech input immediately after audio
    console.log('Creating gather for continued conversation');
    const gather = twiml.gather({
      input: 'speech',
      action: '/process-speech',
      timeout: 5, // Increased from 3 to 5 seconds for better user experience
      speechTimeout: 'auto',
      speechModel: 'default' // Changed from experimental_conversations to default for stability
    });

    // Keep conversation natural - no prompts needed
    console.log('TwiML response prepared, sending back to Twilio');

  } catch (error) {
    console.error('Error processing speech:', error);
    // Keep error message friendly
    const errorAudioId = await elevenlabsService.generateSpeech('Sorry, I didn\'t catch that. Could you say that again?');
    if (errorAudioId) {
      const errorUrl = `${req.protocol}://${req.get('host')}/audio/${errorAudioId}`;
      twiml.play(errorUrl);
    } else {
      twiml.say('Sorry, I didn\'t catch that. Could you say that again?');
    }

    const gather = twiml.gather({
      input: 'speech',
      action: '/process-speech',
      timeout: 5,
      speechTimeout: 'auto',
      speechModel: 'default'
    });
  }

  // No formal goodbye - let conversations end naturally

  res.type('text/xml');
  res.send(twiml.toString());
});

// Serve generated audio files
app.get('/audio/:audioId', (req, res) => {
  const audioId = req.params.audioId;
  const audioBuffer = elevenlabsService.getAudio(audioId);

  if (!audioBuffer) {
    return res.status(404).send('Audio not found or expired');
  }

  res.set({
    'Content-Type': 'audio/mpeg',
    'Content-Length': audioBuffer.length,
    'Cache-Control': 'no-cache'
  });

  res.send(audioBuffer);
});

app.listen(port, () => {
  console.log(`AI Voice Agent listening on port ${port}`);
});
