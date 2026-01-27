import React, { useState, useEffect, useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { FaWhatsapp, FaTelegram, FaFacebook, FaInstagram, FaLine, FaTwitter, FaPlus, FaSearch, FaCheck, FaCheckDouble, FaPaperPlane, FaGlobe } from 'react-icons/fa'
import { io } from 'socket.io-client'

const SUPPORTED_LANGUAGES = [
    { code: 'af', name: 'Afrikaans' },
    { code: 'sq', name: 'Albanian' },
    { code: 'am', name: 'Amharic' },
    { code: 'ar', name: 'Arabic' },
    { code: 'hy', name: 'Armenian' },
    { code: 'az', name: 'Azerbaijani' },
    { code: 'eu', name: 'Basque' },
    { code: 'be', name: 'Belarusian' },
    { code: 'bn', name: 'Bengali' },
    { code: 'bs', name: 'Bosnian' },
    { code: 'bg', name: 'Bulgarian' },
    { code: 'ca', name: 'Catalan' },
    { code: 'ceb', name: 'Cebuano' },
    { code: 'ny', name: 'Chichewa' },
    { code: 'zh-CN', name: 'Chinese (Simplified)' },
    { code: 'zh-TW', name: 'Chinese (Traditional)' },
    { code: 'co', name: 'Corsican' },
    { code: 'hr', name: 'Croatian' },
    { code: 'cs', name: 'Czech' },
    { code: 'da', name: 'Danish' },
    { code: 'nl', name: 'Dutch' },
    { code: 'en', name: 'English' },
    { code: 'eo', name: 'Esperanto' },
    { code: 'et', name: 'Estonian' },
    { code: 'tl', name: 'Filipino' },
    { code: 'fi', name: 'Finnish' },
    { code: 'fr', name: 'French' },
    { code: 'fy', name: 'Frisian' },
    { code: 'gl', name: 'Galician' },
    { code: 'ka', name: 'Georgian' },
    { code: 'de', name: 'German' },
    { code: 'el', name: 'Greek' },
    { code: 'gu', name: 'Gujarati' },
    { code: 'ht', name: 'Haitian Creole' },
    { code: 'ha', name: 'Hausa' },
    { code: 'haw', name: 'Hawaiian' },
    { code: 'iw', name: 'Hebrew' },
    { code: 'hi', name: 'Hindi' },
    { code: 'hmn', name: 'Hmong' },
    { code: 'hu', name: 'Hungarian' },
    { code: 'is', name: 'Icelandic' },
    { code: 'ig', name: 'Igbo' },
    { code: 'id', name: 'Indonesian' },
    { code: 'ga', name: 'Irish' },
    { code: 'it', name: 'Italian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'jw', name: 'Javanese' },
    { code: 'kn', name: 'Kannada' },
    { code: 'kk', name: 'Kazakh' },
    { code: 'km', name: 'Khmer' },
    { code: 'rw', name: 'Kinyarwanda' },
    { code: 'ko', name: 'Korean' },
    { code: 'ku', name: 'Kurdish (Kurmanji)' },
    { code: 'ky', name: 'Kyrgyz' },
    { code: 'lo', name: 'Lao' },
    { code: 'la', name: 'Latin' },
    { code: 'lv', name: 'Latvian' },
    { code: 'lt', name: 'Lithuanian' },
    { code: 'lb', name: 'Luxembourgish' },
    { code: 'mk', name: 'Macedonian' },
    { code: 'mg', name: 'Malagasy' },
    { code: 'ms', name: 'Malay' },
    { code: 'ml', name: 'Malayalam' },
    { code: 'mt', name: 'Maltese' },
    { code: 'mi', name: 'Maori' },
    { code: 'mr', name: 'Marathi' },
    { code: 'mn', name: 'Mongolian' },
    { code: 'my', name: 'Myanmar (Burmese)' },
    { code: 'ne', name: 'Nepali' },
    { code: 'no', name: 'Norwegian' },
    { code: 'or', name: 'Odia (Oriya)' },
    { code: 'ps', name: 'Pashto' },
    { code: 'fa', name: 'Persian' },
    { code: 'pl', name: 'Polish' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'pa', name: 'Punjabi' },
    { code: 'ro', name: 'Romanian' },
    { code: 'ru', name: 'Russian' },
    { code: 'sm', name: 'Samoan' },
    { code: 'gd', name: 'Scots Gaelic' },
    { code: 'sr', name: 'Serbian' },
    { code: 'st', name: 'Sesotho' },
    { code: 'sn', name: 'Shona' },
    { code: 'sd', name: 'Sindhi' },
    { code: 'si', name: 'Sinhala' },
    { code: 'sk', name: 'Slovak' },
    { code: 'sl', name: 'Slovenian' },
    { code: 'so', name: 'Somali' },
    { code: 'es', name: 'Spanish' },
    { code: 'su', name: 'Sundanese' },
    { code: 'sw', name: 'Swahili' },
    { code: 'sv', name: 'Swedish' },
    { code: 'tg', name: 'Tajik' },
    { code: 'ta', name: 'Tamil' },
    { code: 'tt', name: 'Tatar' },
    { code: 'te', name: 'Telugu' },
    { code: 'th', name: 'Thai' },
    { code: 'tr', name: 'Turkish' },
    { code: 'tk', name: 'Turkmen' },
    { code: 'uk', name: 'Ukrainian' },
    { code: 'ur', name: 'Urdu' },
    { code: 'ug', name: 'Uyghur' },
    { code: 'uz', name: 'Uzbek' },
    { code: 'vi', name: 'Vietnamese' },
    { code: 'cy', name: 'Welsh' },
    { code: 'xh', name: 'Xhosa' },
    { code: 'yi', name: 'Yiddish' },
    { code: 'yo', name: 'Yoruba' },
    { code: 'zu', name: 'Zulu' },
]

function App() {
  // Load initial state from localStorage or use defaults
  const [activePlatform, setActivePlatform] = useState(() => {
    return localStorage.getItem('activePlatform') || 'whatsapp'
  })

  const [lists, setLists] = useState(() => {
    const saved = localStorage.getItem('lists')
    return saved ? JSON.parse(saved) : {
      whatsapp: [],
      telegram: [],
      facebook: [],
      instagram: [],
      line: [],
      twitter: []
    }
  })

  const [selectedAccountId, setSelectedAccountId] = useState(() => {
    const saved = localStorage.getItem('selectedAccountId')
    return saved ? JSON.parse(saved) : null
  })

  const [selectedChatId, setSelectedChatId] = useState(null)
  const selectedChatIdRef = useRef(selectedChatId)
  // USER REQUEST: Explicit activeChat state to ensure object availability
  const [activeChat, setActiveChat] = useState(null)
  const [activeChatMessages, setActiveChatMessages] = useState([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [messageInput, setMessageInput] = useState('')

  // Translation State
  const [chatLanguages, setChatLanguages] = useState({})
  const [autoTranslate, setAutoTranslate] = useState({})
  const [showLangSelector, setShowLangSelector] = useState(false)

  useEffect(() => {
    selectedChatIdRef.current = selectedChatId
  }, [selectedChatId])

  const [chatFilter, setChatFilter] = useState(() => {
    return localStorage.getItem('chatFilter') || 'all'
  })
  
  const [searchQuery, setSearchQuery] = useState('')
  const [qrCodeData, setQrCodeData] = useState('')
  const [socket, setSocket] = useState(null)

  const [chats, setChats] = useState(() => {
    const saved = localStorage.getItem('chats')
    return saved ? JSON.parse(saved) : {}
  })

  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, accountId: null })

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('activePlatform', activePlatform)
  }, [activePlatform])

  // Close context menu on click elsewhere
  useEffect(() => {
    const handleClick = () => setContextMenu({ ...contextMenu, visible: false })
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [contextMenu])

  useEffect(() => {
    localStorage.setItem('lists', JSON.stringify(lists))
  }, [lists])

  useEffect(() => {
    if (selectedAccountId === null) {
      localStorage.removeItem('selectedAccountId')
    } else {
      localStorage.setItem('selectedAccountId', JSON.stringify(selectedAccountId))
    }
  }, [selectedAccountId])

  useEffect(() => {
    localStorage.setItem('chats', JSON.stringify(chats))
  }, [chats])

  useEffect(() => {
    localStorage.setItem('chatFilter', chatFilter)
  }, [chatFilter])

  // Socket.IO Connection
  useEffect(() => {
    // VPS DEPLOYMENT: Use relative path (or current origin) so it works on any domain/port
    const newSocket = io()
    setSocket(newSocket)

    if (selectedAccountId) {
      // Join the session for this account
      newSocket.emit('start-session', { accountId: selectedAccountId })
    }

    newSocket.on('connect', () => {
      console.log('Connected to backend')
      if (selectedAccountId) {
        newSocket.emit('start-session', { accountId: selectedAccountId })
      }
    })

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err)
    })

    newSocket.on('qr', (data) => {
      // Only show QR if it matches the selected account
      if (data.accountId === selectedAccountId) {
        console.log('QR Received from backend for', data.accountId)
        setQrCodeData(data.qr)
      }
    })

    newSocket.on('status', (data) => {
      if (data.accountId === selectedAccountId) {
        console.log('Status update from backend:', data)
        setLists(prevLists => {
          const updated = { ...prevLists }
          const listForPlatform = updated[activePlatform] || []
          const index = listForPlatform.findIndex(a => a.id === selectedAccountId)
          if (index !== -1) {
            const current = listForPlatform[index]
            listForPlatform[index] = {
              ...current,
              subtitle: data.status === 'Authenticated' ? 'Connected via WhatsApp Web' : (data.status || current.subtitle),
              isConnected: data.status === 'Authenticated'
            }
            updated[activePlatform] = [...listForPlatform]
          }
          return updated
        })
        if (data.status === 'Auth Failure' || data.status === 'Init Failure') {
          setQrCodeData('')
          if (data.message) {
            alert(`WhatsApp status: ${data.status}\n${data.message}`)
          } else {
            alert(`WhatsApp status: ${data.status}`)
          }
        }
      }
    })
    newSocket.on('ready', (data) => {
      console.log('WhatsApp Ready:', data)
      if (data.accountId === selectedAccountId) {
        setLists(prevLists => {
          const updatedLists = { ...prevLists }
          const currentList = updatedLists[activePlatform]
          const index = currentList.findIndex(a => a.id === selectedAccountId)
          if (index !== -1) {
            updatedLists[activePlatform][index].isConnected = true
            updatedLists[activePlatform][index].subtitle = 'Connected via WhatsApp Web'
          }
          return updatedLists
        })
      }
    })

    newSocket.on('chat-list', (data) => {
      if (data.accountId === selectedAccountId) {
        console.log('Received chats for', data.accountId, data.chats)
        setChats(prev => ({
          ...prev,
          [data.accountId]: data.chats
        }))
      }
    })

    newSocket.on('chat-messages', (data) => {
      console.log('Received messages for', data.chatId, 'count:', data.messages.length)
      if (data.accountId === selectedAccountId) {
          // If this message belongs to the currently selected chat, update the view
          if (selectedChatIdRef.current === data.chatId) {
             setActiveChatMessages(data.messages)
             setIsLoadingMessages(false)
          }
      }
    })

    newSocket.on('chat-messages-error', (data) => {
      console.error('Error fetching messages:', data.error)
      if (data.accountId === selectedAccountId && selectedChatIdRef.current === data.chatId) {
         setIsLoadingMessages(false)
         alert(`Failed to load messages: ${data.error}`)
      }
    })

    newSocket.on('send-message-error', (data) => {
        console.error('Message send failed:', data);
        if (data.accountId === selectedAccountId) {
            alert(`Failed to send message: ${data.error}`);
        }
    });

    newSocket.on('message-ack', (data) => {
        console.log('[App] Message ACK received:', data);
        if (data.accountId === selectedAccountId && selectedChatIdRef.current === data.chatId) {
            setActiveChatMessages(prev => {
                return prev.map(msg => {
                    // Match the latest pending message or use tempId if we had one
                    // Since we didn't pass tempId to server, we match by content and pending status
                    // ideally we should pass tempId. For now, we just unflag the last pending message.
                    if (msg.pending && !msg.id.startsWith('temp-ack')) { 
                        return { 
                            ...msg, 
                            pending: false, 
                            id: data.messageId, 
                            timestamp: data.timestamp 
                        };
                    }
                    return msg;
                });
            });
        }
    });

    newSocket.on('message', (data) => {
        console.log('[App] Received real-time message event:', data);
        if (data.accountId === selectedAccountId) {
            const isFromMe = data.message.fromMe;

            // Update chat list (move to top, update last message)
            setChats(prev => {
               const accountChats = prev[data.accountId] || [];
               const chatIndex = accountChats.findIndex(c => c.id === data.chatId);
               
               let newAccountChats = [...accountChats];
               
               // If chat exists, update it
               if (chatIndex !== -1) {
                  const chat = newAccountChats[chatIndex];
                  const updatedChat = {
                    ...chat,
                    message: data.message.body,
                    time: new Date(data.message.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    // If it's the active chat OR it's my message, reset/keep unread 0. Otherwise increment.
                    unread: (selectedChatIdRef.current === data.chatId || isFromMe) ? 0 : (chat.unread + 1)
                  };
                  newAccountChats.splice(chatIndex, 1);
                  newAccountChats.unshift(updatedChat);
               } 
               // Note: If chat doesn't exist (new conversation), we might want to fetch chats again or add it.
               // For now, we only update existing chats to avoid complexity with missing metadata.
               
               return {
                 ...prev,
                 [data.accountId]: newAccountChats
               };
            });

            // If this message belongs to the ACTIVE chat, append it to the view
            if (selectedChatIdRef.current === data.chatId) {
               setActiveChatMessages(prev => {
                   // Deduplication:
                   // 1. Check by ID (if available)
                   if (prev.some(m => m.id === data.message.id)) {
                       console.log('[App] Message already exists (by ID), skipping:', data.message.id);
                       return prev;
                   }

                   // 2. Check for optimistic duplicates (if it's from me)
                   // If we find a message with 'pending: true' and same body, replace it with the real one.
                   if (isFromMe) {
                       const pendingIndex = prev.findIndex(m => m.pending && m.body === data.message.body);
                       if (pendingIndex !== -1) {
                           console.log('[App] Replaced pending message with confirmed message');
                           const newMessages = [...prev];
                           newMessages[pendingIndex] = data.message; // Replace pending with real
                           return newMessages;
                       }
                   }

                   console.log('[App] Appending new message to active view');
                   return [...prev, data.message];
               });
            }
        }
    });

    return () => newSocket.close()
  }, [selectedAccountId, activePlatform])


  const socialPlatforms = [
    { id: 'whatsapp', name: 'WhatsApp', icon: <FaWhatsapp />, color: '#25D366' },
    { id: 'telegram', name: 'Telegram', icon: <FaTelegram />, color: '#0088cc' },
    { id: 'facebook', name: 'Facebook', icon: <FaFacebook />, color: '#1877F2' },
    { id: 'instagram', name: 'Instagram', icon: <FaInstagram />, color: '#E4405F' },
    { id: 'line', name: 'Line', icon: <FaLine />, color: '#00C300' },
    { id: 'twitter', name: 'Twitter', icon: <FaTwitter />, color: '#1DA1F2' },
  ]

  const handlePlatformClick = (id) => {
    setActivePlatform(id)
    setSelectedAccountId(null) // Reset selected account when switching platforms
  }

  const addBox = () => {
    const currentList = lists[activePlatform]
    const newItem = { 
      id: Date.now(), 
      title: `${activePlatform} Account ${currentList.length + 1}`, 
      subtitle: 'Click to scan QR code',
      isConnected: false
    }

    setLists({
      ...lists,
      [activePlatform]: [...currentList, newItem]
    })
    
    // Initialize empty chats for this new account
    setChats(prev => ({
      ...prev,
      [newItem.id]: []
    }))
  }

  const handleAccountClick = (id) => {
    console.log(`[App] Switching to account: ${id}`);
    setSelectedAccountId(id)
    setSelectedChatId(null)
    setActiveChat(null)
    setActiveChatMessages([])
    setQrCodeData('')
    
    // FORCE REFRESH: When switching back to an account, ensure we request the chat list again.
    // The existing useEffect for [selectedAccountId] handles the initial connection, 
    // but we need to make sure the socket knows we are back if it was already connected.
    if (socket && socket.connected) {
         console.log(`[App] Emitting start-session for ${id} on account switch`);
         socket.emit('start-session', { accountId: id });
    }
  }

  // Fetch messages when selectedChatId changes
  useEffect(() => {
    if (!selectedChatId || !selectedAccountId || !socket) return;

    const fetchMessages = () => {
        console.log(`[App] Triggering fetch for chat: ${selectedChatId} (Account: ${selectedAccountId})`);
        setActiveChatMessages([]); // Clear previous messages
        setIsLoadingMessages(true);
        
        socket.emit('fetch-messages', { accountId: selectedAccountId, chatId: selectedChatId });
        // Mark as read immediately when opening
        socket.emit('mark-chat-read', { accountId: selectedAccountId, chatId: selectedChatId });

        // Update local unread count immediately
        setChats(prev => {
            const accountChats = prev[selectedAccountId] || [];
            const chatIndex = accountChats.findIndex(c => c.id === selectedChatId);
            if (chatIndex !== -1 && accountChats[chatIndex].unread > 0) {
                const newAccountChats = [...accountChats];
                newAccountChats[chatIndex] = { ...newAccountChats[chatIndex], unread: 0 };
                return { ...prev, [selectedAccountId]: newAccountChats };
            }
            return prev;
        });

        // Safety timeout (Reduced to 2 seconds for snappier feedback)
        const timer = setTimeout(() => {
            // Check if we are still waiting for THIS chat
            if (selectedChatIdRef.current === selectedChatId) {
                console.warn(`[App] Timeout waiting for messages: ${selectedChatId}`);
                setIsLoadingMessages((prev) => {
                    if (prev) {
                        // Only turn off if still loading
                        return false;
                    }
                    return prev;
                });
            }
        }, 2000);
        
        return () => clearTimeout(timer);
    };

    return fetchMessages();
  }, [selectedChatId, selectedAccountId, socket]);

  const handleChatClick = (chat) => {
    try {
        console.log(`[App] Chat clicked: ${chat.id}`);
        // USER REQUEST: Always set the FULL chat object
        setActiveChat(chat);
        setSelectedChatId(chat.id);
        // selectedChatIdRef is updated via its own useEffect
    } catch (error) {
        console.error("Error in handleChatClick:", error);
    }
  }

  const translateText = async (text, targetLang) => {
      try {
          // VPS DEPLOYMENT: Use relative path
          const response = await fetch('/translate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text, targetLang })
          });
          const data = await response.json();
          return data.translatedText;
      } catch (error) {
          console.error("Translation failed", error);
          return text;
      }
  };

  // Auto-Translation Effect
  useEffect(() => {
      const runAutoTranslate = async () => {
          if (!selectedChatId || !autoTranslate[selectedChatId] || !activeChatMessages.length) return;
          
          const targetLang = chatLanguages[selectedChatId] || 'en';
          
          // Identify messages that need translation (incoming, not yet translated, not currently translating)
          const messagesToTranslate = activeChatMessages.map((msg, idx) => ({ msg, idx }))
              .filter(({ msg }) => !msg.fromMe && !msg.translatedBody && !msg.isTranslating);
          
          if (messagesToTranslate.length === 0) return;

          // Mark as translating to prevent duplicate fetches
          setActiveChatMessages(prev => {
              const next = [...prev];
              messagesToTranslate.forEach(({ idx }) => {
                  if (next[idx]) next[idx] = { ...next[idx], isTranslating: true };
              });
              return next;
          });

          // Perform translations
          const results = await Promise.all(messagesToTranslate.map(async ({ msg, idx }) => {
              const translated = await translateText(msg.body, targetLang);
              return { idx, translated };
          }));

          // Update state with results
          setActiveChatMessages(prev => {
              const next = [...prev];
              results.forEach(({ idx, translated }) => {
                  if (next[idx]) {
                      next[idx] = { 
                          ...next[idx], 
                          translated: true, 
                          translatedBody: translated,
                          isTranslating: false 
                      };
                  }
              });
              return next;
          });
      };

      runAutoTranslate();
  }, [activeChatMessages, autoTranslate, selectedChatId, chatLanguages]);

  const handleTranslateInput = async () => {
      if (!messageInput) return;
      const targetLang = chatLanguages[selectedChatId] || 'en';
      const translated = await translateText(messageInput, targetLang);
      setMessageInput(translated);
  };

  const handleSendMessage = () => {
    // GUARD: Ensure all necessary state is present
    if (!messageInput.trim()) {
        console.warn('[App] Send attempt blocked: Missing input');
        return;
    }
    
    // USER REQUEST: Hard block sending if no active chat or chat ID
    if (!activeChat || !activeChat.id) {
         console.warn("Send blocked: no active chat", activeChat);
         alert("Select a chat first");
         return;
    }
    
    // USER REQUEST: Safe access for markedUnread (using unread property as proxy)
    const unread = activeChat?.unread || 0; 

    // LOG: Active chat before send
    console.log('ActiveChat before send:', activeChat);

    const tempMessage = {
        id: `temp-${Date.now()}`,
        body: messageInput,
        fromMe: true,
        timestamp: Math.floor(Date.now() / 1000),
        pending: true
    };

    console.log('[App] Optimistic update for message:', tempMessage);

    // Optimistic Update: Append immediately but with PENDING status
    setActiveChatMessages(prev => [...prev, tempMessage]);

    // Update Chat List Preview immediately
    setChats(prev => {
        const accountChats = prev[selectedAccountId] || [];
        const chatIndex = accountChats.findIndex(c => c.id === activeChat.id);
        
        if (chatIndex !== -1) {
             const newAccountChats = [...accountChats];
             const updatedChat = { 
                 ...newAccountChats[chatIndex], 
                 message: messageInput,
                 time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                 unread: 0
             };
             // Move to top
             newAccountChats.splice(chatIndex, 1);
             newAccountChats.unshift(updatedChat);
        }
        return prev; // Defer to real update on ACK
    });

    socket.emit('send-message', { accountId: selectedAccountId, chatId: activeChat.id, message: messageInput });
    setMessageInput('');
  };


  const handleContextMenu = (e, accountId) => {
    e.preventDefault()
    setContextMenu({
      visible: true,
      x: e.pageX,
      y: e.pageY,
      accountId
    })
  }

  const handleDeleteAccount = () => {
    const accountId = contextMenu.accountId
    if (!accountId) return

    if (window.confirm('Are you sure you want to delete this account?')) {
       // Remove from lists
       setLists(prev => ({
         ...prev,
         [activePlatform]: prev[activePlatform].filter(a => a.id !== accountId)
       }))
       
       // Remove from chats
       setChats(prev => {
         const newChats = { ...prev }
         delete newChats[accountId]
         return newChats
       })

       // Notify server
       if (socket) {
         socket.emit('delete-session', { accountId })
       }

       // Reset selection if needed
       if (selectedAccountId === accountId) {
         setSelectedAccountId(null)
         setSelectedChatId(null)
       }
    }
  }

  const handleRefreshAccount = () => {
     const accountId = contextMenu.accountId
     if (socket && accountId) {
       console.log('Refreshing session for', accountId)
       socket.emit('start-session', { accountId })
     }
  }


  const currentPlatform = socialPlatforms.find(p => p.id === activePlatform)
  const currentAccount = selectedAccountId ? lists[activePlatform].find(a => a.id === selectedAccountId) : null
  // Default isConnected to true for existing accounts without the property to prevent breaking
  const isAccountConnected = currentAccount ? (currentAccount.isConnected !== undefined ? currentAccount.isConnected : true) : false
  const currentChats = (selectedAccountId && isAccountConnected) ? (chats[selectedAccountId] || []) : []
  const selectedChat = selectedChatId ? currentChats.find(c => c.id === selectedChatId) : null

  // Filter chats
  const filteredChats = currentChats.filter(chat => {
    const chatName = chat.name || ''
    const chatMessage = chat.message || ''
    const matchesSearch = chatName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          chatMessage.toLowerCase().includes(searchQuery.toLowerCase())
    
    if (!matchesSearch) return false
    
    if (chatFilter === 'unread') return chat.unread > 0
    if (chatFilter === 'read') return chat.unread === 0
    return true
  })

  return (
    <div className="app-container">
      {/* 1. Primary Sidebar (Platform Selector) */}
      <aside className="sidebar">
        <ul className="social-list">
          {socialPlatforms.map((social) => (
            <li key={social.id} className="social-item">
              <button 
                className={`social-link ${activePlatform === social.id ? 'active' : ''}`}
                style={{ '--hover-color': social.color }}
                title={social.name}
                onClick={() => handlePlatformClick(social.id)}
              >
                <span className="icon">{social.icon}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* 2. Secondary Sidebar (Account List) */}
      <aside className="secondary-sidebar">
        <div className="sidebar-header">
          <h3>{currentPlatform?.name}</h3>
        </div>
        <button className="add-button" onClick={addBox} style={{ backgroundColor: currentPlatform?.color }}>
          <FaPlus /> <span>Add {currentPlatform?.name}</span>
        </button>
        <div className="box-list">
          {lists[activePlatform].length === 0 ? (
            <div className="empty-state">No accounts yet</div>
          ) : (
            lists[activePlatform].map((box) => (
              <div 
                key={box.id} 
                className={`box-item ${selectedAccountId === box.id ? 'active' : ''}`}
                onClick={() => handleAccountClick(box.id)}
                onContextMenu={(e) => handleContextMenu(e, box.id)}
              >
                <div className="box-avatar" style={{ color: currentPlatform?.color }}>
                   {currentPlatform?.icon}
                </div>
                <div className="box-content">
                  <div className="box-title">{box.title}</div>
                  <div className="box-subtitle">{box.subtitle}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* 3. Chat List Sidebar (Visible only when account selected AND connected) */}
      {selectedAccountId && isAccountConnected && (
        <aside className="chat-sidebar">
          <div className="chat-header">
            <div className="search-container">
              <FaSearch className="search-icon" />
              <input 
                type="text" 
                placeholder="Search chat..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="filter-tabs">
              <button 
                className={`filter-tab ${chatFilter === 'all' ? 'active' : ''}`}
                onClick={() => setChatFilter('all')}
              >
                All
              </button>
              <button 
                className={`filter-tab ${chatFilter === 'unread' ? 'active' : ''}`}
                onClick={() => setChatFilter('unread')}
              >
                Unread
              </button>
              <button 
                className={`filter-tab ${chatFilter === 'read' ? 'active' : ''}`}
                onClick={() => setChatFilter('read')}
              >
                Read
              </button>
            </div>
          </div>

          <div className="chat-list">
            {filteredChats.length === 0 ? (
              <div className="empty-state">No chats found</div>
            ) : (
              filteredChats.map(chat => (
                <div 
                  key={chat.id} 
                  className={`chat-item ${selectedChatId === chat.id ? 'active' : ''}`}
                  onClick={() => handleChatClick(chat)}
                >
                  <div className="chat-avatar" style={{ backgroundColor: chat.avatarColor }}>
                    {(chat.name || '?').charAt(0)}
                  </div>
                  <div className="chat-content">
                    <div className="chat-top">
                      <span className="chat-name">{chat.name}</span>
                      <span className="chat-time">{chat.time}</span>
                    </div>
                    <div className="chat-bottom">
                      <span className="chat-message">{chat.message}</span>
                      {chat.unread > 0 ? (
                        <span className="unread-badge">{chat.unread}</span>
                      ) : (
                        <span className="read-status"><FaCheckDouble /></span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      )}

      {/* 4. Main Content Area */}
      <main className="main-content">
        {selectedAccountId ? (
          !isAccountConnected ? (
            <div className="qr-code-view">
              <h2>Connect {currentPlatform?.name}</h2>
              <p>Open {currentPlatform?.name} on your phone and scan the QR code to connect.</p>
              
              <div className="qr-container">
                {qrCodeData ? (
                  <QRCodeCanvas 
                    value={qrCodeData} 
                    size={256}
                    level={"H"}
                    includeMargin={true}
                  />
                ) : (
                   <div style={{ width: 256, height: 256, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0' }}>
                      <p>Loading WhatsApp QR...</p>
                   </div>
                )}
              </div>

              <div className="instructions">
                <ol>
                  <li>Open {currentPlatform?.name} on your phone</li>
                  <li>Tap Menu or Settings and select Linked Devices</li>
                  <li>Tap on Link a Device</li>
                  <li>Point your phone to this screen to capture the code</li>
                </ol>
              </div>
            </div>
          ) : (
            (selectedChatId && selectedChat) ? (
              <div className="chat-conversation">
                <div className="chat-conversation-header">
                  <div className="avatar" style={{ backgroundColor: selectedChat.avatarColor || '#cbd5e1' }}>
                     {(selectedChat.name || '?').charAt(0)}
                  </div>
                  <div className="name">{selectedChat.name}</div>
                  <div style={{ marginLeft: 'auto', position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <button 
                          onClick={() => setShowLangSelector(!showLangSelector)} 
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2em', padding: '10px' }}
                          title="Translation Settings"
                      >
                          <FaGlobe color="#54656f" />
                      </button>
                      {showLangSelector && (
                          <div style={{
                              position: 'absolute', right: 0, top: '100%', background: 'white', border: '1px solid #ccc', 
                              padding: '15px', borderRadius: '8px', zIndex: 100, width: '220px', 
                              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                          }}>
                              <div style={{ marginBottom: '8px', fontWeight: 'bold', fontSize: '0.9em' }}>Target Language</div>
                              <select 
                                  value={chatLanguages[selectedChatId] || 'en'} 
                                  onChange={(e) => setChatLanguages({ ...chatLanguages, [selectedChatId]: e.target.value })}
                                  style={{ width: '100%', padding: '8px', marginBottom: '15px', borderRadius: '4px', border: '1px solid #ddd' }}
                              >
                                  {SUPPORTED_LANGUAGES.map(lang => (
                                      <option key={lang.code} value={lang.code}>{lang.name}</option>
                                  ))}
                              </select>
                              
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setAutoTranslate({ ...autoTranslate, [selectedChatId]: !autoTranslate[selectedChatId] })}>
                                  <input 
                                      type="checkbox" 
                                      checked={autoTranslate[selectedChatId] || false} 
                                      readOnly
                                  />
                                  <label style={{ fontSize: '0.9em', cursor: 'pointer' }}>Auto-translate Incoming</label>
                              </div>
                          </div>
                      )}
                  </div>
                </div>
                
                <div className="chat-messages-area" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundRepeat: 'repeat' }}>
                   {isLoadingMessages ? (
                      <div style={{ textAlign: 'center', color: '#666', marginTop: '2rem' }}>
                        Loading messages...
                      </div>
                   ) : (!activeChatMessages || activeChatMessages.length === 0) ? (
                       <div style={{ textAlign: 'center', color: '#888', marginTop: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                         <div>No messages loaded (or chat is empty)</div>
                         {selectedChatId && (
                             <button 
                                 onClick={() => {
                                     if (socket && selectedAccountId && selectedChatId) {
                                         console.log('[App] Manual Retry Fetch');
                                         setIsLoadingMessages(true);
                                         socket.emit('fetch-messages', { accountId: selectedAccountId, chatId: selectedChatId });
                                     }
                                 }}
                                 style={{ padding: '8px 16px', background: '#00a884', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                             >
                                 Retry Loading
                             </button>
                         )}
                       </div>
                    ) : (
                      activeChatMessages.map((msg, idx) => {
                        if (!msg) return null; // Safety check
                        return (
                        <div key={msg.id || idx} className={`message-bubble ${msg.fromMe ? 'sent' : 'received'}`}>
                           <div className="message-text">
                              {msg.translated ? (
                                  <div>
                                      <div style={{ fontSize: '0.8em', color: '#666', marginBottom: '4px' }}>Original:</div>
                                      {msg.body}
                                      <div style={{ borderTop: '1px solid #ccc', marginTop: '4px', paddingTop: '4px', fontWeight: 'bold' }}>
                                          Translated: {msg.translatedBody || 'Translating...'}
                                      </div>
                                  </div>
                              ) : (
                                  msg.body || ''
                              )}
                           </div>
                           <div className="message-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                               <button 
                                   onClick={async () => {
                                       const newMessages = [...activeChatMessages];
                                       const currentMsg = newMessages[idx];
                                       
                                       if (currentMsg.translated) {
                                           currentMsg.translated = false;
                                           setActiveChatMessages(newMessages);
                                       } else {
                                           if (currentMsg.translatedBody) {
                                               currentMsg.translated = true;
                                               setActiveChatMessages(newMessages);
                                           } else {
                                               const targetLang = chatLanguages[selectedChatId] || 'en';
                                               const translated = await translateText(currentMsg.body, targetLang);
                                               currentMsg.translated = true;
                                               currentMsg.translatedBody = translated;
                                               setActiveChatMessages(newMessages);
                                           }
                                       }
                                   }}
                                   style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '0.7em' }}
                                   title="Translate Message"
                               >
                                   🌐 Translate
                               </button>
                           </div>
                           <div className="message-time">
                              {msg.timestamp ? new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sending...'}
                              {msg.pending && <span style={{ marginLeft: '4px' }}>🕒</span>}
                           </div>
                        </div>
                        )
                      })
                   )}
                </div>

                <div className="chat-input-area">
                  <input 
                    type="text" 
                    placeholder="Type a message" 
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !(!activeChat) && handleSendMessage()}
                    disabled={!activeChat}
                  />
                  <button 
                    onClick={handleTranslateInput}
                    disabled={!activeChat || !messageInput}
                    style={{ background: 'none', border: 'none', cursor: (!activeChat || !messageInput) ? 'default' : 'pointer', marginRight: '10px', opacity: (!activeChat || !messageInput) ? 0.3 : 1 }}
                    title="Translate to Target Language"
                  >
                    <FaGlobe size={20} color="#54656f" />
                  </button>
                  <button 
                    className="send-button" 
                    onClick={handleSendMessage}
                    disabled={!activeChat}
                    style={{ opacity: !activeChat ? 0.5 : 1, cursor: !activeChat ? 'not-allowed' : 'pointer' }}
                  >
                    <FaPaperPlane />
                  </button>
                </div>
              </div>
            ) : (
              <div className="empty-chat-view">
                 <h2>Select a chat to start messaging</h2>
                 <p>Send and receive messages without keeping your phone online.</p>
              </div>
            )
          )
        ) : (
          <div className="welcome-view">
            <h1>{currentPlatform?.name} Dashboard</h1>
            <p>Select an account from the list to view details.</p>
            <div className="stats-card">
              <h2>Total {currentPlatform?.name} Accounts</h2>
              <p className="stat-number">{lists[activePlatform].length}</p>
            </div>
          </div>
        )}
      </main>
      
      {contextMenu.visible && (
        <div 
          className="context-menu" 
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
        >
          <div className="menu-item" onClick={() => { handleRefreshAccount(); setContextMenu({ ...contextMenu, visible: false }); }}>
             Refresh
          </div>
          <div className="menu-item delete" onClick={() => { handleDeleteAccount(); setContextMenu({ ...contextMenu, visible: false }); }}>
             Delete Account
          </div>
        </div>
      )}
    </div>
  )
}

export default App
