/**
 * 値オブジェクト：OrderStatus（注文ステータス）
 *
 * ユビキタス言語で定義した注文の状態遷移を表現する。
 *
 * PENDING → CONFIRMED → SHIPPED → DELIVERED
 *         ↘ CANCELLED（SHIPPED前のみ可）
 */
export const OrderStatus = {
  PENDING: "PENDING",       // 注文受付（発注済み・未確定）
  CONFIRMED: "CONFIRMED",   // 注文確定
  SHIPPED: "SHIPPED",       // 発送済み
  DELIVERED: "DELIVERED",   // 配達完了
  CANCELLED: "CANCELLED",   // キャンセル済み
} as const;

export type OrderStatus = typeof OrderStatus[keyof typeof OrderStatus];

/** キャンセル可能なステータス一覧 */
export const CANCELLABLE_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
];
