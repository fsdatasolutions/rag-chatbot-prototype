// frontend/src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [auth, setAuth] = useState({ token: null, user: null });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('authToken');
        if (token) {
            try {
                const decoded = jwtDecode(token);
                setAuth({
                    token,
                    user: {
                        userId: decoded.userId,
                        accountId: decoded.accountId,
                        role: decoded.role
                    }
                });
            } catch (err) {
                console.error('Failed to decode token:', err);
                localStorage.removeItem('authToken');
            }
        }
        setLoading(false); // ✅ mark as done
    }, []);

    const logout = () => {
        localStorage.removeItem('authToken');
        setAuth({ token: null, user: null  });
    };

    return (
        <AuthContext.Provider value={{ auth, setAuth, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
