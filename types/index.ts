export type {
  UserRow,
  TransactionRow,
  SubscriptionRow,
  EventRow,
  OrderRow,
  ContentRow,
  ActivityLogRow,
} from "./database";

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface TableSearchParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  status?: string;
}
