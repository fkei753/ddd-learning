import { AggregateRoot, DomainEvent } from "../shared/DomainEvent";
import { Money } from "../shared/Money";
import { CustomerId } from "../customer/CustomerId";
import { OrderId } from "./OrderId";
import { OrderItem } from "./OrderItem";
import { OrderStatus, CANCELLABLE_STATUSES } from "./OrderStatus";

// ─── ドメインイベント定義 ─────────────────────────────────────────

/** 注文が発注された */
export class OrderPlaced implements DomainEvent {
  readonly eventType = "OrderPlaced";
  readonly occurredAt = new Date();
  constructor(
    public readonly orderId: OrderId,
    public readonly customerId: CustomerId
  ) {}
}

/** 注文が確定された */
export class OrderConfirmed implements DomainEvent {
  readonly eventType = "OrderConfirmed";
  readonly occurredAt = new Date();
  constructor(public readonly orderId: OrderId) {}
}

/** 注文がキャンセルされた */
export class OrderCancelled implements DomainEvent {
  readonly eventType = "OrderCancelled";
  readonly occurredAt = new Date();
  constructor(public readonly orderId: OrderId) {}
}

// ─── 集約ルート：Order ────────────────────────────────────────────

/**
 * 集約ルート（Aggregate Root）：Order（注文）
 *
 * 【不変条件（Invariant）】
 * 1. 注文明細が 0 件の注文は存在できない
 * 2. SHIPPED 以降はキャンセルできない
 * 3. 合計金額 = 各明細の小計の合計
 *
 * 外部から操作できるのは この集約ルートのみ。
 * OrderItem を直接操作してはならない。
 */
export class Order extends AggregateRoot {
  private constructor(
    private readonly _id: OrderId,
    private readonly _customerId: CustomerId,
    private _status: OrderStatus,
    private readonly _items: OrderItem[],
    private readonly _placedAt: Date
  ) {
    super();
  }

  // ─── ファクトリメソッド ──────────────────────────────────────────

  /**
   * 注文を発注する（Place an Order）
   *
   * ユビキタス言語の「発注する」をそのままメソッド名にしている。
   */
  static place(customerId: CustomerId, items: OrderItem[]): Order {
    // 不変条件チェック①：明細が1件以上必要
    if (!items || items.length === 0) {
      throw new Error("注文には少なくとも1つの注文明細が必要です");
    }

    const order = new Order(
      OrderId.generate(),
      customerId,
      OrderStatus.PENDING,
      [...items],
      new Date()
    );

    // ドメインイベントを発行
    order.addDomainEvent(new OrderPlaced(order._id, customerId));

    return order;
  }

  /** リポジトリからの再構築用 */
  static reconstruct(
    id: OrderId,
    customerId: CustomerId,
    status: OrderStatus,
    items: OrderItem[],
    placedAt: Date
  ): Order {
    return new Order(id, customerId, status, items, placedAt);
  }

  // ─── ゲッター ────────────────────────────────────────────────────

  get id(): OrderId {
    return this._id;
  }

  get customerId(): CustomerId {
    return this._customerId;
  }

  get status(): OrderStatus {
    return this._status;
  }

  get items(): readonly OrderItem[] {
    return this._items;
  }

  get placedAt(): Date {
    return this._placedAt;
  }

  /**
   * 合計金額を計算する
   * 不変条件③：各明細の小計を合計したもの
   */
  get totalAmount(): Money {
    return this._items.reduce(
      (sum, item) => sum.add(item.subTotal),
      Money.of(0, "JPY")
    );
  }

  // ─── ドメインロジック ────────────────────────────────────────────

  /**
   * 注文を確定する（Confirm an Order）
   * PENDING のときのみ確定できる。
   */
  confirm(): void {
    if (this._status !== OrderStatus.PENDING) {
      throw new Error(
        `PENDING の注文のみ確定できます。現在のステータス: ${this._status}`
      );
    }
    this._status = OrderStatus.CONFIRMED;
    this.addDomainEvent(new OrderConfirmed(this._id));
  }

  /**
   * 注文をキャンセルする（Cancel an Order）
   * 不変条件②：SHIPPED 以降はキャンセルできない
   */
  cancel(): void {
    if (!CANCELLABLE_STATUSES.includes(this._status)) {
      throw new Error(
        `発送済みまたは配達完了の注文はキャンセルできません。現在のステータス: ${this._status}`
      );
    }
    this._status = OrderStatus.CANCELLED;
    this.addDomainEvent(new OrderCancelled(this._id));
  }

  /** 発送済みにする */
  ship(): void {
    if (this._status !== OrderStatus.CONFIRMED) {
      throw new Error(
        `確定済みの注文のみ発送できます。現在のステータス: ${this._status}`
      );
    }
    this._status = OrderStatus.SHIPPED;
  }
}
