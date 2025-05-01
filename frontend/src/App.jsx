// frontend/src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { Box } from '@mui/material';
import Header from './components/Header';
// import ChatWindow from './components/ChatWindow';
import Register from './pages/Register';
import Login from './pages/Login';
// import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import KnowledgeBases from './pages/KnowledgeBases';
import Departments from './pages/Departments';
import UserChat from './pages/UserChat';

const theme = createTheme({
    palette: {
        primary: {
            main: '#1976d2',
        },
    },
});

const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem('authToken');
    return token ? children : <Navigate to="/login" />;
};

function App() {
    return (
        <ThemeProvider theme={theme}>
            <Router>
                <Header />
                <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
                    <Routes>
                        <Route path="/register" element={<Register />} />
                        <Route path="/login" element={<Login />} />
                        {/*<Route path="/dashboard"*/}
                        {/*    element={*/}
                        {/*        <ProtectedRoute>*/}
                        {/*            <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'stretch', m: 4 }}>*/}
                        {/*                <Dashboard />*/}
                        {/*                <ChatWindow />*/}
                        {/*            </Box>*/}
                        {/*        </ProtectedRoute>*/}
                        {/*    }*/}
                        {/*/>*/}
                        <Route path="/" element={
                            <ProtectedRoute>
                                <UserChat />
                            </ProtectedRoute>
                        } />
                        <Route
                            path="/users"
                            element={
                                <ProtectedRoute>
                                    <Users />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/knowledge-bases"
                            element={
                                <ProtectedRoute>
                                    <KnowledgeBases />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/departments"
                            element={
                                <ProtectedRoute>
                                    <Departments />
                                </ProtectedRoute>
                            }
                        />
                        {/*<Route path="*" element={<Navigate to="/dashboard" />} />*/}
                        <Route path="/chat" element={<UserChat />} />
                    </Routes>

                </Box>
            </Router>
        </ThemeProvider>
    );
}

export default App;
