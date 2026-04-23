
-- Orders table for token mint payment-before-mint flow
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  amount_sol NUMERIC(20, 9) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_signature TEXT,
  token_signature TEXT,
  mint_address TEXT,
  ata_address TEXT,
  token_name TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  decimals INTEGER NOT NULL,
  initial_supply NUMERIC(40, 0) NOT NULL,
  cluster TEXT NOT NULL,
  base_fee_sol NUMERIC(20, 9) NOT NULL,
  addon_fee_sol NUMERIC(20, 9) NOT NULL,
  selected_options JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_fee_sol NUMERIC(20, 9) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT orders_status_check CHECK (status IN ('pending', 'paid', 'minted', 'failed')),
  CONSTRAINT orders_cluster_check CHECK (cluster IN ('devnet', 'mainnet'))
);

CREATE INDEX idx_orders_wallet ON public.orders (wallet_address);
CREATE INDEX idx_orders_payment_sig ON public.orders (payment_signature);
CREATE UNIQUE INDEX idx_orders_payment_sig_unique ON public.orders (payment_signature) WHERE payment_signature IS NOT NULL;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- No client access — all reads/writes go through server functions using the service role key.
-- (Intentionally no policies: RLS will deny anon and authenticated requests.)

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
