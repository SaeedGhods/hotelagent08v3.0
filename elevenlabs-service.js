const axios = require('axios');

class ElevenLabsService {
  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY;
    this.baseURL = 'https://api.elevenlabs.io/v1';
    // Store generated audio temporarily (in production, use Redis or similar)
    this.audioCache = new Map();
    // Cache for common responses including greeting
    this.commonResponses = new Map();
    this.greetingAudioId = null;
  }

  async generateSpeech(text, voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM') {
    try {
      // Check for cached common responses
      const cacheKey = text.toLowerCase().trim();
      if (this.commonResponses.has(cacheKey)) {
        console.log('Using cached audio for:', cacheKey);
        return this.commonResponses.get(cacheKey);
      }

      console.log('Generating speech for:', text.substring(0, 50) + '...');

      const response = await axios.post(`${this.baseURL}/text-to-speech/${voiceId}`, {
        text: text,
        model_id: 'eleven_flash_v2',
        output_format: 'mp3_22050_32',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.0,
          use_speaker_boost: true
        }
      }, {
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        responseType: 'stream'
      });

      // Convert response stream to buffer
      const chunks = [];
      const stream = response.data;
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const audioBuffer = Buffer.concat(chunks);

      // Generate a unique ID for this audio
      const audioId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);

      // Store in cache with expiration (5 minutes)
      this.audioCache.set(audioId, {
        buffer: audioBuffer,
        timestamp: Date.now(),
        expiresAt: Date.now() + (5 * 60 * 1000) // 5 minutes
      });

      // Cache common responses permanently
      if (this.isCommonResponse(text)) {
        this.commonResponses.set(cacheKey, audioId);
      }

      // Clean up expired audio
      this.cleanupExpiredAudio();

      return audioId;
    } catch (error) {
      console.error('ElevenLabs TTS Error:', error);
      return null;
    }
  }

  // Pre-generate and cache the greeting and common error responses
  async initializeGreeting() {
    try {
      console.log('Pre-generating cached audio responses...');

      // Cache greeting
      const greetingText = 'Hello, this is Saeed. What would you like to talk about?';
      this.greetingAudioId = await this.generateSpeech(greetingText);

      // Pre-cache common error responses
      const errorResponses = [
        'I apologize, but I\'m having trouble generating audio right now. Please try again.',
        'I didn\'t catch that. Could you please repeat?',
        'Sorry, I didn\'t catch that. Could you say that again?'
      ];

      for (const errorText of errorResponses) {
        await this.generateSpeech(errorText);
      }

      // Make cached responses permanent (24 hours)
      for (const [audioId, data] of this.audioCache.entries()) {
        data.expiresAt = Date.now() + (24 * 60 * 60 * 1000);
      }

      console.log('Cached audio responses initialized successfully');
      return this.greetingAudioId;
    } catch (error) {
      console.error('Failed to initialize cached responses:', error);
      return null;
    }
  }

  getGreetingAudioId() {
    return this.greetingAudioId;
  }

  isCommonResponse(text) {
    const commonPhrases = [
      'hello, this is saeed. what would you like to talk about?',
      'i apologize, but i\'m having trouble generating audio right now. please try again.',
      'i didn\'t catch that. could you please repeat?',
      'sorry, i didn\'t catch that. could you say that again?'
    ];
    return commonPhrases.some(phrase =>
      text.toLowerCase().includes(phrase) || phrase.includes(text.toLowerCase())
    );
  }

  getAudio(audioId) {
    const audioData = this.audioCache.get(audioId);
    if (!audioData) return null;

    // Check if expired
    if (Date.now() > audioData.expiresAt) {
      this.audioCache.delete(audioId);
      return null;
    }

    return audioData.buffer;
  }

  cleanupExpiredAudio() {
    const now = Date.now();
    for (const [audioId, audioData] of this.audioCache.entries()) {
      if (now > audioData.expiresAt) {
        this.audioCache.delete(audioId);
      }
    }
  }
}

module.exports = new ElevenLabsService();
