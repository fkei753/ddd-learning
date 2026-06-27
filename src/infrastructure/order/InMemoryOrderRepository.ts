import { Order } from "../../domain/order/Order";
import { OrderId } from "../../domain/order/OrderId";
import { CustomerId } from "../../domain/customer/CustomerId";
import { OrderRepository } from "../../domain/order/OrderRepository";

/**
 * インフラ層：InMemoryOrderRepository
 *
 * OrderRepository インターフェースのインメモリ実装。
 * - テストや開発時に使用する
 * - 本番では PostgresOrderRepository や DynamoOrderRepository に差し替える
 * - ドメイン層（Order, OrderRepository）には変更不要
 *
 * これが依存性逆転の原則（DIP）の実例：
 * ドメイン層は「何を使って保存するか」を知らない。
 */
export class InMemoryOrderRepository implements OrderRepository {
  private readonly store = new Map<string, Order>();

  async findById(id: OrderId): Promise<Order | null> {
    return this.store.get(id.value) ?? null;
  }

  async findByCustomerId(customerId: CustomerId): Promise<Order[]> {
    return Array.from(this.store.values()).filter((order) =>
      order.customerId.equals(customerId)
    );
  }

  async save(order: Order): Promise<void> {
    this.store.set(order.id.value, order);
  }

  /** テスト用：全件取得 */
  async findAll(): Promise<Order[]> {
    return Array.from(this.store.values());
  }
}
