import { configureStore } from '@reduxjs/toolkit'
import { persistStore, persistReducer } from 'redux-persist'
import storage from 'redux-persist/lib/storage'
import { combineReducers } from '@reduxjs/toolkit'

import authSlice from './slices/authSlice'
import gameSlice from './slices/gameSlice'
import boardSlice from './slices/boardSlice'
import templateSlice from './slices/templateSlice'
import uiSlice from './slices/uiSlice'
import notificationSlice from './slices/notificationSlice'

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['auth', 'ui'], // Only persist auth and UI preferences
  blacklist: ['game', 'board', 'template', 'notification'], // Don't persist real-time data
}

const rootReducer = combineReducers({
  auth: authSlice.reducer,
  game: gameSlice.reducer,
  board: boardSlice.reducer,
  template: templateSlice.reducer,
  ui: uiSlice.reducer,
  notification: notificationSlice.reducer,
})

const persistedReducer = persistReducer(persistConfig, rootReducer)

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        ignoredPaths: ['register'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
})

export const persistor = persistStore(store)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export default store