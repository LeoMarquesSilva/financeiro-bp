import { useMemo } from 'react'
import PhoneInput, { type Value } from 'react-phone-number-input'
import flags from 'react-phone-number-input/flags'
import pt from 'react-phone-number-input/locale/pt.json'
import { cn } from '@/lib/utils'
import { parsePhoneDigits } from '../utils/phoneMask'
import './phone-input-country.css'

interface Props {
  /** Dígitos com DDI (ex.: 5511999999999). */
  value: string
  onChange: (digits: string) => void
  disabled?: boolean
  id?: string
  className?: string
}

function digitsToE164(digits: string): Value | undefined {
  const d = parsePhoneDigits(digits)
  if (!d) return undefined
  return `+${d}` as Value
}

function e164ToDigits(value: Value | undefined): string {
  if (!value) return ''
  return parsePhoneDigits(value)
}

/**
 * Campo de telefone com seletor de país (bandeira + DDI).
 * Usa react-phone-number-input — o país é escolhido no dropdown, default BR.
 */
export function PhoneInputCountry({ value, onChange, disabled, id, className }: Props) {
  const e164Value = useMemo(() => digitsToE164(value), [value])

  return (
    <div className={cn('phone-input-country rounded-lg', className)}>
      <PhoneInput
        id={id}
        flags={flags}
        labels={pt}
        defaultCountry="BR"
        international
        countryCallingCodeEditable={false}
        addInternationalOption={false}
        value={e164Value}
        disabled={disabled}
        onChange={(next) => onChange(e164ToDigits(next))}
        placeholder="Selecione o país e digite o número"
      />
    </div>
  )
}
