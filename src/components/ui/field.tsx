import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Accessible form fields: every control has a visible <label>, hints and errors
 * are linked with aria-describedby, and invalid fields set aria-invalid.
 */

export const controlClass =
  "block w-full rounded-[var(--radius-field)] border border-line-strong/70 bg-plaster px-3.5 py-2.5 text-[0.9375rem] text-ink placeholder:text-ink-soft/60 transition-colors focus:border-olive focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-olive aria-[invalid=true]:border-wine disabled:opacity-60";

type FieldShellProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
};

export function FieldShell({ label, hint, error, optional, className, children }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-sm font-medium text-ink">
        <span>{label}</span>
        {optional ? <span className="text-xs font-normal text-ink-soft">Optional</span> : null}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint ? (
        <p id={hintId} className="text-[0.8125rem] leading-snug text-ink-soft">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-[0.8125rem] leading-snug text-wine">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type InputFieldProps = Omit<ComponentProps<"input">, "id"> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  containerClassName?: string;
};

export function InputField({ label, hint, error, optional, containerClassName, className, ...props }: InputFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional} className={containerClassName}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(controlClass, className)}
          {...props}
        />
      )}
    </FieldShell>
  );
}

type TextareaFieldProps = Omit<ComponentProps<"textarea">, "id"> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  containerClassName?: string;
};

export function TextareaField({ label, hint, error, optional, containerClassName, className, rows = 4, ...props }: TextareaFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional} className={containerClassName}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(controlClass, "resize-y leading-relaxed", className)}
          {...props}
        />
      )}
    </FieldShell>
  );
}

type SelectFieldProps = Omit<ComponentProps<"select">, "id"> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  containerClassName?: string;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
};

export function SelectField({ label, hint, error, optional, containerClassName, className, options, placeholder, ...props }: SelectFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional} className={containerClassName}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <select
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={cn(controlClass, "appearance-none pr-10", className)}
            {...props}
          >
            {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
          <svg aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      )}
    </FieldShell>
  );
}

type CheckboxFieldProps = Omit<ComponentProps<"input">, "type" | "id"> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  className?: string;
};

export function CheckboxField({ label, hint, error, className, ...props }: CheckboxFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
          aria-invalid={error ? true : undefined}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-line-strong accent-olive"
          {...props}
        />
        <label htmlFor={id} className="text-[0.9375rem] leading-snug text-ink">
          {label}
        </label>
      </div>
      {hint ? (
        <p id={hintId} className="pl-8 text-[0.8125rem] text-ink-soft">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="pl-8 text-[0.8125rem] text-wine">
          {error}
        </p>
      ) : null}
    </div>
  );
}
