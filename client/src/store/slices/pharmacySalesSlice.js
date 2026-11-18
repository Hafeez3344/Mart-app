import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../lib/api';

export const fetchPharmacySalesThunk = createAsyncThunk(
  'pharmacySales/fetchSales',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { pharmacySales } = getState();
      const { period, startDate, endDate, statusFilter, searchTerm } = pharmacySales;

      let query = `/pharmacy/sales?status=${statusFilter}`;
      if (period !== 'ALL' && period !== 'CUSTOM') {
        query += `&period=${period}`;
      } else if (period === 'CUSTOM' && startDate && endDate) {
        query += `&startDate=${startDate}&endDate=${endDate}`;
      }
      if (searchTerm && searchTerm.trim()) {
        query += `&search=${encodeURIComponent(searchTerm.trim())}`;
      }

      const response = await api.get(query);
      return response.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch sales history');
    }
  }
);

const pharmacySalesSlice = createSlice({
  name: 'pharmacySales',
  initialState: {
    sales: [],
    loading: false,
    error: null,
    period: 'TODAY', // Default Today
    startDate: '',
    endDate: '',
    statusFilter: 'ALL',
    searchTerm: '',
    currentPage: 1,
    pageSize: 10
  },
  reducers: {
    setPeriod: (state, action) => {
      state.period = action.payload;
      state.currentPage = 1;
    },
    setCustomDates: (state, action) => {
      state.startDate = action.payload.startDate;
      state.endDate = action.payload.endDate;
      state.period = 'CUSTOM';
      state.currentPage = 1;
    },
    setStatusFilter: (state, action) => {
      state.statusFilter = action.payload;
      state.currentPage = 1;
    },
    setSearchTerm: (state, action) => {
      state.searchTerm = action.payload;
      state.currentPage = 1;
    },
    setCurrentPage: (state, action) => {
      state.currentPage = action.payload;
    },
    setPageSize: (state, action) => {
      state.pageSize = action.payload;
      state.currentPage = 1;
    },
    resetFilters: (state) => {
      state.period = 'TODAY';
      state.startDate = '';
      state.endDate = '';
      state.statusFilter = 'ALL';
      state.searchTerm = '';
      state.currentPage = 1;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPharmacySalesThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPharmacySalesThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.sales = action.payload.sales || [];
      })
      .addCase(fetchPharmacySalesThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export const {
  setPeriod,
  setCustomDates,
  setStatusFilter,
  setSearchTerm,
  setCurrentPage,
  setPageSize,
  resetFilters
} = pharmacySalesSlice.actions;

export default pharmacySalesSlice.reducer;
