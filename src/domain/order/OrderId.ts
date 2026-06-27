/**
 * 値オブジェクト：OrderId（注文ID）
 */
export class OrderId {
  private constructor(private readonly _value: string) {
    if (!_value || _value.trim().length === 0) {
      throw new Error("注文IDは空にできません");
    }
  }

  static of(value: string): OrderId {
    return new OrderId(value);
  }

  static generate(): OrderId {
    return new OrderId(`ord-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  }

  get value(): string {
    return this._value;
  }

  equals(other: OrderId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
