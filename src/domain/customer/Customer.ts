import { CustomerId } from "./CustomerId";

/**
 * エンティティ / 集約ルート：Customer（顧客）
 *
 * - CustomerId で一意に識別される（エンティティの特徴）
 * - 注文コンテキストにおける「顧客」の概念を表す
 * - 顧客自身のビジネスルール（例：VIP判定）を持つ
 */
export class Customer {
  private constructor(
    private readonly _id: CustomerId,
    private _name: string,
    private _email: string,
    private _totalPurchaseAmount: number
  ) {}

  /** ファクトリメソッド：新規顧客を作成する */
  static create(name: string, email: string): Customer {
    if (!name || name.trim().length === 0) {
      throw new Error("顧客名は必須です");
    }
    if (!email || !email.includes("@")) {
      throw new Error("有効なメールアドレスを入力してください");
    }
    return new Customer(CustomerId.generate(), name.trim(), email, 0);
  }

  /** 既存顧客を再構築する（リポジトリからの復元用） */
  static reconstruct(
    id: CustomerId,
    name: string,
    email: string,
    totalPurchaseAmount: number
  ): Customer {
    return new Customer(id, name, email, totalPurchaseAmount);
  }

  get id(): CustomerId {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get email(): string {
    return this._email;
  }

  get totalPurchaseAmount(): number {
    return this._totalPurchaseAmount;
  }

  /**
   * ドメインロジック：VIP顧客かどうかを判定する
   * 累計購入額が 100,000 円以上であれば VIP
   */
  isVip(): boolean {
    return this._totalPurchaseAmount >= 100_000;
  }

  /** 購入額を加算する（注文確定時に呼ばれる） */
  addPurchaseAmount(amount: number): void {
    this._totalPurchaseAmount += amount;
  }
}
