import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import Home from './components/Home';
import Navbar from './components/Navbar';
import TournamentPage from './components/TournamentPage';

// Importar componentes reales de Fantasy
import FantasyDashboard from './components/fantasy/FantasyDashboard';
import FantasyStagePicks from './components/fantasy/FantasyStagePicks';
import FantasyPlayoffPicks from './components/fantasy/FantasyPlayoffPicks';
import FantasyLeaderboard from './components/fantasy/FantasyLeaderboard';
import UserFantasyProfile from './components/fantasy/UserFantasyProfile';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00bcd4',
    },
    secondary: {
      main: '#f50057',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
});

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <div className="min-h-screen bg-gray-900">
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/tournament/:slug" element={<TournamentPage />} />
            
            {/* Rutas de Fantasy League */}
            <Route path="/fantasy" element={<FantasyDashboard />} />
            <Route path="/fantasy/stage/:stageId/picks" element={<FantasyStagePicks />} />
            <Route path="/fantasy/tournament/:tournamentId/playoffs/picks" element={<FantasyPlayoffPicks />} />
            <Route path="/fantasy/leaderboard" element={<FantasyLeaderboard />} />
            <Route path="/fantasy/profile/:username" element={<UserFantasyProfile />} />
          </Routes>
        </div>
      </Router>
    </ThemeProvider>
  );
};

export default App; 