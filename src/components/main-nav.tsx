import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { 
  PackagePlus, 
  Settings, 
  LayoutDashboard, 
  Grid2X2,
  ArrowDownUp,
  Menu,
  Package2,
  LogOut,
  QrCode
} from 'lucide-react';
import { logout } from '@/lib/firebase/users';

const routes = [
  {
    title: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    title: 'Goods In',
    href: '/goods-in',
    icon: PackagePlus,
  },
  {
    title: 'Scan',
    href: '/scan',
    icon: QrCode,
  },
  {
    title: 'Locations',
    href: '/locations',
    icon: Grid2X2,
  },
  {
    title: 'Movements',
    href: '/movements',
    icon: ArrowDownUp,
  },
  {
    title: 'Setup',
    href: '/setup',
    icon: Settings,
  },
];

export function MainNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const NavLinks = () => (
    <>
      {routes.map((route) => {
        const Icon = route.icon;
        return (
          <Button
            key={route.href}
            variant="ghost"
            asChild
            className={cn(
              'justify-start',
              location.pathname === route.href &&
                'bg-muted font-medium text-primary'
            )}
          >
            <Link to={route.href} className="flex items-center space-x-2">
              <Icon className="h-4 w-4" />
              <span>{route.title}</span>
            </Link>
          </Button>
        );
      })}
      <Button
        variant="ghost"
        onClick={handleLogout}
        className="justify-start text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
      >
        <LogOut className="h-4 w-4 mr-2" />
        <span>Logout</span>
      </Button>
    </>
  );

  return (
    <>
      {/* Mobile Navigation */}
      <div className="lg:hidden ml-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64">
            <SheetHeader className="border-b pb-4 mb-4">
              <SheetTitle className="flex items-center gap-2">
                <Package2 className="h-6 w-6" />
                <span>WareFlow</span>
              </SheetTitle>
            </SheetHeader>
            <div className="flex flex-col space-y-2">
              <NavLinks />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Navigation */}
      <nav className="hidden lg:flex ml-6 items-center space-x-4 lg:space-x-6">
        <NavLinks />
      </nav>
    </>
  );
}