import { Order } from "./Order";
import { OrderId } from "./OrderId";
import { CustomerId } from "../customer/CustomerId";

/**
 * リポジトリインターフェース：OrderRepository
 *
 * ドメイン層にインターフェースを定義することで、
 * ドメインロジックが DB の詳細を知らなくて済む。
 * （依存性逆転の原則）
 */
export interface OrderRepository {
  findById(id: OrderId): Promise<Order | null>;
  findByCustomerId(customerId: CustomerId): Promise<Order[]>;
  save(order: Order): Promise<void>;
}
