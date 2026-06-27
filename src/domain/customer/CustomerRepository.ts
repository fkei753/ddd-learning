import { Customer } from "./Customer";
import { CustomerId } from "./CustomerId";

/**
 * リポジトリインターフェース：CustomerRepository
 *
 * - ドメイン層に定義する（インターフェースのみ）
 * - 実装（DB接続など）はインフラ層に置く
 * - これにより、ドメイン層はDB技術に依存しない
 */
export interface CustomerRepository {
  findById(id: CustomerId): Promise<Customer | null>;
  save(customer: Customer): Promise<void>;
}
