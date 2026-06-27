# 戦術的設計（Tactical Design）

## 1. 全体像：戦術的設計の構成要素

戦術的設計は、ドメインモデルを実装するための **構成要素（Building Blocks）** の集まりです。
それぞれがどんな役割を持つかを把握してから、個別に深掘りします。

```
┌────────────────────────────────────────────────────────────┐
│  集約（Aggregate）  ← 整合性を保つ単位                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  集約ルート（Aggregate Root）  ← 外部への窓口            │  │
│  │         extends AggregateRoot                        │  │
│  │                                                      │  │
│  │  ┌──────────────────┐   ┌──────────────────────┐    │  │
│  │  │ エンティティ        │   │  値オブジェクト          │    │  │
│  │  │ (Entity)         │   │  (Value Object)      │    │  │
│  │  │  ・IDで識別         │   │  ・属性で識別            │    │  │
│  │  │  ・可変             │   │  ・不変（Immutable）    │    │  │
│  │  └──────────────────┘   └──────────────────────┘    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ドメインイベント（Domain Event）  ← 起きた事実の通知            │
└────────────────────────────────────────────────────────────┘
             ↕ 永続化・取得
    リポジトリ（Repository）  ← 集約の保存・検索を抽象化

             どの集約にも属さないロジック
    ドメインサービス（Domain Service）
```

---

## 2. 値オブジェクト（Value Object）

### 定義

**属性（値）によって識別されるオブジェクト。**
同じ属性を持つ 2 つのインスタンスは「同じもの」とみなします。

### 3 つの特徴

| 特徴 | 説明 |
|-----|------|
| **等値性（Equality）** | 属性が同じなら等しいと判断する |
| **不変性（Immutability）** | 作成後に内部状態を変更しない。変更は新インスタンスを作る |
| **自己検証（Self-Validation）** | コンストラクタで不正な値を受け付けない |

### なぜ値オブジェクトを使うか？

プリミティブ（`number`, `string`）で済む場合でも、値オブジェクトにすることで：

```typescript
// ❌ プリミティブで書いた場合の問題
function calculateTax(amount: number, taxRate: number): number {
  return amount * taxRate; // amount と taxRate、どちらが先？引数の順番を間違えやすい
}

// ❌ 通貨の概念がない
const price = 1500; // これは円？ドル？ユーロ？

// ✅ 値オブジェクトで表現
const price = Money.of(1500, 'JPY');
const taxRate = TaxRate.of(0.1);
const tax = price.applyTaxRate(taxRate); // → Money.of(150, 'JPY')
// 引数の意味が型で明確。通貨情報も持っている。
```

### 実装：Money の例

```typescript
// src/domain/shared/Money.ts
export class Money {
  // ① コンストラクタを private にして不正な生成を防ぐ
  private constructor(
    private readonly _amount: number,
    private readonly _currency: string
  ) {
    // ② 自己検証：不正な値はコンストラクタで弾く
    if (_amount < 0) {
      throw new Error(`金額は0以上でなければなりません: ${_amount}`);
    }
    if (!_currency || _currency.length !== 3) {
      throw new Error(`通貨コードは3文字でなければなりません: ${_currency}`);
    }
  }

  // ③ ファクトリメソッドで生成する
  static of(amount: number, currency: string): Money {
    return new Money(amount, currency);
  }

  // ④ 演算は新しいインスタンスを返す（不変性の保証）
  add(other: Money): Money {
    if (this._currency !== other._currency) {
      throw new Error(`通貨が異なります: ${this._currency} vs ${other._currency}`);
    }
    return new Money(this._amount + other._amount, this._currency);
  }

  multiply(factor: number): Money {
    return new Money(this._amount * factor, this._currency);
  }

  // ⑤ 属性が同じなら等しい（等値性）
  equals(other: Money): boolean {
    return this._amount === other._amount && this._currency === other._currency;
  }
}
```

```typescript
// 使い方の例
const price = Money.of(1500, 'JPY');
const qty = 3;
const subtotal = price.multiply(qty); // Money.of(4500, 'JPY')

const tax = subtotal.multiply(0.1);    // Money.of(450, 'JPY')
const total = subtotal.add(tax);       // Money.of(4950, 'JPY')

// 等値比較（参照ではなく値で比較）
Money.of(1500, 'JPY').equals(Money.of(1500, 'JPY')); // → true
Money.of(1500, 'JPY').equals(Money.of(1500, 'USD')); // → false（通貨が違う）
```

### よくある値オブジェクトの例

| 概念 | なぜ値オブジェクトか |
|-----|-------------------|
| `Money(1500, 'JPY')` | 金額は通貨と不可分。同じ値は等しい |
| `OrderId('ord-001')` | ID そのものが意味を持つ型安全な識別子 |
| `Email('a@b.com')` | 形式検証が必要。メアドは値で識別 |
| `Address` | 複数フィールドの組み合わせで一つの概念 |
| `DateRange(from, to)` | 期間を表す。`from < to` の検証も含める |

---

## 3. エンティティ（Entity）

### 定義

**同一性（Identity）によって識別されるオブジェクト。**
属性が変わっても ID が同じなら「同じもの」とみなします。

### エンティティ vs 値オブジェクトの判断基準

> **「この概念を追跡する必要があるか？」**
> 追跡が必要 → エンティティ（IDで識別）
> 追跡不要 → 値オブジェクト（値で識別）

```
例：
  ・注文（Order）→ エンティティ
      「注文 ord-001 の状態が変わっても、同じ注文として追跡する」

  ・金額（Money）→ 値オブジェクト
      「1500円のインスタンスが別物でも、値が同じなら等しい。追跡は不要」

  ・顧客（Customer）→ エンティティ
      「名前や住所が変わっても、同じ顧客として追跡する」

  ・住所（Address）→ 値オブジェクト
      「引っ越しは『住所を更新』ではなく『新しい住所に置き換え』」
```

### 実装：OrderItem の例

```typescript
// src/domain/order/OrderItem.ts
export class OrderItem {
  // コンストラクタを private にして factory 経由での生成を強制
  private constructor(
    private readonly _id: string,      // ← ID で識別（エンティティの特徴）
    private readonly _productId: string,
    private readonly _productName: string,
    private readonly _unitPrice: Money,
    private _quantity: number           // ← 変更可能（エンティティの特徴）
  ) {
    if (_quantity <= 0) {
      throw new Error(`数量は1以上でなければなりません: ${_quantity}`);
    }
  }

  // ファクトリメソッド
  static create(
    productId: string,
    productName: string,
    unitPrice: Money,
    quantity: number
  ): OrderItem {
    const id = `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    return new OrderItem(id, productId, productName, unitPrice, quantity);
  }

  // 小計を計算（単価 × 数量）
  get subtotal(): Money {
    return this._unitPrice.multiply(this._quantity);
  }
}
```

---

## 4. 集約（Aggregate）

集約は DDD の戦術的設計で **最も重要かつ難しい** 概念です。

### 定義

**整合性を保つための単位。**
関連するエンティティと値オブジェクトをひとまとめにし、
その境界内のデータ整合性を保証します。

### 集約ルート（Aggregate Root）

集約への **唯一の入口** となるエンティティ。
**外部からは集約ルートを通じてのみ操作できます。**

```
【正しいアクセス方法】

// ✅ 集約ルート（Order）を通じて操作する
const order = await orderRepository.findById(orderId);
order.cancel(); // Order.cancel() の中で OrderItem の整合性も管理される

// ❌ 集約の内部（OrderItem）に直接アクセスしない
const item = order.items[0];
item.updateQuantity(5); // 集約ルートを経由しないと不変条件が守られない可能性
```

### 不変条件（Invariant）

集約が **常に保証するビジネスルール** のことです。
不変条件は集約ルートのメソッドの中でチェックします。

```
Order 集約の不変条件:
  1. 注文明細が 0 件の注文は存在できない
  2. SHIPPED 以降はキャンセルできない
  3. 合計金額 = 各明細の小計の合計（常に一致する）
```

### 実装：Order 集約の例

```typescript
// src/domain/order/Order.ts（抜粋）
export class Order extends AggregateRoot {
  private constructor(
    private readonly _id: OrderId,
    private readonly _customerId: CustomerId,
    private _status: OrderStatus,
    private readonly _items: OrderItem[],  // ← 外部から直接操作しない
    private readonly _placedAt: Date
  ) {
    super();
  }

  // ─── ファクトリメソッド ───────────────────────────────────────────

  static place(customerId: CustomerId, items: OrderItem[]): Order {
    // 不変条件①チェック：明細が1件以上必要
    if (!items || items.length === 0) {
      throw new Error('注文には少なくとも1つの注文明細が必要です');
    }

    const order = new Order(
      OrderId.generate(),
      customerId,
      OrderStatus.PENDING,
      [...items],   // コピーして外部からの変更を防ぐ
      new Date()
    );

    // ドメインイベントを記録（← 後で詳しく説明）
    order.addDomainEvent(new OrderPlaced(order._id, customerId));
    return order;
  }

  // ─── ビジネスロジック ──────────────────────────────────────────────

  confirm(): void {
    if (this._status !== OrderStatus.PENDING) {
      throw new Error(`PENDING 状態でないと確定できません: ${this._status}`);
    }
    this._status = OrderStatus.CONFIRMED;
    this.addDomainEvent(new OrderConfirmed(this._id));
  }

  cancel(): void {
    // 不変条件②チェック：SHIPPED 以降はキャンセル不可
    if (!CANCELLABLE_STATUSES.includes(this._status)) {
      throw new Error(`この注文はキャンセルできません: ${this._status}`);
    }
    this._status = OrderStatus.CANCELLED;
    this.addDomainEvent(new OrderCancelled(this._id));
  }

  // ─── 集計（不変条件③） ──────────────────────────────────────────────

  get totalAmount(): Money {
    // items の集計結果が totalAmount として常に一致する（不変条件③）
    return this._items.reduce(
      (sum, item) => sum.add(item.subtotal),
      Money.of(0, 'JPY')
    );
  }
}
```

### 集約の設計ルール

集約を設計するときに守るべきガイドラインがあります：

```
ルール1：集約はできるだけ小さく保つ
   大きな集約はロック競合が増え、パフォーマンスが落ちる。
   「本当にトランザクション整合性が必要なものだけ」を集約に含める。

ルール2：集約間の参照は ID のみで行う
   // ✅ 良い例：ID で参照する
   class Order {
     customerId: CustomerId; // Customer オブジェクトではなく ID だけ持つ
   }

   // ❌ 悪い例：オブジェクトで参照する
   class Order {
     customer: Customer; // Customer 集約全体を持ってしまう
   }

ルール3：外部からは集約ルートのみを操作する
   OrderItem を直接リポジトリで取得・保存してはならない。
   必ず Order を通じて操作する。

ルール4：1 トランザクション = 1 集約
   複数集約を1トランザクションで変更したくなったら、
   ドメインイベントを使って非同期で処理することを検討する。
```

---

## 5. ドメインサービス（Domain Service）

### 定義

**特定のエンティティ・集約に自然に属さないドメインロジック** を置く場所。

### いつドメインサービスを使うか

「このロジックをどこに置くか」迷ったとき、以下を考えます：

```
「注文の割引額を計算する」というロジックはどこに置くか？

Order.calculateDiscount() ？
  → 割引は顧客の VIP 状態に依存する。Order は Customer を参照できない（別集約）

Customer.calculateDiscount(order) ？
  → Customer が Order の詳細（金額）を知る必要がある。依存が逆転する

→ どちらにも自然に収まらない
→ OrderDomainService.calculateDiscount(customer, order) に置く！
```

### 実装：OrderDomainService の例

```typescript
// src/domain/order/OrderDomainService.ts
export class OrderDomainService {
  /**
   * 割引額を計算する
   *
   * 特徴：
   * - ステートレス（状態を持たない）
   * - ドメインの概念を表現する（ビジネスルールが書かれている）
   * - インフラ層には依存しない（DB アクセスなし）
   */
  calculateDiscount(customer: Customer, totalAmount: Money): Money {
    if (customer.isVip()) {
      // VIP 割引：10%
      return Money.of(
        Math.floor(totalAmount.amount * 0.1),
        totalAmount.currency
      );
    }
    // 通常顧客：割引なし
    return Money.of(0, totalAmount.currency);
  }
}
```

### ドメインサービスの特徴

| 特徴 | 説明 |
|-----|------|
| ステートレス | インスタンス変数（状態）を持たない |
| ドメインロジックのみ | DB アクセス・HTTP 呼び出しなどは行わない |
| 名詞ではなく動詞 | クラス名が動詞的（`OrderDomainService`, `PricingCalculator`） |

### ドメインサービスと「普通のサービス」の違い

```
ドメインサービス（Domain Service）：
  ・ドメインの概念・ルールを表現する
  ・ドメイン層に置く
  ・例：割引計算、与信チェック、在庫引当ロジック

アプリケーションサービス（Application Service / Use Case）：
  ・ドメインオブジェクトを「指揮」するだけ
  ・アプリケーション層に置く
  ・例：PlaceOrderUseCase（DB を読んで Order を作って保存する）
```

---

## 6. リポジトリ（Repository）

### 定義

**集約の永続化・取得を抽象化するインターフェース。**

リポジトリは「コレクション（配列・Setなど）」のように扱えるインターフェースです。
利用者は「どこに保存されているか（MySQL/MongoDB/メモリ）」を知る必要がありません。

### インターフェースと実装の分離

```
ドメイン層                           インフラ層
───────────────────────────────────────────────────────
OrderRepository（interface）
  ・findById(id): Promise<Order|null>   ← ここに定義
  ・save(order): Promise<void>
                ↑ implements
                │
         InMemoryOrderRepository（テスト・開発用）
         PostgresOrderRepository（本番用）
         DynamoDBOrderRepository（AWS用）
```

### 実装例

```typescript
// src/domain/order/OrderRepository.ts（ドメイン層：インターフェース）
export interface OrderRepository {
  findById(id: OrderId): Promise<Order | null>;
  findByCustomerId(customerId: CustomerId): Promise<Order[]>;
  save(order: Order): Promise<void>;
}

// src/infrastructure/order/InMemoryOrderRepository.ts（インフラ層：実装）
export class InMemoryOrderRepository implements OrderRepository {
  private readonly store = new Map<string, Order>();

  async findById(id: OrderId): Promise<Order | null> {
    return this.store.get(id.value) ?? null;
  }

  async findByCustomerId(customerId: CustomerId): Promise<Order[]> {
    return [...this.store.values()].filter(
      (order) => order.customerId.equals(customerId)
    );
  }

  async save(order: Order): Promise<void> {
    this.store.set(order.id.value, order);
  }
}
```

### リポジトリの設計ガイドライン

```
1. 集約ルートに対してのみリポジトリを作る
   ✅ OrderRepository   （集約ルートに対して）
   ❌ OrderItemRepository（集約の内部要素には不要）

2. コレクション的なインターフェースにする
   ✅ save(order)      （コレクションへの追加・更新）
   ✅ findById(id)     （コレクションからの検索）
   ❌ updateStatus()   （特定フィールドだけ更新するメソッドは避ける）

3. リポジトリはドメインの言語で書く
   ✅ findByCustomerId(customerId)
   ❌ executeQuery('SELECT * FROM orders WHERE customer_id = ?', [id])
```

---

## 7. ドメインイベント（Domain Event）

### 定義

**ドメイン内で起きた重要な出来事を表すオブジェクト。**

「注文が発注された」「注文がキャンセルされた」といった **過去に起きた事実** を表します。

### なぜドメインイベントを使うか

集約間を **疎結合** に連携させるためです。

```
【ドメインイベントを使わない場合（密結合）】

class PlaceOrderUseCase {
  execute(): void {
    const order = Order.place(...);
    await orderRepository.save(order);

    // ← ここで直接他の処理を呼ぶ（密結合）
    await inventoryService.decreaseStock(order);  // 在庫サービスを直接知っている
    await notificationService.sendEmail(order);    // 通知サービスを直接知っている
    await shippingService.createShipment(order);   // 配送サービスを直接知っている
    // → PlaceOrderUseCase が何でも知っている「神ユースケース」になる
  }
}

【ドメインイベントを使った場合（疎結合）】

// Order が「発注された」という事実をイベントとして記録
const order = Order.place(...);
// order.pullDomainEvents() → [OrderPlaced イベント]

// イベントハンドラが別々に登録されている（疎結合）
eventBus.on('OrderPlaced', inventoryHandler.handle);
eventBus.on('OrderPlaced', notificationHandler.handle);
eventBus.on('OrderPlaced', shippingHandler.handle);

// PlaceOrderUseCase は「注文を保存してイベントを発行」だけに集中できる
```

### 命名規則

ドメインイベントは **過去形** で命名します。

```
✅ OrderPlaced（注文が発注された）
✅ OrderConfirmed（注文が確定された）
✅ OrderCancelled（注文がキャンセルされた）
✅ PaymentCompleted（決済が完了した）

❌ PlaceOrder（動詞：コマンドと紛らわしい）
❌ OrderStatusChanged（何が変わったか不明）
```

### 実装例

```typescript
// src/domain/shared/DomainEvent.ts
export interface DomainEvent {
  readonly occurredAt: Date;   // いつ発生したか（不変）
  readonly eventType: string;  // イベントの種別名
}

export abstract class AggregateRoot {
  private _domainEvents: DomainEvent[] = [];

  // ドメインイベントを記録する（集約内部からのみ呼ぶ）
  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  // イベントを取り出してリセットする（UseCase から呼ぶ）
  pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }
}

// src/domain/order/Order.ts（ドメインイベントの定義）
export class OrderPlaced implements DomainEvent {
  readonly eventType = 'OrderPlaced';
  readonly occurredAt = new Date();
  constructor(
    public readonly orderId: OrderId,
    public readonly customerId: CustomerId
  ) {}
}
```

```typescript
// UseCase でのイベント取り出し（src/application/order/PlaceOrderUseCase.ts）
const order = Order.place(customerId, orderItems);
await orderRepository.save(order);

// イベントを取り出して後続処理に渡す
const events = order.pullDomainEvents();
// events → [OrderPlaced { orderId, customerId, occurredAt }]

// イベントバスや非同期キューに流す
for (const event of events) {
  await eventBus.publish(event);
}
```

---

## 8. まとめ：構成要素の選び方

```
どれを使えばいいか迷ったときのフローチャート

概念を追跡する必要がある？
  ├─ Yes → エンティティ（Entity）
  │         複数のエンティティ＋値オブジェクトで整合性を保つ必要がある？
  │           ├─ Yes → 集約（Aggregate）にまとめる
  │           └─ No  → 単独のエンティティ
  │
  └─ No  → 値オブジェクト（Value Object）

ロジックの置き場所に迷ったら？
  ├─ 特定の集約に自然に属する → その集約のメソッドに置く
  ├─ 複数の集約にまたがる    → ドメインサービス（Domain Service）
  └─ インフラの詳細を知る必要がある → アプリケーション層のユースケース

重要な出来事が起きたとき？
  └─ ドメインイベント（Domain Event）を発行する
```

| 構成要素 | 識別方法 | 可変性 | 主な責務 |
|---------|---------|--------|---------|
| 値オブジェクト | 属性（値）で識別 | 不変 | 概念を型安全に表現、バリデーション |
| エンティティ | ID で識別 | 可変 | ライフサイクルを持つビジネス概念 |
| 集約 | 集約ルートの ID | 可変 | 整合性の境界、不変条件の保証 |
| ドメインサービス | — | ステートレス | 集約に属さないドメインロジック |
| リポジトリ | — | — | 集約の永続化・取得の抽象化 |
| ドメインイベント | — | 不変 | 起きた事実の記録と非同期連携 |

次のステップ → [クリーンアーキテクチャ](./05_clean_architecture.md)
