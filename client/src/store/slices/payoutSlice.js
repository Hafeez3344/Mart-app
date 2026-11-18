import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../lib/api';

export const fetchPayoutBreakdownThunk = createAsyncThunk(
  'payout/fetchBreakdown',
  async ({ period = 'today', startDate = '', endDate = '' } = {}, { rejectWithValue }) => {
    try {
      let url = `/frontdesk/payout?period=${period}`;
      if (period === 'custom' && startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }
      const res = await api.get(url);
      if (res.data?.success) {
        return {
          summary: res.data.summary || {},
          doctorPayouts: res.data.doctorPayouts || [],
          anesthetistPayouts: res.data.anesthetistPayouts || [],
          otaPayouts: res.data.otaPayouts || [],
          otPayouts: res.data.otPayouts || [],
          roomPayouts: res.data.roomPayouts || [],
          hospitalChargePayouts: res.data.hospitalChargePayouts || []
        };
      }
      return rejectWithValue(res.data?.message || 'Failed to fetch payout breakdown');
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Error fetching payout breakdown');
    }
  }
);

const initialState = {
  summary: {
    totalDoctorPayouts: 0,
    totalOtRevenue: 0,
    totalRoomRevenue: 0,
    totalRoomBilled: 0,
    totalHospitalCharges: 0,
    grandTotalPayoutPool: 0,
    grandTotalHospitalRevenue: 0
  },
  doctorPayouts: [],
  anesthetistPayouts: [],
  otaPayouts: [],
  otPayouts: [],
  roomPayouts: [],
  hospitalChargePayouts: [],
  loading: false,
  error: null,
  period: 'today',
  startDate: '',
  endDate: '',
  selectedDoctorId: 'ALL',
  searchQuery: '',
  activeTab: 'DOCTORS', // DOCTORS, ANESTHESIA, OTA, OT, HOSPITAL_CHARGES, ROOMS

  // Pagination states
  pagination: {
    doctorsPage: 1,
    doctorsPageSize: 10,
    anesthesiaPage: 1,
    anesthesiaPageSize: 10,
    otPage: 1,
    otPageSize: 10,
    otaPage: 1,
    otaPageSize: 10,
    hospitalChargesPage: 1,
    hospitalChargesPageSize: 10,
    roomsPage: 1,
    roomsPageSize: 10
  }
};

const payoutSlice = createSlice({
  name: 'payout',
  initialState,
  reducers: {
    setPeriod: (state, action) => {
      state.period = action.payload;
      state.pagination.doctorsPage = 1;
      state.pagination.anesthesiaPage = 1;
      state.pagination.otPage = 1;
      state.pagination.otaPage = 1;
      state.pagination.hospitalChargesPage = 1;
      state.pagination.roomsPage = 1;
    },
    setCustomDateRange: (state, action) => {
      state.startDate = action.payload.startDate;
      state.endDate = action.payload.endDate;
      state.period = 'custom';
      state.pagination.doctorsPage = 1;
      state.pagination.anesthesiaPage = 1;
      state.pagination.otPage = 1;
      state.pagination.otaPage = 1;
      state.pagination.hospitalChargesPage = 1;
      state.pagination.roomsPage = 1;
    },
    setSelectedDoctorId: (state, action) => {
      state.selectedDoctorId = action.payload;
      state.pagination.doctorsPage = 1;
      state.pagination.anesthesiaPage = 1;
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
      state.pagination.doctorsPage = 1;
      state.pagination.anesthesiaPage = 1;
      state.pagination.otPage = 1;
      state.pagination.otaPage = 1;
      state.pagination.hospitalChargesPage = 1;
      state.pagination.roomsPage = 1;
    },
    setActiveTab: (state, action) => {
      state.activeTab = action.payload;
    },
    setPaginationPage: (state, action) => {
      const { key, page } = action.payload;
      if (state.pagination[key] !== undefined) {
        state.pagination[key] = Math.max(1, page);
      }
    },
    setPaginationPageSize: (state, action) => {
      const { pageKey, sizeKey, size } = action.payload;
      if (state.pagination[sizeKey] !== undefined) {
        state.pagination[sizeKey] = Number(size);
        if (state.pagination[pageKey] !== undefined) {
          state.pagination[pageKey] = 1;
        }
      }
    },
    resetPayoutState: () => initialState
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPayoutBreakdownThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPayoutBreakdownThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.summary = action.payload.summary;
        state.doctorPayouts = action.payload.doctorPayouts;
        state.anesthetistPayouts = action.payload.anesthetistPayouts;
        state.otaPayouts = action.payload.otaPayouts;
        state.otPayouts = action.payload.otPayouts;
        state.roomPayouts = action.payload.roomPayouts;
        state.hospitalChargePayouts = action.payload.hospitalChargePayouts || [];
      })
      .addCase(fetchPayoutBreakdownThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch payout breakdown';
      });
  }
});

export const {
  setPeriod,
  setCustomDateRange,
  setSelectedDoctorId,
  setSearchQuery,
  setActiveTab,
  setPaginationPage,
  setPaginationPageSize,
  resetPayoutState
} = payoutSlice.actions;

export default payoutSlice.reducer;
