// frontend/src/pages/Users.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Box, Button, Container, TextField, Typography, Paper, Alert, MenuItem, Select, InputLabel, FormControl, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import EditIcon from '@mui/icons-material/Edit';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

function Users() {
    const { auth } = useAuth();
    const [users, setUsers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [form, setForm] = useState({ email: '', password: '', role: 'user', departmentId: '' });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState({ id: '', email: '', password: '', role: 'user', departmentId: '' });


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

    const openEditModal = (user) => {
        setEditForm({
            id: user.id,
            email: user.email,
            password: '',
            role: user.role,
            departmentId: user.department?.id || ''
        });
        setEditModalOpen(true);
    };

    const closeEditModal = () => {
        setEditModalOpen(false);
        setEditForm({ id: '', email: '', password: '', role: 'user', departmentId: '' });
    };

    const handleEditChange = (e) => {
        setEditForm({ ...editForm, [e.target.name]: e.target.value });
    };

    const handleEditSubmit = async () => {
        try {
            await axios.put(`http://localhost:5001/api/users/${editForm.id}`, editForm, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            setSuccess('User updated successfully');
            setError('');
            closeEditModal();
            const res = await axios.get('http://localhost:5001/api/users', {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            setUsers(res.data);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || 'Failed to update user');
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
                                <TableCell>
                                    <IconButton size="small" onClick={() => openEditModal(user)}>
                                        <EditIcon fontSize="small" />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                <Dialog open={editModalOpen} onClose={closeEditModal} fullWidth>
                    <DialogTitle>Edit User</DialogTitle>
                    <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                        <TextField label="Email" name="email" value={editForm.email} onChange={handleEditChange} fullWidth disabled />
                        <TextField label="New Password" name="password" type="password" value={editForm.password} onChange={handleEditChange} fullWidth />
                        <FormControl fullWidth>
                            <InputLabel>Role</InputLabel>
                            <Select name="role" value={editForm.role} onChange={handleEditChange}>
                                <MenuItem value="user">User</MenuItem>
                                <MenuItem value="admin">Admin</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl fullWidth>
                            <InputLabel>Department</InputLabel>
                            <Select name="departmentId" value={editForm.departmentId} onChange={handleEditChange}>
                                <MenuItem value="">None</MenuItem>
                                {departments.map((dept) => (
                                    <MenuItem key={dept.id} value={dept.id}>{dept.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={closeEditModal}>Cancel</Button>
                        <Button variant="contained" onClick={handleEditSubmit}>Save</Button>
                    </DialogActions>
                </Dialog>
            </Paper>
        </Container>
    );
}

export default Users;
