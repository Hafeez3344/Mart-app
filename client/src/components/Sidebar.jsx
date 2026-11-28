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
      <div
        onClick={closeSidebar}
        aria-hidden={!isOpen}
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ease-out ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
      />

      {/* Sidebar Container - Dark Navy Professional Theme */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-[#0F1E36] flex flex-col z-50 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] shrink-0 select-none shadow-2xl shadow-black/40 ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
      >
        {/* Top Mart Logo Branding */}
        <div className="h-16 px-4 border-b border-white/10 flex items-center justify-between">
          <Link href="/pos" className="flex items-center gap-3 group/brand active:scale-95 transition-transform duration-150">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 shadow-lg shadow-emerald-600/30 flex items-center justify-center text-white shrink-0 transition-all duration-300 ease-out group-hover/brand:scale-105 group-hover/brand:-rotate-3 group-hover/brand:shadow-emerald-500/50">
              <ShoppingCart className="w-5 h-5 stroke-[2.5] transition-transform duration-300 group-hover/brand:scale-105" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black text-white tracking-tight leading-tight truncate max-w-[150px] transition-colors duration-200 group-hover/brand:text-emerald-300">
                {storeName || 'Super Mart'}
              </span>
              <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest mt-0.5">
                Point of Sale
              </span>
            </div>
          </Link>

          <button
            onClick={closeSidebar}
            className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-all duration-200 hover:rotate-90 active:scale-90"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Groups List */}
        <div
          ref={navScrollRef}
          onScroll={handleNavScroll}
          className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
        >
          {visibleGroups.map((group, groupIdx) => (
            <div
              key={groupIdx}
              style={{ animationDelay: `${Math.min(groupIdx * 45, 270)}ms` }}
              className="space-y-0.5 animate-sidebar-in"
            >
              <div className="px-3 text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">
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
                    className={`relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all duration-200 ease-out active:scale-[0.98] group ${active
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 font-bold'
                      : item.highlight
                        ? 'bg-white/10 text-emerald-400 hover:bg-white/15 hover:translate-x-1 font-bold border border-emerald-400/30'
                        : 'text-slate-400 hover:text-white hover:bg-white/10 hover:translate-x-1 font-semibold'
                      }`}
                  >
                    {/* Active left accent bar */}
                    <span
                      className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-white transition-all duration-200 ${active ? 'h-5 opacity-90' : 'h-0 opacity-0'
                        }`}
                    />

                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-all duration-200 ease-out ${active
                          ? 'text-white stroke-[2.5] scale-105'
                          : item.highlight
                            ? 'text-emerald-400 stroke-[2.5] group-hover:scale-110 group-hover:-rotate-6'
                            : 'text-slate-500 group-hover:text-white group-hover:scale-110 group-hover:-rotate-6'
                          }`}
                      />
                      <span>{item.name}</span>
                    </div>

                    {item.badge ? (
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold transition-transform duration-200 group-hover:scale-105 ${active
                          ? 'bg-emerald-800 text-emerald-200'
                          : item.highlight
                            ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/30'
                            : 'bg-white/10 text-slate-400 group-hover:bg-white/20 group-hover:text-white'
                          }`}
                      >
                        {item.badge}
                      </span>
                    ) : (
                      <ChevronRight
                        className={`w-3.5 h-3.5 shrink-0 transition-all duration-200 ease-out ${active
                          ? 'opacity-90 translate-x-0 text-white/80'
                          : 'opacity-0 -translate-x-1.5 group-hover:opacity-70 group-hover:translate-x-0 text-slate-400'
                          }`}
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom User Quick Info & Signout */}
        <div className="p-3 border-t border-white/10 bg-[#0a1628]">
          <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10 transition-all duration-200 hover:bg-white/[0.08] hover:border-white/20">
            <div className="flex items-center gap-2.5 truncate">
              <div className={`w-8 h-8 rounded-lg font-black text-xs flex items-center justify-center shrink-0 transition-transform duration-200 hover:scale-105 ${userRole === 'ADMIN'
                ? 'bg-indigo-500/20 text-indigo-300'
                : userRole === 'MANAGER'
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-emerald-500/20 text-emerald-300'
                }`}>
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="flex flex-col truncate">
                <span className="text-xs font-bold text-white truncate">
                  {user?.name || 'Staff User'}
                </span>
                <span className={`text-[9px] font-bold uppercase tracking-wider truncate px-1.5 py-0.5 rounded w-fit mt-0.5 ${userRole === 'ADMIN'
                  ? 'bg-indigo-500/20 text-indigo-300'
                  : userRole === 'MANAGER'
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                  {userRole} PANEL
                </span>
              </div>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="group/logout p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 shrink-0"
            >
              <LogOut className="w-4 h-4 transition-transform duration-200 group-hover/logout:translate-x-0.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
