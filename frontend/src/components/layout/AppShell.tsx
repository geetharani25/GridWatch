import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useSSE } from '../../hooks/useSSE';
import { useAppStore } from '../../store/useAppStore';

export function AppShell() {
  useSSE(); // Start SSE connection once, at the shell level
  const user = useAppStore(s => s.user);
  const setUser = useAppStore(s => s.setUser);
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem('gw_token');
    setUser(null);
    navigate('/login');
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `block px-3 py-2 rounded text-sm transition-colors ${isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`;

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-56 bg-slate-900 text-white flex flex-col p-4 gap-1 shrink-0">
        <h1 className="text-lg font-bold mb-4 text-white">GridWatch</h1>
        <NavLink to="/" end className={navClass}>Dashboard</NavLink>
        <NavLink to="/alerts" className={navClass}>Alerts</NavLink>
        <div className="mt-auto pt-4 border-t border-slate-700">
          <p className="text-xs text-slate-400 mb-2 truncate">{user?.email}</p>
          <button onClick={logout} className="text-xs text-slate-400 hover:text-white">Logout</button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
