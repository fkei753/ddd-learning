import { Money } from "../shared/Money";

/**
 * エンティティ：OrderItem（注文明細）
 *
 * - OrderItemId で識別される（エンティティの特徴）
 * - Order 集約の内部に属する
 * - 直接外部からは操作しない（Order を通じて操作する）
 */
export class OrderItem {
  private constructor(
    private readonly _id: string,
    private readonly _productId: string,
    private readonly _productName: string,
    private readonly _unitPrice: Money,
    private _quantity: number
  ) {
    if (_quantity <= 0) {
      throw new Error(`数量は1以上でなければなりません: ${_quantity}`);
    }
  }

  static create(
    productId: string,
    productName: string,
    unitPrice: Money,
    quantity: number
  ): OrderItem {
    const id = `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    return new OrderItem(id, productId, productName, unitPrice, quantity);
  }

  get id(): string {
    return this._id;
  }

  get productId(): string {
    return this._productId;
  }

  get productName(): string {
    return this._productName;
  }

  get unitPrice(): Money {
    return this._unitPrice;
  }

  get quantity(): number {
    return this._quantity;
  }

  /** 小計を計算する（単価 × 数量） */
  get subTotal(): Money {
    return this._unitPrice.multiply(this._quantity);
  }
}
