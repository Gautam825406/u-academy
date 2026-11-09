// Type declarations for @cashfreepayments/cashfree-js (v1.0.x).
// The package ships no .d.ts of its own; these types follow the official
// Cashfree Hosted Web Checkout docs
// (https://www.cashfree.com/docs/payments/online/web/redirect):
//   import { load } from "@cashfreepayments/cashfree-js";
//   const cashfree = await load({ mode: "production" });
//   await cashfree.checkout({ paymentSessionId, redirectTarget: "_self" });
declare module "@cashfreepayments/cashfree-js" {
  export type CashfreeMode = "sandbox" | "production";
  export type CashfreeRedirectTarget = "_self" | "_modal" | "_top" | "_blank";
  export interface CashfreeCheckoutResult {
    error?: { code: string; message: string };
    redirect?: boolean;
    paymentDetails?: unknown;
  }
  export interface Cashfree {
    checkout(options: {
      paymentSessionId: string;
      redirectTarget?: CashfreeRedirectTarget;
      returnUrl?: string;
    }): Promise<CashfreeCheckoutResult>;
  }
  export function load(options: { mode: CashfreeMode }): Promise<Cashfree | null>;
}
