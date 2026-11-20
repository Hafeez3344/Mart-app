'use client';

import React, { useState, useEffect, useRef } from 'react';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import api from '../../lib/api';
import { printThermalMartReceipt } from '../../lib/thermalPrint';
import { useCurrency } from '../../context/CurrencyContext';
import { useHospital } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import {
  ShoppingCart,
  Search,
  ScanBarcode,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Printer,
  DollarSign,
  Receipt,
  Tag,
  User,
  Phone,
  Clock,
  X,
  CreditCard,
  Banknote,
  QrCode,
  Users,
  AlertCircle,
  PauseCircle,
  PlayCircle,
  Maximize2,
  Minimize2,
  Sparkles,
  ArrowRight,
  PackageCheck,
  RotateCcw
} from 'lucide-react';

const DEFAULT_CATEGORIES = [
  'ALL',
  'GROCERY & STAPLES',
  'BEVERAGES',
  'SNACKS & CONFECTIONERY',
  'DAIRY & EGGS',
  'BAKERY & BREAD',
  'FROZEN FOODS',
  'PERSONAL CARE',
  'HOUSEHOLD & CLEANING',
  'FRUITS & VEGETABLES'
];

export default function PosTerminalPage() {
  const { user } = useAuth();
  const { storeName, tagline, phone, address, taxNumber, currencySymbol } = useHospital();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [loading, setLoading] = useState(true);

  // Cart & State
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState('FLAT'); // FLAT or PERCENT
  const [tax, setTax] = useState(0);
  const [customerName, setCustomerName] = useState('Walk-In Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerId, setCustomerId] = useState(null);
  const [orderNotes, setOrderNotes] = useState('');

  // Customer Autocomplete
  const [allCustomers, setAllCustomers] = useState([]);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerFilter, setCustomerFilter] = useState('');

  // Hold / Parked Carts
  const [parkedSales, setParkedSales] = useState([]);
  const [showParkedModal, setShowParkedModal] = useState(false);

  // Checkout Modal State
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paidAmount, setPaidAmount] = useState('');
  const [processing, setProcessing] = useState(false);

  // Completed Receipt Modal
  const [completedSale, setCompletedSale] = useState(null);
  const [audioBeep, setAudioBeep] = useState(null);

  // UI Fullscreen Mode
  const [isFullScreen, setIsFullScreen] = useState(false);
  const barcodeInputRef = useRef(null);

  // Initialize Beep Sound
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        setAudioBeep(audioCtx);
      } catch (e) {
        // AudioContext not supported
      }
    }
  }, []);

  const playBeep = () => {
    try {
      if (audioBeep) {
        const osc = audioBeep.createOscillator();
        const gain = audioBeep.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, audioBeep.currentTime);
        gain.gain.setValueAtTime(0.15, audioBeep.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioBeep.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(audioBeep.destination);
        osc.start();
        osc.stop(audioBeep.currentTime + 0.1);
      }
    } catch (e) {}
  };

  // Fetch Products & Parked Sales
  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes, custRes, parkRes] = await Promise.all([
        api.get('/products'),
        api.get('/products/categories').catch(() => ({ data: { categories: [] } })),
        api.get('/customers').catch(() => ({ data: { customers: [] } })),
        api.get('/pos/parked').catch(() => ({ data: { parked: [] } }))
      ]);

      if (prodRes.data?.success) {
        setProducts(prodRes.data.products || []);
      }
      if (catRes.data?.success && catRes.data.categories?.length > 0) {
        const dynamicCats = ['ALL', ...catRes.data.categories.map(c => c.name)];
        setCategories(Array.from(new Set(dynamicCats)));
      }
      if (custRes.data?.success) {
        setAllCustomers(custRes.data.customers || []);
      }
      if (parkRes.data?.success) {
        setParkedSales(parkRes.data.parked || []);
      }
    } catch (err) {
      console.error('POS fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if typing in an input unless it's specific F-keys
      if (e.key === 'F1') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        setShowCustomerSearch(true);
      } else if (e.key === 'F8') {
        e.preventDefault();
        handleParkCart();
      } else if (e.key === 'F9') {
        e.preventDefault();
        setShowParkedModal(true);
      } else if (e.key === 'F12' || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault();
        if (cart.length > 0) handleOpenCheckout();
      } else if (e.key === 'Escape') {
        setShowCheckoutModal(false);
        setShowCustomerSearch(false);
        setShowParkedModal(false);
        setCompletedSale(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart]);

  // Handle Instant Barcode Scanning
  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    if (!barcodeInput || !barcodeInput.trim()) return;

    const code = barcodeInput.trim();
    const found = products.find(
      p => p.barcode?.toLowerCase() === code.toLowerCase() || p.sku?.toLowerCase() === code.toLowerCase()
    );

    if (found) {
      addToCart(found);
      playBeep();
      setBarcodeInput('');
    } else {
      // Try scanning backend directly
      api.get(`/products/barcode/${code}`)
        .then(res => {
          if (res.data?.success && res.data.product) {
            addToCart(res.data.product);
            playBeep();
            setBarcodeInput('');
          } else {
            alert(`Item with barcode '${code}' not found.`);
          }
        })
        .catch(() => {
          alert(`Item with barcode '${code}' not found in store.`);
        });
    }
  };

  // Add Item to Cart
  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item =>
          item.productId === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                totalPrice: (item.quantity + 1) * item.unitPrice
              }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          barcode: product.barcode,
          unit: product.unit || 'Pcs',
          costPrice: product.costPrice || 0,
          unitPrice: product.retailPrice || 0,
          quantity: 1,
          discount: 0,
          totalPrice: product.retailPrice || 0,
          stockQuantity: product.stockQuantity
        }
      ];
    });
  };

  // Update Cart Item Quantity
  const updateQuantity = (productId, delta) => {
    setCart(prev =>
      prev
        .map(item => {
          if (item.productId === productId) {
            const newQty = Math.max(1, item.quantity + delta);
            return {
              ...item,
              quantity: newQty,
              totalPrice: newQty * item.unitPrice - (item.discount || 0)
            };
          }
          return item;
        })
    );
  };

  // Remove Item from Cart
  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  // Cart Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const discountAmount =
    discountType === 'PERCENT'
      ? (subtotal * (parseFloat(discount) || 0)) / 100
      : (parseFloat(discount) || 0);
  const netTotal = Math.max(0, subtotal - discountAmount + (parseFloat(tax) || 0));

  // Open Checkout
  const handleOpenCheckout = () => {
    if (cart.length === 0) return;
    setPaidAmount(netTotal.toString());
    setShowCheckoutModal(true);
  };

  // Complete Checkout Sale
  const handleCompleteSale = async () => {
    if (cart.length === 0) return;

    setProcessing(true);
    try {
      const payload = {
        customerId,
        customerName,
        customerPhone,
        items: cart,
        subtotal,
        discount: discountAmount,
        discountType,
        tax: parseFloat(tax) || 0,
        netTotal,
        paidAmount: parseFloat(paidAmount) || 0,
        paymentMethod,
        notes: orderNotes
      };

      const res = await api.post('/pos/checkout', payload);
      if (res.data?.success) {
        const sale = res.data.sale;
        setCompletedSale(sale);
        setShowCheckoutModal(false);

        // Reset Cart
        setCart([]);
        setDiscount(0);
        setCustomerName('Walk-In Customer');
        setCustomerPhone('');
        setCustomerId(null);
        setOrderNotes('');

        // Refresh stock in local product list
        fetchData();

        // Auto Thermal Print
        printThermalMartReceipt({
          sale,
          storeName,
          address,
          phone
        });
      } else {
        alert(res.data?.message || 'Failed to complete sale.');
      }
    } catch (err) {
      console.error('Sale checkout error:', err);
      alert('Error processing sale transaction.');
    } finally {
      setProcessing(false);
    }
  };

  // Hold / Park Cart
  const handleParkCart = async () => {
    if (cart.length === 0) return;

    try {
      const payload = {
        customerId,
        customerName,
        customerPhone,
        items: cart,
        subtotal,
        discount: discountAmount,
        netTotal,
        isParked: true,
        parkedName: `${customerName} (${cart.length} items)`
      };

      const res = await api.post('/pos/checkout', payload);
      if (res.data?.success) {
        alert('Cart parked successfully! Press [F9] to retrieve anytime.');
        setCart([]);
        setDiscount(0);
        setCustomerName('Walk-In Customer');
        setCustomerPhone('');
        fetchData();
      }
    } catch (err) {
      alert('Failed to park cart.');
    }
  };

  // Resume Parked Cart
  const handleResumeParked = (sale) => {
    setCart(
      sale.items.map(i => ({
        productId: i.productId,
        productName: i.productName,
        barcode: i.barcode,
        unit: i.unit,
        costPrice: i.unitCost,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        discount: i.discount || 0,
        totalPrice: i.totalPrice
      }))
    );
    setCustomerName(sale.customerName || 'Walk-In Customer');
    setCustomerPhone(sale.customerPhone || '');
    setCustomerId(sale.customerId || null);
    setShowParkedModal(false);

    // Remove from backend parked list
    api.delete(`/pos/parked/${sale.id}`).catch(() => {});
    setParkedSales(prev => prev.filter(p => p.id !== sale.id));
  };

  // Filtered Products
  const filteredProducts = products.filter(p => {
    const matchesCat =
      selectedCategory === 'ALL' ||
      p.category?.toLowerCase() === selectedCategory.toLowerCase();
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.name?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  const parsedPaid = parseFloat(paidAmount) || 0;
  const changeDue = Math.max(0, parsedPaid - netTotal);

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden font-sans">
      {/* Sidebar hidden in cashier fullscreen */}
      {!isFullScreen && <Sidebar />}

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header */}
        {!isFullScreen && <Header />}

        {/* POS Dedicated Sub-Bar */}
        <div className="h-12 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>TERMINAL ACTIVE</span>
            </div>
            <span className="text-slate-600">|</span>
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
              Cashier: <strong className="text-white">{user?.name || 'Head Cashier'}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Parked Carts Trigger */}
            <button
              onClick={() => setShowParkedModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold transition-colors"
              title="View Parked / Held Carts [F9]"
            >
              <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Held Bills</span>
              {parkedSales.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold">
                  {parkedSales.length}
                </span>
              )}
            </button>

            {/* Fullscreen Cashier Toggle */}
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title={isFullScreen ? 'Exit Cashier Fullscreen' : 'Cashier Fullscreen Mode'}
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Main POS Split Body */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* =========================================
              LEFT PANEL: PRODUCT SEARCH & GRID (60%)
          ========================================== */}
          <div className="flex-1 flex flex-col border-r border-slate-800/80 overflow-hidden bg-slate-950">
            {/* Search Bar & Barcode Scanner Row */}
            <div className="p-3 bg-slate-900/60 border-b border-slate-800/80 flex flex-col sm:flex-row gap-2.5 shrink-0">
              {/* Barcode Fast Scan Input */}
              <form onSubmit={handleBarcodeSubmit} className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-400">
                  <ScanBarcode className="w-4 h-4" />
                </div>
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Scan Barcode [F1]..."
                  autoFocus
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </form>

              {/* Text Search Input */}
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search item name, brand, SKU..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Category Filter Horizontal Pills */}
            <div className="px-3 py-2 bg-slate-900/30 border-b border-slate-800/60 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0 select-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? 'bg-emerald-500 text-slate-950 shadow-sm font-extrabold'
                      : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Product Grid Area */}
            <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-slate-800">
              {loading ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                  Loading Store Catalog...
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                  <PackageCheck className="w-10 h-10 stroke-1 text-slate-600" />
                  <p className="text-xs">No products match your search.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5">
                  {filteredProducts.map((p) => {
                    const isOutOfStock = p.stockQuantity <= 0;
                    const isLowStock = p.stockQuantity > 0 && p.stockQuantity <= (p.minStockAlert || 10);

                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          if (!isOutOfStock) {
                            addToCart(p);
                            playBeep();
                          }
                        }}
                        className={`p-3 rounded-2xl border transition-all text-left flex flex-col justify-between select-none ${
                          isOutOfStock
                            ? 'bg-slate-950/40 border-slate-900 opacity-60 cursor-not-allowed'
                            : 'bg-slate-900/80 hover:bg-slate-800/90 border-slate-800/80 hover:border-emerald-500/50 cursor-pointer shadow-sm hover:shadow-emerald-500/5 active:scale-[0.98]'
                        }`}
                      >
                        <div>
                          {/* Top Stock Badge */}
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span className="text-[9px] font-mono text-slate-400 truncate max-w-[80px]">
                              {p.barcode || p.sku}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                                isOutOfStock
                                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                                  : isLowStock
                                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                                  : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                              }`}
                            >
                              {p.stockQuantity} {p.unit}
                            </span>
                          </div>

                          {/* Item Name */}
                          <h4 className="text-xs font-bold text-white leading-tight line-clamp-2">
                            {p.name}
                          </h4>

                          {/* Brand */}
                          {p.brand && (
                            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                              {p.brand}
                            </p>
                          )}
                        </div>

                        {/* Price & Add Indicator */}
                        <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                          <span className="text-xs font-extrabold text-emerald-400">
                            {currencySymbol || 'Rs.'} {p.retailPrice}
                          </span>
                          <span className="w-5 h-5 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors">
                            <Plus className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* =========================================
              RIGHT PANEL: CART, CUSTOMER & CHECKOUT (40%)
          ========================================== */}
          <div className="w-full lg:w-[420px] xl:w-[460px] flex flex-col bg-slate-900 border-l border-slate-800 shrink-0">
            {/* Customer Pill & Quick Lookup */}
            <div className="p-3 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 truncate">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="truncate">
                  <div className="text-xs font-bold text-white truncate">
                    {customerName}
                  </div>
                  {customerPhone && (
                    <div className="text-[10px] text-slate-400 truncate">
                      {customerPhone}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => setShowCustomerSearch(true)}
                className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
              >
                Change [F4]
              </button>
            </div>

            {/* Cart Items Area */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-slate-800">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                  <ShoppingCart className="w-10 h-10 stroke-1 text-slate-600" />
                  <p className="text-xs">Your billing cart is empty.</p>
                  <p className="text-[10px] text-slate-600">Scan barcodes or click items to add</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.productId}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 shadow-sm"
                  >
                    {/* Item Details */}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {item.productName}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>{currencySymbol} {item.unitPrice}</span>
                        <span>•</span>
                        <span className="font-mono text-slate-500">{item.barcode}</span>
                      </div>
                    </div>

                    {/* Quantity Modifiers */}
                    <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                      <button
                        onClick={() => updateQuantity(item.productId, -1)}
                        className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors active:scale-95"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-7 text-center font-bold text-xs text-white">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.productId, 1)}
                        className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors active:scale-95"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Total & Remove */}
                    <div className="text-right flex items-center gap-2 shrink-0">
                      <div className="text-xs font-extrabold text-emerald-400">
                        {currencySymbol} {item.totalPrice}
                      </div>
                      <button
                        onClick={() => removeFromCart(item.productId)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Cart Financial Summary & Action Panel */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-2.5 shrink-0">
              {/* Discount Row */}
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-400">Discount ({discountType === 'PERCENT' ? '%' : currencySymbol}):</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setDiscountType(discountType === 'FLAT' ? 'PERCENT' : 'FLAT')}
                    className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-300 hover:text-white"
                  >
                    {discountType}
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={discount}
                    onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-20 px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-right text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Subtotal & Net Payable */}
              <div className="space-y-1 pt-1 border-t border-slate-800/60">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Subtotal ({cart.length} items):</span>
                  <span className="font-mono text-slate-200">{currencySymbol} {subtotal}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex items-center justify-between text-xs text-rose-400">
                    <span>Discount:</span>
                    <span className="font-mono">- {currencySymbol} {discountAmount}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-extrabold uppercase text-white">Net Payable:</span>
                  <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                    {currencySymbol} {netTotal}
                  </span>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {/* Clear Cart */}
                <button
                  type="button"
                  onClick={() => {
                    if (cart.length > 0 && confirm('Clear all items from current cart?')) {
                      setCart([]);
                      setDiscount(0);
                    }
                  }}
                  disabled={cart.length === 0}
                  className="py-2.5 px-2 bg-slate-900 hover:bg-rose-500/20 hover:text-rose-400 disabled:opacity-40 text-slate-400 text-xs font-bold rounded-xl border border-slate-800 transition-colors"
                >
                  Clear [Esc]
                </button>

                {/* Hold Bill */}
                <button
                  type="button"
                  onClick={handleParkCart}
                  disabled={cart.length === 0}
                  className="py-2.5 px-2 bg-slate-900 hover:bg-amber-500/20 hover:text-amber-400 disabled:opacity-40 text-slate-400 text-xs font-bold rounded-xl border border-slate-800 transition-colors"
                >
                  Hold [F8]
                </button>

                {/* Checkout Pay */}
                <button
                  type="button"
                  onClick={handleOpenCheckout}
                  disabled={cart.length === 0}
                  className="py-2.5 px-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1 transition-all active:scale-[0.98]"
                >
                  <span>PAY [F12]</span>
                  <ArrowRight className="w-3.5 h-3.5 stroke-[3]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================
          CHECKOUT MODAL
      ========================================== */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-white">Payment & Checkout</h3>
                <p className="text-xs text-slate-400">Total Bill: <strong className="text-emerald-400">{currencySymbol} {netTotal}</strong></p>
              </div>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'CASH', label: 'Cash', icon: Banknote },
                { id: 'CARD', label: 'Card / POS', icon: CreditCard },
                { id: 'ONLINE', label: 'Online / QR', icon: QrCode },
                { id: 'CREDIT', label: 'Khata Credit', icon: Users }
              ].map(method => {
                const Icon = method.icon;
                const active = paymentMethod === method.id;
                return (
                  <button
                    key={method.id}
                    onClick={() => {
                      setPaymentMethod(method.id);
                      if (method.id === 'CREDIT' && !customerId) {
                        setShowCustomerSearch(true);
                      }
                    }}
                    className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1.5 transition-all ${
                      active
                        ? 'border-emerald-500 bg-emerald-500/15 text-white shadow-sm font-bold'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${active ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span className="text-[11px] font-semibold">{method.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Cash Tendered & Quick Buttons */}
            {paymentMethod === 'CASH' && (
              <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 uppercase">Cash Tendered:</label>
                  <input
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder="0"
                    autoFocus
                    className="w-36 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-right font-mono text-base font-extrabold text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Preset Cash Buttons */}
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { label: 'Exact', val: netTotal },
                    { label: '+100', val: Math.ceil(netTotal / 100) * 100 },
                    { label: '+500', val: Math.ceil(netTotal / 500) * 500 },
                    { label: '+1000', val: Math.ceil(netTotal / 1000) * 1000 },
                    { label: '+5000', val: Math.ceil(netTotal / 5000) * 5000 }
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPaidAmount(preset.val.toString())}
                      className="py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-bold text-slate-300 hover:text-white transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Change Due Display */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">Change Due:</span>
                  <span className="text-lg font-black font-mono text-emerald-400">
                    {currencySymbol} {changeDue}
                  </span>
                </div>
              </div>
            )}

            {/* Complete Sale Button */}
            <button
              onClick={handleCompleteSale}
              disabled={processing}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-black rounded-2xl text-sm shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              {processing ? (
                <span>Finalizing POS Transaction...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                  <span>COMPLETE SALE & PRINT RECEIPT</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* =========================================
          CUSTOMER SELECTION MODAL
      ========================================== */}
      {showCustomerSearch && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Select Customer / Khata Account</h3>
              <button onClick={() => setShowCustomerSearch(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                placeholder="Search by customer phone or name..."
                autoFocus
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Walk-in Customer Option */}
            <div
              onClick={() => {
                setCustomerName('Walk-In Customer');
                setCustomerPhone('');
                setCustomerId(null);
                setShowCustomerSearch(false);
              }}
              className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 cursor-pointer flex items-center justify-between"
            >
              <div className="text-xs font-bold text-emerald-400">Walk-In Customer (Default)</div>
              <span className="text-[10px] text-slate-500 font-mono">No Credit Account</span>
            </div>

            {/* Customer List */}
            <div className="max-h-60 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
              {allCustomers
                .filter(c =>
                  !customerFilter ||
                  c.name.toLowerCase().includes(customerFilter.toLowerCase()) ||
                  c.phone.includes(customerFilter)
                )
                .map(c => (
                  <div
                    key={c.id}
                    onClick={() => {
                      setCustomerName(c.name);
                      setCustomerPhone(c.phone);
                      setCustomerId(c.id);
                      setShowCustomerSearch(false);
                    }}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500 cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-white">{c.name}</div>
                      <div className="text-[10px] text-slate-400">{c.phone}</div>
                    </div>
                    {c.currentBalance > 0 && (
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                        Due: {currencySymbol} {c.currentBalance}
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================
          HELD / PARKED BILLS MODAL
      ========================================== */}
      {showParkedModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Parked / Held Customer Carts</h3>
              <button onClick={() => setShowParkedModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {parkedSales.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                No currently held carts. Press [F8] on active checkout to park a cart.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {parkedSales.map(sale => (
                  <div
                    key={sale.id}
                    className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-white">{sale.parkedName || sale.customerName}</div>
                      <div className="text-[10px] text-slate-400">
                        {sale.items?.length || 0} items • {currencySymbol} {sale.netTotal} •{' '}
                        {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleResumeParked(sale)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs"
                      >
                        Resume Cart
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================
          SALE RECEIPT PREVIEW MODAL
      ========================================== */}
      {completedSale && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <div className="inline-flex p-2.5 rounded-full bg-emerald-500/10 text-emerald-400 mb-1">
                <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h3 className="text-base font-extrabold text-white">Sale Successful!</h3>
              <p className="text-xs text-slate-400 font-mono">Invoice: {completedSale.invoiceNo}</p>
            </div>

            {/* Thermal Receipt Box */}
            <div className="bg-white text-slate-950 p-4 rounded-2xl text-[11px] font-mono space-y-2 shadow-inner">
              <div className="text-center border-b border-dashed border-slate-300 pb-2">
                <div className="font-extrabold text-sm">{storeName}</div>
                <div className="text-[10px] text-slate-600">{address}</div>
                <div className="text-[10px] text-slate-600">Tel: {phone}</div>
              </div>

              <div className="flex justify-between text-[10px] border-b border-dashed border-slate-300 pb-1">
                <span>Inv: {completedSale.invoiceNo}</span>
                <span>{new Date().toLocaleDateString()}</span>
              </div>

              <div className="space-y-1 py-1 border-b border-dashed border-slate-300">
                {completedSale.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="truncate max-w-[140px]">{item.productName} x{item.quantity}</span>
                    <span>{currencySymbol} {item.totalPrice}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-0.5 pt-1">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{currencySymbol} {completedSale.subtotal}</span>
                </div>
                {completedSale.discount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Discount:</span>
                    <span>-{currencySymbol} {completedSale.discount}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-xs pt-1 border-t border-slate-300">
                  <span>TOTAL:</span>
                  <span>{currencySymbol} {completedSale.netTotal}</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-600">
                  <span>Paid ({completedSale.paymentMethod}):</span>
                  <span>{currencySymbol} {completedSale.paidAmount}</span>
                </div>
                {completedSale.changeDue > 0 && (
                  <div className="flex justify-between text-[10px] font-bold">
                    <span>Change Due:</span>
                    <span>{currencySymbol} {completedSale.changeDue}</span>
                  </div>
                )}
              </div>

              <div className="text-center pt-2 text-[9px] text-slate-500 border-t border-dashed border-slate-300">
                Thank you for shopping with us!
              </div>
            </div>

            {/* Reprint & Done Action */}
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  printThermalMartReceipt({
                    sale: completedSale,
                    storeName,
                    address,
                    phone
                  })
                }
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Reprint Receipt</span>
              </button>
              <button
                onClick={() => setCompletedSale(null)}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-black rounded-xl transition-colors"
              >
                Next Customer [Enter]
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

