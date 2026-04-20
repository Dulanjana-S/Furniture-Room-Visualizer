import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { api, authHeaders } from '../../lib/api';
import { Design } from '../../types/design';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { 
  Plus, 
  LogOut, 
  Edit, 
  Trash2, 
  Loader2,
  Box,
  Calendar,
  LayoutGrid,
  Clock3,
  Sun,
  Moon,
  Ruler,
  Layers3
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

export default function Dashboard() {
  const { currentUser, logout, token } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      navigate('/');
      return;
    }
    loadDesigns();
  }, [currentUser, navigate]);

  async function loadDesigns() {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    try {
      const data = await api<{ designs: Design[] }>('/api/designs', {
        headers: authHeaders(token),
      });
      setDesigns(data.designs);
    } catch (error) {
      toast.error('Failed to load designs');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;

    try {
      setDeleting(true);
      await api<{ ok: true }>(`/api/designs/${deleteId}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      });
      setDesigns(designs.filter(d => d.id !== deleteId));
      toast.success('Design deleted');
    } catch (error) {
      toast.error('Failed to delete design');
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

  async function handleLogout() {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      toast.error('Failed to logout');
    }
  }

  function formatDate(value: unknown) {
    const date = value instanceof Date ? value : new Date(String(value ?? ''));
    if (Number.isNaN(date.getTime())) return '—';

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }

  function formatRelativeDate(value: unknown) {
    const date = value instanceof Date ? value : new Date(String(value ?? ''));
    if (Number.isNaN(date.getTime())) return 'No activity yet';

    const diffMs = date.getTime() - Date.now();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

    if (Math.abs(diffDays) >= 1) {
      return relativeFormatter.format(diffDays, 'day');
    }

    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    if (Math.abs(diffHours) >= 1) {
      return relativeFormatter.format(diffHours, 'hour');
    }

    const diffMinutes = Math.round(diffMs / (1000 * 60));
    if (Math.abs(diffMinutes) >= 1) {
      return relativeFormatter.format(diffMinutes, 'minute');
    }

    return 'Just now';
  }

  function formatShape(shape: Design['roomSpec']['shape']) {
    if (shape === 'l-shaped') return 'L-Shaped';
    return shape.charAt(0).toUpperCase() + shape.slice(1);
  }

  const latestUpdatedAt = useMemo(() => {
    const timestamps = designs
      .map((design) => new Date(String(design.updatedAt ?? '')).getTime())
      .filter((time) => Number.isFinite(time));

    if (timestamps.length === 0) return null;
    return new Date(Math.max(...timestamps));
  }, [designs]);

  const displayName = currentUser?.displayName || 'Designer';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'D';

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#061120]">
        <Loader2 className="size-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className={`dashboard-shell min-h-screen text-slate-100 ${theme === 'light' ? 'light-page' : ''}`}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="dashboard-orb dashboard-orb-left animate-blob" />
        <div className="dashboard-orb dashboard-orb-right animate-blob animation-delay-2000" />
        <div className="dashboard-grid absolute inset-0 opacity-40" />
      </div>

      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl supports-[backdrop-filter]:bg-slate-950/55">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-sm font-semibold text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.16)]">
              {initials}
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white">Designer Workspace</h1>
              <p className="text-xs text-slate-400">
                {(currentUser?.displayName || 'Designer')} • {currentUser?.email || 'designer@furniture.com'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="text-slate-300 hover:bg-white/8 hover:text-white"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <Badge variant="outline" className="hidden border-cyan-400/20 bg-cyan-400/10 text-cyan-100 sm:inline-flex">
              Designer
            </Badge>
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="text-slate-300 hover:bg-white/8 hover:text-white"
            >
              <LogOut className="size-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-white">My Designs</h2>
            <p className="mt-1 text-sm text-slate-400">
              Organize, edit, and present your room layout projects.
            </p>
          </div>
          <Button onClick={() => navigate('/designer/new')} size="lg" className="bg-blue-600 text-white hover:bg-blue-500">
            <Plus className="size-4" />
            Create New Design
          </Button>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <Card className="dashboard-stat-card border-white/10 bg-slate-950/55">
            <CardHeader className="items-center pb-3 text-center">
              <div className="dashboard-stat-icon mx-auto text-cyan-100">
                <LayoutGrid className="size-5" />
              </div>
              <CardDescription className="text-slate-400">Total Projects</CardDescription>
              <CardTitle className="text-3xl text-white">{designs.length}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="dashboard-stat-card border-white/10 bg-slate-950/55">
            <CardHeader className="items-center pb-3 text-center">
              <div className="dashboard-stat-icon mx-auto text-violet-100">
                <Clock3 className="size-5" />
              </div>
              <CardDescription className="text-slate-400">Last Updated</CardDescription>
              <CardTitle className="text-lg text-white">
                {latestUpdatedAt ? formatDate(latestUpdatedAt) : 'No activity yet'}
              </CardTitle>
            </CardHeader>
          </Card>
        </section>

        {designs.length === 0 ? (
          <Card className="dashboard-panel border-white/10 py-14">
            <CardContent className="flex flex-col items-center gap-4 text-center">
              <div className="flex size-20 items-center justify-center rounded-[24px] border border-cyan-400/20 bg-cyan-400/10 text-cyan-100 shadow-[0_0_50px_rgba(34,211,238,0.12)]">
                <Box className="size-10" />
              </div>
              <div>
                <h3 className="text-2xl font-semibold text-white">No designs yet</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-300">
                  Start your first room concept and this dashboard will track your layout library, recent activity, and reusable project inventory.
                </p>
              </div>
              <Button
                onClick={() => navigate('/designer/new')}
                className="h-11 rounded-full bg-cyan-400 px-6 text-slate-950 hover:bg-cyan-300"
              >
                <Plus className="size-4" />
                Create Design
              </Button>
            </CardContent>
          </Card>
        ) : (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Project Library</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">My Designs</h3>
              </div>
              <p className="max-w-xl text-sm text-slate-300">
                Open a design to continue editing, or clean up old iterations to keep the portfolio focused.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {designs.map((design) => (
              <Card
                key={design.id}
                className="dashboard-project-card group overflow-hidden border-white/10 bg-slate-950/55 transition-all hover:-translate-y-1 hover:border-cyan-400/25"
              >
                <button
                  type="button"
                  onClick={() => navigate(`/designer/${design.id}`)}
                  className="dashboard-preview relative flex aspect-[1.15/0.78] w-full items-center justify-center border-b border-white/10 text-left"
                >
                  <div className="dashboard-preview-grid absolute inset-0 opacity-60" />
                  <div className="absolute left-4 top-4 flex items-center gap-2">
                    <Badge className="border-0 bg-white/10 text-[11px] text-slate-100 shadow-none">
                      {formatShape(design.roomSpec.shape)}
                    </Badge>
                    <Badge variant="outline" className="border-white/10 bg-slate-950/45 text-[11px] text-slate-300">
                      {formatRelativeDate(design.updatedAt)}
                    </Badge>
                  </div>
                  <div className="relative text-center">
                    <div className="mx-auto mb-4 flex size-18 items-center justify-center rounded-[22px] border border-white/10 bg-white/5 text-slate-200 backdrop-blur-sm transition-transform duration-300 group-hover:scale-105 group-hover:text-cyan-100">
                      <Layers3 className="size-9" />
                    </div>
                    <p className="text-sm font-medium text-slate-200">
                      {design.roomSpec.width}m × {design.roomSpec.height}m
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-400">
                      Room layout preview
                    </p>
                  </div>
                </button>

                <CardContent className="space-y-4 pt-5">
                  <div className="space-y-2">
                    <h3 className="truncate text-lg font-semibold text-white">{design.name}</h3>
                    <p className="text-sm text-slate-400">
                      {design.furniture.length} furniture piece{design.furniture.length === 1 ? '' : 's'} arranged across a {formatShape(design.roomSpec.shape).toLowerCase()} room.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
                    <div className="rounded-2xl border border-white/8 bg-white/4 p-3">
                      <div className="mb-2 flex items-center gap-1.5 text-slate-400">
                        <Box className="size-3.5" />
                        Furniture
                      </div>
                      <span className="text-sm font-semibold text-white">{design.furniture.length} items</span>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/4 p-3">
                      <div className="mb-2 flex items-center gap-1.5 text-slate-400">
                        <Calendar className="size-3.5" />
                        Updated
                      </div>
                      <span className="text-sm font-semibold text-white">{formatDate(design.updatedAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Ruler className="size-3.5" />
                      <span>{(design.roomSpec.width * design.roomSpec.height).toFixed(1)} m² footprint</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="size-3.5" />
                      <span>{formatRelativeDate(design.updatedAt)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-10 flex-1 rounded-full bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                      onClick={() => navigate(`/designer/${design.id}`)}
                    >
                      <Edit className="size-3.5" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-10 rounded-full border-white/10 bg-white/5 px-4 text-slate-300 hover:border-red-400/25 hover:bg-red-500/10 hover:text-red-200"
                      onClick={() => setDeleteId(design.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            </div>
          </section>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="border-white/10 bg-slate-950 text-slate-50">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Design?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This action cannot be undone. This design will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={deleting}
              className="border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
