// Chatbot functionality
// Replace YOUR_WEB_APP_URL with your Google Apps Script Web App URL

const CHATBOT_API_URL = 'https://script.google.com/macros/s/AKfycby4TG7mt8FCHo0q6V_jg0Tf-o4gyNAIZXJfGV7v-r7_g7HKJNoWWz75weSHsKOZxlkoHA/exec'

let currentLang = localStorage.getItem('preferredLanguage') || 'en';

// Conversation history storage
let conversationHistory = [];

// Generate persistent user ID for rate limiting
function generateUserId() {
    const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('userId', userId);
    return userId;
}

// Fetch and store user's public IP (for whitelist checking)
async function fetchUserIP() {
    try {
        // Only fetch if not already stored or if it's been more than 24 hours
        const lastFetch = localStorage.getItem('ipLastFetch');
        const now = Date.now();
        
        if (!lastFetch || now - parseInt(lastFetch) > 86400000) { // 24 hours
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            if (data.ip) {
                localStorage.setItem('userIP', data.ip);
                localStorage.setItem('ipLastFetch', now.toString());
                console.log('User public IP stored:', data.ip);
            }
        }
    } catch (error) {
        console.log('Could not fetch IP:', error);
        // Not critical, just means whitelist by IP won't work
    }
}

// Track AI chat in analytics
function trackAIChat(question, answer, responseTime) {
    // Check if analytics tracking function exists (from your main analytics code)
    if (typeof window.trackEvent === 'function') {
        window.trackEvent('ai_chat', {
            aiQuestion: question,
            aiAnswer: answer.substring(0, 1000), // Limit to 1000 chars
            aiResponseTime: responseTime
        });
        console.log('✅ AI Chat tracked:', question.substring(0, 50) + '...');
    } else {
        console.error('❌ Analytics tracking not available - window.trackEvent not found');
    }
}

// Initialize chatbot
function initChatbot() {
    // Fetch user's public IP for whitelist checking (non-blocking)
    fetchUserIP();
    
    // Initialize conversation with the welcome message
    const welcomeMessageEn = "Hello, I'm Arsen Kenesbayev\nData Engineer skilled in SQL & Python, passionate about turning data into smart, efficient, and user-friendly solutions.\nAsk my AI any questions about me.";
    const welcomeMessageRu = "Привет, я Арсен Кенесбаев\nИнженер данных, владеющий SQL и Python, увлеченный превращением данных в умные, эффективные и удобные решения.\nЗадайте моему ИИ любые вопросы обо мне.";
    
    // Add welcome message to history (if not already added)
    if (conversationHistory.length === 0) {
        conversationHistory.push({
            role: 'assistant',
            content: currentLang === 'en' ? welcomeMessageEn : welcomeMessageRu
        });
    }
    const chatbotInput = document.getElementById('chatbotInput');
    const chatbotInputRu = document.getElementById('chatbotInputRu');
    const chatbotSend = document.getElementById('chatbotSend');
    const chatbotMessages = document.getElementById('chatbotMessages');
    const chatbotLoading = document.getElementById('chatbotLoading');
    
    let currentInput = currentLang === 'en' ? chatbotInput : chatbotInputRu;
    
    // Update input reference when language changes
    function updateInputReference() {
        currentInput = currentLang === 'en' ? chatbotInput : chatbotInputRu;
        // Hide/show inputs based on language
        chatbotInput.style.display = currentLang === 'en' ? 'block' : 'none';
        chatbotInputRu.style.display = currentLang === 'ru' ? 'block' : 'none';
    }
    
    updateInputReference();
    
    // Toggle chatbot visibility
    const chatbotToggle = document.getElementById('chatbotToggle');
    const chatbotContainer = document.getElementById('chatbotContainer');
    const chatbotWrapper = chatbotContainer ? chatbotContainer.closest('.chatbot-wrapper') : null;
    
    if (chatbotToggle && chatbotContainer && chatbotWrapper) {
        chatbotToggle.addEventListener('click', function() {
            const isVisible = chatbotContainer.style.display !== 'none';
            chatbotContainer.style.display = isVisible ? 'none' : 'block';
            
            // Update wrapper class for styling
            if (isVisible) {
                chatbotWrapper.classList.remove('expanded');
            } else {
                chatbotWrapper.classList.add('expanded');
            }
            
            // Scroll to chatbot when opening
            if (!isVisible) {
                setTimeout(() => {
                    chatbotContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 100);
            }
        });
    }
    
    // Send message function
    function sendMessage() {
        const message = currentInput.value.trim();
        if (!message || chatbotSend.disabled) return;
        
        // Add user message to chat
        addMessage(message, 'user');
        
        // Clear input
        currentInput.value = '';
        
        // Disable send button and show loading
        chatbotSend.disabled = true;
        chatbotLoading.style.display = 'block';
        
        // Scroll to bottom
        scrollToBottom();
        
        // Track start time for analytics
        const startTime = Date.now();
        
        // Send to API with conversation history
        // Google Apps Script Web Apps handle CORS, but we need to use the right method
        // Using URL-encoded form data works better with Google Apps Script
        const formData = new URLSearchParams();
        formData.append('question', message);
        formData.append('language', currentLang);
        formData.append('history', JSON.stringify(conversationHistory));
        
        // Add device fingerprint for rate limiting
        const userId = localStorage.getItem('userId') || generateUserId();
        formData.append('userId', userId);
        formData.append('userAgent', navigator.userAgent);
        formData.append('referrer', window.location.href); // For localhost detection
        
        // Try to get public IP for whitelist (optional)
        const userIP = localStorage.getItem('userIP') || '';
        if (userIP) {
            formData.append('userIP', userIP);
        }
        
        fetch(CHATBOT_API_URL, {
            method: 'POST',
            mode: 'cors', // Explicitly set CORS mode
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString()
        })
        .then(response => {
            // Google Apps Script returns text, need to parse it
            return response.text();
        })
        .then(text => {
            // Parse JSON response
            try {
                const data = JSON.parse(text);
                return data;
            } catch (e) {
                // Sometimes Google Apps Script wraps the response
                // Try to extract JSON from the text
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                }
                throw new Error('Could not parse response: ' + text.substring(0, 100));
            }
        })
        .then(data => {
            chatbotLoading.style.display = 'none';
            chatbotSend.disabled = false;
            
            // Calculate response time
            const responseTime = Date.now() - startTime;
            
            // Debug logging
            console.log('Chatbot response:', data);
            
            if (data && data.success) {
                addMessage(data.answer, 'ai');
                
                // Track in analytics
                trackAIChat(message, data.answer, responseTime);
                
                // Add to conversation history
                conversationHistory.push(
                    { role: 'user', content: message },
                    { role: 'assistant', content: data.answer }
                );
                
                // Keep only last 10 exchanges (20 messages) to avoid token limits
                if (conversationHistory.length > 20) {
                    conversationHistory = conversationHistory.slice(-20);
                }
            } else {
                // Show user-friendly error message (already translated by backend)
                const errorMsg = data && data.error 
                    ? data.error 
                    : (currentLang === 'en' 
                        ? 'Sorry, I encountered an error. Please try again later.' 
                        : 'Извините, произошла ошибка. Пожалуйста, попробуйте позже.');
                
                addMessage(errorMsg, 'ai', true);
                console.error('Chatbot error:', data ? data.error : 'Unknown error', data);
            }
            
            scrollToBottom();
        })
        .catch(error => {
            chatbotLoading.style.display = 'none';
            chatbotSend.disabled = false;
            addMessage(
                currentLang === 'en' 
                    ? 'Sorry, I couldn\'t connect to the server. Please check your connection.' 
                    : 'Извините, не удалось подключиться к серверу. Проверьте подключение.',
                'ai',
                true
            );
            console.error('Chatbot fetch error:', error);
            scrollToBottom();
        });
    }
    
    // Add message to chat
    function addMessage(text, type, isError = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        
        if (isError) {
            messageDiv.style.opacity = '0.7';
        }
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        
        if (type === 'ai') {
            avatar.innerHTML = '<i class="fas fa-robot"></i>';
        } else {
            avatar.innerHTML = '<i class="fas fa-user"></i>';
        }
        
        const content = document.createElement('div');
        content.className = 'message-content';
        const p = document.createElement('p');
        p.textContent = text;
        content.appendChild(p);
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);
        
        chatbotMessages.appendChild(messageDiv);
        scrollToBottom();
    }
    
    // Scroll to bottom
    function scrollToBottom() {
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    }
    
    // Event listeners
    chatbotSend.addEventListener('click', sendMessage);
    
    chatbotInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    chatbotInputRu.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Update input when language changes
    const langToggle = document.getElementById('langToggle');
    if (langToggle) {
        const originalClick = langToggle.onclick;
        langToggle.addEventListener('click', function() {
            setTimeout(() => {
                currentLang = localStorage.getItem('preferredLanguage') || 'en';
                updateInputReference();
            }, 100);
        });
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatbot);
} else {
    initChatbot();
}

