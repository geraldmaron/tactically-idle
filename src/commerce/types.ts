export type MockProvider = 'apple' | 'google';
export type PurchaseStatus = 'pending' | 'cancelled' | 'failed' | 'credited' | 'completed';
export type MockOutcome = 'success' | 'pending' | 'cancel' | 'fail' | 'completion_failure';
export interface TestProduct { id: string; name: string; milliDP: number }
export const TEST_PRODUCTS: readonly TestProduct[] = [
  { id: 'mock.dp.3', name: '3 test DP', milliDP: 3000 },
  { id: 'mock.dp.8', name: '8 test DP', milliDP: 8000 },
  { id: 'mock.dp.20', name: '20 test DP', milliDP: 20000 },
];
export interface TestTransaction {
  key: string;
  requestId: string;
  provider: MockProvider;
  environment: 'local-test';
  productId: string;
  createdAt: number;
  updatedAt: number;
  status: PurchaseStatus;
  /** Catalog-derived amount. Callback payloads cannot set a price or credit. */
  milliDP: number;
  debtPaid: number;
  spent: number;
  allocations: Record<string, number>;
  completionFailed: boolean;
  refundedAt?: number;
  /** Player pack claims remember their destination across close/reload. */
  claimCampaignId?: string;
  claimDelivered?: boolean;
}
export interface TestWallet {
  version: 1;
  installationId: string;
  revision: number;
  debt: number;
  transactions: TestTransaction[];
}
export interface ProviderEvent {
  key: string;
  provider: MockProvider;
  environment: string;
  productId: string;
  verified: boolean;
  outcome: MockOutcome;
}
export const newLocalId = () => typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
