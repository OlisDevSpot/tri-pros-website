export interface QBCustomer {
  Id: string
  DisplayName: string
  PrimaryEmailAddr?: { Address: string }
  PrimaryPhone?: { FreeFormNumber: string }
  BillAddr?: {
    Line1?: string
    City?: string
    CountrySubDivisionCode?: string
    PostalCode?: string
  }
  ParentRef?: { value: string }
  BillWithParent?: boolean
  SyncToken: string
}

export interface QBInvoice {
  Id: string
  DocNumber?: string
  TxnDate?: string
  DueDate?: string
  TotalAmt: number
  Balance: number
  CustomerRef: { value: string, name?: string }
  Line: QBInvoiceLine[]
  SyncToken: string
}

export interface QBInvoiceLine {
  Amount: number
  DetailType: 'SalesItemLineDetail' | 'SubTotalLineDetail'
  Description?: string
  SalesItemLineDetail?: {
    ItemRef: { value: string, name?: string }
    UnitPrice?: number
    Qty?: number
  }
}

export interface QBPayment {
  Id: string
  TotalAmt: number
  TxnDate: string
  CustomerRef: { value: string, name?: string }
  Line: {
    Amount: number
    LinkedTxn: { TxnId: string, TxnType: string }[]
  }[]
  SyncToken: string
}

export interface QBQueryResponse<T> {
  QueryResponse: Record<string, T[]> & {
    startPosition: number
    maxResults: number
  }
}
