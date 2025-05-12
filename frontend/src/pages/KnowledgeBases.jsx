// frontend/src/pages/KnowledgeBases.jsx
import React, { useEffect, useState, useCallback } from 'react';
import {
    Box,
    Button,
    Grid2,
    Paper,
    TextField,
    Typography,
    useTheme
} from '@mui/material';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function KnowledgeBases() {
    const { auth } = useAuth();
    const theme = useTheme();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [files, setFiles] = useState([]);
    const [existingKBs, setExistingKBs] = useState([]);
    const [selectedKBId, setSelectedKBId] = useState('');
    const [editMode, setEditMode] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState([]);

    const fetchKBs = useCallback(async () => {
        try {
            const res = await axios.get('http://localhost:5001/api/knowledge-bases', {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            setExistingKBs(res.data);
        } catch (err) {
            console.error('Failed to load knowledge bases:', err);
        }
    }, [auth.token]);

    useEffect(() => {
        if (auth.token) fetchKBs();
    }, [auth.token, fetchKBs]);

    const handleFileDrop = (e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        setSelectedFiles(files);
    };

    const handleFileInput = (e) => {
        const selected = Array.from(e.target.files);
        setFiles(prev => [...prev, ...selected]);
    };

    const handleSubmit = async () => {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('description', description);

        selectedFiles.forEach((file) => {
            formData.append('files', file);
        });
        console.log("✅ Inspect what’s being sent", [...formData.entries()]); // ✅ Inspect what’s being sent

        try {
            console.log('Submitting KB form:', {
                formData
            });
            await axios.post('http://localhost:5001/api/knowledge-bases', formData, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            setName('');
            setDescription('');
            setSelectedFiles([]);
            await fetchKBs(); // Refresh the list
        } catch (err) {
            console.error('Failed to create KB:', err);
        }
    };

    const handleEdit = async () => {
        try {
            await axios.put(`http://localhost:5001/api/knowledge-bases/${selectedKBId}`, {
                name,
                description
            }, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            setEditMode(false);
            setSelectedKBId('');
            setName('');
            setDescription('');
            await fetchKBs();
        } catch (err) {
            console.error('Failed to edit KB:', err);
        }
    };

    const startEditing = (kb) => {
        setEditMode(true);
        setSelectedKBId(kb.id);
        setName(kb.name);
        setDescription(kb.description || '');
        setFiles([]);
    };

    return (
        <Grid2 container spacing={3} p={3}>
            <Grid2 item xs={12} md={6}>
                <Paper elevation={3} sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        {editMode ? 'Edit Knowledge Base' : 'Create New Knowledge Base'}
                    </Typography>
                    <TextField
                        label="Name"
                        fullWidth
                        margin="normal"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <TextField
                        label="Description"
                        fullWidth
                        margin="normal"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                    {!editMode && (
                        <>
                            <Box
                                onDrop={handleFileDrop}
                                onDragOver={(e) => e.preventDefault()}
                                sx={{
                                    mt: 2,
                                    p: 2,
                                    border: '2px dashed #aaa',
                                    borderRadius: 2,
                                    textAlign: 'center',
                                    color: '#666',
                                    cursor: 'pointer',
                                }}
                            >
                                <Typography>Drag and drop files here</Typography>
                                <input
                                    type="file"
                                    multiple
                                    onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
                                    style={{ marginTop: 8 }}
                                />
                            </Box>

                            {files.length > 0 && (
                                <Box mt={2}>
                                    <Typography variant="body2">Selected Files:</Typography>
                                    <ul>
                                        {files.map((file, idx) => (
                                            <li key={idx}>{file.name}</li>
                                        ))}
                                    </ul>
                                </Box>
                            )}
                        </>
                    )}
                    <Button
                        variant="contained"
                        color="primary"
                        sx={{ mt: 2 }}
                        onClick={editMode ? handleEdit : handleSubmit}
                    >
                        {editMode ? 'Update' : 'Create'}
                    </Button>
                </Paper>
            </Grid2>

            <Grid2 item xs={12} md={6}>
                <Paper elevation={3} sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>Existing Knowledge Bases</Typography>
                    {existingKBs.map((kb) => (
                        <Box
                            key={kb.id}
                            sx={{ mb: 2, p: 2, border: '1px solid #ccc', borderRadius: 1, cursor: 'pointer' }}
                            onClick={() => startEditing(kb)}
                        >
                            <Typography variant="subtitle1">{kb.name}</Typography>
                            <Typography variant="body2">{kb.description}</Typography>
                        </Box>
                    ))}
                </Paper>
            </Grid2>
        </Grid2>
    );
}

export default KnowledgeBases;