// frontend/src/pages/Users.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Box, Button, Container, TextField, Typography, Paper, Alert, MenuItem, Select, InputLabel, FormControl, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';
import { useAuth } from '../context/AuthContext';

function Users() {
    const { auth } = useAuth();
    const [users, setUsers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [form, setForm] = useState({ email: '', password: '', role: 'user', departmentId: '' });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        const fetchUsersAndDepartments = async () => {
            try {
                const [usersRes, departmentsRes] = await Promise.all([
                    axios.get('http://localhost:5001/api/users', {
                        headers: { Authorization: `Bearer ${auth.token}` }
                    }),
                    axios.get('http://localhost:5001/api/departments', {
                        headers: { Authorization: `Bearer ${auth.token}` }
                    })
                ]);
                setUsers(usersRes.data);
                setDepartments(departmentsRes.data);
            } catch (err) {
                console.error(err);
            }
        };
        fetchUsersAndDepartments();
    }, [auth.token]);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post('http://localhost:5001/api/users', form, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            setForm({ email: '', password: '', role: 'user', departmentId: '' });
            setSuccess('User created successfully');
            setError('');
            const res = await axios.get('http://localhost:5001/api/users', {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            setUsers(res.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create user');
            setSuccess('');
        }
    };

    return (
        <Container maxWidth="md">
            <Paper elevation={3} sx={{ padding: 4, mt: 4 }}>
                <Typography variant="h5" gutterBottom>Create New User</Typography>
                <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField name="email" label="Email" value={form.email} onChange={handleChange} required fullWidth />
                    <TextField name="password" label="Password" type="password" value={form.password} onChange={handleChange} required fullWidth />
                    <FormControl fullWidth>
                        <InputLabel>Role</InputLabel>
                        <Select name="role" value={form.role} onChange={handleChange}>
                            <MenuItem value="user">User</MenuItem>
                            <MenuItem value="admin">Admin</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl fullWidth>
                        <InputLabel>Department</InputLabel>
                        <Select name="departmentId" value={form.departmentId} onChange={handleChange}>
                            <MenuItem value="">None</MenuItem>
                            {departments.map((dept) => (
                                <MenuItem key={dept.id} value={dept.id}>{dept.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <Button type="submit" variant="contained">Create User</Button>
                </Box>
                {success && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}
                {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            </Paper>

            <Paper elevation={3} sx={{ padding: 4, mt: 4 }}>
                <Typography variant="h5" gutterBottom>Team Members</Typography>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Email</TableCell>
                            <TableCell>Role</TableCell>
                            <TableCell>Department</TableCell>
                            <TableCell>Created At</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>{user.role}</TableCell>
                                <TableCell>{user.department?.name || '—'}</TableCell>
                                <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Paper>
        </Container>
    );
}

export default Users;
