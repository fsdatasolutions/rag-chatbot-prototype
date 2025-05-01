// frontend/src/pages/Login.jsx
import React, { useState } from 'react';
import axios from 'axios';
import { Box, Button, Container, TextField, Typography, Paper, Alert } from '@mui/material';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function Login() {
    const [form, setForm] = useState({ email: '', password: '' });
    const [error, setError] = useState('');

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post('http://localhost:5001/api/auth/login', form);
            localStorage.setItem('authToken', res.data.token);
            setError('');
            toast.success('Logged in! Redirecting...');
            setTimeout(() => window.location.href = '/dashboard', 1500);
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed');
        }
    };

    return (
        <Container maxWidth="sm">
            <ToastContainer />
            <Paper elevation={3} sx={{ padding: 4, mt: 8 }}>
                <Typography variant="h4" gutterBottom>Log In</Typography>
                <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField name="email" label="Email" value={form.email} onChange={handleChange} required fullWidth />
                    <TextField name="password" label="Password" type="password" value={form.password} onChange={handleChange} required fullWidth />
                    <Button type="submit" variant="contained" color="primary">Log In</Button>
                </Box>
                {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            </Paper>
        </Container>
    );
}

export default Login;
