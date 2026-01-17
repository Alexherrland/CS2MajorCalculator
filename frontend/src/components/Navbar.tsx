import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TournamentInfo } from '../types/hltvTypes';
import { TwitchUserProfile } from '../types/fantasyTypes';
import {
  getAllTournaments,
  twitchLogin,
  getCurrentUserProfile,
  logoutUser
} from '../services/tournamentService';

const Navbar: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [tournaments, setTournaments] = useState<TournamentInfo[]>([]);
  const [showTournamentsDropdown, setShowTournamentsDropdown] = useState(false);
  const [currentUser, setCurrentUser] = useState<TwitchUserProfile | null>(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const tournamentsDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTournaments = async () => {
      const data = await getAllTournaments();
      setTournaments(data);
    };
    const fetchCurrentUser = async () => {
      const user = await getCurrentUserProfile();
      setCurrentUser(user);
    };

    fetchTournaments();
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tournamentsDropdownRef.current && !tournamentsDropdownRef.current.contains(event.target as Node)) {
        setShowTournamentsDropdown(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handlePastTournamentsClick = () => {
    setShowTournamentsDropdown(!showTournamentsDropdown);
    setShowUserDropdown(false);
  };

  const handleUserIconClick = () => {
    if (currentUser) {
      setShowUserDropdown(!showUserDropdown);
      setShowTournamentsDropdown(false);
    } else {
      twitchLogin();
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
    setShowUserDropdown(false);
    navigate('/');
  };

  return (
    <nav className="bg-neutral-900 text-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex-shrink-0">
            <Link to="/" className="flex items-center text-xl font-bold text-primary-400 hover:text-primary-300 transition-colors ">
              <img 
                src={`${process.env.PUBLIC_URL}/weblogo.png`} 
                alt="Logo" 
                className="h-10 w-auto"
              />
              CSTracker
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-2">
            <Link to="/fantasy" className="text-neutral-300 hover:bg-neutral-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">
                Fantasy
            </Link>
            {/* Comentado: Apartado de torneos pasados
            <div className="relative" ref={tournamentsDropdownRef}>
              <button
                onClick={handlePastTournamentsClick}
                className="text-neutral-300 hover:bg-neutral-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center"
              >
                Torneos Pasados
                <svg className={`w-4 h-4 ml-1 transition-transform ${showTournamentsDropdown ? 'transform rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
              </button>
              {showTournamentsDropdown && (
                <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-neutral-800 ring-1 ring-black ring-opacity-5 py-1 z-50">
                  {tournaments.filter(t => !t.isLive).length > 0 ? (
                    tournaments.filter(t => !t.isLive).map(tournament => (
                      <Link
                        key={tournament.slug}
                        to={`/tournament/${tournament.slug}`}
                        className="block px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700 w-full text-left"
                        onClick={() => setShowTournamentsDropdown(false)}
                      >
                        {tournament.name}
                      </Link>
                    ))
                  ) : (
                    <span className="block px-4 py-2 text-sm text-neutral-400">No hay torneos pasados.</span>
                  )}
                </div>
              )}
            </div>
            */}
          </div>

          <div className="flex items-center">
            <div className="relative ml-3" ref={userDropdownRef}>
              <div>
                <button
                  type="button"
                  className="flex text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-800 focus:ring-white"
                  id="user-menu-button"
                  aria-expanded={showUserDropdown}
                  aria-haspopup="true"
                  onClick={handleUserIconClick}
                >
                  <span className="sr-only">Abrir menú de usuario</span>
                  {currentUser && currentUser.twitch_profile_image_url ? (
                    <img
                      className="h-8 w-8 rounded-full"
                      src={currentUser.twitch_profile_image_url}
                      alt={currentUser.twitch_username || currentUser.user.username}
                    />
                  ) : currentUser ? (
                    <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-neutral-600">
                      <span className="text-sm font-medium leading-none text-white">{currentUser.user.username.substring(0, 1).toUpperCase()}</span>
                    </span>
                   
                  ) : (
                    <div className="text-neutral-300 hover:bg-neutral-700 hover:text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors border border-neutral-600 hover:border-neutral-500">
                        Login con Twitch
                    </div>
                  )}
                </button>
              </div>
              {currentUser && showUserDropdown && (
                <div
                  className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-neutral-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
                  role="menu"
                  aria-orientation="vertical"
                  aria-labelledby="user-menu-button"
                  tabIndex={-1}
                >
                  <div className="px-4 py-3">
                    <p className="text-sm text-white">Logueado como</p>
                    <p className="text-sm font-medium text-primary-400 truncate">
                      {currentUser.twitch_username || currentUser.user.username}
                    </p>
                  </div>
                  <Link
                    to={`/fantasy/profile/${currentUser.user.username}`}
                    className="block px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700"
                    role="menuitem"
                    tabIndex={-1}
                    onClick={() => setShowUserDropdown(false)}
                  >
                    Mi Perfil Fantasy
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700"
                    role="menuitem"
                    tabIndex={-1}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>

            <div className="md:hidden flex items-center ml-3">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white transition-colors"
                aria-controls="mobile-menu"
                aria-expanded={isMobileMenuOpen}
              >
                <span className="sr-only">Abrir menú principal</span>
                {isMobileMenuOpen ? (
                  <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden" id="mobile-menu">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <Link to="/fantasy" className="text-neutral-300 hover:bg-neutral-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                Fantasy
            </Link>
            <div className="border-t border-neutral-700 pt-2">
                <button 
                    onClick={() => { handlePastTournamentsClick(); }}
                    className="w-full text-left text-neutral-300 hover:bg-neutral-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium transition-colors"
                >
                    Torneos Pasados
                </button>
                {showTournamentsDropdown && (
                    <div className="pl-4">
                    {tournaments.filter(t => !t.isLive).length > 0 ? (
                        tournaments.filter(t => !t.isLive).map(tournament => (
                        <Link
                            key={tournament.slug}
                            to={`/tournament/${tournament.slug}`}
                            className="block px-3 py-2 rounded-md text-base font-medium text-neutral-400 hover:bg-neutral-600 hover:text-white"
                            onClick={() => { setIsMobileMenuOpen(false); setShowTournamentsDropdown(false); }}
                        >
                            {tournament.name}
                        </Link>
                        ))
                    ) : (
                        <span className="block px-3 py-2 text-sm text-neutral-500">No hay torneos pasados.</span>
                    )}
                    </div>
                )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar; 