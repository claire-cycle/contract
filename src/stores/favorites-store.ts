import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface FavoriteContract {
  id: string;
  address: string;
  chainId: number;
  name?: string;
  abiJson: string;
  timestamp: number;
}

interface FavoritesState {
  favorites: FavoriteContract[];
}

interface FavoritesActions {
  addFavorite: (fav: FavoriteContract) => void;
  removeFavorite: (id: string) => void;
  isFavorite: (address: string, chainId: number) => boolean;
  getFavorite: (address: string, chainId: number) => FavoriteContract | undefined;
}

type FavoritesStore = FavoritesState & FavoritesActions;

const MAX_FAVORITES = 50;

export const useFavoritesStore = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      favorites: [],

      addFavorite: (fav) =>
        set((state) => {
          const filtered = state.favorites.filter(
            (f) => !(f.address.toLowerCase() === fav.address.toLowerCase() && f.chainId === fav.chainId),
          );
          const updated = [fav, ...filtered].slice(0, MAX_FAVORITES);
          return { favorites: updated };
        }),

      removeFavorite: (id) =>
        set((state) => ({
          favorites: state.favorites.filter((f) => f.id !== id),
        })),

      isFavorite: (address, chainId) =>
        get().favorites.some(
          (f) => f.address.toLowerCase() === address.toLowerCase() && f.chainId === chainId,
        ),

      getFavorite: (address, chainId) =>
        get().favorites.find(
          (f) => f.address.toLowerCase() === address.toLowerCase() && f.chainId === chainId,
        ),
    }),
    {
      name: 'favorites-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
