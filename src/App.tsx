import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { MainNav } from '@/components/main-nav';
import Dashboard from '@/pages/dashboard';
import GoodsIn from '@/pages/goods-in';
import Picking from '@/pages/picking';
import Setup from '@/pages/setup';
import Inventory from '@/pages/inventory';
import Locations from '@/pages/locations';
import Movements from '@/pages/movements';
import Login from '@/pages/login';
import { Package2 } from 'lucide-react';
import { getCurrentUser, verifySetupUser } from '@/lib/firebase/users';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const user = getCurrentUser();
  return user ? children : <Navigate to="/login" />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [verified, setVerified] = useState(false);

  const handleVerify = async () => {
    const isValid = await verifySetupUser(username, password);
    if (isValid) {
      setVerified(true);
    } else {
      toast.error('Invalid setup credentials');
    }
  };

  if (!verified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-md space-y-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Setup Access Required</h2>
            <p className="text-sm text-muted-foreground">Enter setup credentials to continue</p>
          </div>
          <div className="space-y-4">
            <Input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button onClick={handleVerify} className="w-full">
              Verify
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <div className="min-h-screen bg-background">
                <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  <div className="container flex h-14 items-center">
                    <div className="hidden lg:flex items-center space-x-2">
                      <Package2 className="h-6 w-6" />
                      <span className="font-bold">WareFlow</span>
                    </div>
                    <MainNav />
                  </div>
                </header>
                <main className="container py-6 px-4 lg:px-6">
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/goods-in" element={<GoodsIn />} />
                    <Route path="/picking" element={<Picking />} />
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
            </PrivateRoute>
          }
        />
      </Routes>
    </Router>
  );
}