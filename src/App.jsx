import React, { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, Phone, Video, Search, MoreVertical, ArrowLeft, Check, CheckCheck, Smile, Mic, X, File, Download, Loader, LogOut } from 'lucide-react';
import { supabase } from './lib/supabase';

const App = () => {
  // Auth State
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [authError, setAuthError] = useState('');

  // App State
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [fullscreenMedia, setFullscreenMedia] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Refs
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Check existing session
  useEffect(() => {
    checkUser();
    
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  // ACCESSO SEMPLIFICATO: Solo username, niente email/password
  const handleQuickLogin = async () => {
    if (!username.trim()) {
      setAuthError('Inserisci un nome!');
      return;
    }

    setAuthError('');
    setLoading(true);

    try {
      // Genera email fittizia basata sul nome
      const fakeEmail = `${username.toLowerCase().replace(/\s+/g, '')}@famiglia.local`;
      const fakePassword = 'famiglia123'; // Password fissa uguale per tutti

      // Prova prima a fare login
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: fakeEmail,
        password: fakePassword
      });

      // Se login fallisce, probabilmente l'utente non esiste → crealo
      if (loginError) {
        const { data: signupData, error: signupError } = await supabase.auth.signUp({
          email: fakeEmail,
          password: fakePassword,
          options: {
            data: {
              display_name: username
            },
            emailRedirectTo: undefined // Disabilita email di conferma
          }
        });

        if (signupError) throw signupError;

        // Se signup richiede conferma email, mostra errore
        if (signupData?.user && !signupData?.session) {
          throw new Error('Devi confermare email. Vai su Supabase e disabilita "Confirm email"!');
        }
      }

      // Successo!
      setUsername('');
      
    } catch (error) {
      console.error('Auth error:', error);
      setAuthError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setChats([]);
    setMessages([]);
    setSelectedChat(null);
  };

  // Load chats
  useEffect(() => {
    if (user) {
      loadChats();
      subscribeToNewMessages();
    }
  }, [user]);

  const loadChats = async () => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const chatList = profiles?.map(profile => ({
        id: `${user.id}_${profile.id}`,
        userId: profile.id,
        name: profile.display_name || profile.email,
        avatar: getAvatarEmoji(profile.display_name || profile.email),
        lastMessage: '',
        lastMessageTime: Date.now(),
        unreadCount: 0,
        isGroup: false
      })) || [];

      setChats(chatList);
    } catch (error) {
      console.error('Error loading chats:', error);
    }
  };

  const getAvatarEmoji = (name) => {
    const emojis = ['👨', '👩', '👦', '👧', '🧑', '👴', '👵', '🧒', '👶'];
    const index = name.charCodeAt(0) % emojis.length;
    return emojis[index];
  };

  const loadMessages = async (chatId) => {
    try {
      const [userId1, userId2] = chatId.split('_');

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${userId1},receiver_id.eq.${userId2}),and(sender_id.eq.${userId2},receiver_id.eq.${userId1})`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const subscribeToNewMessages = () => {
    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          if (selectedChat) {
            const [userId1, userId2] = selectedChat.id.split('_');
            if (payload.new.sender_id === userId2 || payload.new.sender_id === userId1) {
              setMessages(prev => [...prev, payload.new]);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedChat) return;

    const [userId1, userId2] = selectedChat.id.split('_');
    const receiverId = userId2 === user.id ? userId1 : userId2;

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          content: messageInput,
          message_type: 'text'
        })
        .select()
        .single();

      if (error) throw error;

      setMessages(prev => [...prev, data]);
      setMessageInput('');

    } catch (error) {
      console.error('Error sending message:', error);
      alert('Errore invio messaggio');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedChat) return;

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      const [userId1, userId2] = selectedChat.id.split('_');
      const receiverId = userId2 === user.id ? userId1 : userId2;

      const messageType = file.type.startsWith('image/') ? 'image' :
                         file.type.startsWith('video/') ? 'video' : 'document';

      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          content: file.name,
          message_type: messageType,
          media_url: publicUrl
        })
        .select()
        .single();

      if (error) throw error;

      setMessages(prev => [...prev, data]);

    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Errore upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleSelectChat = async (chat) => {
    setSelectedChat(chat);
    await loadMessages(chat.id);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  };

  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const emojis = ['😀', '😂', '😍', '🥰', '😎', '🤔', '👍', '❤️', '🔥', '✨', '🎉', '💯'];

  if (loading && !user) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-teal-500 via-teal-600 to-green-600">
        <div className="text-white text-center">
          <Loader className="animate-spin mx-auto mb-4" size={48} />
          <p>Caricamento...</p>
        </div>
      </div>
    );
  }

  // LOGIN SCREEN SEMPLIFICATO
  if (!user) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-teal-500 via-teal-600 to-green-600 p-4">
        <div className="bg-white rounded-3xl p-8 shadow-2xl w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-block p-4 bg-teal-500 rounded-full mb-4">
              <Send className="text-white" size={48} />
            </div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Chat Famiglia</h1>
            <p className="text-gray-500">Accesso super veloce</p>
          </div>

          <div className="space-y-4">
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-teal-800 font-medium">✨ Accesso semplificato!</p>
              <p className="text-xs text-teal-600 mt-1">Inserisci solo il tuo nome, niente email o password da ricordare</p>
            </div>

            <input
              type="text"
              placeholder="Il tuo nome (es: Marco, Laura, Nonno...)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleQuickLogin()}
              className="w-full px-4 py-3 rounded-lg bg-gray-50 border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-lg"
              autoFocus
            />

            {authError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm font-medium">{authError}</p>
                {authError.includes('conferma email') && (
                  <div className="mt-2 text-xs text-red-500">
                    <p className="font-semibold">Come risolvere:</p>
                    <ol className="list-decimal ml-4 mt-1 space-y-1">
                      <li>Vai su Supabase Dashboard</li>
                      <li>Authentication → Providers → Email</li>
                      <li>Disabilita "Confirm email"</li>
                      <li>Salva e riprova</li>
                    </ol>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleQuickLogin}
              disabled={loading || !username.trim()}
              className="w-full py-3 rounded-lg bg-teal-500 hover:bg-teal-600 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader className="animate-spin" size={20} />
                  Accesso in corso...
                </span>
              ) : (
                'Entra nella Chat'
              )}
            </button>

            <div className="pt-4 text-center">
              <p className="text-xs text-gray-500">
                💡 Prima volta? Inserisci il tuo nome e verrai registrato automaticamente!
              </p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="space-y-2 text-xs text-gray-500">
              <p className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Niente email da confermare
              </p>
              <p className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Niente password da ricordare
              </p>
              <p className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Messaggi istantanei real-time
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // MAIN APP
  return (
    <div className="h-screen w-screen flex bg-gray-100 overflow-hidden">
      <style>{`
        @media (max-width: 768px) {
          .mobile-chat-list { display: ${selectedChat ? 'none' : 'flex'}; }
          .mobile-chat-view { display: ${selectedChat ? 'flex' : 'none'}; }
        }
      `}</style>

      <div className="mobile-chat-list w-full md:w-96 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 bg-teal-600 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl">
                {getAvatarEmoji(user.user_metadata?.display_name || user.email)}
              </div>
              <div>
                <h2 className="font-semibold">{user.user_metadata?.display_name || user.email}</h2>
                <p className="text-xs text-white/80">Online</p>
              </div>
            </div>
            <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-full transition-all" title="Esci">
              <LogOut size={20} />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" size={18} />
            <input
              type="text"
              placeholder="Cerca chat"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-full bg-white/20 text-white placeholder-white/60 focus:outline-none focus:bg-white/30"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredChats.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="mb-2">👥 Nessun altro utente ancora</p>
              <p className="text-sm">Invita qualcuno a registrarsi per iniziare a chattare!</p>
            </div>
          ) : (
            filteredChats.map(chat => (
              <button
                key={chat.id}
                onClick={() => handleSelectChat(chat)}
                className={`w-full p-4 flex items-center gap-3 hover:bg-gray-50 border-b transition-all ${
                  selectedChat?.id === chat.id ? 'bg-teal-50' : ''
                }`}
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-green-500 flex items-center justify-center text-xl flex-shrink-0">
                    {chat.avatar}
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{chat.name}</p>
                  <p className="text-sm text-gray-500 truncate">{chat.lastMessage || 'Inizia una conversazione'}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="mobile-chat-view flex-1 flex flex-col bg-[#e5ddd5]">
        {selectedChat ? (
          <>
            <div className="p-4 bg-teal-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedChat(null)} className="md:hidden p-2 hover:bg-white/10 rounded-full">
                  <ArrowLeft size={20} />
                </button>
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl">
                  {selectedChat.avatar}
                </div>
                <div>
                  <h3 className="font-semibold">{selectedChat.name}</h3>
                  <p className="text-xs text-white/80">Online</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="p-2 hover:bg-white/10 rounded-full transition-all"><Video size={20} /></button>
                <button className="p-2 hover:bg-white/10 rounded-full transition-all"><Phone size={20} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">👋 Nessun messaggio ancora</p>
                  <p className="text-xs mt-1">Inizia la conversazione!</p>
                </div>
              )}
              
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] rounded-lg p-3 ${
                    msg.sender_id === user.id ? 'bg-teal-500 text-white' : 'bg-white text-gray-800'
                  }`}>
                    {msg.message_type === 'image' && msg.media_url && (
                      <div className="mb-2">
                        <img 
                          src={msg.media_url} 
                          alt="attachment" 
                          className="rounded-lg max-h-64 w-full object-cover cursor-pointer hover:opacity-90 transition-opacity" 
                          onClick={() => setFullscreenMedia(msg.media_url)}
                        />
                      </div>
                    )}
                    
                    {msg.message_type === 'video' && msg.media_url && (
                      <div className="mb-2">
                        <video src={msg.media_url} controls className="rounded-lg max-h-64 w-full" />
                      </div>
                    )}
                    
                    {msg.message_type === 'document' && msg.media_url && (
                      <a 
                        href={msg.media_url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center gap-3 p-3 bg-black/10 rounded-lg hover:bg-black/20 transition-all mb-2"
                      >
                        <File size={24} />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{msg.content}</p>
                        </div>
                        <Download size={18} />
                      </a>
                    )}
                    
                    {msg.message_type === 'text' && <p className="text-sm break-words">{msg.content}</p>}
                    
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-xs opacity-70">{formatTime(msg.created_at)}</span>
                      {msg.sender_id === user.id && <CheckCheck size={16} className="opacity-70" />}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {showEmojiPicker && (
              <div className="p-4 bg-white border-t border-gray-200">
                <div className="flex flex-wrap gap-2">
                  {emojis.map((emoji, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setMessageInput(prev => prev + emoji);
                        setShowEmojiPicker(false);
                      }}
                      className="text-2xl hover:scale-125 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 bg-white border-t border-gray-200">
              {uploading && (
                <div className="mb-2 flex items-center gap-2 text-sm text-teal-600">
                  <Loader className="animate-spin" size={16} />
                  <span>Upload in corso...</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-2 text-gray-500 hover:text-gray-700 transition-all"
                >
                  <Smile size={24} />
                </button>
                
                <input ref={fileInputRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx" className="hidden" onChange={handleFileUpload} />
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  disabled={uploading}
                  className="p-2 text-gray-500 hover:text-gray-700 transition-all disabled:opacity-50"
                >
                  <Paperclip size={24} />
                </button>
                
                <input
                  type="text"
                  placeholder="Scrivi un messaggio..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  className="flex-1 px-4 py-2 rounded-full bg-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                
                {messageInput.trim() ? (
                  <button 
                    onClick={handleSendMessage}
                    className="p-2 bg-teal-500 text-white rounded-full hover:bg-teal-600 transition-all"
                  >
                    <Send size={20} />
                  </button>
                ) : (
                  <button className="p-2 text-gray-400 rounded-full">
                    <Mic size={24} />
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center">
              <div className="inline-block p-6 bg-teal-100 rounded-full mb-4">
                <Send className="text-teal-600" size={48} />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Chat Famiglia</h3>
              <p className="text-gray-500">Seleziona una chat per iniziare a messaggiare</p>
            </div>
          </div>
        )}
      </div>

      {fullscreenMedia && (
        <div 
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4" 
          onClick={() => setFullscreenMedia(null)}
        >
          <button className="absolute top-4 right-4 p-3 bg-white/10 rounded-full hover:bg-white/20 transition-all">
            <X size={24} className="text-white" />
          </button>
          <img 
            src={fullscreenMedia} 
            alt="fullscreen" 
            className="max-h-full max-w-full rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default App;
