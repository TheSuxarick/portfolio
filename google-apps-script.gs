// Google Apps Script for Gemini Chatbot
// Deploy this as a Web App

// ===== CONFIGURATION =====
// Model selection - change here to test different models
// Fast models: gemini-2.0-flash-exp, gemini-1.5-flash-latest
// Slower but smarter: gemini-2.0-flash-thinking-exp-01-21
const PRIMARY_MODEL = 'gemini-2.0-flash-exp';
const FALLBACK_MODEL = 'gemini-1.5-flash-latest';

// Performance settings
const DISABLE_THINKING = true; // Set to false to enable thinking (slower but smarter)
const MAX_TOKENS = 500; // Limit response length for faster responses

// ===== API KEY ROTATION =====
// Add multiple API keys - will rotate through them if one fails
// Get keys from: https://aistudio.google.com/apikey
const API_KEYS = [
  'GEMINI_API_KEY',      // Main key (from Script Properties)
  'GEMINI_API_KEY_2',    // Backup key 1
  'GEMINI_API_KEY_3'     // Backup key 2
  // Add more as needed
];

// ===== RATE LIMITING CONFIGURATION =====
const ENABLE_RATE_LIMITING = true; // ⚠️ SET TO FALSE WHEN TESTING/DEVELOPING
const MAX_REQUESTS_PER_HOUR = 20; // Maximum requests per user per hour
const MAX_REQUESTS_PER_DAY = 100; // Maximum requests per user per day

// Whitelist - No rate limiting for these
const WHITELISTED_IPS = ['172.16.255.61']; // Your local IP - add more if needed
const ALLOW_LOCALHOST = true; // Bypass rate limit when accessing from localhost/127.0.0.1

// ===== END CONFIGURATION =====

function doPost(e) {
  // Initialize language early for error handling
  let language = 'en';
  
  try {
    // Check rate limit first
    if (ENABLE_RATE_LIMITING) {
      const rateLimitCheck = checkRateLimit(e);
      if (!rateLimitCheck.allowed) {
        return createResponse({
          success: false,
          error: rateLimitCheck.message
        });
      }
    }
    
    // Debug: Log what we received
    Logger.log('Received data type: ' + typeof e.postData);
    Logger.log('Has postData.contents: ' + (e.postData && e.postData.contents ? 'yes' : 'no'));
    Logger.log('Has parameter: ' + (e.parameter ? 'yes' : 'no'));
    
    // Handle both JSON and form data
    let userQuestion;
    let history = [];
    
    // Try form data first (most common with URL-encoded)
    if (e.parameter && e.parameter.question) {
      userQuestion = e.parameter.question;
      language = e.parameter.language || 'en';
      
      // Parse conversation history if provided
      if (e.parameter.history) {
        try {
          history = JSON.parse(e.parameter.history);
          Logger.log('Received conversation history: ' + history.length + ' messages');
        } catch (e) {
          Logger.log('Could not parse history: ' + e.toString());
        }
      }
      
      Logger.log('Using form data - question: ' + userQuestion);
    } 
    // Try JSON
    else if (e.postData && e.postData.contents) {
      try {
        const data = JSON.parse(e.postData.contents);
        userQuestion = data.question;
        language = data.language || 'en';
        history = data.history || [];
        Logger.log('Using JSON data - question: ' + userQuestion);
      } catch (parseError) {
        Logger.log('JSON parse error: ' + parseError.toString());
        return createResponse({
          success: false,
          error: 'Invalid JSON: ' + parseError.toString()
        });
      }
    } 
    // No data found
    else {
      Logger.log('No data found in request');
      return createResponse({
        success: false,
        error: 'No data received. postData: ' + (e.postData ? 'exists' : 'null') + ', parameter: ' + (e.parameter ? 'exists' : 'null')
      });
    }
    
    if (!userQuestion || userQuestion.trim() === '') {
      return createResponse({
        success: false,
        error: 'Question is required and cannot be empty'
      });
    }
    
    // Get API keys from Script Properties with rotation support
    const scriptProperties = PropertiesService.getScriptProperties();
    const availableApiKeys = [];
    
    API_KEYS.forEach(keyName => {
      const key = scriptProperties.getProperty(keyName);
      if (key) {
        availableApiKeys.push(key);
      }
    });
    
    if (availableApiKeys.length === 0) {
      return createResponse({
        success: false,
        error: language === 'en'
          ? 'API keys not configured. Please set API keys in Script Properties.'
          : 'API ключи не настроены. Пожалуйста, настройте ключи API.'
      });
    }
    
    Logger.log(`Found ${availableApiKeys.length} API key(s) available`);
    
    // Get knowledge base about you
    const knowledgeBase = getKnowledgeBase(language);
    
    // Build conversation context from history
    let conversationContext = '';
    if (history && history.length > 0) {
      conversationContext = '\n\nPrevious conversation:\n';
      history.forEach((msg, index) => {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        conversationContext += `${role}: ${msg.content}\n`;
      });
      conversationContext += '\n';
    }
    
    // Create prompt with context and conversation history
    const prompt = `${knowledgeBase}${conversationContext}User asks: ${userQuestion}\n\nAnswer in ${language === 'en' ? 'English' : 'Russian'}, be friendly and concise. Remember the conversation context if relevant:`;
    
    // Call Gemini API with retry logic and API key rotation
    const models = [PRIMARY_MODEL, FALLBACK_MODEL];
    let response = null;
    let lastError = null;
    let success = false;
    let apiKeyIndex = 0;
    let hit429 = false; // Track if we hit rate limit
    
    // Try each model with each API key
    for (let modelAttempt = 0; modelAttempt < models.length && !success; modelAttempt++) {
      const modelId = models[modelAttempt];
      
      // Try each API key for this model
      for (let keyAttempt = 0; keyAttempt < availableApiKeys.length && !success; keyAttempt++) {
        const apiKey = availableApiKeys[keyAttempt];
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
        
        // Optimized payload for speed
        const requestPayload = {
          contents: [{
            role: 'user',
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topP: 0.8,
            topK: 40,
            maxOutputTokens: MAX_TOKENS
          }
        };
        
        // Disable thinking for faster responses (Gemini 2.0+)
        if (DISABLE_THINKING && (modelId.includes('2.') || modelId.includes('3.'))) {
          requestPayload.generationConfig.thinkingConfig = {
            thinkingBudget: 0
          };
        }
        
        requestPayload.safetySettings = [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
        ];
        
        Logger.log(`Model ${modelAttempt + 1}/${models.length}, API Key ${keyAttempt + 1}/${availableApiKeys.length}: ${modelId}`);
        
        try {
          response = callGeminiWithRetry(apiUrl, requestPayload, 1); // Only 1 retry per key
          
          if (response) {
            Logger.log(`✅ Success with model ${modelId} using API key ${keyAttempt + 1}`);
            success = true;
          }
        } catch (error) {
          const errorMsg = error.toString();
          Logger.log(`❌ Failed: ${errorMsg.substring(0, 100)}`);
          
          // Check if it's a 429 error (rate limit)
          if (errorMsg.includes('429')) {
            hit429 = true;
            Logger.log(`Rate limit hit on API key ${keyAttempt + 1}, trying next key...`);
            // Don't wait, immediately try next key
            continue;
          }
          
          lastError = error;
          
          // Wait a bit before trying next key (but not for 429)
          if (keyAttempt < availableApiKeys.length - 1) {
            Utilities.sleep(500);
          }
        }
      }
      
      // Wait between models
      if (modelAttempt < models.length - 1 && !success) {
        Utilities.sleep(1000);
      }
    }
    
    if (!response || !success) {
      // Special error message for rate limits
      if (hit429) {
        throw new Error('RATE_LIMIT_EXCEEDED');
      }
      throw new Error('All models and API keys failed. Last error: ' + (lastError ? lastError.toString() : 'Unknown'));
    }
    
    // Parse the successful response
    const responseText = response.getContentText();
    Logger.log('Response text length: ' + responseText.length);
    
    const result = JSON.parse(responseText);
    Logger.log('Parsed result has candidates: ' + (result.candidates ? 'yes' : 'no'));
    
    if (result.candidates && result.candidates[0] && result.candidates[0].content) {
      const answer = result.candidates[0].content.parts[0].text;
      Logger.log('Successfully got answer, length: ' + answer.length);
      
      return createResponse({
        success: true,
        answer: answer
      });
    } else {
      Logger.log('No valid response from Gemini. Full result: ' + JSON.stringify(result).substring(0, 500));
      return createResponse({
        success: false,
        error: 'No response from Gemini API. Response: ' + JSON.stringify(result).substring(0, 200)
      });
    }
    
  } catch (error) {
    Logger.log('Error in doPost: ' + error.toString());
    Logger.log('Stack trace: ' + (error.stack || 'No stack trace'));
    
    // User-friendly error messages
    const errorMsg = error.toString();
    let userMessage = '';
    
    // Check for specific error types
    if (errorMsg.includes('RATE_LIMIT_EXCEEDED') || errorMsg.includes('429')) {
      userMessage = language === 'en' 
        ? '⚠️ API rate limit exceeded. Arsen has used up his free API quota. Please try again in a few hours.'
        : '⚠️ Превышен лимит API. Арсен израсходовал квоту бесплатного API. Пожалуйста, попробуйте через несколько часов.';
    } else if (errorMsg.includes('503') || errorMsg.includes('overloaded') || errorMsg.includes('UNAVAILABLE')) {
      userMessage = language === 'en' 
        ? 'The AI service is currently busy. Please try again in a moment.'
        : 'Сервис ИИ сейчас перегружен. Пожалуйста, попробуйте через минуту.';
    } else if (errorMsg.includes('timeout') || errorMsg.includes('Время ожидания') || errorMsg.includes('Timeout')) {
      userMessage = language === 'en'
        ? 'The request took too long. Please try again.'
        : 'Запрос занял слишком много времени. Пожалуйста, попробуйте еще раз.';
    } else if (errorMsg.includes('API key')) {
      userMessage = language === 'en'
        ? 'API configuration error. Please contact the administrator.'
        : 'Ошибка конфигурации API. Пожалуйста, свяжитесь с администратором.';
    } else {
      userMessage = language === 'en'
        ? 'Sorry, I encountered an error. Please try again later.'
        : 'Извините, произошла ошибка. Пожалуйста, попробуйте позже.';
    }
    
    return createResponse({
      success: false,
      error: userMessage
    });
  }
}

// Rate limiting function
function checkRateLimit(e) {
  try {
    // Check if user is whitelisted by IP
    const userIP = e.parameter?.userIP || '';
    if (WHITELISTED_IPS.includes(userIP)) {
      Logger.log('Whitelisted IP detected: ' + userIP + ' - bypassing rate limit');
      return { allowed: true, whitelisted: true };
    }
    
    // Check if accessing from localhost (dev mode)
    const referrer = e.parameter?.referrer || '';
    if (ALLOW_LOCALHOST && (referrer.includes('localhost') || referrer.includes('127.0.0.1'))) {
      Logger.log('Localhost/dev mode detected - bypassing rate limit');
      return { allowed: true, devMode: true };
    }
    
    // Get user identifier (combination of userId from parameter and IP-like fingerprint)
    const userId = e.parameter?.userId || e.parameter?.deviceId || 'anonymous';
    const userAgent = e.parameter?.userAgent || '';
    
    // Create unique identifier (combine userId with fingerprint)
    const userFingerprint = Utilities.computeDigest(
      Utilities.DigestAlgorithm.MD5,
      userId + userAgent
    ).map(byte => (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, '0')).join('');
    
    const cache = CacheService.getScriptCache();
    const now = new Date().getTime();
    const hourKey = `rate_hour_${userFingerprint}`;
    const dayKey = `rate_day_${userFingerprint}`;
    
    // Get current counts
    const hourData = cache.get(hourKey);
    const dayData = cache.get(dayKey);
    
    let hourCount = 0;
    let dayCount = 0;
    
    if (hourData) {
      const parsed = JSON.parse(hourData);
      hourCount = parsed.count;
    }
    
    if (dayData) {
      const parsed = JSON.parse(dayData);
      dayCount = parsed.count;
    }
    
    // Check limits
    if (hourCount >= MAX_REQUESTS_PER_HOUR) {
      const lang = e.parameter?.language || 'en';
      return {
        allowed: false,
        message: lang === 'en' 
          ? `Rate limit exceeded. Maximum ${MAX_REQUESTS_PER_HOUR} requests per hour. Please try again later.`
          : `Превышен лимит запросов. Максимум ${MAX_REQUESTS_PER_HOUR} запросов в час. Попробуйте позже.`
      };
    }
    
    if (dayCount >= MAX_REQUESTS_PER_DAY) {
      const lang = e.parameter?.language || 'en';
      return {
        allowed: false,
        message: lang === 'en'
          ? `Daily limit reached. Maximum ${MAX_REQUESTS_PER_DAY} requests per day. Please try again tomorrow.`
          : `Достигнут дневной лимит. Максимум ${MAX_REQUESTS_PER_DAY} запросов в день. Попробуйте завтра.`
      };
    }
    
    // Increment counters
    cache.put(hourKey, JSON.stringify({ count: hourCount + 1, timestamp: now }), 3600); // 1 hour
    cache.put(dayKey, JSON.stringify({ count: dayCount + 1, timestamp: now }), 86400); // 24 hours
    
    return { allowed: true };
    
  } catch (error) {
    Logger.log('Rate limit check error: ' + error.toString());
    // If rate limiting fails, allow the request (fail open)
    return { allowed: true };
  }
}

// Call Gemini API with retry logic (optimized for speed)
function callGeminiWithRetry(apiUrl, requestPayload, maxRetries) {
  let lastError = null;
  
  for (let retry = 0; retry < maxRetries; retry++) {
    try {
      const startTime = new Date().getTime();
      
      const response = UrlFetchApp.fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify(requestPayload),
        muteHttpExceptions: true,
        followRedirects: true
      });
      
      const endTime = new Date().getTime();
      const statusCode = response.getResponseCode();
      
      Logger.log(`Request took ${endTime - startTime}ms - Status: ${statusCode}`);
      
      if (statusCode === 200) {
        return response; // Success!
      } else if (statusCode === 429) {
        // Rate limit - DON'T retry, throw immediately so we can try next API key
        throw new Error(`Rate limit (429) - moving to next API key`);
      } else if (statusCode === 503) {
        // Service unavailable - retry with backoff
        const waitTime = Math.min(1000 * Math.pow(2, retry), 5000); // Max 5 seconds
        Logger.log(`Service unavailable (503), waiting ${waitTime}ms...`);
        
        if (retry < maxRetries - 1) {
          Utilities.sleep(waitTime);
          continue;
        } else {
          throw new Error(`Service unavailable after ${maxRetries} retries. Status: 503`);
        }
      } else {
        // Other error - don't retry
        const errorText = response.getContentText();
        Logger.log(`API error (${statusCode}): ${errorText.substring(0, 200)}`);
        throw new Error(`API error: ${statusCode}. ${errorText.substring(0, 200)}`);
      }
    } catch (error) {
      lastError = error;
      const errorMsg = error.toString();
      
      // If it's a 429, throw immediately
      if (errorMsg.includes('429') || errorMsg.includes('Rate limit')) {
        throw error;
      }
      
      // Check if it's a timeout or network error
      if (errorMsg.includes('timeout') || errorMsg.includes('Timeout')) {
        const waitTime = Math.min(1000 * Math.pow(2, retry), 5000);
        Logger.log(`Timeout error, waiting ${waitTime}ms...`);
        
        if (retry < maxRetries - 1) {
          Utilities.sleep(waitTime);
          continue;
        } else {
          throw new Error(`Request timeout after ${maxRetries} retries`);
        }
      } else {
        // Other error - throw immediately
        throw error;
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

// Handle CORS and create proper response
function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Also handle GET requests (for testing)
function doGet(e) {
  return createResponse({
    success: false,
    error: 'Please use POST method'
  });
}

function getKnowledgeBase(language) {
  if (language === 'ru') {
    return `
Ты - AI-ассистент Арсена Кенесбаева, инженера данных.

Информация об Арсене:
- Имя: Арсен Кенесбаев
- Профессия: Инженер данных (Data Engineer)
- Навыки: SQL, Python, Data Engineering, Machine Learning, Web Development, Android Development
- Расположение: Алматы, Казахстан
- Email: arsen801777@gmail.com
- LinkedIn: linkedin.com/in/arsen-kenesbayev
- GitHub: github.com/Skyshmallow

Основные проекты:
1. Movie Recommendation System - система рекомендации фильмов с контентной фильтрацией (TF-IDF + косинусное сходство), обработка 5000+ фильмов из TMDB
2. Online Bank Database - база данных в стиле Kaspi с нормализованными схемами, 30+ оптимизированных запросов
3. Qysqa - платформа для обучения с ИИ, создание тестов и оценка ответов
4. AI human tracking camera - камера с ИИ-отслеживанием человека и голосовым управлением
5. Fisherman App - Android приложение с голосовым поиском
6. Gesture control drawing - приложение для рисования жестами на основе ИИ
7. DFS Traversal Animation - интерактивный визуализатор алгоритма
8. Personal Portfolio Website - современный адаптивный веб-сайт портфолио

Технологии: Flask, Oracle APEX, Gemini API, OpenCV, MediaPipe, Android Studio, Scikit-learn, TF-IDF, Python, SQL, Java, HTML/CSS/JS

Отвечай дружелюбно, кратко и по делу. Если не знаешь ответа, честно скажи об этом.
    `;
  } else {
    return `
You are an AI assistant for Arsen Kenesbayev, a Data Engineer.

About Arsen:
- Name: Arsen Kenesbayev
- Profession: Data Engineer
- Skills: SQL, Python, Data Engineering, Machine Learning, Web Development, Android Development
- Location: Almaty, Kazakhstan
- Email: arsen801777@gmail.com
- LinkedIn: linkedin.com/in/arsen-kenesbayev
- GitHub: github.com/Skyshmallow

Key Projects:
1. Movie Recommendation System - movie recommender with content-based filtering (TF-IDF + cosine similarity), processed 5,000+ TMDB movies
2. Online Bank Database - Kaspi-style database with normalized schemas, 30+ optimized queries
3. Qysqa - AI learning platform that creates tests and evaluates answers
4. AI human tracking camera - camera with AI human tracking and voice control
5. Fisherman App - Android application with voice search
6. Gesture control drawing - AI-powered hand gesture drawing application
7. DFS Traversal Animation - interactive DFS visualizer
8. Personal Portfolio Website - modern responsive portfolio website

Technologies: Flask, Oracle APEX, Gemini API, OpenCV, MediaPipe, Android Studio, Scikit-learn, TF-IDF, Python, SQL, Java, HTML/CSS/JS

Be friendly, concise, and helpful. If you don't know something, say so honestly.
    `;
  }
}

// Test function (optional - for testing in the script editor)
function testChatbot() {
  const testData = {
    question: "What are your main skills?",
    language: "en"
  };
  
  const mockEvent = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };
  
  const result = doPost(mockEvent);
  Logger.log(result.getContent());
}

