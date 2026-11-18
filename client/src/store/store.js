import { configureStore } from '@reduxjs/toolkit';
import pharmacySalesReducer from './slices/pharmacySalesSlice';
import adminReducer from './slices/adminSlice';
import payoutReducer from './slices/payoutSlice';

export const store = configureStore({
  reducer: {
    pos: pharmacySalesReducer,
    pharmacySales: pharmacySalesReducer,
    admin: adminReducer,
    payout: payoutReducer
  }
});

export default store;
