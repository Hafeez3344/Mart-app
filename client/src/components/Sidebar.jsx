'use client';

import React from 'react';
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
    title: 'Checkout & Sales',
    items: [
      {
        name: 'POS Terminal',
        href: '/pos',
        icon: ShoppingCart,
        badge: 'F1',
        highlight: true
      },
      {
        name: 'Sales Invoices',
        href: '/sales',
        icon: Receipt
      },
      {
        name: 'Cash Register',
        href: '/register',
        icon: Banknote
      }
    ]
  },
  {
    title: 'Stock & Catalog',
    items: [
      {
        name: 'Products & Stock',
        href: '/products',
        icon: Package
      },
      {
        name: 'Categories',
        href: '/categories',
        icon: Tag
      }
    ]
  },
  {
    title: 'Vendors & Stock-In',
    items: [
      {
        name: 'Purchases (Stock-In)',
        href: '/purchases',
        icon: ClipboardList
      },
      {
        name: 'Suppliers & Ledger',
        href: '/suppliers',
        icon: Truck
      }
    ]
  },
  {
    title: 'Customer Accounts',
    items: [
      {
        name: 'Customer Khata',
        href: '/customers',
        icon: Users
      }
    ]
  },
  {
    title: 'Finance & Analytics',
    items: [
      {
        name: 'Daily Expenses',
        href: '/expenses',
        icon: DollarSign
      },
      {
        name: 'Staff & Salaries',
        href: '/salaries',
        icon: CircleDollarSign
      },
      {
        name: 'Sales & Profit Reports',
        href: '/reports',
        icon: BarChart3
      }
    ]
  },
  {
    title: 'Store Management',
    items: [
      {
        name: 'Admin Dashboard',
        href: '/admin',
        icon: LayoutDashboard
      },
      {
        name: 'Mart Settings',
        href: '/settings',
        icon: Settings
      }
    ]
  }
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { isOpen, closeSidebar } = useSidebar();
  const { storeName } = useStore();

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
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-slate-950 border-r border-slate-800 flex flex-col z-50 transition-transform duration-200 ease-in-out shrink-0 select-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Top Mart Logo Branding */}
        <div className="h-16 px-4 border-b border-slate-800 flex items-center justify-between">
          <Link href="/pos" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-md flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-extrabold text-white tracking-tight leading-none truncate max-w-[150px]">
                {storeName || 'Metro Mart'}
              </span>
              <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest mt-0.5">
                Point of Sale
              </span>
            </div>
          </Link>

          <button
            onClick={closeSidebar}
            className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Groups List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
          {NAVIGATION_GROUPS.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-1">
              <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
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
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all group ${
                      active
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-bold'
                        : item.highlight
                        ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          active
                            ? 'text-slate-950 stroke-[2.5]'
                            : item.highlight
                            ? 'text-emerald-400'
                            : 'text-slate-500 group-hover:text-emerald-400'
                        }`}
                      />
                      <span>{item.name}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                          active
                            ? 'bg-slate-950 text-white font-bold'
                            : 'bg-slate-800 text-slate-400 group-hover:text-white'
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
        <div className="p-3 border-t border-slate-800 bg-slate-950/80">
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <div className="flex items-center gap-2 truncate">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'C'}
              </div>
              <div className="flex flex-col truncate">
                <span className="text-xs font-bold text-white truncate">
                  {user?.name || 'Cashier'}
                </span>
                <span className="text-[10px] text-slate-500 truncate">
                  {user?.email || 'cashier@mart.com'}
                </span>
              </div>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
