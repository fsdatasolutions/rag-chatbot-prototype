// frontend/src/pages/UserChat.jsx
import React, { useEffect, useState, useRef } from 'react';
import { Box, Container, Typography, Paper, TextField, Button, CircularProgress, IconButton } from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function UserChat() {
    const { auth } = useAuth();
    const [kbId, setKbId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef();

    useEffect(() => {
        const loadContext = async () => {
            try {
                const res = await axios.get('http://localhost:5001/api/knowledge-bases/user-accessible', {
                    headers: { Authorization: `Bearer ${auth.token}` }
                });
                if (res.data.length > 0) {
                    setKbId(res.data[0].id); // Auto-select first accessible KB
                }
            } catch (err) {
                console.error('Failed to load KBs:', err);
            }
        };
        loadContext();
    }, [auth.token]);

    const sendMessage = async () => {
        if (!input.trim()) return;
        setLoading(true);
        const userMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');

        try {
            const res = await axios.post('http://localhost:5001/api/chat', {
                query: input,
                knowledgeBaseId: kbId,
                history: messages // optional for multi-turn
            }, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            const botMessage = { role: 'assistant', text: res.data.answer };
            setMessages(prev => [...prev, botMessage]);
        } catch (err) {
            console.error('Chat failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        console.log('File selected:', file);
        // Handle file processing or upload here
    };

    return (
        <Container maxWidth="md">
            <Paper elevation={3} sx={{ mt: 4, p: 3 }}>
                <Typography variant="h5" gutterBottom>Virtual Assistant</Typography>
                <Box sx={{ minHeight: 300, maxHeight: 500, overflowY: 'auto', mb: 2, p: 1, border: '1px solid #ddd', borderRadius: 1 }}>
                    {messages.map((msg, idx) => (
                        <Typography key={idx} align={msg.role === 'user' ? 'right' : 'left'}>
                            <strong>{msg.role === 'user' ? 'You' : 'Assistant'}:</strong> {msg.text}
                        </Typography>
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
        </Container>
    );
}

export default UserChat;
