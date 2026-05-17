import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { privateKeyToAccount } from 'viem/accounts';
import { type Hex } from 'viem';

interface WalletState {
  address: string | null;
  encryptedKey: string | null; // base64-encoded XOR-encrypted key
  connected: boolean;
}

interface WalletActions {
  importWallet: (privateKey: string) => void;
  disconnect: () => void;
  getPrivateKey: () => string | null;
}

type WalletStore = WalletState & WalletActions;

// Simple XOR encryption with a device-specific salt (not cryptographic-grade,
// but adequate for local desktop storage). For production, use tauri-plugin-sql
// with a user-provided password and AES-256.
const SALT = 'web3-contract-tool-local-v1';

function encryptKey(privateKey: string): string {
  const keyBytes = new TextEncoder().encode(privateKey);
  const saltBytes = new TextEncoder().encode(SALT);
  const encrypted = new Uint8Array(keyBytes.length);
  for (let i = 0; i < keyBytes.length; i++) {
    encrypted[i] = keyBytes[i] ^ saltBytes[i % saltBytes.length];
  }
  return btoa(String.fromCharCode(...encrypted));
}

function decryptKey(encrypted: string): string | null {
  try {
    const decoded = atob(encrypted);
    const saltBytes = new TextEncoder().encode(SALT);
    const result = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      result[i] = decoded.charCodeAt(i) ^ saltBytes[i % saltBytes.length];
    }
    return new TextDecoder().decode(result);
  } catch {
    return null;
  }
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set, get) => ({
      address: null,
      encryptedKey: null,
      connected: false,

      importWallet: (privateKey: string) => {
        // Normalize: ensure 0x prefix and 32 bytes
        let pk = privateKey.trim();
        if (!pk.startsWith('0x')) pk = '0x' + pk;
        if (!/^0x[a-fA-F0-9]{64}$/.test(pk)) {
          throw new Error('Invalid private key format');
        }

        const account = privateKeyToAccount(pk as Hex);
        set({
          address: account.address,
          encryptedKey: encryptKey(pk),
          connected: true,
        });
      },

      disconnect: () =>
        set({
          address: null,
          encryptedKey: null,
          connected: false,
        }),

      getPrivateKey: () => {
        const { encryptedKey } = get();
        if (!encryptedKey) return null;
        return decryptKey(encryptedKey);
      },
    }),
    {
      name: 'wallet-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        address: state.address,
        encryptedKey: state.encryptedKey,
        connected: state.connected,
      }),
    },
  ),
);
