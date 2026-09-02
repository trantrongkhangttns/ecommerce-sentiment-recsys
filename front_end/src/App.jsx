import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { CssBaseline, ThemeProvider, createTheme, AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import AdminDashboard from './pages/AdminDashboard';
import ReviewAnalysis from './pages/ReviewAnalysis'; 
import Recommendation from './pages/Recommendation';
import AbsaDemo from './pages/AbsaDemo';
const theme = createTheme({
  palette: {
    background: {
      default: '#f4f6f8'
    }
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  }
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>


        {/* KHU VỰC HIỂN THỊ CÁC TRANG */}
        <Routes>
          <Route path="/" element={<AdminDashboard />} />
          <Route path="/analysis" element={<ReviewAnalysis />} />
          <Route path="/recommend" element={<Recommendation />} />
          <Route path="/absa" element={<AbsaDemo />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;