const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

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

app.get('/', (req, res) => {
  res.send('WhatsApp Web Backend is running');
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
    if (client.pupPage) {
        console.log('[Server] Attempting Direct Store Injection for chat list...');
        try {
            const rawChats = await client.pupPage.evaluate(() => {
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
      io.to(accountId).emit('status', { accountId, status: 'Auth Failure' });
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

    // Handle sending a message
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
      let chat = await client.getChatById(chatId);
      
      // Fallback: if getChatById fails to find it, search in all chats
      if (!chat) {
         console.log(`[Server] getChatById failed for ${chatId}, trying getAllChats fallback...`);
         const allChats = await client.getChats();
         chat = allChats.find(c => c.id._serialized === chatId);
      }

      if (!chat) {
           console.error(`[Server] Chat not found: ${chatId}`);
           socket.emit('chat-messages-error', { accountId, chatId, error: 'Chat not found' });
           return;
      }
      console.log(`[Server] Chat found (${chat.name || 'unknown'}), fetching messages...`);
      
      // HYBRID FETCH: Try standard fetch first, then fallback to Puppeteer Store Injection
      // This solves the "Not Fetching" issue when the library wrapper is flaky
      let messages = [];
      try {
           // Try standard method with timeout
           const fetchPromise = chat.fetchMessages({ limit: 50 });
           const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Fetch timeout')), 5000));
           messages = await Promise.race([fetchPromise, timeoutPromise]);
      } catch (err) {
           console.warn(`[Server] Standard fetchMessages failed or timed out: ${err.message}. Switching to Direct Store Access...`);
           
           // DIRECT STORE ACCESS (The "Whatsapp Web Type Codes" approach)
           // This injects code into the browser to grab messages directly from WhatsApp's internal Redux/Flux store
           if (client.pupPage) {
               messages = await client.pupPage.evaluate((targetChatId) => {
                   try {
                       const chatModel = window.Store.Chat.get(targetChatId);
                       if (!chatModel) return [];
                       // Grab the loaded messages directly
                       const msgs = chatModel.msgs.models;
                       return msgs.map(m => ({
                           id: { _serialized: m.id._serialized },
                           from: m.from,
                           to: m.to,
                           body: m.body,
                           timestamp: m.t,
                           fromMe: m.id.fromMe
                       }));
                   } catch (e) {
                       return [];
                   }
               }, chatId);
               console.log(`[Server] Direct Store Access retrieved ${messages.length} messages`);
           }
      }
      
      console.log(`[Server] Final message count: ${messages.length}`);
      
      const formattedMessages = messages.map(msg => ({
        id: msg.id._serialized,
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

    // Initialize the client
    try {
        client.initialize();
        sessions.set(accountId, client);
    } catch (err) {
        console.error(`Failed to initialize client for ${accountId}:`, err);
    }
  });

  socket.on('disconnect', () => {
    console.log('Frontend disconnected');
  });
});

const PORT = 3002;
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
