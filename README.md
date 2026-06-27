# DDD + クリーンアーキテクチャ 学習プロジェクト

**EC サイトの注文管理** を題材に、DDD とクリーンアーキテクチャを一から学ぶサンプルプロジェクトです。

---

## ドキュメント（先に読んでください）

| # | タイトル | 学べること |
|---|---------|-----------|
| 1 | [DDDとは](./docs/01_what_is_ddd.md) | DDDの概要・全体像 |
| 2 | [ユビキタス言語](./docs/02_ubiquitous_language.md) | 共通言語・用語辞書 |
| 3 | [戦略的設計](./docs/03_strategic_design.md) | 境界づけられたコンテキスト |
| 4 | [戦術的設計](./docs/04_tactical_design.md) | Entity / VO / Aggregate / Repository |
| 5 | [クリーンアーキテクチャ](./docs/05_clean_architecture.md) | レイヤー構造・依存性逆転 |

---

## ディレクトリ構造

```
src/
├── domain/                          ← ドメイン層（ビジネスの核）
│   ├── shared/
│   │   ├── Money.ts                 ← 値オブジェクト：金額
│   │   └── DomainEvent.ts           ← ドメインイベント基底
│   ├── customer/
│   │   ├── Customer.ts              ← 集約ルート
│   │   ├── CustomerId.ts            ← 値オブジェクト
│   │   └── CustomerRepository.ts   ← リポジトリIF
│   └── order/
│       ├── Order.ts                 ← 集約ルート（最重要）
│       ├── OrderItem.ts             ← エンティティ
│       ├── OrderId.ts               ← 値オブジェクト
│       ├── OrderStatus.ts           ← 値オブジェクト（enum）
│       ├── OrderRepository.ts       ← リポジトリIF
│       └── OrderDomainService.ts    ← ドメインサービス
│
├── application/                     ← アプリケーション層（ユースケース）
│   └── order/
│       ├── PlaceOrderCommand.ts     ← 入力DTO
│       └── PlaceOrderUseCase.ts     ← ユースケース（発注する）
│
├── infrastructure/                  ← インフラ層（実装の詳細）
│   ├── order/
│   │   └── InMemoryOrderRepository.ts
│   └── customer/
│       └── InMemoryCustomerRepository.ts
│
└── demo.ts                          ← 動作確認デモ
```

---

## セットアップ & 実行

```bash
cd ddd-learning

# 依存パッケージをインストール
npm install

# デモを実行
npm run demo
```

### 期待される出力

```
============================================================
  DDD + クリーンアーキテクチャ デモ
============================================================

顧客登録完了:
  山田 太郎 (ID: cust-xxx) - VIP: false
  鈴木 花子 (ID: cust-yyy) - VIP: true

------------------------------------------------------------
ケース1：通常顧客が注文を発注する（割引なし）
------------------------------------------------------------
[イベント発行] OrderPlaced
注文ID: ord-xxx
合計金額: 86,000 JPY
割引額: 0 JPY
最終金額: 86,000 JPY
ステータス: PENDING

------------------------------------------------------------
ケース2：VIP顧客が注文を発注する（10%割引）
------------------------------------------------------------
[イベント発行] OrderPlaced
注文ID: ord-yyy
合計金額: 50,000 JPY
割引額: 5,000 JPY ← VIP 10%割引
最終金額: 45,000 JPY
ステータス: PENDING

------------------------------------------------------------
ケース3：PENDING の注文をキャンセルする
------------------------------------------------------------
注文 ord-xxx をキャンセルしました
ステータス: CANCELLED
発行イベント: OrderCancelled

------------------------------------------------------------
ケース4：SHIPPED後のキャンセルは失敗する（ビジネスルール）
------------------------------------------------------------
注文 ord-yyy を発送済みにしました
✅ 期待通りエラー: 発送済みまたは配達完了の注文はキャンセルできません。...
```

---

## 学習のポイント

### 1. ユビキタス言語がコードに反映されている
- `Order.place()` = 「注文を発注する」
- `Order.confirm()` = 「注文を確定する」
- `Order.cancel()` = 「注文をキャンセルする」

### 2. ビジネスルールはドメイン層に集まっている
- キャンセル可否のチェック → `Order.cancel()` 内
- VIP判定 → `Customer.isVip()` 内
- 割引計算 → `OrderDomainService.calculateDiscount()` 内

### 3. ドメイン層がインフラに依存していない
- `OrderRepository` はインターフェースのみ（ドメイン層）
- `InMemoryOrderRepository` が実装（インフラ層）
- テスト時は `InMemoryOrderRepository` を使い、DB不要でテストできる

### 4. 値オブジェクトで型安全性を高めている
- `string` ではなく `OrderId`・`CustomerId` 型を使う
- `number` ではなく `Money` 型を使う → 通貨の混入を防ぐ
