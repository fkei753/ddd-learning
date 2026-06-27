import { Order } from "../../domain/order/Order";
import { OrderItem } from "../../domain/order/OrderItem";
import { OrderRepository } from "../../domain/order/OrderRepository";
import { OrderDomainService } from "../../domain/order/OrderDomainService";
import { CustomerRepository } from "../../domain/customer/CustomerRepository";
import { CustomerId } from "../../domain/customer/CustomerId";
import { Money } from "../../domain/shared/Money";
import { PlaceOrderCommand } from "./PlaceOrderCommand";

/**
 * ユースケース：PlaceOrderUseCase（注文を発注する）
 *
 * アプリケーション層の責務：
 * 1. 入力（Command）を検証してドメインオブジェクトに変換する
 * 2. ドメインオブジェクトを組み合わせてユースケースを実現する
 * 3. リポジトリを使って永続化する
 *
 * ビジネスロジック自体は書かない → ドメイン層に委譲する
 */
export class PlaceOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepository,      // 抽象に依存
    private readonly customerRepository: CustomerRepository, // 抽象に依存
    private readonly orderDomainService: OrderDomainService
  ) {}

  async execute(command: PlaceOrderCommand): Promise<PlaceOrderResult> {
    // ① 顧客の存在確認
    const customerId = CustomerId.of(command.customerId);
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error(`顧客が見つかりません: ${command.customerId}`);
    }

    // ② コマンドから注文明細を生成（プリミティブ → ドメインオブジェクト）
    const orderItems = command.items.map((item) =>
      OrderItem.create(
        item.productId,
        item.productName,
        Money.of(item.unitPriceAmount, item.currency),
        item.quantity
      )
    );

    // ③ 注文を発注する（ドメインロジックはOrderに委譲）
    const order = Order.place(customerId, orderItems);

    // ④ 割引額を計算する（ドメインサービスに委譲）
    const discount = this.orderDomainService.calculateDiscount(
      customer,
      order.totalAmount
    );

    // ⑤ 注文を保存する
    await this.orderRepository.save(order);

    // ⑥ ドメインイベントを取り出す（通知・ログ等に使える）
    const events = order.pullDomainEvents();
    console.log(
      `[イベント発行] ${events.map((e) => e.eventType).join(", ")}`
    );

    return {
      orderId: order.id.value,
      totalAmount: order.totalAmount.amount,
      discountAmount: discount.amount,
      finalAmount: order.totalAmount.amount - discount.amount,
      currency: order.totalAmount.currency,
      status: order.status,
    };
  }
}

/** ユースケースの出力DTO */
export interface PlaceOrderResult {
  orderId: string;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  currency: string;
  status: string;
}
