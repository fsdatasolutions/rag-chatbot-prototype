// frontend/src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [auth, setAuth] = useState({ token: null, userId: null, accountId: null, role: null });

    useEffect(() => {
        const token = localStorage.getItem('authToken');
        if (token) {
            try {
                const decoded = jwtDecode(token);
                setAuth({
                    token,
                    userId: decoded.userId,
                    accountId: decoded.accountId,
                    role: decoded.role
                });
            } catch (err) {
                console.error('Failed to decode token:', err);
                localStorage.removeItem('authToken');
            }
        }
    }, []);

    const logout = () => {
        localStorage.removeItem('authToken');
        setAuth({ token: null, userId: null, accountId: null, role: null });
    };

    return (
        <AuthContext.Provider value={{ auth, setAuth, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
