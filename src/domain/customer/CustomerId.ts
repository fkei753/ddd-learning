/**
 * 値オブジェクト：CustomerId（顧客ID）
 *
 * - ただの string ではなく「顧客ID」という意味を持つ型
 * - 誤った型の混入をコンパイル時に防ぐ（型安全性）
 */
export class CustomerId {
  private constructor(private readonly _value: string) {
    if (!_value || _value.trim().length === 0) {
      throw new Error("顧客IDは空にできません");
    }
  }

  static of(value: string): CustomerId {
    return new CustomerId(value);
  }

  /** ランダムなIDを生成する */
  static generate(): CustomerId {
    return new CustomerId(`cust-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  }

  get value(): string {
    return this._value;
  }

  equals(other: CustomerId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
