// frontend/src/pages/KnowledgeBases.jsx
import React, { useState, useEffect } from 'react';
import { Container, Typography, Paper, Box, TextField, Button, Divider, Alert, Select, MenuItem, InputLabel, FormControl } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

function KnowledgeBases() {
    const { auth } = useAuth();
    const [existingForm, setExistingForm] = useState({ id: '', description: '', users: [], departmentId: '' });
    const [newForm, setNewForm] = useState({ description: '', s3Path: '', users: [], departmentId: '' });
    const [files, setFiles] = useState(null);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');
    const [allUsers, setAllUsers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [kbs, setKbs] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [usersRes, deptsRes, kbsRes] = await Promise.all([
                    axios.get('http://localhost:5001/api/users', {
                        headers: { Authorization: `Bearer ${auth.token}` }
                    }),
                    axios.get('http://localhost:5001/api/departments', {
                        headers: { Authorization: `Bearer ${auth.token}` }
                    }),
                    axios.get('http://localhost:5001/api/knowledge-bases', {
                        headers: { Authorization: `Bearer ${auth.token}` }
                    })
                ]);

                setAllUsers(usersRes.data);
                setDepartments(deptsRes.data);
                setKbs(kbsRes.data); // 👈 make sure you define this state: const [kbs, setKbs] = useState([]);
            } catch (err) {
                console.error('Failed to load users, departments, or knowledge bases:', err);
            }
        };
        fetchData();
    }, [auth.token]);

    const handleExistingChange = (e) => {
        setExistingForm({ ...existingForm, [e.target.name]: e.target.value });
    };

    const handleNewChange = (e) => {
        setNewForm({ ...newForm, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e) => {
        setFiles(e.target.files);
    };

    const handleExistingSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.put(`http://localhost:5001/api/knowledge-bases/${existingForm.id}`, {
                description: existingForm.description,
                departmentId: existingForm.departmentId || null,
                userIds: existingForm.users
            }, {
                headers: {Authorization: `Bearer ${auth.token}`}
            });
            setSuccess('Knowledge base updated successfully');
            setError('');
        } catch (err) {
            console.error(err);
            setError('Failed to update knowledge base');
            setSuccess('');
        }
        setSuccess('Knowledge base updated (not yet wired to backend).');
        setError('');
    };

    const handleNewSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post('http://localhost:5001/api/knowledge-bases', {
                name: newForm.description,
                bedrockKnowledgeBaseId: 'kb-placeholder', // Replace this with actual KB ID from AWS if needed
                description: newForm.description,
                departmentId: newForm.departmentId || null,
                userIds: newForm.users
            }, {
                headers: {Authorization: `Bearer ${auth.token}`}
            });
            setSuccess('New knowledge base created successfully');
            setError('');
            console.log("Submitting KB:", {
                name: newForm.description,
                departmentId: newForm.departmentId,
                userIds: newForm.users
            });
        } catch (err) {
            console.error(err);
            setError('Failed to create knowledge base');
            setSuccess('');
        }
        setSuccess('New knowledge base created successfully');
        setError('');
    };

    return (
        <Container maxWidth="md">
            <Typography variant="h4" sx={{ mt: 4, mb: 2 }}>Knowledge Bases</Typography>
            <Paper elevation={3} sx={{ p: 3, mt: 4 }}>
                <Typography variant="h6" gutterBottom>Existing Knowledge Bases</Typography>
                {kbs.map(kb => (
                    <Box key={kb.id} sx={{ mb: 2, p: 2, border: '1px solid #ccc', borderRadius: 1 }}>
                        <Typography variant="subtitle1"><strong>{kb.name}</strong></Typography>
                        <Typography variant="body2">Description: {kb.description}</Typography>
                        <Typography variant="body2">Department: {kb.department?.name || 'None'}</Typography>
                        <Typography variant="body2">
                            Users: {(kb.userAssignments || []).map(ua => ua.user?.email).join(', ') || 'None'}
                        </Typography>
                    </Box>
                ))}
            </Paper>

            <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
                <Typography variant="h6">Edit Existing Knowledge Base</Typography>
                <Box component="form" onSubmit={handleExistingSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                    <TextField label="Knowledge Base ID" name="id" value={existingForm.id} onChange={handleExistingChange} required fullWidth />
                    <TextField label="Description" name="description" value={existingForm.description} onChange={handleExistingChange} fullWidth />
                    <FormControl fullWidth>
                        <InputLabel>Assign to Department</InputLabel>
                        <Select name="departmentId" value={existingForm.departmentId} onChange={handleExistingChange}>
                            <MenuItem value="">None</MenuItem>
                            {departments.map((dept) => (
                                <MenuItem key={dept.id} value={dept.id}>{dept.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl fullWidth>
                        <InputLabel>Assign to Users</InputLabel>
                        <Select
                            multiple
                            name="users"
                            value={existingForm.users}
                            onChange={(e) => setExistingForm({ ...existingForm, users: e.target.value })}
                            renderValue={(selected) => selected.join(', ')}
                        >
                            {allUsers.map((user) => (
                                <MenuItem key={user.id} value={user.id}>{user.email}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <Button type="submit" variant="contained">Update KB</Button>
                </Box>
            </Paper>

            <Divider sx={{ my: 4 }} />

            <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
                <Typography variant="h6">Create New Knowledge Base</Typography>
                <Box component="form" onSubmit={handleNewSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                    <TextField label="Description" name="description" value={newForm.description} onChange={handleNewChange} fullWidth />
                    <TextField label="S3 Path (optional)" name="s3Path" value={newForm.s3Path} onChange={handleNewChange} fullWidth />
                    <FormControl fullWidth>
                        <InputLabel>Assign to Department</InputLabel>
                        <Select name="departmentId" value={newForm.departmentId} onChange={handleNewChange}>
                            <MenuItem value="">None</MenuItem>
                            {departments.map((dept) => (
                                <MenuItem key={dept.id} value={dept.id}>{dept.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl fullWidth>
                        <InputLabel>Assign to Users</InputLabel>
                        <Select
                            multiple
                            name="users"
                            value={newForm.users}
                            onChange={(e) => setNewForm({ ...newForm, users: e.target.value })}
                            renderValue={(selected) => selected.join(', ')}
                        >
                            {allUsers.map((user) => (
                                <MenuItem key={user.id} value={user.id}>{user.email}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <Button variant="outlined" component="label">
                        Upload Files
                        <input type="file" multiple hidden onChange={handleFileChange} />
                    </Button>
                    {files && <Typography>{Array.from(files).map(f => f.name).join(', ')}</Typography>}
                    <Button type="submit" variant="contained">Create Knowledge Base</Button>
                </Box>
            </Paper>

            {success && <Alert severity="success">{success}</Alert>}
            {error && <Alert severity="error">{error}</Alert>}
        </Container>
    );
}

export default KnowledgeBases;
