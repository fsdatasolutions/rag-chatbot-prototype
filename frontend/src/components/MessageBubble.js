// frontend/src/components/MessageBubble.js
import React from 'react';
import { Box, Typography } from '@mui/material';

function MessageBubble({ role, content }) {
    const isUser = role === 'user';
    return (
        <Box
            sx={{
                display: 'inline-block',
                padding: '8px 12px',
                borderRadius: isUser ? '16px 16px 0 16px' : '16px 16px 16px 0',
                backgroundColor: isUser ? '#1976d2' : '#f0f0f0',
                color: isUser ? '#fff' : '#000',
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                marginBottom: '8px'
            }}
        >
            <Typography variant="body1" style={{ whiteSpace: 'pre-wrap' }}>
                {content}
            </Typography>
        </Box>
    );
}

export default MessageBubble;