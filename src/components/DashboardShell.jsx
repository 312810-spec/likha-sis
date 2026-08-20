import { useState, useEffect, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { Bell, LogOut, Settings, Sun, Moon, Monitor, Menu } from 'lucide-react';
import useDarkMode from '../hooks/useDarkMode';
import useBrandTheme from '../hooks/useBrandTheme';
import useNotifications from '../hooks/useNotifications.js';
import { ROLE_LABELS } from '../utils/roles.js';
import Sidebar from './Sidebar';
import NotificationPanel from './NotificationPanel';

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

  const notifications = useNotifications();

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
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950" role="region" aria-label="Dashboard Shell">
      <Sidebar
        currentPage={currentPage}
        onNavigate={onNavigate}
        user={user}
        userRoles={userRoles}
        openMobile={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="sticky top-0 z-30 flex-shrink-0 flex items-start justify-between gap-4 px-4 sm:px-6 py-4 sm:py-5 bg-white/90 backdrop-blur-sm border-b border-gray-200 dark:bg-gray-900/90 dark:border-gray-700">
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
              <h1 className="font-display text-lg sm:text-xl font-semibold text-primary tracking-tight truncate">{pageTitle}</h1>
              <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-300 truncate">
                Welcome, <span className="font-medium text-gray-700 dark:text-gray-100">{user?.displayName || user?.email || 'Teacher'}</span>
                <span className="hidden sm:inline"> — LIKHA-SIS, Tingub National High School</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <div className="text-right hidden lg:block">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-200">{dateStr}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{timeStr}</div>
            </div>

            <div role="toolbar" aria-label={`Theme (resolved ${resolvedIsDark ? 'dark' : 'light'})`} className="relative inline-flex items-center rounded-full p-0.5 bg-gray-100 dark:bg-gray-800">
              <span
                aria-hidden="true"
                className="absolute top-0.5 left-0.5 w-8 h-8 rounded-full bg-white shadow-sm dark:bg-gray-700 transition-transform duration-200 ease-out"
                style={{ transform: `translateX(${['light', 'system', 'dark'].indexOf(mode) * 32}px)` }}
              />

              <button
                type="button"
                aria-label="Set light mode"
                onClick={() => setMode('light')}
                className={`relative z-10 w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-150 active:scale-90 ${mode === 'light' ? 'text-primary dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
              >
                <Sun size={15} className={`transition-transform duration-200 ease-out ${mode === 'light' ? 'scale-110 rotate-0' : 'rotate-[-20deg]'}`} />
              </button>

              <button
                type="button"
                aria-label="Set system mode"
                onClick={() => setMode('system')}
                className={`relative z-10 w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-150 active:scale-90 ${mode === 'system' ? 'text-primary dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
              >
                <Monitor size={15} className={`transition-transform duration-200 ease-out ${mode === 'system' ? 'scale-110' : ''}`} />
              </button>

              <button
                type="button"
                aria-label="Set dark mode"
                onClick={() => setMode('dark')}
                className={`relative z-10 w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-150 active:scale-90 ${mode === 'dark' ? 'text-primary dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
              >
                <Moon size={15} className={`transition-transform duration-200 ease-out ${mode === 'dark' ? 'scale-110 rotate-0' : 'rotate-[20deg]'}`} />
              </button>
            </div>

            {/* Notification bell + dropdown */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                aria-label={
                  notifications.unreadCount > 0
                    ? `Notifications (${notifications.unreadCount} new)`
                    : 'Notifications'
                }
                onClick={() => {
                  const opening = !notifOpen;
                  setNotifOpen(opening);
                  setProfileOpen(false);
                  // Opening the panel is what "seeing" means — clear the badge
                  // then, not on navigation, so an alert raised while the user
                  // is on another page still announces itself.
                  if (opening) notifications.markAllSeen();
                }}
                className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 dark:hover:bg-gray-800 dark:text-gray-300 transition-colors"
              >
                <Bell size={19} />
                {notifications.unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold tabular-nums ring-2 ring-white dark:ring-gray-900">
                    {notifications.unreadCount > 9 ? '9+' : notifications.unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-lg z-50 dark:bg-gray-900 dark:border-gray-700 animate-fade-in overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notifications</h4>
                  </div>
                  <NotificationPanel
                    notifications={notifications}
                    onNavigate={(page) => {
                      setNotifOpen(false);
                      onNavigate(page);
                    }}
                  />
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
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {(userRoles || []).map((r) => ROLE_LABELS[r] || r).join(', ') || 'No roles assigned'}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      onNavigate('accountSettings');
                    }}
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
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden focus:outline-none">
          <section aria-label="Main" className="p-4 md:p-6">
            {children ? children : <p className="text-gray-500 dark:text-gray-300">Select a section from the sidebar to begin.</p>}
          </section>
        </main>
      </div>
    </div>
  );
}