import { useState, useEffect, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { Bell, User as UserIcon, LogOut, Settings, Sun, Moon, Monitor } from 'lucide-react';
import useDarkMode from '../hooks/useDarkMode';
import Sidebar from './Sidebar';

export default function DashboardShell({ children, currentPage, onNavigate, user, pageTitle = 'Dashboard', userRoles }) {
  const [mode, resolvedIsDark, setMode] = useDarkMode();
  const [now, setNow] = useState(new Date());
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

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
      <Sidebar currentPage={currentPage} onNavigate={onNavigate} user={user} userRoles={userRoles} />

      <main className="flex-1 min-w-0 overflow-x-hidden">
        <div className="flex items-start justify-between gap-4 px-6 py-5 bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-primary">{pageTitle}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
              Welcome, <span className="font-medium text-gray-700 dark:text-gray-100">{user?.displayName || user?.email || 'Teacher'}</span> — LIKHA-SIS, Tingub National High School
            </p>
          </div>

          <div className="flex items-center gap-5">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-200">{dateStr}</div>
              <div className="text-xs text-gray-400 dark:text-gray-500">{timeStr}</div>
            </div>

            <div role="toolbar" aria-label={`Theme (resolved ${resolvedIsDark ? 'dark' : 'light'})`} className="inline-flex items-center rounded-md overflow-hidden border border-gray-200 dark:border-transparent">
              <button
                type="button"
                aria-label="Set light mode"
                onClick={() => setMode('light')}
                className={`w-9 h-9 flex items-center justify-center ${mode === 'light' ? 'bg-primary text-white' : 'hover:bg-gray-100 text-gray-600 dark:text-gray-300'} `}
              >
                <Sun size={16} />
              </button>

              <button
                type="button"
                aria-label="Set system mode"
                onClick={() => setMode('system')}
                className={`w-9 h-9 flex items-center justify-center ${mode === 'system' ? 'bg-primary text-white' : 'hover:bg-gray-100 text-gray-600 dark:text-gray-300'}`}
              >
                <Monitor size={16} />
              </button>

              <button
                type="button"
                aria-label="Set dark mode"
                onClick={() => setMode('dark')}
                className={`w-9 h-9 flex items-center justify-center ${mode === 'dark' ? 'bg-primary text-white' : 'hover:bg-gray-100 text-gray-600 dark:text-gray-300'}`}
              >
                <Moon size={16} />
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
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 dark:hover:bg-gray-800 dark:text-gray-300 relative"
              >
                <Bell size={20} />
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50 dark:bg-gray-900 dark:border-gray-700">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notifications</h4>
                  </div>
                  <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                    No notifications yet.
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
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 dark:hover:bg-gray-800 dark:text-gray-300"
              >
                <UserIcon size={20} />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 dark:bg-gray-900 dark:border-gray-700">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                    <div className="text-sm font-medium text-gray-900 truncate dark:text-gray-100">
                      {user?.email || 'User'}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">Teacher</div>
                  </div>

                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    <Settings size={16} /> Account Settings
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 border-t border-gray-100 dark:border-gray-700 dark:hover:bg-red-950/30"
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