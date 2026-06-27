/**
 * demo.ts - DDD + クリーンアーキテクチャ デモスクリプト
 *
 * 実行方法：
 *   npx ts-node src/demo.ts
 *
 * このスクリプトは以下の流れを示します：
 * 1. 顧客を作成する
 * 2. 通常顧客が注文を発注する（割引なし）
 * 3. VIP顧客が注文を発注する（10%割引）
 * 4. 注文をキャンセルする
 * 5. SHIPPED後のキャンセルが失敗することを確認する
 */

import { Customer } from "./domain/customer/Customer";
import { OrderDomainService } from "./domain/order/OrderDomainService";
import { PlaceOrderUseCase } from "./application/order/PlaceOrderUseCase";
import { InMemoryOrderRepository } from "./infrastructure/order/InMemoryOrderRepository";
import { InMemoryCustomerRepository } from "./infrastructure/customer/InMemoryCustomerRepository";

async function main() {
  console.log("=".repeat(60));
  console.log("  DDD + クリーンアーキテクチャ デモ");
  console.log("=".repeat(60));

  // ─── インフラ層の初期化 ────────────────────────────────────────
  const orderRepository = new InMemoryOrderRepository();
  const customerRepository = new InMemoryCustomerRepository();
  const orderDomainService = new OrderDomainService();

  // ─── ユースケースの初期化（依存性の注入） ────────────────────────
  // ここで「どの実装を使うか」を決定する（Composition Root）
  const placeOrderUseCase = new PlaceOrderUseCase(
    orderRepository,
    customerRepository,
    orderDomainService
  );

  // ─── テストデータ：顧客の作成 ────────────────────────────────────
  const alice = Customer.create("山田 太郎", "taro@example.com");
  const bob = Customer.create("鈴木 花子", "hanako@example.com");
  bob.addPurchaseAmount(150_000); // VIPにする

  await customerRepository.save(alice);
  await customerRepository.save(bob);

  console.log(`\n顧客登録完了:`);
  console.log(`  ${alice.name} (ID: ${alice.id}) - VIP: ${alice.isVip()}`);
  console.log(`  ${bob.name} (ID: ${bob.id}) - VIP: ${bob.isVip()}`);

  // ─── ケース1：通常顧客が注文を発注する ───────────────────────────
  console.log("\n" + "-".repeat(60));
  console.log("ケース1：通常顧客が注文を発注する（割引なし）");
  console.log("-".repeat(60));

  const result1 = await placeOrderUseCase.execute({
    customerId: alice.id.value,
    items: [
      {
        productId: "prod-001",
        productName: "ノートパソコン",
        unitPriceAmount: 80_000,
        currency: "JPY",
        quantity: 1,
      },
      {
        productId: "prod-002",
        productName: "マウス",
        unitPriceAmount: 3_000,
        currency: "JPY",
        quantity: 2,
      },
    ],
  });

  console.log(`注文ID: ${result1.orderId}`);
  console.log(`合計金額: ${result1.totalAmount.toLocaleString()} ${result1.currency}`);
  console.log(`割引額: ${result1.discountAmount.toLocaleString()} ${result1.currency}`);
  console.log(`最終金額: ${result1.finalAmount.toLocaleString()} ${result1.currency}`);
  console.log(`ステータス: ${result1.status}`);

  // ─── ケース2：VIP顧客が注文を発注する ────────────────────────────
  console.log("\n" + "-".repeat(60));
  console.log("ケース2：VIP顧客が注文を発注する（10%割引）");
  console.log("-".repeat(60));

  const result2 = await placeOrderUseCase.execute({
    customerId: bob.id.value,
    items: [
      {
        productId: "prod-003",
        productName: "モニター",
        unitPriceAmount: 50_000,
        currency: "JPY",
        quantity: 1,
      },
    ],
  });

  console.log(`注文ID: ${result2.orderId}`);
  console.log(`合計金額: ${result2.totalAmount.toLocaleString()} ${result2.currency}`);
  console.log(`割引額: ${result2.discountAmount.toLocaleString()} ${result2.currency} ← VIP 10%割引`);
  console.log(`最終金額: ${result2.finalAmount.toLocaleString()} ${result2.currency}`);
  console.log(`ステータス: ${result2.status}`);

  // ─── ケース3：注文をキャンセルする ───────────────────────────────
  console.log("\n" + "-".repeat(60));
  console.log("ケース3：PENDING の注文をキャンセルする");
  console.log("-".repeat(60));

  const orderToCancel = await orderRepository.findById(
    (await orderRepository.findAll())[0].id
  );
  if (orderToCancel) {
    orderToCancel.cancel();
    await orderRepository.save(orderToCancel);
    console.log(`注文 ${orderToCancel.id} をキャンセルしました`);
    console.log(`ステータス: ${orderToCancel.status}`);
    const cancelEvents = orderToCancel.pullDomainEvents();
    console.log(`発行イベント: ${cancelEvents.map((e) => e.eventType).join(", ")}`);
  }

  // ─── ケース4：SHIPPED後のキャンセルは失敗する ────────────────────
  console.log("\n" + "-".repeat(60));
  console.log("ケース4：SHIPPED後のキャンセルは失敗する（ビジネスルール）");
  console.log("-".repeat(60));

  const allOrders = await orderRepository.findAll();
  const pendingOrder = allOrders.find((o) => o.status === "PENDING");
  if (pendingOrder) {
    pendingOrder.confirm(); // PENDING → CONFIRMED
    pendingOrder.ship();    // CONFIRMED → SHIPPED
    await orderRepository.save(pendingOrder);
    console.log(`注文 ${pendingOrder.id} を発送済みにしました`);

    try {
      pendingOrder.cancel(); // ❌ これは失敗するはず
    } catch (e: unknown) {
      if (e instanceof Error) {
        console.log(`✅ 期待通りエラー: ${e.message}`);
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("  デモ完了！");
  console.log("=".repeat(60));
}

main().catch(console.error);
