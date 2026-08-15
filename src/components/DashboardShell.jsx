import { useState, useEffect, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { Bell, LogOut, Settings, Sun, Moon, Monitor, Menu } from 'lucide-react';
import useDarkMode from '../hooks/useDarkMode';
import useBrandTheme from '../hooks/useBrandTheme';
import Sidebar from './Sidebar';

function initialsFor(user) {
  const source = user?.displayName || user?.email || '';
  const parts = source.split(/[\s.@_]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function DashboardShell({ children, currentPage, onNavigate, user, pageTitle = 'Dashboard', userRoles }) {
  useBrandTheme();
  const [mode, resolvedIsDark, setMode] = useDarkMode();
  const [now, setNow] = useState(new Date());
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const notifRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Closes a dropdown when the user clicks anywhere outside of it
  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleLogout() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950" role="region" aria-label="Dashboard Shell">
      <Sidebar
        currentPage={currentPage}
        onNavigate={onNavigate}
        user={user}
        userRoles={userRoles}
        openMobile={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <main className="flex-1 min-w-0 overflow-x-hidden">
        <div className="sticky top-0 z-30 flex items-start justify-between gap-4 px-4 sm:px-6 py-4 sm:py-5 bg-white/90 backdrop-blur-sm border-b border-gray-200 dark:bg-gray-900/90 dark:border-gray-700">
          <div className="flex items-start gap-3 min-w-0">
            <button
              type="button"
              aria-label="Open sidebar"
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden mt-0.5 flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 flex-shrink-0"
            >
              <Menu size={20} />
            </button>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-primary tracking-tight truncate">{pageTitle}</h2>
              <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-300 truncate">
                Welcome, <span className="font-medium text-gray-700 dark:text-gray-100">{user?.displayName || user?.email || 'Teacher'}</span>
                <span className="hidden sm:inline"> — LIKHA-SIS, Tingub National High School</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <div className="text-right hidden lg:block">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-200">{dateStr}</div>
              <div className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">{timeStr}</div>
            </div>

            <div role="toolbar" aria-label={`Theme (resolved ${resolvedIsDark ? 'dark' : 'light'})`} className="inline-flex items-center rounded-full p-0.5 bg-gray-100 dark:bg-gray-800">
              <button
                type="button"
                aria-label="Set light mode"
                onClick={() => setMode('light')}
                className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-150 ${mode === 'light' ? 'bg-white text-primary shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
              >
                <Sun size={15} />
              </button>

              <button
                type="button"
                aria-label="Set system mode"
                onClick={() => setMode('system')}
                className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-150 ${mode === 'system' ? 'bg-white text-primary shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
              >
                <Monitor size={15} />
              </button>

              <button
                type="button"
                aria-label="Set dark mode"
                onClick={() => setMode('dark')}
                className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-150 ${mode === 'dark' ? 'bg-white text-primary shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
              >
                <Moon size={15} />
              </button>
            </div>

            {/* Notification bell + dropdown */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                aria-label="Notifications"
                onClick={() => {
                  setNotifOpen((s) => !s);
                  setProfileOpen(false);
                }}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 dark:hover:bg-gray-800 dark:text-gray-300 transition-colors"
              >
                <Bell size={19} />
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-50 dark:bg-gray-900 dark:border-gray-700 animate-fade-in overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notifications</h4>
                  </div>
                  <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                    You're all caught up.
                  </div>
                </div>
              )}
            </div>

            {/* Profile button + dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                aria-label="Profile"
                onClick={() => {
                  setProfileOpen((s) => !s);
                  setNotifOpen(false);
                }}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 transition-colors"
              >
                {initialsFor(user)}
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-50 dark:bg-gray-900 dark:border-gray-700 animate-fade-in overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                    <div className="text-sm font-medium text-gray-900 truncate dark:text-gray-100">
                      {user?.email || 'User'}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">Teacher</div>
                  </div>

                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800 transition-colors"
                  >
                    <Settings size={16} /> Account Settings
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 border-t border-gray-100 dark:border-gray-700 dark:hover:bg-red-950/30 transition-colors"
                  >
                    <LogOut size={16} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <section aria-label="Main" className="p-4 md:p-6">
          {children ? children : <p className="text-gray-500 dark:text-gray-300">Select a section from the sidebar to begin.</p>}
        </section>
      </main>
    </div>
  );
}