import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../lib/api';

export const fetchAdminDataThunk = createAsyncThunk(
  'admin/fetchAdminData',
  async (_, { rejectWithValue }) => {
    try {
      const [userRes, patRes, roomRes, dashRes] = await Promise.all([
        api.get('/users').catch((err) => {
          console.warn('Admin fetch /users error:', err);
          return { data: { success: false, users: [] } };
        }),
        api.get('/patients').catch((err) => {
          console.warn('Admin fetch /patients error:', err);
          return { data: { success: false, patients: [] } };
        }),
        api.get('/opd-rooms').catch((err) => {
          console.warn('Admin fetch /opd-rooms error:', err);
          return { data: { success: false, rooms: [] } };
        }),
        api.get('/admin/dashboard').catch((err) => {
          console.warn('Admin fetch /admin/dashboard error:', err);
          return { data: { success: false, metrics: {} } };
        })
      ]);

      return {
        users: userRes.data?.success && Array.isArray(userRes.data.users) ? userRes.data.users : [],
        patients: patRes.data?.success && Array.isArray(patRes.data.patients) ? patRes.data.patients : [],
        opdRooms: roomRes.data?.success && Array.isArray(roomRes.data.rooms) ? roomRes.data.rooms : [],
        metrics: dashRes.data?.success && dashRes.data.metrics ? dashRes.data.metrics : {}
      };
    } catch (err) {
      console.error('fetchAdminDataThunk error:', err);
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch admin data.');
    }
  }
);

export const createAdminUserThunk = createAsyncThunk(
  'admin/createAdminUser',
  async (userFormData, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.post('/users', userFormData);
      if (res.data.success) {
        dispatch(fetchAdminDataThunk());
        return res.data;
      }
      return rejectWithValue(res.data.message || 'Failed to create user.');
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create user.');
    }
  }
);

export const updateAdminUserThunk = createAsyncThunk(
  'admin/updateAdminUser',
  async ({ id, userFormData }, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.put(`/users/${id}`, userFormData);
      if (res.data.success) {
        dispatch(fetchAdminDataThunk());
        return res.data;
      }
      return rejectWithValue(res.data.message || 'Failed to update user.');
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update user.');
    }
  }
);

export const deleteAdminUserThunk = createAsyncThunk(
  'admin/deleteAdminUser',
  async (id, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.delete(`/users/${id}`);
      if (res.data.success) {
        dispatch(fetchAdminDataThunk());
        return res.data;
      }
      return rejectWithValue(res.data.message || 'Failed to delete user.');
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete user.');
    }
  }
);

export const createAdminPatientThunk = createAsyncThunk(
  'admin/createAdminPatient',
  async (patientFormData, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.post('/patients', patientFormData);
      if (res.data.success) {
        dispatch(fetchAdminDataThunk());
        return res.data;
      }
      return rejectWithValue(res.data.message || 'Failed to create patient.');
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create patient.');
    }
  }
);

export const updateAdminPatientThunk = createAsyncThunk(
  'admin/updateAdminPatient',
  async ({ id, patientFormData }, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.put(`/patients/${id}`, patientFormData);
      if (res.data.success) {
        dispatch(fetchAdminDataThunk());
        return res.data;
      }
      return rejectWithValue(res.data.message || 'Failed to update patient.');
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update patient.');
    }
  }
);

export const deleteAdminPatientThunk = createAsyncThunk(
  'admin/deleteAdminPatient',
  async (id, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.delete(`/patients/${id}`);
      if (res.data.success) {
        dispatch(fetchAdminDataThunk());
        return res.data;
      }
      return rejectWithValue(res.data.message || 'Failed to delete patient.');
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete patient.');
    }
  }
);

const adminSlice = createSlice({
  name: 'admin',
  initialState: {
    users: [],
    patients: [],
    opdRooms: [],
    dashboardMetrics: {},
    loading: false,
    error: null,
    activeTab: 'patients',
    searchTerm: '',
    patientPage: 1,
    patientItemsPerPage: 5,
    userPage: 1,
    userItemsPerPage: 5
  },
  reducers: {
    setActiveTab: (state, action) => {
      state.activeTab = action.payload;
      state.patientPage = 1;
      state.userPage = 1;
    },
    setSearchTerm: (state, action) => {
      state.searchTerm = action.payload;
      state.patientPage = 1;
      state.userPage = 1;
    },
    setPatientPage: (state, action) => {
      state.patientPage = action.payload;
    },
    setPatientItemsPerPage: (state, action) => {
      state.patientItemsPerPage = action.payload;
      state.patientPage = 1;
    },
    setUserPage: (state, action) => {
      state.userPage = action.payload;
    },
    setUserItemsPerPage: (state, action) => {
      state.userItemsPerPage = action.payload;
      state.userPage = 1;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminDataThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAdminDataThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.users = action.payload.users;
        state.patients = action.payload.patients;
        state.opdRooms = action.payload.opdRooms;
        state.dashboardMetrics = action.payload.metrics;
      })
      .addCase(fetchAdminDataThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export const {
  setActiveTab,
  setSearchTerm,
  setPatientPage,
  setPatientItemsPerPage,
  setUserPage,
  setUserItemsPerPage
} = adminSlice.actions;

export default adminSlice.reducer;
