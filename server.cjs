const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// VPS DEPLOYMENT: Serve static files from 'dist' directory
app.use(express.static(path.join(__dirname, 'dist')));

app.post('/translate', async (req, res) => {
    const { text, targetLang } = req.body;
    if (!text || !targetLang) {
        return res.status(400).json({ error: 'Missing text or targetLang' });
    }
    try {
        const { translate } = await import('@vitalets/google-translate-api');
        const result = await translate(text, { to: targetLang });
        res.json({ translatedText: result.text });
    } catch (error) {
        console.error('Translation error:', error);
        res.status(500).json({ error: 'Translation failed', details: error.message });
    }
});

// DEBUG ENDPOINT: Screenshot
app.get('/debug/screenshot/:accountId', async (req, res) => {
    const { accountId } = req.params;
    if (!sessions.has(accountId)) return res.status(404).send('Session not found');
    
    const client = sessions.get(accountId);
    const page = await getPage(client);
    
    if (!page) return res.status(500).send('No Puppeteer page found');
    
    try {
        const screenshot = await page.screenshot({ encoding: 'binary' });
        res.setHeader('Content-Type', 'image/png');
        res.send(screenshot);
    } catch (e) {
        res.status(500).send('Error taking screenshot: ' + e.message);
    }
});

// DEBUG ENDPOINT: HTML Dump
app.get('/debug/html/:accountId', async (req, res) => {
    const { accountId } = req.params;
    if (!sessions.has(accountId)) return res.status(404).send('Session not found');
    
    const client = sessions.get(accountId);
    const page = await getPage(client);
    
    if (!page) return res.status(500).send('No Puppeteer page found');
    
    try {
        const content = await page.content();
        res.setHeader('Content-Type', 'text/html');
        res.send(content);
    } catch (e) {
        res.status(500).send('Error getting content: ' + e.message);
    }
});



const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Map to store clients: accountId -> Client instance
const sessions = new Map();

// Helper to format chats for frontend
const formatChats = (chats) => {
  return chats.map(chat => ({
    id: chat.id._serialized,
    name: chat.name || chat.id.user,
    message: chat.lastMessage ? chat.lastMessage.body : '',
    time: chat.lastMessage ? new Date(chat.lastMessage.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
    unread: chat.unreadCount,
    avatarColor: '#128c7e' // Default WhatsApp color
  }));
};

// Helper to reliably get the Puppeteer page
const getPage = async (client) => {
    if (client.pupPage) {
        // Verify it's still valid
        try {
            await client.pupPage.evaluate(() => window.Store);
            return client.pupPage;
        } catch (e) {
            client.pupPage = null; // Reset if invalid
        }
    }
    
    if (client.pupBrowser) {
        try {
            const pages = await client.pupBrowser.pages();
            console.log(`[Server] Scanning ${pages.length} pages for window.Store...`);
            
            for (const page of pages) {
                try {
                    const hasStore = await page.evaluate(() => typeof window.Store !== 'undefined' && window.Store.Chat);
                    if (hasStore) {
                        console.log('[Server] Found page with window.Store');
                        client.pupPage = page;
                        return page;
                    }
                } catch (e) {
                    // Ignore errors on pages we can't access
                }
            }
            
            // If scanning failed, try the first one as last resort
            if (pages.length > 0) {
                console.log('[Server] No page with Store found, defaulting to first page');
                return pages[0];
            }
        } catch (e) {
            console.error('[Server] Error getting pages from browser:', e);
        }
    }
    return null;
};

// Helper to get chats with fallback (Puppeteer Direct Store)
const getChatsWithFallback = async (client) => {
    try {
        console.log('[Server] Attempting standard client.getChats()...');
        const chats = await client.getChats();
        if (chats && chats.length > 0) {
            console.log(`[Server] Standard getChats succeeded with ${chats.length} chats`);
            return formatChats(chats);
        }
    } catch (e) {
        console.warn(`[Server] Standard getChats failed: ${e.message}. Trying fallback...`);
    }

    // Fallback: Puppeteer Direct Store Injection
    const page = await getPage(client);
    if (page) {
        console.log('[Server] Attempting Direct Store Injection for chat list...');
        try {
            const rawChats = await page.evaluate(() => {
                try {
                    // Access internal Store.Chat models
                    const models = window.Store.Chat.models;
                    if (!models) return [];
                    
                    return models.map(c => {
                         const lastMsg = (c.msgs && c.msgs.models && c.msgs.models.length > 0) 
                                        ? c.msgs.models[c.msgs.models.length - 1] 
                                        : null;
                         
                         return {
                             id: { _serialized: c.id._serialized },
                             name: c.name || c.formattedTitle || c.contact.name || c.id.user,
                             unreadCount: c.unreadCount,
                             lastMessage: lastMsg ? {
                                 body: lastMsg.body,
                                 timestamp: lastMsg.t
                             } : null
                         };
                    });
                } catch (err) {
                    return [];
                }
            });

            console.log(`[Server] Direct Store Injection retrieved ${rawChats.length} chats`);
            return formatChats(rawChats); // Reuse formatter since we matched the structure
        } catch (e) {
            console.error('[Server] Puppeteer chat list fallback failed:', e);
        }
    }
    return [];
};

io.on('connection', (socket) => {
  console.log('Frontend connected');

  socket.on('start-session', async ({ accountId }) => {
    if (!accountId) return;
    
    console.log(`Starting session for account: ${accountId}`);
    socket.join(accountId); // Join a room for this account

    // Check if session already exists
    if (sessions.has(accountId)) {
      const client = sessions.get(accountId);
      
      // Ensure we re-attach the global IO listeners for this client if they might be stale?
      // Actually, listeners are attached to the client instance, which emits to io.to(accountId).
      // Since io is global and accountId is the same, it should be fine.
      // But just in case, we can log to confirm.
      console.log(`[Server] Session exists for ${accountId}. Listeners should be active.`);

      // If client is already ready, send chats immediately
      if (client.info) {
        console.log(`Client ${accountId} already ready, sending chats`);
        socket.emit('ready', { accountId });
        try {
          const formattedChats = await getChatsWithFallback(client);
          socket.emit('chat-list', { accountId, chats: formattedChats });
        } catch (e) {
          console.error(`Error fetching chats for ${accountId}:`, e);
        }
      }
      return;
    }


    // Create new client for this account
    console.log(`Creating new client for ${accountId}`);
    const client = new Client({
        authStrategy: new LocalAuth({
             clientId: accountId,
             dataPath: './.wwebjs_auth'
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ]
        }
    });

    client.on('qr', (qr) => {
      console.log(`QR Received for ${accountId}`);
      io.to(accountId).emit('qr', { accountId, qr });
    });

    client.on('ready', async () => {
      console.log(`Client ${accountId} is ready!`);
      io.to(accountId).emit('ready', { accountId });
      
      try {
        const formattedChats = await getChatsWithFallback(client);
        io.to(accountId).emit('chat-list', { accountId, chats: formattedChats });
      } catch (e) {
        console.error(`Error fetching chats for ${accountId}:`, e);
      }
    });

    client.on('authenticated', () => {
      console.log(`Client ${accountId} authenticated`);
      io.to(accountId).emit('status', { accountId, status: 'Authenticated' });
    });

    client.on('auth_failure', msg => {
      console.error(`Auth failure for ${accountId}`, msg);
      io.to(accountId).emit('status', { accountId, status: 'Auth Failure', message: msg });
    });

    client.on('message_create', async (msg) => {
      // Forward all new messages (incoming and outgoing) to the frontend
      try {
        let chatId;
        try {
            const chat = await msg.getChat();
            chatId = chat.id._serialized;
        } catch (err) {
            console.warn('[Server] msg.getChat() failed in message_create, using fallback ID extraction:', err.message);
            // Fallback: determine chatId from message metadata
            // If fromMe, the chat is the recipient (to). If incoming, chat is the sender (from).
            chatId = msg.fromMe ? msg.to : msg.from;
        }

        console.log(`[Server] message_create event:`, {
            id: msg.id._serialized,
            body: msg.body,
            from: msg.from,
            to: msg.to,
            chatId: chatId,
            fromMe: msg.fromMe
        });

        io.to(accountId).emit('message', {
          accountId,
          chatId: chatId,
          message: {
              id: msg.id._serialized,
              from: msg.from,
              to: msg.to,
              body: msg.body,
              timestamp: msg.timestamp,
              fromMe: msg.fromMe
          }
        });
      } catch (e) {
        console.error('Error handling message_create:', e);
      }
    });

    socket.on('send-message', async ({ accountId, chatId, message }) => {
        console.log(`[Server] received send-message event for ${chatId}`);
        if (!sessions.has(accountId)) {
            console.error(`[Server] Session not found for ${accountId} during send-message`);
            socket.emit('send-message-error', { accountId, chatId, error: 'Session not active. Please refresh the page.' });
            return;
        }
        
        const client = sessions.get(accountId);
        try {
            console.log(`[Server] Attempting client.sendMessage to ${chatId}`);
            // DIRECT SEND: Use client.sendMessage(chatId, ...)
            const sentMessage = await client.sendMessage(chatId, message);
            console.log(`[Server] Message sent successfully to ${chatId}, ID: ${sentMessage.id._serialized}`);
            
            socket.emit('message-ack', {
                accountId,
                chatId,
                tempId: null,
                messageId: sentMessage.id._serialized,
                timestamp: sentMessage.timestamp
            });

        } catch (e) {
            console.error(`Error sending message to ${chatId}:`, e);
            
            // FALLBACK: Direct Store Injection (The "Whatsapp Web Type Codes" approach)
            // If the library wrapper fails (e.g. markedUnread error), try injecting JS directly
            let fallbackSuccess = false;
            if (client.pupPage) {
                console.log('[Server] Attempting Direct Store Injection fallback for sending...');
                try {
                    const fallbackResult = await client.pupPage.evaluate(async (targetChatId, msgContent) => {
                        const chat = window.Store.Chat.get(targetChatId);
                        if (chat && chat.sendMessage) {
                            await chat.sendMessage(msgContent);
                            return true;
                        }
                        return false;
                    }, chatId, message);
                    
                    if (fallbackResult) {
                        console.log('[Server] Direct Store Injection send successful!');
                        fallbackSuccess = true;
                        socket.emit('message-ack', {
                            accountId,
                            chatId,
                            tempId: null,
                            messageId: `fallback-${Date.now()}`, // Fake ID since we can't easily get the real one synchronously
                            timestamp: Math.floor(Date.now() / 1000)
                        });
                    }
                } catch (fallbackErr) {
                    console.error('[Server] Direct Store Injection failed:', fallbackErr);
                }
            }

            if (!fallbackSuccess) {
                if (e.message && e.message.includes('markedUnread')) {
                     socket.emit('send-message-error', { accountId, chatId, error: 'WhatsApp Sync Error: Please refresh the page. (Code: MU)' });
                } else {
                     socket.emit('send-message-error', { accountId, chatId, error: e.message });
                }
            }
        }
    });

    socket.on('mark-chat-read', async ({ accountId, chatId }) => {
        console.log(`[Server] mark-chat-read for ${chatId} in ${accountId}`);
        if (!sessions.has(accountId)) {
            console.warn(`[Server] mark-chat-read: Session not found for ${accountId}`);
            return;
        }
        const client = sessions.get(accountId);
        try {
            if (client.sendSeen) {
                await client.sendSeen(chatId);
            } else {
                const chat = await client.getChatById(chatId);
                if (chat && chat.sendSeen) {
                    await chat.sendSeen();
                }
            }
            console.log(`[Server] mark-chat-read success for ${chatId}`);
        } catch (e) {
            console.error(`[Server] mark-chat-read failed for ${chatId}:`, e);
        }
    });

    // Handle fetching messages for a specific chat
    socket.on('fetch-messages', async ({ accountId, chatId }) => {
    console.log(`[Server] Fetch request for ${chatId} in ${accountId}`);
    if (!sessions.has(accountId)) {
       console.warn(`[Server] Session not found for ${accountId}`);
       socket.emit('chat-messages-error', { accountId, chatId, error: 'Session not found' });
       return;
    }
    const client = sessions.get(accountId);
    
    try {
      // FAST PATH: Try Direct Store Injection FIRST (Bypasses potentially flaky Chat Object lookup)
      let lastError = null;
      const page = await getPage(client);
      let messages = [];
      let fetchSuccess = false;

      if (page) {
          try {
              console.log('[Server] Attempting Direct Store Fetch via Page Evaluation...');
              
              // Ensure Store is available
              await page.waitForFunction('window.Store && window.Store.Chat', { timeout: 2000 }).catch(() => console.log('[Server] Window.Store wait timed out'));

              const directResult = await Promise.race([
                  page.evaluate((targetChatId) => {
                      try {
                          if (!window.Store || !window.Store.Chat) return { found: false, error: 'Store not found' };
                          
                          const chatModel = window.Store.Chat.get(targetChatId);
                          if (!chatModel) return { found: false, error: 'Chat model not found' }; 
                          
                          // Load earlier messages if needed
                          if (chatModel.msgs.length < 10) {
                              chatModel.loadEarlierMsgs();
                          }

                          const msgs = chatModel.msgs.models;
                          const mapped = msgs.map(m => ({
                              id: { _serialized: m.id._serialized },
                              from: m.from,
                              to: m.to,
                              body: m.body,
                              timestamp: m.t,
                              fromMe: m.id.fromMe
                          }));
                          return { found: true, messages: mapped };
                      } catch (e) {
                          return { error: e.message };
                      }
                  }, chatId),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Direct Store Timeout')), 10000))
              ]);

              if (directResult && directResult.found) {
                  console.log(`[Server] Direct Store fetch success: ${directResult.messages.length} messages`);
                  messages = directResult.messages;
                  fetchSuccess = true;
              } else if (directResult && directResult.error) {
                  console.warn('[Server] Direct Store internal error:', directResult.error);
                  lastError = directResult.error;
              } else {
                  console.warn('[Server] Direct Store: Chat not found in window.Store');
                  lastError = 'Chat not found in Store';
              }
          } catch (e) {
              console.warn('[Server] Direct Store fetch failed/timed out:', e.message);
              lastError = e.message;
          }
      }

      // SLOW PATH / FALLBACK: Use standard library calls if Direct Store failed
      if (!fetchSuccess) {
          console.log('[Server] Falling back to Standard Library Fetch...');
          try {
              // Wrap getChatById in timeout
              const chat = await Promise.race([
                  client.getChatById(chatId),
                  new Promise((_, r) => setTimeout(() => r(new Error('getChatById Timeout')), 5000))
              ]);

              if (!chat) {
                  throw new Error('Chat not found');
              }

              console.log(`[Server] Chat object found, fetching messages...`);
              const fetchedMsgs = await Promise.race([
                  chat.fetchMessages({ limit: 50 }),
                  new Promise((_, r) => setTimeout(() => r(new Error('fetchMessages Timeout')), 15000))
              ]);
              
              messages = fetchedMsgs.map(m => ({
                  id: { _serialized: m.id._serialized },
                  from: m.from,
                  to: m.to,
                  body: m.body,
                  timestamp: m.timestamp,
                  fromMe: m.fromMe
              }));
              fetchSuccess = true;
          } catch (err) {
              console.error(`[Server] Standard Fetch failed: ${err.message}`);
              if (err.message && err.message.includes("reading 'getChat'")) {
                  lastError = "WhatsApp Internal State Error (Try Reloading)";
              } else {
                  lastError = err.message;
              }
          }
      }

      if (!fetchSuccess && messages.length === 0) {
          console.warn('[Server] All fetches failed. Sending system warning.');
          messages.push({
              id: { _serialized: 'system-error-' + Date.now() },
              from: 'system',
              to: chatId,
              body: `⚠️ System: Could not load message history. Error: ${lastError || 'Unknown'}. Real-time messages will appear here.`,
              timestamp: Math.floor(Date.now() / 1000),
              fromMe: false
          });
      }
      
      console.log(`[Server] Final message count: ${messages.length}`);
      
      const formattedMessages = messages.map(msg => ({
        id: msg.id._serialized || msg.id, // Handle both structures
        from: msg.from,
        to: msg.to,
        body: msg.body,
        timestamp: msg.timestamp,
        fromMe: msg.fromMe
      }));

      socket.emit('chat-messages', { accountId, chatId, messages: formattedMessages });
    } catch (e) {
      console.error(`Error fetching messages for ${chatId} in ${accountId}:`, e);
      socket.emit('chat-messages-error', { accountId, chatId, error: e.message });
    }
  });

    socket.on('delete-session', async ({ accountId }) => {
        if (sessions.has(accountId)) {
            console.log(`Deleting session for ${accountId}`);
            const client = sessions.get(accountId);
            try {
                await client.destroy();
            } catch (e) {
                console.error('Error destroying client:', e);
            }
            sessions.delete(accountId);
        }
    });

    try {
        client.initialize();
        sessions.set(accountId, client);
    } catch (err) {
        console.error(`Failed to initialize client for ${accountId}:`, err);
        io.to(accountId).emit('status', { accountId, status: 'Init Failure', message: err.message });
    }
  });

  socket.on('disconnect', () => {
    console.log('Frontend disconnected');
  });
});

// VPS DEPLOYMENT: Handle SPA routing - return index.html for all non-API routes
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3002;
server.on('error', (e) => {
  console.error('Server error:', e);
});
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason);
});
