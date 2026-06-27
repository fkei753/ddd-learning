# 戦略的設計（Strategic Design）

## 1. 境界づけられたコンテキスト（Bounded Context）

### なぜ必要か：「同じ言葉、異なる意味」問題

大きなシステムを **1 つのドメインモデル** で表現しようとすると、
同じ言葉が異なる意味を持つ問題が起きます。

```
「顧客（Customer）」は誰にとっての顧客か？

営業部門：「顧客 = 商談中の見込み客も含む、氏名・購買履歴・クレジット情報が重要」
配送部門：「顧客 = 届け先の人、住所・電話番号・時間指定希望が重要」
経理部門：「顧客 = 請求先、法人名・支払い方法・与信枠が重要」
サポート：「顧客 = 問い合わせ者、過去の問い合わせ履歴・担当者が重要」
```

これを **1 つの `Customer` クラス** で表現しようとすると：

```typescript
// ❌ すべての部門のニーズを詰め込んだ「神クラス」
class Customer {
  id: string;
  name: string;
  email: string;

  // 営業用
  salesStage: 'PROSPECT' | 'NEGOTIATION' | 'CONTRACTED';
  creditScore: number;
  purchaseHistory: Purchase[];

  // 配送用
  shippingAddress: Address;
  phone: string;
  preferredDeliveryTime: string;

  // 経理用
  billingAddress: Address;
  paymentMethod: PaymentMethod;
  creditLimit: Money;

  // サポート用
  supportTickets: Ticket[];
  assignedAgent: Agent;
}
```

このクラスは肥大化し、どの部門の変更もすべての部門に影響します。

### 解決策：境界を引いて分割する

**境界づけられたコンテキスト（Bounded Context）** とは、
**特定のドメインモデルが有効な範囲（境界）** のことです。
境界の内側では、ユビキタス言語の言葉が一貫した意味を持ちます。

```
┌──────────────────────────┐    ┌──────────────────────────┐
│  注文コンテキスト            │    │  配送コンテキスト            │
│  (Order Context)          │    │  (Shipping Context)       │
│                            │    │                            │
│  Customer                  │    │  Recipient（受取人）        │
│    id: CustomerId          │    │    name: string            │
│    name: string            │    │    address: Address        │
│    email: string           │    │    phone: string           │
│    isVip: boolean          │    │    preferredTime: string   │
│                            │    │                            │
│  Order                     │    │  Shipment（配送）           │
│  OrderItem                 │    │    orderId: string         │
│  OrderStatus               │    │    status: ShipmentStatus  │
└──────────────────────────┘    └──────────────────────────┘

同じ「顧客」でも、各コンテキストで異なるモデルとして定義する
```

同じ実世界の「顧客」でも、コンテキストごとに **必要な属性だけを持つモデル** として表現します。
これにより：
- 各コンテキストが独立して変更できる
- モデルがシンプルに保たれる
- チームが独立して開発できる

---

## 2. コンテキストマップ（Context Map）

複数のコンテキストがどのように連携するかを示す全体地図です。
コンテキスト間でデータを共有したり、イベントで連携したりする関係を可視化します。

```
EC サイトのコンテキストマップ（概念図）

┌─────────────────┐   注文確定イベント   ┌─────────────────┐
│  注文コンテキスト │ ─────────────────→ │  配送コンテキスト │
│  (Order)        │                     │  (Shipping)     │
└─────────────────┘                     └─────────────────┘
         │                                       │
         │ 在庫確認リクエスト                       │ 配送状況通知
         ↓                                       ↓
┌─────────────────┐                     ┌─────────────────┐
│  在庫コンテキスト │                     │  通知コンテキスト │
│  (Inventory)    │                     │  (Notification) │
└─────────────────┘                     └─────────────────┘
         │
         │ 決済リクエスト
         ↓
┌─────────────────┐
│  決済コンテキスト │  ← 外部サービス（Stripe 等）
│  (Payment)      │
└─────────────────┘
```

### コンテキスト間の関係パターン

Eric Evans はコンテキスト間の関係を以下のパターンで分類しました：

#### パターン1：共有カーネル（Shared Kernel）

2 つのコンテキストが一部のモデルを **共有** します。

```
注文コンテキスト                   配送コンテキスト
      │                                 │
      └──── 共有する概念 ────────────────┘
            ・OrderId（注文IDは同じ）
            ・Money（金額の表現は共通）
```

**利点**：重複を避けられる
**欠点**：一方の変更が他方に影響する。チーム間の調整が必要

---

#### パターン2：顧客-供給者（Customer-Supplier）

一方（供給者）が API を提供し、もう一方（顧客）がそれを利用します。

```
在庫コンテキスト（供給者）
      ↓  API: checkStock(productId): boolean
注文コンテキスト（顧客）
```

**特徴**：顧客コンテキストは供給者の都合に縛られる。
供給者が変更すると顧客も影響を受ける。

---

#### パターン3：腐敗防止層（Anti-Corruption Layer）

外部システムやレガシーシステムのモデルを **自分のモデルに変換** する層。
外部の「汚染（Corruption）」から自分のドメインモデルを守ります。

```
外部の決済API（Stripe）のレスポンス
{
  "charge_id": "ch_xxx",
  "amount_captured": 1500,
  "currency": "jpy",
  "payment_status": "succeeded"
}
         ↓  腐敗防止層（ACL）が変換
自分のドメインモデル
{
  paymentId: PaymentId.of("ch_xxx"),
  amount: Money.of(1500, "JPY"),
  status: PaymentStatus.COMPLETED
}
```

**なぜ必要か**：外部APIの変更（フィールド名の変更など）が
自分のドメインモデルに直接影響しないようにするため。

```typescript
// 腐敗防止層の実装例
class StripePaymentAdapter {
  // 外部APIのレスポンスを自分のモデルに変換
  toPayment(stripeCharge: StripeCharge): Payment {
    return new Payment(
      PaymentId.of(stripeCharge.charge_id),      // フィールド名を変換
      Money.of(stripeCharge.amount_captured, stripeCharge.currency.toUpperCase()),
      this.toPaymentStatus(stripeCharge.payment_status)
    );
  }

  private toPaymentStatus(stripeStatus: string): PaymentStatus {
    switch (stripeStatus) {
      case 'succeeded': return PaymentStatus.COMPLETED;
      case 'pending':   return PaymentStatus.PENDING;
      case 'failed':    return PaymentStatus.FAILED;
      default: throw new Error(`未知のStripe決済ステータス: ${stripeStatus}`);
    }
  }
}
```

---

#### パターン4：公開ホストサービス（Open Host Service）

コンテキストが他のコンテキストのために **汎用的な API** を公開します。
REST API や GraphQL がこれに該当します。

---

## 3. 境界づけられたコンテキストを識別する方法

「どこで境界を引くか」は DDD の中でも最も難しい問題の一つです。
以下の質問がヒントになります：

```
Q1：同じ言葉が異なる意味を持っていないか？
   「顧客」が配送部門と経理部門で違う意味 → 境界を引くサイン

Q2：別々のチームが担当している業務か？
   別チームが担当している場合、独立したコンテキストにしやすい

Q3：変更頻度が大きく異なるか？
   配送ロジックはほぼ変わらないが、プロモーションルールは毎週変わる
   → 変更頻度の違いは境界のサイン

Q4：別々のデータソースを使うか？
   在庫は在庫DBを使い、注文は注文DBを使う → コンテキストを分ける候補

Q5：ビジネス上の責任が明確に分かれているか？
   「在庫管理は倉庫チームの責任」「注文処理は EC チームの責任」
   → 責任の分離は境界のヒント
```

---

## 4. このプロジェクトのスコープ

本サンプルコードでは **注文コンテキスト（Order Context）** に集中して実装します。

```
注文コンテキストの責務

  ┌─────────────────────────────────────────┐
  │  注文コンテキスト（Order Context）         │
  │                                          │
  │  概念：                                   │
  │  ・顧客（Customer）                       │
  │  ・注文（Order）                           │
  │  ・注文明細（OrderItem）                   │
  │  ・金額（Money）                           │
  │                                          │
  │  アクション：                              │
  │  ・注文を発注する（PlaceOrder）             │
  │  ・注文を確定する（ConfirmOrder）           │
  │  ・注文をキャンセルする（CancelOrder）      │
  │                                          │
  │  スコープ外（今回は実装しない）：            │
  │  ・在庫確認・決済・配送・通知               │
  └─────────────────────────────────────────┘
```

実際の業務システムでは、このコンテキストが複数集まって
全体のシステムを構成します。

---

## 5. まとめ：戦略的設計のチェックリスト

設計を始める前に、以下を確認します：

```
□ ドメインエキスパートは誰か？
□ コアドメインはどこか？（最も注力すべき部分）
□ サブドメインをどこで分割するか？
□ 各コンテキストのユビキタス言語は定義されているか？
□ コンテキスト間の関係パターンは何か？（共有カーネル/顧客-供給者/ACL）
□ 腐敗防止層が必要な外部システムはどれか？
```

| 概念 | 目的 |
|-----|------|
| 境界づけられたコンテキスト | モデルが有効な範囲を明確にし、複雑さを制御する |
| コンテキストマップ | コンテキスト間の関係と依存方向を可視化する |
| ユビキタス言語 | 各コンテキスト内で一貫した言語を定義する |
| 腐敗防止層 | 外部システムの変化からドメインモデルを保護する |

> **「大きな問題は分割せよ。各コンテキストは独立して理解できる単位にすべき。」**

次のステップ → [戦術的設計](./04_tactical_design.md)
