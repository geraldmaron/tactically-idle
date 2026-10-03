import { TEST_PRODUCTS, type MockOutcome, type MockProvider, type ProviderEvent, type TestTransaction } from './types';

/** A local test adapter. It never calls Apple, Google, a native SDK or a payment endpoint. */
export class MockStoreProvider {
  constructor(readonly provider: MockProvider) {}
  listProducts() { return TEST_PRODUCTS; }
  startPurchase(productId: string, requestId: string) {
    if (!TEST_PRODUCTS.some((p) => p.id === productId)) throw new Error('Unknown test product');
    return { key: `mock:${this.provider}:${requestId}`, requestId, provider: this.provider, environment: 'local-test' as const, productId };
  }
  resolve(transaction: TestTransaction, outcome: MockOutcome): ProviderEvent {
    if (transaction.provider !== this.provider) throw new Error('Wrong test provider');
    return { key: transaction.key, provider: this.provider, environment: 'local-test', productId: transaction.productId,
      verified: outcome === 'success' || outcome === 'completion_failure', outcome };
  }
  reconcile(transaction: TestTransaction): ProviderEvent | null {
    // A pending test needs an explicit simulated outcome; checking it cannot manufacture approval.
    return transaction.status === 'credited' || transaction.status === 'completed' ? this.resolve(transaction, 'success') : null;
  }
  complete(transaction: TestTransaction, simulateFailure = false) {
    if (!['credited', 'completed'].includes(transaction.status)) throw new Error('Fulfillment must be saved before completion');
    return { key: transaction.key, completed: !simulateFailure };
  }
}
