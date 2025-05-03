// frontend/src/pages/UserChat.jsx
import React, { useEffect, useState, useRef } from 'react';
import {
    Box,
    Typography,
    Paper,
    TextField,
    Button,
    CircularProgress,
    IconButton
} from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function UserChat() {
    const { auth, loading: authLoading } = useAuth();
    const [kbId, setKbId] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [selectedSessionId, setSelectedSessionId] = useState(null);
    const [sessionId, setSessionId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef();

    useEffect(() => {
        if (!auth.token) return;

        const fetchData = async () => {
            try {
                // 1. Fetch KBs
                // const kbRes = await axios.get('http://localhost:5001/api/knowledge-bases/user-accessible', {
                //     headers: { Authorization: `Bearer ${auth.token}` }
                // });
                //
                // if (kbRes.data.length > 0) {
                //     setKbId(kbRes.data[0].id);
                //     console.log('[✅ KB SET]', kbRes.data[0].id);
                // } else {
                //     console.warn('No accessible KBs available for this user.');
                // }

                // 2. Fetch chat sessions
                const sessionsRes = await axios.get('http://localhost:5001/api/chat-sessions', {
                    headers: { Authorization: `Bearer ${auth.token}` }
                });

                setSessions(sessionsRes.data);
                console.log('[✅ Chat sessions]', sessionsRes.data);

                // 3. Auto-select latest session (optional)
                if (sessionsRes.data.length > 0) {
                    setSelectedSessionId(sessionsRes.data[0].id);
                }

            } catch (err) {
                console.error('[❌ Fetch Init Error]', err);
            }
        };

        fetchData();
    }, [auth.token]);

// Load messages for selected session
    useEffect(() => {
        if (!auth.token || !selectedSessionId) return;

        const loadMessages = async () => {
            try {
                const res = await axios.get(`http://localhost:5001/api/chat-sessions/${selectedSessionId}`, {
                    headers: { Authorization: `Bearer ${auth.token}` }
                });
                const formatted = res.data.map(msg => ({
                    role: msg.role,
                    text: msg.content
                }));
                setMessages(formatted);
                setSessionId(selectedSessionId);
                console.log('[✅ Loaded Messages]', formatted);
            } catch (err) {
                console.error('[❌ Failed to load messages]', err);
            }
        };

        loadMessages();
    }, [selectedSessionId, auth.token]);

// Show loading state
    if (authLoading) return <div>Loading...</div>;

    const sendMessage = async () => {
        if (!input.trim()) return;
        console.log('Clicked');
        console.log('[Payload]', {
            query: input,
            sessionId,
            ...(sessionId ? {} : { knowledgeBaseId: kbId }) // optional if no session yet
        });

        setLoading(true);
        const userMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');

        try {
            const res = await axios.post(
                'http://localhost:5001/api/chat',
                {
                    query: input,
                    sessionId,
                    ...(sessionId ? {} : { knowledgeBaseId: kbId }) // only needed when starting a new session
                },
                {
                    headers: { Authorization: `Bearer ${auth.token}` }
                }
            );

            const botMessage = { role: 'assistant', text: res.data.answer };
            setMessages(prev => [...prev, botMessage]);

            if (res.data.sessionId && !sessionId) {
                setSessionId(res.data.sessionId);
            }
        } catch (err) {
            console.error('Chat failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        console.log('File selected:', file);
    };

    return (
        <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
            {/* Sidebar */}
            <Box sx={{ width: 300, borderRight: '1px solid #ddd', p: 2, overflowY: 'auto' }}>
                <Button
                    fullWidth
                    variant="contained"
                    color="primary"
                    sx={{ mb: 2, textTransform: 'none' }}
                    onClick={() => {
                        setMessages([]);
                        setSessionId(null);
                        setSelectedSessionId(null);
                    }}
                >
                    + New Chat
                </Button>
                <Typography variant="h6" gutterBottom>
                    Chat History
                </Typography>
                {sessions.map(session => (
                    <Button
                        key={session.id}
                        fullWidth
                        variant={session.id === selectedSessionId ? 'contained' : 'outlined'}
                        sx={{ mb: 1, textTransform: 'none', justifyContent: 'flex-start' }}
                        onClick={() => setSelectedSessionId(session.id)}
                    >
                        {session.title || 'Untitled'}
                    </Button>
                ))}
            </Box>

            {/* Chat Window */}
            <Box sx={{ flex: 1, p: 3, display: 'flex', flexDirection: 'column' }}>
                <Paper elevation={3} sx={{ flex: 1, p: 3, display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="h5" gutterBottom>
                        Virtual Assistant
                    </Typography>

                    <Box
                        sx={{
                            flexGrow: 1,
                            overflowY: 'auto',
                            mb: 2,
                            p: 1,
                            border: '1px solid #ddd',
                            borderRadius: 1,
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                    >
                        {messages.map((msg, idx) => (
                            <Box
                                key={idx}
                                sx={{
                                    backgroundColor: msg.role === 'user' ? '#e0f7fa' : '#f1f8e9',
                                    p: 1.5,
                                    mb: 1,
                                    borderRadius: 1,
                                    maxWidth: '80%',
                                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start'
                                }}
                                dangerouslySetInnerHTML={{ __html: msg.text }}
                            />
                        ))}
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconButton component="label">
                            <AttachFileIcon />
                            <input hidden type="file" ref={fileInputRef} onChange={handleFileUpload} />
                        </IconButton>
                        <TextField
                            fullWidth
                            placeholder="Type your message..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                        />
                        <Button variant="contained" onClick={sendMessage} disabled={loading}>
                            {loading ? <CircularProgress size={20} /> : 'Send'}
                        </Button>
                    </Box>
                </Paper>
            </Box>
        </Box>
    );
}

export default UserChat;