// frontend/src/pages/KnowledgeBases.jsx
import React, { useEffect, useState, useCallback } from 'react';
import {
    Box,
    Button,
    Grid as Grid2,
    Paper,
    TextField,
    Typography,
    useTheme,
    MenuItem
} from '@mui/material';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function KnowledgeBases() {
    const { auth } = useAuth();
    const theme = useTheme();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [embeddingModel, setEmbeddingModel] = useState('');
    const [s3Prefix, setS3Prefix] = useState('');
    const [files, setFiles] = useState([]);
    const [existingKBs, setExistingKBs] = useState([]);
    const [unlinkedAWSKBs, setUnlinkedAWSKBs] = useState([]);
    const [selectedKBId, setSelectedKBId] = useState('');
    const [editMode, setEditMode] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [embeddingModels, setEmbeddingModels] = useState([]);
    const [s3Prefixes, setS3Prefixes] = useState([]);
    const [vectorIndexes, setVectorIndexes] = useState([]);
    const [vectorIndexName, setVectorIndexName] = useState('');
    const [vectorIndexArn, setVectorIndexArn] = useState('');
    const [message, setMessage] = useState('');

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

    const fetchAWSKBs = useCallback(async () => {
        try {
            const res = await axios.get('http://localhost:5001/api/knowledge-bases/aws-bedrock/knowledge-bases', {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            setUnlinkedAWSKBs(res.data);
            console.log("🧠 unlinkedAWSKBs loaded:", res.data);
        } catch (err) {
            console.error('Failed to fetch AWS KBs:', err);
        }
    }, [auth.token]);

    useEffect(() => {
        if (auth.token) {
            fetchKBs();
            fetchAWSKBs();
        }
    }, [auth.token, fetchKBs, fetchAWSKBs]);

    useEffect(() => {
        axios.get('api/models/embedding-models')
            .then(res => setEmbeddingModels(res.data))
            .catch(err => console.error('Failed to load models:', err));
    }, []);

    useEffect(() => {
        axios.get('api/storage/s3-prefixes', {
            headers: { Authorization: `Bearer ${auth.token}` }
        })
            .then(res => setS3Prefixes(res.data))
            .catch(err => console.error('Failed to load S3 prefixes:', err));
    }, [auth.token]);

    useEffect(() => {
        axios.get('api/models/vector-indexes')
            .then(res => setVectorIndexes(res.data))
            .catch(err => console.error('Failed to load vector indexes:', err));
    }, []);

    const handleFileDrop = (e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        setSelectedFiles(files);
    };

    const handleSubmit = async () => {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('description', description);
        formData.append('embeddingModel', embeddingModel);
        formData.append('s3Prefix', s3Prefix);
        formData.append('vectorIndexName', vectorIndexName);
        formData.append('vectorIndexArn', vectorIndexArn);
        selectedFiles.forEach((file) => {
            formData.append('files', file);
        });

        try {
            await axios.post('api/knowledge-bases', formData, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            setName('');
            setDescription('');
            setEmbeddingModel('');
            setS3Prefix('');
            setVectorIndexName('');
            setSelectedFiles([]);
            await fetchKBs();
        } catch (err) {
            console.error('Failed to create KB:', err);
        }
    };

    const handleEdit = async () => {
        try {
            await axios.put(`api/knowledge-bases/${selectedKBId}`, {
                name,
                description,
                embeddingModel,
                s3Prefix,
                vectorIndexName
            }, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            setEditMode(false);
            setSelectedKBId('');
            setName('');
            setDescription('');
            setEmbeddingModel('');
            setS3Prefix('');
            setVectorIndexName('');
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
        setEmbeddingModel(kb.embeddingModel || '');
        setS3Prefix(kb.s3Prefix || '');
        setVectorIndexName(kb.vectorIndexName || '');
        setFiles([]);
    };

    const handleLink = async (knowledgeBaseId) => {
        try {
            setMessage("Linking knowledge base...");
    
            await axios.put('api/knowledge-bases/link-to-account', {
                knowledgeBaseId
            }, {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            setMessage('✅ Knowledge base linked successfully.');
            await fetchKBs();
            await fetchAWSKBs();
        } catch (err) {
            console.error('Failed to link KB:', err);
            setMessage('Failed to link knowledge base.');
        }
    };
    useEffect(() => {
        console.log("👀 Final unlinkedAWSKBs:", unlinkedAWSKBs);
    }, [unlinkedAWSKBs]);
    return (
        <Grid2 container spacing={3} p={3}>
            <Grid2 item xs={12} md={6}>
                <Paper elevation={3} sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        {editMode ? 'Edit Knowledge Base' : 'Create New Knowledge Base'}
                    </Typography>
                    <TextField label="Name" fullWidth margin="normal" value={name} onChange={(e) => setName(e.target.value)} />
                    <TextField label="Description" fullWidth margin="normal" value={description} onChange={(e) => setDescription(e.target.value)} />
                    <TextField select label="Embedding Model" fullWidth margin="normal" value={embeddingModel} onChange={(e) => setEmbeddingModel(e.target.value)}>
                        <MenuItem value="">-- Select a model --</MenuItem>
                        {embeddingModels.map((model) => (
                            <MenuItem key={model.id} value={model.id}>{model.label}</MenuItem>
                        ))}
                    </TextField>
                    <TextField select label="S3 Prefix" fullWidth margin="normal" value={s3Prefix} onChange={(e) => setS3Prefix(e.target.value)}>
                        <MenuItem value="">-- Select a prefix --</MenuItem>
                        {s3Prefixes.map((prefix) => (
                            <MenuItem key={prefix} value={prefix}>{prefix}</MenuItem>
                        ))}
                    </TextField>
                    <TextField select label="Vector Index Name" fullWidth margin="normal" value={vectorIndexName} onChange={(e) => {
                        const selected = vectorIndexes.find(ix => ix.name === e.target.value);
                        setVectorIndexName(selected?.name || '');
                        setVectorIndexArn(selected?.arn || '');
                    }}>
                        <MenuItem value="">-- Select an index --</MenuItem>
                        {vectorIndexes.map((ix) => (
                            <MenuItem key={ix.name} value={ix.name}>{ix.name}</MenuItem>
                        ))}
                    </TextField>
                    {!editMode && (
                        <>
                            <Box onDrop={handleFileDrop} onDragOver={(e) => e.preventDefault()} sx={{ mt: 2, p: 2, border: '2px dashed #aaa', borderRadius: 2, textAlign: 'center', color: '#666', cursor: 'pointer' }}>
                                <Typography>Drag and drop files here</Typography>
                                <input type="file" multiple onChange={(e) => setSelectedFiles(Array.from(e.target.files))} style={{ marginTop: 8 }} />
                            </Box>
                            {selectedFiles.length > 0 && (
                                <Box mt={2}>
                                    <Typography variant="body2">Selected Files:</Typography>
                                    <ul>
                                        {selectedFiles.map((file, idx) => (<li key={idx}>{file.name}</li>))}
                                    </ul>
                                </Box>
                            )}
                        </>
                    )}
                    <Button variant="contained" color="primary" sx={{ mt: 2 }} onClick={editMode ? handleEdit : handleSubmit}>
                        {editMode ? 'Update' : 'Create'}
                    </Button>
                </Paper>
            </Grid2>
            <Grid2 item xs={12} md={6}>
                <Paper elevation={3} sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>Existing Knowledge Bases</Typography>
                    {existingKBs.map((kb) => (
                        <Box key={kb.id} sx={{ mb: 2, p: 2, border: '1px solid #ccc', borderRadius: 1, cursor: 'pointer' }} onClick={() => startEditing(kb)}>
                            <Typography variant="subtitle1">  {kb.name.split('_')[1] || kb.name} </Typography>
                            <Typography variant="body2">{kb.description}</Typography>
                        </Box>
                    ))}

                    {Array.isArray(unlinkedAWSKBs) && (
                        <Box mt={4}>
                            <Typography variant="h6">Unlinked AWS Knowledge Bases</Typography>
                            {unlinkedAWSKBs.length === 0 ? (
                                <Typography variant="body2" color="textSecondary">
                                    No unlinked knowledge bases found.
                                </Typography>
                            ) : (
                                unlinkedAWSKBs.map((kb) => (
                                    <Box key={kb.knowledgeBaseId} sx={{ mb: 2, p: 2, border: '1px dashed #aaa', borderRadius: 1 }}>
                                        <Typography variant="subtitle1">{kb.name.split('_')[1] || kb.name}</Typography>
                                        <Typography variant="body2">ID: {kb.knowledgeBaseId}</Typography>
                                        <Typography variant="body2">Status: {kb.status}</Typography>
                                        <Typography variant="body2">{kb.description}</Typography>
                                        <Button variant="outlined" size="small" sx={{ mt: 1 }} onClick={() => handleLink(kb.knowledgeBaseId)}>
                                            Link to My Account
                                        </Button>
                                    </Box>
                                ))
                            )}
                        </Box>
                    )}
                    {message && <Typography sx={{ mt: 2, color: 'red' }}>{message}</Typography>}
                </Paper>
            </Grid2>
        </Grid2>
    );
}

export default KnowledgeBases;
