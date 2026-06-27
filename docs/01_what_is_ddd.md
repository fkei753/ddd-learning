# ドメイン駆動設計（DDD）とは

## 1. DDDの概要

**ドメイン駆動設計（Domain-Driven Design / DDD）** は、Eric Evans が2003年に著書
*"Domain-Driven Design: Tackling Complexity in the Heart of Software"*（通称「青本」）で
提唱したソフトウェア設計アプローチです。

> **核心思想：ソフトウェアの複雑さに立ち向かう最良の方法は、
> そのビジネス領域（ドメイン）を深く理解し、設計に反映させることである。**

この思想の背景にあるのは、「最も難しいのは技術ではなくビジネスの理解だ」という観察です。
フレームワークやデータベースは数年で入れ替わりますが、ビジネスのルールと概念は
長期にわたって存在し続けます。それならば、**変わりにくいビジネスの本質をコードの中心に置くべき**
だというのが DDD の出発点です。

---

## 2. DDD が生まれた背景：「大きな泥団子」問題

### ビッグボール・オブ・マッド（Big Ball of Mud）

DDD が提唱される以前、多くのシステムは設計なしに成長し、
**ビッグボール・オブ・マッド（Big Ball of Mud）** と呼ばれる状態に陥っていました。

```
【ビッグボール・オブ・マッドの症状】

  UserController
       │ 直接呼び出し
       ├──→ Database.query("SELECT * FROM orders WHERE ...")
       │
       ├──→ EmailService.send(...)   ← なぜコントローラが？
       │
       └──→ if (user.type === 'vip') {   ← ビジネスロジックが
               discount = total * 0.1;    ← UIに散在している
             }
```

このような状態では：
- 一か所を変えると別の場所が壊れる（スパゲッティ）
- テストが書けない（依存が複雑すぎる）
- 新しい開発者がコードを理解できない
- 仕様変更のたびに「どこを直せばいいか」わからない

### 貧血ドメインモデル（Anemic Domain Model）

もう一つの問題パターンが **貧血ドメインモデル** です。
「オブジェクト指向っぽく書いた」が、実態はデータの入れ物にすぎないコードです。

```typescript
// ❌ 貧血ドメインモデルの例
// クラスはあるが、データを持つだけでロジックを持たない
class Order {
  id: string;
  status: string;
  items: OrderItem[];
  totalAmount: number;
  // メソッドは getter/setter のみ
}

// ロジックはすべて「サービスクラス」に書かれる
class OrderService {
  cancelOrder(order: Order): void {
    // ここに全ロジックが集まり、OrderService が肥大化する
    if (order.status === 'SHIPPED') {
      throw new Error('発送済みはキャンセルできません');
    }
    order.status = 'CANCELLED';
  }

  calculateTotal(order: Order): number {
    return order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  // ...どんどん増えるメソッド
}
```

**DDD ではロジックをエンティティ・集約に持たせ、**
**モデルそのものが振る舞いを表現する「豊かなドメインモデル（Rich Domain Model）」を目指します。**

```typescript
// ✅ 豊かなドメインモデルの例
class Order {
  // データとロジックが一体
  cancel(): void {
    if (!CANCELLABLE_STATUSES.includes(this._status)) {
      throw new Error('この注文はキャンセルできません');
    }
    this._status = OrderStatus.CANCELLED;
    this.addDomainEvent(new OrderCancelled(this._id));
  }

  get totalAmount(): Money {
    return this._items.reduce(
      (sum, item) => sum.add(item.subtotal),
      Money.of(0, 'JPY')
    );
  }
}
```

---

## 3. DDD はいつ使うべきか

DDD はすべてのプロジェクトに適しているわけではありません。

| プロジェクトの特性 | DDD の適合度 |
|-----------------|------------|
| 複雑なビジネスルールがある | ✅ 高い（DDD の真価が発揮される） |
| ドメインエキスパートと継続的に連携できる | ✅ 高い |
| 長期にわたってメンテナンスされる | ✅ 高い |
| CRUD 中心のシンプルな管理画面 | ❌ 低い（過剰設計になる） |
| 使い捨てのプロトタイプ | ❌ 低い |
| チームが3人以下で短期 | ❌ 低い（コストが見合わない） |

> **DDD の導入コストは高い。それを上回るビジネスの複雑さがある場合にのみ採用を検討する。**

---

## 4. なぜ DDD が必要か？

### よくある現場の問題

**問題1：コードを読んでも「何をするシステムか」が伝わらない**

```typescript
// 意図が全く伝わらないコード
async function proc1(uid: string, arr: any[]): Promise<void> {
  const u = await db.get('users', uid);
  if (!u || u.f1 !== 1) throw new Error('err1');
  const t = arr.map(a => ({ pid: a.p, n: a.nm, up: a.pr, q: a.q }));
  // ...
}

// DDD で書いたコード（ユビキタス言語そのまま）
async function placeOrder(customerId: string, items: OrderItemInput[]): Promise<void> {
  const customer = await customerRepository.findById(CustomerId.of(customerId));
  if (!customer) throw new Error('顧客が見つかりません');
  const order = Order.place(customer.id, items.map(toOrderItem));
  await orderRepository.save(order);
}
```

**問題2：開発者とビジネス担当者が「違う言葉」で話している**

```
ビジネス担当者の言葉：「顧客が商品をカートに入れて購入確定した」
開発者の理解：       「user が item を basket に add して checkout した」
DBのテーブル名：      tbl_usr_shp, order_mst, cart_detail

→ 3者の言葉が全部バラバラ。仕様変更があるたびに翻訳が必要。
```

**問題3：仕様変更のたびに影響範囲が読めない**

「VIP 顧客への割引率を 10% から 15% に変更する」という変更が、
コード全体の何か所に散在しているか、誰も把握できない状態になる。

### DDD が解決すること

| 問題 | DDD のアプローチ |
|------|----------------|
| 言葉のずれ | **ユビキタス言語** でチーム全体の共通語を作る |
| 巨大すぎるシステム | **境界づけられたコンテキスト** で意味のある単位に分割 |
| ロジックの散在 | **ドメイン層** にビジネスロジックを集約 |
| 変更への弱さ | **集約・不変条件** で変更の影響範囲を明確化 |
| テストの難しさ | ドメイン層は外部依存がなく純粋なロジックのみ → テストしやすい |

---

## 5. DDD の二層構造

DDD は大きく **戦略的設計** と **戦術的設計** に分かれます。

```
DDD
├── 戦略的設計（Strategic Design）  ← 「どう分割するか」の地図を描く
│   ├── ユビキタス言語                 共通語を定義する
│   ├── 境界づけられたコンテキスト     モデルが有効な範囲を決める
│   └── コンテキストマップ            コンテキスト間の関係を描く
│
└── 戦術的設計（Tactical Design）  ← 「どう実装するか」のパターン集
    ├── エンティティ（Entity）         IDで識別されるオブジェクト
    ├── 値オブジェクト（Value Object） 属性で識別されるオブジェクト
    ├── 集約（Aggregate）             整合性を保つ単位
    ├── ドメインサービス（Domain Service）どの集約にも属さないロジック
    ├── リポジトリ（Repository）       永続化の抽象化
    └── ドメインイベント（Domain Event）起きた事実の通知
```

**戦略的設計が土台** です。どのコンテキストを切り出すかを決めずに
戦術的設計の実装パターンだけ採用しても、設計の整合性は保てません。

---

## 6. ドメインとは

**ドメイン（Domain）** とは、ソフトウェアが解決しようとしている
**現実世界のビジネス領域** のことです。

「EC サイトを作る」と言ったとき、そのドメインには以下のような
**概念・ルール・手順** が存在します：

- 顧客は注文を発注できる
- 在庫がない商品は販売できない
- VIP 顧客は割引を受けられる
- 発送済みの注文はキャンセルできない

これらを「**ドメイン知識（Domain Knowledge）**」と呼びます。
DDD の目標は、このドメイン知識をそのままコードに反映させることです。

| システム例 | ドメイン |
|-----------|---------|
| EC サイト | 注文管理、在庫管理、配送管理、決済 |
| 病院システム | 診察、処方、入退院管理 |
| 銀行システム | 口座管理、送金、融資審査 |
| 航空システム | 座席予約、搭乗管理、マイレージ |

### コアドメイン vs サブドメイン

すべてのドメインが同じ重要度ではありません。
ビジネスとして **競合他社との差別化の源泉** となる部分が **コアドメイン** です。

```
EC サイトのドメイン
├── コアドメイン（Core Domain）    ← 競合優位性の源泉、最も注力すべき
│   └── レコメンデーションエンジン・パーソナライズ注文管理
│
├── 支援サブドメイン（Supporting）  ← ビジネスに必要だが差別化要因ではない
│   └── 在庫管理・配送管理          自社で実装するが完璧さは求めない
│
└── 汎用サブドメイン（Generic）     ← 既製品・外部サービスで代替可能
    └── 認証（Auth0）・決済（Stripe）・メール送信（SendGrid）
```

> **重要：コアドメインに DDD の最高の設計リソースを投下する。**
> 汎用サブドメインに同じ労力をかけるのは過剰投資です。

### ドメインエキスパートとの協働

DDD において **ドメインエキスパート（Domain Expert）** とは、
ビジネスのルールや概念を最もよく知っている人物です（必ずしもエンジニアではない）。

```
ドメインエキスパートの例：
- EC サイト → バイヤー・マーチャンダイザー・カスタマーサポートリード
- 病院システム → 医師・看護師長・医事課スタッフ
- 銀行システム → 融資担当者・コンプライアンス担当者
```

DDD では開発者とドメインエキスパートが **継続的な対話** を通じて
モデルを育てていきます。ドメインエキスパートの言葉がそのままコードになります。

---

## 7. 学習の流れ

このドキュメントシリーズでは、**EC サイトの注文管理** を例に
DDD とクリーンアーキテクチャを段階的に学びます。

```
実装例の全体像

顧客（Customer）が注文（Order）を発注する（PlaceOrder）
    ↓
注文には複数の注文明細（OrderItem）が含まれる
    ↓
VIP 顧客なら割引が適用される（OrderDomainService）
    ↓
注文が保存される（OrderRepository → InMemoryOrderRepository）
    ↓
ドメインイベント（OrderPlaced）が発行される
```

1. [ユビキタス言語](./02_ubiquitous_language.md) — 共通語を定義する
2. [戦略的設計](./03_strategic_design.md) — システムを意味のある単位に分割する
3. [戦術的設計](./04_tactical_design.md) — ドメインモデルを実装パターンで表現する
4. [クリーンアーキテクチャ](./05_clean_architecture.md) — レイヤー構造でコードを整理する

サンプルコードは `src/` ディレクトリに配置されています。
