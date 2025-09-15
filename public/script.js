document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    if (path.includes('login.html')) {
        handleLoginPage();
    } else if (path.includes('register.html')) {
        handleRegisterPage();
    } else if (path === '/' || path.includes('index.html')) {
        if (!localStorage.getItem('token')) {
            window.location.href = '/login.html';
            return;
        }
        handleDashboardPage();
    }
});

// --- AUTHENTICATION LOGIC ---
function handleLoginPage() {
    const form = document.getElementById('loginForm');
    const authBtn = form.querySelector('.auth-btn');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = form.email.value;
        const password = form.password.value;
        authBtn.disabled = true;
        authBtn.style.opacity = '0.7';
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('token', data.token);
                window.location.href = '/';
            } else {
                alert(data.msg || 'Login failed');
            }
        } catch (err) {
            alert('An error occurred during login.');
        } finally {
            authBtn.disabled = false;
            authBtn.style.opacity = '1';
        }
    });
}

function handleRegisterPage() {
    const form = document.getElementById('registerForm');
    const authBtn = form.querySelector('.auth-btn');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = form.email.value;
        const password = form.password.value;
        authBtn.disabled = true;
        authBtn.style.opacity = '0.7';
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('token', data.token);
                window.location.href = '/';
            } else {
                alert(data.msg || 'Registration failed');
            }
        } catch (err) {
            alert('An error occurred during registration.');
        } finally {
            authBtn.disabled = false;
            authBtn.style.opacity = '1';
        }
    });
}

// --- DASHBOARD LOGIC ---
function handleDashboardPage() {
    let currentSessionId = null;
    let isProcessing = false;
    let declineInfo = { messageId: null, lastMessage: null };
    let messageStartTime = null;
    let linkedinPostContent = null; // Store the LinkedIn post content for copying
    let keywords = []; // Array to store keywords
    let currentKeywordIndex = 0; // Track current keyword index

    const chatMessages = document.getElementById('chatMessages');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const logoutBtn = document.getElementById('logoutBtn');
    const newChatBtn = document.getElementById('newChatBtn');
    const feedbackModal = document.getElementById('feedbackModal');
    const feedbackText = document.getElementById('feedbackText');
    const submitFeedbackBtn = document.getElementById('submitFeedbackBtn');
    const cancelFeedbackBtn = document.getElementById('cancelFeedbackBtn');
    const finalPostActions = document.getElementById('finalPostActions');
    const editButton = document.querySelector('.edit-btn'); // Reference existing edit button in input-container

    // Add hover/focus animations
    sendButton.addEventListener('mouseenter', () => {
        if (!sendButton.disabled) {
            sendButton.style.transform = 'translateY(-2px)';
            sendButton.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.4)';
        }
    });
    sendButton.addEventListener('mouseleave', () => {
        sendButton.style.transform = 'translateY(0)';
        sendButton.style.boxShadow = 'none';
    });
    messageInput.addEventListener('focus', () => {
        messageInput.style.boxShadow = '0 0 8px rgba(34, 197, 94, 0.3)';
    });
    messageInput.addEventListener('blur', () => {
        messageInput.style.boxShadow = 'none';
    });

    // Edit button functionality
    editButton.addEventListener('click', () => {
        isProcessing = false; // Stop processing
        messageInput.disabled = false; // Enable input
        sendButton.disabled = false; // Enable send button
        messageInput.placeholder = 'Edit keywords or start a new chat...';
        messageInput.value = keywords.join(', '); // Populate with current keywords
        messageInput.focus();
        editButton.style.display = 'none'; // Hide edit button
        showTypingIndicator(false); // Remove typing indicator if present
    });

    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = '/login.html';
    });
    newChatBtn.addEventListener('click', () => {
        currentSessionId = null;
        isProcessing = false;
        linkedinPostContent = null;
        keywords = [];
        currentKeywordIndex = 0;
        chatMessages.innerHTML = `
            <div class="welcome-screen" style="opacity: 0; transform: translateY(12px); animation: fadeIn 0.4s ease-in-out forwards;">
                <h1>New Chat</h1>
                <p>Enter keywords to start your research.</p>
            </div>`;
        messageInput.disabled = false;
        messageInput.placeholder = "Enter keywords for business insights...";
        editButton.style.display = 'none';
    });
    submitFeedbackBtn.addEventListener('click', submitFeedback);
    cancelFeedbackBtn.addEventListener('click', closeFeedbackModal);

    // --- Typing Indicator ---
    function showTypingIndicator(show = true) {
        let typingDiv = document.getElementById('typingIndicator');
        if (show) {
            if (!typingDiv) {
                typingDiv = document.createElement('div');
                typingDiv.id = 'typingIndicator';
                typingDiv.className = 'message bot typing';
                typingDiv.innerHTML = `
                    <div class="circular-loader"></div>
                    <span>Generating insights...</span>`;
                chatMessages.appendChild(typingDiv);
                typingDiv.style.opacity = '0';
                typingDiv.style.transform = 'translateY(12px)';
                setTimeout(() => {
                    typingDiv.style.opacity = '1';
                    typingDiv.style.transform = 'translateY(0)';
                    typingDiv.style.transition = 'opacity 0.4s ease-in-out, transform 0.4s ease-in-out';
                }, 50);
                scrollToBottom();
            }
        } else if (typingDiv) {
            typingDiv.style.opacity = '0';
            typingDiv.style.transform = 'translateY(12px)';
            setTimeout(() => typingDiv.remove(), 400);
        }
    }

    async function sendMessage() {
        const messageText = messageInput.value.trim();
        if (!messageText || isProcessing) return;

        if (!currentSessionId) {
            chatMessages.innerHTML = '';
            addMessage('user', messageText);
            messageInput.value = '';
            setProcessingState(true, 'Finding initial insights...');
            messageStartTime = new Date();
            showTypingIndicator(true);

            // Process keywords
            keywords = messageText.split(',').map(k => k.trim()).filter(k => k);
            currentKeywordIndex = 0;

            try {
                const res = await fetch('/api/chat/initiate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ keywords: keywords[currentKeywordIndex], userId: "60c72b2f9b1d8c001f8e4c1a" })
                });
                const data = await res.json();
                if (res.ok) {
                    currentSessionId = data._id;
                    showTypingIndicator(false);
                    renderChat(data);
                    // Show edit button for 2 minutes
                    editButton.style.display = 'block';
                    editButton.style.opacity = '0';
                    editButton.style.transform = 'translateY(12px)';
                    setTimeout(() => {
                        editButton.style.opacity = '1';
                        editButton.style.transform = 'translateY(0)';
                        editButton.style.transition = 'opacity 0.4s ease-in-out, transform 0.4s ease-in-out';
                    }, 50);
                    setTimeout(() => {
                        editButton.style.opacity = '0';
                        editButton.style.transform = 'translateY(12px)';
                        setTimeout(() => editButton.style.display = 'none', 400);
                    }, 120000); // 2 minutes
                } else {
                    showTypingIndicator(false);
                    addMessage('system', `Error: ${data.msg}`);
                }
            } catch (err) {
                showTypingIndicator(false);
                addMessage('system', 'A server error occurred.');
            } finally {
                setProcessingState(false);
            }
        }
    }

    function renderChat(sessionData) {
        chatMessages.innerHTML = '';
        sessionData.messages.forEach(msg => {
            addMessage(msg.role, msg.content, msg.contentType, msg._id);
        });
        isProcessing = sessionData.isProcessing;
        setProcessingState(isProcessing);
        addResponseTime();
    }

    function addMessage(role, content, contentType = null, messageId = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        messageDiv.style.opacity = '0';
        messageDiv.style.transform = 'translateY(12px)';
        let formattedContent = content.replace(/\n/g, '<br>');

        if (contentType === 'news') {
            messageDiv.innerHTML = `
                <div class="news-content">
                    <div class="content-label">RESEARCH INSIGHTS</div>
                    <div>${formattedContent}</div>
                </div>`;
        } else if (contentType === 'linkedin') {
            messageDiv.innerHTML = `
                <div class="linkedin-content">
                    <div class="content-label">PROFESSIONAL POST</div>
                    <div>${formattedContent}</div>
                </div>`;
            linkedinPostContent = content; // Store the content for copying
        } else {
            messageDiv.innerHTML = formattedContent;
        }

        // Action buttons
        if (role === 'bot' && contentType && isProcessing) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'action-buttons';
            if (contentType === 'news') {
                actionsDiv.innerHTML = `
                    <button class="action-btn accept-btn">Accept</button>
                    <button class="action-btn decline-btn">Decline</button>
                `;
                actionsDiv.querySelector('.accept-btn').onclick = () => handleAccept(content, contentType, actionsDiv);
                actionsDiv.querySelector('.decline-btn').onclick = () => handleDecline(messageId, { content, contentType });
            } else if (contentType === 'linkedin') {
                actionsDiv.innerHTML = `
                    <button class="action-btn copy-btn">Copy</button>
                `;
                const copyBtn = actionsDiv.querySelector('.copy-btn');
                copyBtn.onclick = () => handleCopy(content, actionsDiv);
            }
            messageDiv.appendChild(actionsDiv);
        }

        // Add placeholder for timestamp if bot
        if (role === 'bot') {
            const timeDiv = document.createElement('div');
            timeDiv.className = 'message-time';
            timeDiv.innerText = 'Response: Calculating...';
            messageDiv.appendChild(timeDiv);
        }

        chatMessages.appendChild(messageDiv);
        setTimeout(() => {
            messageDiv.style.opacity = '1';
            messageDiv.style.transform = 'translateY(0)';
            messageDiv.style.transition = 'opacity 0.4s ease-in-out, transform 0.4s ease-in-out';
        }, 50);
        scrollToBottom();
    }

    function getResponseTime() {
        if (!messageStartTime) return '0';
        const diff = Math.floor((new Date() - messageStartTime) / 1000);
        return diff;
    }

    function addResponseTime() {
        const botMessages = chatMessages.querySelectorAll('.message.bot');
        if (botMessages.length) {
            const lastBot = botMessages[botMessages.length - 1];
            const timeDiv = lastBot.querySelector('.message-time');
            if (timeDiv) {
                timeDiv.innerText = `Response: ${getResponseTime()} sec`;
            }
        }
    }

    // --- Handle Accept/Decline and Feedback ---
    async function handleAccept(content, contentType, actionsDiv) {
        if (contentType !== 'news' && contentType !== 'linkedin') return;
        if (actionsDiv) {
            actionsDiv.style.opacity = '0';
            setTimeout(() => actionsDiv.remove(), 400); // Remove buttons after Accept
        }

        const systemMessage = contentType === 'news'
            ? 'Insights accepted. Generating post...'
            : 'LinkedIn post accepted.';

        setProcessingState(true, systemMessage);
        addMessage('system', systemMessage);
        messageStartTime = new Date();

        try {
            const res = await fetch('/api/chat/accept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: currentSessionId,
                    lastMessageContent: content,
                    type: contentType
                })
            });
            const data = await res.json();
            if (res.ok) {
                renderChat(data);
            }
        } catch (err) {
            addMessage('system', 'A server error occurred.');
        } finally {
            setProcessingState(false);
            addResponseTime();
        }
    }

    function handleCopy(content, actionsDiv) {
        navigator.clipboard.writeText(content).then(() => {
            const copyBtn = event.target;
            copyBtn.innerText = 'Copied!';
            copyBtn.style.background = '#16a34a';
            copyBtn.style.transform = 'translateY(-2px)';
            setTimeout(() => {
                copyBtn.innerText = 'Copy';
                copyBtn.style.background = 'var(--glass-bg)';
                copyBtn.style.transform = 'translateY(0)';
            }, 2000);
            // Remove action buttons
            if (actionsDiv) {
                actionsDiv.style.opacity = '0';
                setTimeout(() => actionsDiv.remove(), 400);
            }
            // Move to next keyword or enable input
            if (currentKeywordIndex < keywords.length - 1) {
                currentKeywordIndex++;
                setProcessingState(true, 'Processing next keyword...');
                setTimeout(() => sendMessage(), 1000); // Start next keyword
            } else {
                setProcessingState(false, 'Enter new keywords to continue...');
                messageInput.disabled = false;
                sendButton.disabled = false;
                messageInput.placeholder = 'Enter new keywords to continue...';
                editButton.style.display = 'none';
            }
        }).catch(err => {
            console.error('Failed to copy: ', err);
            alert('Copy failed. Please copy manually.');
        });
    }

    function handleDecline(messageId, lastMessage) {
        declineInfo = { messageId, lastMessage };
        feedbackModal.style.display = 'flex';
        feedbackModal.style.opacity = '0';
        feedbackModal.style.transform = 'scale(0.95)';
        setTimeout(() => {
            feedbackModal.style.opacity = '1';
            feedbackModal.style.transform = 'scale(1)';
            feedbackModal.style.transition = 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out';
        }, 50);
        feedbackText.focus();
    }

    async function submitFeedback() {
        const feedback = feedbackText.value.trim();
        if (!feedback) return alert('Feedback cannot be empty.');
        closeFeedbackModal();
        setProcessingState(true, 'Refining content based on feedback...');
        addMessage('system', 'Feedback submitted. Refining content...');
        messageStartTime = new Date();

        try {
            const res = await fetch('/api/chat/decline', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: currentSessionId,
                    feedback: feedback,
                    lastMessage: declineInfo.lastMessage,
                    messageId: declineInfo.messageId
                })
            });
            const data = await res.json();
            if (res.ok) renderChat(data);
            else addMessage('system', `Error: ${data.msg}`);
        } catch (err) {
            addMessage('system', 'A server error occurred.');
        } finally {
            setProcessingState(false);
            addResponseTime();
        }
    }

    function closeFeedbackModal() {
        feedbackModal.style.opacity = '0';
        feedbackModal.style.transform = 'scale(0.95)';
        setTimeout(() => {
            feedbackModal.style.display = 'none';
            feedbackText.value = '';
        }, 300);
    }

    function setProcessingState(processing, placeholderText = '') {
        isProcessing = processing;
        messageInput.disabled = isProcessing;
        sendButton.disabled = isProcessing;
        messageInput.placeholder = placeholderText || (currentSessionId ? 'This chat is complete. Start a new chat.' : 'Enter keywords for business insights...');
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}