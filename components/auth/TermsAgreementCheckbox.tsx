"use client"

import { TermsModal } from "@/components/auth/TermsModal"
import { cn } from "@/lib/utils"

interface TermsAgreementCheckboxProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

const AGREEMENT_TEXT = 'By checking "I Agree", you confirm that you have read and accept Nook\'s full '

export function TermsAgreementCheckbox({
  checked,
  onCheckedChange,
  disabled = false,
  className,
}: TermsAgreementCheckboxProps) {
  return (
    <label
      className={cn(
        "flex items-start gap-2 cursor-pointer text-sm text-muted-foreground",
        disabled && "cursor-not-allowed opacity-70",
        className
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 rounded border-input"
        aria-describedby="terms-agreement-desc"
      />
      <span id="terms-agreement-desc">
        {AGREEMENT_TEXT}
        <TermsModal
          trigger={
            <button
              type="button"
              className="underline font-medium text-foreground hover:no-underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
              onClick={(e) => e.stopPropagation()}
            >
              Terms & Conditions
            </button>
          }
        />
        .
      </span>
    </label>
  )
}
