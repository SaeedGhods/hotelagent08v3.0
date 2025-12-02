const axios = require('axios');

class XAIService {
  constructor() {
    this.apiKey = process.env.XAI_API_KEY;
    this.baseURL = 'https://api.x.ai/v1'; // This might need to be updated
    // Cache for similar responses to reduce API calls
    this.responseCache = new Map();
  }

  async generateResponse(message) {
    try {
      // Check cache for similar messages (simple keyword matching)
      const cacheKey = this.getCacheKey(message);
      if (cacheKey && this.responseCache.has(cacheKey)) {
        console.log('Using cached response for:', cacheKey);
        return this.responseCache.get(cacheKey);
      }

      const response = await axios.post(`${this.baseURL}/chat/completions`, {
        model: 'grok-3',
        messages: [
          {
            role: 'system',
            content: 'You are Saeed, a helpful and friendly AI assistant having a natural phone conversation. Respond naturally and warmly like a real person would. Be knowledgeable, engaging, and conversational on any topic. Keep responses natural and not robotic. Don\'t reintroduce yourself or mention being AI. Act like you\'re continuing an ongoing conversation and be ready to discuss anything the person wants to talk about.'
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 150,
        temperature: 0.7
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const aiResponse = response.data.choices[0].message.content;

      // Cache the response for similar future queries
      if (cacheKey) {
        this.responseCache.set(cacheKey, aiResponse);
        // Limit cache size to prevent memory issues
        if (this.responseCache.size > 50) {
          const firstKey = this.responseCache.keys().next().value;
          this.responseCache.delete(firstKey);
        }
      }

      return aiResponse;
    } catch (error) {
      console.error('xAI API Error:', error.response?.data || error.message);
      return 'I apologize, but I\'m having trouble processing your request right now. Please try again.';
    }
  }

  getCacheKey(message) {
    const lowerMessage = message.toLowerCase().trim();

    // Simple keyword-based caching for common patterns
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      return 'greeting';
    }
    if (lowerMessage.includes('how are you') || lowerMessage.includes('how do you do')) {
      return 'wellbeing';
    }
    if (lowerMessage.includes('thank') || lowerMessage.includes('thanks')) {
      return 'gratitude';
    }
    if (lowerMessage.includes('bye') || lowerMessage.includes('goodbye')) {
      return 'farewell';
    }

    return null; // Don't cache complex queries
  }

  // Placeholder for future voice integration
  async processVoice(audioData) {
    // This would handle direct audio input/output with xAI
    // For now, we'll transcribe and respond via text
    console.log('Voice processing not yet implemented. Received audio data length:', audioData?.length || 0);
    return 'Voice processing is not yet implemented. Please speak clearly for transcription.';
  }
}

module.exports = new XAIService();
