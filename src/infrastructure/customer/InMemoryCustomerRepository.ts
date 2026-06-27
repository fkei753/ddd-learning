import { Customer } from "../../domain/customer/Customer";
import { CustomerId } from "../../domain/customer/CustomerId";
import { CustomerRepository } from "../../domain/customer/CustomerRepository";

/**
 * インフラ層：InMemoryCustomerRepository
 */
export class InMemoryCustomerRepository implements CustomerRepository {
  private readonly store = new Map<string, Customer>();

  async findById(id: CustomerId): Promise<Customer | null> {
    return this.store.get(id.value) ?? null;
  }

  async save(customer: Customer): Promise<void> {
    this.store.set(customer.id.value, customer);
  }
}
