'use client';

import React, { useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useSidebar } from '../context/SidebarContext';
import { useStore } from '../context/StoreContext';
import {
  ShoppingCart,
  LayoutDashboard,
  Package,
  Boxes,
  Truck,
  Users,
  Receipt,
  RotateCcw,
  Banknote,
  DollarSign,
  BarChart3,
  Settings,
  Printer,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Tag,
  CircleDollarSign,
  ClipboardList,
  Store,
  Layers,
  History,
  X
} from 'lucide-react';

const NAVIGATION_GROUPS = [
  {
    title: 'Executive Overview',
    items: [
      {
        name: 'Admin Dashboard',
        href: '/admin',
        icon: LayoutDashboard,
        roles: ['ADMIN']
      }
    ]
  },
  {
    title: 'Checkout & Sales',
    items: [
      {
        name: 'POS Terminal',
        href: '/pos',
        icon: ShoppingCart,
        badge: 'F1',
        highlight: true,
        roles: ['ADMIN', 'MANAGER', 'CASHIER']
      },
      {
        name: 'Sales Invoices',
        href: '/sales',
        icon: Receipt,
        roles: ['ADMIN', 'MANAGER', 'CASHIER']
      },
      {
        name: 'Cash Register',
        href: '/register',
        icon: Banknote,
        roles: ['ADMIN', 'MANAGER', 'CASHIER']
      }
    ]
  },
  {
    title: 'Stock & Catalog',
    items: [
      {
        name: 'Products & Stock',
        href: '/products',
        icon: Package,
        roles: ['ADMIN', 'MANAGER', 'STOCK_KEEPER']
      },
      {
        name: 'Categories',
        href: '/categories',
        icon: Tag,
        roles: ['ADMIN', 'MANAGER', 'STOCK_KEEPER']
      }
    ]
  },
  {
    title: 'Vendors & Stock-In',
    items: [
      {
        name: 'Purchases (Stock-In)',
        href: '/purchases',
        icon: ClipboardList,
        roles: ['ADMIN', 'MANAGER', 'STOCK_KEEPER', 'ACCOUNTANT']
      },
      {
        name: 'Suppliers & Ledger',
        href: '/suppliers',
        icon: Truck,
        roles: ['ADMIN', 'MANAGER', 'STOCK_KEEPER', 'ACCOUNTANT']
      }
    ]
  },
  {
    title: 'Customer Accounts',
    items: [
      {
        name: 'Customer Khata',
        href: '/customers',
        icon: Users,
        roles: ['ADMIN', 'MANAGER', 'CASHIER', 'ACCOUNTANT']
      }
    ]
  },
  {
    title: 'Finance & Analytics',
    items: [
      {
        name: 'Daily Expenses',
        href: '/expenses',
        icon: DollarSign,
        roles: ['ADMIN', 'MANAGER', 'ACCOUNTANT']
      },
      {
        name: 'Staff & Salaries',
        href: '/salaries',
        icon: CircleDollarSign,
        roles: ['ADMIN']
      },
      {
        name: 'Sales & Profit Reports',
        href: '/reports',
        icon: BarChart3,
        roles: ['ADMIN', 'MANAGER', 'ACCOUNTANT']
      }
    ]
  },
  {
    title: 'Store Management',
    items: [
      {
        name: 'Mart Settings',
        href: '/settings',
        icon: Settings,
        roles: ['ADMIN']
      }
    ]
  }
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { isOpen, closeSidebar } = useSidebar();
  const { storeName } = useStore();
  const navScrollRef = useRef(null);

  // Preserve sidebar scroll position across page navigation
  useEffect(() => {
    const el = navScrollRef.current;
    if (!el) return;
    const saved = sessionStorage.getItem('mart_sidebar_scroll');
    if (saved) {
      el.scrollTop = parseInt(saved, 10) || 0;
    }
  }, [pathname]);

  const handleNavScroll = () => {
    if (navScrollRef.current) {
      sessionStorage.setItem('mart_sidebar_scroll', navScrollRef.current.scrollTop.toString());
    }
  };

  const userRole = (user?.role || 'CASHIER').toUpperCase();

  // Filter groups and items strictly according to user's assigned role
  const visibleGroups = NAVIGATION_GROUPS.map((group) => {
    const visibleItems = group.items.filter((item) => {
      if (!item.roles || userRole === 'ADMIN') return true;
      return item.roles.includes(userRole);
    });
    return { ...group, items: visibleItems };
  }).filter((group) => group.items.length > 0);

  const isLinkActive = (href) => {
    if (href === '/pos' && pathname === '/pos') return true;
    if (href === '/admin' && (pathname === '/admin' || pathname === '/admin/dashboard')) return true;
    if (href !== '/pos' && href !== '/admin' && pathname.startsWith(href)) return true;
    return false;
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={closeSidebar}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden"
        />
      )}

      {/* Sidebar Container - Modern Clean White Mart POS */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-white border-r border-slate-200 flex flex-col z-50 transition-transform duration-200 ease-in-out shrink-0 select-none shadow-xs ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Top Mart Logo Branding */}
        <div className="h-16 px-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <Link href="/pos" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-sm shadow-emerald-600/20 flex items-center justify-center text-white shrink-0">
              <ShoppingCart className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black text-slate-900 tracking-tight leading-tight truncate max-w-[150px]">
                {storeName || 'Super Mart'}
              </span>
              <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-widest mt-0.5">
                Point of Sale
              </span>
            </div>
          </Link>

          <button
            onClick={closeSidebar}
            className="md:hidden p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Groups List */}
        <div
          ref={navScrollRef}
          onScroll={handleNavScroll}
          className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-200"
        >
          {visibleGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-1">
              <div className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                {group.title}
              </div>

              {group.items.map((item) => {
                const active = isLinkActive(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => {
                      if (window.innerWidth < 768) closeSidebar();
                    }}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all group ${
                      active
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 font-bold'
                        : item.highlight
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold border border-emerald-200/80'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-semibold'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          active
                            ? 'text-white stroke-[2.5]'
                            : item.highlight
                            ? 'text-emerald-600 stroke-[2.5]'
                            : 'text-slate-400 group-hover:text-slate-700'
                        }`}
                      />
                      <span>{item.name}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                          active
                            ? 'bg-emerald-800 text-white'
                            : item.highlight
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-600 group-hover:bg-slate-300'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom User Quick Info & Signout */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/80">
          <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2.5 truncate">
              <div className={`w-8 h-8 rounded-lg font-black text-xs flex items-center justify-center shrink-0 ${
                userRole === 'ADMIN'
                  ? 'bg-indigo-100 text-indigo-700'
                  : userRole === 'MANAGER'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}>
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="flex flex-col truncate">
                <span className="text-xs font-bold text-slate-800 truncate">
                  {user?.name || 'Staff User'}
                </span>
                <span className={`text-[9px] font-bold uppercase tracking-wider truncate px-1.5 py-0.5 rounded w-fit mt-0.5 ${
                  userRole === 'ADMIN'
                    ? 'bg-indigo-50 text-indigo-700'
                    : userRole === 'MANAGER'
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-emerald-50 text-emerald-700'
                }`}>
                  {userRole} PANEL
                </span>
              </div>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
