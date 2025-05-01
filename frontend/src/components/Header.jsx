// frontend/src/components/Header.jsx
import React, { useEffect, useState } from 'react';
import { AppBar, Toolbar, Typography, IconButton, Drawer, List, ListItem, ListItemText, Box, Button, Menu, MenuItem } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AccountCircle from '@mui/icons-material/AccountCircle';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function Header() {
    const navigate = useNavigate();
    const { auth, logout } = useAuth();
    const [accountName, setAccountName] = useState('');
    const [userEmail, setUserEmail] = useState('');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [anchorEl, setAnchorEl] = useState(null);

    const handleMenu = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    useEffect(() => {
        const fetchAccountAndUser = async () => {
            if (!auth.token) return;

            try {
                // Fetch account name
                const accountRes = await axios.get('http://localhost:5001/api/account', {
                    headers: { Authorization: `Bearer ${auth.token}` }
                });
                setAccountName(accountRes.data.name);

                // Fetch current user email
                const userRes = await axios.get('http://localhost:5001/api/users/me', {
                    headers: { Authorization: `Bearer ${auth.token}` }
                });
                setUserEmail(userRes.data.email);

            } catch (err) {
                console.error('Failed to load account or user info:', err);
            }
        };

        fetchAccountAndUser();
    }, [auth.token]);

    const sidebarItems = [
        // { label: 'Dashboard', path: '/dashboard', roles: ['admin', 'user'] },
        { label: 'Knowledge Bases', path: '/knowledge-bases', roles: ['admin'] },
        { label: 'Users', path: '/users', roles: ['admin'] },
        { label: 'Departments', path: '/departments', roles: ['admin'] },
        { label: 'ChatWindow', path: '/chat', roles: ['admin'] }

    ];

    return (
        <AppBar position="static">
            <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {auth.user?.role === 'admin' && (

                        <IconButton color="inherit" edge="start" onClick={() => setDrawerOpen(true)}>
                        <MenuIcon />
                    </IconButton>
                        )}
                    <Typography variant="h6" component={Link} to="/" style={{ color: '#fff', textDecoration: 'none', marginLeft: '8px' }}>
                        Virtual Assistant
                    </Typography>
                    {auth.token && accountName && (
                        <Typography variant="body2" sx={{ ml: 2, color: '#fff', fontWeight: 'bold'  }}>{accountName}</Typography>
                    )}
                </Box>

                {auth.token ? (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ color: '#fff', mr: 1 }}>
                            {userEmail}
                        </Typography>
                        <IconButton color="inherit" onClick={handleMenu}>
                            <AccountCircle sx={{ color: '#fff' }} />
                        </IconButton>
                        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
                            <MenuItem onClick={() => { handleClose(); logout(); navigate('/login'); }}>
                                Logout
                            </MenuItem>
                        </Menu>
                    </Box>
                ) : (
                    <Box>
                        <Button color="inherit" component={Link} to="/login">Login</Button>
                        <Button color="inherit" component={Link} to="/register">Register</Button>
                    </Box>
                )}
            </Toolbar>

            <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
                <Box sx={{ width: 250 }}>
                    <List>
                        {sidebarItems
                            .filter((item) => item.roles.includes(auth.role))
                            .map((item, index) => (
                                <ListItem button key={index} component={Link} to={item.path} onClick={() => setDrawerOpen(false)}>
                                    <ListItemText primary={item.label} />
                                </ListItem>
                                ))}
                    </List>
                </Box>
            </Drawer>
        </AppBar>
    );
}

export default Header;
