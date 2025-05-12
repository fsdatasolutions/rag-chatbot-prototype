// frontend/src/pages/Register.jsx
import React, { useState } from 'react';
import axios from 'axios';
import { Box, Button, Container, TextField, Typography, Paper, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ProvisioningModal from '../components/ProvisioningModal';

function Register() {
    const [form, setForm] = useState({ email: '', password: '', accountName: '' });
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const [isProvisioning, setIsProvisioning] = useState(false);


    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsProvisioning(true);
        try {
            await axios.post('http://localhost:5001/api/auth/register', form);
            toast.success('Account created! Redirecting to login...');
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            setError(err.response?.data?.error || 'Registration failed');
        } finally {
            setIsProvisioning(false);
        }
    };

    return (
        <Container maxWidth="sm">
            <ProvisioningModal show={isProvisioning} /> {/* 👈 Render modal here */}
            <ToastContainer />
            <Paper elevation={3} sx={{ padding: 4, mt: 8 }}>
                <Typography variant="h4" gutterBottom>Create Account</Typography>
                <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField name="accountName" label="Account Name" value={form.accountName} onChange={handleChange} required fullWidth />
                    <TextField name="email" label="Email" value={form.email} onChange={handleChange} required fullWidth />
                    <TextField name="password" label="Password" type="password" value={form.password} onChange={handleChange} required fullWidth />
                    <Button type="submit" variant="contained" color="primary">Register</Button>
                </Box>
                {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            </Paper>
        </Container>
    );
}

export default Register;