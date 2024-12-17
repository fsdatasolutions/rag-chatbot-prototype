import React, { useState, useEffect, useRef } from 'react';
import './ChatWindow.css';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'; // Material-UI icon
import CloseIcon from '@mui/icons-material/Close'; // Close icon

function ChatWindow() {
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);

    // Ref for scrolling to the bottom of the chat window
    const scrollRef = useRef(null);

    // Automatically scroll to the bottom when messages change
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleSend = async () => {
        if (!query.trim()) return;

        const userMessage = { role: 'user', content: query };
        setMessages((prev) => [...prev, userMessage]);
        setQuery('');
        setLoading(true);

        try {
            const response = await fetch('http://localhost:5001/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query }),
            });

            const data = await response.json();
            const botMessage = { role: 'bot', content: data.answer };
            setMessages((prev) => [...prev, botMessage]);
        } catch (error) {
            console.error("Error fetching response:", error);
            setMessages((prev) => [
                ...prev,
                { role: 'bot', content: 'Error fetching response. Please try again.' },
            ]);
        } finally {
            setLoading(false);
        }
    };

    // Function to render messages with proper formatting
    const renderMessage = (content) => {
        return content.split('\n').map((line, idx) => {
            const trimmedLine = line.trim();

            // Skip empty lines
            if (!trimmedLine) return null;

            // Check for pre-existing numbering like "1. Text"
            const hasPreNumbering = /^\d+\.\s/.test(trimmedLine);

            if (hasPreNumbering) {
                // Render as plain paragraph text if numbering already exists
                return <p key={idx}>{trimmedLine}</p>;
            } else if (line.startsWith('-')) {
                // Render bullet points
                return <li key={idx}>{trimmedLine.substring(1).trim()}</li>;
            } else {
                // Render regular text as paragraph
                return <p key={idx}>{trimmedLine}</p>;
            }
        });
    };

    return (
        <div>
            {/* Collapsed Chat Bubble */}
            {!isChatOpen && (
                <div className="chat-bubble" onClick={() => setIsChatOpen(true)}>
                    <ChatBubbleOutlineIcon fontSize="large" />
                </div>
            )}

            {/* Expanded Chat Window */}
            {isChatOpen && (
                <div className="chat-container">
                    <div className="chat-header">
                        <span>Student Support Chatbot</span>
                        <CloseIcon className="close-icon" onClick={() => setIsChatOpen(false)} />
                    </div>
                    <div className="chat-messages">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`message ${msg.role}`}>
                                {msg.role === 'bot' ? <div>{renderMessage(msg.content)}</div> : msg.content}
                            </div>
                        ))}
                        {loading && <div className="loading-spinner">Loading...</div>}
                        {/* Scroll Anchor */}
                        <div ref={scrollRef} />
                    </div>
                    <div className="chat-input">
                        <input
                            type="text"
                            placeholder="Type your message..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        />
                        <button onClick={handleSend} disabled={loading}>
                            {loading ? "Sending..." : "Send"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ChatWindow;