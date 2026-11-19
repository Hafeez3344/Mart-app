import { configureStore } from '@reduxjs/toolkit';
import posReducer from './slices/posSlice';
import adminReducer from './slices/adminSlice';
import payoutReducer from './slices/payoutSlice';

export const store = configureStore({
  reducer: {
    pos: posReducer,
    pharmacySales: posReducer, // alias
    admin: adminReducer,
    payout: payoutReducer
  }
});

export default store;
