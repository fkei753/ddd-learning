# 戦術的設計（Tactical Design）

## 1. 全体像

戦術的設計はドメインモデルを実装するための **構成要素（Building Blocks）** です。

```
┌───────────────────────────────────────────────────────┐
│  集約（Aggregate）                                     │
│  ┌─────────────────────────────────────────────────┐  │
│  │  集約ルート（Aggregate Root）= エンティティ       │  │
│  │                                                  │  │
│  │    ┌──────────────┐   ┌──────────────────────┐  │  │
│  │    │  エンティティ  │   │  値オブジェクト        │  │  │
│  │    │  (Entity)    │   │  (Value Object)      │  │  │
│  │    └──────────────┘   └──────────────────────┘  │  │
│  └─────────────────────────────────────────────────┘  │
│                         ↓ 永続化                       │
│              リポジトリ（Repository）                   │
└───────────────────────────────────────────────────────┘
```

---

## 2. エンティティ（Entity）

### 定義
**同一性（Identity）によって識別されるオブジェクト。**
属性が変わっても「同じもの」とみなせる概念を表します。

### 特徴
- 一意の **ID** を持つ
- ID が同じなら属性が変わっても同一と判断する
- ライフサイクル（作成 → 変更 → 削除）を持つ

### 例：OrderItem（注文明細）

```
注文明細 A
  - orderItemId: "item-001"  ← IDで識別
  - product: "りんご"
  - quantity: 2

数量が変わっても item-001 は同じ注文明細
  - orderItemId: "item-001"
  - product: "りんご"
  - quantity: 5  ← 変わった
```

### コード
→ `src/domain/order/OrderItem.ts` を参照

---

## 3. 値オブジェクト（Value Object）

### 定義
**属性（値）によって識別されるオブジェクト。**
属性が同じなら交換可能な概念を表します。

### 特徴
- ID を持たない
- **不変（Immutable）** ── 変更する場合は新しいインスタンスを作る
- 属性が同じなら等しいと判断する（等値性）

### よくある値オブジェクト例

| 概念 | なぜ値オブジェクトか |
|-----|-------------------|
| `Money(1500, "JPY")` | 1500円は何枚あっても同じ価値 |
| `OrderId("ord-001")` | IDそのものが意味を持つ |
| `Email("a@b.com")` | メアドは属性で識別 |
| `Address` | 住所は属性の集まり |

### Money の例

```
Money(1500, "JPY") === Money(1500, "JPY")  // ✅ 同じ
Money(1500, "JPY") !== Money(1500, "USD")  // ✅ 通貨が違えば別物
```

### コード
→ `src/domain/shared/Money.ts` を参照

---

## 4. 集約（Aggregate）

### 定義
**整合性を保つための単位。**
関連するエンティティと値オブジェクトをひとまとめにし、
その境界内のデータ整合性を保証します。

### 集約ルート（Aggregate Root）
集約の入口となる唯一のエンティティ。
外部からは集約ルートを通じてのみ操作できます。

### 例：Order 集約

```
Order（集約ルート）
├── orderId: OrderId（値オブジェクト）
├── customerId: CustomerId（値オブジェクト）
├── status: OrderStatus（値オブジェクト）
├── items: OrderItem[]（エンティティ）← 直接外部から操作しない
└── totalAmount: Money（値オブジェクト）← Order が計算責任を持つ
```

### 集約の不変条件（Invariant）

集約が保証するビジネスルールのことを **不変条件** と呼びます。

```
Order 集約の不変条件:
- 注文明細が 0 件の注文は存在できない
- SHIPPED 以降はキャンセルできない
- 合計金額は各明細の小計の合計と一致しなければならない
```

### コード
→ `src/domain/order/Order.ts` を参照

---

## 5. ドメインサービス（Domain Service）

### 定義
**特定のエンティティ・集約に属さないドメインロジック** を置く場所。

### いつ使うか

エンティティや値オブジェクトに自然に属さない操作がある場合:

```
「注文の割引額を計算する」
→ Order? Customer? Coupon? どれか一方に置くのが不自然
→ OrderDiscountService に置く
```

### コード
→ `src/domain/order/OrderDomainService.ts` を参照

---

## 6. リポジトリ（Repository）

### 定義
**集約の永続化・取得を抽象化するインターフェース。**

- ドメイン層にはインターフェースのみ定義
- 実装（DB・API）はインフラ層に置く
- コレクションのように扱える

### コード

```typescript
// ドメイン層（インターフェース）
interface OrderRepository {
  findById(id: OrderId): Promise<Order | null>;
  save(order: Order): Promise<void>;
}

// インフラ層（実装）
class PostgresOrderRepository implements OrderRepository {
  async findById(id: OrderId): Promise<Order | null> { ... }
  async save(order: Order): Promise<void> { ... }
}
```

→ `src/domain/order/OrderRepository.ts`（インターフェース）
→ `src/infrastructure/order/InMemoryOrderRepository.ts`（実装）を参照

---

## 7. ドメインイベント（Domain Event）

### 定義
**ドメイン内で起きた重要な出来事を表すオブジェクト。**

- 過去に起きた事実なので **過去形** で命名する
- 他のコンテキストへの通知・非同期処理に使う

### 例

```
OrderPlaced（注文が発注された）
OrderConfirmed（注文が確定された）
OrderCancelled（注文がキャンセルされた）
```

### コード
→ `src/domain/shared/DomainEvent.ts` を参照

---

## 8. まとめ対照表

| 構成要素 | 識別方法 | 可変性 | 責務 |
|---------|---------|--------|------|
| エンティティ | ID | 可変 | ライフサイクルを持つビジネス概念 |
| 値オブジェクト | 属性値 | 不変 | 属性の意味を表現する |
| 集約 | 集約ルートの ID | 可変 | 整合性の境界 |
| ドメインサービス | N/A | ステートレス | どこにも属さないドメインロジック |
| リポジトリ | N/A | N/A | 集約の永続化を抽象化 |
| ドメインイベント | N/A | 不変 | 起きた事実を表現 |

次のステップ → [クリーンアーキテクチャ](./05_clean_architecture.md)
