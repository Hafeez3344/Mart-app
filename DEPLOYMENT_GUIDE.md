# 🛒 Super Mart Point of Sale (POS) & Retail Management System - Deployment & Operations Manual

This document is the master operational guide for deploying, managing, networking, and operating the **Super Mart Point of Sale (POS)** and Retail Inventory Management System.

---

## 📑 Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [First-Time Installation & Startup](#2-first-time-installation--startup)
3. [Multi-Checkout Cashier Counter Setup (LAN / Wi-Fi)](#3-multi-checkout-cashier-counter-setup-lan--wi-fi)
4. [Hardware Setup: Thermal Receipt Printers & Barcode Scanners](#4-hardware-setup-thermal-receipt-printers--barcode-scanners)
5. [Default System Login Credentials](#5-default-system-login-credentials)
6. [Daily Shift Opening & Closing Workflow](#6-daily-shift-opening--closing-workflow)
7. [Troubleshooting Guide](#7-troubleshooting-guide)

---

## 1. Architecture Overview

The system consists of a high-speed Express REST backend connected to PostgreSQL, and a Next.js 14 retail frontend:

```
                   ┌──────────────────────────────────────────────┐
                   │             Mart Local Network / Wi-Fi       │
                   │    Counter 1 • Counter 2 • Manager Tablet    │
                   └──────────────────────┬───────────────────────┘
                                          │
                           Connects to Server IP:3000
                                          │
┌─────────────────────────────────────────▼────────────────────────────────────────┐
│                        Main Store Server Computer                                │
│                                                                                  │
│   ┌────────────────────────┐  API Calls  ┌────────────────────────┐              │
│   │     mart-frontend      │────────────>│      mart-backend      │              │
│   │    (Next.js 14 POS)    │             │   (Express REST API)   │              │
│   │       Port: 3000       │             │       Port: 5000       │              │
│   └────────────────────────┘             └───────────┬────────────┘              │
│                                                      │ Prisma Queries            │
│                                                      ▼                           │
│                                          ┌────────────────────────┐              │
│                                          │     mart-postgres      │              │
│                                          │    (PostgreSQL 16)     │              │
│                                          │       Port: 5432       │              │
│                                          └────────────────────────┘              │
└──────────────────────────────────────────────────────────────────────────────────┘
```

* **`mart-frontend`**: High-performance cashier terminal with fast barcode scanning, keyboard hotkeys, live cart discounts, and multi-payment checkout.
* **`mart-backend`**: Express API handling sales transactions, atomic stock deductions, supplier purchase ledgers, and cash register audits.
* **`mart-postgres`**: PostgreSQL database persisting all products, stock counts, customers, sales invoices, and staff records.

---

## 2. First-Time Installation & Startup

### Step 1: Install Dependencies
Open PowerShell or Terminal:

```powershell
# 1. Install Backend Dependencies
cd server
npm install
npx prisma generate
npx prisma db push
node prisma/seed.js

# 2. Install Frontend Dependencies
cd ../client
npm install
```

### Step 2: Start Development Servers
```powershell
# In terminal 1 (Server):
cd server
npm run dev

# In terminal 2 (Client):
cd client
npm run dev
```

Open browser at: **`http://localhost:3000`**

---

## 3. Multi-Checkout Cashier Counter Setup (LAN / Wi-Fi)

To connect other checkout counter PCs, cash registers, or tablets:
1. Ensure all computers are on the same local Wi-Fi or LAN switch.
2. Find the server computer's IP address (e.g. `192.168.1.100` via `ipconfig`).
3. On cashier stations, open Google Chrome and navigate to:
   **`http://192.168.1.100:3000`**

---

## 4. Hardware Setup: Thermal Receipt Printers & Barcode Scanners

### A. USB / Wireless Barcode Scanners (Plug & Play)
* Standard handheld barcode scanners (Honeywell, Zebra, Datalogic, Eyoyo, generic USB) require **zero driver setup**.
* In POS Checkout (`/pos`), barcodes are captured instantly with a confirmation audio beep.

### B. ESC/POS 80mm & 58mm Thermal Receipt Printers
* Connect your thermal printer via USB, LAN, or Bluetooth.
* Configure paper size (80mm standard or 58mm compact) under **Mart Settings** (`/settings`).
* Direct printing uses raw WebUSB, local workstation agent, or standard system print dialog.

---

## 5. Default System Login Credentials

| Role | Email | Password | Access / Purpose |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@mart.com` | `admin123` | Full store configuration, reports & staff |
| **Head Cashier** | `cashier@mart.com` | `admin123` | High-speed POS checkout & drawer management |
| **Store Manager** | `manager@mart.com` | `admin123` | Product stock adjustments & supplier purchase orders |

---

## 6. Daily Shift Opening & Closing Workflow

1. **Shift Opening**:
   * Cashier logs in and navigates to **Cash Register** (`/register`).
   * Enter the physical cash drawer float (e.g. `Rs 5,000` in change coins/notes).
2. **Day POS Checkout**:
   * Cashier scans items, applies customer discounts, accepts Cash, Card, or Khata credit.
   * Drawer kicks out automatically on cash sales; thermal receipt prints instantly.
3. **Shift Closing & Audit**:
   * At shift end, click **Close Shift**.
   * Count the physical cash in drawer and enter the amount.
   * System calculates Expected Cash vs. Actual Cash and highlights surplus or deficit.
