// AI Chatbot using Web LLM with Phi-3.5-mini
import { CreateMLCEngine } from "https://esm.run/@mlc-ai/web-llm";

// DOM Elements
let chatMessages = null;
let chatInput = null;
let sendButton = null;
let clearChatButton = null;
let loadingScreen = null;
let loadingProgressFill = null;
let loadingStatus = null;
let typingIndicator = null;
let examplePrompts = null;

// AI Model
let engine = null;
let conversationHistory = [];

// Configuration
const CONFIG = {
    MODEL_NAME: 'gemma-2b-it-q4f32_1-MLC-1k',
    MAX_TOKENS: 200,
    TEMPERATURE: 0.7,
    TOP_P: 0.95,
    MAX_HISTORY: 6 // Keep last 6 messages for context
};

// Initialize the chatbot
async function init() {
    // Get DOM elements
    chatMessages = document.getElementById('chat-messages');
    chatInput = document.getElementById('chat-input');
    sendButton = document.getElementById('send-button');
    clearChatButton = document.getElementById('clear-chat');
    loadingScreen = document.getElementById('loading-screen');
    loadingProgressFill = document.getElementById('loading-progress-fill');
    loadingStatus = document.getElementById('loading-status');
    typingIndicator = document.getElementById('typing-indicator');
    examplePrompts = document.getElementById('example-prompts');

    // Add event listeners
    sendButton.addEventListener('click', handleSendMessage);
    clearChatButton.addEventListener('click', handleClearChat);
    chatInput.addEventListener('input', handleInputChange);
    chatInput.addEventListener('keydown', handleKeyDown);

    // Example prompt buttons
    document.querySelectorAll('.example-prompt').forEach(button => {
        button.addEventListener('click', (e) => {
            const prompt = e.target.dataset.prompt;
            chatInput.value = prompt;
            handleInputChange();
            handleSendMessage();
        });
    });

    // Load AI model
    await loadModel();
}

// Load the AI model
async function loadModel() {
    try {
        // Check WebGPU support
        if (!navigator.gpu) {
            throw new Error('WebGPU is not supported in this browser. Please use Chrome/Edge 113+ or Opera.');
        }

        updateLoadingStatus('Initializing WebGPU...', 5);

        // Create engine with progress callback
        engine = await CreateMLCEngine(CONFIG.MODEL_NAME, {
            initProgressCallback: (progress) => {
                console.log('Progress:', progress);

                // Update loading UI based on progress
                if (progress.progress !== undefined) {
                    const percentage = Math.round(progress.progress * 100);
                    updateLoadingStatus(progress.text || 'Loading...', percentage);
                } else if (progress.text) {
                    // Handle text-only progress updates
                    if (progress.text.includes('Loading model')) {
                        updateLoadingStatus(progress.text, 30);
                    } else if (progress.text.includes('Compiling')) {
                        updateLoadingStatus(progress.text, 60);
                    } else if (progress.text.includes('Initializing')) {
                        updateLoadingStatus(progress.text, 80);
                    } else {
                        updateLoadingStatus(progress.text, 50);
                    }
                }
            }
        });

        updateLoadingStatus('Model ready!', 100);

        // Hide loading screen after a short delay
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
            chatInput.focus();
        }, 500);

        console.log('Gemma-2b loaded successfully');
    } catch (error) {
        console.error('Error loading model:', error);

        let errorMessage = 'Error loading model. ';
        if (error.message && error.message.includes('WebGPU')) {
            errorMessage += 'WebGPU is not supported in your browser. Please use Chrome 113+, Edge 113+, or Opera.';
        } else {
            errorMessage += 'Please refresh the page and try again.';
        }

        updateLoadingStatus(errorMessage, 0);

        // Show error message in chat
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
            addBotMessage(errorMessage);
        }, 1000);
    }
}

// Update loading status
function updateLoadingStatus(message, progress) {
    if (loadingStatus) {
        loadingStatus.textContent = message;
    }
    if (loadingProgressFill) {
        loadingProgressFill.style.width = `${progress}%`;
    }
}

// Handle input changes
function handleInputChange() {
    const value = chatInput.value.trim();
    sendButton.disabled = value.length === 0 || !engine;

    // Auto-resize textarea
    chatInput.style.height = 'auto';
    chatInput.style.height = chatInput.scrollHeight + 'px';
}

// Handle keyboard input
function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendButton.disabled) {
            handleSendMessage();
        }
    }
}

// Handle sending a message
async function handleSendMessage() {
    const message = chatInput.value.trim();
    if (!message || !engine) return;

    // Add user message to chat
    addUserMessage(message);

    // Clear input
    chatInput.value = '';
    handleInputChange();

    // Hide example prompts after first message
    if (examplePrompts) {
        examplePrompts.classList.add('hidden');
    }

    // Show typing indicator
    showTypingIndicator(true);

    // Disable input while generating
    chatInput.disabled = true;
    sendButton.disabled = true;

    try {
        // Add message to conversation history
        conversationHistory.push({
            role: 'user',
            content: message
        });

        // Keep only last N messages for context
        if (conversationHistory.length > CONFIG.MAX_HISTORY) {
            conversationHistory = conversationHistory.slice(-CONFIG.MAX_HISTORY);
        }

        // Build messages array with system prompt
        const messages = [
            {
                role: 'system',
                content: 'You are a helpful, friendly AI assistant. Provide concise, accurate, and conversational responses.'
            },
            ...conversationHistory
        ];

        // Generate response using OpenAI-compatible API
        const response = await engine.chat.completions.create({
            messages: messages,
            max_tokens: CONFIG.MAX_TOKENS,
            temperature: CONFIG.TEMPERATURE,
            top_p: CONFIG.TOP_P
        });

        // Extract response
        const botMessage = response.choices[0].message.content.trim();

        // Add to conversation history
        conversationHistory.push({
            role: 'assistant',
            content: botMessage
        });

        // Display response
        addBotMessage(botMessage);

    } catch (error) {
        console.error('Error generating response:', error);
        addBotMessage('Sorry, I encountered an error generating a response. Please try again.');
    } finally {
        // Hide typing indicator
        showTypingIndicator(false);

        // Re-enable input
        chatInput.disabled = false;
        sendButton.disabled = false;
        chatInput.focus();
    }
}

// Add user message to chat
function addUserMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user-message';
    messageDiv.innerHTML = `
        <div class="message-content">
            <p>${escapeHtml(message)}</p>
        </div>
    `;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

// Add bot message to chat
function addBotMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message';
    messageDiv.innerHTML = `
        <div class="message-content">
            <p>${escapeHtml(message)}</p>
        </div>
    `;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

// Show/hide typing indicator
function showTypingIndicator(show) {
    if (typingIndicator) {
        typingIndicator.style.display = show ? 'flex' : 'none';
        if (show) {
            scrollToBottom();
        }
    }
}

// Clear chat history
function handleClearChat() {
    if (confirm('Are you sure you want to clear the chat history?')) {
        // Keep only the welcome message
        const welcomeMessage = chatMessages.querySelector('.message.bot-message');
        chatMessages.innerHTML = '';
        if (welcomeMessage) {
            chatMessages.appendChild(welcomeMessage);
        }

        // Clear conversation history
        conversationHistory = [];

        // Show example prompts again
        if (examplePrompts) {
            examplePrompts.classList.remove('hidden');
        }

        console.log('Chat history cleared');
    }
}

// Scroll chat to bottom
function scrollToBottom() {
    if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
