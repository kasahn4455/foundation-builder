import { useRef } from "react";
import { Upload, Image as ImageIcon } from "lucide-react";
import { useWizard } from "./WizardContext";

export function TokenInfoStep() {
  const { state, set, setStep } = useWizard();
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    set("tokenLogo", file);
    set("tokenLogoPreview", URL.createObjectURL(file));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Token Information</h2>
        <span className="text-[11px] rounded-full border border-border bg-muted/40 px-2.5 py-1 text-muted-foreground">
          Solana Official
        </span>
      </div>

      <Field label="Token Name" hint="On-chain value">
        <input
          type="text"
          value={state.tokenName}
          onChange={(e) => set("tokenName", e.target.value)}
          placeholder="Cosmic Coin"
          className="input-dark"
        />
        <p className="helper">Enter the full name of your token</p>
      </Field>

      <Field label="Token Symbol" hint="On-chain identifier">
        <input
          type="text"
          value={state.tokenSymbol}
          onChange={(e) => set("tokenSymbol", e.target.value.toUpperCase())}
          placeholder="CSMC"
          maxLength={5}
          className="input-dark"
        />
        <p className="helper">Short symbol (2-5 characters) that identifies your token</p>
      </Field>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Token Logo</label>
          <span className="text-[11px] rounded-full bg-success/15 text-success border border-success/30 px-2.5 py-1">
            IPFS Storage
          </span>
        </div>

        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFile(e.dataTransfer.files?.[0] ?? null);
          }}
          className="cursor-pointer rounded-2xl border-2 border-dashed border-border bg-muted/30 hover:bg-muted/50 transition px-6 py-10 text-center"
        >
          {state.tokenLogoPreview ? (
            <div className="flex flex-col items-center gap-3">
              <img
                src={state.tokenLogoPreview}
                alt="Logo preview"
                className="h-20 w-20 rounded-xl object-cover border border-border"
              />
              <p className="text-sm text-muted-foreground">{state.tokenLogo?.name}</p>
              <p className="text-xs text-accent">Click to replace</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="h-14 w-14 rounded-full bg-gradient-primary/20 grid place-items-center shadow-glow">
                <Upload className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="font-medium">Drop your 500 x 500 token logo here</p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG, GIF up to 5MB</p>
              </div>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <p className="helper mt-2 flex items-center gap-1.5">
          <ImageIcon className="h-3.5 w-3.5" />
          Your logo will be stored on IPFS and linked in your token's on-chain metadata
        </p>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={() => setStep(2)}
          className="btn-primary w-full sm:w-auto rounded-full bg-gradient-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-glow"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium">{label}</label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
