import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { MainNav } from '@/components/main-nav';
import Dashboard from '@/pages/dashboard';
import GoodsIn from '@/pages/goods-in';
import Scan from '@/pages/scan';
import Setup from '@/pages/setup';
import Inventory from '@/pages/inventory';
import Locations from '@/pages/locations';
import Movements from '@/pages/movements';
import Login from '@/pages/login';
import CameraTest from '@/pages/camera-test';
import { Package2 } from 'lucide-react';
import { verifySetupUser } from '@/lib/firebase/users';
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useFirebase } from '@/contexts/FirebaseContext';
import { FirebaseProvider } from '@/contexts/FirebaseContext';
import { OperatorProvider } from '@/contexts/OperatorContext';
import { InstructionsProvider } from '@/contexts/InstructionsContext';
import { OperatorSelector } from '@/components/operator-selector';
import { InstructionToggle } from '@/components/instruction-toggle';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, authLoading } = useFirebase();
  
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  
  return user ? <>{children}</> : <Navigate to="/login" />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, authLoading } = useFirebase();
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingAdminAccess, setCheckingAdminAccess] = useState(true);

  // Automatically check if the current user has admin access
  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!user || authLoading) {
        setCheckingAdminAccess(false);
        return;
      }

      try {
        console.log('Checking automatic admin access for:', user.email);
        const isAdmin = await verifySetupUser('', '', user);
        if (isAdmin) {
          console.log('Automatic admin access granted for:', user.email);
          setVerified(true);
          toast.success('Admin access granted automatically');
        }
      } catch (error) {
        console.error('Error checking admin access:', error);
      } finally {
        setCheckingAdminAccess(false);
      }
    };

    checkAdminAccess();
  }, [user, authLoading]);

  const handleVerify = async () => {
    setLoading(true);
    try {
      const isValid = await verifySetupUser(username, password, user);
      if (isValid) {
        setVerified(true);
        toast.success('Setup access granted');
      } else {
        toast.error('Invalid setup credentials');
      }
    } catch (error) {
      console.error('Setup verification error:', error);
      toast.error('Setup verification failed');
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking admin access
  if (checkingAdminAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Checking admin access...</p>
        </div>
      </div>
    );
  }

  if (!verified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-md space-y-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Setup Access Required</h2>
            <p className="text-sm text-muted-foreground">Enter setup credentials to continue</p>
            {user && (
              <p className="text-xs text-blue-600 mt-2">
                Logged in as: {user.email}
              </p>
            )}
          </div>
          <div className="space-y-4">
            <Input
              type="text"
              placeholder="Username (try 'Team2')"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Password (try 'Team2')"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button 
              onClick={handleVerify} 
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Verifying...' : 'Verify'}
            </Button>
          </div>
          <div className="text-center text-xs text-muted-foreground">
            <p>Try username: Team2, password: Team2</p>
            <p>Or use admin email: Carl.Jukes@dakin-flathers.com</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function AppContent() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/camera-test" element={<CameraTest />} />
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <OperatorProvider>
                <InstructionsProvider>
                  <div className="min-h-screen bg-background">
                    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                      <div className="container flex h-14 items-center">
                        <div className="hidden lg:flex items-center space-x-2">
                          <Package2 className="h-6 w-6" />
                          <span className="font-bold">WareFlow</span>
                        </div>
                        <MainNav />
                        <div className="ml-auto flex items-center gap-2">
                          <InstructionToggle />
                          <OperatorSelector />
                        </div>
                      </div>
                    </header>
                    <main className="container py-6 px-4 lg:px-6">
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/goods-in" element={<GoodsIn />} />
                        <Route path="/scan" element={<Scan />} />
                        <Route
                          path="/setup"
                          element={
                            <AdminRoute>
                              <Setup />
                            </AdminRoute>
                          }
                        />
                        <Route path="/inventory" element={<Inventory />} />
                        <Route path="/locations" element={<Locations />} />
                        <Route path="/movements" element={<Movements />} />
                      </Routes>
                    </main>
                    <Toaster />
                  </div>
                </InstructionsProvider>
              </OperatorProvider>
            </PrivateRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default function App() {
  return (
    <FirebaseProvider>
      <AppContent />
    </FirebaseProvider>
  );
}