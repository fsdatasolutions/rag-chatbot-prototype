// frontend/src/App.js
import React from 'react';
import Header from './components/Header';
import ChatWindow from './components/ChatWindow';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { Box } from '@mui/material';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
  },
});

function App() {
  return (

      <ThemeProvider theme={theme}>
          <Header />
          <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
              {/* Chat history column */}
              {/*<Box sx={{ width: '300px', backgroundColor: '#f0f0f0', padding: 2 }}>*/}
              {/*    <h3>Chat History</h3>*/}
              {/*    /!* Insert dummy or real chat history items here *!/*/}
              {/*</Box>*/}

              {/* Main chat interface */}
              <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'stretch', margin: '10%' }}>
                  <ChatWindow />
              </Box>
          </Box>
      </ThemeProvider>
  );
}

export default App;