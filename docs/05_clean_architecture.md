# クリーンアーキテクチャ（Clean Architecture）

## 1. クリーンアーキテクチャとは

Robert C. Martin（Uncle Bob）が2012年に提唱した**アーキテクチャパターン**です。
「ヘキサゴナルアーキテクチャ」「オニオンアーキテクチャ」とも思想を共有します。

> **核心原則：ビジネスロジック（ドメイン）は外部の詳細に依存してはならない。**

---

## 2. 同心円の構造

```
          ┌─────────────────────────────────────┐
          │         Frameworks & Drivers         │  外側
          │   (Web, DB, UI, External Services)   │
          │  ┌─────────────────────────────────┐ │
          │  │    Interface Adapters            │ │
          │  │  (Controllers, Presenters,       │ │
          │  │   Repository Implementations)    │ │
          │  │  ┌───────────────────────────┐  │ │
          │  │  │    Application Business   │  │ │
          │  │  │    Rules (Use Cases)       │  │ │
          │  │  │  ┌─────────────────────┐  │  │ │
          │  │  │  │  Enterprise Business │  │  │ │
          │  │  │  │  Rules (Domain)      │  │  │ │
          │  │  │  │  Entities, VO, etc.  │  │  │ │
          │  │  │  └─────────────────────┘  │  │ │
          │  │  └───────────────────────────┘  │ │
          │  └─────────────────────────────────┘ │
          └─────────────────────────────────────┘
                          内側
```

### 依存関係のルール（The Dependency Rule）

> **依存は必ず外側から内側へ向かう。内側は外側を知ってはならない。**

```
Frameworks → Interface Adapters → Application → Domain
    ↑                                                ↑
  変わりやすい（詳細）                          変わりにくい（本質）
```

---

## 3. 各レイヤーの役割

### 🔵 ドメイン層（Domain Layer）
- 最内部・最重要
- ビジネスのルールと概念を表現
- 外部への依存ゼロ
- **Entity, Value Object, Aggregate, Domain Service, Repository Interface**

### 🟢 アプリケーション層（Application Layer）
- ユースケースを実装
- ドメインオブジェクトを orchestrate（指揮）する
- ドメイン層のみに依存
- **Use Case, Application Service, Command/Query**

### 🟡 インターフェースアダプタ層（Interface Adapters）
- 外界とドメイン・アプリを繋ぐ変換層
- **Controller, Presenter, Repository 実装**

### 🔴 フレームワーク・ドライバ層（Frameworks & Drivers）
- 最外部・最も変わりやすい
- **Express, PostgreSQL, Redis, 外部 API**

---

## 4. 依存性逆転の原則（DIP）

ドメイン層はリポジトリを使いたいが、DBの詳細を知ってはならない。
→ **インターフェース（抽象）に依存させることで解決。**

```
                    依存
Domain Layer ──────────→ OrderRepository（interface）
                                ↑ implements
                    InMemoryOrderRepository（Infrastructure Layer）
```

```typescript
// ドメイン層：インターフェースを定義
interface OrderRepository {
  save(order: Order): Promise<void>;
}

// インフラ層：インターフェースを実装
class PostgresOrderRepository implements OrderRepository {
  async save(order: Order): Promise<void> {
    // SQL でDBに保存
  }
}

// アプリ層：インターフェースに依存（実装を知らない）
class PlaceOrderUseCase {
  constructor(private repo: OrderRepository) {}  // 抽象に依存
}
```

---

## 5. このプロジェクトのディレクトリ構造

```
src/
├── domain/                      ← ドメイン層（最重要・依存なし）
│   ├── order/
│   │   ├── Order.ts             ← 集約ルート（エンティティ）
│   │   ├── OrderItem.ts         ← エンティティ
│   │   ├── OrderId.ts           ← 値オブジェクト
│   │   ├── OrderStatus.ts       ← 値オブジェクト（enum）
│   │   ├── OrderRepository.ts   ← リポジトリインターフェース
│   │   └── OrderDomainService.ts← ドメインサービス
│   ├── customer/
│   │   ├── Customer.ts          ← 集約ルート
│   │   ├── CustomerId.ts        ← 値オブジェクト
│   │   └── CustomerRepository.ts← リポジトリインターフェース
│   └── shared/
│       ├── Money.ts             ← 値オブジェクト（共有）
│       └── DomainEvent.ts       ← ドメインイベント基底
│
├── application/                 ← アプリケーション層（ユースケース）
│   └── order/
│       ├── PlaceOrderUseCase.ts ← ユースケース
│       └── PlaceOrderCommand.ts ← コマンド（入力DTO）
│
└── infrastructure/              ← インフラ層（依存の実装）
    └── order/
        └── InMemoryOrderRepository.ts
```

---

## 6. データの流れ

```
HTTP リクエスト
      ↓
Controller（Interface Adapters）
      ↓  Command オブジェクト
PlaceOrderUseCase（Application）
      ↓  ドメインオブジェクトを生成・操作
Order.place()（Domain）
      ↓  集約を永続化
OrderRepository（Domain Interface）← 実装はInfra層が提供
      ↓
InMemoryOrderRepository（Infrastructure）
```

---

## 7. DDD + クリーンアーキテクチャの対応関係

| DDD の概念 | クリーンアーキテクチャのレイヤー |
|-----------|-------------------------------|
| エンティティ・値オブジェクト・集約 | ドメイン層 |
| ドメインサービス | ドメイン層 |
| リポジトリ（インターフェース） | ドメイン層 |
| ユースケース / アプリケーションサービス | アプリケーション層 |
| リポジトリ（実装） | インフラ層 |
| Controller / Presenter | インターフェースアダプタ層 |

---

## 8. まとめ

| 原則 | 意味 |
|-----|------|
| 依存関係ルール | 外側から内側へのみ依存する |
| 依存性逆転原則 | 詳細（DB等）は抽象（Interface）に依存させる |
| 関心の分離 | 各レイヤーは1つの責務を持つ |
| テスト容易性 | ドメイン層は外部なしで単体テスト可能 |
