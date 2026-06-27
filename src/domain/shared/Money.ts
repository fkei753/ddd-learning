/**
 * 値オブジェクト：Money（金額）
 *
 * - 数値と通貨コードのペアで意味を持つ
 * - 不変（Immutable）: 演算は新しいインスタンスを返す
 * - 属性が同じなら等値とみなす
 */
export class Money {
  // コンストラクタを private にして、ファクトリメソッド経由での生成を強制
  private constructor(
    private readonly _amount: number,
    private readonly _currency: string
  ) {
    if (_amount < 0) {
      throw new Error(`金額は0以上でなければなりません: ${_amount}`);
    }
    if (!_currency || _currency.length !== 3) {
      throw new Error(`通貨コードは3文字でなければなりません: ${_currency}`);
    }
  }

  /** ファクトリメソッド */
  static of(amount: number, currency: string): Money {
    return new Money(amount, currency);
  }

  get amount(): number {
    return this._amount;
  }

  get currency(): string {
    return this._currency;
  }

  /** 加算 → 新しい Money を返す（不変性の保証） */
  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._amount + other._amount, this._currency);
  }

  /** 乗算 → 数量 × 単価 の計算に使う */
  multiply(factor: number): Money {
    return new Money(this._amount * factor, this._currency);
  }

  /** 等値比較：属性が同じなら等しい（値オブジェクトの特徴） */
  equals(other: Money): boolean {
    return this._amount === other._amount && this._currency === other._currency;
  }

  toString(): string {
    return `${this._amount} ${this._currency}`;
  }

  private assertSameCurrency(other: Money): void {
    if (this._currency !== other._currency) {
      throw new Error(
        `通貨が異なります: ${this._currency} vs ${other._currency}`
      );
    }
  }
}
