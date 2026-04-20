import { useNavigate } from 'react-router';
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import heroImg from '../../assets/hero.jpg';
import { ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Register() {
  const navigate = useNavigate();
  const { currentUser, signup, loading: authLoading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && currentUser) {
      navigate('/dashboard');
    }
  }, [currentUser, authLoading, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name || !email || !password || !confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      await signup(email, password, name);
      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use' || err.message === 'Email already in use') {
        toast.error('Email already in use');
      } else {
        toast.error(err.message || 'Failed to create account');
      }
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="size-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen grid lg:grid-cols-2 overflow-hidden text-slate-100 font-sans bg-[linear-gradient(180deg,#0c1118_0%,#0a0f16_52%,#080c12_100%)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-28 top-16 h-72 w-72 rounded-full bg-slate-400/10 blur-[95px]" />
        <div className="absolute -right-24 top-40 h-72 w-72 rounded-full bg-blue-400/10 blur-[95px]" />
      </div>

      {/* Left Side - Hero Visual (50%) */}
      <div className="hidden lg:block relative overflow-hidden border-r border-white/10">
        <div
          className="absolute inset-0 bg-cover bg-center scale-105 brightness-[0.6]"
          style={{ backgroundImage: `url(${heroImg})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/72 via-black/56 to-[#0f1725]/46" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
        <div className="relative h-full flex flex-col justify-center px-14 xl:px-20">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/24 bg-black/28 px-4 py-2 text-sm text-slate-100 backdrop-blur">
            <span className="inline-block size-2 rounded-full bg-blue-300" />
            <span>Request staff access</span>
          </div>

          <h1 className="mt-6 text-6xl font-extrabold tracking-tight text-white drop-shadow-[0_6px_24px_rgba(0,0,0,0.55)]">
            Furniture Room
            <br />
            Visualizer
          </h1>
          <p className="mt-4 text-xl text-slate-200/90">Create your staff account.</p>
        </div>
      </div>

      {/* Right Side - Register Form (50%) */}
      <div className="relative flex items-center justify-center px-6 sm:px-12 py-10">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-white/14 bg-slate-950/66 p-8 shadow-[0_20px_52px_rgba(2,6,23,0.5)] backdrop-blur-xl">
            <div className="mb-6">
              <div className="text-sm text-blue-200">Request Staff Access</div>
              <h2 className="mt-2 text-3xl font-bold text-white">Create account</h2>
              <p className="mt-1 text-slate-400">Register to start creating room designs.</p>
            </div>

          {/* Register Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="name" className="text-slate-300 text-sm mb-2 block">
                Full Name
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                required
                autoComplete="name"
                className="bg-slate-900/95 border border-slate-700 text-white rounded-md px-4 py-3 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-400/45 focus-visible:ring-blue-400/45"
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-slate-300 text-sm mb-2 block">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="designer@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
                autoComplete="email"
                className="bg-slate-900/95 border border-slate-700 text-white rounded-md px-4 py-3 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-400/45 focus-visible:ring-blue-400/45"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-slate-300 text-sm mb-2 block">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                autoComplete="new-password"
                className="bg-slate-900/95 border border-slate-700 text-white rounded-md px-4 py-3 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-400/45 focus-visible:ring-blue-400/45"
              />
              <p className="text-xs text-slate-500 mt-1.5">At least 6 characters</p>
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="text-slate-300 text-sm mb-2 block">
                Confirm Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                required
                autoComplete="new-password"
                className="bg-slate-900/95 border border-slate-700 text-white rounded-md px-4 py-3 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-400/45 focus-visible:ring-blue-400/45"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-md bg-blue-600 text-white font-semibold shadow-[0_8px_20px_rgba(37,99,235,0.25)] hover:bg-blue-500"
            >
              {loading ? (
                <>
                  <Loader2 className="size-5 animate-spin mr-2" />
                  Creating Account...
                </>
              ) : (
                <>
                  Create account <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/12" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-slate-950/75 text-slate-500">
                Already have an account?
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            className="w-full text-slate-300 hover:text-white hover:bg-white/5"
            onClick={() => navigate('/login')}
          >
            Back to sign in
          </Button>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-slate-500">Authorized Workspace · © 2026</p>
        </div>
        </div>
      </div>
    </div>
  );
}
