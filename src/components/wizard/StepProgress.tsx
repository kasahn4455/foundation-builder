import { Check } from "lucide-react";
import { useWizard } from "./WizardContext";

const steps = ["Token Info", "Supply", "Details"];

export function StepProgress() {
  const { step } = useWizard();
  return (
    <div className="flex items-center justify-between gap-2 max-w-2xl mx-auto">
      {steps.map((label, i) => {
        const n = i + 1;
        const isActive = n === step;
        const isDone = n < step;
        return (
          <div key={label} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-2 min-w-0">
              <div
                className={[
                  "h-10 w-10 rounded-full grid place-items-center text-sm font-semibold border transition",
                  isActive
                    ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow"
                    : isDone
                      ? "bg-accent/20 text-accent border-accent/40"
                      : "bg-muted text-muted-foreground border-border",
                ].join(" ")}
              >
                {isDone ? <Check className="h-4 w-4" /> : n}
              </div>
              <div
                className={[
                  "text-[11px] sm:text-xs truncate max-w-[80px] sm:max-w-none text-center",
                  isActive ? "text-foreground font-medium" : "text-muted-foreground",
                ].join(" ")}
              >
                {label}
              </div>
            </div>
            {n < steps.length && (
              <div className="flex-1 h-px mx-2 sm:mx-4 bg-border relative overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-primary transition-all"
                  style={{ width: isDone ? "100%" : "0%" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
