'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import { ptBR } from 'react-day-picker/locale'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import type { DayPickerProps } from 'react-day-picker'

export type CalendarProps = DayPickerProps

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      locale={ptBR}
      showOutsideDays={showOutsideDays}
      className={cn('rounded-lg border border-slate-200 bg-white p-3', className)}
      classNames={{
        months: 'flex flex-col gap-4 sm:flex-row',
        month: 'flex flex-col gap-4',
        month_caption: 'flex justify-center pt-1 relative items-center h-8',
        caption_label: 'text-sm font-medium text-slate-900',
        nav: 'flex items-center gap-1',
        button_previous: cn(
          buttonVariants({ variant: 'outline' }),
          'absolute left-1 h-8 w-8 bg-transparent p-0 opacity-70 hover:opacity-100 border-0'
        ),
        button_next: cn(
          buttonVariants({ variant: 'outline' }),
          'absolute right-1 h-8 w-8 bg-transparent p-0 opacity-70 hover:opacity-100 border-0'
        ),
        month_grid: 'w-full border-collapse space-x-1',
        weekdays: 'flex',
        weekday: 'text-slate-500 rounded-md w-9 font-normal text-[0.8rem]',
        week: 'flex w-full mt-2',
        day: 'relative p-0 text-center text-sm',
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-9 w-9 p-0 font-normal hover:bg-slate-100 hover:text-slate-900'
        ),
        selected: 'bg-slate-900 text-slate-50 rounded-md hover:bg-slate-900 hover:text-slate-50',
        today: 'bg-slate-100 text-slate-900 rounded-md',
        outside: 'text-slate-400 opacity-50',
        disabled: 'text-slate-400 opacity-50',
        range_start: 'rounded-l-md bg-slate-900 text-slate-50',
        range_end: 'rounded-r-md bg-slate-900 text-slate-50',
        range_middle: 'bg-slate-100 text-slate-400',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...rest }) =>
          orientation === 'left' ? (
            <ChevronLeft className="h-4 w-4" {...rest} />
          ) : (
            <ChevronRight className="h-4 w-4" {...rest} />
          ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = 'Calendar'

export { Calendar }
