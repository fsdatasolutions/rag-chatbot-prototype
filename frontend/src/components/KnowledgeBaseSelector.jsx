import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
    Box,
    Typography,
    TextField,
    MenuItem,
    CircularProgress,
} from '@mui/material';

const KnowledgeBaseSelector = ({ onSelect, disabled }) => {
    const [knowledgeBases, setKnowledgeBases] = useState([]);
    const [selectedKBId, setSelectedKBId] = useState(() => sessionStorage.getItem('selectedKBId') || '');
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const fetchKBs = async () => {
            try {
                const res = await axios.get('/api/knowledge-bases/user-accessible');
                setKnowledgeBases(res.data);
                setLoading(false);
            } catch (err) {
                console.error('Failed to fetch user KBs:', err);
                setMessage('⚠️ Failed to load knowledge bases');
                setLoading(false);
            }
        };

        fetchKBs();
    }, []);

    useEffect(() => {
        if (selectedKBId) {
            sessionStorage.setItem('selectedKBId', selectedKBId);
        } else {
            sessionStorage.removeItem('selectedKBId');
        }
        onSelect(selectedKBId);
    }, [selectedKBId, onSelect]);



    const renderNotice = !selectedKBId && (
        <Typography variant="body2" sx={{ mt: 2, color: 'orange' }}>
            ⚠️ You are chatting without a knowledge base. Your responses will not include retrieved document context.
        </Typography>
    );

    return (
        <Box sx={{ p: 2, width: '100%' }}>
            <Typography variant="h6" gutterBottom>
                Knowledge Base
            </Typography>

            {loading ? (
                <CircularProgress size={24} />
            ) : (
                <TextField
                    label="Select Knowledge Base"
                    value={selectedKBId}
                    onChange={(e) => setSelectedKBId(e.target.value)}
                    select
                    fullWidth
                    disabled={disabled || knowledgeBases.length === 0}
                >
                    <MenuItem value="none">💬 Chat without Knowledge Base</MenuItem>
                    <MenuItem value="">-- None --</MenuItem>

                    {knowledgeBases.map((kb) => (
                        <MenuItem key={kb.id} value={kb.bedrockKnowledgeBaseId}>
                            {kb.name.split('_')[1] || kb.name}
                        </MenuItem>
                    ))}
                </TextField>
            )}

            {renderNotice}
            {message && (
                <Typography variant="caption" color="error">
                    {message}
                </Typography>
            )}
        </Box>
    );
};

export default KnowledgeBaseSelector;
