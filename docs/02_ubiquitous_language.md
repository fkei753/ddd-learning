# ユビキタス言語（Ubiquitous Language）

## 1. ユビキタス言語とは

**ユビキタス言語** とは、開発チームとドメインエキスパート（ビジネス担当者）が
**同じ意味で使う共通の言葉** のことです。

「ユビキタス（Ubiquitous）」= ラテン語で「どこにでも存在する」

つまり、**会話・ドキュメント・コード・テスト・データベース** のすべてで
同じ言語を使うということです。

> Eric Evans：「もしドメインエキスパートがコードを読んだとき、
> 自分たちが話した概念がそのままコードに現れていなければ、
> それはユビキタス言語の失敗だ。」

---

## 2. なぜユビキタス言語が重要か

### 翻訳コストという問題

ソフトウェア開発において「翻訳」は常に誤りを生みます。

```
【悪い例：翻訳が 3 段階ある】

ドメインエキスパート：「顧客が商品をカートに入れて購入確定した」
           ↓ 翻訳（開発者が解釈）
設計書：             「ユーザーが商品をバスケットに追加してチェックアウト」
           ↓ 翻訳（コーディング時に解釈）
コード：             user.addToBasket(product); basket.checkout();
           ↓ 翻訳（DB設計時に解釈）
テーブル：            tbl_user_cart, order_master, cart_detail
```

翻訳が重なるたびに、意味がずれる可能性があります。
仕様変更の連絡が「翻訳ゲーム」のように伝言されていくと、
最終的に意図とは違うものが実装されます。

### 実際にありがちな混乱

```
【混乱の具体例】

ビジネス担当者「VIP 顧客への割引を適用してください」

開発者A：「User クラスの isPremium フラグが true なら discount を計算」
開発者B：「Member の grade が 'gold' 以上なら price reduction を適用」
テスト担当：「顧客タイプが優良の場合、値引きが発生すること」
DB：      tbl_user.user_rank = 'VIP', tbl_discount_master ...

─────────────────────────────────────────────────────
同じビジネスルールが 4 通りの言葉で表現されている状態。
バグが起きたとき「どのコードが正しいのか」誰もわからない。
```

### ユビキタス言語で統一した場合

```
【良い例：すべてで同じ言葉を使う】

ドメインエキスパート：「VIP 顧客（Customer）が注文（Order）を発注（Place）した場合、
                       割引（Discount）が適用される」

コード：
  if (customer.isVip()) {
    const discount = orderDomainService.calculateDiscount(customer, order.totalAmount);
  }

テスト：
  「VIP 顧客が注文を発注したとき、割引が計算されること」

DB テーブル：customers（customer_type = 'VIP'）
```

翻訳が不要なため、誤解が生まれる余地がありません。

---

## 3. ユビキタス言語の作り方

### ステップ1：ドメインエキスパートにインタビューする

開発者が一人で考えるのではなく、ビジネス担当者との対話から言語を発見します。

```
【良いインタビューの例】

開発者：「『購入確定』と『注文確定』は同じ意味ですか？」
担当者：「違います。『購入確定』はお客様がボタンを押す操作で、
         『注文確定』は私たちが在庫を確認して受け付けることです」

→ 発見した概念：
  ・発注する（Place an Order）： 顧客がアクションを起こす
  ・注文を確定する（Confirm an Order）：店舗が受け付けを確定する
```

```
【良い質問の例】
・「〇〇が失敗するのはどんなケースですか？」
・「〇〇と△△は同じものですか、それとも別ですか？」
・「このアクションが起きたとき、次に何が起きますか？」
・「〇〇は変化しますか？どんなときに変化しますか？」
```

### ステップ2：用語集（Glossary）を作る

発見した言葉を文書化します。曖昧さを排除し、同義語・禁止語も明記します。

### ステップ3：コードに反映する

用語集の言葉をそのままクラス名・メソッド名・変数名に使います。

### ステップ4：継続的に育てる

ビジネスの理解が深まるにつれて、言語も進化します。
モデルの理解が変わったら、コードも用語集も更新します。

---

## 4. EC サイトのユビキタス言語辞書

このプロジェクトで使う言葉を定義します。

---

### 👤 顧客（Customer）

| 項目 | 内容 |
|-----|------|
| 定義 | EC サイトに登録し、商品を購入できるユーザー |
| 識別 | **顧客 ID（CustomerId）** で一意に識別される |
| 属性 | 氏名、メールアドレス、VIPフラグ |
| 禁止語 | 「ユーザー（User）」「メンバー（Member）」は使わない |
| コード | `src/domain/customer/Customer.ts` |

```typescript
// ✅ 正しい表現
const customer = await customerRepository.findById(customerId);

// ❌ 禁止（ビジネス用語と乖離）
const user = await userRepository.findById(userId);
```

---

### 📦 注文（Order）

| 項目 | 内容 |
|-----|------|
| 定義 | 顧客が商品を購入する意思を示した取引の単位 |
| 識別 | **注文 ID（OrderId）** で一意に識別される |
| 構成 | 1 つ以上の **注文明細（OrderItem）** を含む |
| 禁止語 | 「カゴ（Cart/Basket）」「トランザクション（Transaction）」は使わない |
| コード | `src/domain/order/Order.ts` |

```typescript
// ✅ 正しい表現
const order = Order.place(customerId, orderItems);

// ❌ 禁止
const cart = new ShoppingCart();
cart.checkout();
```

---

### 📋 注文明細（OrderItem）

| 項目 | 内容 |
|-----|------|
| 定義 | 注文の中の個々の商品行 |
| 構成 | 商品 ID、商品名、単価（Money）、数量 |
| ルール | 数量は 1 以上でなければならない |
| コード | `src/domain/order/OrderItem.ts` |

```typescript
const item = OrderItem.create(
  'prod-001',          // 商品ID
  'りんご',             // 商品名
  Money.of(150, 'JPY'), // 単価
  3                     // 数量
);
// item.subtotal → Money.of(450, 'JPY')
```

---

### 🏷️ 注文ステータス（OrderStatus）

注文の現在の状態を表す値オブジェクトです。
以下の順序で遷移し、逆方向には遷移しません。

```
PENDING（注文受付）
   ↓  confirm()
CONFIRMED（注文確定）
   ↓  ship()
SHIPPED（発送済）
   ↓  deliver()
DELIVERED（配達完了）

※ PENDING・CONFIRMED のみ cancel() でキャンセルできる
  （SHIPPED 以降はキャンセル不可）

CANCELLED（キャンセル）  ← PENDING / CONFIRMED のみ遷移可能
```

| ステータス | 日本語 | 意味 |
|----------|--------|-----|
| `PENDING` | 注文受付 | 顧客が発注した直後。店舗未確認 |
| `CONFIRMED` | 注文確定 | 店舗が在庫確認し受け付けた |
| `SHIPPED` | 発送済 | 商品が発送された |
| `DELIVERED` | 配達完了 | 顧客が商品を受け取った |
| `CANCELLED` | キャンセル | 注文が取り消された |

コード → `src/domain/order/OrderStatus.ts`

---

### 💰 金額（Money）

| 項目 | 内容 |
|-----|------|
| 定義 | 数値と通貨コード（ISO 4217）のペア |
| 例 | `Money.of(1500, 'JPY')` = 1,500 円 |
| 禁止 | 数値単体での金額表現（`1500`）は禁止。通貨が不明になる |
| コード | `src/domain/shared/Money.ts` |

```typescript
// ✅ 正しい表現
const price = Money.of(1500, 'JPY');
const total = price.multiply(3); // Money.of(4500, 'JPY')

// ❌ 禁止（通貨が不明）
const price = 1500;
const total = price * 3;

// ❌ 禁止（異なる通貨の加算はエラー）
const jpy = Money.of(1500, 'JPY');
const usd = Money.of(10, 'USD');
jpy.add(usd); // throw Error: 通貨が異なります
```

---

### 🛒 発注する（Place an Order）

| 項目 | 内容 |
|-----|------|
| アクター | 顧客（Customer） |
| 定義 | 顧客が注文を確定させるアクション。注文が PENDING 状態で作成される |
| 禁止語 | 「購入する（Purchase）」「チェックアウト（Checkout）」は使わない |
| コード | `Order.place()` |

```typescript
// ✅ ユビキタス言語そのままのメソッド名
const order = Order.place(customer.id, orderItems);
```

---

### ✅ 注文を確定する（Confirm an Order）

| 項目 | 内容 |
|-----|------|
| アクター | 店舗スタッフ（システム） |
| 定義 | 店舗が注文を受け付け、ステータスを CONFIRMED に変更するアクション |
| 前提条件 | 注文が PENDING 状態であること |

```typescript
order.confirm();
// OrderStatus: PENDING → CONFIRMED
// OrderConfirmed ドメインイベントが発行される
```

---

### ❌ 注文をキャンセルする（Cancel an Order）

| 項目 | 内容 |
|-----|------|
| アクター | 顧客または店舗スタッフ |
| 定義 | 注文を取り消すアクション |
| 制約 | SHIPPED（発送済）以降はキャンセル不可 |

```typescript
order.cancel();
// OrderStatus: PENDING/CONFIRMED → CANCELLED
// SHIPPED の場合 → throw new Error('この注文はキャンセルできません')
```

---

## 5. ユビキタス言語をコードに反映する原則

### 原則1：クラス名 ＝ ドメインの概念名

```typescript
// ❌ 技術的な名前
class OrderDataTransferObject { ... }
class OrderEntityBean { ... }

// ✅ ドメイン概念の名前
class Order { ... }
class OrderItem { ... }
```

### 原則2：メソッド名 ＝ ドメインのアクション名

```typescript
// ❌ 技術的・汎用的なメソッド名
order.update({ status: 'CANCELLED' });
order.setStatus(OrderStatus.CANCELLED);

// ✅ ビジネスの言葉そのまま
order.cancel();
order.confirm();
order.ship();
```

### 原則3：例外メッセージもユビキタス言語で

```typescript
// ❌ 技術的なエラーメッセージ
throw new Error('Invalid state transition');

// ✅ ビジネスの言葉
throw new Error('発送済みの注文はキャンセルできません');
```

---

## 6. よくある誤解と注意点

### 誤解1：「ユビキタス言語 = 日本語をそのままコードに書く」

日本語・英語どちらでも構いません。重要なのは **ビジネス担当者と開発者の間で意味が一致していること** です。
英語でコーディングする場合でも、用語集で対応を明確にします。

```
用語集の例：
  顧客 → Customer
  注文 → Order
  発注する → place (an order)
  注文を確定する → confirm (an order)
```

### 誤解2：「一度決めたら変えられない」

ユビキタス言語は **生きたドキュメント** です。
ドメインの理解が深まれば、言語も進化します。
言語が変わったら **コードもドキュメントも同時に更新** します。

### 誤解3：「すべてのコンテキストで同じ言語を使う」

複数のコンテキストにまたがって同じ言語を無理やり統一しようとすると、
モデルが複雑になります。
**同じ「顧客」でも、注文コンテキストと配送コンテキストでは異なるモデル** として定義します
（詳しくは [戦略的設計](./03_strategic_design.md) を参照）。

## 5. 言語の発展と更新

ユビキタス言語は**一度決めたら終わりではありません。**

- ドメインエキスパートとの会話を通じて継続的に洗練される
- 新しい概念が生まれたら辞書に追加する
- 言葉の意味が変わったら、コードも同時に更新する

> **コードはドキュメントである。コードを読めばビジネスが理解できる状態が理想。**

---

## 6. まとめ

| ポイント | 説明 |
|---------|------|
| 共通言語 | チーム全員が同じ意味で使う言葉を定義する |
| コードへの反映 | クラス名・メソッド名・変数名に使う |
| 継続的更新 | 知識の深まりとともに言語も進化させる |
| 翻訳禁止 | ビジネス用語 → 技術用語への翻訳レイヤーを作らない |

次のステップ → [戦略的設計](./03_strategic_design.md)
