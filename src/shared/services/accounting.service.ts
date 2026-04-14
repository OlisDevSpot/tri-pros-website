import type { QBCustomer, QBInvoice, QBInvoiceLine, QBPayment, QBQueryResponse } from '@/shared/services/quickbooks/types'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { projects } from '@/shared/db/schema/projects'
import { proposals } from '@/shared/db/schema/proposals'
import { qbRequest } from '@/shared/services/quickbooks/client'

function createAccountingService() {
  function derivePaymentStatus(balance: number, total: number): string {
    if (balance <= 0) {
      return 'paid'
    }
    if (balance < total) {
      return 'partial'
    }
    return 'unpaid'
  }

  return {
    ensureCustomer: async (customerId: string): Promise<string> => {
      const [customer] = await db.select().from(customers).where(eq(customers.id, customerId))

      if (!customer) {
        throw new Error(`Customer ${customerId} not found`)
      }

      if (customer.qbCustomerId) {
        return customer.qbCustomerId
      }

      let existingQBCustomer: QBCustomer | undefined

      if (customer.email) {
        const emailQuery = await qbRequest<QBQueryResponse<QBCustomer>>(
          `/query?query=${encodeURIComponent(`SELECT * FROM Customer WHERE PrimaryEmailAddr = '${customer.email}'`)}`,
        )
        existingQBCustomer = emailQuery.QueryResponse.Customer?.[0]
      }

      if (!existingQBCustomer && customer.name) {
        const nameQuery = await qbRequest<QBQueryResponse<QBCustomer>>(
          `/query?query=${encodeURIComponent(`SELECT * FROM Customer WHERE DisplayName = '${customer.name}'`)}`,
        )
        existingQBCustomer = nameQuery.QueryResponse.Customer?.[0]
      }

      let qbCustomerId: string

      if (existingQBCustomer) {
        qbCustomerId = existingQBCustomer.Id
      }
      else {
        const newCustomer = await qbRequest<{ Customer: QBCustomer }>(
          '/customer',
          {
            method: 'POST',
            body: JSON.stringify({
              DisplayName: customer.name,
              PrimaryEmailAddr: customer.email ? { Address: customer.email } : undefined,
              PrimaryPhone: customer.phone ? { FreeFormNumber: customer.phone } : undefined,
              BillAddr: {
                Line1: customer.address ?? '',
                City: customer.city,
                CountrySubDivisionCode: customer.state ?? 'CA',
                PostalCode: customer.zip,
              },
            }),
          },
        )
        qbCustomerId = newCustomer.Customer.Id
      }

      await db.update(customers).set({ qbCustomerId }).where(eq(customers.id, customerId))
      return qbCustomerId
    },

    ensureProjectSubCustomer: async (projectId: string, qbParentCustomerId: string): Promise<string> => {
      const [project] = await db.select().from(projects).where(eq(projects.id, projectId))

      if (!project) {
        throw new Error(`Project ${projectId} not found`)
      }

      if (project.qbSubCustomerId) {
        return project.qbSubCustomerId
      }

      const displayName = `${project.homeownerName ?? project.title} - ${project.title}`

      const newSubCustomer = await qbRequest<{ Customer: QBCustomer }>(
        '/customer',
        {
          method: 'POST',
          body: JSON.stringify({
            DisplayName: displayName.slice(0, 100),
            ParentRef: { value: qbParentCustomerId },
            BillWithParent: true,
            BillAddr: {
              Line1: project.address ?? '',
              City: project.city,
              CountrySubDivisionCode: project.state ?? 'CA',
              PostalCode: project.zip ?? '',
            },
          }),
        },
      )

      const qbSubCustomerId = newSubCustomer.Customer.Id
      await db.update(projects).set({ qbSubCustomerId }).where(eq(projects.id, projectId))
      return qbSubCustomerId
    },

    createInvoice: async (projectId: string, proposalIds: string[]): Promise<string> => {
      const [project] = await db.select().from(projects).where(eq(projects.id, projectId))

      if (!project?.qbSubCustomerId) {
        throw new Error(`Project ${projectId} has no QB sub-customer`)
      }

      const proposalRows = await db.select().from(proposals).where(inArray(proposals.id, proposalIds))

      const lineItems: QBInvoiceLine[] = proposalRows
        .filter(Boolean)
        .map((proposal) => {
          const funding = proposal.fundingJSON?.data
          return {
            Amount: funding?.finalTcp ?? 0,
            DetailType: 'SalesItemLineDetail' as const,
            Description: `Proposal: ${proposal.label}`,
            SalesItemLineDetail: {
              ItemRef: { value: '1', name: 'Services' },
              UnitPrice: funding?.finalTcp ?? 0,
              Qty: 1,
            },
          }
        })

      if (lineItems.length === 0) {
        throw new Error('No proposal line items to invoice')
      }

      const newInvoice = await qbRequest<{ Invoice: QBInvoice }>(
        '/invoice',
        {
          method: 'POST',
          body: JSON.stringify({
            CustomerRef: { value: project.qbSubCustomerId },
            Line: lineItems,
          }),
        },
      )

      const qbInvoiceId = newInvoice.Invoice.Id

      if (proposalIds[0]) {
        await db
          .update(proposals)
          .set({ qbInvoiceId, qbPaymentStatus: 'unpaid' })
          .where(eq(proposals.id, proposalIds[0]))
      }

      return qbInvoiceId
    },

    syncPaymentStatus: async (paymentId: string, _realmId: string): Promise<void> => {
      const paymentData = await qbRequest<{ Payment: QBPayment }>(`/payment/${paymentId}`)
      const payment = paymentData.Payment

      // Collect all linked invoice IDs
      const invoiceIds = payment.Line
        .flatMap(line => line.LinkedTxn)
        .filter(txn => txn.TxnType === 'Invoice')
        .map(txn => txn.TxnId)

      if (invoiceIds.length === 0) {
        return
      }

      // Batch: find proposals linked to these invoices
      const linkedProposals = await db
        .select()
        .from(proposals)
        .where(inArray(proposals.qbInvoiceId, invoiceIds))

      if (linkedProposals.length === 0) {
        return
      }

      // Parallel: fetch all invoice details from QB
      const invoiceResults = await Promise.all(
        invoiceIds.map(id => qbRequest<{ Invoice: QBInvoice }>(`/invoice/${id}`)),
      )

      const invoiceMap = new Map(invoiceResults.map(r => [r.Invoice.Id, r.Invoice]))

      // Update each linked proposal
      for (const proposal of linkedProposals) {
        if (!proposal.qbInvoiceId) {
          continue
        }

        const invoice = invoiceMap.get(proposal.qbInvoiceId)
        if (!invoice) {
          continue
        }

        const status = derivePaymentStatus(invoice.Balance, invoice.TotalAmt)
        await db.update(proposals).set({ qbPaymentStatus: status }).where(eq(proposals.id, proposal.id))
      }
    },

    syncInvoiceStatus: async (invoiceId: string, _realmId: string): Promise<void> => {
      const invoiceData = await qbRequest<{ Invoice: QBInvoice }>(`/invoice/${invoiceId}`)
      const invoice = invoiceData.Invoice

      const [proposal] = await db
        .select()
        .from(proposals)
        .where(eq(proposals.qbInvoiceId, invoiceId))

      if (!proposal) {
        return
      }

      const status = derivePaymentStatus(invoice.Balance, invoice.TotalAmt)
      await db.update(proposals).set({ qbPaymentStatus: status }).where(eq(proposals.id, proposal.id))
    },
  }
}

export type AccountingService = ReturnType<typeof createAccountingService>
export const accountingService = createAccountingService()
