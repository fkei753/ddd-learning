/**
 * ドメインイベントの基底インターフェース
 *
 * ドメイン内で起きた重要な出来事を表す。
 * - 過去形で命名する（例：OrderPlaced, OrderCancelled）
 * - 不変である（発生した事実は変更できない）
 */
export interface DomainEvent {
  /** イベントが発生した日時 */
  readonly occurredAt: Date;
  /** イベントの種別名 */
  readonly eventType: string;
}

/**
 * ドメインイベントを発行できるエンティティの基底クラス
 */
export abstract class AggregateRoot {
  private _domainEvents: DomainEvent[] = [];

  /** ドメインイベントを追加する */
  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  /** 蓄積されたドメインイベントを取得し、クリアする */
  pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }
}
