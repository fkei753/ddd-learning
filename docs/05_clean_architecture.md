# クリーンアーキテクチャ（Clean Architecture）

## 1. クリーンアーキテクチャとは

Robert C. Martin（Uncle Bob）が2012年に提唱した **アーキテクチャパターン** です。
「ヘキサゴナルアーキテクチャ（Ports & Adapters）」「オニオンアーキテクチャ」とも
思想を共有します。

> **核心原則：ビジネスロジック（ドメイン）は外部の詳細に依存してはならない。**

「外部の詳細」とは、データベース・Web フレームワーク・外部 API など、
**ビジネスの本質ではない部分** のことです。これらは「配管（Plumbing）」であり、
ビジネスロジックに影響を与えるべきではありません。

### なぜこれが重要か

```
【依存が逆転している悪い例】

// ドメインオブジェクトが DB に依存している
class Order {
  async cancel(): Promise<void> {
    // ← DB 操作がドメインロジックに混入している！
    await db.query('UPDATE orders SET status = ? WHERE id = ?',
      ['CANCELLED', this._id]);

    // ← さらにメール送信まで！
    await emailService.send(this._customerId, '注文をキャンセルしました');
  }
}
```

このコードの問題点：
- DB の種類が変わると `Order` クラスを修正しなければならない
- `Order.cancel()` の単体テストに DB が必要になる
- ビジネスロジック（キャンセル可能かのチェック）と技術的詳細が混在している

---

## 2. 同心円の構造

クリーンアーキテクチャは **同心円（レイヤー）** で表現されます。

```
          ┌─────────────────────────────────────────┐
          │      Frameworks & Drivers（外側）          │
          │  Web, DB, UI, Redis, 外部 API             │
          │  ┌───────────────────────────────────┐   │
          │  │   Interface Adapters               │   │
          │  │ Controllers, Presenters,           │   │
          │  │ Repository 実装                    │   │
          │  │  ┌─────────────────────────────┐  │   │
          │  │  │  Application Business Rules  │  │   │
          │  │  │  Use Cases（ユースケース）     │  │   │
          │  │  │  ┌───────────────────────┐  │  │   │
          │  │  │  │ Enterprise Business   │  │  │   │
          │  │  │  │ Rules（ドメイン）       │  │  │   │
          │  │  │  │ Entity, VO, Aggregate │  │  │   │
          │  │  │  └───────────────────────┘  │  │   │
          │  │  └─────────────────────────────┘  │   │
          │  └───────────────────────────────────┘   │
          └─────────────────────────────────────────┘
                              内側
```

### 依存関係のルール（The Dependency Rule）

> **依存は必ず外側から内側へ向かう。内側のコードは外側を知ってはならない。**

```
具体例で理解する：

Infrastructure（外側）
  → Application（内側）：OK（InMemoryOrderRepository は OrderRepository を知っている）

Domain（内側）
  → Infrastructure（外側）：NG（Order.ts に import from 'sequelize' は禁止）
```

この原則により、**内側のコードは変わりにくく**、**外側だけを差し替えられる** 設計になります。

---

## 3. 各レイヤーの役割と責任

### 🔵 ドメイン層（Domain Layer）― 最内部・最重要

```
役割：ビジネスのルールと概念を純粋に表現する
依存：外部への依存ゼロ（import できるのは他のドメインクラスのみ）
置くもの：Entity, Value Object, Aggregate, Domain Service,
          Repository Interface, Domain Event
```

```typescript
// src/domain/order/Order.ts
// ← ここに import から DB や HTTP の痕跡が一切ない
import { AggregateRoot, DomainEvent } from '../shared/DomainEvent'; // ドメイン内
import { Money } from '../shared/Money';                             // ドメイン内
import { CustomerId } from '../customer/CustomerId';                 // ドメイン内

export class Order extends AggregateRoot {
  cancel(): void {
    if (!CANCELLABLE_STATUSES.includes(this._status)) {
      throw new Error(`この注文はキャンセルできません: ${this._status}`);
    }
    this._status = OrderStatus.CANCELLED;
    this.addDomainEvent(new OrderCancelled(this._id)); // イベントを記録するだけ
    // ← DB も HTTP も呼ばない！ビジネスロジックだけ！
  }
}
```

**テストのしやすさ：**
ドメイン層は外部依存がないため、DB なしでテストできます。

```typescript
// ドメイン層のテスト（DBモックが不要）
describe('Order.cancel()', () => {
  it('SHIPPED 状態の注文はキャンセルできない', () => {
    const order = Order.place(customerId, items);
    order.confirm();
    order.ship();
    // SHIPPED になった注文
    expect(() => order.cancel()).toThrow('この注文はキャンセルできません');
  });
});
```

---

### 🟢 アプリケーション層（Application Layer）― ユースケースの実装

```
役割：ドメインオブジェクトを「指揮（Orchestrate）」してユースケースを実現する
依存：ドメイン層のみ
置くもの：Use Case, Command/Query（入力 DTO）
```

**重要な原則：アプリケーション層にビジネスロジックを書かない。**
「どの順番で何を呼ぶか」を決めるだけです。

```typescript
// src/application/order/PlaceOrderUseCase.ts
export class PlaceOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepository,        // ← 抽象（Interface）に依存
    private readonly customerRepository: CustomerRepository,  // ← 抽象（Interface）に依存
    private readonly orderDomainService: OrderDomainService
  ) {}

  async execute(command: PlaceOrderCommand): Promise<PlaceOrderResult> {

    // ① 入力を検証してドメインオブジェクトに変換（プリミティブ → VO）
    const customerId = CustomerId.of(command.customerId);

    // ② 顧客の存在確認（リポジトリに委譲）
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) throw new Error(`顧客が見つかりません: ${command.customerId}`);

    // ③ コマンドから注文明細を生成
    const orderItems = command.items.map((item) =>
      OrderItem.create(
        item.productId,
        item.productName,
        Money.of(item.unitPriceAmount, item.currency),
        item.quantity
      )
    );

    // ④ 注文を発注する（ビジネスロジックは Order に委譲）
    const order = Order.place(customerId, orderItems);
    //   ↑ Order.place() の中でキャンセル不可チェック等を行う

    // ⑤ 割引を計算する（ビジネスロジックは ドメインサービス に委譲）
    const discount = this.orderDomainService.calculateDiscount(
      customer,
      order.totalAmount
    );

    // ⑥ 注文を保存する（リポジトリに委譲）
    await this.orderRepository.save(order);

    // ⑦ ドメインイベントを取り出して外部に通知（イベントバス等）
    const events = order.pullDomainEvents();
    // → [OrderPlaced { orderId, customerId, occurredAt }]

    return { orderId: order.id.value, discount };
  }
}
```

アプリケーション層の `execute()` は「指揮者」です。
ビジネスロジックは `Order.place()`・`orderDomainService.calculateDiscount()` が担当し、
ユースケースは **何を呼ぶかの順番** だけを管理します。

---

### 🟡 インターフェースアダプタ層（Interface Adapters）― 変換と橋渡し

```
役割：外界（HTTP・UI）とドメイン・アプリを繋ぐ変換層
依存：アプリケーション層に依存
置くもの：Controller, Presenter, Repository 実装
```

```typescript
// Controller の例（Express を使った場合）
class OrderController {
  constructor(private readonly placeOrderUseCase: PlaceOrderUseCase) {}

  async placeOrder(req: Request, res: Response): Promise<void> {
    // HTTP リクエストのデータを Command に変換
    const command: PlaceOrderCommand = {
      customerId: req.body.customerId,
      items: req.body.items.map((i: any) => ({
        productId: i.product_id,     // ← snake_case から camelCase へ変換
        productName: i.product_name,
        unitPriceAmount: i.unit_price,
        currency: i.currency ?? 'JPY',
        quantity: i.quantity,
      })),
    };

    // ユースケースを実行
    const result = await this.placeOrderUseCase.execute(command);

    // 結果を HTTP レスポンスに変換
    res.status(201).json({ order_id: result.orderId }); // ← camelCase を snake_case に変換
  }
}
```

---

### 🔴 フレームワーク・ドライバ層（Frameworks & Drivers）― 最外部

```
役割：具体的な技術の実装
依存：すべてのレイヤーに依存してよい
置くもの：Express, PostgreSQL, Redis, 外部 API クライアント
```

このレイヤーは **差し替えが最も頻繁に起きる** 場所です。
クリーンアーキテクチャでは、このレイヤーの変更がドメイン層に影響しないようにします。

---

## 4. 依存性逆転の原則（DIP）― リポジトリで理解する

クリーンアーキテクチャの核心的なテクニックが **依存性逆転の原則（DIP）** です。

### 問題：ドメイン層がインフラ層を直接参照すると？

```
【NG：内側（ドメイン）が外側（インフラ）に依存している】

PlaceOrderUseCase（Application）
  import { PostgresOrderRepository } from '../../infra/PostgresOrderRepository'
  //                ↑ 具体的な実装を知っている

→ テスト時に PostgreSQL が必要
→ MySQL に変えたいとき PlaceOrderUseCase も変更が必要
→ 「外側に依存している内側」= クリーンアーキテクチャ違反
```

### 解決：インターフェース（抽象）を間に挟む

```
【OK：内側は抽象（Interface）に依存。外側が実装を提供する】

                         依存方向
Domain Layer ─────────────────────────→ OrderRepository（interface）
                                               ↑
                                           implements
                                               │
Infrastructure Layer ──────────────── InMemoryOrderRepository
                                       （具体的な実装）

矢印の向きに注目：
  ・ドメインは Interface に依存（内 → 抽象）← OK
  ・インフラが Interface を実装（外 → 抽象を満たす）← OK
  ・ドメインはインフラを知らない ← これが「依存の逆転」
```

```typescript
// ─── ドメイン層（抽象を定義）───────────────────────────────────────
// src/domain/order/OrderRepository.ts
export interface OrderRepository {
  findById(id: OrderId): Promise<Order | null>;
  save(order: Order): Promise<void>;
}

// ─── インフラ層（抽象を実装）───────────────────────────────────────
// src/infrastructure/order/InMemoryOrderRepository.ts
export class InMemoryOrderRepository implements OrderRepository {
  private readonly store = new Map<string, Order>();

  async findById(id: OrderId): Promise<Order | null> {
    return this.store.get(id.value) ?? null;
  }

  async save(order: Order): Promise<void> {
    this.store.set(order.id.value, order);
  }
}

// ─── アプリケーション層（抽象に依存）──────────────────────────────
// src/application/order/PlaceOrderUseCase.ts
export class PlaceOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepository // ← Interface に依存（実装を知らない）
  ) {}
}

// ─── 依存性の注入（Composition Root）──────────────────────────────
// src/demo.ts や main.ts
const orderRepository = new InMemoryOrderRepository(); // ← ここだけ具体的な実装を指定
const useCase = new PlaceOrderUseCase(orderRepository);
// 本番では PostgresOrderRepository() に差し替えるだけ
```

---

## 5. このプロジェクトのディレクトリ構造と対応関係

```
src/
├── domain/                          ← 🔵 ドメイン層（最重要・外部依存ゼロ）
│   ├── order/
│   │   ├── Order.ts                 ← 集約ルート（エンティティ + ドメインイベント発行）
│   │   ├── OrderItem.ts             ← エンティティ（集約の内部）
│   │   ├── OrderId.ts               ← 値オブジェクト（型安全な ID）
│   │   ├── OrderStatus.ts           ← 値オブジェクト（状態遷移を表現）
│   │   ├── OrderRepository.ts       ← リポジトリ Interface（抽象）
│   │   └── OrderDomainService.ts    ← ドメインサービス（割引計算）
│   ├── customer/
│   │   ├── Customer.ts              ← 集約ルート
│   │   ├── CustomerId.ts            ← 値オブジェクト
│   │   └── CustomerRepository.ts   ← リポジトリ Interface
│   └── shared/
│       ├── Money.ts                 ← 値オブジェクト（複数集約で共有）
│       └── DomainEvent.ts           ← ドメインイベント基底 Interface + AggregateRoot
│
├── application/                     ← 🟢 アプリケーション層（ユースケース）
│   └── order/
│       ├── PlaceOrderUseCase.ts     ← ユースケース（注文を発注する）
│       └── PlaceOrderCommand.ts     ← コマンド（入力 DTO）
│
└── infrastructure/                  ← 🔴 インフラ層（依存の実装）
    ├── order/
    │   └── InMemoryOrderRepository.ts  ← OrderRepository の実装（開発・テスト用）
    └── customer/
        └── InMemoryCustomerRepository.ts
```

### 依存関係の確認

```
infrastructure/ が domain/ に依存　→ OK（外 → 内）
application/ が domain/ に依存　　→ OK（外 → 内）
domain/ が他に依存　　　　　　　　→ 一切なし！
```

---

## 6. データの流れ：注文発注の全体フロー

```
1. HTTP POST /orders （外部からのリクエスト）
        ↓
2. OrderController（Interface Adapters）
   ・HTTP ボディを PlaceOrderCommand に変換
        ↓
3. PlaceOrderUseCase.execute(command)（Application）
   ・customerId → CustomerId.of(command.customerId)
   ・items → OrderItem.create(...)
        ↓
4. customerRepository.findById(customerId)（Domain Interface → Infra 実装）
   ・顧客の存在確認
        ↓
5. Order.place(customerId, orderItems)（Domain）
   ・不変条件チェック
   ・OrderPlaced ドメインイベントを記録
        ↓
6. orderDomainService.calculateDiscount(customer, order.totalAmount)（Domain）
   ・VIP 判定と割引計算
        ↓
7. orderRepository.save(order)（Domain Interface → Infra 実装）
   ・InMemoryOrderRepository に保存
        ↓
8. order.pullDomainEvents() → [OrderPlaced]（Domain）
   ・イベントを取り出してイベントバスへ
        ↓
9. HTTP 201 { order_id: "ord-xxx" }（外部へのレスポンス）
```

---

## 7. DDD + クリーンアーキテクチャの対応関係

| DDD の概念 | クリーンアーキテクチャのレイヤー | 本プロジェクトの例 |
|-----------|-------------------------------|----------------|
| エンティティ | ドメイン層 | `Order.ts`, `OrderItem.ts` |
| 値オブジェクト | ドメイン層 | `Money.ts`, `OrderId.ts`, `OrderStatus.ts` |
| 集約 | ドメイン層 | `Order`（集約ルート）+ `OrderItem` |
| ドメインサービス | ドメイン層 | `OrderDomainService.ts` |
| リポジトリ（Interface） | ドメイン層 | `OrderRepository.ts` |
| ドメインイベント | ドメイン層 | `OrderPlaced`, `OrderCancelled` |
| ユースケース | アプリケーション層 | `PlaceOrderUseCase.ts` |
| コマンド（DTO） | アプリケーション層 | `PlaceOrderCommand.ts` |
| リポジトリ（実装） | インフラ層 | `InMemoryOrderRepository.ts` |
| Controller | インターフェースアダプタ層 | （本プロジェクトでは省略） |

---

## 8. よくある間違いと正しい対処

### 間違い1：ドメイン層にインフラの依存を混入させる

```typescript
// ❌ NG：ドメインクラスが DB ライブラリをインポートしている
import { Repository } from 'typeorm'; // ← インフラ依存！
import { Column, Entity } from 'typeorm'; // ← ORM の デコレータをドメインに使う

@Entity()  // ← NG
class Order {
  @Column()
  status: string;
}
```

```typescript
// ✅ OK：ドメインクラスは純粋な TypeScript のみ
export class Order extends AggregateRoot {
  private _status: OrderStatus;
  // → TypeORM の影響を受けない純粋なクラス
}
```

### 間違い2：ユースケースにビジネスロジックを書く

```typescript
// ❌ NG：ユースケースにビジネスルールが書かれている
class PlaceOrderUseCase {
  async execute(command: PlaceOrderCommand) {
    const order = new Order(command.customerId, command.items);

    // ← ビジネスルールがユースケースに！
    if (order.items.length === 0) {
      throw new Error('...');
    }
    if (customer.isVip()) {
      order.discount = order.total * 0.1;
    }
  }
}
```

```typescript
// ✅ OK：ビジネスルールはドメイン層に
class PlaceOrderUseCase {
  async execute(command: PlaceOrderCommand) {
    // ← ユースケースは「何をどの順番で呼ぶか」だけを書く
    const order = Order.place(customerId, items); // ← バリデーションは Order の中
    const discount = this.domainService.calculateDiscount(customer, order.totalAmount);
    await this.orderRepository.save(order);
  }
}
```

---

## 9. まとめ

| 原則 | 意味 | 効果 |
|-----|------|------|
| **依存方向ルール** | 外側から内側へのみ依存 | 内側（ドメイン）が安定し変更に強くなる |
| **依存性逆転（DIP）** | 詳細は抽象（Interface）に依存 | DB・フレームワークを自由に差し替えられる |
| **関心の分離** | 各レイヤーに1つの責務 | 変更の影響範囲が限定される |
| **テスト容易性** | ドメイン層は外部なしで動く | 単体テストが速く・シンプルに書ける |

> **「ビジネスロジックはドメイン層に。技術的詳細は外側に。依存は内側に向ける。」**
> この3原則を守ることで、変化に強く、テストしやすいコードになります。
