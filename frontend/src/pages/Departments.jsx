// frontend/src/pages/Departments.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Container, Typography, Paper, Box, TextField, Button, Alert, List, ListItem, ListItemText } from '@mui/material';
import { useAuth } from '../context/AuthContext';

function Departments() {
    const { auth } = useAuth();
    const [departments, setDepartments] = useState([]);
    const [newDept, setNewDept] = useState('');
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchDepartments = async () => {
            try {
                const res = await axios.get('/api/departments', {
                    headers: { Authorization: `Bearer ${auth.token}` }
                });
                setDepartments(res.data);
            } catch (err) {
                console.error('Failed to fetch departments', err);
            }
        };
        fetchDepartments();
    }, [auth.token]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post('/api/departments', { name: newDept }, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            setDepartments((prev) => [...prev, res.data]);
            setNewDept('');
            setSuccess('Department added successfully');
            setError('');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to add department');
            setSuccess('');
        }
    };

    return (
        <Container maxWidth="sm">
            <Paper elevation={3} sx={{ padding: 4, mt: 4 }}>
                <Typography variant="h5" gutterBottom>Manage Departments</Typography>
                <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <TextField
                        label="New Department"
                        value={newDept}
                        onChange={(e) => setNewDept(e.target.value)}
                        required
                        fullWidth
                    />
                    <Button type="submit" variant="contained">Add</Button>
                </Box>
                {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <Typography variant="h6">Existing Departments</Typography>
                <List>
                    {departments.map((dept) => (
                        <ListItem key={dept.id}>
                            <ListItemText primary={dept.name} />
                        </ListItem>
                    ))}
                </List>
            </Paper>
        </Container>
    );
}

export default Departments;
