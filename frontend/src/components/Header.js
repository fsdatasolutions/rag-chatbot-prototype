// frontend/src/components/Header.js
import React from 'react';
import { AppBar, Toolbar, Typography, Box } from '@mui/material';

function Header() {
    return (
        <AppBar position="static" color="primary">
            <Toolbar>
                <Box
                    component="img"
                    src="https://www.usa.edu/wp-content/themes/mast/dist/img/usa-logo-horizontal.png"
                    alt="Company Logo"
                    sx={{ marginRight: 2 }}
                />
                <Typography variant="h6" component="div">
                    USAHS Support AI
                </Typography>
            </Toolbar>
        </AppBar>
    );
}

export default Header;