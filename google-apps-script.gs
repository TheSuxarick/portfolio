// Google Apps Script for Gemini Chatbot
// Deploy this as a Web App

// ===== CONFIGURATION =====
// Model selection - change here to test different models
// Fast models: gemini-2.5-flash, gemini-1.5-flash
// Slower but smarter: gemini-3-flash-preview, gemini-pro
const PRIMARY_MODEL = 'gemini-2.5-flash';
const FALLBACK_MODEL = 'gemini-1.5-flash';

// Performance settings
const DISABLE_THINKING = true; // Set to false to enable thinking (slower but smarter)
const MAX_TOKENS = 500; // Limit response length for faster responses

// ===== END CONFIGURATION =====

function doPost(e) {
  // Initialize language early for error handling
  let language = 'en';
  
  try {
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
    
    // Get your Gemini API key from Script Properties
    // To set it: File > Project Settings > Script Properties > Add "GEMINI_API_KEY"
    const API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    
    if (!API_KEY) {
      return createResponse({
        success: false,
        error: 'API key not configured. Please set GEMINI_API_KEY in Script Properties.'
      });
    }
    
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
    
    // Call Gemini API with retry logic
    const models = [PRIMARY_MODEL, FALLBACK_MODEL]; // Fast models first
    let response = null;
    let lastError = null;
    let success = false;
    
    for (let attempt = 0; attempt < models.length && !success; attempt++) {
      const modelId = models[attempt];
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${API_KEY}`;
      
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
          maxOutputTokens: MAX_TOKENS // Limit response length for speed
        }
      };
      
      // Disable thinking for faster responses (Gemini 2.5+)
      if (DISABLE_THINKING && (modelId.includes('2.5') || modelId.includes('3'))) {
        requestPayload.generationConfig.thinkingConfig = {
          thinkingBudget: 0 // Disable thinking for speed
        };
      }
      
      requestPayload.safetySettings = [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_NONE'
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_NONE'
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_NONE'
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_NONE'
        }
      ];
      
      Logger.log(`Attempt ${attempt + 1}: Calling Gemini API with model: ${modelId} (thinking: ${DISABLE_THINKING ? 'disabled' : 'enabled'})`);
      
      try {
        // Try with retries for this model (reduced to 2 retries for speed)
        response = callGeminiWithRetry(apiUrl, requestPayload, 2);
        
        if (response) {
          Logger.log(`Success with model: ${modelId}`);
          success = true; // Mark as successful to exit loop
        }
      } catch (error) {
        Logger.log(`Model ${modelId} failed: ${error.toString()}`);
        lastError = error;
        
        // Wait before trying next model (exponential backoff)
        if (attempt < models.length - 1) {
          Utilities.sleep(1000 * (attempt + 1)); // 1s, 2s, etc.
        }
      }
    }
    
    if (!response || !success) {
      throw new Error('All models failed. Last error: ' + (lastError ? lastError.toString() : 'Unknown'));
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
    
    if (errorMsg.includes('503') || errorMsg.includes('overloaded') || errorMsg.includes('UNAVAILABLE')) {
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

// Call Gemini API with retry logic (optimized for speed)
function callGeminiWithRetry(apiUrl, requestPayload, maxRetries) {
  let lastError = null;
  
  for (let retry = 0; retry < maxRetries; retry++) {
    try {
      Logger.log(`Retry ${retry + 1}/${maxRetries} for ${apiUrl}`);
      
      const startTime = new Date().getTime();
      
      const response = UrlFetchApp.fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify(requestPayload),
        muteHttpExceptions: true, // Don't throw on HTTP errors
        followRedirects: true
      });
      
      const endTime = new Date().getTime();
      Logger.log(`Request took ${endTime - startTime}ms`);
      
      const statusCode = response.getResponseCode();
      Logger.log(`Response status: ${statusCode}`);
      
      if (statusCode === 200) {
        return response; // Success!
      } else if (statusCode === 503 || statusCode === 429) {
        // Service unavailable or rate limited - retry with backoff
        const waitTime = Math.min(2000 * Math.pow(2, retry), 10000); // Max 10 seconds
        Logger.log(`Service unavailable (${statusCode}), waiting ${waitTime}ms before retry...`);
        
        if (retry < maxRetries - 1) {
          Utilities.sleep(waitTime);
          continue; // Retry
        } else {
          throw new Error(`Service unavailable after ${maxRetries} retries. Status: ${statusCode}`);
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
      
      // Check if it's a timeout or network error
      if (errorMsg.includes('timeout') || errorMsg.includes('Время ожидания') || errorMsg.includes('Timeout')) {
        const waitTime = Math.min(2000 * Math.pow(2, retry), 10000);
        Logger.log(`Timeout error, waiting ${waitTime}ms before retry...`);
        
        if (retry < maxRetries - 1) {
          Utilities.sleep(waitTime);
          continue; // Retry
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

