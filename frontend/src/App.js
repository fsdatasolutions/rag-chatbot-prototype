// frontend/src/App.js
import React from 'react';
import Header from './components/Header';
import ChatWindow from './components/ChatWindow';
import { createTheme, ThemeProvider } from '@mui/material/styles';

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
        {/*<Header />*/}
        <ChatWindow />
      </ThemeProvider>
  );
}

export default App;