const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config(); // Load .env variables

const app = express();
app.use(cors());
app.use(express.json());

// Middleware
const authenticateToken = require('./middleware/auth');

// Route imports
const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/account');
const userRoutes = require('./routes/users');
const chatRoutes = require('./routes/chat');
const modelRoutes = require('./routes/models');
const departmentRoutes = require('./routes/departments');
const sessionRoutes = require('./routes/chatSessions');
const storageRoutes = require('./routes/storage');
const knowledgeBaseRoutes = require('./routes/knowledgeBase');
const kbUploadRoutes = require('./routes/kbUploadRag');

// Route registration
app.use('/api/auth', authRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/chat-sessions', sessionRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/knowledge-bases', knowledgeBaseRoutes);
app.use('/api/knowledge-bases/upload', kbUploadRoutes); // Optional: nested route

// Server start
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
});