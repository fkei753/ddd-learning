/**
 * コマンド：PlaceOrderCommand
 *
 * アプリケーション層への入力を表すデータオブジェクト。
 * - 検証済みのプリミティブ値を持つ
 * - ドメインオブジェクトへの変換はユースケースが行う
 */
export interface OrderItemInput {
  productId: string;
  productName: string;
  unitPriceAmount: number;   // 例：1500
  currency: string;          // 例："JPY"
  quantity: number;
}

export interface PlaceOrderCommand {
  customerId: string;
  items: OrderItemInput[];
}
