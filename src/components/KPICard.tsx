import { ReactNode } from 'react';
import { cn } from '../utils';

interface KPICardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  className?: string;
  valueClassName?: string;
}

export function KPICard({ title, value, unit, subtitle, className, valueClassName }: KPICardProps) {
  return (
    <div className={cn("bg-white border border-slate-200 p-2 md:p-3 rounded shadow-sm flex flex-col justify-between h-full min-h-[70px]", className)}>
      <span className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest">{title}</span>
      <div className="flex flex-col mt-1">
        <div className="flex items-baseline justify-between w-full">
          <span className={cn("text-2xl md:text-3xl font-bold leading-none", valueClassName)}>{value} {unit && <span className="text-sm font-normal text-slate-400">{unit}</span>}</span>
        </div>
        {subtitle && <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide mt-1 leading-none">{subtitle}</span>}
      </div>
    </div>
  );
}
