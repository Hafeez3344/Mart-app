import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../lib/api';

export const fetchSalesThunk = createAsyncThunk(
  'pos/fetchSales',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { pos } = getState();
      const { period, startDate, endDate, statusFilter, searchTerm } = pos || {};

      let query = `/sales?status=${statusFilter || 'ALL'}`;
      if (period && period !== 'ALL' && period !== 'CUSTOM') {
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

export const fetchPharmacySalesThunk = fetchSalesThunk;

const posSlice = createSlice({
  name: 'pos',
  initialState: {
    sales: [],
    loading: false,
    error: null,
    period: 'TODAY',
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
      .addCase(fetchSalesThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSalesThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.sales = action.payload.sales || action.payload || [];
      })
      .addCase(fetchSalesThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to load sales history';
      });
  }
});

export const {
  setPeriod,
  setCustomDates,
  setStatusFilter,
  setSearchTerm,
  setCurrentPage,
  resetFilters
} = posSlice.actions;

export default posSlice.reducer;

