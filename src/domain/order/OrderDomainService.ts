import { Customer } from "../customer/Customer";
import { Money } from "../shared/Money";

/**
 * ドメインサービス：OrderDomainService
 *
 * 「注文割引額の計算」は Order にも Customer にも自然に属さないため、
 * ドメインサービスに置く。
 *
 * ドメインサービスの特徴：
 * - ステートレス（状態を持たない）
 * - ドメインの概念を表現するが、特定の集約に属さない
 * - インフラ層には依存しない
 */
export class OrderDomainService {
  /**
   * 割引額を計算する
   *
   * ビジネスルール：
   * - VIP顧客は注文合計の 10% 割引
   * - 通常顧客は割引なし
   */
  calculateDiscount(customer: Customer, totalAmount: Money): Money {
    if (customer.isVip()) {
      // VIP割引：10%
      const discountRate = 0.1;
      return Money.of(
        Math.floor(totalAmount.amount * discountRate),
        totalAmount.currency
      );
    }
    return Money.of(0, totalAmount.currency);
  }
}
