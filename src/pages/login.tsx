import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Package2, User, Lock, LogIn } from 'lucide-react';
import { verifyUser, getCurrentUser } from '@/lib/firebase/users';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      navigate('/');
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = await verifyUser(email, password);
      if (user) {
        const displayName = user.displayName || user.email.split('@')[0];
        toast.success(`Welcome back, ${displayName}!`);
        navigate('/');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = () => {
    setEmail('Carl.Jukes@dakin-flathers.com');
    setPassword('29@qDy2A9s#');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md space-y-6">
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm dark:bg-gray-900/80">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-3 bg-primary/10 rounded-full">
                <Package2 className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Dakin Flathers Warehouse</CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Warehouse Management System
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                  autoComplete="username"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  className="h-11"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-11 text-base font-medium" 
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Signing in...
                  </div>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign In
                  </>
                )}
              </Button>
            </form>

            <div className="space-y-3">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Quick Access
                  </span>
                </div>
              </div>
              
              <Button
                variant="outline"
                onClick={handleQuickLogin}
                className="w-full h-11 justify-center"
              >
                <User className="h-4 w-4 mr-2" />
                Use Default Credentials
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <h3 className="font-medium text-blue-900 dark:text-blue-100">
                System Access
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Use your Firebase Authentication credentials or click "Default Credentials" for quick access.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}