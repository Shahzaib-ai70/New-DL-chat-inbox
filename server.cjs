const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
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

const sessions = new Map();

const dataDir = path.join(__dirname, 'data');
const messageStoreFile = path.join(dataDir, 'messages.json');

let messageStore = {};

// Load store on startup
try {
    if (fs.existsSync(messageStoreFile)) {
        const raw = fs.readFileSync(messageStoreFile, 'utf8');
        try {
            messageStore = JSON.parse(raw || '{}');
            console.log(`[Server] Loaded message store from disk: ${Object.keys(messageStore).length} accounts found.`);
        } catch (parseErr) {
            console.error('[Server] Message store JSON corrupted, resetting store.', parseErr);
            messageStore = {};
        }
    } else {
        console.log('[Server] No message store file found. Creating new store.');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }
} catch (e) {
    console.error('[Server] Error loading message store:', e);
    messageStore = {};
}

// Debounced Save to avoid disk trashing and corruption
let saveTimeout = null;
const persistMessageStore = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        try {
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            fs.writeFileSync(messageStoreFile, JSON.stringify(messageStore, null, 2), 'utf8');
            console.log('[Server] Message store successfully saved to disk.');
        } catch (e) {
            console.error('[Server] CRITICAL: Error persisting message store:', e);
        }
    }, 1000); // 1 second debounce
};

const getStoredMessages = (accountId, chatId) => {
    if (!messageStore[accountId]) return [];
    return messageStore[accountId][chatId] || [];
};

const upsertMessages = (accountId, chatId, newMessages) => {
    if (!messageStore[accountId]) messageStore[accountId] = {};
    if (!messageStore[accountId][chatId]) messageStore[accountId][chatId] = [];
    const existing = messageStore[accountId][chatId];
    const byId = new Map(existing.map(m => [m.id, m]));
    newMessages.forEach(m => {
        if (!m || !m.id) return;
        byId.set(m.id, m);
    });
    const merged = Array.from(byId.values()).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    messageStore[accountId][chatId] = merged;
    persistMessageStore();
};

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
    // 1. Try cached page first
    if (client.pupPage) {
        try {
            // Fast check if page is still alive
            if (client.pupPage.isClosed && client.pupPage.isClosed()) {
                 console.log('[Server] Cached page is closed, discarding.');
                 client.pupPage = null;
            } else {
                 await client.pupPage.evaluate(() => 1);
                 return client.pupPage;
            }
        } catch (e) {
            console.warn('[Server] Cached page check failed:', e.message);
            client.pupPage = null; 
        }
    }
    
    // 2. Try internal reference (client.mPage) often available in wwebjs
    if (client.mPage) {
        try {
             await client.mPage.evaluate(() => 1);
             console.log('[Server] Found valid client.mPage');
             client.pupPage = client.mPage;
             return client.mPage;
        } catch(e) {
             console.warn('[Server] client.mPage found but invalid:', e.message);
        }
    }

    // 3. Try finding via pupBrowser
    if (client.pupBrowser) {
        try {
            const pages = await client.pupBrowser.pages();
            console.log(`[Server] Scanning ${pages.length} pages for window.Store...`);
            
            for (const page of pages) {
                try {
                    // Check for Store AND Chat model to be sure it's the main app
                    const hasStore = await page.evaluate(() => {
                        return typeof window !== 'undefined' && 
                               window.Store && 
                               window.Store.Chat;
                    });
                    
                    if (hasStore) {
                        console.log('[Server] Found page with window.Store');
                        client.pupPage = page;
                        return page;
                    }
                } catch (e) {
                    // Ignore errors on pages we can't access
                }
            }
            
            // If scanning failed, try the first one as last resort (often the main one)
            if (pages.length > 0) {
                console.log('[Server] No page with Store found, defaulting to first page');
                client.pupPage = pages[0];
                return pages[0];
            }
        } catch (e) {
            console.error('[Server] Error getting pages from browser:', e);
        }
    } else {
        console.error('[Server] client.pupBrowser is NOT defined. Is the client initialized?');
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

        const storedMessage = {
            id: msg.id._serialized,
            from: msg.from,
            to: msg.to,
            body: msg.body,
            timestamp: msg.timestamp,
            fromMe: msg.fromMe,
            ack: msg.ack || 0
        };
        upsertMessages(accountId, chatId, [storedMessage]);

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

    client.on('message', async (msg) => {
        // Explicitly handle 'message' event for redundancy
        // (Usually message_create covers this, but for some versions/contexts 'message' is more reliable for incoming)
        if (msg.fromMe) return; // message_create handles fromMe, 'message' is usually only incoming
        
        console.log(`[Server] 'message' event received: ${msg.id._serialized}`);
        // We rely on message_create to emit to socket to avoid duplicates, 
        // but we log here to confirm reception.
    });

    client.on('message_ack', (msg, ack) => {
        console.log(`[Server] message_ack: ${msg.id._serialized} status: ${ack}`);
        // Determine chatId. For outgoing messages, 'to' is the chat.
        const chatId = msg.to; 
        
        io.to(accountId).emit('message-ack', {
            accountId,
            chatId,
            messageId: msg.id._serialized,
            ack: ack
        });
    });
    
    // SYNC EVENTS
    client.on('chat_update', (chat) => {
        console.log(`[Server] chat_update event for ${chat.id._serialized}`);
        // We could emit a chat list update here
        // For now, let's just log. 
        // Ideally we should emit 'chat-update' to frontend if we had that logic.
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
            const sentMessage = await client.sendMessage(chatId, message);
            console.log(`[Server] Message sent successfully to ${chatId}, ID: ${sentMessage.id._serialized}`);

            const storedMessage = {
                id: sentMessage.id._serialized,
                from: sentMessage.from,
                to: sentMessage.to,
                body: sentMessage.body,
                timestamp: sentMessage.timestamp,
                fromMe: true,
                ack: sentMessage.ack || 1
            };
            upsertMessages(accountId, chatId, [storedMessage]);
            
            socket.emit('message-ack', {
                accountId,
                chatId,
                tempId: null,
                messageId: sentMessage.id._serialized,
                timestamp: sentMessage.timestamp,
                ack: 1
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
            const page = await getPage(client);
            if (!page) {
                console.warn('[Server] mark-chat-read: No Puppeteer page / Store not available');
                return;
            }
            await page.evaluate(async (targetChatId) => {
                if (!window.Store || !window.Store.Chat) return;
                const chat = window.Store.Chat.get(targetChatId);
                if (!chat) return;
                if (chat.sendSeen) {
                    await chat.sendSeen();
                } else if (chat.markSeen) {
                    await chat.markSeen();
                }
            }, chatId);
            console.log(`[Server] mark-chat-read success for ${chatId} via Direct Store`);
        } catch (e) {
            console.error(`[Server] mark-chat-read failed for ${chatId}:`, e);
        }
    });

    // Handle fetching fetching messages for a specific chat
    socket.on('fetch-messages', async ({ accountId, chatId }) => {
      console.log(`[Server] Fetch request for ${chatId} in ${accountId}`);
      if (!sessions.has(accountId)) {
        console.warn(`[Server] Session not found for ${accountId}`);
        socket.emit('chat-messages-error', { accountId, chatId, error: 'Session not found' });
        return;
      }
      const client = sessions.get(accountId);
      
      try {
        let messages = [];
        let networkFetchSuccess = false; // Track if we got FRESH data from WhatsApp
        let lastError = null;

        // 1. Load from Local Store first (Instant Cache)
        const stored = getStoredMessages(accountId, chatId);
        if (stored && stored.length > 0) {
          messages = stored;
          console.log(`[Server] Using stored history for ${chatId}, count=${messages.length}`);
        }

        console.log('[Server] Strategy 1: Standard library history fetch...');
        try {
          const allChats = await Promise.race([
            client.getChats(),
            new Promise((_, r) => setTimeout(() => r(new Error('getChats Timeout')), 7000))
          ]);

          if (allChats && allChats.length) {
            const chat = allChats.find(c => {
              if (!c || !c.id) return false;
              if (typeof c.id === 'string') return c.id === chatId;
              if (c.id._serialized) return c.id._serialized === chatId;
              return false;
            });

            if (chat) {
              const fetchedMsgs = await Promise.race([
                chat.fetchMessages({ limit: 50 }),
                new Promise((_, r) => setTimeout(() => r(new Error('fetchMessages Timeout')), 10000))
              ]);

              const mapped = fetchedMsgs.map(m => ({
                id: { _serialized: m.id._serialized },
                from: m.from,
                to: m.to,
                body: m.body,
                timestamp: m.timestamp,
                fromMe: m.fromMe,
                ack: m.ack
              }));
              
              upsertMessages(accountId, chatId, mapped.map(m => ({
                  id: m.id._serialized,
                  from: m.from,
                  to: m.to,
                  body: m.body,
                  timestamp: m.timestamp,
                  fromMe: m.fromMe,
                  ack: m.ack || 0
              })));
              
              // Refresh messages from store to include merged history
              messages = getStoredMessages(accountId, chatId);
              networkFetchSuccess = true;
              console.log(`[Server] Strategy 1 Success: Synced ${mapped.length} new messages. Total: ${messages.length}`);
            } else {
              throw new Error('Chat not found in getChats result');
            }
          } else {
            throw new Error('getChats returned empty list');
          }
        } catch (e) {
          lastError = e.message;
          console.warn(`[Server] Strategy 1 failed: ${e.message}`);
        }

        // 2. Strategy 2: Direct Store fallback
        // Run this if Strategy 1 failed, EVEN IF we have stored messages.
        // We want fresh data if possible.
        if (!networkFetchSuccess) {
          console.log('[Server] Strategy 2: Direct Store fallback...');
          const page = await getPage(client);
          if (page) {
            try {
              const directResult = await Promise.race([
                page.evaluate(async (targetChatId) => {
                  try {
                    if (!window.Store || !window.Store.Chat) return { found: false, error: 'Store not found' };
                    const chatModel = window.Store.Chat.get(targetChatId);
                    if (!chatModel) return { found: false, error: 'Chat model not found' }; 
                    
                    if (chatModel.msgs && chatModel.msgs.length < 10) {
                      try {
                        if (typeof chatModel.loadEarlierMsgs === 'function') {
                          await chatModel.loadEarlierMsgs();
                        } else if (chatModel.msgs && typeof chatModel.msgs.loadEarlierMsgs === 'function') {
                          await chatModel.msgs.loadEarlierMsgs();
                        }
                      } catch (e) {
                      }
                    }

                    const models = chatModel.msgs && chatModel.msgs.models ? chatModel.msgs.models : [];

                    return { 
                      found: true, 
                      messages: models.map(m => ({
                        id: { _serialized: m.id._serialized },
                        from: m.from,
                        to: m.to,
                        body: m.body,
                        timestamp: m.t,
                        fromMe: m.id.fromMe,
                        ack: m.ack
                      }))
                    };
                  } catch (e) {
                    return { error: e.message };
                  }
                }, chatId),
                new Promise((_, r) => setTimeout(() => r(new Error('Direct Store Timeout')), 10000))
              ]);

              if (directResult && directResult.found) {
                upsertMessages(accountId, chatId, directResult.messages.map(m => ({
                    id: m.id._serialized,
                    from: m.from,
                    to: m.to,
                    body: m.body,
                    timestamp: m.timestamp,
                    fromMe: m.fromMe,
                    ack: m.ack || 0
                })));
                
                // Refresh messages from store to include merged history
                messages = getStoredMessages(accountId, chatId);
                networkFetchSuccess = true;
                console.log(`[Server] Strategy 2 Success: Synced ${directResult.messages.length} new messages. Total: ${messages.length}`);
              } else {
                lastError = (directResult && directResult.error) ? directResult.error : 'Direct Store failed';
              }
            } catch (e) {
              console.warn(`[Server] Strategy 2 evaluate failed: ${e.message}`);
              lastError = e.message;
            }
          } else {
            lastError = 'Puppeteer page / Store not available';
          }
        }

        // If we have NO messages (no cache AND no network success), send error
        if (!networkFetchSuccess && messages.length === 0) {
          console.warn('[Server] History fetch failed, sending system notice message.');
          const puppeteerStatus = client.pupBrowser ? 'Browser Active' : 'Browser Missing';
          const pageStatus = await getPage(client) ? 'Page Found' : 'Page Missing';
          
          messages.push({
            id: { _serialized: 'system-error-' + Date.now() },
            from: 'system',
            to: chatId,
            body: `⚠️ System: Failed to load history (${lastError}). Debug: ${puppeteerStatus} / ${pageStatus}. Real-time messages will appear here.`,
            timestamp: Math.floor(Date.now() / 1000),
            fromMe: false,
            ack: 0
          });
        }
        
        console.log(`[Server] Returning ${messages.length} messages for ${chatId}`);
        
        const formattedMessages = messages.map(msg => ({
          id: msg.id._serialized || msg.id, 
          from: msg.from,
          to: msg.to,
          body: msg.body,
          timestamp: msg.timestamp,
          fromMe: msg.fromMe,
          ack: msg.ack || 0
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
