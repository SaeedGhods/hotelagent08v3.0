const axios = require('axios');

class ElevenLabsService {
  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY;
    this.baseURL = 'https://api.elevenlabs.io/v1';
    // Cache for instant common responses
    this.responseCache = new Map([
      ['hello', 'Hey there!'],
      ['hi', 'Hey there!'],
      ['how are you', 'I\'m doing great, thanks!'],
      ['goodbye', 'Talk to you later!'],
      ['bye', 'Talk to you later!'],
      ['thanks', 'You\'re welcome!'],
      ['thank you', 'You\'re welcome!']
    ]);
    // Store generated audio temporarily (in production, use Redis or similar)
    this.audioCache = new Map();
  }

  async generateSpeech(text, voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM') {
    try {
      // Check cache for instant common responses
      const lowerText = text.toLowerCase();
      for (const [phrase, response] of this.responseCache.entries()) {
        if (lowerText.includes(phrase)) {
          console.log('Using cached response for:', phrase);
          return await this._generateAudio(response, voiceId);
        }
      }

      console.log('Generating speech for:', text.substring(0, 50) + '...');
      return await this._generateAudio(text, voiceId);
    } catch (error) {
      console.error('ElevenLabs TTS Error:', error);
      return null;
    }
  }

  async _generateAudio(text, voiceId) {
    const response = await axios.post(`${this.baseURL}/text-to-speech/${voiceId}`, {
      text: text,
      model_id: 'eleven_monolingual_v1',
      output_format: 'mp3_22050_32'
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

    // Clean up expired audio
    this.cleanupExpiredAudio();

    return audioId;
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
